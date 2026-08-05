import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const COMPETENCY = "provisional_service_competency";

async function loadMatrix() {
  return JSON.parse(await read("config/provider-eligibility-matrix.json"));
}

function entryLevelServiceCodes(matrix) {
  return Object.entries(matrix.services)
    .filter(([, service]) => (service.allowed_provider_levels ?? []).some(
      (level) => level === "provisional_independent" || level === "sponsored_trainee",
    ))
    .map(([code]) => code);
}

function pathwayRequirements(service, pathway) {
  const byPathway = service.path_requirements ?? {};
  return byPathway[pathway] ?? service.requirements ?? [];
}

test("every entry-level service requires service-specific competency in each allowed pathway", async () => {
  const matrix = await loadMatrix();
  const entry = entryLevelServiceCodes(matrix);

  // Guard against a silent policy drift that would leave the tier ungated.
  assert.ok(entry.length >= 10, `expected the entry-level tier, saw ${entry.length}`);

  for (const code of entry) {
    const service = matrix.services[code];
    for (const pathway of service.allowed_pathways) {
      const requirements = pathwayRequirements(service, pathway);
      assert.ok(
        requirements.includes(COMPETENCY),
        `${code} / ${pathway} must require ${COMPETENCY} so a least-experienced provider proves service-specific experience`,
      );
    }
  }
});

test("standard and specialty services are not gated by the provisional competency requirement", async () => {
  const matrix = await loadMatrix();
  const entry = new Set(entryLevelServiceCodes(matrix));

  for (const [code, service] of Object.entries(matrix.services)) {
    if (entry.has(code)) continue;
    const arrays = [
      service.requirements ?? [],
      ...Object.values(service.path_requirements ?? {}),
    ];
    for (const requirements of arrays) {
      assert.ok(
        !requirements.includes(COMPETENCY),
        `${code} is not an entry-level service and must not require ${COMPETENCY}`,
      );
    }
  }
});

test("the competency evidence is a defined, person-bound, service-scoped requirement the engine enforces", async () => {
  const matrix = await loadMatrix();
  const engine = await read("lib/provider-eligibility-engine.ts");

  const definition = matrix.evidence_types[COMPETENCY];
  assert.ok(definition, "the competency evidence type must be defined in the policy matrix");
  assert.equal(definition.requires_expiration, "person_service_scoped");
  assert.equal(definition.private, true);

  // The engine must treat the competency evidence as bound to the assigned
  // performing person, so a business credential alone cannot satisfy it.
  assert.match(
    engine,
    /PERSON_BOUND_EVIDENCE = new Set<EvidenceRequirementCode>\(\[[\s\S]*"provisional_service_competency"/,
  );
  // And it must be evaluated as ordinary accepted evidence, not silently
  // treated as a system-calculated requirement.
  assert.doesNotMatch(
    engine,
    /CALCULATED_REQUIREMENTS = new Set<EvidenceRequirementCode>\(\[[\s\S]*"provisional_service_competency"[\s\S]*\]\);/,
  );
});
