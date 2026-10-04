import assert from "node:assert/strict";
import test from "node:test";
import { isRefundApprovalConfirmation, isRefundReview, isRefundReviewQueue, refundEstimateLaborCents } from "../lib/stripe-refund-response.ts";

const review = () => ({
  cancellationId: "synthetic-cancel", requestId: "synthetic-job", cancellationType: "provider_cancel",
  reason: "Synthetic cancellation", requestedAt: "2026-09-29T10:00:00Z", customerName: "Synthetic customer",
  providerName: "Synthetic provider", jobStatus: "assigned", reviewToken: "a".repeat(64),
  enabled: false, providerTravelStarted: false, workRecorded: false, blockers: [],
  estimateEligibility: { available: false, blockers: ["The full-refund rule applies before work starts."] },
  payment: { id: "synthetic-payment", stripePaymentIntentId: "pi_synthetic", currency: "usd",
    paidAt: "2026-09-29T09:00:00Z", status: "paid_pending_completion",
    providerAmountCents: 10000, customerFeeCents: 500, customerTotalCents: 10500 },
  evidence: { workRecords: [], incidentHoldIds: [], adjustments: [],
    scope: { state: "missing", record: null, amountMatchesPayment: null },
    invoice: { state: "missing", record: null, amountMatchesPayment: null },
    payment: { scopeVersion: 1, scopeAuthorizationDecisionId: "scope-synthetic", transferId: "", releasedAt: "",
      refundAmountCents: 0, refundStatus: "", disputeStatus: "", lastRefundId: "" } },
  approval: null, execution: null,
});
const evidenceReview = () => {
  const value = review();
  value.evidence.workRecords.push({ id: "work-synthetic", workStatus: "started", jobStartDecisionId: "start-synthetic",
    completionDecisionId: "", trackedSeconds: 61, billableMinutes: 2 });
  value.evidence.incidentHoldIds.push("incident-synthetic");
  value.evidence.adjustments.push({ id: "adjustment-synthetic", adjustmentType: "refund_request", status: "requested",
    amountCents: 4200, currency: "usd", providerImpactCents: -4000, customerImpactCents: 4200,
    stripeRefundId: "", transferReversalId: "", requestedAt: "2026-09-29T10:00:00Z", decidedAt: "" });
  return value;
};
const scopedReview = () => {
  const value = review();
  const amounts = { laborAmountCents: 10000, partsAmountCents: 0, taxAmountCents: 0, otherAmountCents: 0, totalAmountCents: 10000 };
  value.evidence.scope = { state: "matched", amountMatchesPayment: true, record: {
    id: "scope-record", scopeVersion: 1, authorizationDecisionId: "scope-synthetic", serviceCodes: ["oil_change"],
    customerAuthorizedAt: "2026-09-29T08:00:00Z", price: { ...amounts, customerFeeRateBps: 500, customerFeeCents: 500, customerTotalCents: 10500 },
  } };
  value.evidence.invoice = { state: "matched", amountMatchesPayment: true, record: {
    id: "invoice-record", invoiceNumber: "TEST-1", scopeVersion: 1, status: "final", serviceCodes: ["oil_change"],
    ...amounts, issuedAt: "2026-09-29T08:00:00Z", workSummary: "Synthetic invoice summary.",
  } };
  return value;
};
const estimateReview = () => {
  const value = scopedReview();
  value.cancellationType = "customer_cancel"; value.workRecorded = true; value.jobStatus = "in progress";
  value.blockers = ["Recorded work needs a separate evidence review."];
  value.estimateEligibility = { available: true, blockers: [] };
  value.evidence.workRecords = [{ id: "work-synthetic", workStatus: "in progress", jobStartDecisionId: "start-synthetic",
    completionDecisionId: "", trackedSeconds: 0, billableMinutes: 0 }];
  return value;
};

test("estimate availability is mandatory, consistent, and separate from the closed approval gate", () => {
  assert.equal(isRefundReview(estimateReview(), "synthetic-cancel"), true);
  for (const bad of [undefined, null, [], {}, { available: "true", blockers: [] },
    { available: true, blockers: ["Hold"] }, { available: false, blockers: [] },
    { available: false, blockers: [null] }, { available: false, blockers: [""] }, { available: true, blockers: null }]) {
    const value = estimateReview(); value.estimateEligibility = bad;
    assert.equal(isRefundReview(value, "synthetic-cancel"), false, JSON.stringify(bad));
  }
  for (const status of ["in progress", "paused", "completed", "stop work", "waiting for customer authorization"]) {
    const value = estimateReview(); value.cancellationType = "customer_no_show"; value.evidence.workRecords[0].workStatus = status;
    assert.equal(isRefundReview(value, "synthetic-cancel"), true, status);
  }
  const missing = estimateReview(); missing.evidence.invoice = { state: "missing", record: null, amountMatchesPayment: null };
  assert.equal(isRefundReview(missing, "synthetic-cancel"), true);
  const draft = estimateReview(); draft.evidence.invoice.record.status = "draft"; draft.evidence.invoice.record.issuedAt = "";
  assert.equal(isRefundReview(draft, "synthetic-cancel"), true);
  const tiny = estimateReview(); Object.assign(tiny.payment, { providerAmountCents: 1, customerFeeCents: 0, customerTotalCents: 1 });
  Object.assign(tiny.evidence.scope.record.price, { laborAmountCents: 1, totalAmountCents: 1, customerFeeCents: 0, customerTotalCents: 1 });
  Object.assign(tiny.evidence.invoice.record, { laborAmountCents: 1, totalAmountCents: 1 });
  assert.equal(isRefundReview(tiny, "synthetic-cancel"), true, "a tiny rounded-zero fee is valid");
});

test("available estimates cannot contradict visible work, holds, decisions, or payment history", () => {
  const changes = [
    value => { value.cancellationType = "provider_cancel"; }, value => { value.cancellationType = "provider_no_show"; },
    value => { value.workRecorded = false; }, value => { value.evidence.workRecords = []; },
    value => { value.evidence.workRecords.push({ ...value.evidence.workRecords[0], id: "other" }); },
    value => { value.evidence.workRecords[0].jobStartDecisionId = ""; },
    value => { value.evidence.workRecords[0].workStatus = "not started"; }, value => { value.blockers = []; },
    value => { value.evidence.incidentHoldIds = ["incident"]; },
    value => { value.evidence.adjustments = evidenceReview().evidence.adjustments; },
    value => { value.approval = { id: "approval", status: "approved", decidedAt: "", reason: "review", amountCents: 10500 }; },
    value => { value.execution = { status: "refund_pending", stripeRefundId: null }; },
    value => { value.payment.currency = "eur"; }, value => { value.payment.status = "released"; },
    value => { value.payment.stripePaymentIntentId = ""; }, value => { value.payment.paidAt = "invalid"; },
    value => { value.evidence.scope.record.customerAuthorizedAt = "invalid"; },
    ...["transferId", "releasedAt", "refundStatus", "disputeStatus", "lastRefundId"].map(field => value => { value.evidence.payment[field] = "recorded"; }),
    value => { value.evidence.payment.refundAmountCents = 1; },
  ];
  for (const change of changes) {
    const value = estimateReview(); change(value);
    assert.equal(isRefundReview(value, "synthetic-cancel"), false, change.toString());
    value.estimateEligibility = { available: false, blockers: ["Saved records need review."] };
    assert.equal(isRefundReview(value, "synthetic-cancel"), true, "blocked saved evidence remains readable");
  }
});

test("available estimates require the original matched labor-only scope and any invoice to agree", () => {
  const changes = [
    value => { value.evidence.scope = { state: "missing", record: null, amountMatchesPayment: null }; },
    value => { value.evidence.scope.amountMatchesPayment = false; },
    value => { value.evidence.invoice.amountMatchesPayment = false; },
    ...["malformed", "mismatched", "unavailable"].map(state => value => { value.evidence.invoice = { state, record: null, amountMatchesPayment: null }; }),
    value => { value.evidence.invoice.record.serviceCodes = ["different_work"]; },
    value => { value.evidence.scope.record.price.customerFeeRateBps = 400; },
    value => { Object.assign(value.payment, { customerFeeCents: 501, customerTotalCents: 10501 });
      Object.assign(value.evidence.scope.record.price, { customerFeeCents: 501, customerTotalCents: 10501 }); },
    ...["partsAmountCents", "taxAmountCents", "otherAmountCents"].map(field => value => {
      value.evidence.scope.record.price[field] = 100; value.evidence.scope.record.price.laborAmountCents = 9900;
      value.evidence.invoice.record[field] = 100; value.evidence.invoice.record.laborAmountCents = 9900;
    }),
  ];
  for (const change of changes) {
    const value = estimateReview(); change(value);
    assert.equal(isRefundReview(value, "synthetic-cancel"), false, change.toString());
  }
});

test("proposed USD labor parses exact cents and rejects invalid or over-original amounts", () => {
  for (const [text, expected] of [["40", 4000], ["40.0", 4000], [" 40.00 ", 4000], ["0.29", 29], ["0.01", 1], ["100.00", 10000]]) {
    assert.equal(refundEstimateLaborCents(text, 10000), expected, text);
  }
  assert.equal(refundEstimateLaborCents("90071992547409.91", Number.MAX_SAFE_INTEGER), Number.MAX_SAFE_INTEGER);
  assert.equal(refundEstimateLaborCents("90071992547409.92", Number.MAX_SAFE_INTEGER), null);
  for (const text of [undefined, null, 40, "", " ", "0", "-1", "+1", "1e2", "0.001", ".50", "40.", "40,00", "$40", "NaN", "Infinity", "100.01", "9".repeat(21)]) {
    assert.equal(refundEstimateLaborCents(text, 10000), null, String(text));
  }
  for (const maximum of [0, -1, 100.5, Infinity, NaN, Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal(refundEstimateLaborCents("0.01", maximum), null);
  }
});

test("refund screen accepts complete closed and status-only records without opening any gate", () => {
  assert.equal(isRefundReview(review(), "synthetic-cancel"), true);
  const missingPayment = review(); missingPayment.payment = null; missingPayment.evidence.payment = null;
  missingPayment.evidence.scope.state = "unavailable"; missingPayment.evidence.invoice.state = "unavailable";
  missingPayment.blockers = ["Payment needs review."];
  assert.equal(isRefundReview(missingPayment, "synthetic-cancel"), true);
  assert.equal(isRefundReview({ ...review(), approval: { id: "synthetic-approval", status: "approved",
    decidedAt: "2026-09-29T11:00:00Z", reason: "Synthetic review", amountCents: 10500 },
    execution: { status: "refund_submission_unconfirmed", stripeRefundId: null } }, "synthetic-cancel"), true);
  assert.equal(isRefundReview(review(), "different-cancellation"), false);
});

test("scope and invoice states preserve missing records and distinguish draft and amount differences", () => {
  const value = scopedReview();
  assert.equal(isRefundReview(value, "synthetic-cancel"), true);
  value.evidence.invoice.record.status = "draft"; value.evidence.invoice.record.issuedAt = "";
  value.evidence.invoice.amountMatchesPayment = false; value.evidence.scope.amountMatchesPayment = false;
  assert.equal(isRefundReview(value, "synthetic-cancel"), true);
  for (const state of ["missing", "mismatched", "malformed", "unavailable"]) {
    for (const field of ["scope", "invoice"]) {
      const next = scopedReview(); next.evidence[field] = { state, record: null, amountMatchesPayment: null };
      assert.equal(isRefundReview(next, "synthetic-cancel"), true, `${field}:${state}`);
    }
  }
});

test("inconsistent scope and invoice replies cannot replace the prior safe review", () => {
  for (const field of ["scope", "invoice"]) {
    for (const bad of [undefined, null, {}, { state: "matched", record: null, amountMatchesPayment: true },
      { state: "missing", record: scopedReview().evidence[field].record, amountMatchesPayment: null },
      { state: "missing", record: null, amountMatchesPayment: true },
      { ...scopedReview().evidence[field], amountMatchesPayment: "true" }]) {
      const value = scopedReview(); value.evidence[field] = bad;
      assert.equal(isRefundReview(value, "synthetic-cancel"), false, field);
    }
    for (const change of [{ scopeVersion: 2 }, { serviceCodes: [] }, { serviceCodes: ["oil_change", "oil_change"] },
      { serviceCodes: [null] }, { serviceCodes: "oil_change" }, { id: "" }]) {
      const value = scopedReview(); Object.assign(value.evidence[field].record, change);
      assert.equal(isRefundReview(value, "synthetic-cancel"), false, `${field}:${JSON.stringify(change)}`);
    }
  }
  for (const change of [{ authorizationDecisionId: "different" }, { customerAuthorizedAt: null }, { price: {} },
    { price: { ...scopedReview().evidence.scope.record.price, customerTotalCents: 10000 } }]) {
    const value = scopedReview(); Object.assign(value.evidence.scope.record, change);
    assert.equal(isRefundReview(value, "synthetic-cancel"), false);
  }
  for (const change of [{ issuedAt: "" }, { status: "issued" }, { invoiceNumber: null }, { workSummary: {} },
    { totalAmountCents: 9999 }, { laborAmountCents: "10000" }, { partsAmountCents: -1 }]) {
    const value = scopedReview(); Object.assign(value.evidence.invoice.record, change);
    assert.equal(isRefundReview(value, "synthetic-cancel"), false);
  }
});

test("a match claim cannot contradict the displayed original payment totals", () => {
  const scope = scopedReview();
  Object.assign(scope.evidence.scope.record.price, { laborAmountCents: 20000, totalAmountCents: 20000,
    customerFeeCents: 1000, customerTotalCents: 21000 });
  assert.equal(isRefundReview(scope, "synthetic-cancel"), false);
  scope.evidence.scope.amountMatchesPayment = false;
  assert.equal(isRefundReview(scope, "synthetic-cancel"), true);
  const invoice = scopedReview();
  Object.assign(invoice.evidence.invoice.record, { laborAmountCents: 20000, totalAmountCents: 20000 });
  assert.equal(isRefundReview(invoice, "synthetic-cancel"), false);
  invoice.evidence.invoice.amountMatchesPayment = false;
  assert.equal(isRefundReview(invoice, "synthetic-cancel"), true);
  const differingFee = scopedReview();
  Object.assign(differingFee.evidence.scope.record.price, { customerFeeCents: 1000, customerTotalCents: 11000 });
  assert.equal(isRefundReview(differingFee, "synthetic-cancel"), false);
  const contradictoryBreakdown = scopedReview();
  Object.assign(contradictoryBreakdown.evidence.invoice.record, { laborAmountCents: 9000, partsAmountCents: 1000 });
  assert.equal(isRefundReview(contradictoryBreakdown, "synthetic-cancel"), false);
  contradictoryBreakdown.evidence.invoice.amountMatchesPayment = false;
  assert.equal(isRefundReview(contradictoryBreakdown, "synthetic-cancel"), true);
});

test("read-only evidence accepts signed impacts and incomplete blocked-payment facts without implying approval", () => {
  const value = evidenceReview();
  value.evidence.adjustments[0].providerImpactCents = Number.MIN_SAFE_INTEGER;
  value.evidence.adjustments[0].customerImpactCents = Number.MAX_SAFE_INTEGER;
  value.evidence.payment.scopeVersion = 0; value.evidence.payment.scopeAuthorizationDecisionId = "";
  value.evidence.payment.transferId = "tr_synthetic"; value.evidence.payment.releasedAt = "2026-09-29T10:00:00Z";
  value.evidence.payment.refundAmountCents = 4200; value.evidence.payment.refundStatus = "pending";
  value.evidence.payment.disputeStatus = "needs_response"; value.evidence.payment.lastRefundId = "re_synthetic";
  value.blockers = ["Work, payment history and an incident need separate review."];
  assert.equal(isRefundReview(value, "synthetic-cancel"), true);
  assert.equal(value.enabled, false);
  value.evidence.adjustments[0].providerImpactCents = 4000;
  value.evidence.adjustments[0].customerImpactCents = -4200;
  assert.equal(isRefundReview(value, "synthetic-cancel"), true);
});

test("missing or malformed evidence collections and payment mismatches retain the prior review", () => {
  for (const evidence of [undefined, null, [], {},
    { ...review().evidence, workRecords: null }, { ...review().evidence, workRecords: [null] },
    { ...review().evidence, incidentHoldIds: "incident" }, { ...review().evidence, incidentHoldIds: [""] },
    { ...review().evidence, incidentHoldIds: [null] }, { ...review().evidence, incidentHoldIds: [{}] },
    { ...review().evidence, adjustments: {} }, { ...review().evidence, adjustments: [[]] },
    { ...review().evidence, payment: undefined }, { ...review().evidence, payment: null }]) {
    assert.equal(isRefundReview({ ...review(), evidence }, "synthetic-cancel"), false);
  }
  assert.equal(isRefundReview({ ...review(), payment: null }, "synthetic-cancel"), false);
});

test("every rendered evidence field is required and unsafe numeric values are rejected without coercion", () => {
  const fields = [
    ["workRecords", ["id", "workStatus", "jobStartDecisionId", "completionDecisionId", "trackedSeconds", "billableMinutes"]],
    ["adjustments", ["id", "adjustmentType", "status", "amountCents", "currency", "providerImpactCents", "customerImpactCents",
      "stripeRefundId", "transferReversalId", "requestedAt", "decidedAt"]],
    ["payment", ["scopeVersion", "scopeAuthorizationDecisionId", "transferId", "releasedAt", "refundAmountCents", "refundStatus", "disputeStatus", "lastRefundId"]],
  ];
  for (const [section, keys] of fields) {
    for (const key of keys) {
      for (const bad of [undefined, null, {}, [], true]) {
        const value = evidenceReview();
        const target = section === "payment" ? value.evidence.payment : value.evidence[section][0];
        target[key] = bad;
        assert.equal(isRefundReview(value, "synthetic-cancel"), false, `${section}.${key}`);
      }
    }
  }
  for (const [section, keys] of [["workRecords", ["trackedSeconds", "billableMinutes"]],
    ["adjustments", ["amountCents", "providerImpactCents", "customerImpactCents"]],
    ["payment", ["scopeVersion", "refundAmountCents"]]]) {
    for (const key of keys) {
      const badNumbers = ["1", NaN, Infinity, -Infinity, 0.5, Number.MAX_SAFE_INTEGER + 1, Number.MIN_SAFE_INTEGER - 1];
      if (!key.endsWith("ImpactCents")) badNumbers.push(-1);
      for (const bad of badNumbers) {
        const value = evidenceReview();
        const target = section === "payment" ? value.evidence.payment : value.evidence[section][0];
        target[key] = bad;
        assert.equal(isRefundReview(value, "synthetic-cancel"), false, `${section}.${key}=${bad}`);
      }
    }
  }
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
