import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  POLICY_REACCEPTANCE_TEXT,
  outstandingPolicyDocuments,
  policyAcceptanceIsCurrent,
  policyAcceptanceStatus,
  policyBundleForRole,
} from "../lib/policy-reacceptance.ts";
import {
  CUSTOMER_POLICY_BUNDLE_VERSION,
  PROVIDER_POLICY_BUNDLE_VERSION,
  TERMS_VERSION,
} from "../lib/policies.ts";

const read = (path) => readFile(new URL(path, new URL("../", import.meta.url)), "utf8");

test("an account that accepted the current bundle is not re-prompted", () => {
  assert.ok(policyAcceptanceIsCurrent([CUSTOMER_POLICY_BUNDLE_VERSION], "customer"));
  assert.ok(policyAcceptanceIsCurrent([PROVIDER_POLICY_BUNDLE_VERSION], "provider"));
  assert.equal(
    policyAcceptanceStatus([CUSTOMER_POLICY_BUNDLE_VERSION], "customer").documents.length,
    0,
  );
});

test("an acceptance recorded under an older terms version requires re-acceptance", () => {
  const staleBundle = CUSTOMER_POLICY_BUNDLE_VERSION
    .replace(`terms:${TERMS_VERSION}`, "terms:2026-08-03");
  assert.notEqual(staleBundle, CUSTOMER_POLICY_BUNDLE_VERSION);
  assert.equal(policyAcceptanceIsCurrent([staleBundle], "customer"), false);
  const outstanding = outstandingPolicyDocuments([staleBundle], "customer");
  assert.equal(outstanding.length, 1);
  assert.equal(outstanding[0].key, "terms");
  assert.equal(outstanding[0].version, TERMS_VERSION);
  assert.equal(outstanding[0].href, "/terms");
});

test("an account with no recorded acceptance owes the whole role bundle", () => {
  const status = policyAcceptanceStatus([], "provider");
  assert.equal(status.current, false);
  assert.equal(status.requiredVersion, PROVIDER_POLICY_BUNDLE_VERSION);
  assert.equal(
    status.documents.length,
    PROVIDER_POLICY_BUNDLE_VERSION.split("|").length,
  );
  assert.ok(status.documents.every((document) => document.title && document.href));
});

test("acceptances are counted per document, so mixed records still satisfy a role", () => {
  const [termsToken, ...customerRest] = CUSTOMER_POLICY_BUNDLE_VERSION.split("|");
  assert.ok(policyAcceptanceIsCurrent(
    [termsToken, customerRest.join("|")],
    "customer",
  ));
  assert.equal(policyBundleForRole("customer"), CUSTOMER_POLICY_BUNDLE_VERSION);
});

test("re-acceptance is an affirmative click recorded with its exact statement", async () => {
  const [routeSource, storeSource, gateSource] = await Promise.all([
    read("app/api/account/policy-acceptance/route.ts"),
    read("lib/policy-reacceptance-store.ts"),
    read("app/components/policy-reacceptance-gate.tsx"),
  ]);
  assert.ok(routeSource.includes("isSameOriginRequest"));
  assert.ok(routeSource.includes("policyAccepted(body.accepted)"));
  assert.ok(routeSource.includes("getAccountSession"));
  assert.ok(storeSource.includes("POLICY_REACCEPTANCE_TEXT"));
  assert.ok(storeSource.includes("policyAcceptances"));
  assert.ok(gateSource.includes("POLICY_REACCEPTANCE_TEXT"));
  assert.ok(gateSource.includes('type="checkbox"'));
  assert.ok(gateSource.includes("30-day window to opt out"));
  assert.ok(POLICY_REACCEPTANCE_TEXT.includes("agree to the updated Terms of Use"));
});

test("both signed-in workspaces block on a stale policy acceptance", async () => {
  const [customerSource, providerSource, accountApiSource] = await Promise.all([
    read("app/customer/page.tsx"),
    read("app/provider-jobs/page.tsx"),
    read("app/api/account/route.ts"),
  ]);
  assert.ok(customerSource.includes("PolicyReacceptanceGate"));
  assert.ok(providerSource.includes("PolicyReacceptanceGate"));
  assert.ok(accountApiSource.includes("policyAcceptanceStatusFor"));
  assert.ok(accountApiSource.includes("policyAcceptance"));
});

test("the policy acceptance log table exists in the schema and migration", async () => {
  const [schemaSource, migrationSource] = await Promise.all([
    read("db/schema.ts"),
    read("drizzle/0054_policy_reacceptance_log.sql"),
  ]);
  assert.ok(schemaSource.includes('sqliteTable(\n  "policy_acceptances"'));
  assert.ok(migrationSource.includes("CREATE TABLE `policy_acceptances`"));
  assert.ok(migrationSource.includes("`bundle_version` text NOT NULL"));
  assert.ok(migrationSource.includes("`acceptance_text`"));
});
