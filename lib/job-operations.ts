import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../db";
import {
  customerRequests,
  jobCancellations,
  jobChangeOrders,
  jobIncidents,
  jobAuthorizationSnapshots,
  jobLifecycleEvents,
  providerApplications,
  providerJobRecords,
  providerQuotes,
} from "../db/schema";
import {
  eligibilityErrorMessage,
  evaluateStageEligibility,
  type EligibilityStage,
  type JobFactsSource,
  type StageEligibilityResult,
} from "./provider-eligibility-engine";
import {
  compareArrivalJobScopeFacts,
  jobScopeFactsSnapshot,
  parseJobScopeFacts,
  type JobScopeFacts,
} from "./job-scope-facts";
import { loadAuthorizedJobScopeFacts } from "./job-scope-records";
import { isServiceCode, type ServiceCode } from "./provider-policy";

export const JOB_OPERATIONS_RULES_VERSION = "2026-07-31.2";

export type AssignedJobOperationContext = {
  requestId: string;
  quoteId: string;
  providerId: string;
  providerEmail: string;
  customerEmail: string;
  requestStatus: string;
  isTestJob: boolean;
  isTestProvider: boolean;
  serviceCodes: ServiceCode[];
  jurisdiction: string;
  scheduledFor: string;
  personId: string;
  supervisorPersonId: string;
  scopeVersion: number;
  assignmentVersion: number;
  customerProviderDisclosureAcceptedAt: string;
  jobFacts: JobScopeFacts | null;
};

export type JobStageDecision = {
  context: AssignedJobOperationContext | null;
  result: StageEligibilityResult | null;
  allowed: boolean;
  status: number;
  error: string;
};

export type PayoutReadinessInput = {
  jobCompleted: boolean;
  completionDecisionId: string;
  finalInvoiceStatus: string;
  finalInvoiceTotalCents: number;
  authorizedTotalCents: number;
  openIncidentCount: number;
  openClaimCount: number;
  unresolvedCancellationCount: number;
  unauthorizedChangeOrderCount: number;
  pendingRefundCount: number;
  approvedRefundAmountCents: number;
  openDisputeCount: number;
  activeReserveAmountCents: number;
  providerTimerRunning: boolean;
};

export type PayoutReadiness = {
  allowed: boolean;
  reasonCodes: string[];
  reasons: string[];
};

export function parseExactServiceCodes(...values: string[]) {
  const result: ServiceCode[] = [];
  for (const value of values) {
    let candidates: unknown[] = [];
    try {
      const parsed = JSON.parse(value || "[]") as unknown;
      candidates = Array.isArray(parsed) ? parsed : [];
    } catch {
      candidates = value ? value.split(",").map((item) => item.trim()) : [];
    }
    for (const candidate of candidates) {
      if (
        isServiceCode(candidate)
        && candidate !== "general_auto_repair"
        && !result.includes(candidate)
      ) {
        result.push(candidate);
      }
    }
    if (result.length) return result;
  }
  return result;
}

/**
 * Loads the accepted assignment exclusively from server records. A provider
 * email supplied by the caller is used only as an authorization constraint;
 * it never changes the assigned provider, person, service, schedule, or scope.
 */
export async function assignedJobOperationContext(
  requestId: string,
  providerEmail?: string,
): Promise<AssignedJobOperationContext | null> {
  const emailConstraint = providerEmail
    ? eq(providerQuotes.providerEmail, providerEmail)
    : undefined;
  const [job] = await getDb().select({
    requestId: customerRequests.id,
    customerEmail: customerRequests.email,
    requestStatus: customerRequests.status,
    requestServiceCodes: customerRequests.serviceCodes,
    jurisdiction: customerRequests.jurisdiction,
    requestScheduledFor: customerRequests.scheduledFor,
    isTestJob: customerRequests.isTestJob,
    assignedPersonId: customerRequests.assignedPersonId,
    assignedSupervisorPersonId: customerRequests.assignedSupervisorPersonId,
    assignmentVersion: customerRequests.assignmentVersion,
    customerProviderDisclosureAcceptedAt:
      customerRequests.customerProviderDisclosureAcceptedAt,
    quoteId: providerQuotes.id,
    quoteServiceCodes: providerQuotes.serviceCodes,
    quoteScheduledFor: providerQuotes.scheduledFor,
    quotePersonId: providerQuotes.performingPersonId,
    quoteSupervisorPersonId: providerQuotes.supervisorPersonId,
    scopeVersion: providerQuotes.scopeVersion,
    providerId: providerApplications.id,
    providerEmail: providerApplications.email,
    isTestProvider: providerApplications.isTestProvider,
  }).from(customerRequests)
    .innerJoin(providerQuotes, and(
      eq(providerQuotes.requestId, customerRequests.id),
      eq(providerQuotes.status, "accepted"),
      ...(emailConstraint ? [emailConstraint] : []),
    ))
    .innerJoin(
      providerApplications,
      eq(providerApplications.email, providerQuotes.providerEmail),
    )
    .where(eq(customerRequests.id, requestId))
    .limit(1);
  if (!job) return null;

  const jobFacts = await loadAuthorizedJobScopeFacts(
    job.requestId,
    job.scopeVersion,
  );

  return {
    requestId: job.requestId,
    quoteId: job.quoteId,
    providerId: job.providerId,
    providerEmail: job.providerEmail,
    customerEmail: job.customerEmail,
    requestStatus: job.requestStatus,
    isTestJob: job.isTestJob === "yes",
    isTestProvider: job.isTestProvider === "yes",
    serviceCodes: parseExactServiceCodes(
      job.quoteServiceCodes,
      job.requestServiceCodes,
    ),
    jurisdiction: job.jurisdiction,
    scheduledFor: job.quoteScheduledFor || job.requestScheduledFor,
    personId: job.assignedPersonId || job.quotePersonId,
    supervisorPersonId:
      job.assignedSupervisorPersonId || job.quoteSupervisorPersonId,
    scopeVersion: job.scopeVersion,
    assignmentVersion: job.assignmentVersion,
    customerProviderDisclosureAcceptedAt:
      job.customerProviderDisclosureAcceptedAt,
    jobFacts,
  };
}

export async function evaluateAssignedJobStage(input: {
  requestId: string;
  stage: Extract<EligibilityStage, "job_start" | "scope_change" | "completion" | "payout">;
  providerEmail?: string;
  persist?: boolean;
  serviceCodes?: readonly unknown[];
  scopeVersion?: number;
  candidateJobFacts?: unknown;
  arrivalJobFacts?: unknown;
  scheduledFor?: string;
  effectiveAt?: string;
}): Promise<JobStageDecision> {
  const context = await assignedJobOperationContext(
    input.requestId,
    input.providerEmail,
  );
  if (!context) {
    return {
      context: null,
      result: null,
      allowed: false,
      status: 404,
      error: "An accepted provider assignment was not found for this job.",
    };
  }
  if (context.isTestJob !== context.isTestProvider) {
    return {
      context,
      result: null,
      allowed: false,
      status: 409,
      error: "The provider and job test classifications do not match.",
    };
  }

  const scopeVersion = input.scopeVersion ?? context.scopeVersion;
  const hasCandidateFacts = input.stage === "scope_change"
    && input.candidateJobFacts !== undefined;
  let jobFacts: JobScopeFacts | null;
  let jobFactsSource: JobFactsSource = "authorized_scope";
  const jobFactsBindingReasons: { code: string; detail: string }[] = [];
  if (input.stage === "job_start") {
    const arrivalBinding = compareArrivalJobScopeFacts(
      context.jobFacts,
      input.arrivalJobFacts,
    );
    jobFacts = arrivalBinding.arrival;
    jobFactsSource = "provider_arrival";
    jobFactsBindingReasons.push(...arrivalBinding.reasons);
  } else if (input.stage === "completion" || input.stage === "payout") {
    const actualStart = await actualStartFactsForContext(context);
    jobFacts = actualStart?.facts ?? null;
    jobFactsSource = "provider_arrival_recheck";
    if (!actualStart) {
      jobFactsBindingReasons.push({
        code: "matching_actual_start_snapshot_required",
        detail: "A valid provider-arrival snapshot bound to the current assignment and accepted scope is required before completion or payout.",
      });
    }
  } else {
    jobFacts = hasCandidateFacts
      ? parseJobScopeFacts(input.candidateJobFacts)
      : (scopeVersion === context.scopeVersion
        ? context.jobFacts
        : await loadAuthorizedJobScopeFacts(context.requestId, scopeVersion));
  }
  const scheduledFor = input.stage === "scope_change" && input.scheduledFor
    ? input.scheduledFor
    : context.scheduledFor;
  const result = await evaluateStageEligibility({
    stage: input.stage,
    providerId: context.providerId,
    personId: context.personId,
    supervisorPersonId: context.supervisorPersonId,
    serviceCodes: input.serviceCodes ?? context.serviceCodes,
    jurisdiction: context.jurisdiction,
    scheduledFor,
    requestId: context.requestId,
    quoteId: context.quoteId,
    scopeVersion,
    assignmentVersion: context.assignmentVersion,
    customerProviderDisclosureAcceptedAt:
      context.customerProviderDisclosureAcceptedAt,
    jobFacts,
    jobFactsSource,
    jobFactsBindingReasons,
    effectiveAt: input.effectiveAt ?? new Date().toISOString(),
    testOnly: context.isTestJob && context.isTestProvider,
    persist: input.persist !== false,
  });
  return {
    context,
    result,
    allowed: result.allowed,
    status: result.allowed ? 200 : 409,
    error: result.allowed ? "" : eligibilityErrorMessage(result),
  };
}

async function authorizationSnapshot(decisionId: string) {
  if (!decisionId) return null;
  const [snapshot] = await getDb().select({
    requestId: jobAuthorizationSnapshots.requestId,
    quoteId: jobAuthorizationSnapshots.quoteId,
    stage: jobAuthorizationSnapshots.stage,
    scopeVersion: jobAuthorizationSnapshots.scopeVersion,
    assignmentVersion: jobAuthorizationSnapshots.assignmentVersion,
    providerId: jobAuthorizationSnapshots.providerId,
    performingPersonId: jobAuthorizationSnapshots.performingPersonId,
    supervisorPersonId: jobAuthorizationSnapshots.supervisorPersonId,
    serviceCodes: jobAuthorizationSnapshots.serviceCodes,
    jurisdiction: jobAuthorizationSnapshots.jurisdiction,
    scheduledFor: jobAuthorizationSnapshots.scheduledFor,
    decision: jobAuthorizationSnapshots.decision,
    jobControlProfile: jobAuthorizationSnapshots.jobControlProfile,
    decidedAt: jobAuthorizationSnapshots.decidedAt,
  }).from(jobAuthorizationSnapshots)
    .where(eq(jobAuthorizationSnapshots.id, decisionId))
    .limit(1);
  return snapshot ?? null;
}

function parseJobControlProfile(value: string) {
  let profile: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(value) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      profile = parsed as Record<string, unknown>;
    }
  } catch {
    return null;
  }
  return profile;
}

function snapshotMatchesContext(
  context: AssignedJobOperationContext,
  snapshot: NonNullable<Awaited<ReturnType<typeof authorizationSnapshot>>>,
  stage: Extract<EligibilityStage, "job_start" | "completion">,
) {
  return snapshot.stage === stage
    && snapshot.decision === "allow"
    && snapshot.requestId === context.requestId
    && snapshot.quoteId === context.quoteId
    && snapshot.scopeVersion === context.scopeVersion
    && snapshot.assignmentVersion === context.assignmentVersion
    && snapshot.providerId === context.providerId
    && snapshot.performingPersonId === context.personId
    && snapshot.supervisorPersonId === context.supervisorPersonId
    && snapshot.jurisdiction === context.jurisdiction
    && snapshot.scheduledFor === context.scheduledFor
    && JSON.stringify(parseExactServiceCodes(snapshot.serviceCodes).sort())
      === JSON.stringify([...context.serviceCodes].sort())
    && Number.isFinite(Date.parse(snapshot.decidedAt));
}

async function factsFromBoundDecision(
  context: AssignedJobOperationContext,
  decisionId: string,
  stage: Extract<EligibilityStage, "job_start" | "completion">,
  expectedFacts?: JobScopeFacts,
) {
  if (!context.jobFacts) return null;
  const snapshot = await authorizationSnapshot(decisionId);
  if (!snapshot || !snapshotMatchesContext(context, snapshot, stage)) return null;
  const profile = parseJobControlProfile(snapshot.jobControlProfile);
  if (!profile) return null;
  const effectiveAt = typeof profile.effectiveAt === "string"
    ? Date.parse(profile.effectiveAt)
    : Number.NaN;
  const facts = parseJobScopeFacts(profile.jobFactsSnapshot);
  if (!facts || !Number.isFinite(effectiveAt) || effectiveAt > Date.now() + 5 * 60_000) {
    return null;
  }
  const expectedSource = stage === "job_start"
    ? "provider_arrival"
    : "provider_arrival_recheck";
  const factsHash = await sha256(jobScopeFactsSnapshot(facts));
  if (
    profile.stage !== stage
    || profile.jobFactsSource !== expectedSource
    || profile.jobFactsHash !== factsHash
  ) return null;
  if (!compareArrivalJobScopeFacts(context.jobFacts, facts).allowed) return null;
  if (
    expectedFacts
    && jobScopeFactsSnapshot(expectedFacts) !== jobScopeFactsSnapshot(facts)
  ) return null;
  return { facts, factsHash, decisionId, effectiveAt: new Date(effectiveAt).toISOString() };
}

async function actualStartFactsForContext(
  context: AssignedJobOperationContext,
) {
  const [record] = await getDb().select({
    decisionId: providerJobRecords.jobStartDecisionId,
  }).from(providerJobRecords).where(and(
    eq(providerJobRecords.requestId, context.requestId),
    eq(providerJobRecords.providerEmail, context.providerEmail),
  )).limit(1);
  return factsFromBoundDecision(
    context,
    record?.decisionId || "",
    "job_start",
  );
}

export async function jobAuthorizationDecisionMatchesContext(
  context: AssignedJobOperationContext,
  decisionId: string,
  stage: Extract<EligibilityStage, "job_start" | "completion">,
) {
  if (stage === "job_start") {
    return Boolean(await factsFromBoundDecision(context, decisionId, stage));
  }
  const actualStart = await actualStartFactsForContext(context);
  if (!actualStart) return false;
  return Boolean(await factsFromBoundDecision(
    context,
    decisionId,
    stage,
    actualStart.facts,
  ));
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function appendJobLifecycleEvent(input: {
  requestId: string;
  quoteId?: string;
  providerId?: string;
  actorRole: "customer" | "provider" | "owner" | "system";
  actorId: string;
  eventType: string;
  fromStatus?: string;
  toStatus?: string;
  scopeVersion?: number;
  authorizationSnapshotId?: string;
  reasonCode?: string;
  details?: Record<string, unknown>;
}) {
  const [previous] = await getDb().select({
    eventHash: jobLifecycleEvents.eventHash,
  }).from(jobLifecycleEvents)
    .where(eq(jobLifecycleEvents.requestId, input.requestId))
    .orderBy(desc(jobLifecycleEvents.occurredAt))
    .limit(1);
  const occurredAt = new Date().toISOString();
  const previousEventHash = previous?.eventHash ?? "";
  const eventId = crypto.randomUUID();
  const details = JSON.stringify(input.details ?? {});
  const eventHash = await sha256(JSON.stringify({
    id: eventId,
    ...input,
    details,
    occurredAt,
    previousEventHash,
    rulesVersion: JOB_OPERATIONS_RULES_VERSION,
  }));
  await getDb().insert(jobLifecycleEvents).values({
    id: eventId,
    requestId: input.requestId,
    quoteId: input.quoteId ?? "",
    providerId: input.providerId ?? "",
    actorRole: input.actorRole,
    actorId: input.actorId,
    eventType: input.eventType.slice(0, 80),
    fromStatus: input.fromStatus ?? "",
    toStatus: input.toStatus ?? "",
    scopeVersion: input.scopeVersion ?? 0,
    authorizationSnapshotId: input.authorizationSnapshotId ?? "",
    reasonCode: input.reasonCode ?? "",
    details,
    previousEventHash,
    eventHash,
    occurredAt,
    createdAt: occurredAt,
  });
  return { eventId, eventHash, occurredAt };
}

export async function sha256JobOperationText(value: string) {
  return sha256(value);
}

export async function activeJobOperationHoldReasons(requestId: string) {
  const db = getDb();
  const [incidents, cancellations, changes] = await Promise.all([
    db.select({
      status: jobIncidents.status,
      holdPayments: jobIncidents.holdPayments,
    }).from(jobIncidents).where(eq(jobIncidents.requestId, requestId)),
    db.select({ status: jobCancellations.status })
      .from(jobCancellations).where(eq(jobCancellations.requestId, requestId)),
    db.select({ status: jobChangeOrders.status })
      .from(jobChangeOrders).where(eq(jobChangeOrders.requestId, requestId)),
  ]);
  const reasons: string[] = [];
  if (incidents.some((item) => (
    ["open", "under_review", "insurer_review"].includes(item.status)
    || item.holdPayments === "yes"
  ))) reasons.push("incident_or_stop_work_hold");
  if (cancellations.some((item) => (
    ["submitted", "under_review", "approved_test_only"].includes(item.status)
  ))) reasons.push("cancellation_or_no_show_hold");
  if (changes.some((item) => item.status === "pending_customer")) {
    reasons.push("change_order_customer_authorization_pending");
  }
  return reasons;
}

/**
 * Final payment release is a separate fail-closed calculation. Eligibility is
 * necessary, but never sufficient: operational, consumer-authorization, claim,
 * refund, dispute, reserve, invoice, and timer controls must all be clear.
 */
export function assessPayoutReadiness(
  input: PayoutReadinessInput,
): PayoutReadiness {
  const failures: Array<[string, string]> = [];
  if (!input.jobCompleted) {
    failures.push(["job_not_completed", "The job has not reached an authorized completion state."]);
  }
  if (!input.completionDecisionId) {
    failures.push(["completion_eligibility_missing", "A current completion eligibility decision is missing."]);
  }
  if (input.providerTimerRunning) {
    failures.push(["provider_timer_running", "The provider work timer is still running."]);
  }
  if (input.finalInvoiceStatus !== "final") {
    failures.push(["final_invoice_missing", "A final provider invoice with warranty disclosure is required."]);
  }
  if (
    !Number.isInteger(input.finalInvoiceTotalCents)
    || input.finalInvoiceTotalCents < 0
    || input.finalInvoiceTotalCents !== input.authorizedTotalCents
  ) {
    failures.push(["invoice_total_not_authorized", "The final invoice must exactly match the customer-authorized total."]);
  }
  if (input.unauthorizedChangeOrderCount > 0) {
    failures.push(["unauthorized_change_order", "Every scope or price change requires recorded customer authorization."]);
  }
  if (input.openIncidentCount > 0) {
    failures.push(["open_incident", "An incident or stop-work review remains open."]);
  }
  if (input.openClaimCount > 0) {
    failures.push(["open_claim", "An injury, property, or service claim remains open."]);
  }
  if (input.unresolvedCancellationCount > 0) {
    failures.push(["unresolved_cancellation", "A cancellation or no-show decision remains unresolved."]);
  }
  if (input.pendingRefundCount > 0 || input.approvedRefundAmountCents > 0) {
    failures.push(["refund_hold", "A refund request or approved refund prevents payout release."]);
  }
  if (input.openDisputeCount > 0) {
    failures.push(["dispute_hold", "A processor or customer dispute remains open."]);
  }
  if (input.activeReserveAmountCents > 0) {
    failures.push(["reserve_hold", "An active reserve or payment hold prevents release."]);
  }
  return {
    allowed: failures.length === 0,
    reasonCodes: failures.map(([code]) => code),
    reasons: failures.map(([, reason]) => reason),
  };
}
