import test from "node:test";
import assert from "node:assert/strict";
import { checkoutModule } from "./helpers/checkout-evidence.mjs";
const { validCustomerReview, validCustomerRequestSnapshot, validQuoteFeedbackReply } = checkoutModule("./lib/customer-request-response");
const review = { id: "synthetic-review", providerName: "SYNTHETIC Provider", customerDisplayName: "SYNTHETIC C.", service: "Synthetic service", rating: 5, comment: "Synthetic draft" };
const snapshot = { accessToken: "synthetic-token", job: { id: "synthetic-job", status: "completed", service: "Synthetic service", isTestJob: true },
  quotes: [{ id: "synthetic-quote", status: "accepted", providerName: "SYNTHETIC Provider", declineReason: "", ratingAverage: 0, reviewCount: 0 }], review: null };

test("review replies reject corrupt star counts and incomplete saved records before rendering", () => {
  assert.equal(validCustomerReview(review), true);
  for (const rating of [0, 6, 1.5, "5", null, NaN, Infinity]) assert.equal(validCustomerReview({ ...review, rating }), false);
  for (const key of Object.keys(review)) {
    const bad = { ...review }; delete bad[key]; assert.equal(validCustomerReview(bad), false, key);
  }
});
test("uncertain customer writes require a complete request snapshot including explicit review state", () => {
  assert.equal(validCustomerRequestSnapshot(snapshot), true);
  assert.equal(validCustomerRequestSnapshot({ ...snapshot, review }), true);
  for (const bad of [null, {}, { ...snapshot, review: undefined }, { ...snapshot, review: { ...review, rating: 10 } },
    { ...snapshot, accessToken: "" }, { ...snapshot, job: { ...snapshot.job, isTestJob: "yes" } },
    { ...snapshot, quotes: [null] }, { ...snapshot, quotes: [{ ...snapshot.quotes[0], ratingAverage: "5" }] }]) {
    assert.equal(validCustomerRequestSnapshot(bad), false);
  }
});
test("quote feedback needs the acknowledged status and exact reason for the requested action", () => {
  const decline = { ok: true, status: "declined", declineReason: "price" };
  assert.equal(validQuoteFeedbackReply(decline, "decline-quote", "price"), true);
  assert.equal(validQuoteFeedbackReply({ ok: true, status: "submitted", declineReason: "" }, "restore-quote", ""), true);
  for (const bad of [null, {}, { ...decline, ok: false }, { ...decline, status: "submitted" }, { ...decline, declineReason: "timing" }]) {
    assert.equal(validQuoteFeedbackReply(bad, "decline-quote", "price"), false);
  }
});
