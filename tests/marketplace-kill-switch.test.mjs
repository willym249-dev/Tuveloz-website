import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

function assertServerGate(route, action) {
  assert.ok(route.includes("runtimeMarketplaceActionAllowed"));
  assert.ok(route.includes("marketplacePausedMessage"));
  assert.ok(route.includes(`\"${action}\"`));
  assert.ok(route.includes("MARKETPLACE_ONBOARDING_ONLY"));
  assert.ok(route.includes("status: 503"));
  assert.ok(route.includes('"cache-control": "no-store"'));
}

test("the central marketplace mode is default closed except for persisted test fixtures", async () => {
  const [launchStatus, runtimeGate, runtimeAction] = await Promise.all([
    source("lib/launch-status.ts"),
    source("lib/runtime-launch-readiness.ts"),
    source("lib/runtime-marketplace-action.ts"),
  ]);
  assert.match(launchStatus, /MARKETPLACE_MODE = "onboarding_only"/);
  assert.match(launchStatus, /return options\.testOnly === true/);
  assert.match(launchStatus, /customerJobPostingPauseBlocks\(action\)/);
  assert.match(launchStatus, /"checkout",[\s\S]*"payout",/);
  assert.match(launchStatus, /options\.runtimeReleaseApproved === true/);
  assert.match(launchStatus, /provider-onboarding mode/);
  assert.match(runtimeGate, /LAUNCH_GATE_CATALOG\.filter\(\(gate\) => gate\.required\)/);
  assert.match(runtimeGate, /eq\(launchGateDecisions\.gateKey, gate\.key\)/);
  assert.match(runtimeGate, /stageState\("provider_onboarding"\)/);
  assert.match(runtimeGate, /stageState\("transaction_pilot"\)/);
  assert.match(runtimeGate, /stageIsApproved\(stage, latest, now\)/);
  assert.match(runtimeGate, /launchDecisionState\(gate, latest\.get\(gate\.key\), now\)/);
  assert.match(runtimeGate, /gateKey: "runtime_database", state: "unavailable"/);
  assert.match(runtimeGate, /runtimeStableInternalChecks/);
  assert.match(runtimeGate, /runtimeLiveInternalChecks/);
  assert.match(runtimeGate, /includeLiveChecks: false/);
  assert.match(runtimeGate, /POLICY_STATUS\) === "active"/);
  assert.match(runtimeGate, /current_written_service_activation/);
  assert.match(runtimeGate, /stripe_live_configuration/);
  assert.match(runtimeAction, /if \(options\.testOnly === true\)/);
  assert.match(runtimeAction, /customerJobPostingPauseBlocks\(action\)/);
  assert.ok(
    runtimeAction.indexOf("customerJobPostingPauseBlocks(action)")
      < runtimeAction.indexOf("runtimeRealMarketplaceReleaseIsApproved()"),
  );
  assert.match(runtimeAction, /runtimeRealMarketplaceReleaseIsApproved\(\)/);
});

test("the customer-job pause independently blocks every real marketplace action", async () => {
  const {
    customerJobPostingPauseBlocks,
    marketplaceActionAllowed,
  } = await import("../lib/launch-status.ts");

  for (const action of [
    "request",
    "discovery",
    "quote",
    "booking",
    "appointment",
    "checkout",
    "job_start",
    "scope_change",
    "completion",
    "payout",
  ]) {
    assert.equal(customerJobPostingPauseBlocks(action), true, action);
    assert.equal(
      marketplaceActionAllowed(action, { runtimeReleaseApproved: true }),
      false,
      action,
    );
  }
  assert.equal(
    marketplaceActionAllowed("checkout", { testOnly: true }),
    true,
    "isolated test fixtures remain available",
  );
});

test("runtime revocation blocks new money but preserves reconciliation and safety cleanup", async () => {
  const [checkout, payments, methods, products, paymentWebhook, jobOperations, paymentHelper, launchReview] = await Promise.all([
    source("app/api/stripe/checkout/route.ts"),
    source("app/api/stripe/admin/payments/route.ts"),
    source("app/api/stripe/customer/payment-methods/route.ts"),
    source("app/api/stripe/products/route.ts"),
    source("app/api/stripe/webhooks/payments/route.ts"),
    source("app/api/job-operations/route.ts"),
    source("lib/stripe-payments.ts"),
    source("app/api/admin/launch-readiness/route.ts"),
  ]);
  const checkoutGet = checkout.slice(
    checkout.indexOf("export async function GET"),
    checkout.indexOf("export async function POST"),
  );
  const checkoutPost = checkout.slice(checkout.indexOf("export async function POST"));
  const paymentGet = payments.slice(
    payments.indexOf("export async function GET"),
    payments.indexOf("export async function POST"),
  );
  const paymentPost = payments.slice(payments.indexOf("export async function POST"));
  const methodDelete = methods.slice(methods.indexOf("export async function DELETE"));
  const launchGet = launchReview.slice(
    launchReview.indexOf("export async function GET"),
    launchReview.indexOf("export async function POST"),
  );
  const launchPost = launchReview.slice(launchReview.indexOf("export async function POST"));

  const checkoutReadGate = checkoutGet.indexOf('runtimeMarketplaceActionAllowed("checkout")');
  assert.ok(checkoutReadGate > checkoutGet.indexOf("if (sessionId)"));
  assert.ok(checkoutGet.indexOf("return Response.json({ payment: publicPaymentSummary(payment) })") < checkoutReadGate);
  assert.ok(checkoutReadGate < checkoutGet.indexOf('const quoteId = clean(searchParams.get("quoteId")'));
  assert.doesNotMatch(paymentGet, /runtimeMarketplaceActionAllowed|runtimeRealMarketplaceReleaseDecision/);
  assert.doesNotMatch(methodDelete, /runtimeMarketplaceActionAllowed|runtimeRealMarketplaceReleaseDecision/);
  assert.doesNotMatch(paymentWebhook, /runtimeMarketplaceActionAllowed|runtimeRealMarketplaceReleaseDecision/);
  assert.match(jobOperations, /checkout\.sessions\.expire/);

  assert.match(checkoutPost, /runtimeRealMarketplaceReleaseDecision\(\)/);
  assert.match(paymentPost, /runtimeRealMarketplaceReleaseDecision\(\)/);
  assert.match(products, /runtimeRealMarketplaceReleaseDecision\(\)/);
  assert.match(methods, /runtimeRealMarketplaceReleaseDecision\(\)/);
  assert.ok(checkoutPost.indexOf("runtimeRealMarketplaceReleaseDecision()") < checkoutPost.indexOf("checkout.sessions.create"));
  assert.ok(checkoutPost.lastIndexOf("runtimeRealMarketplaceReleaseDecision()") > checkoutPost.indexOf("checkout.sessions.create"));
  assert.ok(paymentPost.lastIndexOf("runtimeRealMarketplaceReleaseDecision()") < paymentPost.indexOf("transfers.create"));
  assert.ok(products.lastIndexOf("runtimeRealMarketplaceReleaseDecision()") < products.indexOf("products.create"));
  assert.match(checkoutPost, /tuveloz_launch_onboarding_ids/);
  assert.match(checkoutPost, /tuveloz_launch_valid_through/);
  assert.match(checkoutPost, /expires_at: checkoutExpiresAt/);
  assert.match(checkoutPost, /status: "checkout_release_recheck"/);
  assert.match(checkoutPost, /status: "checkout_expiration_unconfirmed"/);
  assert.match(paymentPost, /tuveloz_launch_pilot_ids/);
  assert.match(paymentHelper, /inArray\(stripePayments\.status, \[/);
  assert.match(paymentHelper, /"checkout_release_recheck"/);
  assert.match(paymentHelper, /"checkout_expiration_unconfirmed"/);
  assert.match(paymentHelper, /gt\(stripePayments\.id, cursor\)/);
  assert.match(paymentHelper, /orderBy\(asc\(stripePayments\.id\)\)/);
  assert.match(paymentHelper, /while \(true\)/);
  assert.match(paymentHelper, /checkout\.sessions\.retrieve/);
  assert.match(paymentHelper, /checkout\.sessions\.expire/);
  assert.match(paymentHelper, /session\.status === "open" \|\| session\.status === "expired"/);
  assert.match(paymentHelper, /checkout_expired_launch_readiness/);
  assert.doesNotMatch(launchGet, /expireOpenCheckoutSessionsForLaunchShutdown/);
  assert.doesNotMatch(launchPost, /runtimeRealMarketplaceReleaseDecision\(\)/);
  assert.match(launchPost, /expireOpenCheckoutSessionsForLaunchShutdown\(\)/);
  assert.match(launchPost, /Any gate-version change invalidates payment links/);
});

test("request, appointment, storefront, checkout, and payout routes fail closed", async () => {
  const [requests, appointments, products, checkout, payments] = await Promise.all([
    source("app/api/requests/route.ts"),
    source("app/api/appointments/route.ts"),
    source("app/api/stripe/products/route.ts"),
    source("app/api/stripe/checkout/route.ts"),
    source("app/api/stripe/admin/payments/route.ts"),
  ]);

  assertServerGate(requests, "request");
  assertServerGate(appointments, "appointment");
  assertServerGate(products, "discovery");
  assertServerGate(checkout, "checkout");
  assertServerGate(payments, "payout");

  assert.ok(requests.indexOf('runtimeMarketplaceActionAllowed("request")') < requests.indexOf("request.formData()"));
  assert.ok(appointments.indexOf('runtimeMarketplaceActionAllowed("appointment")') < appointments.indexOf("request.json()"));
  assert.ok(checkout.indexOf('runtimeMarketplaceActionAllowed("checkout")') < checkout.indexOf("request.json()"));
  assert.ok(payments.indexOf('runtimeMarketplaceActionAllowed("payout"') < payments.indexOf("stripeClient.transfers.create"));
});

test("quotes and job stages derive test isolation from stored records", async () => {
  const [quotes, jobs, operations, accountAuth] = await Promise.all([
    source("app/api/customer-quotes/route.ts"),
    source("app/api/jobs/route.ts"),
    source("app/api/job-operations/route.ts"),
    source("lib/account-auth.ts"),
  ]);

  assertServerGate(quotes, "booking");
  assertServerGate(jobs, "completion");
  assert.ok(jobs.includes('body.action === "save-job-record"'));
  assert.ok(operations.includes('stage: "scope_change"'));
  assert.ok(operations.includes("authorizedTestContext"));
  assert.match(quotes, /testOnly: job\.isTestJob === "yes"/);
  assert.match(jobs, /provider\.isTestProvider === "yes" && assignedJob\.isTestJob === "yes"/);
  assert.match(jobs, /provider\.isTestProvider === "yes" && job\.isTestJob === "yes"/);
  assert.match(jobs, /eq\(customerRequests\.isTestJob, provider\.isTestProvider\)/);
  assert.match(jobs, /testProviderAccountFor\(session\.email\)/);
  assert.match(accountAuth, /export async function testProviderAccountFor/);
  assert.match(accountAuth, /eq\(providerApplications\.isTestProvider, "yes"\)/);
  assert.match(accountAuth, /Only explicitly test-only marketplace routes may call this/);
  assert.doesNotMatch(quotes, /body\.testOnly|searchParams\.get\("testOnly"\)/);
  assert.doesNotMatch(jobs, /body\.testOnly|searchParams\.get\("testOnly"\)/);
});

test("provider alerts and adjacent job operations cannot wake real marketplace work", async () => {
  const [alerts, reminders, messages, tracking, publicProvider] = await Promise.all([
    source("lib/provider-alerts.ts"),
    source("lib/request-reminders.ts"),
    source("app/api/messages/route.ts"),
    source("app/api/tracking/route.ts"),
    source("app/api/public-provider/route.ts"),
  ]);

  assert.ok(alerts.includes('runtimeMarketplaceActionAllowed("discovery", { testOnly: job.isTestJob === "yes" })'));
  assert.ok(alerts.includes('runtimeMarketplaceActionAllowed("booking", { testOnly: job.isTestJob === "yes" })'));
  assert.ok(reminders.indexOf('runtimeMarketplaceActionAllowed("discovery")') < reminders.indexOf("const db = getDb()"));
  assertServerGate(messages, "job_start");
  assertServerGate(tracking, "job_start");
  assertServerGate(publicProvider, "discovery");
  assert.match(publicProvider, /if \(!privatePreview && !publicDiscoveryAllowed\)/);
  assert.match(publicProvider, /servingPublicProfile = publicAccess && publicDiscoveryAllowed/);
  assert.match(tracking, /if \(action === "stop"\)/);
  assert.match(tracking, /return Response\.json\(\{ ok: true, sharing: false \}\)/);
});

test("public input cannot manufacture a test-fixture exemption", async () => {
  const routes = await Promise.all([
    source("app/api/requests/route.ts"),
    source("app/api/jobs/route.ts"),
    source("app/api/customer-quotes/route.ts"),
    source("app/api/appointments/route.ts"),
    source("app/api/stripe/checkout/route.ts"),
  ]);

  for (const route of routes) {
    assert.doesNotMatch(route, /body\.(?:testOnly|isTestJob|isTestProvider)/);
    assert.doesNotMatch(
      route,
      /searchParams\.get\(["'](?:testOnly|isTestJob|isTestProvider)["']\)/,
    );
  }
});

test("launch mode leaves customer accounts and provider applications open", async () => {
  const [accountAuth, passwordRequest, passwordComplete, challenge, providers] =
    await Promise.all([
      source("lib/account-auth.ts"),
      source("app/api/auth/password/request/route.ts"),
      source("app/api/auth/password/complete/route.ts"),
      source("app/api/providers/challenge/route.ts"),
      source("app/api/providers/route.ts"),
    ]);

  assert.match(accountAuth, /role === "customer" \|\| roles\.includes\(role\)/);
  assert.match(accountAuth, /insert\(accountCredentials\)/);
  assert.match(passwordRequest, /requestPasswordVerification/);
  assert.match(passwordComplete, /completePasswordVerification/);
  assert.match(providers, /verifyProviderApplicationChallenge/);
  assert.match(providers, /insert\(providerApplications\)/);

  for (const route of [passwordRequest, passwordComplete, challenge, providers]) {
    assert.doesNotMatch(
      route,
      /CUSTOMER_JOB_POSTING_PAUSED|runtimeMarketplaceActionAllowed/,
    );
  }
});
