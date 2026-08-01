import { and, desc, eq } from "drizzle-orm";
import type Stripe from "stripe";
import { getDb } from "../../../db";
import {
  providerApplicationSubmissionEvidence,
  providerIdentityVerificationSessions,
  providerPathwayProfiles,
  providerPersonnel,
} from "../../../db/schema";
import { getAccountSession, providerApplicationFor } from "../../../lib/account-auth";
import { identityClaimSessionHash } from "../../../lib/identity-claim-hash";
import {
  IDENTITY_VERIFICATION_CONSENT_VERSION,
  immutablePerformingPersonName,
} from "../../../lib/identity-verification-policy";
import {
  InvalidJsonBodyError,
  readLimitedJsonObject,
  RequestBodyTooLargeError,
} from "../../../lib/limited-json";
import { isStrictSameOriginWriteRequest } from "../../../lib/request-security";
import { recordProviderAuditEvent } from "../../../lib/provider-audit";
import {
  expiredConfiguredManualIdentityAgeVerificationCanBeReplaced,
  externalIdentityAgeVerificationHasData,
  externalIdentityAgeVerificationIsCurrent,
} from "../../../lib/provider-verification-evidence";
import {
  getStripeIdentityClient,
  getStripeIdentityVerificationFlowId,
  siteUrlFor,
  stripeErrorResponse,
  stripeIdentityModeMatchesProvider,
} from "../../../lib/stripe";
import { stripeIdentitySessionBindingMatches } from "../../../lib/stripe-identity-verification";
import { expireOpenCheckoutSessionsForLaunchShutdown } from "../../../lib/stripe-payments";

const REQUEST_LIMIT_BYTES = 4 * 1024;
const MAX_ATTEMPTS_PER_DAY = 3;
const ATTEMPT_COOLDOWN_MS = 60 * 1000;
const ATTEMPT_WINDOW_MS = 24 * 60 * 60 * 1000;
const IDENTITY_VALIDITY_MS = 365 * 24 * 60 * 60 * 1000;
const NO_STORE_HEADERS = { "cache-control": "private, no-store" };

async function signedInProvider(request: Request) {
  const session = await getAccountSession(request);
  if (!session || session.role !== "provider") return null;
  const provider = await providerApplicationFor(session.email);
  return provider ? { session, provider } : null;
}

function json(body: Record<string, unknown>, init?: ResponseInit) {
  return Response.json(body, {
    ...init,
    headers: { ...NO_STORE_HEADERS, ...(init?.headers ?? {}) },
  });
}

function approvalValidThrough(verifiedAt: number) {
  const anniversary = new Date(verifiedAt + IDENTITY_VALIDITY_MS);
  return Date.UTC(
    anniversary.getUTCFullYear(),
    anniversary.getUTCMonth(),
    anniversary.getUTCDate(),
    23,
    59,
    59,
    999,
  );
}

function stripePersonnelBindingMatchesApprovedAttempt(
  person: typeof providerPersonnel.$inferSelect,
  row: typeof providerIdentityVerificationSessions.$inferSelect,
  canonicalEvidenceId: string,
) {
  const checkedAt = Date.parse(row.checkedAt);
  const validThrough = Number.isFinite(checkedAt)
    ? new Date(approvalValidThrough(checkedAt)).toISOString().slice(0, 10)
    : "";
  return row.applicationSubmissionEvidenceId === canonicalEvidenceId
    && row.decisionStatus === "approved"
    && row.stripeStatus === "verified"
    && Boolean(row.stripeVerificationSessionId)
    && Boolean(row.stripeVerificationReportId)
    && Boolean(row.lastStripeEventId)
    && row.checkedAt === row.verifiedAt
    && person.identityVerificationProvider === "stripe_identity"
    && person.ageVerificationProvider === "stripe_identity"
    && person.identityVerificationReference === row.stripeVerificationSessionId
    && person.ageVerificationReference === row.stripeVerificationSessionId
    && person.identityVerifiedAt === row.checkedAt
    && person.ageVerifiedAt === row.checkedAt
    && person.identityVerificationCheckedAt === row.checkedAt
    && person.ageVerificationCheckedAt === row.checkedAt
    && person.identityVerificationValidThrough === validThrough
    && person.ageVerificationValidThrough === validThrough;
}

function terminalResponse(
  rows: Array<typeof providerIdentityVerificationSessions.$inferSelect>,
  canonicalEvidenceId: string,
  person: typeof providerPersonnel.$inferSelect,
) {
  const canonicalRows = rows.filter((row) => (
    row.applicationSubmissionEvidenceId === canonicalEvidenceId
  ));
  if (canonicalRows.some((row) => {
    const verifiedAt = Date.parse(row.verifiedAt);
    return row.decisionStatus === "approved"
      && stripePersonnelBindingMatchesApprovedAttempt(person, row, canonicalEvidenceId)
      && Number.isFinite(verifiedAt)
      && verifiedAt <= Date.now()
      && approvalValidThrough(verifiedAt) >= Date.now();
  })) {
    return json({ status: "verified", complete: true });
  }
  const latestCanonical = canonicalRows[0];
  if (latestCanonical?.decisionStatus === "blocked") {
    return json({
      error: "Identity verification needs manual review. No service or job access was granted.",
      status: "blocked",
      failureCode: latestCanonical.failureCode,
    }, { status: 409 });
  }
  return null;
}

function expectedModeMatches(
  provider: { isTestProvider: string },
  session: Stripe.Identity.VerificationSession,
) {
  return stripeIdentityModeMatchesProvider(provider.isTestProvider)
    && session.livemode === (provider.isTestProvider !== "yes");
}

async function closeAttempt(
  row: typeof providerIdentityVerificationSessions.$inferSelect,
  status: "canceled" | "redacted" | "superseded",
  failureCode = status === "redacted" ? "session_redacted" : "session_canceled",
) {
  const now = new Date().toISOString();
  const [closed] = await getDb().update(providerIdentityVerificationSessions).set({
    stripeStatus: status,
    decisionStatus: "closed",
    failureCode,
    ...(status === "redacted" ? { redactedAt: now } : {}),
    updatedAt: now,
  }).where(and(
    eq(providerIdentityVerificationSessions.id, row.id),
    eq(providerIdentityVerificationSessions.decisionStatus, "pending"),
  )).returning({ id: providerIdentityVerificationSessions.id });
  return Boolean(closed);
}

async function retrieveAndHandleActive(
  provider: { isTestProvider: string },
  stripe: Stripe,
  row: typeof providerIdentityVerificationSessions.$inferSelect,
  canonicalEvidenceId: string,
) {
  if (
    row.applicationSubmissionEvidenceId !== canonicalEvidenceId
    && !row.stripeVerificationSessionId
  ) {
    await closeAttempt(row, "superseded", "application_evidence_superseded");
    return null;
  }
  if (!row.stripeVerificationSessionId) return null;
  let session: Stripe.Identity.VerificationSession;
  try {
    session = await stripe.identity.verificationSessions.retrieve(
      row.stripeVerificationSessionId,
    );
  } catch (error) {
    if (row.redactedAt) {
      await closeAttempt(row, "redacted");
      return null;
    }
    throw error;
  }
  if (
    !stripeIdentitySessionBindingMatches(row, session)
    || !expectedModeMatches(provider, session)
  ) {
    await getDb().update(providerIdentityVerificationSessions).set({
      decisionStatus: "blocked",
      failureCode: "route_binding_or_mode_mismatch",
      updatedAt: new Date().toISOString(),
    }).where(and(
      eq(providerIdentityVerificationSessions.id, row.id),
      eq(providerIdentityVerificationSessions.decisionStatus, "pending"),
    ));
    return json({
      error: "The Stripe Identity session binding or mode could not be verified. No URL was released.",
      status: "blocked",
    }, { status: 409 });
  }

  if (row.applicationSubmissionEvidenceId !== canonicalEvidenceId) {
    // The immutable local binding was checked above. Close the obsolete
    // attempt first so a delayed/lost webhook cannot approve it or leave the
    // corrected application permanently blocked. Stripe cancellation is a
    // best-effort privacy cleanup because processing/verified sessions cannot
    // always be canceled.
    await closeAttempt(row, "superseded", "application_evidence_superseded");
    if (session.status === "requires_input") {
      try {
        await stripe.identity.verificationSessions.cancel(session.id);
      } catch (error) {
        console.error("Unable to cancel a superseded Stripe Identity session", error);
      }
    }
    return null;
  }

  await getDb().update(providerIdentityVerificationSessions).set({
    stripeStatus: session.status,
    updatedAt: new Date().toISOString(),
  }).where(and(
    eq(providerIdentityVerificationSessions.id, row.id),
    eq(providerIdentityVerificationSessions.decisionStatus, "pending"),
  ));
  if (session.status === "requires_input" && session.url) {
    return json({ status: "requires_input", complete: false, url: session.url });
  }
  if (session.status === "requires_input") {
    const canceled = await stripe.identity.verificationSessions.cancel(session.id);
    if (
      stripeIdentitySessionBindingMatches(row, canceled)
      && expectedModeMatches(provider, canceled)
      && canceled.status === "canceled"
    ) {
      await closeAttempt(row, "canceled", "hosted_url_unavailable");
      return null;
    }
  }
  if (session.status === "canceled") {
    await closeAttempt(row, "canceled");
    return null;
  }
  return json({ status: session.status, complete: false }, { status: 202 });
}

async function cancelSupersededHostedSession(
  provider: { isTestProvider: string },
  stripe: Stripe,
  row: typeof providerIdentityVerificationSessions.$inferSelect,
) {
  if (
    row.decisionStatus !== "closed"
    || row.failureCode !== "application_evidence_superseded"
    || !row.stripeVerificationSessionId
    || row.stripeStatus === "canceled"
  ) return;
  try {
    const current = await stripe.identity.verificationSessions.retrieve(
      row.stripeVerificationSessionId,
    );
    if (
      !stripeIdentitySessionBindingMatches(row, current)
      || !expectedModeMatches(provider, current)
      || current.status !== "requires_input"
    ) return;
    const canceled = await stripe.identity.verificationSessions.cancel(current.id);
    if (
      !stripeIdentitySessionBindingMatches(row, canceled)
      || !expectedModeMatches(provider, canceled)
      || canceled.status !== "canceled"
    ) return;
    await getDb().update(providerIdentityVerificationSessions).set({
      stripeStatus: "canceled",
      updatedAt: new Date().toISOString(),
    }).where(and(
      eq(providerIdentityVerificationSessions.id, row.id),
      eq(providerIdentityVerificationSessions.decisionStatus, "closed"),
      eq(providerIdentityVerificationSessions.failureCode, "application_evidence_superseded"),
    ));
  } catch {
    // Local revocation is already authoritative. Vendor cancellation is only
    // a best-effort privacy cleanup and must not block the corrected attempt.
    console.error("Unable to cancel a superseded hosted identity session.");
  }
}

async function createAttempt(
  request: Request,
  account: NonNullable<Awaited<ReturnType<typeof signedInProvider>>>,
  personId: string,
  evidenceId: string,
  attempts: Array<typeof providerIdentityVerificationSessions.$inferSelect>,
) {
  const db = getDb();
  const recentAttempts = attempts.filter((attempt) => {
    const createdAt = Date.parse(attempt.createdAt);
    return Number.isFinite(createdAt) && createdAt >= Date.now() - ATTEMPT_WINDOW_MS;
  });
  if (recentAttempts.length >= MAX_ATTEMPTS_PER_DAY) {
    return json({
      error: "The daily identity-attempt limit was reached. Try again tomorrow or contact TUVELOZ for manual review.",
    }, { status: 429, headers: { "retry-after": "86400" } });
  }
  const latestCreated = Date.parse(attempts[0]?.createdAt ?? "");
  if (Number.isFinite(latestCreated) && Date.now() - latestCreated < ATTEMPT_COOLDOWN_MS) {
    return json({ error: "Wait one minute before another identity attempt." }, {
      status: 429,
      headers: { "retry-after": "60" },
    });
  }
  const now = new Date().toISOString();
  const attemptNumber = (attempts[0]?.attemptNumber ?? 0) + 1;
  const accountSessionHash = await identityClaimSessionHash(account.session.id);
  await db.insert(providerIdentityVerificationSessions).values({
    id: crypto.randomUUID(),
    providerId: account.provider.id,
    personId,
    applicationSubmissionEvidenceId: evidenceId,
    personNameSourceType: "application_evidence",
    personNameSourceId: evidenceId,
    accountSessionHash,
    certificationVersion: IDENTITY_VERIFICATION_CONSENT_VERSION,
    attemptNumber,
    stripeStatus: "creating",
    decisionStatus: "pending",
    consentedAt: now,
    createdAt: now,
    updatedAt: now,
  }).onConflictDoNothing();
  const [row] = await db.select().from(providerIdentityVerificationSessions).where(and(
    eq(providerIdentityVerificationSessions.providerId, account.provider.id),
    eq(providerIdentityVerificationSessions.personId, personId),
    eq(providerIdentityVerificationSessions.decisionStatus, "pending"),
  )).orderBy(desc(providerIdentityVerificationSessions.attemptNumber)).limit(1);
  if (!row) throw new Error("Identity-verification attempt could not be claimed.");
  if (row.stripeVerificationSessionId) {
    return retrieveAndHandleActive(
      account.provider,
      getStripeIdentityClient(),
      row,
      evidenceId,
    );
  }

  const stripe = getStripeIdentityClient();
  const created = await stripe.identity.verificationSessions.create({
    verification_flow: getStripeIdentityVerificationFlowId(),
    client_reference_id: row.id,
    provided_details: { email: account.provider.email },
    metadata: {
      tuveloz_provider_id: account.provider.id,
      tuveloz_person_id: personId,
      tuveloz_application_evidence_id: evidenceId,
      tuveloz_person_name_source_type: "application_evidence",
      tuveloz_person_name_source_id: evidenceId,
      tuveloz_binding_version: "3",
    },
    return_url: `${siteUrlFor(request)}/provider-onboarding?identity=returned`,
  }, { idempotencyKey: `tuveloz-identity-${row.id}` });
  if (!expectedModeMatches(account.provider, created)) {
    await db.update(providerIdentityVerificationSessions).set({
      decisionStatus: "blocked",
      failureCode: "stripe_mode_mismatch",
      updatedAt: new Date().toISOString(),
    }).where(and(
      eq(providerIdentityVerificationSessions.id, row.id),
      eq(providerIdentityVerificationSessions.decisionStatus, "pending"),
    ));
    return json({
      error: "Stripe Identity is configured in the wrong mode for this provider. No URL was released.",
    }, { status: 503 });
  }
  await db.update(providerIdentityVerificationSessions).set({
    stripeVerificationSessionId: created.id,
    stripeStatus: created.status,
    livemode: created.livemode ? 1 : 0,
    updatedAt: new Date().toISOString(),
  }).where(and(
    eq(providerIdentityVerificationSessions.id, row.id),
    eq(providerIdentityVerificationSessions.decisionStatus, "pending"),
    eq(providerIdentityVerificationSessions.stripeVerificationSessionId, ""),
  ));
  const [bound] = await db.select().from(providerIdentityVerificationSessions)
    .where(eq(providerIdentityVerificationSessions.id, row.id)).limit(1);
  if (!bound || !stripeIdentitySessionBindingMatches(bound, created)) {
    return json({
      error: "The new Stripe Identity session binding could not be verified. No URL was released.",
    }, { status: 409 });
  }
  if (created.status !== "requires_input" || !created.url) {
    return json({ status: created.status, complete: false }, { status: 202 });
  }
  return json({ status: "requires_input", complete: false, url: created.url });
}

export async function POST(request: Request) {
  if (!isStrictSameOriginWriteRequest(request)) {
    return json({ error: "This request must come from TUVELOZ." }, { status: 403 });
  }
  const account = await signedInProvider(request);
  if (!account) {
    return json({ error: "Sign in with the provider account used to apply." }, { status: 401 });
  }
  try {
    const body = await readLimitedJsonObject(request, REQUEST_LIMIT_BYTES);
    if (
      body.identityConsentAcknowledged !== true
      || body.adultVerificationAcknowledged !== true
      || body.samePersonCertificationAcknowledged !== true
    ) {
      return json({
        error: "Consent to Stripe's government-ID, selfie, biometric-comparison, adult-status, and same-person checks is required.",
      }, { status: 400 });
    }
    const db = getDb();
    const [profile] = await db.select().from(providerPathwayProfiles)
      .where(eq(providerPathwayProfiles.providerId, account.provider.id))
      .orderBy(desc(providerPathwayProfiles.pathwayVersion)).limit(1);
    const personId = profile?.providerPersonId ?? "";
    if (!personId || profile?.relationshipPath !== "independent_startup") {
      return json({
        error: "Automated Stripe Identity is limited to a signed-in independent owner-operator verifying themself. Employee and trainee identity requires a separate person-level invitation and consent flow.",
      }, { status: 409 });
    }
    const [[person], [evidence]] = await Promise.all([
      db.select().from(providerPersonnel).where(and(
        eq(providerPersonnel.providerId, account.provider.id),
        eq(providerPersonnel.personId, personId),
      )).orderBy(desc(providerPersonnel.rosterVersion)).limit(1),
      db.select({
        id: providerApplicationSubmissionEvidence.id,
        normalizedSnapshot: providerApplicationSubmissionEvidence.normalizedSnapshot,
      }).from(providerApplicationSubmissionEvidence)
        .where(eq(providerApplicationSubmissionEvidence.providerId, account.provider.id))
        .orderBy(
          desc(providerApplicationSubmissionEvidence.createdAt),
          desc(providerApplicationSubmissionEvidence.id),
        ).limit(1),
    ]);
    if (!person || !evidence) {
      return json({ error: "The provider-person application binding is incomplete." }, { status: 409 });
    }
    if (
      person.relationshipType !== "owner_operator"
      || !["pending", "active"].includes(person.status)
      || profile.sponsoringProviderId !== ""
      || !["", account.provider.id].includes(profile.registrationHolderId)
    ) {
      return json({
        error: "Identity verification is unavailable until the current owner-operator roster and independent-business binding are corrected.",
      }, { status: 409 });
    }
    const now = new Date();
    const identityProvider = person.identityVerificationProvider.trim().toLowerCase();
    const ageProvider = person.ageVerificationProvider.trim().toLowerCase();
    const usesAnyStripeIdentity = identityProvider === "stripe_identity"
      || ageProvider === "stripe_identity";
    const usesOnlyStripeIdentity = identityProvider === "stripe_identity"
      && ageProvider === "stripe_identity";
    const currentExternalVerification = Boolean(
      person.identityVerifiedAt
      && person.ageVerifiedAt
      && externalIdentityAgeVerificationIsCurrent(person, now),
    );
    if (currentExternalVerification && !usesAnyStripeIdentity) {
      return json({
        status: "verified",
        complete: true,
        method: "manual",
      });
    }

    if (!immutablePerformingPersonName(evidence.normalizedSnapshot)) {
      return json({
        error: "This older application does not contain an immutable performing-person name. Use TUVELOZ's assisted re-attestation/manual review before automated Stripe Identity.",
        status: "manual_re_attestation_required",
      }, { status: 409 });
    }

    if (externalIdentityAgeVerificationHasData(person) && !usesOnlyStripeIdentity) {
      if (!expiredConfiguredManualIdentityAgeVerificationCanBeReplaced(person, now)) {
        return json({
          error: "The existing external identity record is current, partial, mixed, malformed, or not from an approved configured provider. TUVELOZ owner review is required before any new ID or selfie is collected.",
          status: "manual_review_required",
        }, { status: 409 });
      }
      if (body.replaceExpiredManualVerificationAcknowledged !== true) {
        return json({
          error: "Confirm that the expired external verification may be replaced before continuing to Stripe.",
          status: "manual_replacement_consent_required",
        }, { status: 409 });
      }
      if (!stripeIdentityModeMatchesProvider(account.provider.isTestProvider)) {
        return json({
          error: account.provider.isTestProvider === "yes"
            ? "A test provider requires Stripe Identity test mode. The expired external record was not changed."
            : "Real provider identity verification requires a live restricted Stripe Identity key. The expired external record was not changed.",
        }, { status: 503 });
      }
      const transitionedAt = now.toISOString();
      const [transitioned] = await db.update(providerPersonnel).set({
        status: "pending",
        identityVerifiedAt: "",
        ageVerifiedAt: "",
        identityVerificationProvider: "",
        identityVerificationReference: "",
        identityVerificationCheckedAt: "",
        identityVerificationValidThrough: "",
        ageVerificationProvider: "",
        ageVerificationReference: "",
        ageVerificationCheckedAt: "",
        ageVerificationValidThrough: "",
        updatedAt: transitionedAt,
      }).where(and(
        eq(providerPersonnel.id, person.id),
        eq(providerPersonnel.providerId, person.providerId),
        eq(providerPersonnel.personId, person.personId),
        eq(providerPersonnel.rosterVersion, person.rosterVersion),
        eq(providerPersonnel.identityVerifiedAt, person.identityVerifiedAt),
        eq(providerPersonnel.ageVerifiedAt, person.ageVerifiedAt),
        eq(providerPersonnel.identityVerificationProvider, person.identityVerificationProvider),
        eq(providerPersonnel.identityVerificationReference, person.identityVerificationReference),
        eq(providerPersonnel.identityVerificationCheckedAt, person.identityVerificationCheckedAt),
        eq(providerPersonnel.identityVerificationValidThrough, person.identityVerificationValidThrough),
        eq(providerPersonnel.ageVerificationProvider, person.ageVerificationProvider),
        eq(providerPersonnel.ageVerificationReference, person.ageVerificationReference),
        eq(providerPersonnel.ageVerificationCheckedAt, person.ageVerificationCheckedAt),
        eq(providerPersonnel.ageVerificationValidThrough, person.ageVerificationValidThrough),
      )).returning({ id: providerPersonnel.id });
      if (!transitioned) {
        return json({
          error: "The external verification changed while this request was being reviewed. No new ID or selfie was collected; refresh and try again.",
          status: "manual_review_required",
        }, { status: 409 });
      }
      try {
        await recordProviderAuditEvent({
          providerId: account.provider.id,
          personId,
          eventType: "expired_manual_identity_replacement_authorized",
          entityType: "provider_personnel",
          entityId: person.id,
          actorType: "provider_account",
          actorId: account.session.email,
          outcome: "verification_revoked_pending_stripe_reverification",
          reasonCodes: ["manual_identity_and_age_terms_expired", "fresh_consent_recorded"],
          metadata: {
            priorIdentityProvider: identityProvider,
            priorAgeProvider: ageProvider,
            consentVersion: IDENTITY_VERIFICATION_CONSENT_VERSION,
          },
        });
      } catch {
        console.error("Unable to append the expired-manual-identity transition audit event.");
      }
      await expireOpenCheckoutSessionsForLaunchShutdown().catch(() => {
        console.error("Unable to confirm checkout cleanup after identity transition.");
      });
    }

    if (!stripeIdentityModeMatchesProvider(account.provider.isTestProvider)) {
      return json({
        error: account.provider.isTestProvider === "yes"
          ? "A test provider requires Stripe Identity test mode."
          : "Real provider identity verification requires a live restricted Stripe Identity key.",
      }, { status: 503 });
    }

    let attempts = await db.select().from(providerIdentityVerificationSessions).where(and(
      eq(providerIdentityVerificationSessions.providerId, account.provider.id),
      eq(providerIdentityVerificationSessions.personId, personId),
    )).orderBy(desc(providerIdentityVerificationSessions.attemptNumber));
    if (
      usesOnlyStripeIdentity
      && externalIdentityAgeVerificationHasData(person)
      && !attempts.some((row) => (
        stripePersonnelBindingMatchesApprovedAttempt(person, row, evidence.id)
      ))
    ) {
      return json({
        error: "The existing Stripe identity record does not exactly match a guarded approval for the current application. No new ID or selfie was collected; TUVELOZ owner review is required.",
        status: "manual_review_required",
      }, { status: 409 });
    }
    const stripe = getStripeIdentityClient();
    const supersededHostedAttempts = attempts.filter((row) => (
      row.applicationSubmissionEvidenceId !== evidence.id
      && row.decisionStatus === "closed"
      && row.failureCode === "application_evidence_superseded"
      && Boolean(row.stripeVerificationSessionId)
      && row.stripeStatus !== "canceled"
    ));
    for (const supersededHostedAttempt of supersededHostedAttempts) {
      await cancelSupersededHostedSession(
        account.provider,
        stripe,
        supersededHostedAttempt,
      );
    }
    const terminal = terminalResponse(attempts, evidence.id, person);
    if (terminal) return terminal;
    const active = attempts.find((row) => (
      row.decisionStatus === "pending"
    ));
    if (active) {
      const response = await retrieveAndHandleActive(
        account.provider,
        stripe,
        active,
        evidence.id,
      );
      if (response) return response;
      attempts = await db.select().from(providerIdentityVerificationSessions).where(and(
        eq(providerIdentityVerificationSessions.providerId, account.provider.id),
        eq(providerIdentityVerificationSessions.personId, personId),
      )).orderBy(desc(providerIdentityVerificationSessions.attemptNumber));
    }
    return createAttempt(request, account, personId, evidence.id, attempts);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) return json({ error: error.message }, { status: 413 });
    if (error instanceof InvalidJsonBodyError) return json({ error: error.message }, { status: 400 });
    const response = stripeErrorResponse(error, "Unable to start Stripe Identity verification.");
    response.headers.set("cache-control", NO_STORE_HEADERS["cache-control"]);
    return response;
  }
}
