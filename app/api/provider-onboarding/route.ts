import { desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import {
  agreementAcceptances,
  complianceReminders,
  dataRightsRequests,
  evidenceFileScans,
  providerAppeals,
  providerApplicationSubmissionEvidence,
  providerEvidenceSubmissions,
  providerIdentityVerificationSessions,
  providerPathwayProfiles,
  providerPersonnel,
} from "../../../db/schema";
import {
  getAccountSession,
  providerApplicationFor,
} from "../../../lib/account-auth";
import { recordProviderAuditEvent } from "../../../lib/provider-audit";
import {
  notifyProviderAppealReceived,
  notifyProviderPrivacyRequestReceived,
} from "../../../lib/provider-compliance-notifications";
import {
  PROVIDER_ACCEPTANCE_DOCUMENTS,
  providerAcceptanceDocumentIsReleasedForEligibility,
  providerAgreementEvidenceText,
  sha256Text,
} from "../../../lib/provider-policy-acceptance";
import {
  isProviderPathway,
  isServiceCode,
  POLICY_JURISDICTION,
  POLICY_STATUS,
  POLICY_VERSION,
  PROVIDER_LEVEL_LABELS,
  PROVIDER_PATHWAY_LABELS,
  SERVICE_POLICY_CATALOG,
} from "../../../lib/provider-policy";
import { getRequiredDocuments } from "../../../lib/service-tiers";
import { immutablePerformingPersonName } from "../../../lib/identity-verification-policy";
import { isSameOriginRequest } from "../../../lib/request-security";
import { parseProviderServices } from "../../../lib/service-matching";
import { stripeIdentityModeMatchesProvider } from "../../../lib/stripe";
import {
  expiredConfiguredManualIdentityAgeVerificationCanBeReplaced,
  externalIdentityAgeVerificationHasData,
  externalIdentityAgeVerificationIsCurrent,
} from "../../../lib/provider-verification-evidence";

const STRUCTURED_ONLY_REQUIREMENTS = new Set([
  "performing_person_service_eligibility_snapshot",
  "qualified_supervisor_assignment",
  "direct_supervision_checkpoint_record",
  "sponsored_personnel_roster",
  "sponsored_employment_attestation",
  "provider_personnel_roster",
  "provider_employee_record",
]);

const APPEALABLE_EVIDENCE_STATUSES = new Set(["needs_correction", "rejected"]);
const OPEN_REQUEST_STATUSES = new Set([
  "submitted",
  "identity_verification",
  "in_review",
  // Keep the former names fail-closed for records created by an older build.
  "under_review",
  "awaiting_identity_verification",
]);
const DATA_RIGHTS_REQUEST_TYPES = new Set([
  "access",
  "correction",
  "portability",
  "deletion",
]);
const DAY_MS = 24 * 60 * 60 * 1000;

function identityApprovalValidThrough(checkedAt: string) {
  const parsed = Date.parse(checkedAt);
  return Number.isFinite(parsed)
    ? new Date(parsed + (365 * DAY_MS)).toISOString().slice(0, 10)
    : "";
}

function clean(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function requestIp(request: Request) {
  return clean(
    request.headers.get("cf-connecting-ip")
      || request.headers.get("x-forwarded-for")?.split(",")[0]
      || "",
    128,
  );
}

function parseStringArray(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function addDays(value: Date, days: number) {
  return new Date(value.getTime() + days * DAY_MS).toISOString();
}

function expirationDetails(expiresAt: string) {
  if (!expiresAt) {
    return {
      expirationStatus: "not_applicable" as const,
      expirationLabel: "No expiration date is recorded",
      daysUntilExpiration: null,
    };
  }
  const expirationEnd = Date.parse(`${expiresAt}T23:59:59.999Z`);
  const daysUntilExpiration = Math.max(0, Math.ceil((expirationEnd - Date.now()) / DAY_MS));
  if (!Number.isFinite(expirationEnd) || expirationEnd < Date.now()) {
    return {
      expirationStatus: "expired" as const,
      expirationLabel: `Expired on ${expiresAt}; the dependent service stays blocked`,
      daysUntilExpiration: 0,
    };
  }
  if (daysUntilExpiration <= 60) {
    return {
      expirationStatus: "expiring_soon" as const,
      expirationLabel: `Expires on ${expiresAt} (${daysUntilExpiration} day${daysUntilExpiration === 1 ? "" : "s"} remaining)`,
      daysUntilExpiration,
    };
  }
  return {
    expirationStatus: "current" as const,
    expirationLabel: `Expires on ${expiresAt}`,
    daysUntilExpiration,
  };
}

function scanDetails(status: string | undefined, updatedAt: string | undefined) {
  if (status === "clean") {
    return {
      scanStatus: status,
      scanLabel: "Clean — private download allowed",
      scanUpdatedAt: updatedAt ?? "",
      downloadAllowed: true,
    };
  }
  const labels: Record<string, string> = {
    pending: "Pending — quarantined and blocked",
    scanning: "Scanning — quarantined and blocked",
    infected: "Threat detected — blocked",
    failed: "Scan failed — blocked pending a new clean result",
    error: "Scan error — blocked pending a new clean result",
  };
  return {
    scanStatus: status || "missing",
    scanLabel: labels[status || ""] || "No clean scan result — quarantined and blocked",
    scanUpdatedAt: updatedAt ?? "",
    downloadAllowed: false,
  };
}

function reminderDetails(
  expiresAt: string,
  reminders: Array<{ status: string; dueAt: string; sentAt: string }>,
) {
  if (!expiresAt) {
    return { reminderStatus: "not_applicable", reminderLabel: "No expiration reminder is needed" };
  }
  const scheduled = reminders
    .filter((item) => item.status === "scheduled")
    .sort((left, right) => left.dueAt.localeCompare(right.dueAt));
  if (scheduled[0]) {
    return {
      reminderStatus: "scheduled",
      reminderLabel: `Next email reminder scheduled for ${scheduled[0].dueAt.slice(0, 10)}`,
    };
  }
  const sent = reminders
    .filter((item) => item.status === "sent" && item.sentAt)
    .sort((left, right) => right.sentAt.localeCompare(left.sentAt));
  if (sent[0]) {
    return {
      reminderStatus: "sent",
      reminderLabel: `Last expiration reminder sent ${sent[0].sentAt}`,
    };
  }
  return {
    reminderStatus: "not_scheduled",
    reminderLabel: "No expiration reminder is currently scheduled",
  };
}

async function onboardingAccount(request: Request) {
  const session = await getAccountSession(request);
  if (!session || session.role !== "provider") return null;
  const provider = await providerApplicationFor(session.email);
  return provider ? { session, provider } : null;
}

async function responseData(
  account: NonNullable<Awaited<ReturnType<typeof onboardingAccount>>>,
) {
  const db = getDb();
  const [
    profiles,
    personnel,
    evidence,
    acceptances,
    appeals,
    rightsRequests,
    fileScans,
    reminders,
    identityAttempts,
    applicationEvidence,
  ] = await Promise.all([
    db.select().from(providerPathwayProfiles)
      .where(eq(providerPathwayProfiles.providerId, account.provider.id))
      .orderBy(desc(providerPathwayProfiles.pathwayVersion)),
    db.select().from(providerPersonnel)
      .where(eq(providerPersonnel.providerId, account.provider.id))
      .orderBy(desc(providerPersonnel.rosterVersion)),
    db.select({
      id: providerEvidenceSubmissions.id,
      personId: providerEvidenceSubmissions.personId,
      requirementKey: providerEvidenceSubmissions.requirementKey,
      serviceCode: providerEvidenceSubmissions.serviceCode,
      jurisdiction: providerEvidenceSubmissions.jurisdiction,
      evidenceType: providerEvidenceSubmissions.evidenceType,
      contentType: providerEvidenceSubmissions.contentType,
      issuer: providerEvidenceSubmissions.issuer,
      effectiveAt: providerEvidenceSubmissions.effectiveAt,
      expiresAt: providerEvidenceSubmissions.expiresAt,
      status: providerEvidenceSubmissions.status,
      submittedAt: providerEvidenceSubmissions.submittedAt,
      reviewedAt: providerEvidenceSubmissions.reviewedAt,
      reasonCodes: providerEvidenceSubmissions.reasonCodes,
      reviewNotes: providerEvidenceSubmissions.reviewNotes,
      supersedesEvidenceId: providerEvidenceSubmissions.supersedesEvidenceId,
    }).from(providerEvidenceSubmissions)
      .where(eq(providerEvidenceSubmissions.providerId, account.provider.id))
      .orderBy(desc(providerEvidenceSubmissions.submittedAt)),
    db.select({
      agreementKey: agreementAcceptances.agreementKey,
      agreementVersion: agreementAcceptances.agreementVersion,
      agreementHash: agreementAcceptances.agreementHash,
      agreementText: agreementAcceptances.agreementText,
      acceptedAt: agreementAcceptances.acceptedAt,
      acceptedByName: agreementAcceptances.acceptedByName,
      acceptedByTitle: agreementAcceptances.acceptedByTitle,
    }).from(agreementAcceptances)
      .where(eq(agreementAcceptances.providerId, account.provider.id)),
    db.select({
      id: providerAppeals.id,
      evidenceSubmissionId: providerAppeals.evidenceSubmissionId,
      serviceCode: providerAppeals.serviceCode,
      appealType: providerAppeals.appealType,
      reason: providerAppeals.reason,
      status: providerAppeals.status,
      submittedAt: providerAppeals.submittedAt,
      dueAt: providerAppeals.dueAt,
      reviewedAt: providerAppeals.reviewedAt,
      decision: providerAppeals.decision,
      decisionReason: providerAppeals.decisionReason,
      resolutionNotes: providerAppeals.resolutionNotes,
    }).from(providerAppeals)
      .where(eq(providerAppeals.providerId, account.provider.id))
      .orderBy(desc(providerAppeals.submittedAt)),
    db.select({
      id: dataRightsRequests.id,
      requestType: dataRightsRequests.requestType,
      scope: dataRightsRequests.scope,
      identityVerificationStatus: dataRightsRequests.identityVerificationStatus,
      status: dataRightsRequests.status,
      receivedAt: dataRightsRequests.receivedAt,
      dueAt: dataRightsRequests.dueAt,
      legalHold: dataRightsRequests.legalHold,
      resolvedAt: dataRightsRequests.resolvedAt,
      responseSummary: dataRightsRequests.responseSummary,
      deletionCompletedAt: dataRightsRequests.deletionCompletedAt,
    }).from(dataRightsRequests)
      .where(eq(dataRightsRequests.providerId, account.provider.id))
      .orderBy(desc(dataRightsRequests.receivedAt)),
    db.select({
      evidenceSubmissionId: evidenceFileScans.evidenceSubmissionId,
      status: evidenceFileScans.status,
      requestedAt: evidenceFileScans.requestedAt,
      completedAt: evidenceFileScans.completedAt,
      updatedAt: evidenceFileScans.updatedAt,
    }).from(evidenceFileScans)
      .where(eq(evidenceFileScans.providerId, account.provider.id))
      .orderBy(desc(evidenceFileScans.requestedAt)),
    db.select({
      evidenceSubmissionId: complianceReminders.evidenceSubmissionId,
      status: complianceReminders.status,
      dueAt: complianceReminders.dueAt,
      sentAt: complianceReminders.sentAt,
    }).from(complianceReminders)
      .where(eq(complianceReminders.providerId, account.provider.id))
      .orderBy(complianceReminders.dueAt),
    db.select().from(providerIdentityVerificationSessions)
      .where(eq(providerIdentityVerificationSessions.providerId, account.provider.id))
      .orderBy(desc(providerIdentityVerificationSessions.attemptNumber)),
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
  const profile = profiles[0] ?? null;
  const pathway = profile && isProviderPathway(profile.relationshipPath)
    ? profile.relationshipPath
    : null;
  const personId = profile?.providerPersonId ?? personnel[0]?.personId ?? "";
  const applicant = personnel.find((item) => item.personId === personId) ?? null;
  const latestApplicationEvidence = applicationEvidence[0] ?? null;
  const currentIdentityAttempts = identityAttempts.filter((item) => (
    item.personId === personId
    && item.applicationSubmissionEvidenceId === latestApplicationEvidence?.id
  ));
  const latestIdentityAttempt = currentIdentityAttempts[0] ?? null;
  const approvedIdentityAttempt = applicant
    ? currentIdentityAttempts.find((item) => (
      item.decisionStatus === "approved"
      && item.stripeStatus === "verified"
      && Boolean(item.stripeVerificationSessionId)
      && Boolean(item.stripeVerificationReportId)
      && Boolean(item.lastStripeEventId)
      && item.checkedAt === item.verifiedAt
      && applicant.identityVerificationProvider === "stripe_identity"
      && applicant.ageVerificationProvider === "stripe_identity"
      && applicant.identityVerificationReference === item.stripeVerificationSessionId
      && applicant.ageVerificationReference === item.stripeVerificationSessionId
      && applicant.identityVerifiedAt === item.checkedAt
      && applicant.ageVerifiedAt === item.checkedAt
      && applicant.identityVerificationCheckedAt === item.checkedAt
      && applicant.ageVerificationCheckedAt === item.checkedAt
      && applicant.identityVerificationValidThrough
        === identityApprovalValidThrough(item.checkedAt)
      && applicant.ageVerificationValidThrough
        === identityApprovalValidThrough(item.checkedAt)
    )) ?? null
    : null;
  const stripeIdentityVerified = Boolean(
    approvedIdentityAttempt
    && applicant
    && externalIdentityAgeVerificationIsCurrent(applicant, new Date()),
  );
  const currentExternalIdentityVerified = Boolean(
    applicant
    && applicant.identityVerifiedAt
    && applicant.ageVerifiedAt
    && externalIdentityAgeVerificationIsCurrent(applicant, new Date()),
  );
  const manualIdentityVerified = Boolean(
    currentExternalIdentityVerified
    && applicant?.identityVerificationProvider.trim().toLowerCase() !== "stripe_identity"
    && applicant?.ageVerificationProvider.trim().toLowerCase() !== "stripe_identity",
  );
  const identityVerified = stripeIdentityVerified || manualIdentityVerified;
  const expiredManualVerificationRequiresReplacement = Boolean(
    applicant
    && externalIdentityAgeVerificationHasData(applicant)
    && expiredConfiguredManualIdentityAgeVerificationCanBeReplaced(applicant, new Date()),
  );
  const conflictingExternalVerificationRequiresReview = Boolean(
    applicant
    && externalIdentityAgeVerificationHasData(applicant)
    && !identityVerified
    && !expiredManualVerificationRequiresReplacement
    && !(
      applicant.identityVerificationProvider.trim().toLowerCase() === "stripe_identity"
      && applicant.ageVerificationProvider.trim().toLowerCase() === "stripe_identity"
      && approvedIdentityAttempt
    ),
  );
  const identityStatus = identityVerified
    ? "verified"
    : expiredManualVerificationRequiresReplacement
      ? "expired"
      : conflictingExternalVerificationRequiresReview
        ? "manual_review_required"
    : latestIdentityAttempt
      && latestIdentityAttempt.id !== approvedIdentityAttempt?.id
      ? latestIdentityAttempt.decisionStatus === "blocked"
        ? "blocked"
        : latestIdentityAttempt.decisionStatus === "closed"
          ? "closed"
          : latestIdentityAttempt.stripeStatus
      : approvedIdentityAttempt
        ? "expired"
      : latestIdentityAttempt?.decisionStatus === "blocked"
      ? "blocked"
      : latestIdentityAttempt?.decisionStatus === "closed"
        ? "closed"
        : latestIdentityAttempt?.stripeStatus || "not_started";
  const identityOwnerOperatorEligible = profile?.relationshipPath === "independent_startup";
  const identityManualReattestationRequired = Boolean(
    latestApplicationEvidence
    && !immutablePerformingPersonName(latestApplicationEvidence.normalizedSnapshot),
  );
  const recentIdentityAttempts = identityAttempts.filter((item) => (
    item.personId === personId
    && Date.parse(item.createdAt) >= Date.now() - DAY_MS
  ));
  const selectedServices = parseProviderServices(account.provider.service)
    .filter(isServiceCode)
    .filter((serviceCode) => serviceCode !== "general_auto_repair");
  const decoratedEvidence = evidence.map((item) => {
    const scan = fileScans.find((entry) => entry.evidenceSubmissionId === item.id);
    const evidenceReminders = reminders.filter((entry) => entry.evidenceSubmissionId === item.id);
    return {
      ...item,
      ...scanDetails(scan?.status, scan?.completedAt || scan?.updatedAt || scan?.requestedAt),
      ...expirationDetails(item.expiresAt),
      ...reminderDetails(item.expiresAt, evidenceReminders),
    };
  });

  const serviceStatuses = selectedServices.map((serviceCode) => {
    const service = SERVICE_POLICY_CATALOG[serviceCode];
    const requiredDocuments = pathway ? getRequiredDocuments(serviceCode, pathway) : [];
    const requirementRows = requiredDocuments.map((doc) => {
      const submissions = decoratedEvidence.filter((item) => (
        item.requirementKey === doc.code
        && (!item.serviceCode || item.serviceCode === serviceCode)
      ));
      const submission = submissions[0] ?? null;
      const status = !submission
        ? "missing"
        : submission.expirationStatus === "expired"
          ? "expired"
          : submission.scanStatus !== "clean"
            ? "under_review"
            : submission.status === "accepted"
              ? "accepted"
              : submission.status === "needs_correction"
                ? "needs_correction"
                : submission.status === "rejected"
                  ? "rejected"
                  : "under_review";
      return {
        code: doc.code,
        label: doc.label,
        requiresExpiration: doc.requiresExpiration === true,
        private: doc.private,
        uploadAllowed: !STRUCTURED_ONLY_REQUIREMENTS.has(doc.code),
        status,
        submission,
      };
    });
    return {
      code: serviceCode,
      label: service.label,
      description: service.description,
      selectedForReview: true,
      launchState: service.launchState,
      status: profile?.providerLevel === "learning_account"
        ? "learning_only"
        : "service_unavailable",
      canTakeJobs: false,
      statusLabel: profile?.providerLevel === "learning_account"
        ? "✕ Applicant only — no training, employment, or customer jobs"
        : "✕ Not available for customer jobs",
      reason: "Every service remains blocked until all evidence is accepted and TUVELOZ records satisfaction of mandatory legal, government, insurance, tax, payment, security, and exact-service requirements.",
      requirements: requirementRows,
    };
  });

  const agreementStatuses = await Promise.all(PROVIDER_ACCEPTANCE_DOCUMENTS.map(async (document) => {
    const acceptance = acceptances.find((item) => (
      item.agreementKey === document.key
      && item.agreementVersion === document.version
    ));
    const releasedForEligibility = providerAcceptanceDocumentIsReleasedForEligibility(document);
    const expectedEligibilityText = releasedForEligibility
      ? providerAgreementEvidenceText(document, { purpose: "provider_eligibility" })
      : "";
    const expectedEligibilityHash = expectedEligibilityText
      ? await sha256Text(expectedEligibilityText)
      : "";
    const eligibilityCurrent = Boolean(
      acceptance
      && releasedForEligibility
      && acceptance.agreementText === expectedEligibilityText
      && acceptance.agreementHash === expectedEligibilityHash,
    );
    return {
      key: document.key,
      title: document.title,
      href: document.href,
      requiredVersion: document.version,
      releaseStatus: document.releaseStatus,
      releaseId: document.releaseId,
      effectiveAt: document.effectiveAt,
      canonicalBodyHash: document.canonicalBodyHash,
      acceptedForApplicationReview: Boolean(acceptance),
      eligibilityCurrent,
      current: eligibilityCurrent,
      acceptedAt: acceptance?.acceptedAt ?? "",
      acceptedByName: acceptance?.acceptedByName ?? "",
      acceptedByTitle: acceptance?.acceptedByTitle ?? "",
    };
  }));

  return {
    policy: {
      version: POLICY_VERSION,
      status: POLICY_STATUS,
      jurisdiction: POLICY_JURISDICTION,
      marketplaceMode: "onboarding_only",
      notice: "Provider applications and evidence review are open. Current policy acknowledgments are application-review records only while any document is draft, inactive, not yet effective, or missing its released-content hash. They cannot qualify a provider for jobs. Real customer jobs, checkout, completion, and payout remain disabled.",
    },
    provider: {
      id: account.provider.id,
      name: account.provider.name,
      email: account.provider.email,
      applicationStatus: account.provider.status,
      verificationStatus: account.provider.verificationStatus,
      requestedServices: selectedServices,
    },
    pathway: profile ? {
      code: profile.relationshipPath,
      label: pathway
        ? PROVIDER_PATHWAY_LABELS[pathway]
        : "Applicant-only account",
      providerLevel: profile.providerLevel,
      providerLevelLabel: PROVIDER_LEVEL_LABELS[
        profile.providerLevel as keyof typeof PROVIDER_LEVEL_LABELS
      ] ?? profile.providerLevel,
      status: profile.status,
      holdReasonCodes: parseStringArray(profile.holdReasonCodes),
      personId,
    } : null,
    personnel: personnel.map((item) => ({
      personId: item.personId,
      relationshipType: item.relationshipType,
      role: item.personnelRole,
      providerLevel: item.providerLevel,
      status: item.status,
      identityVerified: Boolean(item.identityVerifiedAt),
      ageVerified: Boolean(item.ageVerifiedAt),
      employerConfirmed: Boolean(item.employerAttestedAt),
      workAuthorizationResponsibilityConfirmed: Boolean(item.workAuthorizationAttestedAt),
      lawfulPayConfirmed: Boolean(item.lawfulPayAttestedAt),
    })),
    identityVerification: {
      status: identityStatus,
      failureCode: latestIdentityAttempt?.failureCode ?? "",
      attemptsUsed: recentIdentityAttempts.length,
      attemptsRemaining: Math.max(0, 3 - recentIdentityAttempts.length),
      ownerOperatorEligible: identityOwnerOperatorEligible,
      manualReattestationRequired: identityManualReattestationRequired,
      method: manualIdentityVerified ? "manual" : stripeIdentityVerified ? "stripe" : "",
      expiredManualVerificationRequiresReplacement,
      conflictingExternalVerificationRequiresReview,
      configuredForThisProvider: stripeIdentityModeMatchesProvider(
        account.provider.isTestProvider,
      ),
      canStart: identityOwnerOperatorEligible
        && Boolean(latestApplicationEvidence)
        && !identityManualReattestationRequired
        && !conflictingExternalVerificationRequiresReview
        && stripeIdentityModeMatchesProvider(account.provider.isTestProvider)
        && !identityVerified
        && recentIdentityAttempts.length < 3
        && latestIdentityAttempt?.decisionStatus !== "blocked",
      complete: identityVerified,
    },
    services: serviceStatuses,
    evidence: decoratedEvidence,
    appeals: appeals.map((item) => ({
      id: item.id,
      evidenceId: item.evidenceSubmissionId,
      serviceCode: item.serviceCode,
      requestType: item.appealType,
      status: item.status,
      statement: item.reason,
      submittedAt: item.submittedAt,
      dueAt: item.dueAt,
      reviewedAt: item.reviewedAt,
      decision: item.decision,
      decisionReason: item.decisionReason,
      resolvedAt: item.reviewedAt,
      resolutionNotes: item.resolutionNotes,
    })),
    dataRightsRequests: rightsRequests.map((item) => ({
      id: item.id,
      requestType: item.requestType,
      scope: item.scope,
      identityVerificationStatus: item.identityVerificationStatus,
      status: item.status,
      submittedAt: item.receivedAt,
      dueAt: item.dueAt,
      legalHold: item.legalHold,
      completedAt: item.deletionCompletedAt || item.resolvedAt,
      responseNotes: item.responseSummary,
    })),
    privacy: {
      storage: "Provider documents are stored in restricted private storage. Every new file is quarantined and unavailable for download or evidence acceptance until a malware scan reports clean.",
      access: "Only the signed-in provider and specifically authorized TUVELOZ reviewers may access a clean private document. Access is logged. Documents and internal review notes never appear on a public provider page.",
      retention: "TUVELOZ keeps provider documents only while needed for application review, current compliance, security and fraud prevention, disputes, or legal obligations. Replaced and rejected documents remain restricted audit records only while one of those purposes continues; they do not create job eligibility.",
      deletion: "You may request access, correction, portability, or deletion below. TUVELOZ verifies identity before acting and deletes or de-identifies eligible data when it is no longer required. A limited audit record may remain when required for security, fraud prevention, a dispute, law, or an active legal hold.",
      prohibitedUploads: "Do not upload an SSN, Social Security card, passport, I-9, bank record, tax ID, or work-authorization document. A separate employer or payment-processor workflow must keep those records.",
    },
    agreements: agreementStatuses,
    allAgreementsCurrent: agreementStatuses.every((item) => item.current),
    allAgreementsAcknowledgedForApplicationReview: agreementStatuses.every((item) => (
      item.acceptedForApplicationReview
    )),
    allAgreementsEligibilityCurrent: agreementStatuses.every((item) => item.eligibilityCurrent),
    // Read as a to-do list by someone who has just signed in for the first
    // time, so every line has to be something they can still act on. The old
    // first step told them to choose a pathway; signup stopped offering that
    // choice and now always creates an independent owner-operator, so it asked
    // for an action with nowhere to perform it. Selecting services happens
    // during the application rather than here, so it is stated as done.
    guide: [
      "You applied as an independent owner-operator working under your own business. Nothing to choose here.",
      "Your exact services came from your application; a broad general-mechanic category is never accepted.",
      "Verify your identity and adult status above before evidence review can finish.",
      "Upload only the evidence requested for each exact service. Every file stays quarantined until its malware scan reports clean.",
      "TUVELOZ reviews each clean item; an upload or appeal alone does not create eligibility.",
      "Accept every current provider agreement with the authorized signer name and title.",
      "A checkmark appears only after the exact service, person, location, date, evidence, and supervision rules pass.",
      "Keep evidence current and follow the displayed reminder schedule. Expiration before a scheduled job blocks that job.",
    ],
  };
}

export async function GET(request: Request) {
  const account = await onboardingAccount(request);
  if (!account) {
    return Response.json(
      { error: "Sign in with the provider email used on your application." },
      { status: 401, headers: { "cache-control": "no-store" } },
    );
  }
  return Response.json(await responseData(account), {
    headers: { "cache-control": "no-store" },
  });
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "This update must come from TUVELOZ." }, { status: 403 });
  }
  const account = await onboardingAccount(request);
  if (!account) {
    return Response.json({ error: "Sign in with your provider account." }, { status: 401 });
  }
  try {
    const body = await request.json() as Record<string, unknown>;
    const action = clean(body.action, 80);
    const db = getDb();

    if (action === "submit-evidence-appeal") {
      const evidenceId = clean(body.evidenceId, 120);
      const statement = clean(body.statement, 2000);
      if (!evidenceId || statement.length < 20) {
        return Response.json({
          error: "Choose the reviewed evidence and explain the appeal in at least 20 characters.",
        }, { status: 400 });
      }
      const evidenceRows = await db.select({
        id: providerEvidenceSubmissions.id,
        providerId: providerEvidenceSubmissions.providerId,
        personId: providerEvidenceSubmissions.personId,
        serviceCode: providerEvidenceSubmissions.serviceCode,
        jurisdiction: providerEvidenceSubmissions.jurisdiction,
        status: providerEvidenceSubmissions.status,
        reviewDecisionId: providerEvidenceSubmissions.reviewDecisionId,
      }).from(providerEvidenceSubmissions)
        .where(eq(providerEvidenceSubmissions.id, evidenceId)).limit(1);
      const evidence = evidenceRows[0];
      if (!evidence || evidence.providerId !== account.provider.id) {
        return Response.json({ error: "Evidence review not found." }, { status: 404 });
      }
      if (!APPEALABLE_EVIDENCE_STATUSES.has(evidence.status) || !evidence.reviewDecisionId) {
        return Response.json({
          error: "An appeal is available only after evidence receives a correction or rejection decision.",
        }, { status: 409 });
      }
      const previousAppeals = await db.select({
        status: providerAppeals.status,
      }).from(providerAppeals)
        .where(eq(providerAppeals.evidenceSubmissionId, evidence.id));
      if (previousAppeals.some((item) => OPEN_REQUEST_STATUSES.has(item.status))) {
        return Response.json({
          error: "An appeal for this evidence is already pending.",
        }, { status: 409 });
      }
      const now = new Date();
      const appealId = crypto.randomUUID();
      await db.insert(providerAppeals).values({
        id: appealId,
        providerId: account.provider.id,
        evidenceSubmissionId: evidence.id,
        serviceCode: evidence.serviceCode,
        appealType: "evidence_review",
        reason: statement,
        supportingEvidenceIds: "[]",
        status: "submitted",
        submittedByEmail: account.session.email,
        submittedAt: now.toISOString(),
        dueAt: addDays(now, 15),
        reviewedBy: "",
        reviewedAt: "",
        decision: "",
        decisionReason: "",
        resolutionNotes: "",
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      });
      await recordProviderAuditEvent({
        providerId: account.provider.id,
        personId: evidence.personId,
        serviceCode: evidence.serviceCode,
        jurisdiction: evidence.jurisdiction,
        eventType: "provider_evidence_appeal_submitted",
        entityType: "provider_appeal",
        entityId: appealId,
        actorType: "provider",
        actorId: account.session.email,
        outcome: "submitted_service_remains_blocked",
        reasonCodes: [evidence.status],
        metadata: { evidenceId: evidence.id, reviewDecisionId: evidence.reviewDecisionId },
      });
      await notifyProviderAppealReceived({
        appealId,
        email: account.provider.email,
      });
      return Response.json({
        ok: true,
        message: "Appeal submitted. It will be reviewed by someone other than the original reviewer where practical; the service remains blocked meanwhile.",
        ...(await responseData(account)),
      });
    }

    if (action === "submit-data-rights-request") {
      const requestType = clean(body.requestType, 40);
      const details = clean(body.details, 2000);
      if (
        !DATA_RIGHTS_REQUEST_TYPES.has(requestType)
        || details.length < 10
        || body.identityVerificationAcknowledged !== true
      ) {
        return Response.json({
          error: "Choose a privacy request, add details, and acknowledge identity verification and lawful retention limits.",
        }, { status: 400 });
      }
      const existingRequests = await db.select({
        requestType: dataRightsRequests.requestType,
        status: dataRightsRequests.status,
      }).from(dataRightsRequests)
        .where(eq(dataRightsRequests.providerId, account.provider.id));
      if (existingRequests.some((item) => (
        item.requestType === requestType && OPEN_REQUEST_STATUSES.has(item.status)
      ))) {
        return Response.json({
          error: `A ${requestType} request is already pending for this provider account.`,
        }, { status: 409 });
      }
      const now = new Date();
      const rightsRequestId = crypto.randomUUID();
      await db.insert(dataRightsRequests).values({
        id: rightsRequestId,
        requesterEmail: account.session.email,
        requesterRole: "provider",
        providerId: account.provider.id,
        requestType,
        scope: "provider_account_and_restricted_documents",
        details,
        identityVerificationStatus: "account_session_verified",
        status: "submitted",
        receivedAt: now.toISOString(),
        dueAt: addDays(now, 30),
        legalHold: "no",
        resolvedAt: "",
        resolvedBy: "",
        responseSummary: "",
        deletionCompletedAt: "",
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      });
      await recordProviderAuditEvent({
        providerId: account.provider.id,
        jurisdiction: POLICY_JURISDICTION,
        eventType: "provider_data_rights_request_submitted",
        entityType: "data_rights_request",
        entityId: rightsRequestId,
        actorType: "provider",
        actorId: account.session.email,
        outcome: "submitted",
        reasonCodes: [requestType],
        metadata: { scope: "provider_account_and_restricted_documents" },
      });
      await notifyProviderPrivacyRequestReceived({
        requestId: rightsRequestId,
        email: account.provider.email,
      });
      return Response.json({
        ok: true,
        message: "Privacy request submitted. TUVELOZ will verify scope, apply any lawful retention or legal-hold limits, and record the response here.",
        ...(await responseData(account)),
      });
    }

    if (action !== "accept-current-agreements") {
      return Response.json({ error: "Choose a supported onboarding action." }, { status: 400 });
    }
    const signerName = clean(body.signerName, 120);
    const signerTitle = clean(body.signerTitle, 100);
    if (
      !signerName
      || !signerTitle
      || body.termsBundleAccepted !== true
      || body.privacyAcknowledged !== true
    ) {
      return Response.json({
        error: "Enter the authorized signer and complete both required acceptance controls.",
      }, { status: 400 });
    }
    const existing = await db.select().from(agreementAcceptances)
      .where(eq(agreementAcceptances.providerId, account.provider.id));
    const profileRows = await db.select().from(providerPathwayProfiles)
      .where(eq(providerPathwayProfiles.providerId, account.provider.id))
      .orderBy(desc(providerPathwayProfiles.pathwayVersion)).limit(1);
    const personId = profileRows[0]?.providerPersonId ?? "";
    const now = new Date().toISOString();
    const acceptanceSessionId = crypto.randomUUID();
    const deviceContext = JSON.stringify({
      userAgent: clean(request.headers.get("user-agent"), 600),
      language: clean(request.headers.get("accept-language"), 200),
      policyStatus: POLICY_STATUS,
      acceptancePurpose: "application_review_only_unless_released_for_eligibility",
    });
    const inserted: string[] = [];
    for (const document of PROVIDER_ACCEPTANCE_DOCUMENTS) {
      if (existing.some((item) => (
        item.agreementKey === document.key
        && item.agreementVersion === document.version
      ))) continue;
      const agreementText = providerAgreementEvidenceText(document, {
        purpose: "provider_eligibility",
        acceptanceEvidenceId: acceptanceSessionId,
        asOf: new Date(now),
      });
      await db.insert(agreementAcceptances).values({
        id: crypto.randomUUID(),
        providerId: account.provider.id,
        personId,
        jurisdiction: POLICY_JURISDICTION,
        agreementKey: document.key,
        agreementVersion: document.version,
        agreementHash: await sha256Text(agreementText),
        agreementText,
        acceptedByName: signerName,
        acceptedByTitle: signerTitle,
        acceptanceAction: document.control === "privacy-acknowledgment"
          ? "affirmative-separate-privacy-checkbox"
          : "affirmative-provider-terms-bundle-checkbox",
        acceptedAt: now,
        ipAddress: requestIp(request),
        sessionId: acceptanceSessionId,
        deviceContext,
        createdAt: now,
      });
      inserted.push(document.key);
    }
    await recordProviderAuditEvent({
      providerId: account.provider.id,
      personId,
      jurisdiction: POLICY_JURISDICTION,
      eventType: "provider_agreements_accepted",
      entityType: "agreement_acceptance_bundle",
      entityId: acceptanceSessionId,
      actorType: "provider_signer",
      actorId: account.session.email,
      outcome: inserted.length ? "accepted" : "already_current",
      metadata: { inserted, signerName, signerTitle },
    });
    return Response.json({ ok: true, ...(await responseData(account)) });
  } catch (error) {
    console.error("Unable to update provider onboarding", error);
    return Response.json({ error: "Unable to save this onboarding update." }, { status: 500 });
  }
}
