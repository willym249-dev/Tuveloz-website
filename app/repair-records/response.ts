import { ELECTRONIC_SIGNATURE_NOTICE, MARYLAND_REPAIR_RECORDS_VERSION, parseRepairLineItems, repairLineItemTotals, sha256RepairRecord, stableRepairRecordJson } from "../../lib/maryland-repair-records";
import type { Action, RepairData, RepairJob, RepairRecord } from "./record-workspace";

export function object(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function strings(value: Record<string, unknown>, keys: string[]) { return keys.every(key => typeof value[key] === "string"); }
function nonempty(value: unknown): value is string { return typeof value === "string" && Boolean(value.trim()); }
function list(value: unknown): value is string[] { return Array.isArray(value) && value.every(item => typeof item === "string"); }
function integer(value: unknown): value is number { return typeof value === "number" && Number.isSafeInteger(value) && value >= 0; }
function dateOrBlank(value: unknown) { return typeof value === "string" && (value === "" || (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value) && Number.isFinite(new Date(value).getTime()))); }

async function recordData(value: unknown, job: Record<string, unknown>, invoice: boolean, version: string): Promise<RepairRecord | null> {
  if (value === null) return null;
  if (!object(value) || !strings(value, ["id", "status", "documentSnapshot", "documentHash", "updatedAt", "customerSignatureAt", "customerSignatureName"]) || !nonempty(value.id) || !nonempty(value.updatedAt)) throw new Error("Invalid saved record");
  if (!(invoice ? ["draft", "final"] : ["draft", "presented", "signed"]).includes(String(value.status))) throw new Error("Invalid record state");
  if (invoice && !strings(value, ["invoiceNumber", "customerCopyDeliveredAt", "providerCopyRetainedAt", "customerCopyDeliveryMethod", "customerCopyDeliveredTo"])) throw new Error("Invalid invoice copy");
  if (!dateOrBlank(value.customerSignatureAt) || !dateOrBlank(value.updatedAt) || (Boolean(value.customerSignatureAt) !== nonempty(value.customerSignatureName)) || (!invoice && (value.status === "signed") !== Boolean(value.customerSignatureAt)) || (value.status === "draft" && value.customerSignatureAt)) throw new Error("Invalid signature evidence");
  if (invoice && (!dateOrBlank(value.customerCopyDeliveredAt) || !dateOrBlank(value.providerCopyRetainedAt) || ((value.customerCopyDeliveredAt || value.providerCopyRetainedAt || value.customerCopyDeliveryMethod || value.customerCopyDeliveredTo) && !value.customerSignatureAt))) throw new Error("Invalid copy evidence");
  const snapshot: unknown = JSON.parse(String(value.documentSnapshot));
  if (!object(snapshot) || snapshot.version !== version || snapshot.documentType !== (invoice ? "provider_final_repair_invoice" : "repair_authorization_and_written_estimate") || !list(snapshot.serviceCodes)) throw new Error("Invalid document snapshot");
  if ("providerCertification" in snapshot && typeof snapshot.providerCertification !== "string") throw new Error("Invalid provider certification");
  for (const key of ["requestId", "quoteId", "providerId", "scopeVersion"]) {
    if (value[key] !== job[key] || snapshot[key] !== job[key]) throw new Error("Document belongs to another job");
  }
  if (!strings(snapshot, ["providerBusinessName", "providerBusinessAddress", "providerBusinessPhone", "countyRegistrationNumber", "customerName", "customerAddress", "vehicleYear", "vehicleMakeModel", "vehicleTag", "vehicleVin", "customerInstructions", "providerDiagnosis", "laborBillingMethod", "laborDisclosure", "providerRepresentativeName", "providerRepresentativeTitle", "manufacturerNotice", "responsibilityNotice"]) || !integer(snapshot.odometerReading)) throw new Error("Incomplete document");
  if (invoice) {
    if (!strings(snapshot, ["invoiceNumber", "authorizationRecordId", "authorizationDocumentHash", "workSummary", "warrantyWorkStatement", "warrantyProvider", "warrantyTerms", "returnedPartsChoice", "issuedAt"]) || !list(snapshot.mechanicIdentifiers)) throw new Error("Incomplete invoice");
  } else if (!strings(snapshot, ["providerEmail", "providerName", "customerEmail", "estimatedCompletionAt", "completionDisclosure", "surchargeDescription", "replacedPartsChoice", "providerSignedAt", "customerRightsHeading", "customerRightsText", "writtenEstimateStandard"]) || !integer(snapshot.estimateFeeCents) || !integer(snapshot.surchargeCents)) throw new Error("Incomplete estimate");
  const items = parseRepairLineItems(snapshot.lineItems), rows = parseRepairLineItems(value.lineItems);
  if (!items || !rows || stableRepairRecordJson(snapshot.lineItems) !== stableRepairRecordJson(items) || stableRepairRecordJson(items) !== stableRepairRecordJson(rows)) throw new Error("Itemized document differs from its snapshot");
  const totals = repairLineItemTotals(items);
  for (const [key, amount] of Object.entries(totals)) {
    if (!integer(snapshot[key]) || snapshot[key] !== amount || value[key] !== amount) throw new Error("Invalid document total");
  }
  for (const [key, stored] of Object.entries(value)) {
    if (!(key in snapshot)) continue;
    if (key === "lineItems") continue;
    const comparable = key === "serviceCodes" || key === "mechanicIdentifiers" ? JSON.parse(String(stored)) : stored;
    if (stableRepairRecordJson(comparable) !== stableRepairRecordJson(snapshot[key])) throw new Error("Saved fields differ from the exact document");
  }
  if (value.status !== "draft" && (!nonempty(value.documentHash) || await sha256RepairRecord(String(value.documentSnapshot)) !== value.documentHash)) throw new Error("Document hash could not be verified");
  // Only document fields come from the hash-bound snapshot. Signature/copy
  // evidence stays separate because it is recorded after the document freezes.
  return { ...value, ...snapshot, lineItems: items } as RepairRecord;
}

export async function readRepairData(value: unknown): Promise<RepairData> {
  if (!object(value) || !["customer", "provider"].includes(String(value.role)) || !nonempty(value.email) || !nonempty(value.version) || typeof value.testOnly !== "boolean" || typeof value.realJobsEnabled !== "boolean" || !object(value.legalNotices) || !strings(value.legalNotices, ["customerRightsHeading", "customerRightsText", "writtenEstimateStandard", "manufacturerNotice", "responsibilityNotice", "electronicSignatureNotice"]) || !Array.isArray(value.jobs)) throw new Error("Invalid repair-record response");
  if (value.version !== MARYLAND_REPAIR_RECORDS_VERSION || value.legalNotices.electronicSignatureNotice !== ELECTRONIC_SIGNATURE_NOTICE) throw new Error("The document version or electronic consent is not supported");
  const ids = new Set<string>();
  const jobs = await Promise.all(value.jobs.map(async (job: unknown) => {
    if (!object(job) || !strings(job, ["requestId", "requestStatus", "vehicle", "service", "serviceCodes", "customerName", "customerEmail", "serviceAddress", "quoteId", "quotePriceCents", "providerId", "providerName", "providerEmail", "providerBusinessAddress", "writeBlockReason"]) || !nonempty(job.requestId) || !nonempty(job.quoteId) || !nonempty(job.providerId) || !integer(job.scopeVersion) || job.scopeVersion < 1 || !/^\d+$/.test(String(job.quotePriceCents)) || !integer(Number(job.quotePriceCents)) || !["isTest", "writesAllowed", "authorizationWritesAllowed", "invoiceWritesAllowed"].every(key => typeof job[key] === "boolean")) throw new Error("Invalid job response");
    const participant = value.role === "provider" ? job.providerEmail : job.customerEmail;
    if (String(participant).trim().toLowerCase() !== String(value.email).trim().toLowerCase() || ids.has(String(job.requestId))) throw new Error("Invalid account binding");
    ids.add(String(job.requestId));
    const authorization = await recordData(job.authorization, job, false, String(value.version));
    const invoice = await recordData(job.invoice, job, true, String(value.version));
    if (invoice && (!authorization || invoice.authorizationRecordId !== authorization.id || invoice.authorizationDocumentHash !== authorization.documentHash)) throw new Error("Invoice does not match its authorization");
    return { ...job, authorization, invoice } as RepairJob;
  }));
  return { ...value, jobs } as RepairData;
}

export function hasReceipt(value: unknown, job: RepairJob, action: Action, payload: Record<string, unknown>): boolean {
  if (!object(value) || value.ok !== true || value.paymentReleased !== false || value.action !== action || value.requestId !== job.requestId || !nonempty(value.recordId) || typeof value.documentHash !== "string") return false;
  if (action === "save-authorization" || action === "save-invoice") {
    return value.status === payload.status && (payload.expectedRecordId === "" || value.recordId === payload.expectedRecordId) && (payload.status === "draft" ? value.documentHash === "" : nonempty(value.documentHash));
  }
  if (value.recordId !== payload.expectedRecordId || value.documentHash !== payload.expectedDocumentHash) return false;
  if (action === "sign-authorization") return value.status === "signed";
  if (action === "receive-invoice-copy") return value.status === "copy-received";
  return value.status === "signed-and-delivered" || (value.status === "signed" && value.alreadySigned === true);
}
