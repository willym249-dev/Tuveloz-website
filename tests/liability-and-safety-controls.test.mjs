import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  UNIVERSAL_SAFETY_RULES,
  safetyRulesBySeverityFor,
  safetyRulesForService,
  serviceCodesWithSpecificSafetyRules,
} from "../lib/provider-safety-practices.ts";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

// The eligibility matrix is read rather than imported: lib/provider-policy.ts
// pulls the JSON through a bare import that Node ESM cannot load here.
const matrix = JSON.parse(await source("config/provider-eligibility-matrix.json"));
const SERVICE_CODES = Object.keys(matrix.services);

const PROHIBITED_UMBRELLA = "general_auto_repair";

/** Mirrors getEvidenceRequirements: relationship controls sit above the service list. */
const RELATIONSHIP_REQUIREMENTS = {
  independent_startup: ["no_employee_attestation"],
  sponsored_trainee_employee: [
    "workers_comp_coverage",
    "sponsored_personnel_roster",
    "sponsored_employment_attestation",
  ],
  provider_business_employee: [
    "workers_comp_coverage",
    "provider_personnel_roster",
    "provider_employee_record",
  ],
};

function evidenceRequirements(code, pathway) {
  const service = matrix.services[code];
  const list = service.path_requirements?.[pathway] ?? service.requirements ?? [];
  return [...new Set([...list, ...RELATIONSHIP_REQUIREMENTS[pathway]])];
}

/**
 * Tuveloz asks only for what an applicable law requires. General liability
 * insurance is not legally required for these services on its own, so it may
 * appear only where a credential the law does mandate carries an insurance
 * condition -- today that is the Maryland locksmith license behind
 * vehicle_lockout. Adding it anywhere else is a policy change, not a fix.
 */
const SERVICES_WHERE_LAW_TIES_INSURANCE_TO_A_CREDENTIAL = ["vehicle_lockout"];

test("general liability is required only where a law ties it to a credential", () => {
  const unexpected = [];

  for (const code of SERVICE_CODES) {
    if (SERVICES_WHERE_LAW_TIES_INSURANCE_TO_A_CREDENTIAL.includes(code)) continue;
    for (const pathway of matrix.services[code].allowed_pathways) {
      if (evidenceRequirements(code, pathway).includes("general_liability_coi")) {
        unexpected.push(`${code}/${pathway}`);
      }
    }
  }

  assert.deepEqual(unexpected, []);
});

test("the services whose law does require insurance still demand it", () => {
  for (const code of SERVICES_WHERE_LAW_TIES_INSURANCE_TO_A_CREDENTIAL) {
    for (const pathway of matrix.services[code].allowed_pathways) {
      assert.ok(
        evidenceRequirements(code, pathway).includes("general_liability_coi"),
        `${code}/${pathway} lost its legally required coverage`,
      );
    }
  }
});

test("the prohibited umbrella category is not given an evidence path", () => {
  const service = matrix.services[PROHIBITED_UMBRELLA];
  assert.equal(service.launch_state, "prohibited_broad_category");
  assert.ok(!(service.requirements ?? []).includes("general_liability_coi"));
});

test("a liability certificate is evidence with an expiration and is never public", () => {
  const evidence = matrix.evidence_types.general_liability_coi;
  assert.equal(evidence.requires_expiration, true);
  assert.equal(evidence.private, true);
});

test("every service has both absolute and standard-of-care rules", () => {
  for (const code of SERVICE_CODES) {
    const { stopWork, standardOfCare } = safetyRulesBySeverityFor(code);
    assert.ok(stopWork.length > 0, `${code} has no stop-work rules`);
    assert.ok(standardOfCare.length > 0, `${code} has no standard-of-care rules`);
  }
});

/**
 * Per-job site safety is already enforced by JOB_SAFETY_ATTESTATION_CODES in
 * job-scope-facts.ts, which is bound into the job_start eligibility decision.
 * The written standard in provider-safety-practices.ts must not grow a second,
 * competing per-job confirmation flow.
 */
test("the written safety standard does not become a second per-job checklist", async () => {
  const [practices, factsGate] = await Promise.all([
    source("lib/provider-safety-practices.ts"),
    source("lib/job-scope-facts.ts"),
  ]);

  // The enforced per-job control still exists and is still service- and
  // location-aware. If this ever moves, the policy page needs rewording too.
  assert.match(factsGate, /export function jobScopeRequiredAttestations/);
  assert.match(factsGate, /JOB_SAFETY_ATTESTATION_CODES/);

  // The written standard stays presentation-only: no job, request, or
  // confirmation surface may be introduced here.
  assert.doesNotMatch(practices, /requestId|jobId|confirm(ed|ation)Codes|persist/i);
  assert.match(practices, /must not become one/);
});

test("the safety policy describes the confirmation flow that actually exists", async () => {
  const page = await prose("app/provider-safety-policy/page.tsx");

  // It may describe arrival site-condition confirmations, because those are
  // real, but must not claim a separate stop-work confirmation step.
  assert.match(page, /when you arrive at a job you confirm the site conditions/);
  assert.doesNotMatch(page, /you confirm the stop-work items at the site/);
});

test("universal safety rules apply to every service, including unknown input", () => {
  const universalCodes = UNIVERSAL_SAFETY_RULES.map((rule) => rule.code);

  for (const code of [...SERVICE_CODES, "not_a_service", null, undefined]) {
    const codes = safetyRulesForService(code).map((rule) => rule.code);
    for (const universal of universalCodes) {
      assert.ok(codes.includes(universal), `${code} is missing ${universal}`);
    }
  }
});

test("safety rule codes are unique within a service and use known severities", () => {
  const severities = new Set(["stop_work", "required", "recommended"]);

  for (const code of SERVICE_CODES) {
    const rules = safetyRulesForService(code);
    const seen = new Set();
    for (const rule of rules) {
      assert.ok(severities.has(rule.severity), `${code}/${rule.code} has an unknown severity`);
      assert.ok(rule.text.trim().length > 0, `${code}/${rule.code} has no text`);
      assert.ok(!seen.has(rule.code), `${code} repeats rule ${rule.code}`);
      seen.add(rule.code);
    }
  }
});

test("the highest-hazard services carry rules beyond the universal set", () => {
  const withSpecificRules = new Set(serviceCodesWithSpecificSafetyRules());

  for (const code of [
    "towing_or_storage",
    "vehicle_lockout",
    "fuel_delivery",
    "motor_vehicle_ac_service",
    "ev_high_voltage_service",
    "tire_repair_or_installation",
    "mobile_car_wash",
    "sponsored_oil_filter_service",
  ]) {
    assert.ok(withSpecificRules.has(code), `${code} has no service-specific safety rules`);
  }
});

test("the customer risk and release page is in every customer acceptance purpose", async () => {
  const [registry, manifest] = await Promise.all([
    source("lib/customer-policy-acceptance.ts"),
    source("config/policy-releases.json").then(JSON.parse),
  ]);

  assert.match(registry, /key: "vehicle_service_risk"/);
  assert.match(registry, /href: "\/vehicle-service-risk"/);
  assert.match(registry, /policyDocumentRelease\("vehicle_service_risk"\)/);

  // The entry uses the shared purpose list, so it gates request, selection,
  // and checkout rather than only one of them.
  const entry = registry.slice(registry.indexOf('key: "vehicle_service_risk"'));
  assert.match(
    entry.slice(0, entry.indexOf("},")),
    /purposes: CUSTOMER_ACCEPTANCE_PURPOSES/,
  );

  const release = manifest.vehicle_service_risk;
  assert.equal(release.releaseStatus, "active");
  assert.equal(release.sourceFile, "app/vehicle-service-risk/page.tsx");
  assert.match(release.canonicalBodyHash, /^[a-f0-9]{64}$/i);
});

test("the provider safety policy is in the provider acceptance bundle", async () => {
  const [registry, manifest] = await Promise.all([
    source("lib/provider-policy-acceptance.ts"),
    source("config/policy-releases.json").then(JSON.parse),
  ]);

  assert.match(registry, /key: "provider_safety_policy"/);
  assert.match(registry, /href: "\/provider-safety-policy"/);
  assert.match(registry, /policyDocumentRelease\("provider_safety_policy"\)/);
  assert.match(registry, /Provider Safety and Safe-Work Policy shown for this application/);
  assert.match(registry, /every license, registration, and insurance the law requires/);

  const release = manifest.provider_safety_policy;
  assert.equal(release.releaseStatus, "active");
  assert.equal(release.sourceFile, "app/provider-safety-policy/page.tsx");
  assert.match(release.canonicalBodyHash, /^[a-f0-9]{64}$/i);
});

test("bundle version strings change when the new documents change", async () => {
  const policies = await source("lib/policies.ts");

  assert.match(policies, /VEHICLE_SERVICE_RISK_VERSION/);
  assert.match(policies, /PROVIDER_SAFETY_POLICY_VERSION/);
  assert.match(policies, /CUSTOMER_POLICY_BUNDLE_VERSION[\s\S]*?risk:\$\{VEHICLE_SERVICE_RISK_VERSION\}/);
  assert.match(policies, /CHECKOUT_POLICY_BUNDLE_VERSION[\s\S]*?risk:\$\{VEHICLE_SERVICE_RISK_VERSION\}/);
  assert.match(policies, /PROVIDER_POLICY_BUNDLE_VERSION[\s\S]*?safety:\$\{PROVIDER_SAFETY_POLICY_VERSION\}/);
});

/** Policy copy is hard-wrapped in JSX, so match against flattened prose. */
async function prose(path) {
  return (await source(path)).replace(/\s+/g, " ");
}

test("the customer release is limited to Tuveloz and preserves non-waivable rights", async () => {
  const page = await prose("app/vehicle-service-risk/page.tsx");

  // The release must never reach the provider that did the work, or the
  // customer loses the claim that the provider insurance is there to pay.
  assert.match(page, /It does not release the provider business/);
  assert.match(page, /nothing here reduces or waives any claim you have against the provider business/);
  assert.match(page, /gross negligence, recklessness, intentional misconduct, or fraud/);
  assert.match(page, /Maryland Consumer Protection Act/);
  assert.match(page, /It does not bind anyone else/);

  // The page must not claim a blanket insurance requirement the matrix does
  // not enforce, and must tell the customer to ask what the provider carries.
  assert.match(page, /Tuveloz is not the insurer/);
  assert.match(page, /does not require every provider to carry general liability insurance/);
  assert.match(page, /Ask the provider what they carry before you accept a quote/);
  assert.match(page, /does not guarantee that a claim will be accepted/);
  assert.doesNotMatch(page, /requires each provider business to hold/);

  // Damage-claim steps have to state a concrete reporting window.
  assert.match(page, /within 72 hours/);

  // Indemnity must carve out Tuveloz's own conduct.
  assert.match(page, /does not apply to any part of a claim caused by Tuveloz&apos;s own conduct/);
});

test("the Terms and the risk page state one consistent governing law and forum", async () => {
  const [terms, risk] = await Promise.all([
    prose("app/terms/page.tsx"),
    prose("app/vehicle-service-risk/page.tsx"),
  ]);

  for (const [name, page] of [["terms", terms], ["risk page", risk]]) {
    assert.match(page, /Maryland law governs/, `${name} is missing the governing law`);
    assert.match(
      page,
      /courts serving Montgomery County, Maryland/,
      `${name} is missing the forum`,
    );
    // A consumer can argue a forum clause is unenforceable if another document
    // in the same stack told them no forum had been selected.
    assert.doesNotMatch(
      page,
      /hasn&apos;t adopted a formal governing-law|has not adopted a formal governing-law/,
      `${name} still says no forum was adopted`,
    );
  }

  // Arbitration is genuinely not adopted; both pages must say so together.
  assert.match(terms, /hasn&apos;t adopted an arbitration clause or a class-action waiver/);
  assert.match(risk, /has not adopted a mandatory arbitration clause or a class-action waiver/);
});

test("the provider safety policy states stop-work authority and the insurance duty", async () => {
  const page = await prose("app/provider-safety-policy/page.tsx");

  assert.match(page, /never be penalized for stopping a job/);
  assert.match(page, /whatever licenses, registrations, and insurance the law requires/);
  assert.match(page, /we do not require extra coverage/);
  assert.match(page, /suspended until it is current/);
  assert.match(page, /does not employ you, does not train you, does not supervise you/);
  assert.match(page, /Nothing in this policy creates an employment relationship/);
});
