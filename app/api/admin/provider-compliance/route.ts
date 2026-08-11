import { and, desc, eq, gt, inArray } from "drizzle-orm";
import { getDb } from "../../../../db";
import {
  agreementAcceptances,
  evidenceFileScans,
  providerApplications,
  providerEvidenceSubmissions,
  providerPathwayProfiles,
  providerPersonnel,
  providerServiceEligibility,
  serviceActivationDecisions,
} from "../../../../db/schema";
import { verifyOwnerRequest } from "../../../../lib/owner-auth";
import { MARKETPLACE_MODE } from "../../../../lib/launch-status";
import {
  annualComplianceReviewWindowIsValid,
  hasCompleteMandatoryLegalComplianceEvidence,
  LEGAL_PROFESSIONAL_REVIEW_STATUSES,
  mandatoryLegalComplianceEvidenceFromContext,
  normalizeOfficialSourceReferences,
  requiredOfficialLegalSourceReferences,
} from "../../../../lib/legal-compliance-evidence";
import { recordProviderAuditEvent } from "../../../../lib/provider-audit";
import { shouldAssignFoundingRank } from "../../../../lib/founding-cohort";
import {
  notifyProviderEvidenceDecision,
  notifyProviderEvidenceScanBlocked,
} from "../../../../lib/provider-compliance-notifications";
import { getProviderEvidence } from "../../../../lib/provider-evidence";
import {
  prescreenEvidence,
  type EvidencePrescreen,
} from "../../../../lib/evidence-review-assistant";
import {
  boundLegalBusinessIdentityReview,
  evidenceScopeWithLegalBusinessIdentity,
  evidenceScopeWithoutLegalBusinessIdentity,
  isBusinessIdentityEvidenceRequirement,
} from "../../../../lib/provider-legal-identity";
import { ELIGIBILITY_RULES_VERSION } from "../../../../lib/provider-eligibility-engine";
import { PLATFORM_SERVICE_ACTIVATION_RULES_VERSION } from "../../../../lib/platform-service-activation";
import {
  PROVIDER_ACCEPTANCE_DOCUMENTS,
  providerAgreementEvidenceText,
  sha256Text,
} from "../../../../lib/provider-policy-acceptance";
import {
  EVIDENCE_AUTHENTICITY_METHODS,
  evidenceAuthenticityIsCurrent,
  externalIdentityAgeVerificationIsCurrent,
  type EvidenceAuthenticityMethod,
} from "../../../../lib/provider-verification-evidence";
import {
  getEvidenceRequirements,
  isPathwayLevelCompatible,
  isProviderLevel,
  isProviderPathway,
  isServiceCode,
  POLICY_JURISDICTION,
  POLICY_STATUS,
  POLICY_VERSION,
  providerLevelForService,
  PROVIDER_LEVEL_CODES,
  providerLevelsForServices,
  PROVIDER_LEVELS,
  PROVIDER_PATHWAYS,
  PROVIDER_POLICY_MATRIX,
  SERVICE_POLICY_CATALOG,
  SERVICES,
  type EvidenceRequirementCode,
  type ProviderPathway,
  type ServiceCode,
} from "../../../../lib/provider-policy";
import { isSameOriginRequest } from "../../../../lib/request-security";
import { runtimeProviderActivationPrerequisitesDecision } from "../../../../lib/runtime-launch-readiness";
import { expireOpenCheckoutSessionsForLaunchShutdown } from "../../../../lib/stripe-payments";
import {
  parseProviderServices,
  serializeProviderServices,
} from "../../../../lib/service-matching";

const PLATFORM_PROVIDER_ID = "__tuveloz_platform__";
const RULES_ENGINE_VERSION = ELIGIBILITY_RULES_VERSION;
const CONFIGURATION_STAGE = "configuration";

const EVIDENCE_REVIEW_STATUSES = [
  "accepted",
  "rejected",
  "needs_correction",
] as const;

const EVIDENCE_REASON_CODES = [
  "owner_evidence_accepted",
  "unreadable_or_incomplete",
  "expired_or_invalid_date",
  "name_or_scope_mismatch",
  "issuer_or_authority_unverified",
  "coverage_or_limit_mismatch",
  "wrong_document_type",
  "other_documented_issue",
] as const;

const PERSON_BOUND_REQUIREMENTS = new Set<EvidenceRequirementCode>([
  "md_locksmith_technician_registration",
  "mva_inspection_mechanic_license",
  "epa_section_609_certificate",
  "provisional_service_competency",
  "sponsored_personnel_roster",
  "sponsored_employment_attestation",
  "provider_personnel_roster",
  "provider_employee_record",
]);

const JOB_SCOPED_REQUIREMENTS = new Set<EvidenceRequirementCode>([
  "performing_person_service_eligibility_snapshot",
  "qualified_supervisor_assignment",
  "direct_supervision_checkpoint_record",
]);

const STRUCTURED_EMPLOYMENT_REQUIREMENTS = new Set<EvidenceRequirementCode>([
  "sponsored_personnel_roster",
  "sponsored_employment_attestation",
  "provider_personnel_roster",
  "provider_employee_record",
]);

type EvidenceReviewStatus = (typeof EVIDENCE_REVIEW_STATUSES)[number];
type EvidenceReasonCode = (typeof EVIDENCE_REASON_CODES)[number];
type EvidenceRow = typeof providerEvidenceSubmissions.$inferSelect;
type ProviderRow = typeof providerApplications.$inferSelect;
type ProfileRow = typeof providerPathwayProfiles.$inferSelect;
type PersonnelRow = typeof providerPersonnel.$inferSelect;
type ActivationRow = typeof serviceActivationDecisions.$inferSelect;
type AgreementRow = typeof agreementAcceptances.$inferSelect;
type EligibilityRow = typeof providerServiceEligibility.$inferSelect;
type ScanRow = typeof evidenceFileScans.$inferSelect;

function clean(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function parseJsonObject(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

function safeJsonArray(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(timestamp)
    && new Date(timestamp).toISOString().slice(0, 10) === value;
}

function dateTime(value: string, endOfDay = true) {
  if (!value) return Number.NaN;
  const normalized = value.includes("T")
    ? value
    : `${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`;
  return Date.parse(normalized);
}

function currentThrough(value: string, through = Date.now()) {
  const timestamp = dateTime(value);
  return Number.isFinite(timestamp) && timestamp >= through;
}

function effectiveNow(value: string, now = Date.now()) {
  if (!value) return true;
  const timestamp = dateTime(value, false);
  return Number.isFinite(timestamp) && timestamp <= now;
}

function annualVerificationWindowIsValid(checkedAt: string, validThrough: string) {
  if (!validDate(checkedAt) || !validDate(validThrough)) return false;
  const checked = dateTime(checkedAt, false);
  const through = dateTime(validThrough);
  const maximum = new Date(checked);
  maximum.setUTCFullYear(maximum.getUTCFullYear() + 1);
  maximum.setUTCHours(23, 59, 59, 999);
  return checked <= Date.now()
    && through >= Date.now()
    && through <= maximum.getTime();
}

function earliestDate(values: readonly string[]) {
  return values
    .filter(Boolean)
    .map((value) => ({ value, timestamp: dateTime(value) }))
    .filter((item) => Number.isFinite(item.timestamp))
    .sort((left, right) => left.timestamp - right.timestamp)[0]?.value ?? "";
}

function relationshipType(pathway: ProviderPathway) {
  if (pathway === "independent_startup") return "owner_operator";
  if (pathway === "sponsored_trainee_employee") return "trainee";
  return "employee";
}

function latestProfiles(rows: readonly ProfileRow[]) {
  const byProvider = new Map<string, ProfileRow>();
  for (const row of rows) {
    const current = byProvider.get(row.providerId);
    if (!current || row.pathwayVersion > current.pathwayVersion) byProvider.set(row.providerId, row);
  }
  return byProvider;
}

function latestPersonnel(rows: readonly PersonnelRow[]) {
  const byProviderPerson = new Map<string, PersonnelRow>();
  for (const row of rows) {
    const key = `${row.providerId}:${row.personId}`;
    const current = byProviderPerson.get(key);
    if (!current || row.rosterVersion > current.rosterVersion) byProviderPerson.set(key, row);
  }
  return [...byProviderPerson.values()];
}

function activationKey(serviceCode: string, jurisdiction: string) {
  return `${serviceCode}:${jurisdiction}`;
}

function latestActivations(rows: readonly ActivationRow[]) {
  const byService = new Map<string, ActivationRow>();
  for (const row of rows) {
    const key = activationKey(row.serviceCode, row.jurisdiction);
    const current = byService.get(key);
    if (!current || row.decisionVersion > current.decisionVersion) byService.set(key, row);
  }
  return byService;
}

function activationHasRequiredEvidence(row: ActivationRow | undefined) {
  if (!row) return false;
  const context = parseJsonObject(row.jobContext);
  const insurerApprovedAt = clean(context.insurerApprovedAt, 10);
  const insurerValidThrough = clean(context.insurerValidThrough, 10);
  const activationValidThrough = dateTime(row.validThrough);
  return Boolean(
    hasCompleteMandatoryLegalComplianceEvidence(context, {
      serviceCode: row.serviceCode,
      jurisdiction: row.jurisdiction,
    }, activationValidThrough)
    && annualComplianceReviewWindowIsValid(
      insurerApprovedAt,
      insurerValidThrough,
      activationValidThrough,
    )
    && clean(context.insurerApprovedBy, 180)
    && clean(context.insurerReference, 300),
  );
}

function activationIsLive(row: ActivationRow | undefined, through = Date.now()) {
  return Boolean(
    row
    && row.decision === "enabled_live"
    && row.policyVersion === POLICY_VERSION
    && row.rulesEngineVersion === PLATFORM_SERVICE_ACTIVATION_RULES_VERSION
    && currentThrough(row.validThrough, through)
    && activationHasRequiredEvidence(row),
  );
}

async function currentAgreements(rows: readonly AgreementRow[]) {
  return Promise.all(PROVIDER_ACCEPTANCE_DOCUMENTS.map(async (document) => {
    const expectedText = providerAgreementEvidenceText(document);
    const expectedHash = expectedText ? await sha256Text(expectedText) : "";
    const acceptance = rows.find((row) => (
      row.agreementKey === document.key
      && row.agreementVersion === document.version
      && Boolean(row.acceptedAt)
      && row.agreementText === expectedText
      && row.agreementHash === expectedHash
    ));
    return {
      key: document.key,
      title: document.title,
      href: document.href,
      requiredVersion: document.version,
      current: Boolean(acceptance),
      acceptedAt: acceptance?.acceptedAt ?? "",
      acceptedByName: acceptance?.acceptedByName ?? "",
      acceptedByTitle: acceptance?.acceptedByTitle ?? "",
    };
  }));
}

function latestScanMap(rows: readonly ScanRow[]) {
  const scans = new Map<string, ScanRow>();
  for (const row of [...rows].sort(
    (left, right) => dateTime(right.requestedAt) - dateTime(left.requestedAt),
  )) {
    if (!scans.has(row.evidenceSubmissionId)) scans.set(row.evidenceSubmissionId, row);
  }
  return scans;
}

function safeEvidence(row: EvidenceRow, scan?: ScanRow) {
  const legalIdentity = boundLegalBusinessIdentityReview(row);
  return {
    id: row.id,
    providerId: row.providerId,
    personId: row.personId,
    requirementKey: row.requirementKey,
    serviceCode: row.serviceCode,
    jurisdiction: row.jurisdiction,
    evidenceType: row.evidenceType,
    contentType: row.contentType,
    issuer: row.issuer,
    effectiveAt: row.effectiveAt,
    expiresAt: row.expiresAt,
    status: row.status,
    submittedAt: row.submittedAt,
    reviewedAt: row.reviewedAt,
    reviewedBy: row.reviewedBy,
    reviewDecisionId: row.reviewDecisionId,
    reasonCodes: safeJsonArray(row.reasonCodes),
    reviewNotes: row.reviewNotes,
    businessIdentitySourceEligible:
      isBusinessIdentityEvidenceRequirement(row.requirementKey),
    verifiedLegalBusinessName: legalIdentity?.legalBusinessName ?? "",
    authenticityVerificationMethod: row.authenticityVerificationMethod,
    authenticityVerifiedBy: row.authenticityVerifiedBy,
    authenticityVerificationReference: row.authenticityVerificationReference,
    authenticitySourceUrl: row.authenticitySourceUrl,
    authenticityVerifiedAt: row.authenticityVerifiedAt,
    authenticityValidThrough: row.authenticityValidThrough,
    supersedesEvidenceId: row.supersedesEvidenceId,
    hasPrivateFile: Boolean(row.storageKey),
    scanStatus: row.storageKey ? scan?.status ?? "missing" : "not_required",
    scanProvider: row.storageKey ? scan?.scanProvider ?? "" : "",
    scanEngineVersion: row.storageKey ? scan?.scanEngineVersion ?? "" : "",
    scanCompletedAt: row.storageKey ? scan?.completedAt ?? "" : "",
    scanReviewedBy: row.storageKey ? scan?.reviewedBy ?? "" : "",
  };
}

// Mirrors the exact-service, pathway, person, and jurisdiction checks the
// acceptance path enforces, so the pre-screen never suggests accepting a
// submission the real review would reject.
function evidenceMatchesCurrentApplication(
  row: EvidenceRow,
  provider: ProviderRow,
  profile: ProfileRow | undefined,
): boolean {
  if (!profile || !isProviderPathway(profile.relationshipPath)) return false;
  if (row.jurisdiction !== POLICY_JURISDICTION) return false;
  if (!isServiceCode(row.serviceCode) || row.serviceCode === "general_auto_repair") return false;
  if (!parseProviderServices(provider.service).includes(row.serviceCode)) return false;
  if (!(row.requirementKey in PROVIDER_POLICY_MATRIX.evidence_types)) return false;
  const requirementKey = row.requirementKey as EvidenceRequirementCode;
  if (!getEvidenceRequirements(row.serviceCode, profile.relationshipPath).includes(requirementKey)) {
    return false;
  }
  if (PERSON_BOUND_REQUIREMENTS.has(requirementKey) && row.personId !== profile.providerPersonId) {
    return false;
  }
  return true;
}

function prescreenForEvidence(
  row: EvidenceRow,
  scan: ScanRow | undefined,
  provider: ProviderRow,
  profile: ProfileRow | undefined,
): EvidencePrescreen {
  const definition = row.requirementKey in PROVIDER_POLICY_MATRIX.evidence_types
    ? PROVIDER_POLICY_MATRIX.evidence_types[row.requirementKey as EvidenceRequirementCode]
    : undefined;
  return prescreenEvidence({
    submissionStatus: row.status,
    matchesCurrentApplication: evidenceMatchesCurrentApplication(row, provider, profile),
    requiresExpiration: definition?.requires_expiration === true,
    hasExpirationDate: Boolean(row.expiresAt),
    isExpired: Boolean(row.expiresAt) && !currentThrough(row.expiresAt),
    hasPrivateFile: Boolean(row.storageKey),
    scanStatus: row.storageKey ? scan?.status ?? "missing" : "not_required",
  });
}

function evidenceMatches(
  row: EvidenceRow,
  requirementKey: EvidenceRequirementCode,
  serviceCode: ServiceCode,
  personId: string,
) {
  return row.requirementKey === requirementKey
    && (!row.serviceCode || row.serviceCode === serviceCode)
    && (!PERSON_BOUND_REQUIREMENTS.has(requirementKey) || row.personId === personId);
}

function acceptedEvidenceIsCurrent(
  row: EvidenceRow,
  requirementKey: EvidenceRequirementCode,
  scans: ReadonlyMap<string, ScanRow>,
) {
  const requirement = PROVIDER_POLICY_MATRIX.evidence_types[requirementKey];
  if (row.status !== "accepted" || !effectiveNow(row.effectiveAt)) return false;
  if (row.storageKey && scans.get(row.id)?.status !== "clean") return false;
  if (!evidenceAuthenticityIsCurrent(row, new Date())) return false;
  if (requirement.requires_expiration === true) return currentThrough(row.expiresAt);
  return !row.expiresAt || currentThrough(row.expiresAt);
}

function requirementReview(
  evidence: readonly EvidenceRow[],
  requirementKey: EvidenceRequirementCode,
  serviceCode: ServiceCode,
  personId: string,
  scans: ReadonlyMap<string, ScanRow>,
) {
  const definition = PROVIDER_POLICY_MATRIX.evidence_types[requirementKey];
  if (JOB_SCOPED_REQUIREMENTS.has(requirementKey)) {
    return {
      code: requirementKey,
      label: definition.label,
      status: "required_per_job" as const,
      baseEligibilityBlocking: false,
      submission: null,
    };
  }
  const matches = evidence
    .filter((row) => evidenceMatches(row, requirementKey, serviceCode, personId))
    .sort((left, right) => dateTime(right.reviewedAt || right.submittedAt) - dateTime(left.reviewedAt || left.submittedAt));
  const accepted = matches.find((row) => acceptedEvidenceIsCurrent(row, requirementKey, scans));
  const pending = matches.find((row) => row.status === "pending");
  const correction = matches.find((row) => row.status === "needs_correction");
  const expired = matches.find((row) => row.status === "accepted");
  const rejected = matches.find((row) => row.status === "rejected");
  const selected = accepted ?? pending ?? correction ?? expired ?? rejected ?? null;
  const status = accepted
    ? "accepted"
    : pending
      ? "pending"
      : correction
        ? "needs_correction"
        : expired
          ? "expired"
          : rejected
            ? "rejected"
            : "missing";
  return {
    code: requirementKey,
    label: definition.label,
    status,
    baseEligibilityBlocking: true,
    submission: selected ? safeEvidence(selected, scans.get(selected.id)) : null,
  };
}

function employeeAttestationsComplete(person: PersonnelRow | undefined) {
  return Boolean(
    person?.employmentStartedAt
    && effectiveNow(person.employmentStartedAt)
    && (!person.employmentEndedAt || currentThrough(person.employmentEndedAt))
    && person.employerAttestedAt
    && person.workAuthorizationAttestedAt
    && person.lawfulPayAttestedAt
    && person.employerAttestedByPersonId,
  );
}

function evaluateService(input: {
  provider: typeof providerApplications.$inferSelect;
  profile: ProfileRow | undefined;
  person: PersonnelRow | undefined;
  serviceCode: ServiceCode;
  evidence: readonly EvidenceRow[];
  scans: ReadonlyMap<string, ScanRow>;
  agreements: ReturnType<typeof currentAgreements>;
  activation: ActivationRow | undefined;
  sponsorProvider?: typeof providerApplications.$inferSelect;
  sponsorEligibility?: EligibilityRow;
}) {
  const {
    provider,
    profile,
    person,
    serviceCode,
    evidence,
    scans,
    agreements,
    activation,
    sponsorProvider,
    sponsorEligibility,
  } = input;
  const reasons: string[] = [];
  const pathway = profile && isProviderPathway(profile.relationshipPath)
    ? profile.relationshipPath
    : null;
  // The level belongs to this exact service, so a provider may be approved for
  // services at several levels at once. The profile level stays a summary and
  // only still blocks applicant-only accounts.
  const serviceLevel = pathway
    ? providerLevelForService(serviceCode, pathway)
    : null;
  const profileLevel = profile && isProviderLevel(profile.providerLevel)
    ? profile.providerLevel
    : null;
  const providerLevel = serviceLevel ?? profileLevel;
  const service = SERVICE_POLICY_CATALOG[serviceCode];

  if (provider.status === "declined") reasons.push("application_declined");
  if (provider.isTestProvider === "yes") reasons.push("test_provider_not_live");
  if (!profile || profile.policyVersion !== POLICY_VERSION) reasons.push("current_pathway_missing");
  if (!pathway) reasons.push("recognized_pathway_missing");
  if (
    !providerLevel
    || providerLevel === "learning_account"
    || profileLevel === "learning_account"
  ) {
    reasons.push("job_eligible_provider_level_missing");
  }
  if (service.launchState !== "enabled" || !service.customerVisible) {
    reasons.push("service_not_enabled_by_policy_catalog");
  }
  if (pathway && providerLevel && !isPathwayLevelCompatible(pathway, providerLevel)) {
    reasons.push("pathway_level_incompatible");
  }
  if (pathway && !service.allowedPathways.includes(pathway)) reasons.push("pathway_not_allowed_for_service");
  // Denies only services that no level on this pathway may perform, rather than
  // denying a lawful service because the provider's other work sits elsewhere.
  if (pathway && !serviceLevel) {
    reasons.push("provider_level_not_allowed_for_service");
  }
  if (
    serviceLevel
    && !PROVIDER_POLICY_MATRIX.provider_levels[serviceLevel].allowed_service_codes.includes(serviceCode)
  ) {
    reasons.push("service_not_allowed_for_provider_level");
  }
  if (!PROVIDER_POLICY_MATRIX.services[serviceCode].jurisdictions.includes(POLICY_JURISDICTION)) {
    reasons.push("jurisdiction_not_allowed");
  }
  if (!person || person.status !== "active") reasons.push("performing_person_not_active");
  if (!person?.identityVerifiedAt || !person.ageVerifiedAt) reasons.push("identity_or_adult_review_missing");
  if (person && !externalIdentityAgeVerificationIsCurrent(person, new Date())) {
    reasons.push("external_identity_or_adult_verification_not_current");
  }
  if (pathway === "independent_startup") {
    if (person?.relationshipType !== "owner_operator") reasons.push("owner_operator_binding_missing");
    if (profile?.providerPersonId !== person?.personId) reasons.push("owner_operator_person_mismatch");
  }
  if (pathway === "sponsored_trainee_employee" || pathway === "provider_business_employee") {
    reasons.push("provider_of_record_assignment_not_implemented");
    const expectedRelationship = pathway === "sponsored_trainee_employee" ? "trainee" : "employee";
    if (person?.relationshipType !== expectedRelationship) reasons.push("employee_relationship_missing");
    if (!profile?.sponsoringProviderId || profile.registrationHolderId !== profile.sponsoringProviderId) {
      reasons.push("sponsoring_provider_binding_missing");
    }
    if (profile?.sponsoringProviderId === provider.id) {
      reasons.push("sponsoring_provider_self_reference");
    }
    if (
      !sponsorProvider
      || sponsorProvider.status !== "approved"
      || sponsorProvider.verificationStatus !== "verified"
      || sponsorProvider.isTestProvider === "yes"
    ) {
      reasons.push("sponsoring_provider_not_active");
    }
    if (
      !sponsorEligibility
      || sponsorEligibility.eligibilityState !== "eligible"
      || sponsorEligibility.policyVersion !== POLICY_VERSION
      || sponsorEligibility.serviceCode !== serviceCode
      || sponsorEligibility.jurisdiction !== POLICY_JURISDICTION
      || !currentThrough(sponsorEligibility.validThrough)
      || !parseProviderServices(sponsorProvider?.approvedServices ?? "").includes(serviceCode)
    ) {
      reasons.push("sponsoring_provider_not_eligible_for_exact_service");
    }
    if (!employeeAttestationsComplete(person)) reasons.push("employer_attestation_missing");
  }
  if (!agreements.every((agreement) => agreement.current)) reasons.push("current_agreements_missing");

  const requirements = pathway ? getEvidenceRequirements(serviceCode, pathway) : [];
  const requirementStatuses = requirements.map((requirementKey) => (
    requirementReview(
      evidence,
      requirementKey,
      serviceCode,
      profile?.providerPersonId ?? "",
      scans,
    )
  ));
  for (const requirement of requirementStatuses) {
    if (requirement.baseEligibilityBlocking && requirement.status !== "accepted") {
      reasons.push(`evidence_${requirement.status}:${requirement.code}`);
    }
  }
  if (!activationIsLive(activation)) {
    reasons.push(!activation ? "platform_service_activation_missing" : "platform_service_activation_not_current");
  }

  const acceptedEvidence = requirements
    .filter((requirement) => !JOB_SCOPED_REQUIREMENTS.has(requirement))
    .map((requirement) => evidence.find((row) => (
      evidenceMatches(row, requirement, serviceCode, profile?.providerPersonId ?? "")
      && acceptedEvidenceIsCurrent(row, requirement, scans)
    )))
    .filter((row): row is EvidenceRow => Boolean(row));
  const validThrough = earliestDate([
    activation?.validThrough ?? "",
    ...acceptedEvidence.map((row) => row.expiresAt),
    ...acceptedEvidence.map((row) => row.authenticityValidThrough),
    person?.identityVerificationValidThrough ?? "",
    person?.ageVerificationValidThrough ?? "",
  ]);
  const uniqueReasons = [...new Set(reasons)];
  return {
    code: serviceCode,
    label: service.label,
    // The level this exact service is approved at, stored on its own
    // eligibility row so one provider can hold several levels at once.
    providerLevel: serviceLevel,
    status: uniqueReasons.length === 0 ? "eligible" as const : "blocked" as const,
    reasons: uniqueReasons,
    requirements: requirementStatuses,
    activation: activation ? {
      id: activation.id,
      decision: activation.decision,
      decisionVersion: activation.decisionVersion,
      validThrough: activation.validThrough,
      activationEvidenceComplete: activationHasRequiredEvidence(activation),
      live: activationIsLive(activation),
    } : null,
    evidenceDecisionIds: acceptedEvidence.map((row) => row.reviewDecisionId || row.id),
    validThrough,
  };
}

async function recalculateProvider(providerId: string, actorId: string) {
  const db = getDb();
  const [
    providerRows,
    profiles,
    personnelRows,
    evidence,
    scanRows,
    acceptanceRows,
    activationRows,
  ] = await Promise.all([
    db.select().from(providerApplications).where(eq(providerApplications.id, providerId)).limit(1),
    db.select().from(providerPathwayProfiles)
      .where(eq(providerPathwayProfiles.providerId, providerId))
      .orderBy(desc(providerPathwayProfiles.pathwayVersion)),
    db.select().from(providerPersonnel).where(eq(providerPersonnel.providerId, providerId)),
    db.select().from(providerEvidenceSubmissions)
      .where(eq(providerEvidenceSubmissions.providerId, providerId)),
    db.select().from(evidenceFileScans)
      .where(eq(evidenceFileScans.providerId, providerId)),
    db.select().from(agreementAcceptances).where(eq(agreementAcceptances.providerId, providerId)),
    db.select().from(serviceActivationDecisions).where(and(
      eq(serviceActivationDecisions.providerId, PLATFORM_PROVIDER_ID),
      eq(serviceActivationDecisions.stage, CONFIGURATION_STAGE),
    )),
  ]);
  const provider = providerRows[0];
  const profile = profiles[0];
  if (!provider || !profile) return null;
  const people = latestPersonnel(personnelRows);
  const person = people.find((row) => row.personId === profile.providerPersonId);
  let sponsorProvider: typeof providerApplications.$inferSelect | undefined;
  let sponsorEligibilityRows: EligibilityRow[] = [];
  if (profile.sponsoringProviderId) {
    [sponsorProvider] = await db.select().from(providerApplications)
      .where(eq(providerApplications.id, profile.sponsoringProviderId)).limit(1);
    sponsorEligibilityRows = await db.select().from(providerServiceEligibility)
      .where(eq(providerServiceEligibility.providerId, profile.sponsoringProviderId));
  }
  const agreements = await currentAgreements(acceptanceRows);
  const scans = latestScanMap(scanRows);
  const activations = latestActivations(activationRows);
  const serviceCodes = parseProviderServices(provider.service)
    .filter(isServiceCode)
    .filter((serviceCode) => serviceCode !== "general_auto_repair");
  const evaluations = serviceCodes.map((serviceCode) => evaluateService({
    provider,
    profile,
    person,
    serviceCode,
    evidence,
    scans,
    agreements,
    activation: activations.get(activationKey(serviceCode, POLICY_JURISDICTION)),
    sponsorProvider,
    sponsorEligibility: sponsorEligibilityRows.find((row) => (
      row.serviceCode === serviceCode
      && row.jurisdiction === POLICY_JURISDICTION
    )),
  }));
  const now = new Date().toISOString();
  for (const evaluation of evaluations) {
    const existing = await db.select().from(providerServiceEligibility).where(and(
      eq(providerServiceEligibility.providerId, provider.id),
      eq(providerServiceEligibility.personId, profile.providerPersonId),
      eq(providerServiceEligibility.serviceCode, evaluation.code),
      eq(providerServiceEligibility.jurisdiction, POLICY_JURISDICTION),
    )).limit(1);
    const values = {
      relationshipPath: profile.relationshipPath,
      providerLevel: evaluation.providerLevel ?? profile.providerLevel,
      eligibilityState: evaluation.status,
      reasonCodes: JSON.stringify(evaluation.reasons),
      requirementVersions: JSON.stringify({
        policyVersion: POLICY_VERSION,
        pathwayVersion: profile.pathwayVersion,
        agreementVersions: Object.fromEntries(
          agreements.filter((item) => item.current).map((item) => [item.key, item.requiredVersion]),
        ),
        activationDecisionVersion: evaluation.activation?.decisionVersion ?? 0,
      }),
      evidenceDecisionIds: JSON.stringify(evaluation.evidenceDecisionIds),
      rulesEngineVersion: RULES_ENGINE_VERSION,
      policyVersion: POLICY_VERSION,
      calculatedAt: now,
      validThrough: evaluation.validThrough,
      nextExpirationAt: evaluation.validThrough,
      updatedAt: now,
    };
    if (existing[0]) {
      await db.update(providerServiceEligibility).set(values)
        .where(eq(providerServiceEligibility.id, existing[0].id));
    } else {
      await db.insert(providerServiceEligibility).values({
        id: crypto.randomUUID(),
        providerId: provider.id,
        personId: profile.providerPersonId,
        serviceCode: evaluation.code,
        jurisdiction: POLICY_JURISDICTION,
        ...values,
        createdAt: now,
      });
    }
  }
  const eligibleServices = evaluations
    .filter((evaluation) => evaluation.status === "eligible")
    .map((evaluation) => evaluation.code);
  const canAutoVerify = eligibleServices.length > 0
    && provider.status !== "declined"
    && provider.isTestProvider !== "yes";
  const wasVerified = provider.status === "approved" && provider.verificationStatus === "verified";
  // Founding cohort standing is claimed the first time a provider verifies,
  // and never recomputed afterwards — rank is by acceptance, so a provider who
  // applied first but cleared review third is third. Losing verification later
  // does not free the slot: 20 is a cohort, not a queue with vacancies.
  let foundingRank = provider.foundingRank;
  let foundingRankAssignedAt = provider.foundingRankAssignedAt;
  if (canAutoVerify && !wasVerified && provider.foundingRank === 0) {
    const claimed = await db.select({ rank: providerApplications.foundingRank })
      .from(providerApplications)
      .where(gt(providerApplications.foundingRank, 0));
    if (shouldAssignFoundingRank({
      currentRank: provider.foundingRank,
      assignedCount: claimed.length,
      isTestProvider: provider.isTestProvider === "yes",
    })) {
      // Max rather than count, so a manually corrected record can never cause
      // two providers to be handed the same rank.
      foundingRank = claimed.reduce((highest, row) => Math.max(highest, row.rank), 0) + 1;
      foundingRankAssignedAt = now;
    }
  }
  const statusPayload = Object.fromEntries(evaluations.map((evaluation) => [evaluation.code, {
    status: evaluation.status,
    reasons: evaluation.reasons,
    calculatedAt: now,
    validThrough: evaluation.validThrough,
  }]));
  await db.update(providerApplications).set({
    approvedServices: serializeProviderServices(eligibleServices),
    serviceEligibilityStatuses: JSON.stringify(statusPayload),
    verificationStatus: provider.isTestProvider === "yes"
      ? provider.verificationStatus
      : canAutoVerify
        ? "verified"
        : "in review",
    status: provider.status === "declined" || provider.isTestProvider === "yes"
      ? provider.status
      : canAutoVerify
        ? "approved"
        : "new",
    verifiedAt: provider.isTestProvider === "yes"
      ? provider.verifiedAt
      : canAutoVerify
        ? provider.verifiedAt || now
        : "",
    verifiedBy: provider.isTestProvider === "yes"
      ? provider.verifiedBy
      : canAutoVerify
        ? `v0.11-rules:${actorId}`
        : "",
    alertsEnabled: canAutoVerify ? "yes" : "no",
    foundingRank,
    foundingRankAssignedAt,
  }).where(eq(providerApplications.id, provider.id));
  const holdReasons = canAutoVerify
    ? []
    : [...new Set(evaluations.flatMap((evaluation) => evaluation.reasons))];
  await db.update(providerPathwayProfiles).set({
    status: profile.providerLevel === "learning_account"
      ? "learning_only"
      : canAutoVerify
        ? "active"
        : "pending_review",
    holdReasonCodes: JSON.stringify(holdReasons),
    effectiveAt: canAutoVerify ? profile.effectiveAt || now : "",
    validThrough: canAutoVerify
      ? earliestDate(evaluations
          .filter((evaluation) => evaluation.status === "eligible")
          .map((evaluation) => evaluation.validThrough))
      : "",
    updatedAt: now,
  }).where(eq(providerPathwayProfiles.id, profile.id));
  if (wasVerified !== canAutoVerify) {
    await recordProviderAuditEvent({
      providerId: provider.id,
      personId: profile.providerPersonId,
      jurisdiction: POLICY_JURISDICTION,
      eventType: canAutoVerify ? "provider_auto_verified" : "provider_auto_suspended",
      entityType: "provider_application",
      entityId: provider.id,
      actorType: "v0.11_rules_engine",
      actorId,
      outcome: canAutoVerify ? "verified" : "pending",
      reasonCodes: canAutoVerify ? eligibleServices : holdReasons,
      metadata: { eligibleServices, rulesEngineVersion: RULES_ENGINE_VERSION },
    });
  }
  return { evaluations, eligibleServices, autoVerified: canAutoVerify };
}

async function recalculateProvidersForService(serviceCode: ServiceCode, actorId: string) {
  const providers = await getDb().select().from(providerApplications)
    .orderBy(desc(providerApplications.createdAt));
  const affected = providers.filter((provider) => (
    parseProviderServices(provider.service).includes(serviceCode)
  ));
  const results = [];
  for (const provider of affected) {
    const result = await recalculateProvider(provider.id, actorId);
    if (result) results.push({ providerId: provider.id, ...result });
  }
  return results;
}

async function complianceResponse() {
  const db = getDb();
  const [
    providers,
    profileRows,
    personnelRows,
    evidenceRows,
    scanRows,
    acceptanceRows,
    activationRows,
    eligibilityRows,
  ] = await Promise.all([
    db.select().from(providerApplications).orderBy(desc(providerApplications.createdAt)).limit(250),
    db.select().from(providerPathwayProfiles).orderBy(desc(providerPathwayProfiles.pathwayVersion)),
    db.select().from(providerPersonnel).orderBy(desc(providerPersonnel.rosterVersion)),
    db.select().from(providerEvidenceSubmissions).orderBy(desc(providerEvidenceSubmissions.submittedAt)),
    db.select().from(evidenceFileScans).orderBy(desc(evidenceFileScans.requestedAt)),
    db.select().from(agreementAcceptances).orderBy(desc(agreementAcceptances.acceptedAt)),
    db.select().from(serviceActivationDecisions).where(and(
      eq(serviceActivationDecisions.providerId, PLATFORM_PROVIDER_ID),
      eq(serviceActivationDecisions.stage, CONFIGURATION_STAGE),
    )).orderBy(desc(serviceActivationDecisions.decisionVersion)),
    db.select().from(providerServiceEligibility),
  ]);
  const profiles = latestProfiles(profileRows);
  const personnel = latestPersonnel(personnelRows);
  const scans = latestScanMap(scanRows);
  const activations = latestActivations(activationRows);
  const applications = await Promise.all(providers.map(async (provider) => {
    const profile = profiles.get(provider.id);
    const providerPeople = personnel.filter((person) => person.providerId === provider.id);
    const person = providerPeople.find((item) => item.personId === profile?.providerPersonId);
    const evidence = evidenceRows.filter((item) => item.providerId === provider.id);
    const agreements = await currentAgreements(
      acceptanceRows.filter((item) => item.providerId === provider.id),
    );
    const selectedServices = parseProviderServices(provider.service)
      .filter(isServiceCode)
      .filter((serviceCode) => serviceCode !== "general_auto_repair");
    const services = selectedServices.map((serviceCode) => evaluateService({
      provider,
      profile,
      person,
      serviceCode,
      evidence,
      scans,
      agreements,
      activation: activations.get(activationKey(serviceCode, POLICY_JURISDICTION)),
      sponsorProvider: profile?.sponsoringProviderId
        ? providers.find((item) => item.id === profile.sponsoringProviderId)
        : undefined,
      sponsorEligibility: profile?.sponsoringProviderId
        ? eligibilityRows.find((item) => (
            item.providerId === profile.sponsoringProviderId
            && item.serviceCode === serviceCode
            && item.jurisdiction === POLICY_JURISDICTION
          ))
        : undefined,
    }));
    return {
      id: provider.id,
      name: provider.name,
      email: provider.email,
      preferredLanguage: provider.preferredLanguage,
      legacyRequestedServices: provider.service,
      selectedServices,
      serviceArea: provider.serviceArea,
      businessMunicipality: provider.businessMunicipality,
      experience: provider.experience,
      applicationStatus: provider.status,
      verificationStatus: provider.verificationStatus,
      isTestProvider: provider.isTestProvider,
      serviceRulesVersion: provider.serviceRulesVersion,
      createdAt: provider.createdAt,
      profile: profile ? {
        id: profile.id,
        personId: profile.providerPersonId,
        pathway: profile.relationshipPath,
        providerLevel: profile.providerLevel,
        sponsorProviderId: profile.sponsoringProviderId,
        status: profile.status,
        policyVersion: profile.policyVersion,
        pathwayVersion: profile.pathwayVersion,
        holdReasonCodes: safeJsonArray(profile.holdReasonCodes),
        effectiveAt: profile.effectiveAt,
        validThrough: profile.validThrough,
      } : null,
      personnel: providerPeople.map((item) => ({
        personId: item.personId,
        relationshipType: item.relationshipType,
        personnelRole: item.personnelRole,
        providerLevel: item.providerLevel,
        status: item.status,
        identityVerifiedAt: item.identityVerifiedAt,
        ageVerifiedAt: item.ageVerifiedAt,
        identityVerificationProvider: item.identityVerificationProvider,
        identityVerificationReference: item.identityVerificationReference,
        identityVerificationCheckedAt: item.identityVerificationCheckedAt,
        identityVerificationValidThrough: item.identityVerificationValidThrough,
        ageVerificationProvider: item.ageVerificationProvider,
        ageVerificationReference: item.ageVerificationReference,
        ageVerificationCheckedAt: item.ageVerificationCheckedAt,
        ageVerificationValidThrough: item.ageVerificationValidThrough,
        employmentStartedAt: item.employmentStartedAt,
        employerAttestedAt: item.employerAttestedAt,
        workAuthorizationAttestedAt: item.workAuthorizationAttestedAt,
        lawfulPayAttestedAt: item.lawfulPayAttestedAt,
        employerAttestedByPersonId: item.employerAttestedByPersonId,
      })),
      agreements,
      allAgreementsCurrent: agreements.every((agreement) => agreement.current),
      evidence: evidence.map((item) => ({
        ...safeEvidence(item, scans.get(item.id)),
        prescreen: prescreenForEvidence(item, scans.get(item.id), provider, profile),
      })),
      services,
      eligibleServices: services
        .filter((service) => service.status === "eligible")
        .map((service) => service.code),
      canInitializeV011: !profile && providerPeople.length === 0,
    };
  }));

  const platformServices = SERVICES
    .filter((service) => service.code !== "general_auto_repair")
    .map((service) => {
      const activation = activations.get(activationKey(service.code, POLICY_JURISDICTION));
      const context = activation ? parseJsonObject(activation.jobContext) : {};
      const legalEvidence = mandatoryLegalComplianceEvidenceFromContext(context);
      return {
        code: service.code,
        label: service.label,
        launchState: service.launchState,
        decision: activation?.decision ?? "disabled_default",
        decisionVersion: activation?.decisionVersion ?? 0,
        validThrough: activation?.validThrough ?? "",
        decidedAt: activation?.decidedAt ?? "",
        decidedBy: activation?.decidedBy ?? "",
        live: activationIsLive(activation),
        activationEvidenceComplete: activationHasRequiredEvidence(activation),
        legalRequirementsServiceCode: legalEvidence.serviceCode,
        legalRequirementsJurisdiction: legalEvidence.jurisdiction,
        legalRequirementsReference: legalEvidence.reference,
        legalRequirementsValidThrough: legalEvidence.validThrough,
        officialSourceCount: legalEvidence.officialSourceReferences.length,
        legalProfessionalReviewStatus: legalEvidence.professionalReviewStatus,
        requiredOfficialSourceReferences: requiredOfficialLegalSourceReferences(
          service.code,
          POLICY_JURISDICTION,
        ),
        insurerReference: clean(context.insurerReference, 240),
        insurerValidThrough: clean(context.insurerValidThrough, 10),
      };
    });

  return {
    policy: {
      version: POLICY_VERSION,
      status: POLICY_STATUS,
      jurisdiction: POLICY_JURISDICTION,
      rulesEngineVersion: RULES_ENGINE_VERSION,
      defaultPolicy: "deny",
      marketplaceMode: MARKETPLACE_MODE,
      notice: "No provider receives blanket approval. A provider becomes active only when at least one exact service is eligible and that service has current official legal-compliance evidence and written insurer activation.",
    },
    catalog: {
      pathways: PROVIDER_PATHWAYS,
      levels: PROVIDER_LEVELS,
      services: SERVICES.filter((service) => service.code !== "general_auto_repair").map((service) => ({
        code: service.code,
        label: service.label,
        description: service.description,
        allowedPathways: service.allowedPathways,
        allowedProviderLevels: service.allowedProviderLevels,
        launchState: service.launchState,
      })),
    },
    platformServices,
    applications,
  };
}

const PRIVATE_EVIDENCE_CONTENT_TYPES = new Map([
  ["application/pdf", "pdf"],
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

async function privateEvidenceDownload(evidenceId: string, actorId: string) {
  const db = getDb();
  const rows = await db.select().from(providerEvidenceSubmissions)
    .where(eq(providerEvidenceSubmissions.id, evidenceId)).limit(1);
  const row = rows[0];
  if (!row?.storageKey) return Response.json({ error: "Evidence file not found." }, { status: 404 });
  const scans = await db.select().from(evidenceFileScans)
    .where(eq(evidenceFileScans.evidenceSubmissionId, row.id))
    .orderBy(desc(evidenceFileScans.requestedAt))
    .limit(1);
  if (scans[0]?.status !== "clean") {
    await recordProviderAuditEvent({
      providerId: row.providerId,
      personId: row.personId,
      serviceCode: row.serviceCode,
      jurisdiction: row.jurisdiction,
      eventType: "owner_evidence_view_blocked",
      entityType: "provider_evidence_submission",
      entityId: row.id,
      actorType: "verified_owner",
      actorId,
      outcome: "blocked_until_clean_scan",
      reasonCodes: [`malware_scan_${scans[0]?.status || "missing"}`],
    });
    return Response.json({
      error: "This private file remains quarantined until its latest malware scan reports clean.",
      scanStatus: scans[0]?.status ?? "missing",
    }, {
      status: 423,
      headers: { "cache-control": "private, no-store, max-age=0" },
    });
  }
  const object = await getProviderEvidence(row.storageKey);
  if (!object) return Response.json({ error: "Evidence file not found." }, { status: 404 });
  await recordProviderAuditEvent({
    providerId: row.providerId,
    personId: row.personId,
    serviceCode: row.serviceCode,
    jurisdiction: row.jurisdiction,
    eventType: "owner_evidence_viewed",
    entityType: "provider_evidence_submission",
    entityId: row.id,
    actorType: "verified_owner",
    actorId,
    outcome: "allowed",
  });
  const contentType = PRIVATE_EVIDENCE_CONTENT_TYPES.has(row.contentType)
    ? row.contentType
    : "application/octet-stream";
  const extension = PRIVATE_EVIDENCE_CONTENT_TYPES.get(row.contentType) ?? "bin";
  return new Response(object.body, {
    headers: {
      "cache-control": "private, no-store, max-age=0",
      "content-disposition": `attachment; filename="provider-evidence-${row.id}.${extension}"`,
      "content-security-policy": "sandbox",
      "content-type": contentType,
      "cross-origin-resource-policy": "same-origin",
      "expires": "0",
      "pragma": "no-cache",
      "referrer-policy": "no-referrer",
      "x-content-type-options": "nosniff",
      "x-frame-options": "DENY",
    },
  });
}

export async function GET(request: Request) {
  const verification = await verifyOwnerRequest(request);
  if (!verification.ok) {
    return Response.json({ error: "Verified owner access required." }, {
      status: 403,
      headers: { "cache-control": "no-store" },
    });
  }
  try {
    const evidenceId = clean(new URL(request.url).searchParams.get("evidenceId"), 120);
    if (evidenceId) {
      if (!isSameOriginRequest(request)) {
        return Response.json({ error: "Cross-origin evidence downloads are not allowed." }, {
          status: 403,
          headers: { "cache-control": "no-store" },
        });
      }
      return privateEvidenceDownload(evidenceId, verification.email);
    }
    return Response.json(await complianceResponse(), {
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    console.error("Unable to load provider compliance queue", error);
    return Response.json({ error: "Unable to load the provider compliance queue." }, {
      status: 500,
      headers: { "cache-control": "no-store" },
    });
  }
}

export async function POST(request: Request) {
  const verification = await verifyOwnerRequest(request);
  if (!verification.ok) {
    return Response.json({ error: "Verified owner access required." }, { status: 403 });
  }
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "Cross-origin owner actions are not allowed." }, { status: 403 });
  }
  const actorId = verification.email;
  try {
    const body = await request.json() as Record<string, unknown>;
    const action = clean(body.action, 80);
    const providerId = clean(body.providerId, 120);
    const db = getDb();

    if (action === "prescreen-dispatch") {
      // Bulk pre-screen of the pending queue. This deliberately applies only
      // the one factual, reversible outcome — a correction request for an
      // expired or undated document — and never accepts anything. Acceptance
      // stays a per-document human act with an external authenticity check.
      const pendingRows = await db.select().from(providerEvidenceSubmissions)
        .where(providerId
          ? and(
              eq(providerEvidenceSubmissions.providerId, providerId),
              eq(providerEvidenceSubmissions.status, "pending"),
            )
          : eq(providerEvidenceSubmissions.status, "pending"));
      if (pendingRows.length === 0) {
        return Response.json({
          ok: true,
          message: "No documents are waiting for a pre-screen.",
          corrected: 0,
          flaggedForReview: 0,
          readyForAuthenticity: 0,
        });
      }
      const involvedProviderIds = [...new Set(pendingRows.map((row) => row.providerId))];
      const [providerRows, profileRows, scanRows] = await Promise.all([
        db.select().from(providerApplications)
          .where(inArray(providerApplications.id, involvedProviderIds)),
        db.select().from(providerPathwayProfiles)
          .where(inArray(providerPathwayProfiles.providerId, involvedProviderIds))
          .orderBy(desc(providerPathwayProfiles.pathwayVersion)),
        db.select().from(evidenceFileScans)
          .where(inArray(evidenceFileScans.evidenceSubmissionId, pendingRows.map((row) => row.id)))
          .orderBy(desc(evidenceFileScans.requestedAt)),
      ]);
      const providerById = new Map(providerRows.map((provider) => [provider.id, provider]));
      const profileByProvider = latestProfiles(profileRows);
      const scanByEvidence = latestScanMap(scanRows);

      let corrected = 0;
      let flaggedForReview = 0;
      let readyForAuthenticity = 0;
      const affectedProviderIds = new Set<string>();
      for (const row of pendingRows) {
        const provider = providerById.get(row.providerId);
        // Never auto-touch a test application.
        if (!provider || provider.isTestProvider === "yes") continue;
        const profile = profileByProvider.get(row.providerId);
        const prescreen = prescreenForEvidence(
          row,
          scanByEvidence.get(row.id),
          provider,
          profile,
        );
        if (!prescreen.autoDispatch) {
          if (prescreen.recommendation === "ready_for_authenticity_check") readyForAuthenticity += 1;
          else if (
            prescreen.recommendation === "reject_mismatch"
            || prescreen.recommendation === "hold_scan_not_clean"
          ) flaggedForReview += 1;
          continue;
        }
        // Quarantine any dependent Checkout state before the evidence write,
        // mirroring the single-document review path.
        await expireOpenCheckoutSessionsForLaunchShutdown();
        const now = new Date().toISOString();
        const reviewDecisionId = crypto.randomUUID();
        await db.update(providerEvidenceSubmissions).set({
          status: prescreen.autoDispatch.status,
          evidenceScope: evidenceScopeWithoutLegalBusinessIdentity(row.evidenceScope),
          reviewedAt: now,
          reviewedBy: actorId,
          reviewDecisionId,
          reasonCodes: JSON.stringify([prescreen.autoDispatch.reasonCode]),
          reviewNotes: prescreen.autoDispatch.note,
          authenticityVerificationMethod: "",
          authenticityVerifiedBy: "",
          authenticityVerificationReference: "",
          authenticitySourceUrl: "",
          authenticityVerifiedAt: "",
          authenticityValidThrough: "",
          updatedAt: now,
        }).where(eq(providerEvidenceSubmissions.id, row.id));
        await recordProviderAuditEvent({
          providerId: row.providerId,
          personId: row.personId,
          serviceCode: row.serviceCode,
          jurisdiction: row.jurisdiction,
          eventType: "owner_evidence_reviewed",
          entityType: "provider_evidence_submission",
          entityId: row.id,
          actorType: "verified_owner",
          actorId,
          outcome: prescreen.autoDispatch.status,
          reasonCodes: [prescreen.autoDispatch.reasonCode],
          metadata: {
            reviewDecisionId,
            notes: prescreen.autoDispatch.note,
            automatedPrescreen: true,
            prescreenRecommendation: prescreen.recommendation,
            noSensitiveIdentityDocumentStored: true,
          },
        });
        await notifyProviderEvidenceDecision({
          evidenceId: row.id,
          email: provider.email,
          status: prescreen.autoDispatch.status,
        });
        corrected += 1;
        affectedProviderIds.add(row.providerId);
      }
      for (const affectedProviderId of affectedProviderIds) {
        await recalculateProvider(affectedProviderId, actorId);
      }
      await expireOpenCheckoutSessionsForLaunchShutdown();
      return Response.json({
        ok: true,
        message: corrected > 0
          ? `Pre-screen sent ${corrected} correction request${corrected === 1 ? "" : "s"} for expired or undated documents. ${readyForAuthenticity} passed the automatic checks and are ready for your external authenticity check — nothing was accepted automatically.`
          : `No automatic corrections were needed. ${readyForAuthenticity} document${readyForAuthenticity === 1 ? " is" : "s are"} ready for your external authenticity check and ${flaggedForReview} need${flaggedForReview === 1 ? "s" : ""} a manual look. Nothing was accepted automatically.`,
        corrected,
        flaggedForReview,
        readyForAuthenticity,
      });
    }

    if (action === "initialize-provider-pathway") {
      if (!providerId) return Response.json({ error: "Choose a provider application." }, { status: 400 });
      const pathway = clean(body.pathway, 80);
      const serviceCodes = Array.isArray(body.serviceCodes)
        ? [...new Set(body.serviceCodes.map((value) => clean(value, 100)).filter(Boolean))]
        : [];
      if (!isProviderPathway(pathway)) {
        return Response.json({ error: "Choose a recognized provider pathway." }, { status: 400 });
      }
      if (!serviceCodes.length || serviceCodes.some((code) => !isServiceCode(code) || code === "general_auto_repair")) {
        return Response.json({ error: "Choose at least one exact v0.11 service; general auto repair is prohibited." }, { status: 400 });
      }
      const exactServices = serviceCodes as ServiceCode[];
      // Each exact service carries its own lawful level, so one provider may be
      // provisioned for standard and specialty work together. Services that no
      // level on this pathway may perform are reported by name.
      const unsupportedServices = exactServices.filter((serviceCode) => (
        !providerLevelForService(serviceCode, pathway)
      ));
      if (unsupportedServices.length) {
        return Response.json({
          error: `These services are not lawful on the selected working relationship: ${
            unsupportedServices.join(", ")
          }.`,
        }, { status: 409 });
      }
      // The profile keeps the highest level held as a display summary; per
      // service authorization always runs through the eligibility engine.
      const heldLevels = providerLevelsForServices(exactServices, pathway);
      const providerLevel = [...PROVIDER_LEVEL_CODES]
        .reverse()
        .find((level) => heldLevels.includes(level)) ?? "";
      if (!isProviderLevel(providerLevel) || providerLevel === "learning_account") {
        return Response.json({ error: "That provider level is not compatible with the selected working relationship." }, { status: 400 });
      }
      const [provider] = await db.select().from(providerApplications)
        .where(eq(providerApplications.id, providerId)).limit(1);
      if (!provider) return Response.json({ error: "Provider application not found." }, { status: 404 });
      if (provider.status === "declined" || provider.isTestProvider === "yes") {
        return Response.json({ error: "A declined or test application cannot enter the live v0.11 workflow." }, { status: 409 });
      }
      const [profiles, personnel] = await Promise.all([
        db.select().from(providerPathwayProfiles)
          .where(eq(providerPathwayProfiles.providerId, providerId)).limit(1),
        db.select().from(providerPersonnel)
          .where(eq(providerPersonnel.providerId, providerId)).limit(1),
      ]);
      if (profiles[0] || personnel[0]) {
        return Response.json({ error: "This application already has a pathway or personnel record; use the existing record instead of creating a second identity." }, { status: 409 });
      }
      const now = new Date().toISOString();
      const personId = crypto.randomUUID();
      const profileId = crypto.randomUUID();
      const holds = [
        "pending_identity_and_evidence_review",
        "current_provider_agreements_required",
        "services_not_activated",
        ...(pathway === "independent_startup" ? [] : ["sponsor_or_employer_confirmation_required"]),
      ];
      await db.insert(providerPathwayProfiles).values({
        id: profileId,
        providerId,
        providerPersonId: personId,
        relationshipPath: pathway,
        providerLevel,
        pathwayVersion: 1,
        status: "pending_review",
        policyVersion: POLICY_VERSION,
        holdReasonCodes: JSON.stringify(holds),
        createdAt: now,
        updatedAt: now,
      });
      await db.insert(providerPersonnel).values({
        id: crypto.randomUUID(),
        providerId,
        personId,
        relationshipType: relationshipType(pathway),
        personnelRole: "technician",
        providerLevel,
        rosterVersion: 1,
        status: "pending",
        createdAt: now,
        updatedAt: now,
      });
      await db.update(providerApplications).set({
        service: serializeProviderServices(exactServices),
        approvedServices: "",
        serviceEligibilityStatuses: "",
        serviceRulesVersion: POLICY_VERSION,
        verificationStatus: "in review",
        verifiedAt: "",
        verifiedBy: "",
        alertsEnabled: "no",
        status: "new",
      }).where(eq(providerApplications.id, providerId));
      await recordProviderAuditEvent({
        providerId,
        personId,
        jurisdiction: POLICY_JURISDICTION,
        eventType: "legacy_provider_pathway_initialized",
        entityType: "provider_pathway_profile",
        entityId: profileId,
        actorType: "verified_owner",
        actorId,
        outcome: "pending_review",
        reasonCodes: holds,
        metadata: { pathway, providerLevel, serviceCodes: exactServices, agreementsFabricated: false },
      });
      return Response.json({
        ok: true,
        message: "The legacy application is now in the v0.11 queue. The provider must still accept current agreements, and any employer must attest separately.",
        provider: await recalculateProvider(providerId, actorId),
      });
    }

    if (action === "record-evidence-scan") {
      const evidenceId = clean(body.evidenceId, 120);
      const scanStatus = clean(body.scanStatus, 40);
      const scanProvider = clean(body.scanProvider, 160);
      const scanEngineVersion = clean(body.scanEngineVersion, 120);
      const reviewNotes = clean(body.reviewNotes, 1200);
      const allowedStatuses = new Set(["infected", "failed", "error"]);
      if (!evidenceId || !allowedStatuses.has(scanStatus)) {
        return Response.json({
          error: "Owner-entered clean results are prohibited. Clean status must arrive through the authenticated scanner callback; this form can record only a non-clean hold.",
        }, { status: 400 });
      }
      if (
        !scanProvider
        || scanProvider === "external_scanner_required"
        || !scanEngineVersion
        || !reviewNotes
        || body.explicitConfirmation !== true
      ) {
        return Response.json({
          error: "Record the real external scanner, engine/signature version, report reference, and explicit confirmation. An owner visual review is not a malware scan.",
        }, { status: 400 });
      }
      const [evidence] = await db.select().from(providerEvidenceSubmissions)
        .where(eq(providerEvidenceSubmissions.id, evidenceId)).limit(1);
      if (!evidence?.storageKey || !evidence.documentHash) {
        return Response.json({ error: "A stored evidence file with a recorded hash is required." }, { status: 404 });
      }
      if (providerId && evidence.providerId !== providerId) {
        return Response.json({ error: "Evidence submission does not belong to this provider." }, { status: 409 });
      }
      const [scanProviderRecord] = await db.select({
        email: providerApplications.email,
      }).from(providerApplications)
        .where(eq(providerApplications.id, evidence.providerId))
        .limit(1);
      if (!scanProviderRecord?.email) {
        return Response.json({ error: "The provider application for this evidence was not found." }, { status: 409 });
      }
      // This non-clean result can revoke evidence that an open Checkout
      // Session depended on. Persist the local payment quarantine first.
      await expireOpenCheckoutSessionsForLaunchShutdown();
      const now = new Date().toISOString();
      const scanId = crypto.randomUUID();
      await db.insert(evidenceFileScans).values({
        id: scanId,
        evidenceSubmissionId: evidence.id,
        providerId: evidence.providerId,
        scanProvider,
        scanEngineVersion,
        status: scanStatus,
        threatName: scanStatus === "infected" ? "See restricted external scan report" : "",
        fileHash: evidence.documentHash,
        requestedAt: now,
        completedAt: now,
        reviewedBy: actorId,
        reviewNotes,
        createdAt: now,
        updatedAt: now,
      });
      if (scanStatus !== "clean" && evidence.status === "accepted") {
        await db.update(providerEvidenceSubmissions).set({
          status: "needs_correction",
          reasonCodes: JSON.stringify([`malware_scan_${scanStatus}`]),
          reviewNotes: "The latest external file scan is not clean. This evidence remains blocked.",
          updatedAt: now,
        }).where(eq(providerEvidenceSubmissions.id, evidence.id));
      }
      await recordProviderAuditEvent({
        providerId: evidence.providerId,
        personId: evidence.personId,
        serviceCode: evidence.serviceCode,
        jurisdiction: evidence.jurisdiction,
        eventType: "external_evidence_scan_recorded",
        entityType: "evidence_file_scan",
        entityId: scanId,
        actorType: "verified_owner",
        actorId,
        outcome: scanStatus,
        reasonCodes: [`malware_scan_${scanStatus}`],
        metadata: {
          evidenceId: evidence.id,
          scanProvider,
          scanEngineVersion,
          externalReportRecorded: true,
        },
      });
      const recalculatedProvider = await recalculateProvider(evidence.providerId, actorId);
      await expireOpenCheckoutSessionsForLaunchShutdown();
      await notifyProviderEvidenceScanBlocked({
        evidenceId: evidence.id,
        email: scanProviderRecord.email,
        scanStatus,
      });
      return Response.json({
        ok: true,
        message: "Non-clean scan result recorded. The file and every dependent service remain blocked.",
        provider: recalculatedProvider,
      });
    }

    if (action === "review-evidence") {
      const evidenceId = clean(body.evidenceId, 120);
      const status = clean(body.status, 40);
      const reasonCode = clean(body.reasonCode, 100);
      const notes = clean(body.notes, 1200);
      const authenticityVerificationMethod = clean(body.authenticityVerificationMethod, 80);
      const authenticityVerifiedBy = clean(body.authenticityVerifiedBy, 180);
      const authenticityVerificationReference = clean(
        body.authenticityVerificationReference,
        300,
      );
      const authenticitySourceUrl = clean(body.authenticitySourceUrl, 500);
      const authenticityVerifiedAt = clean(body.authenticityVerifiedAt, 10);
      const authenticityValidThrough = clean(body.authenticityValidThrough, 10);
      const verifiedLegalBusinessName = clean(body.verifiedLegalBusinessName, 180);
      const legalBusinessNameConfirmed = body.legalBusinessNameConfirmed === true;
      if (!evidenceId || !EVIDENCE_REVIEW_STATUSES.includes(status as EvidenceReviewStatus)) {
        return Response.json({ error: "Choose an evidence item and controlled review status." }, { status: 400 });
      }
      if (!EVIDENCE_REASON_CODES.includes(reasonCode as EvidenceReasonCode)) {
        return Response.json({ error: "Choose a controlled review reason." }, { status: 400 });
      }
      if (status === "accepted" && reasonCode !== "owner_evidence_accepted") {
        return Response.json({ error: "Accepted evidence must use the accepted-evidence reason." }, { status: 400 });
      }
      if (status !== "accepted" && reasonCode === "owner_evidence_accepted") {
        return Response.json({ error: "Choose the reason this evidence was not accepted." }, { status: 400 });
      }
      if (status !== "accepted" && !notes) {
        return Response.json({ error: "Add a correction or rejection note for the provider." }, { status: 400 });
      }
      const [evidence] = await db.select().from(providerEvidenceSubmissions)
        .where(eq(providerEvidenceSubmissions.id, evidenceId)).limit(1);
      if (!evidence || (providerId && evidence.providerId !== providerId)) {
        return Response.json({ error: "Evidence submission not found." }, { status: 404 });
      }
      if (status === "accepted" && evidence.storageKey) {
        const scans = await db.select().from(evidenceFileScans)
          .where(eq(evidenceFileScans.evidenceSubmissionId, evidence.id))
          .orderBy(desc(evidenceFileScans.requestedAt))
          .limit(1);
        if (scans[0]?.status !== "clean") {
          return Response.json({
            error: "This file cannot be accepted while its latest malware scan is missing, pending, failed, or infected.",
            scanStatus: scans[0]?.status ?? "missing",
          }, { status: 423 });
        }
      }
      if (!isServiceCode(evidence.serviceCode) || evidence.serviceCode === "general_auto_repair") {
        return Response.json({ error: "Evidence must be tied to one exact service before review." }, { status: 409 });
      }
      if (!(evidence.requirementKey in PROVIDER_POLICY_MATRIX.evidence_types)) {
        return Response.json({ error: "This evidence requirement is not recognized by v0.11." }, { status: 409 });
      }
      const requirementKey = evidence.requirementKey as EvidenceRequirementCode;
      const businessIdentitySourceEligible =
        isBusinessIdentityEvidenceRequirement(requirementKey);
      if (
        !businessIdentitySourceEligible
        && (verifiedLegalBusinessName || legalBusinessNameConfirmed)
      ) {
        return Response.json({
          error: "A legal-business-name decision may be recorded only from qualifying business registration, license, or insurance evidence.",
        }, { status: 400 });
      }
      if (
        status === "accepted"
        && businessIdentitySourceEligible
        && (!verifiedLegalBusinessName || !legalBusinessNameConfirmed)
      ) {
        return Response.json({
          error: "Enter the exact legal business name shown by the externally verified source and confirm the match before accepting this business evidence.",
        }, { status: 400 });
      }
      const [evidenceProvider, evidenceProfiles] = await Promise.all([
        db.select().from(providerApplications)
          .where(eq(providerApplications.id, evidence.providerId)).limit(1),
        db.select().from(providerPathwayProfiles)
          .where(eq(providerPathwayProfiles.providerId, evidence.providerId))
          .orderBy(desc(providerPathwayProfiles.pathwayVersion)).limit(1),
      ]);
      const evidenceProfile = evidenceProfiles[0];
      if (
        !evidenceProvider[0]
        || !evidenceProfile
        || !isProviderPathway(evidenceProfile.relationshipPath)
        || !parseProviderServices(evidenceProvider[0].service).includes(evidence.serviceCode)
        || !getEvidenceRequirements(evidence.serviceCode, evidenceProfile.relationshipPath).includes(requirementKey)
        || evidence.jurisdiction !== POLICY_JURISDICTION
        || (PERSON_BOUND_REQUIREMENTS.has(requirementKey)
          && evidence.personId !== evidenceProfile.providerPersonId)
      ) {
        return Response.json({
          error: "This submission does not match the applicant's current exact service, pathway, person, or jurisdiction.",
        }, { status: 409 });
      }
      const definition = PROVIDER_POLICY_MATRIX.evidence_types[requirementKey];
      if (
        status === "accepted"
        && definition.requires_expiration === true
        && !currentThrough(evidence.expiresAt)
      ) {
        return Response.json({ error: "Evidence requiring expiration cannot be accepted unless it is current." }, { status: 409 });
      }
      if (status === "accepted") {
        const authenticityRecord = {
          authenticityVerificationMethod,
          authenticityVerifiedBy,
          authenticityVerificationReference,
          authenticitySourceUrl,
          authenticityVerifiedAt,
          authenticityValidThrough,
        };
        if (
          !EVIDENCE_AUTHENTICITY_METHODS.includes(
            authenticityVerificationMethod as EvidenceAuthenticityMethod,
          )
          || !validDate(authenticityVerifiedAt)
          || !validDate(authenticityValidThrough)
          || !evidenceAuthenticityIsCurrent(authenticityRecord, new Date())
        ) {
          return Response.json({
            error: "Acceptance requires a current external authenticity check, named verifier, usable reference, and secure source. Official online lookups must use an HTTPS .gov source.",
          }, { status: 400 });
        }
        if (
          evidence.expiresAt
          && (
            !validDate(evidence.expiresAt)
            || dateTime(authenticityValidThrough) > dateTime(evidence.expiresAt)
          )
        ) {
          return Response.json({
            error: "The authenticity review cannot remain valid after the evidence itself expires.",
          }, { status: 400 });
        }
        if (
          !evidence.expiresAt
          && !annualVerificationWindowIsValid(
            authenticityVerifiedAt,
            authenticityValidThrough,
          )
        ) {
          return Response.json({
            error: "Evidence without its own expiration date requires an authenticity recheck within one year.",
          }, { status: 400 });
        }
      }
      // Any evidence decision can replace the current eligibility snapshot.
      // Quarantine local Checkout state before the evidence mutation; the
      // Stripe cleanup remains best-effort after that local fail-closed write.
      await expireOpenCheckoutSessionsForLaunchShutdown();
      const now = new Date().toISOString();
      const reviewDecisionId = crypto.randomUUID();
      const evidenceScope = status === "accepted" && businessIdentitySourceEligible
        ? evidenceScopeWithLegalBusinessIdentity(evidence.evidenceScope, {
            legalBusinessName: verifiedLegalBusinessName,
            evidenceSubmissionId: evidence.id,
            reviewDecisionId,
            verifiedAt: now,
            verifiedBy: actorId,
          })
        : evidenceScopeWithoutLegalBusinessIdentity(evidence.evidenceScope);
      await db.update(providerEvidenceSubmissions).set({
        status,
        evidenceScope,
        reviewedAt: now,
        reviewedBy: actorId,
        reviewDecisionId,
        reasonCodes: JSON.stringify([reasonCode]),
        reviewNotes: notes,
        authenticityVerificationMethod: status === "accepted"
          ? authenticityVerificationMethod
          : "",
        authenticityVerifiedBy: status === "accepted" ? authenticityVerifiedBy : "",
        authenticityVerificationReference: status === "accepted"
          ? authenticityVerificationReference
          : "",
        authenticitySourceUrl: status === "accepted" ? authenticitySourceUrl : "",
        authenticityVerifiedAt: status === "accepted" ? authenticityVerifiedAt : "",
        authenticityValidThrough: status === "accepted" ? authenticityValidThrough : "",
        updatedAt: now,
      }).where(eq(providerEvidenceSubmissions.id, evidence.id));
      await recordProviderAuditEvent({
        providerId: evidence.providerId,
        personId: evidence.personId,
        serviceCode: evidence.serviceCode,
        jurisdiction: evidence.jurisdiction,
        eventType: "owner_evidence_reviewed",
        entityType: "provider_evidence_submission",
        entityId: evidence.id,
        actorType: "verified_owner",
        actorId,
        outcome: status,
        reasonCodes: [reasonCode],
        metadata: {
          reviewDecisionId,
          notes,
          legalBusinessIdentityRecorded:
            status === "accepted" && businessIdentitySourceEligible,
          verifiedLegalBusinessName: status === "accepted" && businessIdentitySourceEligible
            ? verifiedLegalBusinessName
            : "",
          authenticityVerificationMethod: status === "accepted"
            ? authenticityVerificationMethod
            : "",
          authenticityVerifiedBy: status === "accepted" ? authenticityVerifiedBy : "",
          authenticityVerificationReference: status === "accepted"
            ? authenticityVerificationReference
            : "",
          authenticitySourceUrl: status === "accepted" ? authenticitySourceUrl : "",
          authenticityVerifiedAt: status === "accepted" ? authenticityVerifiedAt : "",
          authenticityValidThrough: status === "accepted" ? authenticityValidThrough : "",
          noSensitiveIdentityDocumentStored: true,
        },
      });
      const recalculatedProvider = await recalculateProvider(evidence.providerId, actorId);
      await expireOpenCheckoutSessionsForLaunchShutdown();
      await notifyProviderEvidenceDecision({
        evidenceId: evidence.id,
        email: evidenceProvider[0].email,
        status,
      });
      return Response.json({
        ok: true,
        message: "Evidence review saved. Eligibility was recalculated without granting blanket approval.",
        provider: recalculatedProvider,
      });
    }

    if (action === "identity-age-review") {
      const personId = clean(body.personId, 120);
      const identityVerificationProvider = clean(body.identityVerificationProvider, 180);
      const identityVerificationReference = clean(body.identityVerificationReference, 300);
      const identityVerificationCheckedAt = clean(body.identityVerificationCheckedAt, 10);
      const identityVerificationValidThrough = clean(
        body.identityVerificationValidThrough,
        10,
      );
      const ageVerificationProvider = clean(body.ageVerificationProvider, 180);
      const ageVerificationReference = clean(body.ageVerificationReference, 300);
      const ageVerificationCheckedAt = clean(body.ageVerificationCheckedAt, 10);
      const ageVerificationValidThrough = clean(body.ageVerificationValidThrough, 10);
      if (
        identityVerificationProvider.toLowerCase() === "stripe_identity"
        || ageVerificationProvider.toLowerCase() === "stripe_identity"
      ) {
        return Response.json({
          error: "stripe_identity is reserved for the signed automated Stripe webhook. Use the actual independent external provider name for a manual review.",
        }, { status: 400 });
      }
      const externalVerificationRecord = {
        identityVerificationProvider,
        identityVerificationReference,
        identityVerificationCheckedAt,
        identityVerificationValidThrough,
        ageVerificationProvider,
        ageVerificationReference,
        ageVerificationCheckedAt,
        ageVerificationValidThrough,
      };
      if (
        !providerId
        || !personId
        || body.identityConfirmed !== true
        || body.adultConfirmed !== true
        || body.explicitConfirmation !== true
        || !annualVerificationWindowIsValid(
          identityVerificationCheckedAt,
          identityVerificationValidThrough,
        )
        || !annualVerificationWindowIsValid(
          ageVerificationCheckedAt,
          ageVerificationValidThrough,
        )
        || !externalIdentityAgeVerificationIsCurrent(
          externalVerificationRecord,
          new Date(),
        )
      ) {
        return Response.json({
          error: "Confirm identity and adult status using named external providers, usable verification references, past-or-current check dates, and valid-through dates no more than one year later. TUVELOZ, the owner, or self-attestation cannot be the verification provider.",
        }, { status: 400 });
      }
      const profiles = await db.select().from(providerPathwayProfiles)
        .where(eq(providerPathwayProfiles.providerId, providerId))
        .orderBy(desc(providerPathwayProfiles.pathwayVersion)).limit(1);
      const profile = profiles[0];
      if (!profile || profile.providerPersonId !== personId) {
        return Response.json({ error: "Identity review is limited to the current applicant record." }, { status: 409 });
      }
      const people = await db.select().from(providerPersonnel).where(and(
        eq(providerPersonnel.providerId, providerId),
        eq(providerPersonnel.personId, personId),
      )).orderBy(desc(providerPersonnel.rosterVersion)).limit(1);
      const person = people[0];
      if (!person) return Response.json({ error: "Applicant personnel record not found." }, { status: 404 });
      await expireOpenCheckoutSessionsForLaunchShutdown();
      const now = new Date().toISOString();
      const employeePath = profile.relationshipPath === "sponsored_trainee_employee"
        || profile.relationshipPath === "provider_business_employee";
      await db.update(providerPersonnel).set({
        identityVerifiedAt: now,
        ageVerifiedAt: now,
        identityVerificationProvider,
        identityVerificationReference,
        identityVerificationCheckedAt,
        identityVerificationValidThrough,
        ageVerificationProvider,
        ageVerificationReference,
        ageVerificationCheckedAt,
        ageVerificationValidThrough,
        status: employeePath && !employeeAttestationsComplete(person) ? "pending" : "active",
        updatedAt: now,
      }).where(eq(providerPersonnel.id, person.id));
      if (profile.relationshipPath === "independent_startup") {
        await db.update(providerPathwayProfiles).set({
          registrationHolderId: providerId,
          updatedAt: now,
        }).where(eq(providerPathwayProfiles.id, profile.id));
      }
      await recordProviderAuditEvent({
        providerId,
        personId,
        jurisdiction: POLICY_JURISDICTION,
        eventType: "applicant_identity_age_reviewed",
        entityType: "provider_personnel",
        entityId: person.id,
        actorType: "verified_owner",
        actorId,
        outcome: "verified",
        metadata: {
          identityVerificationProvider,
          identityVerificationReference,
          identityVerificationCheckedAt,
          identityVerificationValidThrough,
          ageVerificationProvider,
          ageVerificationReference,
          ageVerificationCheckedAt,
          ageVerificationValidThrough,
          storedData: "external_references_and_dates_only",
          noSensitiveIdentityDocumentStored: true,
        },
      });
      const recalculatedProvider = await recalculateProvider(providerId, actorId);
      await expireOpenCheckoutSessionsForLaunchShutdown();
      return Response.json({
        ok: true,
        message: "External identity and adult-status verification references and validity dates were recorded. No identity number or document was stored.",
        provider: recalculatedProvider,
      });
    }

    if (action === "employer-attestation") {
      const personId = clean(body.personId, 120);
      const sponsorProviderId = clean(body.sponsorProviderId, 180);
      const employerAttestedByPersonId = clean(body.employerAttestedByPersonId, 180);
      const employmentStartedAt = clean(body.employmentStartedAt, 10);
      if (
        !providerId
        || !personId
        || !sponsorProviderId
        || !employerAttestedByPersonId
        || !validDate(employmentStartedAt)
        || dateTime(employmentStartedAt, false) > Date.now()
        || body.genuineEmployeeConfirmed !== true
        || body.employerRetainsWorkAuthorizationRecords !== true
        || body.lawfulPayAndCoverageConfirmed !== true
        || body.noBorrowedCredentialsConfirmed !== true
        || body.explicitConfirmation !== true
      ) {
        return Response.json({
          error: "Complete every employer attestation. Do not submit SSNs, I-9s, passports, or work-authorization documents.",
        }, { status: 400 });
      }
      const profiles = await db.select().from(providerPathwayProfiles)
        .where(eq(providerPathwayProfiles.providerId, providerId))
        .orderBy(desc(providerPathwayProfiles.pathwayVersion)).limit(1);
      const profile = profiles[0];
      if (
        !profile
        || profile.providerPersonId !== personId
        || !["sponsored_trainee_employee", "provider_business_employee"].includes(profile.relationshipPath)
      ) {
        return Response.json({ error: "Employer attestation is limited to the current employee or sponsored-trainee pathway." }, { status: 409 });
      }
      const people = await db.select().from(providerPersonnel).where(and(
        eq(providerPersonnel.providerId, providerId),
        eq(providerPersonnel.personId, personId),
      )).orderBy(desc(providerPersonnel.rosterVersion)).limit(1);
      const person = people[0];
      if (!person) return Response.json({ error: "Employee personnel record not found." }, { status: 404 });
      const [sponsorProvider] = await db.select().from(providerApplications)
        .where(eq(providerApplications.id, sponsorProviderId)).limit(1);
      if (
        !sponsorProvider
        || sponsorProvider.id === providerId
        || sponsorProvider.status !== "approved"
        || sponsorProvider.verificationStatus !== "verified"
        || sponsorProvider.isTestProvider === "yes"
      ) {
        return Response.json({
          error: "Select a different, active, verified provider business as the sponsoring employer.",
        }, { status: 409 });
      }
      await expireOpenCheckoutSessionsForLaunchShutdown();
      const now = new Date().toISOString();
      await db.update(providerPersonnel).set({
        employmentStartedAt,
        employerAttestedAt: now,
        workAuthorizationAttestedAt: now,
        lawfulPayAttestedAt: now,
        employerAttestedByPersonId,
        status: person.identityVerifiedAt && person.ageVerifiedAt ? "active" : "pending",
        updatedAt: now,
      }).where(eq(providerPersonnel.id, person.id));
      await db.update(providerPathwayProfiles).set({
        sponsoringProviderId: sponsorProviderId,
        registrationHolderId: sponsorProviderId,
        updatedAt: now,
      }).where(eq(providerPathwayProfiles.id, profile.id));

      const selectedServices = (await db.select({ service: providerApplications.service })
        .from(providerApplications).where(eq(providerApplications.id, providerId)).limit(1))[0];
      const serviceCodes = parseProviderServices(selectedServices?.service ?? "")
        .filter(isServiceCode)
        .filter((serviceCode) => serviceCode !== "general_auto_repair");
      for (const serviceCode of serviceCodes) {
        const pathway = profile.relationshipPath as ProviderPathway;
        const structuredRequirements = getEvidenceRequirements(serviceCode, pathway)
          .filter((requirement) => STRUCTURED_EMPLOYMENT_REQUIREMENTS.has(requirement));
        for (const requirementKey of structuredRequirements) {
          const existing = await db.select().from(providerEvidenceSubmissions).where(and(
            eq(providerEvidenceSubmissions.providerId, providerId),
            eq(providerEvidenceSubmissions.personId, personId),
            eq(providerEvidenceSubmissions.serviceCode, serviceCode),
            eq(providerEvidenceSubmissions.requirementKey, requirementKey),
            eq(providerEvidenceSubmissions.status, "accepted"),
          )).limit(1);
          if (existing[0]) continue;
          const evidenceId = crypto.randomUUID();
          await db.insert(providerEvidenceSubmissions).values({
            id: evidenceId,
            providerId,
            personId,
            requirementKey,
            serviceCode,
            jurisdiction: POLICY_JURISDICTION,
            evidenceType: "structured_employer_attestation",
            evidenceScope: JSON.stringify({
              pathway,
              serviceCode,
              sponsorProviderId,
              employmentStartedAt,
              timestampsOnly: true,
              workAuthorizationDocumentsRetainedByEmployer: true,
            }),
            issuer: "Employer attestation recorded by verified TUVELOZ owner",
            effectiveAt: employmentStartedAt,
            status: "accepted",
            submittedAt: now,
            reviewedAt: now,
            reviewedBy: actorId,
            reviewDecisionId: crypto.randomUUID(),
            reasonCodes: JSON.stringify(["structured_employer_attestation"]),
            reviewNotes: "Employer relationship, work-authorization responsibility, lawful pay, and coverage were attested without collecting I-9 or identity documents.",
            createdAt: now,
            updatedAt: now,
          });
        }
      }
      await recordProviderAuditEvent({
        providerId,
        personId,
        jurisdiction: POLICY_JURISDICTION,
        eventType: "employer_relationship_attested",
        entityType: "provider_personnel",
        entityId: person.id,
        actorType: "verified_owner_recorder",
        actorId,
        outcome: "attested",
        reasonCodes: ["genuine_employee", "lawful_pay", "employer_retains_work_authorization_records", "no_borrowed_credentials"],
        metadata: {
          sponsorProviderId,
          employerAttestedByPersonId,
          employmentStartedAt,
          storedData: "attestation_timestamps_only",
          sensitiveDocumentsStored: false,
        },
      });
      const recalculatedProvider = await recalculateProvider(providerId, actorId);
      await expireOpenCheckoutSessionsForLaunchShutdown();
      return Response.json({
        ok: true,
        message: "Employer attestations recorded as timestamps only. Eligibility remains service-specific.",
        provider: recalculatedProvider,
      });
    }

    if (action === "activate-service") {
      if (!(await runtimeProviderActivationPrerequisitesDecision()).approved) {
        return Response.json({
          error: "Service activation remains blocked until both evidence stages and the stable provider-onboarding, security, and policy-catalog prerequisites are current. Recording owner or professional-review choices cannot bypass those gates.",
        }, { status: 409, headers: { "cache-control": "no-store" } });
      }
      const serviceCode = clean(body.serviceCode, 100);
      const jurisdiction = clean(body.jurisdiction, 100);
      const validThrough = clean(body.validThrough, 10);
      const legalRequirementsReviewedAt = clean(body.legalRequirementsReviewedAt, 10);
      const legalRequirementsValidThrough = clean(body.legalRequirementsValidThrough, 10);
      const legalRequirementsReviewedBy = clean(body.legalRequirementsReviewedBy, 180);
      const legalRequirementsReference = clean(body.legalRequirementsReference, 300);
      const applicableRequirementsSummary = clean(body.applicableRequirementsSummary, 4000);
      const officialSourceReferences = normalizeOfficialSourceReferences(body.officialSourceReferences);
      const legalProfessionalReviewStatus = clean(body.legalProfessionalReviewStatus, 80);
      const insurerApprovedAt = clean(body.insurerApprovedAt, 10);
      const insurerValidThrough = clean(body.insurerValidThrough, 10);
      const insurerApprovedBy = clean(body.insurerApprovedBy, 180);
      const insurerReference = clean(body.insurerReference, 300);
      if (!isServiceCode(serviceCode) || serviceCode === "general_auto_repair") {
        return Response.json({ error: "Choose one exact v0.11 service. General auto repair can never be activated." }, { status: 400 });
      }
      const servicePolicy = SERVICE_POLICY_CATALOG[serviceCode];
      if (servicePolicy.launchState !== "enabled" || !servicePolicy.customerVisible) {
        return Response.json({
          error: "This service is still disabled in the reviewed v0.11 policy catalog. Written approvals must first be reflected in the deployed exact-service policy before an owner can record live activation.",
        }, { status: 409 });
      }
      if (
        jurisdiction !== POLICY_JURISDICTION
        || !PROVIDER_POLICY_MATRIX.services[serviceCode].jurisdictions.includes(jurisdiction)
      ) {
        return Response.json({ error: "This service is not in the selected launch jurisdiction." }, { status: 400 });
      }
      if (
        !validDate(validThrough)
        || !currentThrough(validThrough)
        || !annualVerificationWindowIsValid(
          legalRequirementsReviewedAt,
          legalRequirementsValidThrough,
        )
        || !annualVerificationWindowIsValid(insurerApprovedAt, insurerValidThrough)
        || dateTime(validThrough) > dateTime(legalRequirementsValidThrough)
        || dateTime(validThrough) > dateTime(insurerValidThrough)
        || !insurerApprovedBy
        || !insurerReference
        || body.explicitConfirmation !== true
      ) {
        return Response.json({
          error: "Activation requires separate current legal-review and insurer valid-through dates of no more than one year, and the service activation cannot extend beyond either one.",
        }, { status: 400 });
      }
      const legalComplianceContext = {
        legalRequirementsServiceCode: serviceCode,
        legalRequirementsJurisdiction: jurisdiction,
        legalRequirementsReviewedAt,
        legalRequirementsValidThrough,
        legalRequirementsReviewedBy,
        legalRequirementsReference,
        applicableRequirementsSummary,
        officialSourceReferences,
        ownerLegalComplianceAcknowledged: body.ownerLegalComplianceAcknowledged === true,
        legalProfessionalReviewStatus,
        explicitProceedingWithoutCounsel: body.explicitProceedingWithoutCounsel === true,
      };
      if (
        !LEGAL_PROFESSIONAL_REVIEW_STATUSES.includes(
          legalProfessionalReviewStatus as (typeof LEGAL_PROFESSIONAL_REVIEW_STATUSES)[number],
        )
        || !hasCompleteMandatoryLegalComplianceEvidence(legalComplianceContext, {
          serviceCode,
          jurisdiction,
        }, dateTime(validThrough))
        || (
          legalProfessionalReviewStatus === "not_obtained_owner_proceeding"
          && body.explicitProceedingWithoutCounsel !== true
        )
      ) {
        return Response.json({
          error: "Record who reviewed the applicable requirements, a real internal reference, a useful requirements summary, at least one official HTTPS .gov source, the professional-review choice, and the owner acknowledgement. Choosing no counsel is not legal approval.",
        }, { status: 400 });
      }
      const prior = await db.select().from(serviceActivationDecisions).where(and(
        eq(serviceActivationDecisions.providerId, PLATFORM_PROVIDER_ID),
        eq(serviceActivationDecisions.personId, ""),
        eq(serviceActivationDecisions.serviceCode, serviceCode),
        eq(serviceActivationDecisions.jurisdiction, jurisdiction),
        eq(serviceActivationDecisions.stage, CONFIGURATION_STAGE),
      )).orderBy(desc(serviceActivationDecisions.decisionVersion)).limit(1);
      const now = new Date().toISOString();
      const activationId = crypto.randomUUID();
      const releaseDecision = await runtimeProviderActivationPrerequisitesDecision();
      if (!releaseDecision.approved) {
        return Response.json({
          error: "Launch readiness changed during review. The service was not activated; refresh every required gate and try again.",
        }, { status: 409, headers: { "cache-control": "no-store" } });
      }
      // A replacement activation has a new immutable decision ID. Retire any
      // Checkout Session bound to the prior activation before publishing it.
      await expireOpenCheckoutSessionsForLaunchShutdown();
      await db.insert(serviceActivationDecisions).values({
        id: activationId,
        providerId: PLATFORM_PROVIDER_ID,
        personId: "",
        serviceCode,
        jurisdiction,
        stage: CONFIGURATION_STAGE,
        decisionVersion: (prior[0]?.decisionVersion ?? 0) + 1,
        decision: "enabled_live",
        reasonCodes: JSON.stringify([
          "mandatory_legal_compliance_evidence_recorded",
          "owner_professional_review_choice_recorded",
          "written_insurer_approval_recorded",
        ]),
        requirementVersions: JSON.stringify({ policyVersion: POLICY_VERSION }),
        jobContext: JSON.stringify({
          ...legalComplianceContext,
          explicitProceedingWithoutCounsel: body.explicitProceedingWithoutCounsel === true,
          insurerApprovedAt,
          insurerValidThrough,
          insurerApprovedBy,
          insurerReference,
          explicitOwnerConfirmation: true,
          confirmedAt: now,
          launchReadinessCheckedAt: releaseDecision.checkedAt,
          launchReadinessDecisionIds: releaseDecision.decisionIds,
        }),
        policyVersion: POLICY_VERSION,
        rulesEngineVersion: PLATFORM_SERVICE_ACTIVATION_RULES_VERSION,
        decisionSource: "owner_mandatory_compliance_and_insurance_evidence",
        decidedBy: actorId,
        decidedAt: now,
        validThrough,
        supersedesDecisionId: prior[0]?.id ?? "",
        createdAt: now,
      });
      await recordProviderAuditEvent({
        providerId: PLATFORM_PROVIDER_ID,
        serviceCode,
        jurisdiction,
        eventType: "platform_service_activated",
        entityType: "service_activation_decision",
        entityId: activationId,
        actorType: "verified_owner",
        actorId,
        outcome: "enabled_live",
        reasonCodes: [
          "mandatory_legal_compliance_evidence_recorded",
          "owner_professional_review_choice_recorded",
          "written_insurer_approval_recorded",
        ],
        metadata: {
          validThrough,
          legalRequirementsServiceCode: serviceCode,
          legalRequirementsJurisdiction: jurisdiction,
          legalRequirementsReviewedAt,
          legalRequirementsValidThrough,
          legalRequirementsReviewedBy,
          legalRequirementsReference,
          officialSourceReferences,
          legalProfessionalReviewStatus,
          insurerApprovedAt,
          insurerValidThrough,
          insurerApprovedBy,
          insurerReference,
          launchReadinessCheckedAt: releaseDecision.checkedAt,
          launchReadinessDecisionIds: releaseDecision.decisionIds,
        },
      });
      const recalculated = await recalculateProvidersForService(serviceCode, actorId);
      await expireOpenCheckoutSessionsForLaunchShutdown();
      return Response.json({
        ok: true,
        message: `The exact service is live through ${validThrough}. Qualified applications were recalculated automatically.`,
        affectedProviders: recalculated.length,
        autoVerifiedProviders: recalculated.filter((item) => item.autoVerified).length,
      });
    }

    if (action === "disable-service") {
      const serviceCode = clean(body.serviceCode, 100);
      const jurisdiction = clean(body.jurisdiction, 100);
      const reason = clean(body.reason, 600);
      if (!isServiceCode(serviceCode) || serviceCode === "general_auto_repair" || jurisdiction !== POLICY_JURISDICTION) {
        return Response.json({ error: "Choose one recognized exact service in the launch jurisdiction." }, { status: 400 });
      }
      if (!reason || body.explicitConfirmation !== true) {
        return Response.json({ error: "Record a disable reason and confirm the service hold." }, { status: 400 });
      }
      const prior = await db.select().from(serviceActivationDecisions).where(and(
        eq(serviceActivationDecisions.providerId, PLATFORM_PROVIDER_ID),
        eq(serviceActivationDecisions.personId, ""),
        eq(serviceActivationDecisions.serviceCode, serviceCode),
        eq(serviceActivationDecisions.jurisdiction, jurisdiction),
        eq(serviceActivationDecisions.stage, CONFIGURATION_STAGE),
      )).orderBy(desc(serviceActivationDecisions.decisionVersion)).limit(1);
      await expireOpenCheckoutSessionsForLaunchShutdown();
      const now = new Date().toISOString();
      const decisionId = crypto.randomUUID();
      await db.insert(serviceActivationDecisions).values({
        id: decisionId,
        providerId: PLATFORM_PROVIDER_ID,
        personId: "",
        serviceCode,
        jurisdiction,
        stage: CONFIGURATION_STAGE,
        decisionVersion: (prior[0]?.decisionVersion ?? 0) + 1,
        decision: "disabled",
        reasonCodes: JSON.stringify(["owner_service_hold"]),
        jobContext: JSON.stringify({ reason, confirmedAt: now }),
        policyVersion: POLICY_VERSION,
        rulesEngineVersion: PLATFORM_SERVICE_ACTIVATION_RULES_VERSION,
        decisionSource: "owner_service_hold",
        decidedBy: actorId,
        decidedAt: now,
        supersedesDecisionId: prior[0]?.id ?? "",
        createdAt: now,
      });
      await recordProviderAuditEvent({
        providerId: PLATFORM_PROVIDER_ID,
        serviceCode,
        jurisdiction,
        eventType: "platform_service_disabled",
        entityType: "service_activation_decision",
        entityId: decisionId,
        actorType: "verified_owner",
        actorId,
        outcome: "disabled",
        reasonCodes: ["owner_service_hold"],
        metadata: { reason },
      });
      const recalculated = await recalculateProvidersForService(serviceCode, actorId);
      await expireOpenCheckoutSessionsForLaunchShutdown();
      return Response.json({
        ok: true,
        message: "The service was disabled and every affected provider was recalculated.",
        affectedProviders: recalculated.length,
      });
    }

    return Response.json({ error: "Choose a supported compliance action." }, { status: 400 });
  } catch (error) {
    console.error("Unable to update provider compliance", error);
    return Response.json({ error: "Unable to save this compliance decision." }, { status: 500 });
  }
}
