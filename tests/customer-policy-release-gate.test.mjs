import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("customer policies remain draft and require a complete hashed release", async () => {
  const [registry, manifest] = await Promise.all([
    source("lib/customer-policy-acceptance.ts"),
    source("config/policy-releases.json").then(JSON.parse),
  ]);

  for (const [key, release] of Object.entries(manifest)) {
    if (["terms", "provider_agreement", "customer_agreement", "payment_policy", "provisional_provider_policy", "marketplace_conduct", "privacy"].includes(key)) {
      assert.equal(release.releaseStatus, "active");
      assert.match(release.canonicalBodyHash, /^[a-f0-9]{64}$/i);
    } else {
      assert.equal(release.releaseStatus, "draft");
      assert.equal(release.canonicalBodyHash, "");
    }
  }
  assert.match(registry, /policyDocumentRelease\("terms"\)/);
  assert.match(registry, /releaseStatus === "active"/);
  assert.match(registry, /SHA256_HEX\.test\(document\.canonicalBodyHash\)/);
  assert.match(registry, /effectiveAt <= asOf\.getTime\(\)/);
  assert.match(registry, /customerAcceptanceBundleIsReleasedForPurpose/);
  for (const purpose of ["request_scope", "provider_selection", "checkout"]) {
    assert.ok(registry.includes(`"${purpose}"`));
  }
});

test("real request and quote acceptance routes fail closed on unreleased policies", async () => {
  const [requests, quotes, checkout] = await Promise.all([
    source("app/api/requests/route.ts"),
    source("app/api/customer-quotes/route.ts"),
    source("app/api/stripe/checkout/route.ts"),
  ]);

  assert.match(requests, /customerAcceptanceBundleIsReleasedForPurpose\("request_scope"\)/);
  assert.match(requests, /CUSTOMER_POLICY_RELEASE_REQUIRED/);
  assert.match(quotes, /customerAcceptanceBundleIsReleasedForPurpose\("provider_selection"\)/);
  assert.match(quotes, /CUSTOMER_POLICY_RELEASE_REQUIRED/);
  assert.match(checkout, /customerAcceptanceBundleIsReleasedForPurpose\("checkout"\)/);
  assert.match(checkout, /CUSTOMER_POLICY_RELEASE_REQUIRED/);

  const releaseGate = quotes.indexOf(
    'customerAcceptanceBundleIsReleasedForPurpose("provider_selection")',
  );
  const bookingEvaluation = quotes.indexOf("await evaluateStageEligibility");
  assert.ok(releaseGate >= 0 && releaseGate < bookingEvaluation);
});

test("immutable customer evidence embeds the released document metadata", async () => {
  const scope = await source("lib/customer-job-scope.ts");

  assert.match(scope, /policyRelease: customerPolicyReleaseEvidence\("request_scope"\)/);
  assert.match(scope, /policyRelease: customerPolicyReleaseEvidence\("provider_selection"\)/);
  assert.match(scope, /presentedText: CUSTOMER_REQUEST_ACCEPTANCE_TEXT/);
  assert.match(scope, /presentedText: CUSTOMER_REQUEST_PRIVACY_ACKNOWLEDGMENT_TEXT/);
});

test("checkout displays and stores one exact server-generated authorization", async () => {
  const [acceptance, route, component] = await Promise.all([
    source("lib/customer-checkout-acceptance.ts"),
    source("app/api/stripe/checkout/route.ts"),
    source("app/components/quote-payment-card.tsx"),
  ]);

  assert.match(acceptance, /CUSTOMER_CHECKOUT_AGREEMENT_KEY/);
  assert.match(acceptance, /laborAmountCents/);
  assert.match(acceptance, /partsAmountCents/);
  assert.match(acceptance, /taxAmountCents/);
  assert.match(acceptance, /otherAmountCents/);
  assert.match(acceptance, /customerFeeCents/);
  assert.match(acceptance, /customerTotalCents/);
  assert.match(acceptance, /customerPolicyReleaseEvidence\("checkout"\)/);
  assert.match(acceptance, /TUVELOZ does not certify the repair/);

  assert.match(route, /checkoutAgreementKey/);
  assert.match(route, /checkoutAgreementVersion/);
  assert.match(route, /checkoutAgreementHash/);
  assert.match(route, /insert\(customerAgreementAcceptances\)/);
  assert.match(route, /affirmative-exact-checkout-authorization-checkbox/);
  assert.match(route, /CHECKOUT_ACCEPTANCE_RECORD_FAILED/);

  assert.match(component, /checkoutAcceptance\.presentedText/);
  assert.match(component, /checkoutAcceptance\.cancellationRefundSummary/);
  assert.match(component, /Download this exact authorization/);
  assert.match(component, /checkoutAgreementHash: checkoutAcceptance\?\.agreementHash/);
  assert.match(component, /disabled=\{!checkoutAllowed \|\| !checkoutAcceptance/);
});
