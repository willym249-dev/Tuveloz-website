import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

const PROVIDER_POLICY_MATRIX = JSON.parse(
  await source("config/provider-eligibility-matrix.json"),
);

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

const INDEPENDENT = "independent_startup";

test("the owner can provision standard and specialty services together", async () => {
  const route = await source("app/api/admin/provider-compliance/route.ts");
  const handler = route.slice(
    route.indexOf('action === "initialize-provider-pathway"'),
  );

  // The old gate rejected any selection that did not collapse to one level.
  assert.doesNotMatch(
    handler,
    /Every selected service must match the chosen pathway and provider level/,
  );
  assert.doesNotMatch(
    handler.slice(0, handler.indexOf("const [provider]")),
    /allowedProviderLevels\.includes\(providerLevel\)/,
  );

  // Each service is validated against the level it requires, and the profile
  // level is derived from the selection rather than chosen by hand.
  assert.match(handler, /providerLevelForService\(serviceCode, pathway\)/);
  assert.match(handler, /providerLevelsForServices\(exactServices, pathway\)/);
  assert.match(handler, /not lawful on the selected working relationship/);
});

test("the provisioning screen no longer filters services to one level", async () => {
  const page = await source("app/admin/provider-compliance/page.tsx");

  // Services are filtered by working relationship only.
  assert.doesNotMatch(
    page,
    /service\.allowedProviderLevels\.includes\(draft\.providerLevel\)/,
  );
  assert.match(
    page,
    /availableServices = data\.catalog\.services\.filter\(\(service\) => \(\s*draft && service\.allowedPathways\.includes\(draft\.pathway\)/,
  );
  // The hand-picked level control is gone; the level is derived and shown.
  assert.doesNotMatch(page, /providerLevel: event\.target\.value/);
  assert.match(page, /selectedLevels/);
  assert.match(page, /Set by the exact services selected below/);
  assert.match(
    page,
    /Each service is approved on its own\s+credentials — approving one never approves another/,
  );
});

test("battery plus A/C is a lawful provisioning selection", () => {
  // The exact case the owner could not provision before: a standard service
  // and a specialty service held by one independent provider business.
  const selection = ["battery_replacement", "motor_vehicle_ac_service"];
  const levels = selection.map((code) => providerLevelForService(code, INDEPENDENT));

  assert.deepEqual(levels, ["standard_provider", "specialty_provider"]);
  assert.ok(levels.every((level) => level !== null));
  // No single level covers both, which is exactly why the old collapse failed.
  assert.equal(new Set(levels).size, 2);
});

test("prohibited and off-pathway services are still refused at provisioning", () => {
  assert.equal(providerLevelForService("general_auto_repair", INDEPENDENT), null);
  assert.equal(
    providerLevelForService("sponsored_oil_filter_service", INDEPENDENT),
    null,
  );
});

test("the derived summary level is the highest level actually held", () => {
  // Mirrors the route's derivation so an inverted ordering is caught here
  // rather than silently downgrading a specialty provider to standard.
  const LEVELS = PROVIDER_POLICY_MATRIX.provider_levels;
  const ORDER = [
    "learning_account",
    "sponsored_trainee",
    "provisional_independent",
    "standard_provider",
    "specialty_provider",
  ];
  assert.deepEqual(Object.keys(LEVELS).sort(), [...ORDER].sort());

  const summaryFor = (codes) => {
    const held = [...new Set(codes
      .map((code) => providerLevelForService(code, INDEPENDENT))
      .filter(Boolean))];
    return [...ORDER].reverse().find((level) => held.includes(level)) ?? "";
  };

  assert.equal(
    summaryFor(["battery_replacement", "motor_vehicle_ac_service"]),
    "specialty_provider",
    "a mixed selection summarizes to the highest level held",
  );
  assert.equal(summaryFor(["battery_replacement"]), "standard_provider");
  assert.equal(
    summaryFor(["motor_vehicle_ac_service", "towing_or_storage"]),
    "specialty_provider",
  );
  assert.notEqual(summaryFor(["battery_replacement", "motor_vehicle_ac_service"]), "standard_provider");
});
