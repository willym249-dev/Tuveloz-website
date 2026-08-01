import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("declining a provider quarantines open checkouts before saving the decline", async () => {
  const route = await read("app/api/admin/providers/route.ts");
  const decline = route.slice(route.indexOf('if (body.status !== "declined")'));
  const cleanup = decline.indexOf("expireOpenCheckoutSessionsForLaunchShutdown()");
  const mutation = decline.indexOf(".update(providerApplications)");
  const afterCleanup = decline.lastIndexOf("expireOpenCheckoutSessionsForLaunchShutdown()");

  assert.match(decline, /provider\.status !== "new"/);
  assert.ok(cleanup >= 0, "decline must invoke checkout quarantine");
  assert.ok(mutation >= 0, "decline must persist the provider mutation");
  assert.ok(cleanup < mutation, "checkout quarantine must happen before provider revocation");
  assert.ok(afterCleanup > mutation, "checkout quarantine must run again after provider revocation");
});

test("a non-clean authenticated scan quarantines open checkouts before recording the result", async () => {
  const route = await read("app/api/internal/evidence-scan-result/route.ts");
  const cleanupGuard = route.indexOf('if (status !== "clean") {');
  const cleanup = route.indexOf(
    "expireOpenCheckoutSessionsForLaunchShutdown()",
    cleanupGuard,
  );
  const claim = route.indexOf("const claimed = await db.update(evidenceFileScans)", cleanupGuard);
  const resultInsert = route.indexOf("await db.insert(evidenceFileScans).values", cleanupGuard);
  const evidenceRevocation = route.indexOf(
    "await db.update(providerEvidenceSubmissions).set",
    cleanupGuard,
  );
  const afterCleanup = route.lastIndexOf("expireOpenCheckoutSessionsForLaunchShutdown()");

  assert.ok(cleanupGuard >= 0, "non-clean scan path must be explicit");
  assert.ok(cleanup > cleanupGuard, "non-clean scan must invoke checkout quarantine");
  assert.ok(cleanup < claim, "quarantine must happen before claiming the pending scan");
  assert.ok(cleanup < resultInsert, "quarantine must happen before recording the revoking scan result");
  assert.ok(cleanup < evidenceRevocation, "quarantine must happen before revoking accepted evidence");
  assert.ok(afterCleanup > evidenceRevocation, "quarantine must run again after the scan revocation");
});

test("checkout cleanup quarantines local payment state before contacting Stripe", async () => {
  const helper = await read("lib/stripe-payments.ts");
  const cleanup = helper.slice(
    helper.indexOf("export async function expireOpenCheckoutSessionsForLaunchShutdown"),
    helper.indexOf("export async function", helper.indexOf("export async function expireOpenCheckoutSessionsForLaunchShutdown") + 1),
  );
  const localQuarantine = cleanup.indexOf('status: "checkout_expiration_unconfirmed"');
  const stripeRetrieve = cleanup.indexOf("stripeClient.checkout.sessions.retrieve");

  assert.match(cleanup, /"checkout_creating"/);
  assert.ok(localQuarantine >= 0, "cleanup must persist a local quarantine state");
  assert.ok(stripeRetrieve >= 0, "cleanup must attempt remote Stripe expiration");
  assert.ok(localQuarantine < stripeRetrieve, "local quarantine must precede the Stripe call");
});

test("every owner eligibility mutation quarantines checkout state on both sides of the write", async () => {
  const route = await read("app/api/admin/provider-compliance/route.ts");
  const cases = [
    ["record-evidence-scan", "review-evidence", "await db.insert(evidenceFileScans).values"],
    ["review-evidence", "identity-age-review", "await db.update(providerEvidenceSubmissions).set"],
    ["identity-age-review", "employer-attestation", "await db.update(providerPersonnel).set"],
    ["employer-attestation", "activate-service", "await db.update(providerPersonnel).set"],
    ["activate-service", "disable-service", "await db.insert(serviceActivationDecisions).values"],
    ["disable-service", "Choose a supported compliance action", "await db.insert(serviceActivationDecisions).values"],
  ];

  for (const [action, nextAction, mutationText] of cases) {
    const start = route.indexOf(`if (action === "${action}")`);
    const end = route.indexOf(nextAction, start + 1);
    const block = route.slice(start, end);
    const beforeCleanup = block.indexOf("expireOpenCheckoutSessionsForLaunchShutdown()");
    const mutation = block.indexOf(mutationText);
    const afterCleanup = block.lastIndexOf("expireOpenCheckoutSessionsForLaunchShutdown()");

    assert.ok(start >= 0 && end > start, `${action} block must be present`);
    assert.ok(beforeCleanup >= 0, `${action} must quarantine before mutation`);
    assert.ok(mutation > beforeCleanup, `${action} mutation must follow the first quarantine`);
    assert.ok(afterCleanup > mutation, `${action} must quarantine again after recalculation`);
  }
});

test("Checkout rechecks provider eligibility after Stripe creation and before opening the link", async () => {
  const route = await read("app/api/stripe/checkout/route.ts");
  const stripeCreate = route.indexOf("stripeClient.checkout.sessions.create");
  const eligibilityRecheck = route.indexOf("const postCreateBookingEligibility");
  const opened = route.indexOf('status: "checkout_open"', eligibilityRecheck);

  assert.ok(stripeCreate >= 0, "Stripe Session creation must be present");
  assert.ok(eligibilityRecheck > stripeCreate, "provider eligibility must be rechecked after creation");
  assert.ok(opened > eligibilityRecheck, "the local Checkout link cannot open before the recheck");
  assert.match(route, /Math\.floor\(postCreateEligibilityExpiry \/ 1000\) < checkoutExpiresAt/);
  assert.match(route, /status: "checkout_expired_eligibility_changed"/);
  assert.match(route, /CHECKOUT_ELIGIBILITY_EXPIRATION_UNCONFIRMED/);
});
