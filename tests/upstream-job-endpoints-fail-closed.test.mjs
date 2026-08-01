import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("new work and change authorizations use the central current-eligibility gate", async () => {
  const [route, page] = await Promise.all([
    source("app/api/job-authorizations/route.ts"),
    source("app/job-authorizations/page.tsx"),
  ]);

  assert.match(route, /CUSTOMER_JOB_POSTING_PAUSED/);
  assert.match(route, /runtimeMarketplaceActionAllowed\("scope_change"\)/);
  assert.match(route, /assignedJobOperationContext\(requestId, providerEmail\)/);
  assert.match(route, /evaluateAssignedJobStage\(\{[\s\S]*stage: "scope_change"/);
  assert.match(route, /currentProviderMatchesContext\(decision\.context\)/);
  assert.match(route, /initialContext\.isTestJob !== initialContext\.isTestProvider/);

  const createGate = route.indexOf("const scopeAuthorization = await authorizeScopeMutation(requestId, provider.email)");
  const createWrite = route.indexOf("`INSERT INTO job_authorizations");
  assert.ok(createGate >= 0 && createGate < createWrite, "provider proposal must be gated before insertion");

  const acceptBranch = route.indexOf('if (decision === "accepted")');
  const responseWrite = route.indexOf("`UPDATE job_authorizations", acceptBranch);
  assert.ok(acceptBranch >= 0 && acceptBranch < responseWrite, "customer acceptance must be gated before update");
  assert.match(page, /job\.transactionActionsAvailable/);
  assert.match(page, /Creating or accepting work, change, or scope authorizations is disabled/);
  assert.match(page, /Decline/);
  assert.match(page, /Withdraw pending authorization/);
});

test("new accepted-job record queries preserve real/test isolation", async () => {
  const [authorizations, evidence, image] = await Promise.all([
    source("app/api/job-authorizations/route.ts"),
    source("app/api/job-evidence/route.ts"),
    source("app/api/job-evidence/image/route.ts"),
  ]);

  for (const route of [authorizations, evidence, image]) {
    assert.match(route, /provider\.is_test_provider = request\.is_test_job/);
  }
  assert.match(evidence, /Only the customer and selected provider can add records/);
  assert.doesNotMatch(evidence, /evaluateAssignedJobStage/);
  assert.doesNotMatch(evidence, /stripePayments|payment_intent/);
  assert.match(image, /lower\(provider\.email\) = lower\(evidence\.provider_email\)/);
});
