import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("legacy test-fixture actions can never transition to real verification", async () => {
  const route = await read("app/api/admin/providers/route.ts");
  const workflow = route.slice(0, route.indexOf('if (body.status !== "declined")'));
  const markTest = route.slice(
    route.indexOf('if (body.action === "mark-test")'),
    route.indexOf('if (body.status !== "declined")'),
  );

  assert.match(workflow, /body\.action === "save-credential" \|\| body\.action === "verify"/);
  assert.match(workflow, /code: "LEGACY_VERIFICATION_DISABLED"/);
  assert.doesNotMatch(workflow, /if \(body\.action === "verify"\)/);
  assert.doesNotMatch(workflow, /verificationStatus: "verified"/);
  assert.doesNotMatch(workflow, /isTestProvider: "no"/);

  assert.match(markTest, /REAL_RECORD_TEST_CONVERSION_DISABLED/);
  assert.match(markTest, /status: 409/);
  assert.match(markTest, /cannot be converted into a test fixture/);
  assert.doesNotMatch(markTest, /db\.update|verificationStatus: "test"|isTestProvider: "yes"/);

  const requestRoute = await read("app/api/admin/requests/route.ts");
  const requestMarkTest = requestRoute.slice(
    requestRoute.indexOf('if (body.action === "mark-test")'),
    requestRoute.indexOf('if (!["approved", "declined"]'),
  );
  assert.match(requestMarkTest, /REAL_RECORD_TEST_CONVERSION_DISABLED/);
  assert.match(requestMarkTest, /status: 409/);
  assert.doesNotMatch(requestMarkTest, /db\.update|isTestJob: "yes"/);
});

test("test checklist saves remain isolated test state", async () => {
  const route = await read("app/api/admin/providers/route.ts");
  const save = route.slice(
    route.indexOf('if (body.action === "save-verification")'),
    route.indexOf('if (body.action === "mark-test")'),
  );

  assert.match(save, /provider\.isTestProvider !== "yes"/);
  assert.match(save, /verificationStatus: "test"/);
  assert.match(save, /isTestProvider: "yes"/);
  assert.match(save, /alertsEnabled: "no"/);
  assert.match(save, /verifiedAt: ""/);
  assert.match(save, /verifiedBy: ""/);
});

test("normal provider auth requires current v0.11 profile and exact service eligibility", async () => {
  const auth = await read("lib/account-auth.ts");
  const verified = auth.slice(
    auth.indexOf("async function verifiedProviderFor"),
    auth.indexOf("export async function providerApplicationFor"),
  );
  const isolatedTest = auth.slice(
    auth.indexOf("export async function testProviderAccountFor"),
  );

  assert.match(verified, /providerPathwayProfiles/);
  assert.match(verified, /profile\.status !== "active"/);
  assert.match(verified, /profile\.policyVersion !== POLICY_VERSION/);
  assert.match(verified, /profile\.relationshipPath !== "independent_startup"/);
  assert.match(verified, /profile\.registrationHolderId !== provider\.id/);
  assert.match(verified, /provider\.serviceRulesVersion !== POLICY_VERSION/);
  assert.match(verified, /providerServiceEligibility/);
  assert.match(verified, /providerServiceEligibility\.eligibilityState, "eligible"/);
  assert.match(verified, /row\.policyVersion === POLICY_VERSION/);
  assert.match(verified, /validThrough >= now/);
  assert.match(verified, /approvedServices\.every\(\(serviceCode\) => eligibleServiceCodes\.has\(serviceCode\)\)/);

  assert.match(isolatedTest, /providerApplications\.verificationStatus, "test"/);
  assert.match(isolatedTest, /providerApplications\.isTestProvider, "yes"/);
  assert.match(auth, /export async function providerAccountFor[\s\S]*return verifiedProviderFor\(email\)/);
});
