import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  normalizeIdentityName,
  verifiedDobIsAdult,
  verifiedIdentityNameMatches,
} from "../lib/identity-verification-policy.ts";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("identity policy requires an exact normalized signer name and age 18", () => {
  assert.equal(normalizeIdentityName("  Jos\u00E9  O'Neil  "), "jose o neil");
  assert.equal(verifiedIdentityNameMatches("Jos\u00E9", "O'Neil", "Jose", "O-Neil"), true);
  assert.equal(verifiedIdentityNameMatches("Jane", "Q Smith", "Jane", "Smith"), false);
  assert.equal(verifiedIdentityNameMatches("Jane", "Smith", "Janet", "Smith"), false);

  const asOf = new Date("2026-08-01T12:00:00.000Z");
  assert.equal(verifiedDobIsAdult({ year: 2008, month: 8, day: 1 }, asOf), true);
  assert.equal(verifiedDobIsAdult({ year: 2008, month: 8, day: 2 }, asOf), false);
  assert.equal(verifiedDobIsAdult({ year: 2008, month: 2, day: 30 }, asOf), false);
  assert.equal(verifiedDobIsAdult(null, asOf), false);
});

test("provider session creation is signed-in, same-origin, consented, bound, and uses explicit reviewed document checks", async () => {
  const [route, stripe, schema] = await Promise.all([
    read("app/api/provider-identity-verification/route.ts"),
    read("lib/stripe.ts"),
    read("db/schema.ts"),
  ]);
  assert.match(route, /isStrictSameOriginWriteRequest\(request\)/);
  assert.match(route, /getAccountSession\(request\)/);
  assert.match(route, /session\.role !== "provider"/);
  assert.match(route, /readLimitedJsonObject\(request, REQUEST_LIMIT_BYTES\)/);
  assert.match(route, /body\.identityConsentAcknowledged !== true/);
  assert.match(route, /body\.adultVerificationAcknowledged !== true/);
  assert.match(route, /body\.samePersonCertificationAcknowledged !== true/);
  assert.match(route, /replaceExpiredManualVerificationAcknowledged !== true/);
  assert.match(route, /IDENTITY_VERIFICATION_CONSENT_VERSION/);
  assert.match(route, /immutablePerformingPersonName\(evidence\.normalizedSnapshot\)/);
  assert.match(route, /relationshipPath !== "independent_startup"/);
  assert.match(route, /MAX_ATTEMPTS_PER_DAY = 3/);
  assert.match(route, /type: "document"/);
  assert.match(route, /require_live_capture: true/);
  assert.match(route, /require_matching_selfie: true/);
  assert.match(route, /require_id_number: false/);
  assert.match(route, /allowed_types: \["driving_license", "id_card", "passport"\]/);
  assert.doesNotMatch(route, /verification_flow:/);
  assert.match(route, /tuveloz_application_evidence_id/);
  assert.match(route, /externalIdentityAgeVerificationIsCurrent\(person, now\)/);
  assert.match(route, /expiredConfiguredManualIdentityAgeVerificationCanBeReplaced\(person, now\)/);
  assert.match(route, /externalIdentityAgeVerificationHasData\(person\)/);
  assert.match(route, /supersededHostedAttempts = attempts\.filter/);
  assert.match(route, /stripePersonnelBindingMatchesApprovedAttempt\(person, row, evidence\.id\)/);
  assert.match(route, /stripePersonnelBindingMatchesApprovedAttempt\(person, row, canonicalEvidenceId\)/);
  assert.match(route, /terminalResponse\(attempts, evidence\.id, person\)/);
  const terminal = route.slice(
    route.indexOf("function terminalResponse"),
    route.indexOf("function expectedModeMatches"),
  );
  assert.match(
    terminal,
    /const canonicalRows = rows\.filter\(\(row\) => \(\s*row\.applicationSubmissionEvidenceId === canonicalEvidenceId\s*\)\);/,
    "blocked canonical rows must remain visible to the server-side terminal guard",
  );
  assert.match(
    terminal,
    /row\.decisionStatus === "approved"\s*&& stripePersonnelBindingMatchesApprovedAttempt\(person, row, canonicalEvidenceId\)/,
    "only an approved attempt with the exact current personnel binding may complete verification",
  );
  const post = route.slice(route.indexOf("export async function POST"));
  assert.ok(
    post.indexOf("currentExternalVerification && !usesAnyStripeIdentity")
      < post.indexOf("if (!stripeIdentityModeMatchesProvider"),
    "a current configured manual result must be honored before Stripe configuration is required",
  );
  assert.ok(
    post.indexOf("replaceExpiredManualVerificationAcknowledged !== true")
      < post.indexOf("identityVerificationProvider: \"\""),
    "expired manual evidence requires fresh explicit replacement authorization",
  );
  assert.match(route, /idempotencyKey: `tuveloz-identity-\$\{row\.id\}`/);
  assert.doesNotMatch(route, /client_secret/);

  assert.match(stripe, /providers\.includes\("stripe_identity"\)/);
  assert.match(stripe, /STRIPE_IDENTITY_WEBHOOK_SECRET/);
  assert.match(stripe, /STRIPE_IDENTITY_SECRET_KEY/);
  assert.doesNotMatch(stripe, /STRIPE_IDENTITY_VERIFICATION_FLOW_ID/);
  // Identity live mode was deliberately code-released for the provider-side
  // launch; live capture still requires the STRIPE_IDENTITY_ALLOW_LIVE_MODE
  // secret and a dedicated rk_live_ key. Payments stay code-locked separately.
  assert.match(stripe, /STRIPE_IDENTITY_LIVE_MODE_ENABLED = true as const/);
  assert.match(stripe, /STRIPE_LIVE_MODE_ENABLED = false as const/);
  assert.match(stripe, /STRIPE_IDENTITY_ALLOW_LIVE_MODE/);
  assert.match(stripe, /value\.startsWith\("rk_test_"\)/);
  assert.match(stripe, /value\.startsWith\("rk_live_"\)/);
  assert.match(stripe, /getStripeIdentityClient/);
  assert.match(schema, /provider_identity_verification_sessions/);
  for (const prohibited of ["verified_name", "date_of_birth", "dob", "id_number", "document_image", "selfie_image"]) {
    assert.equal(schema.includes(`\"${prohibited}\"`), false, prohibited);
  }
});

test("identity webhook uses a separate signature, retrieves outputs, and fails closed", async () => {
  const [route, recorder, receipts] = await Promise.all([
    read("app/api/stripe/webhooks/identity/route.ts"),
    read("lib/stripe-identity-verification.ts"),
    read("lib/stripe-webhook-events.ts"),
  ]);
  assert.match(route, /request\.text\(\)/);
  assert.match(route, /constructEventAsync/);
  assert.match(route, /STRIPE_IDENTITY_WEBHOOK_SECRET/);
  assert.match(route, /endpoint: "identity"/);
  assert.match(route, /expand: \["verified_outputs\.dob"\]/);
  assert.match(route, /claimStripeWebhookEvent/);
  assert.match(route, /failStripeWebhookEvent/);
  assert.match(receipts, /\| "identity"/);

  assert.match(recorder, /providerApplicationSubmissionEvidence\.normalizedSnapshot/);
  assert.match(recorder, /verifiedDobIsAdult\(outputs\.dob, checkedAt\)/);
  assert.match(recorder, /verifiedIdentityNameMatches\(/);
  assert.match(recorder, /providerModeMatches\(row, session\.livemode\)/);
  assert.match(recorder, /session\.type === "document"/);
  assert.match(recorder, /session\.verification_flow === undefined/);
  assert.match(recorder, /require_live_capture === true/);
  assert.match(recorder, /require_matching_selfie === true/);
  assert.match(recorder, /require_id_number !== true/);
  for (const documentType of ["driving_license", "id_card", "passport"]) {
    assert.ok(recorder.includes(`allowedDocumentTypes.includes("${documentType}")`), documentType);
  }
  assert.match(recorder, /session\.options\?\.id_number === undefined/);
  assert.match(recorder, /session\.options\?\.email\?\.require_verification !== true/);
  assert.match(recorder, /session\.options\?\.phone\?\.require_verification !== true/);
  assert.match(recorder, /name_mismatch/);
  assert.match(recorder, /underage_or_invalid_dob/);
  assert.match(recorder, /decisionStatus: "approved"/);
});

test("0047 declares every atomic Stripe Identity guard required by health", async () => {
  const [migration, health] = await Promise.all([
    read("drizzle/0047_perfect_orphan.sql"),
    read("app/api/health/route.ts"),
  ]);
  for (const trigger of [
    "provider_identity_verification_insert_guard",
    "provider_identity_verification_binding_immutable",
    "provider_identity_verification_terminal_immutable",
    "provider_identity_verification_approval_requires_personnel_reference",
    "provider_identity_verification_approval_stamps_personnel",
    "provider_personnel_identity_revocation_blocks_provider",
    "provider_application_identity_reverification_on_amendment",
    "provider_personnel_stripe_identity_guard_insert",
    "provider_personnel_stripe_identity_binding_immutable",
    "provider_personnel_stripe_identity_guard_update",
  ]) {
    assert.match(migration, new RegExp(`CREATE\\s+TRIGGER\\s+(?:\`|")?${trigger}\\b(?:\`|")?`));
    assert.match(health, new RegExp(`.${trigger}.`));
  }
  assert.match(migration, /stripe-identity-owner-operator-consent-2026-08-01-v1/);
});

test("provider UI uses three fresh consents, a strict Stripe redirect, bounded return polling, and manual fallback", async () => {
  const [page, onboarding, admin, runtime] = await Promise.all([
    read("app/provider-onboarding/page.tsx"),
    read("app/api/provider-onboarding/route.ts"),
    read("app/api/admin/provider-compliance/route.ts"),
    read("lib/runtime-launch-readiness.ts"),
  ]);
  assert.match(page, /name="identityConsentAcknowledged"/);
  assert.match(page, /name="adultVerificationAcknowledged"/);
  assert.match(page, /name="samePersonCertificationAcknowledged"/);
  assert.match(page, /name="replaceExpiredManualVerificationAcknowledged"/);
  assert.match(page, /IDENTITY_DOCUMENT_SELFIE_CONSENT_TEXT/);
  assert.match(page, /IDENTITY_ADULT_STATUS_CONSENT_TEXT/);
  assert.match(page, /IDENTITY_SAME_PERSON_CERTIFICATION_TEXT/);
  assert.match(page, /destination\.hostname !== "verify\.stripe\.com"/);
  assert.match(page, /identityPollCount\.current >= 8/);
  assert.match(page, /manual\/non-biometric alternative/);
  assert.match(onboarding, /manualReattestationRequired/);
  assert.match(onboarding, /expiredManualVerificationRequiresReplacement/);
  assert.match(onboarding, /conflictingExternalVerificationRequiresReview/);
  assert.match(onboarding, /identityApprovalValidThrough\(item\.checkedAt\)/);
  assert.match(onboarding, /attemptsRemaining: Math\.max\(0, 3 - recentIdentityAttempts\.length\)/);
  assert.match(admin, /toLowerCase\(\) === "stripe_identity"/);
  assert.match(runtime, /key: "stripe_identity_automation"/);
  assert.match(runtime, /key: "manual_identity_alternative"/);
});

test("identity readiness requires current D1 canaries instead of credential-shaped strings", async () => {
  const [runtime, admin] = await Promise.all([
    read("lib/runtime-launch-readiness.ts"),
    read("app/api/admin/launch-readiness/route.ts"),
  ]);

  assert.match(runtime, /async function runtimeIdentityCanaries\(now: number\)/);
  assert.match(runtime, /stripeIdentityConfigurationReady\(\)/);
  assert.match(runtime, /stripeIdentityKeyIsLive\(\)/);
  assert.match(runtime, /eq\(providerIdentityVerificationSessions\.livemode, 1\)/);
  assert.match(runtime, /eq\(providerIdentityVerificationSessions\.decisionStatus, "approved"\)/);
  assert.match(runtime, /eq\(providerIdentityVerificationSessions\.stripeStatus, "verified"\)/);
  assert.match(runtime, /eq\(providerPersonnel\.status, "active"\)/);
  assert.match(runtime, /eventTime === verifiedAt/);
  assert.match(runtime, /\^vs_\[A-Za-z0-9\]\+\$/);
  assert.match(runtime, /\^vr_\[A-Za-z0-9\]\+\$/);
  assert.match(runtime, /\^evt_\[A-Za-z0-9\]\+\$/);
  assert.match(runtime, /externalIdentityAgeVerificationIsCurrent/);
  assert.match(
    runtime,
    /key: "stripe_identity_automation",[\s\S]*?passed: identityCanaries\.stripe\.evidencePassed/,
  );
  assert.doesNotMatch(
    runtime,
    /key: "stripe_identity_automation",[\s\S]*?passed: stripeIdentityConfigurationReady\(\)/,
  );

  assert.match(runtime, /manualProviders = configuredProviders\.filter/);
  // The gate passes only through a vendor-proven canary (Stripe today; a
  // guarded non-Stripe adapter later). Configuration strings alone never pass,
  // and no code path fabricates a passing manual canary.
  assert.match(
    runtime,
    /key: "manual_identity_alternative",[\s\S]*?passed: identityCanaries\.stripe\.evidencePassed\s*\|\|\s*identityCanaries\.manual\.evidencePassed/,
  );
  assert.doesNotMatch(
    runtime,
    /key: "manual_identity_alternative",[\s\S]{0,600}?passed: true/,
  );
  assert.doesNotMatch(
    runtime,
    /canaries\.manual = \{[\s\S]*?evidencePassed: true/,
  );

  assert.match(admin, /Configuration alone does not pass this gate/);
  assert.match(admin, /not independent vendor proof and cannot pass this operational gate/);
  assert.match(admin, /No allowlisted non-Stripe vendor-proof adapter is implemented/);
  assert.match(admin, /canonicalRuntimeReadiness\.identityCanaries\.stripe/);
});
