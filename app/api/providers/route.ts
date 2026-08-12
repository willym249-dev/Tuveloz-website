import { env } from "cloudflare:workers";
import { and, desc, eq, gt, ne, sql } from "drizzle-orm";
import { getDb } from "../../../db";
import {
  agreementAcceptances,
  providerApplicationChallenges,
  providerApplicationEmailClaims,
  providerApplicationSubmissionEvidence,
  providerAuditEvents,
  providerApplications,
  providerPathwayProfiles,
  providerPersonnel,
} from "../../../db/schema";
import {
  InvalidJsonBodyError,
  readLimitedJsonObject,
  RequestBodyTooLargeError,
} from "../../../lib/limited-json";
import {
  normalizeProviderApplicationPayload,
  providerApplicationFinalDocumentManifest,
  providerApplicationNormalizedSnapshot,
  PROVIDER_APPLICATION_GENERIC_COMPLETE_MESSAGE,
  PROVIDER_APPLICATION_MAX_JSON_BYTES,
  ProviderApplicationValidationError,
  providerApplicationRelationship,
  providerApplicationRequestIp,
  verifyProviderApplicationChallenge,
} from "../../../lib/provider-application-verification";
import { notifyProviderApplicationReceived } from "../../../lib/provider-compliance-notifications";
import {
  PROVIDER_ACCEPTANCE_DOCUMENTS,
  providerAgreementEvidenceText,
  sha256Text,
} from "../../../lib/provider-policy-acceptance";
import {
  POLICY_JURISDICTION,
  POLICY_STATUS,
  POLICY_VERSION,
} from "../../../lib/provider-policy";
import { PROVIDER_POLICY_BUNDLE_VERSION } from "../../../lib/policies";
import { recordPhoneContactConsent } from "../../../lib/phone-contact-consent";
import { recordReferralSignup } from "../../../lib/referrals";
import { isStrictSameOriginWriteRequest } from "../../../lib/request-security";

const NO_STORE_HEADERS = { "cache-control": "private, no-store" };
const EMAIL_CONTROL_SCOPE =
  "Email one-time-code verification confirms control of the submitted email address only. It does not verify identity, age, signing authority, business registration, licensing, insurance, qualifications, work authorization, or eligibility for jobs.";

function clean(value: unknown, maximum: number) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

async function activeApplicationForEmail(email: string) {
  const db = getDb();
  const [claimed] = await db.select({
    id: providerApplications.id,
    status: providerApplications.status,
  }).from(providerApplicationEmailClaims)
    .innerJoin(
      providerApplications,
      eq(providerApplications.id, providerApplicationEmailClaims.providerId),
    )
    .where(eq(providerApplicationEmailClaims.normalizedEmail, email))
    .limit(1);
  if (claimed && claimed.status !== "declined") {
    return { ...claimed, claimed: true as const };
  }

  const [legacy] = await db.select({
    id: providerApplications.id,
    status: providerApplications.status,
  }).from(providerApplications).where(and(
    eq(sql<string>`lower(trim(${providerApplications.email}))`, email),
    ne(providerApplications.status, "declined"),
  )).orderBy(desc(providerApplications.createdAt), desc(providerApplications.id)).limit(1);
  return legacy ? { ...legacy, claimed: false as const } : null;
}

function genericCompleteResponse() {
  return Response.json({
    ok: true,
    message: PROVIDER_APPLICATION_GENERIC_COMPLETE_MESSAGE,
    onboardingUrl: "/provider-onboarding",
  }, { status: 202, headers: NO_STORE_HEADERS });
}

function invalidChallengeResponse() {
  return Response.json(
    { error: "That verification code is invalid, expired, already used, or does not match this application." },
    { status: 401, headers: NO_STORE_HEADERS },
  );
}

export async function POST(request: Request) {
  if (!isStrictSameOriginWriteRequest(request)) {
    return Response.json(
      { error: "This verified application must be submitted from TUVELOZ." },
      { status: 403, headers: NO_STORE_HEADERS },
    );
  }

  try {
    const body = await readLimitedJsonObject(
      request,
      PROVIDER_APPLICATION_MAX_JSON_BYTES,
    );
    const challengeId = clean(body.challengeId, 64);
    const verificationCode = clean(body.verificationCode, 12);
    const application = normalizeProviderApplicationPayload(body);
    const verified = await verifyProviderApplicationChallenge(
      application,
      challengeId,
      verificationCode,
    );
    if (!verified) {
      return invalidChallengeResponse();
    }

    const db = getDb();
    const now = new Date().toISOString();
    const consumptionNonce = crypto.randomUUID();
    const challengeConsume = () => db.update(providerApplicationChallenges).set({
      usedAt: now,
      consumptionNonce,
    }).where(and(
      eq(providerApplicationChallenges.id, verified.challenge.id),
      eq(providerApplicationChallenges.email, application.email),
      eq(providerApplicationChallenges.payloadHash, verified.payloadHash),
      eq(providerApplicationChallenges.usedAt, ""),
      eq(providerApplicationChallenges.consumptionNonce, ""),
      eq(providerApplicationChallenges.verifiedAt, verified.challenge.verifiedAt),
      gt(providerApplicationChallenges.expiresAt, now),
    )).returning({ id: providerApplicationChallenges.id });
    const challengeWasConsumedByConcurrentRequest = async () => {
      const [consumed] = await db.select({ id: providerApplicationChallenges.id })
        .from(providerApplicationChallenges)
        .where(and(
          eq(providerApplicationChallenges.id, verified.challenge.id),
          eq(providerApplicationChallenges.email, application.email),
          eq(providerApplicationChallenges.payloadHash, verified.payloadHash),
          eq(providerApplicationChallenges.verifiedAt, verified.challenge.verifiedAt),
          gt(providerApplicationChallenges.usedAt, ""),
          gt(providerApplicationChallenges.consumptionNonce, ""),
        ))
        .limit(1);
      return Boolean(consumed);
    };

    const existing = await activeApplicationForEmail(application.email);
    if (existing) {
      // Proof of email control is required even for an idempotent retry. The
      // response deliberately reveals no application identifier or status.
      if (existing.claimed) {
        const consumed = await challengeConsume();
        if (!consumed.length && !await challengeWasConsumedByConcurrentRequest()) {
          return invalidChallengeResponse();
        }
      } else {
        try {
          await db.batch([
            challengeConsume(),
            db.insert(providerApplicationEmailClaims).values({
              normalizedEmail: application.email,
              providerId: existing.id,
              challengeId: verified.challenge.id,
              consumptionNonce,
              claimedAt: now,
            }).onConflictDoNothing(),
          ] as const);
        } catch (claimError) {
          const winner = await activeApplicationForEmail(application.email);
          if (!winner || !await challengeWasConsumedByConcurrentRequest()) {
            throw claimError;
          }
        }
      }
      return genericCompleteResponse();
    }

    const providerId = crypto.randomUUID();
    const personId = crypto.randomUUID();
    const submissionEvidenceId = crypto.randomUUID();
    const acceptedDocumentManifest = await providerApplicationFinalDocumentManifest(
      verified.challenge.id,
    );
    const applicationMetadata = {
      ...application.providerSelfAssessment,
      onboarding: {
        applicationPathway: application.applicationPathway,
        providerLevel: application.providerLevel,
        phone: application.phone,
        policyVersion: POLICY_VERSION,
        policyStatus: POLICY_STATUS,
        jurisdiction: POLICY_JURISDICTION,
        legalBusinessName: application.legalBusinessName,
        businessEntityType: application.businessEntityType,
        businessFormationState: application.businessFormationState,
        sponsoringProviderLegalName: application.sponsoringProviderLegalName,
        sponsorContactName: application.sponsorContactName,
        sponsorContactEmail: application.sponsorContactEmail,
        sponsorContactTitle: application.sponsorContactTitle,
        signerName: application.signerName,
        signerTitle: application.signerTitle,
        adultAcknowledgedAt: now,
        employmentResponsibilityAcknowledgedAt: now,
        emailControlVerifiedAt: verified.challenge.verifiedAt,
        emailControlVerificationScope: EMAIL_CONTROL_SCOPE,
        emailControlChallengeId: verified.challenge.id,
        providerApplicationSubmissionEvidenceId: submissionEvidenceId,
      },
    };
    const eligibilityStatuses = Object.fromEntries(application.serviceCodes.map((serviceCode) => [
      serviceCode,
      {
        status: "blocked",
        reasons: [
          "Application review only: service access is disabled until the required evidence, mandatory legal and government requirements, and exact-operation insurance approval are recorded.",
        ],
      },
    ]));

    const applicationInsert = db.insert(providerApplications).values({
      id: providerId,
      name: application.name,
      email: application.email,
      preferredLanguage: application.preferredLanguage,
      service: application.service,
      serviceArea: application.serviceArea,
      businessMunicipality: application.businessMunicipality,
      workLocations: application.workLocationsSerialized,
      businessServiceAddress: application.businessServiceAddress,
      experience: application.experience,
      insuranceStatus: "pending-evidence",
      providerSelfAssessment: JSON.stringify(applicationMetadata),
      serviceEligibilityStatuses: JSON.stringify(eligibilityStatuses),
      approvedServices: "",
      serviceRulesVersion: POLICY_VERSION,
      serviceRulesAcknowledgedAt: now,
      termsAcceptedAt: now,
      termsVersion: PROVIDER_POLICY_BUNDLE_VERSION,
      status: "new",
      verificationStatus: "not reviewed",
    });

    const holdReasonCodes = application.applicationPathway === "learning_account"
      ? ["learning_account_no_customer_jobs", "services_not_activated"]
      : [
          "pending_identity_and_evidence_review",
          "services_not_activated",
          ...(application.applicationPathway === "sponsored_trainee_employee"
            || application.applicationPathway === "provider_business_employee"
            ? ["sponsor_or_employer_confirmation_required"]
            : []),
        ];
    const pathwayInsert = db.insert(providerPathwayProfiles).values({
      id: crypto.randomUUID(),
      providerId,
      providerPersonId: personId,
      relationshipPath: application.applicationPathway,
      providerLevel: application.providerLevel,
      pathwayVersion: 1,
      status: application.applicationPathway === "learning_account"
        ? "learning_only"
        : "pending_review",
      policyVersion: POLICY_VERSION,
      holdReasonCodes: JSON.stringify(holdReasonCodes),
      createdAt: now,
      updatedAt: now,
    });
    const personnelInsert = db.insert(providerPersonnel).values({
      id: crypto.randomUUID(),
      providerId,
      personId,
      relationshipType: providerApplicationRelationship(application.applicationPathway),
      personnelRole: "technician",
      providerLevel: application.providerLevel,
      rosterVersion: 1,
      status: application.applicationPathway === "learning_account" ? "learning_only" : "pending",
      createdAt: now,
      updatedAt: now,
    });

    const emailControlVerification = {
      method: "email_one_time_code",
      scope: "email_control_only",
      verifiedEmail: application.email,
      verifiedAt: verified.challenge.verifiedAt,
      challengeId: verified.challenge.id,
      consumptionNonce,
      providerApplicationSubmissionEvidenceId: submissionEvidenceId,
      limitation: EMAIL_CONTROL_SCOPE,
    };
    const deviceContext = JSON.stringify({
      userAgent: clean(request.headers.get("user-agent"), 600),
      language: clean(request.headers.get("accept-language"), 200),
      country: clean(request.headers.get("cf-ipcountry"), 20),
      policyBundleVersion: PROVIDER_POLICY_BUNDLE_VERSION,
      policyStatus: POLICY_STATUS,
      emailControlVerification,
    });
    const acceptanceInserts = [];
    for (const document of PROVIDER_ACCEPTANCE_DOCUMENTS) {
      const agreementText = providerAgreementEvidenceText(document, {
        acceptanceEvidenceId: verified.challenge.id,
      });
      const documentBinding = acceptedDocumentManifest.find(
        (entry) => entry.key === document.key,
      );
      if (!documentBinding) throw new Error(`Missing application document binding: ${document.key}`);
      acceptanceInserts.push(db.insert(agreementAcceptances).values({
        id: crypto.randomUUID(),
        providerId,
        personId,
        jurisdiction: POLICY_JURISDICTION,
        agreementKey: document.key,
        agreementVersion: document.version,
        agreementHash: documentBinding.finalAgreementHash,
        agreementText,
        acceptedByName: application.signerName,
        acceptedByTitle: application.signerTitle,
        acceptanceAction: document.control === "privacy-acknowledgment"
          ? "affirmative-separate-privacy-checkbox-plus-email-code"
          : "affirmative-provider-terms-bundle-checkbox-plus-email-code",
        acceptedAt: now,
        ipAddress: providerApplicationRequestIp(request),
        sessionId: verified.challenge.id,
        deviceContext,
        providerApplicationSubmissionEvidenceId: submissionEvidenceId,
        createdAt: now,
      }));
    }

    const submissionEvidenceInsert = db.insert(
      providerApplicationSubmissionEvidence,
    ).values({
      id: submissionEvidenceId,
      providerId,
      normalizedEmail: application.email,
      challengeId: verified.challenge.id,
      consumptionNonce,
      normalizedSnapshot: providerApplicationNormalizedSnapshot(application),
      payloadHash: verified.payloadHash,
      acceptedDocumentManifest: JSON.stringify(acceptedDocumentManifest),
      verifiedAt: verified.challenge.verifiedAt,
      consumedAt: now,
      createdAt: now,
    });

    const auditId = crypto.randomUUID();
    const auditMetadata = {
      applicationPathway: application.applicationPathway,
      providerLevel: application.providerLevel,
      serviceCodes: application.serviceCodes,
      agreementVersions: Object.fromEntries(
        PROVIDER_ACCEPTANCE_DOCUMENTS.map((document) => [document.key, document.version]),
      ),
      emailControlVerification,
      providerApplicationSubmissionEvidenceId: submissionEvidenceId,
      applicationPayloadHash: verified.payloadHash,
      identityVerified: false,
      businessVerified: false,
      serviceEligibilityGranted: false,
    };
    const normalizedAuditEvent = {
      id: auditId,
      providerId,
      personId,
      requestId: "",
      serviceCode: "",
      jurisdiction: POLICY_JURISDICTION,
      eventType: "provider_application_submitted",
      entityType: "provider_application",
      entityId: providerId,
      actorType: "email_verified_applicant",
      actorId: application.email,
      outcome: "pending_review_email_control_only",
      reasonCodes: [...holdReasonCodes, "email_control_verified_only"],
      metadata: auditMetadata,
      policyVersion: POLICY_VERSION,
      previousEventHash: "",
      occurredAt: now,
    };
    const auditEventHash = await sha256Text(JSON.stringify(normalizedAuditEvent));
    const auditInsert = db.insert(providerAuditEvents).values({
      id: auditId,
      providerId,
      personId,
      requestId: "",
      serviceCode: "",
      jurisdiction: POLICY_JURISDICTION,
      eventType: "provider_application_submitted",
      entityType: "provider_application",
      entityId: providerId,
      eventVersion: 1,
      actorType: "email_verified_applicant",
      actorId: application.email,
      outcome: "pending_review_email_control_only",
      reasonCodes: JSON.stringify([...holdReasonCodes, "email_control_verified_only"]),
      metadata: JSON.stringify(auditMetadata),
      policyVersion: POLICY_VERSION,
      previousEventHash: "",
      eventHash: auditEventHash,
      occurredAt: now,
      createdAt: now,
    });

    // The challenge is consumed in the same D1 transaction as the normalized
    // email claim and every required application/legal record. A concurrent
    // duplicate claim aborts and rolls back the full batch.
    try {
      await db.batch([
        challengeConsume(),
        db.insert(providerApplicationEmailClaims).values({
          normalizedEmail: application.email,
          providerId,
          challengeId: verified.challenge.id,
          consumptionNonce,
          claimedAt: now,
        }),
        applicationInsert,
        submissionEvidenceInsert,
        pathwayInsert,
        personnelInsert,
        ...acceptanceInserts,
        auditInsert,
      ] as const);
    } catch (batchError) {
      // A concurrent verified request for the same normalized email may have
      // won the unique claim. Only that concrete state converts the conflict
      // into the same non-enumerating, idempotent success response.
      const winner = await activeApplicationForEmail(application.email);
      if (!winner) throw batchError;
      if (winner.claimed) {
        const consumed = await challengeConsume();
        if (!consumed.length && !await challengeWasConsumedByConcurrentRequest()) {
          throw batchError;
        }
      } else {
        try {
          await db.batch([
            challengeConsume(),
            db.insert(providerApplicationEmailClaims).values({
              normalizedEmail: application.email,
              providerId: winner.id,
              challengeId: verified.challenge.id,
              consumptionNonce,
              claimedAt: now,
            }).onConflictDoNothing(),
          ] as const);
        } catch (claimError) {
          if (!await challengeWasConsumedByConcurrentRequest()) throw claimError;
        }
      }
      return genericCompleteResponse();
    }

    // Optional, provider-declared certificates (e.g. ASE) go into the existing
    // provider_submitted_credentials pipeline as pending + not-public. The owner
    // verifies them in marketplace tools; nothing is shown to a customer until
    // then. Best-effort and outside the legal-record transaction: a failure here
    // never fails the application, and these records never gate any service.
    for (const certificate of application.optionalCertificates) {
      try {
        await env.DB.prepare(
          `INSERT INTO provider_submitted_credentials
             (id, provider_id, category, credential_name, issuing_authority,
              credential_identifier, jurisdiction, expires_at,
              status, review_note, public_display, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, '', '', 'pending', '', 'no', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        ).bind(
          crypto.randomUUID(),
          providerId,
          certificate.category,
          certificate.title,
          certificate.issuingAuthority,
          certificate.credentialIdentifier,
        ).run();
      } catch (certificateError) {
        console.error("Unable to store an optional provider certificate", certificateError);
      }
    }
    // Attribution is marketing data, never application evidence: it is
    // recorded after the legal-record transaction, is not part of the
    // normalized application or its payload hash, and cannot fail the
    // application if it errors.
    // Promotional-text permission only. Reaching an applicant about their own
    // application never depends on this record, and a failure here must never
    // fail the application itself.
    await recordPhoneContactConsent({
      role: "provider",
      email: application.email,
      phone: application.phone,
      smsMarketingConsent: body.smsMarketingConsent,
      source: "provider-application",
      spanish: application.preferredLanguage === "es",
    });

    await recordReferralSignup({
      rawCode: body.referralCode,
      referredRole: "provider",
      referredEmail: application.email,
      referredEntityId: providerId,
    });

    // Delivery is best-effort and remains outside the legal-record transaction.
    await notifyProviderApplicationReceived({
      providerId,
      email: application.email,
    });
    return genericCompleteResponse();
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return Response.json(
        { error: "The provider application is too large." },
        { status: 413, headers: NO_STORE_HEADERS },
      );
    }
    if (error instanceof InvalidJsonBodyError) {
      return Response.json(
        { error: error.message },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }
    if (error instanceof ProviderApplicationValidationError) {
      return Response.json(
        { error: error.message },
        { status: error.status, headers: NO_STORE_HEADERS },
      );
    }

    console.error("Unable to save verified provider application", error);
    return Response.json(
      { error: "We could not verify and save the application. Request a new code and try again." },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}
