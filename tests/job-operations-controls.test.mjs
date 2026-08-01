import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("job start, completion, scope change, and payout call the central eligibility adapter", async () => {
  const [jobs, operations, payments, helper] = await Promise.all([
    read("app/api/jobs/route.ts"),
    read("app/api/job-operations/route.ts"),
    read("app/api/stripe/admin/payments/route.ts"),
    read("lib/job-operations.ts"),
  ]);

  assert.match(jobs, /stage: "job_start"/);
  assert.match(jobs, /arrivalJobFacts: body\.arrivalJobFacts/);
  assert.doesNotMatch(jobs, /stage: nextStatus === "completed" \? "completion" : "job_start"/);
  assert.match(jobs, /stage: "completion"/);
  assert.match(operations, /stage: "scope_change"/);
  assert.match(operations, /stage: "payout"/);
  assert.match(payments, /stage: "payout"/);
  assert.match(helper, /evaluateStageEligibility\(\{/);
  for (const field of [
    "serviceCodes",
    "jurisdiction",
    "scheduledFor",
    "personId",
    "supervisorPersonId",
    "scopeVersion",
    "assignmentVersion",
  ]) {
    assert.ok(helper.includes(field));
  }
  assert.doesNotMatch(helper, /body\.providerId|body\.personId|body\.jurisdiction/);
});

test("provider quotes persist the exact scheduled scope, performer, and quote authorization", async () => {
  const jobs = await read("app/api/jobs/route.ts");
  assert.match(jobs, /stage: "quote"/);
  assert.match(jobs, /serviceCodes\.length !== 1/);
  assert.match(jobs, /approvedExactServices\.has\(serviceCodes\[0\]\)/);
  assert.match(jobs, /providerPathwayProfiles\.status, "active"/);
  assert.match(jobs, /providerPersonnel\.status, "active"/);
  for (const storedField of [
    "serviceCodes: JSON.stringify(serviceCodes)",
    "performingPersonId,",
    "supervisorPersonId:",
    "scheduledFor: job.scheduledFor",
    "scopeVersion,",
    "authorizationDecisionId: eligibility.decisionId",
  ]) {
    assert.ok(jobs.includes(storedField), storedField);
  }
});

test("only matching persisted test jobs can use the operations API", async () => {
  const operations = await read("app/api/job-operations/route.ts");
  assert.match(operations, /!context\.isTestJob \|\| !context\.isTestProvider/);
  assert.match(operations, /REAL_JOB_OPERATIONS_DISABLED/);
  assert.match(operations, /actorCanAccess/);
  assert.match(operations, /isSameOriginRequest/);
  assert.doesNotMatch(operations, /body\.isTestJob|body\.testOnly/);
  assert.match(operations, /stripeExecutionAllowed: false/);
});

test("added work requires exact-service eligibility and immutable customer authorization evidence", async () => {
  const operations = await read("app/api/job-operations/route.ts");
  const schema = await read("db/schema.ts");
  assert.match(operations, /action === "propose-change-order"/);
  assert.match(operations, /item === "general_auto_repair"/);
  assert.match(operations, /pending_customer/);
  assert.match(operations, /action === "authorize-change-order"/);
  assert.match(operations, /authorizationAccepted/);
  assert.match(operations, /affirmative-change-order-authorization-checkbox/);
  assert.doesNotMatch(operations, /unchecked-affirmative-checkbox/);
  assert.match(operations, /agreementHash/);
  assert.match(operations, /scopeSnapshot/);
  assert.match(operations, /customerAuthorizedAt/);
  assert.match(operations, /supersedesScopeVersionId/);
  assert.match(operations, /candidateJobFacts/);
  assert.match(operations, /jobScopeFactsFromScopeDetails/);
  assert.match(operations, /authorizationPrerequisite/);
  assert.match(operations, /const authorizationBatch = await db\.batch/);
  assert.match(schema, /customer_agreement_acceptances/);
  assert.match(schema, /job_change_orders/);
  assert.match(schema, /job_scope_versions/);
});

test("delayed work, completion, and payout recheck current facts and the actual start decision", async () => {
  const [jobs, operations, helper, engine, paymentAdmin, providerPage] = await Promise.all([
    read("app/api/jobs/route.ts"),
    read("app/api/job-operations/route.ts"),
    read("lib/job-operations.ts"),
    read("lib/provider-eligibility-engine.ts"),
    read("app/api/stripe/admin/payments/route.ts"),
    read("app/provider-jobs/page.tsx"),
  ]);
  assert.match(engine, /input\.effectiveAt/);
  assert.match(engine, /scheduledAt && scheduledAt\.getTime\(\) > effectiveAt\.getTime\(\)/);
  assert.match(helper, /jobAuthorizationDecisionMatchesContext/);
  assert.match(helper, /profile\.jobFactsSource !== expectedSource/);
  assert.match(helper, /parseJobScopeFacts\(profile\.jobFactsSnapshot\)/);
  assert.match(helper, /actualStartFactsForContext/);
  assert.match(helper, /compareArrivalJobScopeFacts/);
  assert.match(engine, /jobFactsSnapshot: jobFactsEvaluation\.facts/);
  assert.match(engine, /fresh_arrival_job_facts_required/);
  assert.match(engine, /matching_actual_start_snapshot_required/);
  assert.match(jobs, /CURRENT_ACTUAL_JOB_START_REQUIRED/);
  assert.match(jobs, /workStatus === "in progress"/);
  assert.match(jobs, /effectiveAt: now/);
  assert.match(operations, /effectiveAt: now/);
  assert.match(paymentAdmin, /jobAuthorizationDecisionMatchesContext/);
  assert.match(providerPage, /Fresh provider arrival-safety check/);
  assert.match(providerPage, /arrival-high-voltage/);
  assert.match(providerPage, /arrival-prohibited/);
  assert.match(providerPage, /Validate arrival facts and start timer/);
});

test("checkout and payment records consume the latest authorized scope and full price snapshot", async () => {
  const [checkout, operations, paymentHelper, schema, migration, card] = await Promise.all([
    read("app/api/stripe/checkout/route.ts"),
    read("app/api/job-operations/route.ts"),
    read("lib/stripe-payments.ts"),
    read("db/schema.ts"),
    read("drizzle/0039_typical_baron_zemo.sql"),
    read("app/components/quote-payment-card.tsx"),
  ]);
  assert.match(checkout, /jobScopeVersions/);
  assert.match(checkout, /latestScope\.version === 1 \? "booking" : "scope_change"/);
  assert.match(checkout, /jobScopeFactsFromScopeDetails/);
  assert.match(checkout, /authorizedPriceSnapshot = latestScope\.priceBreakdown/);
  assert.match(checkout, /CHECKOUT_PAYMENT_SCOPE_SNAPSHOT_MISMATCH/);
  assert.match(checkout, /CHECKOUT_SCOPE_CHANGED_DURING_CREATION/);
  assert.match(checkout, /checkout\.sessions\.expire/);
  assert.match(checkout, /eq\(stripePayments\.status, "checkout_creating"\)/);
  assert.match(operations, /invalidateStaleCheckoutBeforeScopeChange/);
  assert.match(operations, /checkout_invalidated_scope_change/);
  assert.match(operations, /old_checkout_url_expired_before_scope_or_price_change/);
  assert.match(operations, /notExists/);
  assert.match(operations, /const invalidationBatch = await db\.batch/);
  assert.match(paymentHelper, /payment\.status !== "checkout_open"/);
  assert.match(paymentHelper, /local scope binding is no longer current/);
  assert.match(schema, /authorizedPriceSnapshot/);
  assert.match(migration, /authorized_price_snapshot/);
  assert.match(card, /Provider labor/);
  assert.match(card, /Parts charged through Tuveloz/);
  assert.match(card, /Complete authorized labor amount/);
  assert.doesNotMatch(card, /Authorized tax and other charges/);
  assert.match(card, /Authorized job scope version/);
});

test("cancellation, no-show, incident, invoice, refund, dispute, and reserve controls persist without money movement", async () => {
  const operations = await read("app/api/job-operations/route.ts");
  for (const action of [
    "report-cancellation",
    "report-incident",
    "stop-work",
    "submit-invoice",
    "request-refund",
    "acknowledge-invoice",
    "decide-refund",
    "decide-cancellation",
    "resolve-incident",
    "record-payment-hold",
    "resolve-payment-hold",
    "review-payout",
  ]) {
    assert.ok(operations.includes(`action === "${action}"`), action);
  }
  assert.match(operations, /workStatus: "stop work"/);
  assert.match(operations, /holdPayments: "yes"/);
  assert.match(operations, /warrantyTerms/);
  assert.match(operations, /returnedPartsChoice/);
  assert.match(operations, /approved_test_only/);
  assert.match(operations, /transferCreated: false/);
  assert.doesNotMatch(
    operations,
    /transfers\.create|refunds\.create|paymentIntents\.create|checkout\.sessions\.create/,
  );
  assert.match(operations, /checkout\.sessions\.expire/);
});

test("completion never marks a payment ready and payout checks every operational hold", async () => {
  const [jobs, stripePayments, paymentAdmin, helper] = await Promise.all([
    read("app/api/jobs/route.ts"),
    read("lib/stripe-payments.ts"),
    read("app/api/stripe/admin/payments/route.ts"),
    read("lib/job-operations.ts"),
  ]);
  assert.doesNotMatch(jobs, /status: "ready_for_release"/);
  assert.doesNotMatch(stripePayments, /job\?\.status === "completed"/);
  assert.match(paymentAdmin, /assessPayoutReadiness/);
  for (const code of [
    "job_not_completed",
    "completion_eligibility_missing",
    "provider_timer_running",
    "final_invoice_missing",
    "invoice_total_not_authorized",
    "unauthorized_change_order",
    "open_incident",
    "open_claim",
    "unresolved_cancellation",
    "refund_hold",
    "dispute_hold",
    "reserve_hold",
  ]) {
    assert.ok(helper.includes(code), code);
  }
});

test("live Stripe and customer payment mutations stay code-disabled during onboarding", async () => {
  const [stripe, paymentMethods, checkout, paymentAdmin] = await Promise.all([
    read("lib/stripe.ts"),
    read("app/api/stripe/customer/payment-methods/route.ts"),
    read("app/api/stripe/checkout/route.ts"),
    read("app/api/stripe/admin/payments/route.ts"),
  ]);
  assert.match(stripe, /STRIPE_LIVE_MODE_ENABLED = false/);
  assert.match(stripe, /!stripeLiveModeEnabled\(\)/);
  assert.match(paymentMethods, /runtimeMarketplaceActionAllowed\("checkout"\)/);
  assert.match(paymentMethods, /runtimeRealMarketplaceReleaseDecision\(\)/);
  assert.match(checkout, /UNSCOPED_PRODUCT_CHECKOUT_DISABLED/);
  assert.ok(paymentMethods.lastIndexOf("runtimeRealMarketplaceReleaseDecision()") < paymentMethods.indexOf("checkout.sessions.create"));
  assert.ok(checkout.indexOf("runtimeRealMarketplaceReleaseDecision()") < checkout.indexOf("checkout.sessions.create"));
  assert.ok(checkout.lastIndexOf("runtimeRealMarketplaceReleaseDecision()") > checkout.indexOf("checkout.sessions.create"));
  assert.ok(paymentAdmin.lastIndexOf("runtimeRealMarketplaceReleaseDecision()") < paymentAdmin.indexOf("transfers.create"));
  const deleteBlock = paymentMethods.slice(paymentMethods.indexOf("export async function DELETE"));
  assert.doesNotMatch(deleteBlock, /runtimeMarketplaceActionAllowed|runtimeRealMarketplaceReleaseDecision/);
});

test("the public review page explains all operational stages and test-only limits", async () => {
  const [page, consoleSource, operations] = await Promise.all([
    read("app/job-operations/page.tsx"),
    read("app/job-operations/job-operations-console.tsx"),
    read("app/api/job-operations/route.ts"),
  ]);
  for (const phrase of [
    "test records only",
    "Added work and price changes",
    "Cancellations and no-shows",
    "Incidents, injuries, property damage, and stop-work",
    "Final invoice and warranty disclosure",
    "Refunds, disputes, and reserves",
    "Payout release remains fail-closed",
  ]) {
    assert.ok(page.includes(phrase), phrase);
  }
  assert.match(page, /<JobOperationsConsole \/>/);
  assert.match(consoleSource, /searchParams\.get\("requestId"\)/);
  assert.match(consoleSource, /fetch\(`\/api\/job-operations\?requestId=/);
  assert.match(consoleSource, /fetch\("\/api\/job-operations"/);
  assert.match(consoleSource, /data\.transferExecutionEnabled !== false/);
  assert.match(consoleSource, /TUVELOZ does not employ providers or trainees/);
  assert.match(consoleSource, /cannot create a real job, charge, refund, payout, transfer, or transfer reversal/);
  for (const section of [
    "Cancellations and no-shows",
    "Incidents, claims, and stop-work",
    "Change orders",
    "Provider invoices and warranty",
    "Refunds, reserves, and disputes",
    "Immutable lifecycle history",
  ]) {
    assert.ok(consoleSource.includes(section), section);
  }
  for (const action of [
    "propose-change-order",
    "authorize-change-order",
    "report-cancellation",
    "report-incident",
    "stop-work",
    "submit-invoice",
    "request-refund",
    "acknowledge-invoice",
    "decide-refund",
    "decide-cancellation",
    "resolve-incident",
    "record-payment-hold",
    "resolve-payment-hold",
    "review-payout",
  ]) {
    assert.ok(consoleSource.includes(`action=\"${action}\"`), action);
  }
  assert.match(operations, /actorRole: actor\.role/);
  assert.match(operations, /changeOrders: changes\.map/);
  assert.match(operations, /invoices: invoices\.map/);
  assert.doesNotMatch(consoleSource, /stripeClient|transfers\.create|refunds\.create/);
});
