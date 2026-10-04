import type { RefundReview, RefundReviewQueue } from "./stripe-refund-review";

// Validate the fields the owner screen renders before replacing its last good
// snapshot. These checks do not grant refund eligibility; the server does that.
function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function strings(value: Record<string, unknown>, keys: string[]) {
  return keys.every(key => typeof value[key] === "string");
}
function id(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
function integer(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value);
}
function cents(value: unknown): value is number {
  return integer(value) && value >= 0;
}
function serviceCodes(value: unknown): value is string[] {
  return Array.isArray(value) && value.length > 0 && value.every(id)
    && new Set(value).size === value.length;
}
function itemizedAmount(value: unknown): value is Record<string, number> {
  if (!record(value)) return false;
  const keys = ["laborAmountCents", "partsAmountCents", "taxAmountCents", "otherAmountCents", "totalAmountCents"];
  return keys.every(key => cents(value[key]))
    && (value.laborAmountCents as number) + (value.partsAmountCents as number)
      + (value.taxAmountCents as number) + (value.otherAmountCents as number) === value.totalAmountCents;
}
function scopeOrInvoice(value: unknown, kind: "scope" | "invoice") {
  if (!record(value)) return false;
  if (["missing", "mismatched", "malformed", "unavailable"].includes(value.state as string)) {
    return value.record === null && value.amountMatchesPayment === null;
  }
  if (value.state !== "matched" || typeof value.amountMatchesPayment !== "boolean" || !record(value.record)) return false;
  const row = value.record;
  if (!id(row.id) || !integer(row.scopeVersion) || row.scopeVersion <= 0 || !serviceCodes(row.serviceCodes)) return false;
  if (kind === "scope") {
    const price = row.price;
    return id(row.authorizationDecisionId) && id(row.customerAuthorizedAt) && itemizedAmount(price)
      && cents(price.customerFeeRateBps) && cents(price.customerFeeCents) && cents(price.customerTotalCents)
      && price.totalAmountCents + price.customerFeeCents === price.customerTotalCents;
  }
  return id(row.invoiceNumber) && (row.status === "draft" || row.status === "final") && itemizedAmount(row)
    && strings(row, ["issuedAt", "workSummary"]) && (row.status !== "final" || id(row.issuedAt));
}
function evidence(value: unknown): value is RefundReview["evidence"] {
  if (!record(value) || !Array.isArray(value.workRecords)
    || !value.workRecords.every(row => record(row) && id(row.id) && id(row.workStatus)
      && strings(row, ["jobStartDecisionId", "completionDecisionId"])
      && cents(row.trackedSeconds) && cents(row.billableMinutes))
    || !Array.isArray(value.incidentHoldIds) || !value.incidentHoldIds.every(id)
    || !Array.isArray(value.adjustments)
    || !value.adjustments.every(row => record(row) && id(row.id) && id(row.adjustmentType)
      && id(row.status) && id(row.currency) && cents(row.amountCents)
      && integer(row.providerImpactCents) && integer(row.customerImpactCents)
      && strings(row, ["stripeRefundId", "transferReversalId", "requestedAt", "decidedAt"]))) return false;
  if (!scopeOrInvoice(value.scope, "scope") || !scopeOrInvoice(value.invoice, "invoice")) return false;
  const payment = value.payment;
  if (payment === null) return (value.scope as Record<string, unknown>).state === "unavailable"
    && (value.invoice as Record<string, unknown>).state === "unavailable";
  if (!record(payment) || !cents(payment.scopeVersion) || !cents(payment.refundAmountCents)
    || !strings(payment, ["scopeAuthorizationDecisionId", "transferId", "releasedAt", "refundStatus", "disputeStatus", "lastRefundId"])) return false;
  const scope = (value.scope as Record<string, unknown>).record;
  const invoice = (value.invoice as Record<string, unknown>).record;
  return (!record(scope) || (scope.scopeVersion === payment.scopeVersion && scope.authorizationDecisionId === payment.scopeAuthorizationDecisionId))
    && (!record(invoice) || invoice.scopeVersion === payment.scopeVersion);
}

function validEstimateEligibility(value: Record<string, unknown>, saved: RefundReview["evidence"]) {
  const eligibility = value.estimateEligibility;
  if (!record(eligibility) || typeof eligibility.available !== "boolean"
    || !Array.isArray(eligibility.blockers) || !eligibility.blockers.every(id)
    || eligibility.available !== (eligibility.blockers.length === 0)) return false;
  if (!eligibility.available) return true;
  const payment = value.payment, scope = saved.scope.record, invoice = saved.invoice.record;
  if (!record(payment) || !saved.payment || !scope || saved.scope.state !== "matched" || !saved.scope.amountMatchesPayment
    || !["customer_cancel", "customer_no_show"].includes(value.cancellationType as string)
    || value.workRecorded !== true || saved.workRecords.length !== 1 || !id(saved.workRecords[0].jobStartDecisionId)
    || !["in progress", "paused", "completed", "stop work", "waiting for customer authorization"].includes(saved.workRecords[0].workStatus)
    || value.approval !== null || value.execution !== null || !(value.blockers as unknown[]).length
    || saved.incidentHoldIds.length || saved.adjustments.length
    || payment.currency !== "usd" || payment.status !== "paid_pending_completion"
    || !cents(payment.providerAmountCents) || payment.providerAmountCents === 0
    || !id(payment.stripePaymentIntentId) || !Number.isFinite(Date.parse(payment.paidAt as string))
    || !Number.isFinite(Date.parse(scope.customerAuthorizedAt))
    || saved.payment.refundAmountCents !== 0
    || [saved.payment.transferId, saved.payment.releasedAt, saved.payment.refundStatus,
      saved.payment.disputeStatus, saved.payment.lastRefundId].some(Boolean)) return false;
  const price = scope.price;
  if (price.laborAmountCents !== payment.providerAmountCents || price.partsAmountCents !== 0
    || price.taxAmountCents !== 0 || price.otherAmountCents !== 0 || price.customerFeeRateBps !== 500
    || BigInt(price.customerFeeCents) !== (BigInt(price.laborAmountCents) * BigInt(500) + BigInt(5000)) / BigInt(10000)) return false;
  return saved.invoice.state === "missing" || (saved.invoice.state === "matched" && saved.invoice.amountMatchesPayment === true
    && invoice !== null && invoice.laborAmountCents === price.laborAmountCents && invoice.partsAmountCents === 0
    && invoice.taxAmountCents === 0 && invoice.otherAmountCents === 0
    && invoice.serviceCodes.length === scope.serviceCodes.length && invoice.serviceCodes.every(code => scope.serviceCodes.includes(code)));
}

/** Parse a proposed USD labor amount without multiplying floating decimals. */
export function refundEstimateLaborCents(value: unknown, maximumCents: number): number | null {
  if (typeof value !== "string" || !cents(maximumCents) || maximumCents === 0) return null;
  const text = value.trim();
  if (text.length > 20 || !/^\d+(?:\.\d{1,2})?$/.test(text)) return null;
  const [whole, fraction = ""] = text.split(".");
  const amount = BigInt(whole) * BigInt(100) + BigInt(fraction.padEnd(2, "0"));
  return amount > BigInt(0) && amount <= BigInt(maximumCents) ? Number(amount) : null;
}

export function isRefundReviewQueue(value: unknown): value is RefundReviewQueue {
  return record(value) && typeof value.hasMore === "boolean" && Array.isArray(value.cases)
    && value.cases.every(item => record(item) && id(item.id)
      && strings(item, ["requestId", "customerName", "cancellationType", "status", "requestedAt"]));
}

export function isRefundReview(value: unknown, cancellationId: string): value is RefundReview {
  if (!record(value) || value.cancellationId !== cancellationId
    || !strings(value, ["requestId", "cancellationType", "reason", "requestedAt", "customerName", "providerName", "jobStatus"])
    || typeof value.reviewToken !== "string" || !/^[a-f0-9]{64}$/.test(value.reviewToken)
    || typeof value.enabled !== "boolean" || typeof value.providerTravelStarted !== "boolean" || typeof value.workRecorded !== "boolean"
    || !Array.isArray(value.blockers) || !value.blockers.every(item => typeof item === "string")) return false;
  const payment = value.payment, approval = value.approval, execution = value.execution;
  if (!evidence(value.evidence) || (payment === null) !== (value.evidence.payment === null)) return false;
  if (payment !== null && (!record(payment) || !id(payment.id)
    || !strings(payment, ["stripePaymentIntentId", "currency", "paidAt", "status"])
    || !cents(payment.providerAmountCents) || !cents(payment.customerFeeCents) || !cents(payment.customerTotalCents)
    || payment.providerAmountCents + payment.customerFeeCents !== payment.customerTotalCents)) return false;
  if (record(payment)) {
    const { scope, invoice } = value.evidence;
    // The server can find a difference in the hidden paid snapshot even when
    // these totals agree. But a true match can never contradict visible totals.
    if (scope.record && scope.amountMatchesPayment
      && (scope.record.price.totalAmountCents !== payment.providerAmountCents
        || scope.record.price.customerFeeCents !== payment.customerFeeCents
        || scope.record.price.customerTotalCents !== payment.customerTotalCents)) return false;
    if (invoice.record && invoice.amountMatchesPayment && invoice.record.totalAmountCents !== payment.providerAmountCents) return false;
    const scopeRecord = scope.record, invoiceRecord = invoice.record;
    if (scopeRecord && invoiceRecord && scope.amountMatchesPayment && invoice.amountMatchesPayment
      && (["laborAmountCents", "partsAmountCents", "taxAmountCents", "otherAmountCents"] as const)
        .some(key => scopeRecord.price[key] !== invoiceRecord[key])) return false;
  }
  if (approval !== null && (!record(approval) || !id(approval.id)
    || !strings(approval, ["status", "decidedAt", "reason"]) || !cents(approval.amountCents))) return false;
  if (execution !== null && (!record(execution) || !id(execution.status)
    || !(execution.stripeRefundId === null || id(execution.stripeRefundId)))) return false;
  return validEstimateEligibility(value, value.evidence);
}

export function isRefundApprovalConfirmation(value: unknown): value is { adjustmentId: string; refundSent: false } {
  return record(value) && id(value.adjustmentId) && value.refundSent === false
    && (value.alreadySaved === undefined || typeof value.alreadySaved === "boolean");
}
