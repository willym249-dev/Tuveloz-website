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
function cents(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
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
  if (payment !== null && (!record(payment) || !id(payment.id)
    || !strings(payment, ["stripePaymentIntentId", "currency", "paidAt", "status"])
    || !cents(payment.providerAmountCents) || !cents(payment.customerFeeCents) || !cents(payment.customerTotalCents)
    || payment.providerAmountCents + payment.customerFeeCents !== payment.customerTotalCents)) return false;
  if (approval !== null && (!record(approval) || !id(approval.id)
    || !strings(approval, ["status", "decidedAt", "reason"]) || !cents(approval.amountCents))) return false;
  if (execution !== null && (!record(execution) || !id(execution.status)
    || !(execution.stripeRefundId === null || id(execution.stripeRefundId)))) return false;
  return true;
}

export function isRefundApprovalConfirmation(value: unknown): value is { adjustmentId: string; refundSent: false } {
  return record(value) && id(value.adjustmentId) && value.refundSent === false
    && (value.alreadySaved === undefined || typeof value.alreadySaved === "boolean");
}
