import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("service policy preserves provider business freedom while applying narrow gates", async () => {
  const policy = await source("lib/service-safety-policy.ts");

  assert.match(policy, /Providers set their own prices, availability, service areas, and appointment options/);
  assert.match(policy, /Providers may accept or decline each request without a required acceptance rate/);
  assert.match(policy, /Providers decide the lawful method, tools, staffing, and sequence/);
  assert.match(policy, /Providers may work for customers directly, use other platforms/);
  assert.match(policy, /key: "fuel-delivery"[\s\S]*availability: "paused"/);
  assert.match(policy, /key: "lockout"[\s\S]*availability: "gated"/);
  assert.match(policy, /Additional work or additional charges require a separate written change order/);
  assert.match(policy, /The independent provider, not Tuveloz, performs the service/);
});

test("service standards and provider tools do not imply live marketplace access", async () => {
  const [standards, toolkit, providerWorkspace] = await Promise.all([
    source("app/service-standards/page.tsx"),
    source("app/provider-jobs/toolkit/page.tsx"),
    source("app/provider-jobs/page.tsx"),
  ]);

  assert.match(standards, /Current status: provider onboarding only/);
  assert.match(standards, /they do not show live availability/);
  assert.doesNotMatch(standards, /availability === "standard" \? "is-active"/);
  assert.match(toolkit, /open for provider onboarding only/);
  assert.match(toolkit, /Return to provider workspace/);
  assert.doesNotMatch(toolkit, /Open available jobs/);
  assert.match(providerWorkspace, /TUVELOZ is accepting provider applications and evidence only/);
  assert.match(providerWorkspace, /Real job access is closed/);
  assert.match(providerWorkspace, /Approval does not activate any job or service/);
});

test("provider activation and automatic routing keep exact-service gates authoritative", async () => {
  const [compliance, credentials, requests] = await Promise.all([
    source("lib/provider-compliance.ts"),
    source("lib/provider-credentials.ts"),
    source("app/api/requests/route.ts"),
  ]);

  assert.match(compliance, /providerServiceIsPaused/);
  assert.match(compliance, /blockers\.push\(safetyPolicy\.activationSummary\)/);
  assert.match(compliance, /locksmithCredential/);
  assert.match(credentials, /maryland-locksmith-business-license/);
  assert.match(credentials, /maryland-locksmith-technician-registration/);
  assert.match(credentials, /do not collect or store fingerprint or criminal-history documents/);
  assert.match(requests, /decideAutomaticJobRouting/);
  assert.match(requests, /if \(!automaticDecision\.allowed\)/);
  assert.match(requests, /automaticDecision\.activationDecisionIds/);
  assert.doesNotMatch(requests, /pausedCustomerServices/);
});

test("accepted quotes become durable initial authorizations and existing records are backfilled", async () => {
  const migration = await source("drizzle/0033_provider_freedom_authorizations.sql");

  assert.match(migration, /CREATE TABLE `job_authorizations`/);
  assert.match(migration, /CREATE TABLE `job_authorization_events`/);
  assert.match(migration, /CHECK \(`total_cents` = `labor_cents` \+ `parts_cents` \+ `other_fees_cents`\)/);
  assert.match(migration, /WHERE quote\.`status` = 'accepted'/);
  assert.match(migration, /accepted_quote_creates_initial_authorization_update/);
  assert.match(migration, /accepted_quote_creates_initial_authorization_insert/);
  assert.match(migration, /Any additional work or additional charge still requires a separate change order/);
});

test("work-order API separates provider proposals from customer authorization", async () => {
  const api = await source("app/api/job-authorizations/route.ts");

  assert.match(api, /Only the selected provider can create a work order or change order/);
  assert.match(api, /Only the customer for this job can accept or decline the authorization/);
  assert.match(api, /consentAccepted !== true/);
  assert.match(api, /No additional work or charge is authorized unless you accept it/);
  assert.match(api, /The declined work or charge is not authorized/);
  assert.match(api, /PROVIDER_WORK_ORDER_VERSION/);
  assert.match(api, /CUSTOMER_WORK_ORDER_VERSION/);
  assert.match(api, /isSameOriginRequest/);
  assert.match(api, /authorizeScopeMutation/);
  assert.match(api, /CUSTOMER_JOB_POSTING_PAUSED/);
  assert.match(api, /evaluateAssignedJobStage/);
  assert.match(api, /stage: "scope_change"/);
  assert.match(api, /currentProviderMatchesContext/);
  assert.match(api, /decision === "accepted"/);
  assert.match(api, /transactionActionsAvailable/);
  assert.doesNotMatch(api, /stripePayments/);
  assert.doesNotMatch(api, /payment_intent/);
  assert.doesNotMatch(api, /service_address/);
  assert.doesNotMatch(api, /serviceAddress/);
});

test("authorization actions close during onboarding without hiding participant evidence", async () => {
  const [page, evidence, evidenceImage] = await Promise.all([
    source("app/job-authorizations/page.tsx"),
    source("app/api/job-evidence/route.ts"),
    source("app/api/job-evidence/image/route.ts"),
  ]);

  assert.match(page, /Creating or accepting work, change, or scope authorizations is disabled/);
  assert.match(page, /job\.transactionActionsAvailable/);
  assert.match(evidence, /provider\.is_test_provider = request\.is_test_job/);
  assert.match(evidenceImage, /provider\.is_test_provider = request\.is_test_job/);
  assert.match(evidence, /Only the customer and selected provider can add records to this accepted job/);
});

test("Job agreements UI lets providers state their own terms and customers decide", async () => {
  const [page, standards, worker] = await Promise.all([
    source("app/job-authorizations/page.tsx"),
    source("app/service-standards/page.tsx"),
    source("worker/index.ts"),
  ]);

  assert.match(page, /Set your own scope, price, timing, and warranty/);
  assert.match(page, /Accept written authorization/);
  assert.match(page, /Decline/);
  assert.match(page, /does not make Tuveloz the vehicle-service provider/);
  assert.match(page, /Diagnostic only — no repair authorized/);
  assert.match(standards, /What providers continue to control/);
  assert.match(standards, /What Tuveloz does not promise/);
  assert.match(worker, /"\/job-authorizations"/);
});
