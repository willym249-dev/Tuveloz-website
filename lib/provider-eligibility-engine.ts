import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "../db";
import {
  agreementAcceptances,
  evidenceFileScans,
  jobAuthorizationSnapshots,
  providerApplications,
  providerAuditEvents,
  providerEvidenceSubmissions,
  providerPathwayProfiles,
  providerPersonnel,
  providerServiceEligibility,
  serviceActivationDecisions,
  supervisionCheckpoints,
} from "../db/schema";
import {
  MARKETPLACE_MODE,
  marketplaceActionAllowed,
  type MarketplaceAction,
} from "./launch-status";
import {
  evaluateJobScopeFacts,
  jobScopeFactsSnapshot,
} from "./job-scope-facts";
import {
  PROVIDER_ARRIVAL_CONFIRMATION_VERSION,
  providerArrivalConfirmationIsFresh,
} from "./provider-arrival-confirmation";
import {
  annualComplianceReviewWindowIsValid,
  hasCompleteMandatoryLegalComplianceEvidence,
} from "./legal-compliance-evidence";
import {
  employeeTraineeProviderOfRecordApproval,
  runtimeRealMarketplaceReleaseDecision,
} from "./runtime-launch-readiness";
import { PLATFORM_SERVICE_ACTIVATION_RULES_VERSION } from "./platform-service-activation";
import {
  MARKETPLACE_CONDUCT_VERSION,
  PAYMENT_POLICY_VERSION,
  PRIVACY_VERSION,
  PROVISIONAL_PROVIDER_POLICY_VERSION,
  PROVIDER_AGREEMENT_VERSION,
  TERMS_VERSION,
} from "./policies";
import {
  PROVIDER_ACCEPTANCE_DOCUMENTS,
  providerAgreementEvidenceText,
  sha256Text,
} from "./provider-policy-acceptance";
import {
  evidenceAuthenticityIsCurrent,
  externalIdentityAgeVerificationIsCurrent,
} from "./provider-verification-evidence";
import {
  getEvidenceRequirements,
  isPathwayLevelCompatible,
  isProviderLevel,
  isProviderPathway,
  isServiceCode,
  providerLevelForService,
  POLICY_JURISDICTION,
  POLICY_VERSION,
  PROVIDER_POLICY_MATRIX,
  SERVICE_POLICY_CATALOG,
  type EvidenceRequirementCode,
  type ProviderLevel,
  type ProviderPathway,
  type ServiceCode,
} from "./provider-policy";
import { parseProviderServices } from "./service-matching";

export const ELIGIBILITY_RULES_VERSION = "0.15.0";
export const PLATFORM_ACTIVATION_PROVIDER_ID = "__tuveloz_platform__";

export const JOB_FACTS_SOURCES = [
  "authorized_scope",
  "provider_arrival",
  "provider_arrival_recheck",
] as const;
export type JobFactsSource = (typeof JOB_FACTS_SOURCES)[number];

export const ELIGIBILITY_STAGES = [
  "discovery",
  "quote",
  "booking",
  "job_start",
  "scope_change",
  "completion",
  "payout",
] as const;

export type EligibilityStage = (typeof ELIGIBILITY_STAGES)[number];

const REQUIRED_PROVIDER_AGREEMENTS = {
  terms: TERMS_VERSION,
  provider_agreement: PROVIDER_AGREEMENT_VERSION,
  privacy: PRIVACY_VERSION,
  payment_policy: PAYMENT_POLICY_VERSION,
  marketplace_conduct: MARKETPLACE_CONDUCT_VERSION,
  provisional_provider_policy: PROVISIONAL_PROVIDER_POLICY_VERSION,
} as const;

const PERSON_BOUND_EVIDENCE = new Set<EvidenceRequirementCode>([
  "md_locksmith_technician_registration",
  "mva_inspection_mechanic_license",
  "epa_section_609_certificate",
  "provisional_service_competency",
  "sponsored_personnel_roster",
  "sponsored_employment_attestation",
  "provider_personnel_roster",
  "provider_employee_record",
]);

const CALCULATED_REQUIREMENTS = new Set<EvidenceRequirementCode>([
  "performing_person_service_eligibility_snapshot",
  "qualified_supervisor_assignment",
  "direct_supervision_checkpoint_record",
]);

type EligibilityReason = {
  code: string;
  detail: string;
  serviceCode?: ServiceCode;
  evidenceType?: EvidenceRequirementCode;
};

export type ProviderServiceEvaluation = {
  allowed: boolean;
  serviceCode: ServiceCode;
  pathway: ProviderPathway | null;
  providerLevel: ProviderLevel | null;
  personId: string;
  reasons: EligibilityReason[];
  evidenceIds: string[];
  agreementVersions: Record<string, string>;
  validThrough: string;
  activationDecisionId: string;
};

export type StageEligibilityInput = {
  stage: EligibilityStage;
  providerId: string;
  serviceCodes: readonly unknown[];
  jurisdiction?: string;
  personId?: string;
  supervisorPersonId?: string;
  scheduledFor?: string;
  requestId?: string;
  quoteId?: string;
  scopeVersion?: number;
  assignmentVersion?: number;
  customerProviderDisclosureAcceptedAt?: string;
  jobFacts?: unknown;
  jobFactsSource?: JobFactsSource;
  jobFactsConfirmedAt?: string;
  jobFactsConfirmationVersion?: string;
  jobFactsBindingReasons?: readonly { code: string; detail: string }[];
  effectiveAt?: string;
  testOnly?: boolean;
  persist?: boolean;
};

export type StageEligibilityResult = {
  allowed: boolean;
  stage: EligibilityStage;
  decisionId: string;
  serviceCodes: ServiceCode[];
  pathway: ProviderPathway | null;
  providerLevel: ProviderLevel | null;
  personId: string;
  supervisorPersonId: string;
  reasons: EligibilityReason[];
  evidenceIds: string[];
  activationDecisionIds: string[];
  launchReadinessDecisionIds: string[];
  launchReadinessCheckedAt: string;
  agreementVersions: Record<string, string>;
  validThrough: string;
  jobFactsHash: string;
  jobFactsSource: JobFactsSource | "";
  locationRuleResults: Record<string, string>;
  scopeCheckResult: string;
  effectiveAt: string;
};

function parsedDate(value: string | undefined) {
  if (!value) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time) : null;
}

function dateIsCurrentThrough(value: string, through: Date) {
  if (!value) return false;
  const time = Date.parse(value.includes("T") ? value : `${value}T23:59:59.999Z`);
  return Number.isFinite(time) && time >= through.getTime();
}

function dateIsEffectiveBy(value: string, through: Date) {
  if (!value) return false;
  const time = Date.parse(value.includes("T") ? value : `${value}T00:00:00.000Z`);
  return Number.isFinite(time) && time <= through.getTime();
}

function completeInsurerApproval(
  context: Record<string, unknown>,
  through: Date,
) {
  const approvedAt = context.insurerApprovedAt;
  const validThrough = context.insurerValidThrough;
  const approvedBy = context.insurerApprovedBy;
  const reference = context.insurerReference;
  return typeof approvedAt === "string"
    && typeof validThrough === "string"
    && annualComplianceReviewWindowIsValid(approvedAt, validThrough, through)
    && typeof approvedBy === "string"
    && Boolean(approvedBy.trim())
    && typeof reference === "string"
    && Boolean(reference.trim());
}

function latestNonemptyDate(values: string[]) {
  const valid = values
    .filter(Boolean)
    .map((value) => ({ value, time: Date.parse(value.includes("T") ? value : `${value}T23:59:59.999Z`) }))
    .filter((item) => Number.isFinite(item.time))
    .sort((a, b) => a.time - b.time);
  return valid[0]?.value ?? "";
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

function stageToMarketplaceAction(stage: EligibilityStage): MarketplaceAction {
  if (stage === "discovery") return "discovery";
  if (stage === "quote") return "quote";
  if (stage === "booking") return "booking";
  if (stage === "job_start") return "job_start";
  if (stage === "scope_change") return "scope_change";
  if (stage === "completion") return "completion";
  return "payout";
}

function needsAssignedPerson(stage: EligibilityStage) {
  return ["booking", "job_start", "scope_change", "completion", "payout"].includes(stage);
}

function needsSupervisionCheckpoint(stage: EligibilityStage) {
  return stage === "job_start" || stage === "completion" || stage === "payout";
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function platformActivationFor(
  serviceCode: ServiceCode,
  jurisdiction: string,
  through: Date,
  testOnly: boolean,
) {
  const rows = await getDb().select().from(serviceActivationDecisions)
    .where(and(
      eq(serviceActivationDecisions.providerId, PLATFORM_ACTIVATION_PROVIDER_ID),
      eq(serviceActivationDecisions.personId, ""),
      eq(serviceActivationDecisions.serviceCode, serviceCode),
      eq(serviceActivationDecisions.jurisdiction, jurisdiction),
      eq(serviceActivationDecisions.stage, "configuration"),
    ))
    .orderBy(desc(serviceActivationDecisions.decisionVersion))
    .limit(1);
  const activation = rows[0];
  if (!activation) return null;
  if (activation.policyVersion !== POLICY_VERSION) return null;
  if (activation.rulesEngineVersion !== PLATFORM_SERVICE_ACTIVATION_RULES_VERSION) return null;
  if (testOnly && activation.decision !== "enabled_test" && activation.decision !== "enabled_live") {
    return null;
  }
  if (!testOnly && activation.decision !== "enabled_live") return null;
  if (!testOnly && !dateIsCurrentThrough(activation.validThrough, through)) return null;
  if (testOnly && activation.validThrough && !dateIsCurrentThrough(activation.validThrough, through)) return null;
  const context = parseJsonObject(activation.jobContext);
  const activationThroughValue = Date.parse(
    activation.validThrough.includes("T")
      ? activation.validThrough
      : `${activation.validThrough}T23:59:59.999Z`,
  );
  const activationThrough = Number.isFinite(activationThroughValue)
    ? new Date(activationThroughValue)
    : null;
  const hasRequiredActivationEvidence = (
    activationThrough !== null
    && hasCompleteMandatoryLegalComplianceEvidence(context, {
      serviceCode,
      jurisdiction,
    }, activationThrough)
    && completeInsurerApproval(context, activationThrough)
  );
  return testOnly || hasRequiredActivationEvidence ? activation : null;
}

async function evaluateOneService(options: {
  providerId: string;
  personId: string;
  supervisorPersonId: string;
  serviceCode: ServiceCode;
  jurisdiction: string;
  through: Date;
  stage: EligibilityStage;
  testOnly: boolean;
}) : Promise<ProviderServiceEvaluation> {
  const reasons: EligibilityReason[] = [];
  const evidenceIds: string[] = [];
  const agreementVersions: Record<string, string> = {};
  const db = getDb();
  const [providerRows, profileRows] = await Promise.all([
    db.select().from(providerApplications)
      .where(eq(providerApplications.id, options.providerId)).limit(1),
    db.select().from(providerPathwayProfiles)
      .where(eq(providerPathwayProfiles.providerId, options.providerId))
      .orderBy(desc(providerPathwayProfiles.pathwayVersion)).limit(1),
  ]);
  const provider = providerRows[0];
  const profile = profileRows[0];
  const pathway = profile && isProviderPathway(profile.relationshipPath)
    ? profile.relationshipPath
    : null;
  // The level is a property of this exact service, not of the provider, so one
  // provider business may hold services across levels at once. The profile's
  // stored level is only a summary for display; it never authorizes work.
  // Every service still stands on its own credential evidence below.
  const serviceLevel = pathway
    ? providerLevelForService(options.serviceCode, pathway)
    : null;
  const profileLevel = profile && isProviderLevel(profile.providerLevel)
    ? profile.providerLevel
    : null;
  const providerLevel = serviceLevel ?? profileLevel;

  if (!provider || provider.status !== "approved" || provider.verificationStatus !== "verified") {
    reasons.push({ code: "provider_account_not_active", detail: "The provider business is not active and verified." });
  }
  if (!profile || profile.status !== "active") {
    reasons.push({ code: "pathway_not_active", detail: "The provider pathway has not been activated." });
  }
  if (!profile || profile.policyVersion !== POLICY_VERSION) {
    reasons.push({ code: "pathway_policy_not_current", detail: "The provider pathway is not on the current policy version." });
  }
  if (!pathway) reasons.push({ code: "pathway_missing", detail: "A recognized provider pathway is required." });
  if (!providerLevel) reasons.push({ code: "provider_level_missing", detail: "A recognized provider level is required." });
  // An applicant-only account is blocked for every service regardless of which
  // level the requested service itself would need.
  if (providerLevel === "learning_account" || profileLevel === "learning_account") {
    reasons.push({ code: "learning_account_no_jobs", detail: "Applicant-only accounts receive no TUVELOZ training, employment, or customer work." });
  }
  if (pathway && providerLevel && !isPathwayLevelCompatible(pathway, providerLevel)) {
    reasons.push({ code: "pathway_level_incompatible", detail: "The pathway and provider level are incompatible." });
  }
  if (pathway === "independent_startup" && profile?.registrationHolderId !== options.providerId) {
    reasons.push({ code: "owner_operator_registration_binding_missing", detail: "The independent owner-operator must be the registered provider business for this pathway." });
  }

  let providerOfRecordGateValidThrough = "";
  if (pathway === "sponsored_trainee_employee" || pathway === "provider_business_employee") {
    // The provider-of-record model opens only while its launch gate holds a
    // complete approval from the outside authorities (official legal source,
    // insurer, CPA) through the scheduled work time. No gate, no employee or
    // trainee work — every person-level check below still applies on top.
    const providerOfRecordGate = await employeeTraineeProviderOfRecordApproval(
      options.through.getTime(),
    );
    providerOfRecordGateValidThrough = providerOfRecordGate.validThrough;
    if (!providerOfRecordGate.approved) {
      reasons.push({
        code: "provider_of_record_model_not_approved",
        detail: "Employee and trainee work stays blocked until the employee-and-trainee provider-of-record gate holds current official legal, insurer, and tax approval through the scheduled work time.",
        serviceCode: options.serviceCode,
      });
    }
    const sponsorProviderId = profile?.sponsoringProviderId ?? "";
    if (
      !sponsorProviderId
      || sponsorProviderId === options.providerId
      || profile?.registrationHolderId !== sponsorProviderId
    ) {
      reasons.push({ code: "sponsoring_provider_binding_missing", detail: "A different registered provider business must be bound as the employer and provider of record." });
    } else {
      const [sponsorProvider] = await db.select().from(providerApplications)
        .where(eq(providerApplications.id, sponsorProviderId)).limit(1);
      if (
        !sponsorProvider
        || sponsorProvider.status !== "approved"
        || sponsorProvider.verificationStatus !== "verified"
        || sponsorProvider.isTestProvider === "yes"
      ) {
        reasons.push({ code: "sponsoring_provider_not_active", detail: "The sponsoring provider business is not active and verified." });
      }
      const sponsorEligibilityRows = await db.select().from(providerServiceEligibility)
        .where(and(
          eq(providerServiceEligibility.providerId, sponsorProviderId),
          eq(providerServiceEligibility.serviceCode, options.serviceCode),
          eq(providerServiceEligibility.jurisdiction, options.jurisdiction),
          eq(providerServiceEligibility.eligibilityState, "eligible"),
        ));
      const sponsorEligibility = sponsorEligibilityRows.find((item) => (
        item.policyVersion === POLICY_VERSION
        && dateIsCurrentThrough(item.validThrough, options.through)
      ));
      if (
        !sponsorEligibility
        || !parseProviderServices(sponsorProvider?.approvedServices ?? "").includes(options.serviceCode)
      ) {
        reasons.push({
          code: "sponsoring_provider_not_eligible_for_exact_service",
          detail: "The sponsoring provider business is not currently eligible for this exact service through the scheduled work time.",
          serviceCode: options.serviceCode,
        });
      }
    }
  }

  const service = SERVICE_POLICY_CATALOG[options.serviceCode];
  if (options.serviceCode === "general_auto_repair") {
    reasons.push({
      code: "broad_service_prohibited",
      detail: "General auto repair is prohibited; choose an exact service code.",
      serviceCode: options.serviceCode,
    });
  }
  if (service.launchState !== "enabled" || !service.customerVisible) {
    reasons.push({
      code: "service_not_enabled_by_policy_catalog",
      detail: "The exact service remains disabled in the deployed policy catalog.",
      serviceCode: options.serviceCode,
    });
  }
  const jurisdictions = PROVIDER_POLICY_MATRIX.services[options.serviceCode].jurisdictions;
  if (!jurisdictions.includes(options.jurisdiction)) {
    reasons.push({ code: "jurisdiction_not_allowed", detail: "This service is not approved for the job jurisdiction.", serviceCode: options.serviceCode });
  }
  if (pathway && !service.allowedPathways.includes(pathway)) {
    reasons.push({ code: "pathway_not_allowed_for_service", detail: "This pathway cannot perform the selected service.", serviceCode: options.serviceCode });
  }
  // The service must name a lawful level on this pathway. Because the level is
  // resolved from the service itself, this denies exactly the services no level
  // on the pathway may perform, instead of denying a lawful service because the
  // provider's other work sits at a different level.
  if (pathway && !serviceLevel) {
    reasons.push({ code: "level_not_allowed_for_service", detail: "This provider level cannot perform the selected service.", serviceCode: options.serviceCode });
  }

  const activation = await platformActivationFor(
    options.serviceCode,
    options.jurisdiction,
    options.through,
    options.testOnly,
  );
  if (!activation) {
    reasons.push({
      code: "service_not_activated",
      detail: "The exact service has not received the required official legal-compliance evidence and insurance activation.",
      serviceCode: options.serviceCode,
    });
  }
  const activationContext = activation ? parseJsonObject(activation.jobContext) : {};
  const activationLegalValidThrough = typeof activationContext.legalRequirementsValidThrough === "string"
    ? activationContext.legalRequirementsValidThrough
    : "";
  const activationInsurerValidThrough = typeof activationContext.insurerValidThrough === "string"
    ? activationContext.insurerValidThrough
    : "";

  const acceptances = await db.select().from(agreementAcceptances)
    .where(eq(agreementAcceptances.providerId, options.providerId));
  for (const [key, version] of Object.entries(REQUIRED_PROVIDER_AGREEMENTS)) {
    const requiredDocument = PROVIDER_ACCEPTANCE_DOCUMENTS.find((document) => document.key === key);
    const expectedText = requiredDocument ? providerAgreementEvidenceText(requiredDocument) : "";
    const expectedHash = expectedText ? await sha256Text(expectedText) : "";
    const acceptance = acceptances.find((item) => (
      item.agreementKey === key
      && item.agreementVersion === version
      && Boolean(item.acceptedAt)
      && item.agreementText === expectedText
      && item.agreementHash === expectedHash
    ));
    if (!acceptance) {
      reasons.push({ code: "agreement_not_current", detail: `Current ${key.replaceAll("_", " ")} acceptance is required.` });
    } else {
      agreementVersions[key] = version;
    }
  }

  let person: typeof providerPersonnel.$inferSelect | undefined;
  if (options.personId) {
    const rows = await db.select().from(providerPersonnel)
      .where(and(
        eq(providerPersonnel.providerId, options.providerId),
        eq(providerPersonnel.personId, options.personId),
        eq(providerPersonnel.status, "active"),
      )).limit(1);
    person = rows[0];
  }
  if (needsAssignedPerson(options.stage) && !person) {
    reasons.push({ code: "performing_person_not_active", detail: "An active, verified performing person must be assigned." });
  }
  if (person && (!person.identityVerifiedAt || !person.ageVerifiedAt)) {
    reasons.push({ code: "performer_identity_age_not_verified", detail: "The performing person's identity and adult status are not verified." });
  }
  if (
    person
    && !options.testOnly
    && !externalIdentityAgeVerificationIsCurrent(person, options.through)
  ) {
    reasons.push({
      code: "performer_external_identity_age_verification_not_current",
      detail: "The performing person's identity and adult status must have current external verification through the scheduled work time.",
    });
  }
  if (pathway === "independent_startup" && person && person.relationshipType !== "owner_operator") {
    reasons.push({ code: "owner_operator_mismatch", detail: "An independent startup job must be performed by its verified owner-operator." });
  }
  if (pathway === "independent_startup" && profile?.providerPersonId && options.personId !== profile.providerPersonId) {
    reasons.push({ code: "owner_operator_binding_mismatch", detail: "The assigned person is not the pathway's verified owner-operator." });
  }
  if ((pathway === "sponsored_trainee_employee" || pathway === "provider_business_employee") && person) {
    const expectedRelationship = pathway === "sponsored_trainee_employee" ? "trainee" : "employee";
    if (person.relationshipType !== expectedRelationship) {
      reasons.push({ code: "employee_relationship_missing", detail: "The worker must be a genuine employee of the provider business." });
    }
    if (
      !person.employmentStartedAt
      || !dateIsEffectiveBy(person.employmentStartedAt, options.through)
      || (person.employmentEndedAt && !dateIsCurrentThrough(person.employmentEndedAt, options.through))
      || !person.employerAttestedAt
      || !person.workAuthorizationAttestedAt
      || !person.lawfulPayAttestedAt
      || !person.employerAttestedByPersonId
    ) {
      reasons.push({ code: "employment_attestations_missing", detail: "Employer work-authorization, employment, and lawful-pay attestations are incomplete." });
    }
  }

  let supervisor: typeof providerPersonnel.$inferSelect | undefined;
  if (pathway === "sponsored_trainee_employee" && needsAssignedPerson(options.stage)) {
    if (!options.supervisorPersonId || options.supervisorPersonId === options.personId) {
      reasons.push({ code: "qualified_supervisor_missing", detail: "A separate qualified supervisor must be assigned." });
    } else {
      const rows = await db.select().from(providerPersonnel)
        .where(and(
          eq(providerPersonnel.providerId, options.providerId),
          eq(providerPersonnel.personId, options.supervisorPersonId),
          eq(providerPersonnel.status, "active"),
        )).limit(1);
      supervisor = rows[0];
      if (!supervisor || supervisor.personnelRole !== "supervisor" || !supervisor.identityVerifiedAt || !supervisor.ageVerifiedAt) {
        reasons.push({ code: "qualified_supervisor_not_active", detail: "The assigned supervisor is not active and qualified." });
      } else if (
        !options.testOnly
        && !externalIdentityAgeVerificationIsCurrent(supervisor, options.through)
      ) {
        reasons.push({
          code: "qualified_supervisor_external_identity_age_verification_not_current",
          detail: "The assigned supervisor's identity and adult status must have current external verification through the scheduled work time.",
        });
      }
    }
  }

  const requirements = pathway
    ? getEvidenceRequirements(options.serviceCode, pathway)
    : [];
  const evidenceRows = requirements.length
    ? await db.select().from(providerEvidenceSubmissions)
      .where(and(
        eq(providerEvidenceSubmissions.providerId, options.providerId),
        eq(providerEvidenceSubmissions.jurisdiction, options.jurisdiction),
        inArray(providerEvidenceSubmissions.requirementKey, [...requirements]),
        eq(providerEvidenceSubmissions.status, "accepted"),
      ))
    : [];
  const fileEvidenceIds = evidenceRows
    .filter((item) => Boolean(item.storageKey))
    .map((item) => item.id);
  const scanRows = fileEvidenceIds.length
    ? await db.select().from(evidenceFileScans)
      .where(inArray(evidenceFileScans.evidenceSubmissionId, fileEvidenceIds))
      .orderBy(desc(evidenceFileScans.requestedAt))
    : [];
  const latestScanByEvidence = new Map<string, typeof evidenceFileScans.$inferSelect>();
  for (const scan of scanRows) {
    if (!latestScanByEvidence.has(scan.evidenceSubmissionId)) {
      latestScanByEvidence.set(scan.evidenceSubmissionId, scan);
    }
  }
  const evidenceExpirations: string[] = [];
  for (const requirement of requirements) {
    if (CALCULATED_REQUIREMENTS.has(requirement)) continue;
    const requiresPerson = PERSON_BOUND_EVIDENCE.has(requirement);
    const matching = evidenceRows
      .filter((item) => (
        item.requirementKey === requirement
        && (!item.serviceCode || item.serviceCode === options.serviceCode)
        && (!requiresPerson || (options.personId && item.personId === options.personId))
      ))
      .sort((a, b) => Date.parse(b.reviewedAt || b.createdAt) - Date.parse(a.reviewedAt || a.createdAt));
    const definition = PROVIDER_POLICY_MATRIX.evidence_types[requirement];
    const dateIsAcceptable = (item: typeof providerEvidenceSubmissions.$inferSelect) => (
      definition.requires_expiration !== true
        ? (!item.expiresAt || dateIsCurrentThrough(item.expiresAt, options.through))
        : dateIsCurrentThrough(item.expiresAt, options.through)
    );
    const passesDateAndScan = (item: typeof providerEvidenceSubmissions.$inferSelect) => (
      dateIsAcceptable(item)
      && (!item.storageKey || latestScanByEvidence.get(item.id)?.status === "clean")
    );
    const accepted = matching.find((item) => (
      passesDateAndScan(item)
      && (
        options.testOnly
        || evidenceAuthenticityIsCurrent(item, options.through)
      )
    ));
    if (!accepted) {
      const scanBlocked = matching.some((item) => (
        dateIsAcceptable(item)
        && Boolean(item.storageKey)
        && latestScanByEvidence.get(item.id)?.status !== "clean"
      ));
      const authenticityBlocked = !options.testOnly && matching.some((item) => (
        passesDateAndScan(item)
        && !evidenceAuthenticityIsCurrent(item, options.through)
      ));
      reasons.push({
        code: authenticityBlocked
          ? "evidence_authenticity_not_current"
          : scanBlocked
            ? "evidence_malware_scan_not_clean"
            : "required_evidence_missing_or_expired",
        detail: authenticityBlocked
          ? `${definition.label} does not have current external authenticity verification through the scheduled work time.`
          : scanBlocked
            ? `${definition.label} is quarantined because its latest malware scan is missing or not clean.`
            : `${definition.label} is missing, unaccepted, or not valid through the scheduled work time.`,
        serviceCode: options.serviceCode,
        evidenceType: requirement,
      });
    } else {
      evidenceIds.push(accepted.id);
      if (accepted.expiresAt) evidenceExpirations.push(accepted.expiresAt);
      if (!options.testOnly && accepted.authenticityValidThrough) {
        evidenceExpirations.push(accepted.authenticityValidThrough);
      }
    }
  }

  if (
    pathway === "sponsored_trainee_employee"
    && needsSupervisionCheckpoint(options.stage)
    && options.personId
    && options.supervisorPersonId
  ) {
    const checkpointTypes = options.stage === "job_start"
      ? ["pre_job"]
      : ["pre_job", "completion"];
    if (options.stage === "payout") checkpointTypes.push("completion");
    if (checkpointTypes.length) {
      const checkpoints = await db.select().from(supervisionCheckpoints)
        .where(and(
          eq(supervisionCheckpoints.providerId, options.providerId),
          eq(supervisionCheckpoints.performingPersonId, options.personId),
          eq(supervisionCheckpoints.supervisorPersonId, options.supervisorPersonId),
        ));
      for (const checkpointType of [...new Set(checkpointTypes)]) {
        const checkpoint = checkpoints.find((item) => (
          item.checkpointType === checkpointType
          && item.coLocationResult === "passed"
          && Boolean(item.supervisorAttestedAt)
          && Boolean(item.abilityToInterveneAttestedAt)
        ));
        if (!checkpoint) {
          reasons.push({ code: "supervision_checkpoint_missing", detail: `The ${checkpointType.replaceAll("_", " ")} supervision checkpoint has not passed.` });
        }
      }
    }
  }

  return {
    allowed: reasons.length === 0,
    serviceCode: options.serviceCode,
    pathway,
    providerLevel,
    personId: options.personId,
    reasons,
    evidenceIds,
    agreementVersions,
    validThrough: latestNonemptyDate([
      ...evidenceExpirations,
      providerOfRecordGateValidThrough,
      activation?.validThrough ?? "",
      activationLegalValidThrough,
      activationInsurerValidThrough,
      profile?.validThrough ?? "",
      !options.testOnly ? person?.identityVerificationValidThrough ?? "" : "",
      !options.testOnly ? person?.ageVerificationValidThrough ?? "" : "",
      !options.testOnly ? supervisor?.identityVerificationValidThrough ?? "" : "",
      !options.testOnly ? supervisor?.ageVerificationValidThrough ?? "" : "",
    ]),
    activationDecisionId: activation?.id ?? "",
  };
}

async function persistAuditEvent(input: {
  providerId: string;
  personId: string;
  requestId: string;
  serviceCode: string;
  jurisdiction: string;
  entityId: string;
  outcome: string;
  reasons: EligibilityReason[];
  metadata: Record<string, unknown>;
}) {
  const db = getDb();
  const previous = await db.select({ eventHash: providerAuditEvents.eventHash })
    .from(providerAuditEvents)
    .where(eq(providerAuditEvents.providerId, input.providerId))
    .orderBy(desc(providerAuditEvents.occurredAt)).limit(1);
  const occurredAt = new Date().toISOString();
  const previousEventHash = previous[0]?.eventHash ?? "";
  const eventHash = await sha256(JSON.stringify({ ...input, occurredAt, previousEventHash }));
  await db.insert(providerAuditEvents).values({
    id: crypto.randomUUID(),
    providerId: input.providerId,
    personId: input.personId,
    requestId: input.requestId,
    serviceCode: input.serviceCode,
    jurisdiction: input.jurisdiction,
    eventType: "stage_eligibility_decision",
    entityType: "job_authorization_snapshot",
    entityId: input.entityId,
    eventVersion: 1,
    actorType: "system",
    actorId: ELIGIBILITY_RULES_VERSION,
    outcome: input.outcome,
    reasonCodes: JSON.stringify(input.reasons.map((item) => item.code)),
    metadata: JSON.stringify(input.metadata),
    policyVersion: POLICY_VERSION,
    previousEventHash,
    eventHash,
    occurredAt,
    createdAt: occurredAt,
  });
}

export async function evaluateStageEligibility(
  input: StageEligibilityInput,
): Promise<StageEligibilityResult> {
  const jurisdiction = input.jurisdiction || POLICY_JURISDICTION;
  const reasons: EligibilityReason[] = [];
  const now = new Date();
  const scheduledAt = parsedDate(input.scheduledFor);
  const suppliedEffectiveAt = parsedDate(input.effectiveAt);
  if (input.effectiveAt && !suppliedEffectiveAt) {
    reasons.push({
      code: "effective_time_invalid",
      detail: "The eligibility recheck time is invalid.",
    });
  }
  const effectiveAt = suppliedEffectiveAt ?? now;
  const through = scheduledAt && scheduledAt.getTime() > effectiveAt.getTime()
    ? scheduledAt
    : effectiveAt;
  const serviceCodes: ServiceCode[] = [];
  for (const value of input.serviceCodes) {
    if (!isServiceCode(value)) {
      reasons.push({ code: "unknown_or_broad_service", detail: "Every job must use a recognized exact service code." });
      continue;
    }
    if (!serviceCodes.includes(value)) serviceCodes.push(value);
  }
  if (!serviceCodes.length) {
    reasons.push({ code: "exact_service_required", detail: "At least one exact service code is required." });
  }
  const initialReleaseDecision = input.testOnly === true
    ? null
    : await runtimeRealMarketplaceReleaseDecision();
  if (!marketplaceActionAllowed(stageToMarketplaceAction(input.stage), {
    testOnly: input.testOnly,
    runtimeReleaseApproved: initialReleaseDecision?.approved === true,
  })) {
    reasons.push({
      code: "marketplace_onboarding_only",
      detail: `Marketplace mode is ${MARKETPLACE_MODE}; real transaction actions are disabled.`,
    });
  }
  if (needsAssignedPerson(input.stage) && !input.personId) {
    reasons.push({ code: "performing_person_required", detail: "The exact performing person must be assigned before this stage." });
  }
  if (needsAssignedPerson(input.stage) && !input.scheduledFor) {
    reasons.push({ code: "scheduled_time_required", detail: "A structured scheduled work time is required before this stage." });
  }
  if (
    input.scheduledFor
    && !scheduledAt
  ) {
    reasons.push({ code: "scheduled_time_invalid", detail: "The scheduled work time is not a valid date and time." });
  }
  if (input.stage === "booking" && !input.customerProviderDisclosureAcceptedAt) {
    reasons.push({ code: "customer_assignment_acceptance_required", detail: "The customer must accept the assigned provider and performing-person disclosure." });
  }

  const jobFactsEvaluation = evaluateJobScopeFacts(serviceCodes, input.jobFacts);
  reasons.push(...jobFactsEvaluation.reasons);
  reasons.push(...(input.jobFactsBindingReasons ?? []));
  const jobFactsSnapshot = jobScopeFactsSnapshot(jobFactsEvaluation.facts);
  const jobFactsHash = jobFactsSnapshot ? await sha256(jobFactsSnapshot) : "";
  const jobFactsSource = input.jobFactsSource ?? "";
  if (input.stage === "job_start" && jobFactsSource !== "provider_arrival") {
    reasons.push({
      code: "fresh_arrival_job_facts_required",
      detail: "Actual work start requires a new provider-entered arrival-safety snapshot; stored customer facts alone are insufficient.",
    });
  }
  if (
    input.stage === "job_start"
    && (
      input.jobFactsConfirmationVersion !== PROVIDER_ARRIVAL_CONFIRMATION_VERSION
      || !providerArrivalConfirmationIsFresh(
        input.jobFactsConfirmedAt,
        effectiveAt.toISOString(),
        now.toISOString(),
        now.getTime(),
      )
    )
  ) {
    reasons.push({
      code: "provider_arrival_confirmation_missing_or_stale",
      detail: "The assigned provider must personally confirm the actual location, vehicle, operation, and safety facts immediately before work starts.",
    });
  }
  if (
    (input.stage === "completion" || input.stage === "payout")
    && jobFactsSource !== "provider_arrival_recheck"
  ) {
    reasons.push({
      code: "matching_actual_start_snapshot_required",
      detail: "Completion and payout require the valid fresh arrival snapshot bound to the current actual-start decision.",
    });
  }

  const evaluations = await Promise.all(serviceCodes.map((serviceCode) => evaluateOneService({
    providerId: input.providerId,
    personId: input.personId ?? "",
    supervisorPersonId: input.supervisorPersonId ?? "",
    serviceCode,
    jurisdiction,
    through,
    stage: input.stage,
    testOnly: input.testOnly === true,
  })));
  reasons.push(...evaluations.flatMap((item) => item.reasons));
  const evidenceIds = [...new Set(evaluations.flatMap((item) => item.evidenceIds))];
  const activationDecisionIds = [...new Set(evaluations.map((item) => item.activationDecisionId).filter(Boolean))];
  const agreementVersions = Object.assign({}, ...evaluations.map((item) => item.agreementVersions));
  const validThrough = latestNonemptyDate(evaluations.map((item) => item.validThrough));
  const pathway = evaluations.find((item) => item.pathway)?.pathway ?? null;
  const providerLevel = evaluations.find((item) => item.providerLevel)?.providerLevel ?? null;
  const finalReleaseDecision = input.testOnly === true
    ? null
    : await runtimeRealMarketplaceReleaseDecision();
  const releaseBindingChanged = Boolean(
    initialReleaseDecision
    && finalReleaseDecision
    && (
      finalReleaseDecision.decisionIds.join(",")
        !== initialReleaseDecision.decisionIds.join(",")
      || finalReleaseDecision.validThrough !== initialReleaseDecision.validThrough
    )
  );
  if (
    finalReleaseDecision
    && (
      !marketplaceActionAllowed(stageToMarketplaceAction(input.stage), {
        runtimeReleaseApproved: finalReleaseDecision.approved,
      })
      || releaseBindingChanged
    )
    && !reasons.some((reason) => reason.code === "marketplace_onboarding_only")
  ) {
    reasons.push({
      code: "launch_readiness_changed",
      detail: "Launch readiness changed while this eligibility decision was being calculated. Real work remains blocked.",
    });
  }
  const launchReadinessDecisionIds = finalReleaseDecision?.decisionIds
    ?? initialReleaseDecision?.decisionIds
    ?? [];
  const launchReadinessCheckedAt = finalReleaseDecision?.checkedAt
    ?? initialReleaseDecision?.checkedAt
    ?? "";
  const allowed = reasons.length === 0;
  let decisionId = "";

  if (input.persist && input.requestId) {
    const db = getDb();
    const previous = await db.select({ decisionVersion: jobAuthorizationSnapshots.decisionVersion })
      .from(jobAuthorizationSnapshots)
      .where(and(
        eq(jobAuthorizationSnapshots.requestId, input.requestId),
        eq(jobAuthorizationSnapshots.stage, input.stage),
        eq(jobAuthorizationSnapshots.scopeVersion, input.scopeVersion ?? 0),
        eq(jobAuthorizationSnapshots.assignmentVersion, input.assignmentVersion ?? 0),
      ))
      .orderBy(desc(jobAuthorizationSnapshots.decisionVersion)).limit(1);
    decisionId = crypto.randomUUID();
    const decidedAt = new Date().toISOString();
    await db.insert(jobAuthorizationSnapshots).values({
      id: decisionId,
      requestId: input.requestId,
      quoteId: input.quoteId ?? "",
      stage: input.stage,
      scopeVersion: input.scopeVersion ?? 0,
      assignmentVersion: input.assignmentVersion ?? 0,
      decisionVersion: (previous[0]?.decisionVersion ?? 0) + 1,
      providerId: input.providerId,
      performingPersonId: input.personId ?? "",
      supervisorPersonId: input.supervisorPersonId ?? "",
      serviceCodes: JSON.stringify(serviceCodes),
      jurisdiction,
      scheduledFor: input.scheduledFor ?? "",
      decision: allowed ? "allow" : "deny",
      reasonCodes: JSON.stringify(reasons.map((item) => item.code)),
      eligibilitySnapshotIds: "[]",
      serviceActivationDecisionIds: JSON.stringify(activationDecisionIds),
      evidenceDecisionIds: JSON.stringify(evidenceIds),
      supervisionCheckpointIds: "[]",
      agreementVersions: JSON.stringify(agreementVersions),
      insuranceCoverageDeterminationId: "",
      locationRuleResult: JSON.stringify(jobFactsEvaluation.locationRuleResults),
      scopeCheckResult: jobFactsEvaluation.scopeCheckResult,
      jobControlProfile: JSON.stringify({
        stage: input.stage,
        effectiveAt: effectiveAt.toISOString(),
        jobFactsVersion: jobFactsEvaluation.facts?.version ?? 0,
        jobFactsHash,
        jobFactsSource,
        jobFactsConfirmationVersion: input.jobFactsConfirmationVersion ?? "",
        jobFactsConfirmedAt: input.jobFactsConfirmedAt ?? "",
        jobFactsConfirmedByProviderId:
          jobFactsSource === "provider_arrival" ? input.providerId : "",
        jobFactsConfirmedByPersonId:
          jobFactsSource === "provider_arrival" ? input.personId ?? "" : "",
        jobFactsSnapshot: jobFactsEvaluation.facts,
        launchReadinessDecisionIds,
        launchReadinessCheckedAt,
      }),
      customerProviderDisclosureAcceptedAt: input.customerProviderDisclosureAcceptedAt ?? "",
      policyVersion: POLICY_VERSION,
      rulesEngineVersion: ELIGIBILITY_RULES_VERSION,
      decidedAt,
      validThrough,
      createdAt: decidedAt,
    });
    await persistAuditEvent({
      providerId: input.providerId,
      personId: input.personId ?? "",
      requestId: input.requestId,
      serviceCode: serviceCodes.join("|"),
      jurisdiction,
      entityId: decisionId,
      outcome: allowed ? "allow" : "deny",
      reasons,
      metadata: {
        stage: input.stage,
        serviceCodes,
        policyVersion: POLICY_VERSION,
        effectiveAt: effectiveAt.toISOString(),
        jobFactsHash,
        jobFactsSource,
        jobFactsConfirmationVersion: input.jobFactsConfirmationVersion ?? "",
        jobFactsConfirmedAt: input.jobFactsConfirmedAt ?? "",
        locationRuleResults: jobFactsEvaluation.locationRuleResults,
        scopeCheckResult: jobFactsEvaluation.scopeCheckResult,
        launchReadinessDecisionIds,
        launchReadinessCheckedAt,
      },
    });
  }

  return {
    allowed,
    stage: input.stage,
    decisionId,
    serviceCodes,
    pathway,
    providerLevel,
    personId: input.personId ?? "",
    supervisorPersonId: input.supervisorPersonId ?? "",
    reasons,
    evidenceIds,
    activationDecisionIds,
    launchReadinessDecisionIds,
    launchReadinessCheckedAt,
    agreementVersions,
    validThrough,
    jobFactsHash,
    jobFactsSource,
    locationRuleResults: jobFactsEvaluation.locationRuleResults,
    scopeCheckResult: jobFactsEvaluation.scopeCheckResult,
    effectiveAt: effectiveAt.toISOString(),
  };
}

export function eligibilityErrorMessage(result: StageEligibilityResult) {
  const first = result.reasons[0];
  return first?.detail || "This provider is not currently eligible for the selected service and job stage.";
}
