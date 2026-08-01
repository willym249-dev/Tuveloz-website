import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "../db";
import {
  providerApplications,
  providerServiceEligibility,
  serviceActivationDecisions,
} from "../db/schema";
import {
  isServiceCode,
  POLICY_VERSION,
  PROVIDER_POLICY_MATRIX,
  type ServiceCode,
} from "./provider-policy";
import { evaluateJobScopeFacts } from "./job-scope-facts";
import { marketplaceActionAllowed } from "./launch-status";
import {
  annualComplianceReviewWindowIsValid,
  hasCompleteMandatoryLegalComplianceEvidence,
} from "./legal-compliance-evidence";
import { runtimeRealMarketplaceReleaseDecision } from "./runtime-launch-readiness";
import { ELIGIBILITY_RULES_VERSION } from "./provider-eligibility-engine";
import {
  PLATFORM_SERVICE_ACTIVATION_PROVIDER_ID as SHARED_PLATFORM_SERVICE_ACTIVATION_PROVIDER_ID,
  PLATFORM_SERVICE_ACTIVATION_RULES_VERSION,
  PLATFORM_SERVICE_ACTIVATION_STAGE as SHARED_PLATFORM_SERVICE_ACTIVATION_STAGE,
} from "./platform-service-activation";

export const PLATFORM_SERVICE_ACTIVATION_PROVIDER_ID =
  SHARED_PLATFORM_SERVICE_ACTIVATION_PROVIDER_ID;
export const PLATFORM_SERVICE_ACTIVATION_STAGE =
  SHARED_PLATFORM_SERVICE_ACTIVATION_STAGE;

export type AutomaticJobRoutingInput = {
  serviceCodes: readonly unknown[];
  jurisdiction: string;
  scheduledFor: string;
  jobFacts: unknown;
  /** Used only for a server-resolved repeat provider; never accept this from a public client. */
  requiredProviderId?: string;
};

export type AutomaticJobRoutingProvider = {
  providerId: string;
  name: string;
  email: string;
};

export type AutomaticJobRoutingDecision = {
  allowed: boolean;
  code:
    | "AUTOMATICALLY_APPROVED"
    | "EXACT_SERVICE_REQUIRED"
    | "BROAD_SERVICE_PROHIBITED"
    | "JURISDICTION_NOT_SUPPORTED"
    | "SCHEDULE_REQUIRED"
    | "JOB_FACTS_REQUIRED"
    | "MARKETPLACE_RELEASE_NOT_APPROVED"
    | "SERVICE_NOT_ACTIVATED"
    | "WRITTEN_APPROVALS_REQUIRED"
    | "ACTIVATION_NOT_VALID_THROUGH_SCHEDULE"
    | "NO_ELIGIBLE_PROVIDER";
  message: string;
  serviceCodes: ServiceCode[];
  jurisdiction: string;
  scheduledFor: string;
  activationDecisionIds: string[];
  launchReadinessDecisionIds: string[];
  launchReadinessCheckedAt: string;
  matchingProviders: AutomaticJobRoutingProvider[];
  unavailableServiceCode?: string;
};

type WrittenApproval = {
  approvedAt: string;
  validThrough: string;
  approvedBy: string;
  reference: string;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function nonblank(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function parseObject(value: string) {
  try {
    return asRecord(JSON.parse(value) as unknown);
  } catch {
    return {};
  }
}

/**
 * Accept the established flat activation fields and a nested representation,
 * but never infer an approval from a checkbox or from the record's existence.
 */
export function insurerApprovalFromContext(
  context: Record<string, unknown>,
): WrittenApproval {
  const nested = asRecord(context.insurer);
  return {
    approvedAt: nonblank(context.insurerApprovedAt) || nonblank(nested.approvedAt),
    validThrough: nonblank(context.insurerValidThrough) || nonblank(nested.validThrough),
    approvedBy: nonblank(context.insurerApprovedBy) || nonblank(nested.approvedBy),
    reference: nonblank(context.insurerReference) || nonblank(nested.reference),
  };
}

export function hasCompleteWrittenApproval(
  approval: WrittenApproval,
  through: number | Date = Date.now(),
  now = Date.now(),
) {
  return Boolean(
    annualComplianceReviewWindowIsValid(
      approval.approvedAt,
      approval.validThrough,
      through,
      now,
    )
    && approval.approvedBy
    && approval.reference,
  );
}

function timeValue(value: string, endOfDate = false) {
  const normalized = endOfDate && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? `${value}T23:59:59.999Z`
    : value;
  const parsed = Date.parse(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function validThroughSchedule(validThrough: string, scheduledTime: number) {
  if (!validThrough.trim()) return false;
  const validThroughTime = timeValue(validThrough, true);
  return validThroughTime !== null && validThroughTime >= scheduledTime;
}

function parseApprovedExactServices(value: string): Set<string> {
  const trimmed = value.trim();
  if (!trimmed) return new Set();
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (Array.isArray(parsed)) {
      return new Set(parsed.filter((item): item is string => (
        typeof item === "string" && item.trim().length > 0
      )).map((item) => item.trim()));
    }
  } catch {
    // Current provider records use a pipe-delimited exact-code list.
  }
  return new Set(trimmed.split("|").map((item) => item.trim()).filter(Boolean));
}

function denied(
  code: Exclude<AutomaticJobRoutingDecision["code"], "AUTOMATICALLY_APPROVED">,
  message: string,
  input: {
    serviceCodes?: ServiceCode[];
    jurisdiction: string;
    scheduledFor: string;
    activationDecisionIds?: string[];
    launchReadinessDecisionIds?: string[];
    launchReadinessCheckedAt?: string;
    unavailableServiceCode?: string;
  },
): AutomaticJobRoutingDecision {
  return {
    allowed: false,
    code,
    message,
    serviceCodes: input.serviceCodes ?? [],
    jurisdiction: input.jurisdiction,
    scheduledFor: input.scheduledFor,
    activationDecisionIds: input.activationDecisionIds ?? [],
    launchReadinessDecisionIds: input.launchReadinessDecisionIds ?? [],
    launchReadinessCheckedAt: input.launchReadinessCheckedAt ?? "",
    matchingProviders: [],
    unavailableServiceCode: input.unavailableServiceCode,
  };
}

/**
 * Determines whether a real customer request may skip per-job owner review.
 * This is intentionally narrower than provider discovery: every exact service
 * must have a current platform activation backed by mandatory official
 * legal-compliance evidence and written insurer approval, and one currently
 * approved provider must be eligible for the entire requested service set
 * through the scheduled time.
 */
export async function decideAutomaticJobRouting(
  input: AutomaticJobRoutingInput,
): Promise<AutomaticJobRoutingDecision> {
  const jurisdiction = nonblank(input.jurisdiction);
  const scheduledFor = nonblank(input.scheduledFor);
  const rawCodes = Array.isArray(input.serviceCodes) ? input.serviceCodes : [];
  const serviceCodes: ServiceCode[] = [];

  for (const rawCode of rawCodes) {
    if (typeof rawCode !== "string" || !isServiceCode(rawCode.trim())) {
      return denied(
        "EXACT_SERVICE_REQUIRED",
        "Choose a specific service from the TUVELOZ service database.",
        { jurisdiction, scheduledFor, unavailableServiceCode: nonblank(rawCode) },
      );
    }
    const serviceCode = rawCode.trim() as ServiceCode;
    if (serviceCode === "general_auto_repair") {
      return denied(
        "BROAD_SERVICE_PROHIBITED",
        "General auto repair is too broad. Choose the exact service needed.",
        { serviceCodes, jurisdiction, scheduledFor, unavailableServiceCode: serviceCode },
      );
    }
    if (!serviceCodes.includes(serviceCode)) serviceCodes.push(serviceCode);
  }

  if (serviceCodes.length === 0) {
    return denied(
      "EXACT_SERVICE_REQUIRED",
      "Choose at least one specific service from the TUVELOZ service database.",
      { jurisdiction, scheduledFor },
    );
  }

  const initialReleaseDecision = await runtimeRealMarketplaceReleaseDecision();
  if (!marketplaceActionAllowed("request", {
    runtimeReleaseApproved: initialReleaseDecision.approved,
  })) {
    return denied(
      "MARKETPLACE_RELEASE_NOT_APPROVED",
      "Real customer routing remains disabled until both launch-readiness stages are current and the marketplace release is enabled.",
      {
        serviceCodes,
        jurisdiction,
        scheduledFor,
        launchReadinessDecisionIds: initialReleaseDecision.decisionIds,
        launchReadinessCheckedAt: initialReleaseDecision.checkedAt,
      },
    );
  }

  const jobFactsEvaluation = evaluateJobScopeFacts(serviceCodes, input.jobFacts);
  if (!jobFactsEvaluation.allowed) {
    return denied(
      "JOB_FACTS_REQUIRED",
      jobFactsEvaluation.reasons[0]?.detail
        || "Complete allowed operation, location, vehicle, and safety facts are required.",
      { serviceCodes, jurisdiction, scheduledFor },
    );
  }

  for (const serviceCode of serviceCodes) {
    const servicePolicy = PROVIDER_POLICY_MATRIX.services[serviceCode];
    if (servicePolicy.launch_state !== "enabled" || !servicePolicy.customer_visible) {
      return denied(
        "SERVICE_NOT_ACTIVATED",
        "That exact service remains disabled in the deployed policy catalog.",
        { serviceCodes, jurisdiction, scheduledFor, unavailableServiceCode: serviceCode },
      );
    }
    if (!servicePolicy.jurisdictions.includes(jurisdiction)) {
      return denied(
        "JURISDICTION_NOT_SUPPORTED",
        "That exact service is not available in the selected jurisdiction.",
        { serviceCodes, jurisdiction, scheduledFor, unavailableServiceCode: serviceCode },
      );
    }
  }

  const scheduledTime = timeValue(scheduledFor);
  if (scheduledTime === null) {
    return denied(
      "SCHEDULE_REQUIRED",
      "Choose a valid requested service date and time so credentials can be checked through the job date.",
      { serviceCodes, jurisdiction, scheduledFor },
    );
  }

  const db = getDb();
  const activationDecisionIds: string[] = [];
  for (const serviceCode of serviceCodes) {
    const [activation] = await db.select().from(serviceActivationDecisions)
      .where(and(
        eq(serviceActivationDecisions.providerId, PLATFORM_SERVICE_ACTIVATION_PROVIDER_ID),
        eq(serviceActivationDecisions.personId, ""),
        eq(serviceActivationDecisions.serviceCode, serviceCode),
        eq(serviceActivationDecisions.jurisdiction, jurisdiction),
        eq(serviceActivationDecisions.stage, PLATFORM_SERVICE_ACTIVATION_STAGE),
      ))
      .orderBy(
        desc(serviceActivationDecisions.decisionVersion),
        desc(serviceActivationDecisions.decidedAt),
      )
      .limit(1);

    // A row's presence is never activation. The latest decision must be live
    // and belong to the current policy version.
    if (
      !activation
      || activation.decision !== "enabled_live"
      || activation.policyVersion !== POLICY_VERSION
      || activation.rulesEngineVersion !== PLATFORM_SERVICE_ACTIVATION_RULES_VERSION
    ) {
      return denied(
        "SERVICE_NOT_ACTIVATED",
        "That service is not currently open for customer jobs.",
        { serviceCodes, jurisdiction, scheduledFor, activationDecisionIds, unavailableServiceCode: serviceCode },
      );
    }

    const context = parseObject(activation.jobContext);
    const insurerApproval = insurerApprovalFromContext(context);
    const activationThrough = timeValue(activation.validThrough, true);
    if (
      !validThroughSchedule(activation.validThrough, scheduledTime)
      || activationThrough === null
    ) {
      return denied(
        "ACTIVATION_NOT_VALID_THROUGH_SCHEDULE",
        "That service is not approved through the requested job date.",
        { serviceCodes, jurisdiction, scheduledFor, activationDecisionIds, unavailableServiceCode: serviceCode },
      );
    }
    if (
      !hasCompleteMandatoryLegalComplianceEvidence(context, {
        serviceCode,
        jurisdiction,
      }, activationThrough)
      || !hasCompleteWrittenApproval(insurerApproval, activationThrough)
    ) {
      return denied(
        "WRITTEN_APPROVALS_REQUIRED",
        "That service is waiting for mandatory official legal-compliance evidence and written insurance approval.",
        { serviceCodes, jurisdiction, scheduledFor, activationDecisionIds, unavailableServiceCode: serviceCode },
      );
    }
    activationDecisionIds.push(activation.id);
  }

  const eligibilityRows = await db.select({
    providerId: providerServiceEligibility.providerId,
    serviceCode: providerServiceEligibility.serviceCode,
    relationshipPath: providerServiceEligibility.relationshipPath,
    eligibilityState: providerServiceEligibility.eligibilityState,
    policyVersion: providerServiceEligibility.policyVersion,
    rulesEngineVersion: providerServiceEligibility.rulesEngineVersion,
    validThrough: providerServiceEligibility.validThrough,
  }).from(providerServiceEligibility).where(and(
    inArray(providerServiceEligibility.serviceCode, serviceCodes),
    eq(providerServiceEligibility.jurisdiction, jurisdiction),
    eq(providerServiceEligibility.eligibilityState, "eligible"),
  ));

  const providersByService = new Map<ServiceCode, Set<string>>(
    serviceCodes.map((serviceCode) => [serviceCode, new Set<string>()]),
  );
  for (const eligibility of eligibilityRows) {
    if (
      !isServiceCode(eligibility.serviceCode)
      || !serviceCodes.includes(eligibility.serviceCode)
      || eligibility.eligibilityState !== "eligible"
      || eligibility.policyVersion !== POLICY_VERSION
      || eligibility.rulesEngineVersion !== ELIGIBILITY_RULES_VERSION
      || !validThroughSchedule(eligibility.validThrough, scheduledTime)
      // Employee and sponsored-trainee applications are people, not the
      // provider of record. Keep them out of automatic routing until jobs are
      // accepted/assigned under the sponsoring provider business and the
      // performing person is bound at booking.
      || eligibility.relationshipPath !== "independent_startup"
    ) continue;
    providersByService.get(eligibility.serviceCode)?.add(eligibility.providerId);
  }

  let candidateProviderIds = new Set(providersByService.get(serviceCodes[0]) ?? []);
  for (const serviceCode of serviceCodes.slice(1)) {
    const eligibleForService = providersByService.get(serviceCode) ?? new Set<string>();
    candidateProviderIds = new Set(
      [...candidateProviderIds].filter((providerId) => eligibleForService.has(providerId)),
    );
  }
  if (input.requiredProviderId) {
    candidateProviderIds = candidateProviderIds.has(input.requiredProviderId)
      ? new Set([input.requiredProviderId])
      : new Set();
  }

  if (candidateProviderIds.size === 0) {
    return denied(
      "NO_ELIGIBLE_PROVIDER",
      "No approved provider is currently eligible for every selected service through the requested job date.",
      { serviceCodes, jurisdiction, scheduledFor, activationDecisionIds },
    );
  }

  const providerRows = await db.select({
    providerId: providerApplications.id,
    name: providerApplications.name,
    email: providerApplications.email,
    approvedServices: providerApplications.approvedServices,
  }).from(providerApplications).where(and(
    inArray(providerApplications.id, [...candidateProviderIds]),
    eq(providerApplications.status, "approved"),
    eq(providerApplications.verificationStatus, "verified"),
    eq(providerApplications.isTestProvider, "no"),
  ));

  const matchingProviders = providerRows.filter((provider) => {
    const approvedServices = parseApprovedExactServices(provider.approvedServices);
    return approvedServices.size > 0
      && serviceCodes.every((serviceCode) => approvedServices.has(serviceCode));
  }).map((provider) => ({
    providerId: provider.providerId,
    name: provider.name,
    email: provider.email,
  }));

  if (matchingProviders.length === 0) {
    return denied(
      "NO_ELIGIBLE_PROVIDER",
      "No approved provider is currently eligible for every selected service through the requested job date.",
      { serviceCodes, jurisdiction, scheduledFor, activationDecisionIds },
    );
  }

  const finalReleaseDecision = await runtimeRealMarketplaceReleaseDecision();
  const releaseBindingChanged = (
    finalReleaseDecision.decisionIds.join(",")
      !== initialReleaseDecision.decisionIds.join(",")
    || finalReleaseDecision.validThrough !== initialReleaseDecision.validThrough
  );
  if (!marketplaceActionAllowed("request", {
    runtimeReleaseApproved: finalReleaseDecision.approved,
  }) || releaseBindingChanged) {
    return denied(
      "MARKETPLACE_RELEASE_NOT_APPROVED",
      "Real customer routing remains disabled because launch readiness changed during matching.",
      {
        serviceCodes,
        jurisdiction,
        scheduledFor,
        activationDecisionIds,
        launchReadinessDecisionIds: finalReleaseDecision.decisionIds,
        launchReadinessCheckedAt: finalReleaseDecision.checkedAt,
      },
    );
  }

  return {
    allowed: true,
    code: "AUTOMATICALLY_APPROVED",
    message: "This request matches an activated exact service and at least one fully eligible provider.",
    serviceCodes,
    jurisdiction,
    scheduledFor,
    activationDecisionIds,
    launchReadinessDecisionIds: finalReleaseDecision.decisionIds,
    launchReadinessCheckedAt: finalReleaseDecision.checkedAt,
    matchingProviders,
  };
}
