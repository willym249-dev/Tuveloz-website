import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { prescreenEvidence } from "../lib/evidence-review-assistant.ts";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const CLEAN_MATCHING = {
  submissionStatus: "pending",
  matchesCurrentApplication: true,
  requiresExpiration: false,
  hasExpirationDate: true,
  isExpired: false,
  hasPrivateFile: true,
  scanStatus: "clean",
};

test("a clean, current, matching document is only ever readied for a human authenticity check", () => {
  const result = prescreenEvidence(CLEAN_MATCHING);
  assert.equal(result.recommendation, "ready_for_authenticity_check");
  assert.equal(result.readyForOwnerAuthenticityCheck, true);
  // The assistant must never auto-apply an acceptance.
  assert.equal(result.autoDispatch, null);
});

test("an expired document is the one case auto-dispatched — and only as a correction", () => {
  const result = prescreenEvidence({ ...CLEAN_MATCHING, isExpired: true });
  assert.equal(result.recommendation, "needs_correction_expired");
  assert.ok(result.autoDispatch);
  assert.equal(result.autoDispatch.status, "needs_correction");
  assert.equal(result.autoDispatch.reasonCode, "expired_or_invalid_date");
  assert.ok(result.autoDispatch.note.length > 0);
});

test("a required-but-missing expiration date is auto-corrected too", () => {
  const result = prescreenEvidence({
    ...CLEAN_MATCHING,
    requiresExpiration: true,
    hasExpirationDate: false,
  });
  assert.equal(result.recommendation, "needs_correction_expired");
  assert.equal(result.autoDispatch?.status, "needs_correction");
});

test("a submission that no longer matches the application is flagged, never auto-dispatched", () => {
  const result = prescreenEvidence({ ...CLEAN_MATCHING, matchesCurrentApplication: false });
  assert.equal(result.recommendation, "reject_mismatch");
  assert.equal(result.autoDispatch, null);
  assert.equal(result.readyForOwnerAuthenticityCheck, false);
});

test("a file whose scan is not clean is held, not auto-dispatched", () => {
  for (const scanStatus of ["pending", "missing", "failed", "infected", "error"]) {
    const result = prescreenEvidence({ ...CLEAN_MATCHING, scanStatus });
    assert.equal(result.recommendation, "hold_scan_not_clean", `scan ${scanStatus}`);
    assert.equal(result.autoDispatch, null, `scan ${scanStatus}`);
    assert.equal(result.readyForOwnerAuthenticityCheck, false, `scan ${scanStatus}`);
  }
});

test("a document that is not pending is never pre-screened", () => {
  for (const submissionStatus of ["accepted", "rejected", "needs_correction", "expired"]) {
    const result = prescreenEvidence({ ...CLEAN_MATCHING, submissionStatus });
    assert.equal(result.recommendation, "not_awaiting_review", submissionStatus);
    assert.equal(result.autoDispatch, null, submissionStatus);
  }
});

test("acceptance is never an automatic outcome for any input combination", () => {
  const values = [true, false];
  const scans = ["clean", "pending", "missing", "failed", "infected", "error"];
  for (const matchesCurrentApplication of values) {
    for (const requiresExpiration of values) {
      for (const hasExpirationDate of values) {
        for (const isExpired of values) {
          for (const hasPrivateFile of values) {
            for (const scanStatus of scans) {
              const result = prescreenEvidence({
                submissionStatus: "pending",
                matchesCurrentApplication,
                requiresExpiration,
                hasExpirationDate,
                isExpired,
                hasPrivateFile,
                scanStatus,
              });
              if (result.autoDispatch) {
                assert.equal(
                  result.autoDispatch.status,
                  "needs_correction",
                  "the only auto-dispatch is a correction",
                );
              }
            }
          }
        }
      }
    }
  }
});

test("the bulk dispatch endpoint applies only corrections and never accepts", async () => {
  const route = await read("app/api/admin/provider-compliance/route.ts");
  const start = route.indexOf('if (action === "prescreen-dispatch")');
  const end = route.indexOf('if (action === "initialize-provider-pathway")', start);
  assert.ok(start >= 0 && end > start, "prescreen-dispatch branch not found");
  const branch = route.slice(start, end);

  // The bulk write path must set the status straight from the assistant's
  // auto-dispatch (a correction) and must never write an acceptance there.
  assert.match(branch, /status: prescreen\.autoDispatch\.status/);
  assert.doesNotMatch(branch, /"accepted"/);
  assert.doesNotMatch(branch, /authenticityVerificationMethod: [^"]/);
  // It reuses the same audit + notification + recalculation as a manual review.
  assert.match(branch, /automatedPrescreen: true/);
  assert.match(branch, /recalculateProvider\(affectedProviderId, actorId\)/);
});
