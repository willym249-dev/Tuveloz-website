import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("owner readiness is derived from the canonical fail-closed runtime decision", async () => {
  const [route, runtime, page] = await Promise.all([
    read("app/api/admin/launch-readiness/route.ts"),
    read("lib/runtime-launch-readiness.ts"),
    read("app/admin/launch-readiness/page.tsx"),
  ]);

  assert.match(route, /import \{ runtimeLaunchReadiness \}/);
  assert.match(route, /canonicalRuntimeReadiness[\s\S]*runtimeLaunchReadiness\(\)/);
  assert.match(
    route,
    /providerOnboardingReviewComplete:\s*canonicalRuntimeReadiness\.providerOnboardingApproved/,
  );
  assert.match(route, /const canonicalRuntimeApproved = canonicalRuntimeReadiness\.providerOnboardingApproved[\s\S]*&& canonicalRuntimeReadiness\.transactionPilotApproved/);
  assert.match(route, /realTransactionsEnabled:\s*canonicalRuntimeApproved[\s\S]*!CUSTOMER_JOB_POSTING_PAUSED/);
  assert.match(runtime, /key: "approved_identity_verification_provider"/);
  assert.match(route, /configuredExternalIdentityVerificationProviders\(\)/);
  assert.match(route, /key: "approved_identity_verification_provider"/);
  assert.match(route, /workplan: \{[\s\S]*jobBlockers,[\s\S]*paymentBlockers,/);
  assert.match(route, /key: "transaction_safety_switches",[\s\S]*contextOnly: true/);
  assert.match(route, /key: "stripe_sandbox_first",[\s\S]*contextOnly: true/);
  assert.match(page, /Why customer jobs are blocked/);
  assert.match(page, /Why payments and payouts are blocked/);
  assert.match(page, /gate\.stage === stage && !gate\.contextOnly/);
  assert.match(page, /Stage-context cards are informational only/);
  assert.match(page, /live-stage context/);
  assert.match(page, /Responsible:/);
  assert.match(page, /Next action:/);
});

test("every shared policy release becomes an explicit runtime and owner blocker until active", async () => {
  const [manifestText, manifestHelper, runtime, route] = await Promise.all([
    read("config/policy-releases.json"),
    read("lib/policy-release-manifest.ts"),
    read("lib/runtime-launch-readiness.ts"),
    read("app/api/admin/launch-readiness/route.ts"),
  ]);
  const manifest = JSON.parse(manifestText);
  const expectedKeys = [
    "terms",
    "customer_agreement",
    "provider_agreement",
    "privacy",
    "payment_policy",
    "marketplace_conduct",
    "provisional_provider_policy",
  ];

  assert.deepEqual(Object.keys(manifest).sort(), expectedKeys.sort());
  assert.match(manifestHelper, /export const POLICY_RELEASE_KEYS/);
  assert.match(manifestHelper, /export function allPolicyDocumentReleases/);
  assert.match(manifestHelper, /export function policyDocumentReleaseIsActive/);
  assert.match(runtime, /\.\.\.allPolicyDocumentReleases\(\)\.map/);
  assert.match(runtime, /key: `policy_release_\$\{release\.key\}`/);
  assert.match(runtime, /passed: policyDocumentReleaseIsActive\(release\)/);
  assert.match(route, /\.\.\.policyReleases\.map/);
  assert.match(route, /Publish an active, effective, versioned, source-hash-bound release/);
  for (const key of expectedKeys) {
    assert.match(route, new RegExp(`${key}: \\{ title:`));
  }
});

test("the owner workplan is informational and cannot activate jobs or payments", async () => {
  const route = await read("app/api/admin/launch-readiness/route.ts");
  const post = route.slice(route.indexOf("export async function POST"));

  assert.match(route, /Activation stays separate from evidence review/);
  assert.match(route, /Keep this switch off until every mandatory readiness blocker is cleared/);
  assert.doesNotMatch(post, /CUSTOMER_JOB_POSTING_PAUSED\s*=/);
  assert.doesNotMatch(post, /MARKETPLACE_MODE\s*=/);
  assert.doesNotMatch(post, /STRIPE_LIVE_MODE_ENABLED\s*=/);
});

test("the customer-job pause is enforced by the shared request and money action gate", async () => {
  const launchStatus = await read("lib/launch-status.ts");

  assert.match(launchStatus, /CUSTOMER_JOB_POSTING_PAUSE_ACTIONS[\s\S]*"request",[\s\S]*"checkout",[\s\S]*"payout",/);
  assert.match(launchStatus, /!customerJobPostingPauseBlocks\(action\)[\s\S]*String\(MARKETPLACE_MODE\) === "live"/);
  assert.match(launchStatus, /return options\.testOnly === true \|\|/);
});

test("public onboarding and the owner workplan state the Montgomery County pathway holds", async () => {
  const [home, page] = await Promise.all([
    read("app/page.tsx"),
    read("app/admin/launch-readiness/page.tsx"),
  ]);

  for (const source of [home, page]) {
    assert.match(source, /no unregistered simple-repair lane/i);
    assert.match(source, /ch_31a_02152011\.pdf/);
    assert.match(source, /motor-vehicle-repair-maintenance-towing/);
  }
  assert.match(home, /A learning account has no customer work/);
  assert.match(home, /provider-of-record, insurance,[\s\S]*workers&apos; compensation,[\s\S]*supervision workflow/);
  assert.match(page, /broker-confirmed coverage for every exact service/);
  assert.match(page, /Specialty services remain unavailable until every applicable license/);
  assert.match(page, /they do not guarantee that Tuveloz has no liability/);
  assert.match(page, /all customer work remains disabled/);
});
