import assert from "node:assert/strict";
import test from "node:test";
import { isRefundApprovalConfirmation, isRefundReview, isRefundReviewQueue } from "../lib/stripe-refund-response.ts";

const review = () => ({
  cancellationId: "synthetic-cancel", requestId: "synthetic-job", cancellationType: "provider_cancel",
  reason: "Synthetic cancellation", requestedAt: "2026-09-29T10:00:00Z", customerName: "Synthetic customer",
  providerName: "Synthetic provider", jobStatus: "assigned", reviewToken: "a".repeat(64),
  enabled: false, providerTravelStarted: false, workRecorded: false, blockers: [],
  payment: { id: "synthetic-payment", stripePaymentIntentId: "pi_synthetic", currency: "usd",
    paidAt: "2026-09-29T09:00:00Z", status: "paid_pending_completion",
    providerAmountCents: 10000, customerFeeCents: 500, customerTotalCents: 10500 },
  approval: null, execution: null,
});

test("refund screen accepts complete closed and status-only records without opening any gate", () => {
  assert.equal(isRefundReview(review(), "synthetic-cancel"), true);
  assert.equal(isRefundReview({ ...review(), payment: null, blockers: ["Payment needs review."] }, "synthetic-cancel"), true);
  assert.equal(isRefundReview({ ...review(), approval: { id: "synthetic-approval", status: "approved",
    decidedAt: "2026-09-29T11:00:00Z", reason: "Synthetic review", amountCents: 10500 },
    execution: { status: "refund_submission_unconfirmed", stripeRefundId: null } }, "synthetic-cancel"), true);
  assert.equal(isRefundReview(review(), "different-cancellation"), false);
});

test("incomplete rows and nested replies cannot crash or misrepresent the refund screen", () => {
  const row = { id: "synthetic-cancel", requestId: "synthetic-job", customerName: "Synthetic customer",
    cancellationType: "provider_cancel", status: "submitted", requestedAt: "2026-09-29T10:00:00Z" };
  assert.equal(isRefundReviewQueue({ cases: [row], hasMore: false }), true);
  assert.equal(isRefundReviewQueue({ cases: [], hasMore: false }), true);
  for (const value of [null, {}, [], { cases: [null], hasMore: false }, { cases: [{ id: row.id }], hasMore: false },
    { cases: [{ ...row, status: 5 }], hasMore: false }, { cases: [row], hasMore: "false" }]) {
    assert.equal(isRefundReviewQueue(value), false);
  }
  for (const change of [{ approval: { id: "synthetic-approval" } }, { execution: { status: "refund_succeeded" } },
    { payment: {} }, { enabled: "false" }, { blockers: [{}] }, { jobStatus: null }, { reviewToken: "partial" }]) {
    assert.equal(isRefundReview({ ...review(), ...change }, "synthetic-cancel"), false);
  }
});

test("unsafe or inconsistent refund amounts are withheld instead of displayed as confirmed totals", () => {
  for (const change of [{ customerTotalCents: "10500" }, { customerTotalCents: 10000 }, { customerFeeCents: -500 },
    { customerTotalCents: NaN }, { providerAmountCents: Number.MAX_SAFE_INTEGER + 1 }, { customerTotalCents: 10500.5 }]) {
    const value = review(); Object.assign(value.payment, change);
    assert.equal(isRefundReview(value, "synthetic-cancel"), false);
  }
});

test("an HTTP success alone is not a saved refund approval", () => {
  assert.equal(isRefundApprovalConfirmation({ adjustmentId: "synthetic-approval", refundSent: false, alreadySaved: false }), true);
  assert.equal(isRefundApprovalConfirmation({ adjustmentId: "synthetic-approval", refundSent: false, alreadySaved: true }), true);
  for (const value of [null, {}, [], { adjustmentId: "synthetic-approval" }, { adjustmentId: " ", refundSent: false },
    { adjustmentId: "synthetic-approval", refundSent: true }, { adjustmentId: "synthetic-approval", refundSent: "false" }]) {
    assert.equal(isRefundApprovalConfirmation(value), false);
  }
});
