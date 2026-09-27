import assert from "node:assert/strict";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import {
  hasCompleteMandatoryLegalComplianceEvidence,
  requiredOfficialLegalSourceReferences,
} from "../lib/legal-compliance-evidence.ts";

const legacy = "https://www.montgomerycountymd.gov/OCP/licensing/mvr_tow_main.html";
const current = "https://www.montgomerycountymd.gov/office-consumer-protection/business-education-registration-unit-bear/motor-vehicle-repair-maintenance-towing";
const scope = { serviceCode: "battery_replacement", jurisdiction: "US-MD-MontgomeryCounty" };

function evidence(reference) {
  return { mandatoryLegalRequirements: {
    ...scope,
    reviewedAt: new Date(Date.now() - 86_400_000).toISOString(),
    validThrough: new Date(Date.now() + 30 * 86_400_000).toISOString(),
    reviewedBy: "Synthetic reviewer",
    reference: "SYNTHETIC-REVIEW-001",
    applicableRequirementsSummary: "Synthetic source-migration fixture; no real provider or service approval.",
    officialSourceReferences: requiredOfficialLegalSourceReferences(scope.serviceCode, scope.jurisdiction)
      .map(source => source === current ? reference : source),
    ownerAcknowledged: true,
    professionalReviewStatus: "obtained_optional",
  } };
}

test("current county guidance is suggested while saved legacy evidence remains readable without mutation", () => {
  assert.ok(requiredOfficialLegalSourceReferences(scope.serviceCode, scope.jurisdiction).includes(current));
  for (const reference of [current, legacy]) {
    const context = evidence(reference);
    const before = structuredClone(context);
    assert.equal(hasCompleteMandatoryLegalComplianceEvidence(context, scope), true);
    assert.deepEqual(context, before);
  }
});

test("county source migration does not accept homepages, lookalikes, modified references, or incomplete reviews", () => {
  for (const reference of [
    "https://www.montgomerycountymd.gov/office-consumer-protection",
    "https://example.gov/registration",
    current + "?unreviewed=true",
    legacy + "/other",
    current.replace(".gov/", ".gov.example.com/"),
  ]) assert.equal(hasCompleteMandatoryLegalComplianceEvidence(evidence(reference), scope), false, reference);
  const incomplete = evidence(legacy);
  incomplete.mandatoryLegalRequirements.ownerAcknowledged = false;
  assert.equal(hasCompleteMandatoryLegalComplianceEvidence(incomplete, scope), false);
});

test("launch-gate source comparison preserves only the exact county migration alias", async () => {
  const built = await build({
    entryPoints: [fileURLToPath(new URL("../lib/launch-readiness.ts", import.meta.url))],
    bundle: true, platform: "node", format: "cjs", write: false, logLevel: "silent",
  });
  const loadedModule = { exports: {} };
  runInNewContext(built.outputFiles[0].text, { module: loadedModule, exports: loadedModule.exports, URL, Date });
  const { LAUNCH_GATE_CATALOG, officialSourceReferenceIsAllowedForLaunchGate } = loadedModule.exports;
  const countyGate = LAUNCH_GATE_CATALOG.find(gate => gate.key === "provider_evidence_and_insurance_matrix");
  assert.ok(countyGate);
  for (const reference of [current, legacy]) {
    assert.equal(officialSourceReferenceIsAllowedForLaunchGate(countyGate, reference), true);
  }
  for (const reference of ["https://www.montgomerycountymd.gov/office-consumer-protection", legacy + "?x=1"]) {
    assert.equal(officialSourceReferenceIsAllowedForLaunchGate(countyGate, reference), false);
  }
  const otherGate = LAUNCH_GATE_CATALOG.find(gate => gate.key === "customer_workflow_and_terms_requirements");
  assert.equal(officialSourceReferenceIsAllowedForLaunchGate(otherGate, current), false);
  assert.equal(officialSourceReferenceIsAllowedForLaunchGate(otherGate, legacy), false);
});
