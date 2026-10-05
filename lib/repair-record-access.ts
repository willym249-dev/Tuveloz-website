import { getServiceDefaultDenyStatus, jurisdictionIsOpenForService } from "./provider-policy";
import { runtimeMarketplaceActionAllowed } from "./runtime-marketplace-action";
import { assignedJobOperationContext, evaluateAssignedJobStage } from "./job-operations";
import { evaluateStageEligibility } from "./provider-eligibility-engine";

export type RepairRecordAccessContext = {
  requestId: string;
  quoteId: string;
  providerId: string;
  providerEmail: string;
  scopeVersion: number;
  assignmentVersion: number;
  isTestJob: string;
  isTestProvider: string;
  requestStatus: string;
  serviceCodes: string;
  quoteServiceCodes: string;
  jurisdiction: string;
};

export async function repairRecordProviderReady(job: RepairRecordAccessContext, invoice: boolean) {
  if (job.isTestJob === "yes" && job.isTestProvider === "yes") return true;
  if (job.isTestJob !== "no" || job.isTestProvider !== "no") return false;
  const context = await assignedJobOperationContext(job.requestId, job.providerEmail);
  if (!context || context.quoteId !== job.quoteId || context.providerId !== job.providerId
    || context.scopeVersion !== job.scopeVersion || context.assignmentVersion !== job.assignmentVersion
    || context.isTestJob || context.isTestProvider) return false;
  if (invoice) {
    const decision = await evaluateAssignedJobStage({ requestId: job.requestId, providerEmail: job.providerEmail,
      stage: "completion", persist: false });
    return decision.allowed && decision.context?.quoteId === job.quoteId
      && decision.context.providerId === job.providerId && decision.context.scopeVersion === job.scopeVersion
      && decision.context.assignmentVersion === job.assignmentVersion;
  }
  // Preparing/signing the estimate precedes actual arrival and job start. Use
  // current booking eligibility rather than inventing an arrival confirmation.
  const decision = await evaluateStageEligibility({
    stage: "booking", providerId: context.providerId, personId: context.personId,
    supervisorPersonId: context.supervisorPersonId, serviceCodes: context.serviceCodes,
    jurisdiction: context.jurisdiction, scheduledFor: context.scheduledFor,
    requestId: context.requestId, quoteId: context.quoteId, scopeVersion: context.scopeVersion,
    assignmentVersion: context.assignmentVersion,
    customerProviderDisclosureAcceptedAt: context.customerProviderDisclosureAcceptedAt,
    jobFacts: context.jobFacts, jobFactsSource: "authorized_scope", testOnly: false, persist: false,
  });
  return decision.allowed;
}

export async function realRepairRecordGates() {
  const [authorization, invoice] = await Promise.all([
    runtimeMarketplaceActionAllowed("job_start").catch(() => false),
    runtimeMarketplaceActionAllowed("completion").catch(() => false),
  ]);
  return { authorization, invoice };
}

function exactEnabledServices(job: RepairRecordAccessContext) {
  try {
    const request: unknown = JSON.parse(job.serviceCodes);
    const quote: unknown = JSON.parse(job.quoteServiceCodes);
    if (!Array.isArray(request) || !Array.isArray(quote) || !request.length
      || request.some((code) => typeof code !== "string")
      || quote.some((code) => typeof code !== "string")
      || new Set(request).size !== request.length || new Set(quote).size !== quote.length
      || JSON.stringify([...request].sort()) !== JSON.stringify([...quote].sort())) return false;
    return jurisdictionIsOpenForService(job.jurisdiction)
      && request.every((code) => getServiceDefaultDenyStatus(code).enabled);
  } catch {
    return false;
  }
}

// Reads never consult these write gates. Only persisted, fully isolated test
// participants bypass real marketplace controls; no request payload can do so.
export function repairRecordAccess(job: RepairRecordAccessContext, gates: { authorization: boolean; invoice: boolean }) {
  const isTest = job.isTestJob === "yes" && job.isTestProvider === "yes";
  const isReal = job.isTestJob === "no" && job.isTestProvider === "no";
  const active = !["cancelled", "canceled"].includes(job.requestStatus);
  const scopeAllowed = isTest || (isReal && exactEnabledServices(job));
  const authorizationWritesAllowed = active && scopeAllowed && (isTest || gates.authorization);
  const invoiceWritesAllowed = active && scopeAllowed && (isTest || gates.invoice);
  const writesAllowed = job.requestStatus === "completed" ? invoiceWritesAllowed : authorizationWritesAllowed;
  return {
    isTest, writesAllowed, authorizationWritesAllowed, invoiceWritesAllowed,
    writeBlockReason: writesAllowed ? "" : !active
      ? "This job is canceled. Existing records remain available to its participants."
      : !scopeAllowed ? "The accepted service scope or jurisdiction is not approved for this record action."
        : "Real repair-record changes are paused until the marketplace and current launch approvals permit them. Existing copies remain available.",
  };
}
