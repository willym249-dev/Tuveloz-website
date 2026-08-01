import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  supersededIdentityCleanupBatchLimit,
  supersededIdentityCleanupScanLimit,
} from "../lib/stripe-identity-cleanup-policy.ts";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("scheduled Stripe Identity cleanup is bounded and targets only superseded closed attempts", async () => {
  const [helper, worker] = await Promise.all([
    read("lib/stripe-identity-verification.ts"),
    read("worker/index.ts"),
  ]);
  const start = helper.indexOf("export async function cleanupSupersededStripeIdentitySessions");
  const cleanup = helper.slice(start);
  assert.ok(start >= 0);
  assert.match(cleanup, /supersededIdentityCleanupBatchLimit\(limit\)/);
  assert.match(cleanup, /supersededIdentityCleanupScanLimit\(boundedLimit\)/);
  assert.match(cleanup, /\.limit\(scanLimit\)/);
  assert.match(cleanup, /decisionStatus, "closed"/);
  assert.match(cleanup, /"application_evidence_superseded"/);
  assert.match(cleanup, /stripeVerificationSessionId, ""/);
  assert.match(cleanup, /stripeStatus, "canceled"/);
  assert.match(worker, /scheduledTask\("superseded Stripe Identity session cleanup"/);
  assert.match(worker, /cleanupSupersededStripeIdentitySessions\(5\)/);
});

test("five older skipped rows cannot starve the next cancelable session", async () => {
  const batchLimit = supersededIdentityCleanupBatchLimit(5);
  const candidates = [
    ...Array.from({ length: 5 }, (_, index) => ({ id: `skipped-${index}`, cancelable: false })),
    { id: "later-cancelable", cancelable: true },
  ];
  const scan = candidates.slice(0, supersededIdentityCleanupScanLimit(batchLimit));
  assert.equal(batchLimit, 5);
  assert.equal(scan.find((row) => row.cancelable)?.id, "later-cancelable");

  const helper = await read("lib/stripe-identity-verification.ts");
  const start = helper.indexOf("export async function cleanupSupersededStripeIdentitySessions");
  const cleanup = helper.slice(start);
  assert.match(cleanup, /const deferRow = async/);
  assert.match(cleanup, /updatedAt, row\.updatedAt/);
  assert.ok(
    (cleanup.match(/await deferRow\(row\)/g) ?? []).length >= 5,
    "every permanent skip and failure path must rotate the candidate",
  );
});

test("cleanup revalidates provider mode and complete binding before remote cancellation", async () => {
  const helper = await read("lib/stripe-identity-verification.ts");
  const start = helper.indexOf("export async function cleanupSupersededStripeIdentitySessions");
  const cleanup = helper.slice(start);
  const retrieve = cleanup.indexOf("verificationSessions.retrieve");
  const binding = cleanup.indexOf("stripeIdentitySessionBindingMatches(row, remote)");
  const cancel = cleanup.indexOf("verificationSessions.cancel");
  assert.ok(retrieve >= 0 && binding > retrieve && cancel > binding);
  assert.match(cleanup, /stripeIdentityModeMatchesProvider\(application\.isTestProvider\)/);
  assert.match(cleanup, /remote\.livemode !== \(application\.isTestProvider !== "yes"\)/);
  assert.match(cleanup, /if \(remote\.status === "requires_input"\)/);
  assert.match(cleanup, /else if \(remote\.status !== "canceled"\)/);
  assert.match(cleanup, /canceledSession\.status !== "canceled"/);
});

test("cleanup records cancellation with a closed superseded CAS and logs no raw Stripe error", async () => {
  const helper = await read("lib/stripe-identity-verification.ts");
  const start = helper.indexOf("export async function cleanupSupersededStripeIdentitySessions");
  const cleanup = helper.slice(start);
  const update = cleanup.indexOf("db.update(providerIdentityVerificationSessions)");
  const cas = cleanup.slice(update);
  assert.match(cas, /stripeStatus: "canceled"/);
  assert.match(cas, /decisionStatus, "closed"/);
  assert.match(cas, /"application_evidence_superseded"/);
  assert.match(cas, /stripeVerificationSessionId,[\s\S]*row\.stripeVerificationSessionId/);
  assert.match(cas, /stripeStatus, row\.stripeStatus/);
  assert.doesNotMatch(cleanup, /console\.error\([^\n]*, error\)/);
  assert.match(cleanup, /console\.error\([^\n]*, errorName\)/);
});
