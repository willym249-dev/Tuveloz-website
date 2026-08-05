import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

const PROVIDER_POLICY_MATRIX = JSON.parse(
  await source("config/provider-eligibility-matrix.json"),
);

/**
 * Mirrors lib/provider-policy.ts providerLevelForService against the deployed
 * matrix, so this suite verifies the policy data supports multi-level providers
 * rather than only re-stating the implementation.
 */
function providerLevelForService(serviceCode, pathway) {
  const service = PROVIDER_POLICY_MATRIX.services[serviceCode];
  if (!service || !service.allowed_pathways.includes(pathway)) return null;
  const compatibleLevels = PROVIDER_POLICY_MATRIX
    .pathway_level_compatibility[pathway];
  return service.allowed_provider_levels.find((level) => (
    compatibleLevels.includes(level)
    && PROVIDER_POLICY_MATRIX.provider_levels[level]
      .allowed_service_codes.includes(serviceCode)
  )) ?? null;
}

function providerLevelsForServices(serviceCodes, pathway) {
  return [...new Set(serviceCodes
    .map((serviceCode) => providerLevelForService(serviceCode, pathway))
    .filter((level) => level !== null))];
}

const INDEPENDENT = "independent_startup";

test("a provider level is resolved from the exact service, not from the provider", () => {
  // Standard and specialty work resolve to their own levels on the same
  // pathway, so one provider business can hold both at once.
  assert.equal(
    providerLevelForService("battery_replacement", INDEPENDENT),
    "standard_provider",
  );
  assert.equal(
    providerLevelForService("motor_vehicle_ac_service", INDEPENDENT),
    "specialty_provider",
  );
  assert.equal(
    providerLevelForService("towing_or_storage", INDEPENDENT),
    "specialty_provider",
  );
});

test("battery, A/C, and towing can be held together by one independent provider", () => {
  const levels = providerLevelsForServices(
    ["battery_replacement", "motor_vehicle_ac_service", "towing_or_storage"],
    INDEPENDENT,
  );
  // The mixed selection is lawful and reports both levels it spans.
  assert.deepEqual([...levels].sort(), ["specialty_provider", "standard_provider"]);
});

test("A/C and towing stay independent: each needs its own credentials", () => {
  // Both are specialty work, but neither service's evidence authorizes the
  // other. Holding an EPA Section 609 certificate must never enable towing,
  // and towing custody coverage must never enable refrigerant work.
  const ac = PROVIDER_POLICY_MATRIX.services.motor_vehicle_ac_service.requirements;
  const towing = PROVIDER_POLICY_MATRIX.services.towing_or_storage.requirements;

  assert.ok(ac.includes("epa_section_609_certificate"));
  assert.ok(towing.includes("ocp_towing_registration"));
  assert.ok(towing.includes("towing_custody_coverage"));

  assert.ok(!towing.includes("epa_section_609_certificate"));
  assert.ok(!ac.includes("ocp_towing_registration"));
  assert.ok(!ac.includes("towing_custody_coverage"));

  // Sharing a level never means sharing credentials.
  assert.equal(
    providerLevelForService("motor_vehicle_ac_service", INDEPENDENT),
    providerLevelForService("towing_or_storage", INDEPENDENT),
  );
  assert.notDeepEqual([...ac].sort(), [...towing].sort());
});

test("prohibited and off-pathway services still resolve to no level", () => {
  // The broad catch-all category remains unavailable at every level.
  assert.equal(providerLevelForService("general_auto_repair", INDEPENDENT), null);
  assert.equal(
    PROVIDER_POLICY_MATRIX.services.general_auto_repair.launch_state,
    "prohibited_broad_category",
  );
  // A service offered only on the sponsored pathway is not lawful for a solo
  // independent owner-operator.
  assert.equal(
    providerLevelForService("sponsored_oil_filter_service", INDEPENDENT),
    null,
  );
  assert.deepEqual(
    providerLevelsForServices(["general_auto_repair"], INDEPENDENT),
    [],
  );
});

test("every enabled service resolves to a level allowed on its own pathways", () => {
  for (const [code, service] of Object.entries(PROVIDER_POLICY_MATRIX.services)) {
    if (service.launch_state === "prohibited_broad_category") continue;
    for (const pathway of service.allowed_pathways) {
      const level = providerLevelForService(code, pathway);
      assert.ok(level !== null, `${code} resolves to no level on ${pathway}`);
      assert.ok(
        service.allowed_provider_levels.includes(level),
        `${code} resolved to a level it does not allow`,
      );
      assert.ok(
        PROVIDER_POLICY_MATRIX.pathway_level_compatibility[pathway].includes(level),
        `${code} resolved to a level incompatible with ${pathway}`,
      );
    }
  }
});

test("authorization derives the level per service instead of from the profile", async () => {
  const [engine, accountAuth, compliance] = await Promise.all([
    source("lib/provider-eligibility-engine.ts"),
    source("lib/account-auth.ts"),
    source("app/api/admin/provider-compliance/route.ts"),
  ]);

  // The engine resolves the level from the service being evaluated.
  assert.match(engine, /providerLevelForService\(\s*options\.serviceCode/);
  // An applicant-only account stays blocked for every service regardless of
  // which level the requested service would otherwise need.
  assert.match(engine, /profileLevel === "learning_account"/);

  // Sign-in keeps cross-level eligibility rows instead of dropping any row
  // whose level differs from the profile's summary level.
  assert.match(accountAuth, /providerLevelForService\(\s*row\.serviceCode/);
  assert.doesNotMatch(
    accountAuth,
    /row\.providerLevel === profile\.providerLevel/,
  );

  // Each eligibility row stores the level of its own service.
  assert.match(compliance, /providerLevel: evaluation\.providerLevel/);
  assert.match(compliance, /providerLevelForService\(serviceCode, pathway\)/);
});

test("signup no longer locks services from other tiers", async () => {
  const signupForm = await source("app/components/provider-signup-form.tsx");

  // The cross-tier lock and its confusing copy are gone.
  assert.doesNotMatch(signupForm, /serviceIsSelectable/);
  assert.doesNotMatch(signupForm, /hasLockedServices/);
  assert.doesNotMatch(signupForm, /one application covers one service tier/);
  assert.doesNotMatch(signupForm, /disabled=\{isLocked\}/);

  // Applicants are told specialty work unlocks per credential.
  assert.match(signupForm, /Pick every job you actually do/);
  assert.match(signupForm, /each one turns on separately once that credential is verified/);
  assert.match(signupForm, /providerLevelsForServices/);
});

test("the application accepts services spanning levels and names unsupported ones", async () => {
  const verification = await source("lib/provider-application-verification.ts");

  // The one-level collapse and its rejection message are gone.
  assert.doesNotMatch(verification, /allowedLevelForApplication/);
  assert.doesNotMatch(
    verification,
    /do not fit one lawful pathway and provider level/,
  );

  // Services are resolved individually, and only genuinely unlawful ones are
  // reported back to the applicant by name.
  assert.match(verification, /serviceLevelsForApplication/);
  assert.match(verification, /unsupported\.push\(serviceCode\)/);
  assert.match(verification, /not offered on the selected pathway/);
  // The profile keeps a summary level for display only.
  assert.match(verification, /summaryLevelForApplication/);
  assert.match(verification, /serviceLevels,/);
});

test("the single-level collapse helper is gone from signup", async () => {
  const signupForm = await source("app/components/provider-signup-form.tsx");
  const adminPage = await source("app/admin/provider-compliance/page.tsx");

  // deriveProviderLevel collapsed a whole selection to one level. The server
  // now derives a level per service and ignores any client-sent level, so
  // leaving the old helper behind invites a single-level assumption back in.
  assert.doesNotMatch(signupForm, /deriveProviderLevel/);
  assert.doesNotMatch(signupForm, /providerLevel,\n/);
  // The provisioning draft no longer carries a hand-picked level either.
  assert.doesNotMatch(adminPage, /providerLevel: draft\.providerLevel/);
  assert.doesNotMatch(adminPage, /providerLevel: "provisional_independent"/);
});
