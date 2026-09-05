import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";
import { groupProviderSignupDocuments, hasProviderSignupQuestions } from "../lib/provider-signup-checklist.ts";

const matrix = JSON.parse(await readFile(
  new URL("../config/provider-eligibility-matrix.json", import.meta.url), "utf8",
));
const pathway = "independent_startup";

// Execute the actual policy and presentation modules, including relationship
// evidence added above the raw matrix arrays. Only the module format changes;
// no requirement-resolution logic is duplicated or replaced in this fixture.
async function loadModule(path, dependencies) {
  const source = await readFile(new URL(`../${path}`, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const exports = {};
  new Function("require", "exports", compiled)((specifier) => {
    assert.ok(Object.hasOwn(dependencies, specifier), `Unexpected dependency: ${specifier}`);
    return dependencies[specifier];
  }, exports);
  return exports;
}
const policy = await loadModule("lib/provider-policy.ts", {
  "../config/provider-eligibility-matrix.json": { default: matrix },
});
const tiers = await loadModule("lib/service-tiers.ts", { "./provider-policy": policy });
const selection = (codes) => tiers.getRequiredDocumentsForSelection(codes, pathway);

function assignments(groups) {
  return groups.flatMap((group) => group.documents.map((document) => ({
    document,
    services: group.serviceCodes,
  })));
}

test("battery and A/C show the shared registration once and keep both specific documents", () => {
  const rows = assignments(groupProviderSignupDocuments(selection([
    "battery_replacement", "motor_vehicle_ac_service",
  ])));
  assert.equal(rows.length, 4);
  assert.deepEqual(rows.find((row) => row.document.code === "ocp_vehicle_service_registration").services,
    ["battery_replacement", "motor_vehicle_ac_service"]);
  assert.deepEqual(rows.find((row) => row.document.code === "spent_battery_handling_plan").services,
    ["battery_replacement"]);
  assert.deepEqual(rows.find((row) => row.document.code === "epa_section_609_certificate").services,
    ["motor_vehicle_ac_service"]);
  assert.deepEqual(rows.find((row) => row.document.code === "no_employee_attestation").services,
    ["battery_replacement", "motor_vehicle_ac_service"]);
});

test("removing a service removes its paperwork and keeps shared requirements for the remaining service", () => {
  const rows = assignments(groupProviderSignupDocuments(selection(["motor_vehicle_ac_service"])));
  assert.deepEqual(rows.map((row) => row.document.code), [
    "ocp_vehicle_service_registration", "epa_section_609_certificate", "no_employee_attestation",
  ]);
  assert.ok(rows.every((row) => row.services.length === 1 && row.services[0] === "motor_vehicle_ac_service"));
});

test("a photo-only selection does not gain repair, towing, or A/C paperwork", () => {
  const rows = assignments(groupProviderSignupDocuments(selection(["photo_documentation_only"])));
  assert.deepEqual(rows.map((row) => row.document.code), [
    "provisional_service_competency", "no_employee_attestation",
  ]);
  assert.deepEqual(rows[0].services, ["photo_documentation_only"]);
});

test("every pair of independently selectable services preserves all requirements exactly once", () => {
  const codes = Object.entries(matrix.services)
    .filter(([code, service]) => code !== "general_auto_repair" && service.allowed_pathways.includes(pathway))
    .map(([code]) => code);
  for (let left = 0; left < codes.length; left += 1) {
    for (let right = left; right < codes.length; right += 1) {
      const entries = selection([...new Set([codes[left], codes[right]])]);
      const before = JSON.stringify(entries);
      const rows = assignments(groupProviderSignupDocuments(entries));
      const expectedCodes = [...new Set(entries.flatMap((entry) => entry.documents.map((doc) => doc.code)))].sort();
      assert.deepEqual(rows.map((row) => row.document.code).sort(), expectedCodes, `${codes[left]} / ${codes[right]}`);
      for (const row of rows) {
        const expectedServices = entries.filter((entry) => entry.documents.some((doc) => doc.code === row.document.code));
        assert.deepEqual([...row.services].sort(), expectedServices.map((entry) => entry.code).sort());
        assert.deepEqual(row.document, expectedServices[0].documents.find((doc) => doc.code === row.document.code));
      }
      assert.equal(JSON.stringify(entries), before, "presentation must not mutate policy-derived records");
    }
  }
});

test("an empty selection has no checklist", () => {
  assert.deepEqual(groupProviderSignupDocuments([]), []);
});

const questionFlags = [
  "montgomeryRegistration", "marylandCustomerPaperwork", "tintCompliance",
  "washWaterCompliance", "officialInspectionRestriction", "removedTireRule",
];
const noQuestions = Object.fromEntries(questionFlags.map((name) => [name, false]));

test("background review flags alone do not create an empty legal-question section", () => {
  assert.equal(hasProviderSignupQuestions({
    ...noQuestions, locksmithCredential: true, serviceSpecificRules: true, pausedService: true,
  }), false);
});

test("every applicable question keeps its section and acknowledgment visible", () => {
  for (const name of questionFlags) {
    assert.equal(hasProviderSignupQuestions({ ...noQuestions, [name]: true }), true, name);
  }
});
