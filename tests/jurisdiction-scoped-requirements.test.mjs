import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

// Line endings are normalised because the fail-closed assertions below match
// multi-line source fragments such as "POLICY_JURISDICTION,\n  );". A Windows
// checkout hands back CRLF, those never match, and the test reports the
// fail-closed guard as missing when the code is correct. It passes on CI, which
// checks out LF, so the disagreement only ever shows up locally — on the one
// assertion whose whole purpose is to prove a safety property is still there.
async function source(path) {
  const text = await readFile(new URL(`../${path}`, import.meta.url), "utf8");
  return text.replace(/\r\n/g, "\n");
}

const MATRIX = JSON.parse(await source("config/provider-eligibility-matrix.json"));
const POLICY = await source("lib/provider-policy.ts");
const ENGINE = await source("lib/provider-eligibility-engine.ts");

const REGISTRY = MATRIX.jurisdiction_registry;
const MOCO = "US-MD-MontgomeryCounty";

/**
 * Mirrors lib/provider-policy.ts so this suite tests the deployed policy data
 * and not just the implementation restating itself.
 */
function jurisdictionChain(jurisdiction) {
  if (!Object.hasOwn(REGISTRY, jurisdiction)) return [];
  const chain = [];
  let cursor = jurisdiction;
  while (typeof cursor === "string") {
    chain.push(cursor);
    cursor = REGISTRY[cursor].parent;
  }
  return chain;
}

function evidenceApplies(code, jurisdiction) {
  const imposedBy = MATRIX.evidence_types[code]?.imposed_by;
  if (!imposedBy) return true;
  return jurisdictionChain(jurisdiction).includes(imposedBy);
}

function rawRequirements(serviceCode, pathway) {
  const service = MATRIX.services[serviceCode];
  return service.path_requirements?.[pathway] ?? service.requirements ?? [];
}

function requirementsIn(serviceCode, pathway, jurisdiction) {
  return rawRequirements(serviceCode, pathway)
    .filter((code) => evidenceApplies(code, jurisdiction));
}

const SERVICE_PATHWAY_PAIRS = Object.entries(MATRIX.services)
  .flatMap(([serviceCode, service]) => service.allowed_pathways
    .map((pathway) => [serviceCode, pathway]));

test("every jurisdiction on a service is registered and reviewed", () => {
  for (const [serviceCode, service] of Object.entries(MATRIX.services)) {
    for (const jurisdiction of service.jurisdictions) {
      assert.ok(
        Object.hasOwn(REGISTRY, jurisdiction),
        `${serviceCode} names unregistered jurisdiction ${jurisdiction}`,
      );
      // The whole containment chain must be reviewed, not just the leaf.
      for (const link of jurisdictionChain(jurisdiction)) {
        assert.equal(
          REGISTRY[link].local_requirements_reviewed,
          true,
          `${serviceCode} is open in ${jurisdiction} but ${link} is unreviewed`,
        );
      }
    }
  }
});

test("every jurisdiction chain terminates at a root without a cycle", () => {
  for (const key of Object.keys(REGISTRY)) {
    const chain = jurisdictionChain(key);
    assert.ok(chain.length > 0, `${key} resolved no chain`);
    assert.equal(new Set(chain).size, chain.length, `${key} has a cyclical chain`);
    assert.equal(REGISTRY[chain.at(-1)].parent, null, `${key} does not reach a root`);
  }
});

test("Montgomery County requirements are unchanged by jurisdiction scoping", () => {
  // The safety property of this change: scoping requirements to the government
  // that imposes them must not relax anything in the jurisdiction we launch in.
  for (const [serviceCode, pathway] of SERVICE_PATHWAY_PAIRS) {
    assert.deepEqual(
      requirementsIn(serviceCode, pathway, MOCO),
      [...rawRequirements(serviceCode, pathway)],
      `${serviceCode}/${pathway} changed in Montgomery County`,
    );
  }
});

test("a Maryland county outside Montgomery keeps state and platform documents but not county ones", () => {
  // Not a jurisdiction we serve — this asserts the resolution rule itself, so
  // opening a second Maryland county cannot silently carry Montgomery County
  // paperwork with it, or silently drop Maryland's.
  const sibling = "US-MD-TestSiblingCounty";
  const registry = { ...REGISTRY, [sibling]: { parent: "US-MD" } };
  const chainOf = (code) => {
    const chain = [];
    let cursor = code;
    while (typeof cursor === "string") {
      chain.push(cursor);
      cursor = registry[cursor]?.parent ?? null;
    }
    return chain;
  };
  const appliesInSibling = (code) => {
    const imposedBy = MATRIX.evidence_types[code]?.imposed_by;
    return !imposedBy || chainOf(sibling).includes(imposedBy);
  };

  const countyImposed = Object.entries(MATRIX.evidence_types)
    .filter(([, definition]) => definition.imposed_by === MOCO)
    .map(([code]) => code);
  assert.ok(countyImposed.includes("ocp_vehicle_service_registration"));

  for (const code of countyImposed) {
    assert.equal(appliesInSibling(code), false, `${code} leaked outside its county`);
    assert.equal(evidenceApplies(code, MOCO), true, `${code} stopped applying in its own county`);
  }

  // Maryland and federal documents still reach the sibling county, and so does
  // every platform baseline document.
  for (const [code, definition] of Object.entries(MATRIX.evidence_types)) {
    if (definition.imposed_by === MOCO) continue;
    assert.equal(appliesInSibling(code), true, `${code} was wrongly dropped outside Montgomery County`);
  }
});

test("platform safety baselines are imposed everywhere, not by any government", () => {
  // Insurance, competency and supervision are Tuveloz requirements. They must
  // never be tagged to a jurisdiction, or they would disappear on expansion.
  const baselines = [
    "general_liability_coi",
    "business_auto_coverage",
    "provisional_service_competency",
    "qualified_supervisor_assignment",
    "roadside_stop_work_plan",
    "workers_comp_coverage",
  ];
  for (const code of baselines) {
    assert.ok(Object.hasOwn(MATRIX.evidence_types, code), `${code} is missing`);
    assert.equal(
      MATRIX.evidence_types[code].imposed_by,
      undefined,
      `${code} must stay a platform baseline`,
    );
    assert.equal(evidenceApplies(code, "US-MD-TestSiblingCounty"), true);
  }
});

test("county and state documents are tagged to the government that issues them", () => {
  assert.equal(MATRIX.evidence_types.ocp_vehicle_service_registration.imposed_by, MOCO);
  assert.equal(MATRIX.evidence_types.ocp_towing_registration.imposed_by, MOCO);
  assert.equal(MATRIX.evidence_types.mva_inspection_station_license.imposed_by, "US-MD");
  assert.equal(MATRIX.evidence_types.md_locksmith_business_license.imposed_by, "US-MD");
  assert.equal(MATRIX.evidence_types.epa_section_609_certificate.imposed_by, "US");
});

test("the engine resolves requirements from the job jurisdiction and denies unreviewed ones", () => {
  assert.ok(
    ENGINE.includes("getEvidenceRequirementsInJurisdiction(options.serviceCode, pathway, options.jurisdiction)"),
    "the engine must resolve requirements from the job jurisdiction",
  );
  assert.ok(
    ENGINE.includes("jurisdiction_requirements_not_reviewed"),
    "the engine must deny a jurisdiction whose local requirements are unreviewed",
  );
  // An empty requirement set must never read as a clear result.
  assert.ok(
    ENGINE.includes("jurisdictionIsOpenForService(options.jurisdiction)"),
    "the engine must gate on the jurisdiction being open",
  );
});

test("policy helpers fail closed on an unregistered jurisdiction", () => {
  assert.ok(POLICY.includes("if (!Object.hasOwn(JURISDICTION_REGISTRY, jurisdiction)) return [];"));
  assert.ok(POLICY.includes("if (chain.length === 0) return false;"));
  assert.ok(POLICY.includes("if (!jurisdictionIsOpenForService(jurisdiction)) return [];"));
  // The legacy accessor must stay pinned to the deployed policy jurisdiction.
  assert.ok(POLICY.includes("POLICY_JURISDICTION,\n  );"));
});
