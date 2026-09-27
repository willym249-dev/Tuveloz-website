import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { build } from "esbuild";
import { drizzle } from "drizzle-orm/sqlite-proxy";

// Execute the real eligibility engine, policy and migrated SQL. Only database
// and environment bindings are local fixtures; every network call is rejected.
// The deployed catalog remains closed, so assert document-specific decisions
// and retained launch denials rather than pretending this authorizes real work.
test("provider document validity is rechecked at every work stage", async t => {
  const repo = resolve(import.meta.dirname, "..");
  const tempRoot = resolve(tmpdir());
  const scratch = mkdtempSync(join(tempRoot, "tuveloz-evidence-validity-"));
  const database = new DatabaseSync(":memory:");
  const originalFetch = globalThis.fetch;
  const state = { db: null, env: {} };
  globalThis.__evidenceValidity = state;
  const providerId = "synthetic-validity-provider", personId = "synthetic-person";
  const serviceCode = "battery_replacement", jurisdiction = "US-MD-MontgomeryCounty";
  const target = "ocp_vehicle_service_registration";
  const cutoff = "2030-09-27";
  const through = "2030-09-27T12:00:00.000Z";
  const seed = (table, values) => {
    const columns = Object.keys(values);
    database.prepare(`INSERT INTO ${table} (${columns.join(",")}) VALUES (${columns.map(() => "?").join(",")})`)
      .run(...Object.values(values));
  };
  const updateEvidence = values => {
    const columns = Object.keys(values);
    database.prepare(`UPDATE provider_evidence_submissions SET ${columns.map(column => `${column}=?`).join(",")} WHERE id=?`)
      .run(...Object.values(values), target);
  };
  try {
    globalThis.fetch = async () => { throw new Error("No outbound calls are permitted in document-validity tests"); };
    for (const entry of JSON.parse(readFileSync(join(repo, "drizzle/meta/_journal.json"), "utf8")).entries) {
      for (const statement of readFileSync(join(repo, "drizzle", entry.tag + ".sql"), "utf8").split("--> statement-breakpoint")) {
        if (statement.trim()) database.exec(statement);
      }
    }
    state.db = drizzle(async (query, params, method) => {
      if (method === "run") { database.prepare(query).run(...params); return { rows: [] }; }
      database.exec("PRAGMA short_column_names=OFF; PRAGMA full_column_names=ON;");
      try {
        const statement = database.prepare(query);
        return { rows: method === "get" ? Object.values(statement.get(...params) ?? {}) : statement.all(...params).map(row => Object.values(row)) };
      } finally { database.exec("PRAGMA short_column_names=ON; PRAGMA full_column_names=OFF;"); }
    });
    const bundle = join(scratch, "validity.cjs");
    await build({ absWorkingDir: repo, stdin: { contents: `
      export { evaluateStageEligibility, ELIGIBILITY_STAGES } from "./lib/provider-eligibility-engine";
      export { POLICY_VERSION, getEvidenceRequirementsInJurisdiction } from "./lib/provider-policy";
      export { PLATFORM_SERVICE_ACTIVATION_RULES_VERSION } from "./lib/platform-service-activation";
      export { PROVIDER_ACCEPTANCE_DOCUMENTS, providerAgreementEvidenceCandidates } from "./lib/provider-policy-acceptance";
      export { jobScopeFactsFromInput, jobScopeRequirementsForService, JOB_SAFETY_ATTESTATION_CODES } from "./lib/job-scope-facts";
    `, resolveDir: repo, loader: "ts" }, bundle: true, platform: "node", format: "cjs", outfile: bundle, target: "node22", logLevel: "silent",
      plugins: [{ name: "isolated-bindings", setup(builder) {
        builder.onResolve({ filter: /^cloudflare:workers$/ }, () => ({ path: "env", namespace: "fixture" }));
        builder.onResolve({ filter: /(?:^|\/)db$/ }, args => args.path.startsWith(".") ? { path: "db", namespace: "fixture" } : null);
        builder.onLoad({ filter: /.*/, namespace: "fixture" }, args => ({ loader: "js", contents: args.path === "env"
          ? "export const env = globalThis.__evidenceValidity.env;" : "export function getDb() { return globalThis.__evidenceValidity.db; }" }));
      } }],
    });
    const api = createRequire(import.meta.url)(bundle);
    seed("provider_applications", { id: providerId, name: "SYNTHETIC TEST ONLY", email: "validity@example.invalid", service: serviceCode,
      service_area: "Montgomery County, Maryland", experience: "Local fixture", insurance_status: "unverified", is_test_provider: "yes", status: "approved", verification_status: "verified" });
    seed("provider_pathway_profiles", { id: "profile", provider_id: providerId, provider_person_id: personId, relationship_path: "independent_startup",
      provider_level: "standard_provider", registration_holder_id: providerId, status: "active", policy_version: api.POLICY_VERSION,
      effective_at: "2020-01-01", valid_through: "2031-09-27" });
    seed("provider_personnel", { id: "person", provider_id: providerId, person_id: personId, relationship_type: "owner_operator", status: "active",
      identity_verified_at: "2020-01-01", age_verified_at: "2020-01-01" });
    seed("service_activation_decisions", { id: "activation", provider_id: "__tuveloz_platform__", service_code: serviceCode, jurisdiction,
      stage: "configuration", decision: "enabled_test", policy_version: api.POLICY_VERSION,
      rules_engine_version: api.PLATFORM_SERVICE_ACTIVATION_RULES_VERSION, valid_through: "2031-09-27" });
    for (const document of api.PROVIDER_ACCEPTANCE_DOCUMENTS) {
      const [presentation] = await api.providerAgreementEvidenceCandidates(document);
      assert.ok(presentation, `released presentation: ${document.key}`);
      seed("agreement_acceptances", { id: document.key, provider_id: providerId, agreement_key: document.key, agreement_version: document.version,
        agreement_hash: presentation.hash, agreement_text: presentation.text, accepted_by_name: "SYNTHETIC", accepted_at: "2020-01-01" });
    }
    const evidenceBase = { provider_id: providerId, person_id: personId, service_code: serviceCode, jurisdiction, evidence_type: "document", status: "accepted",
      effective_at: "2020-01-01", expires_at: "2031-09-27", reviewed_at: "2020-01-01",
      authenticity_verification_method: "issuer_direct_confirmation", authenticity_verified_by: "Synthetic issuer", authenticity_verification_reference: "SYNTHETIC-NOT-REAL",
      authenticity_source_url: "https://issuer.example.invalid/fixture", authenticity_verified_at: "2020-01-01", authenticity_valid_through: "2031-09-27" };
    for (const requirement of api.getEvidenceRequirementsInJurisdiction(serviceCode, "independent_startup", jurisdiction)) {
      seed("provider_evidence_submissions", { id: requirement, requirement_key: requirement, ...evidenceBase });
    }
    assert.ok(database.prepare("SELECT id FROM provider_evidence_submissions WHERE id=?").get(target));
    const scope = api.jobScopeRequirementsForService(serviceCode);
    const jobFacts = api.jobScopeFactsFromInput({ serviceCode, operationCode: scope.allowedOperations[0],
      prohibitedOperationsAttestedAbsent: scope.prohibitedOperations, locationType: "customer_private_property",
      address: "123 Synthetic Test Lane, Rockville, Maryland 20850", municipality: "Rockville", county: "Montgomery County", state: "Maryland",
      postalCode: "20850", jurisdiction, propertyPermission: "customer_confirmed_authority", vehicleDriveability: "driveable",
      vehicleState: "normal_stationary", highVoltageStatus: "not_applicable_or_not_involved", safetyAttestations: api.JOB_SAFETY_ATTESTATION_CODES });
    const evaluate = (overrides = {}) => api.evaluateStageEligibility({ stage: "quote", providerId, personId, serviceCodes: [serviceCode], jurisdiction,
      effectiveAt: through, scheduledFor: through, jobFacts, testOnly: true, persist: false, ...overrides });
    const targetReasons = result => result.reasons.filter(reason => reason.evidenceType === target);
    const restore = () => {
      database.prepare("DELETE FROM provider_evidence_submissions WHERE id='replacement'").run();
      database.prepare("DELETE FROM evidence_file_scans").run();
      updateEvidence({ ...evidenceBase, storage_key: "", supersedes_evidence_id: "" });
      database.prepare("UPDATE provider_pathway_profiles SET effective_at='2020-01-01', valid_through='2031-09-27'").run();
    };
    await t.test("current accepted evidence passes its checks while the service catalog stays closed", async () => {
      const result = await evaluate();
      assert.deepEqual(result.reasons.map(reason => reason.code), ["service_not_enabled_by_policy_catalog"]);
      assert.ok(result.evidenceIds.includes(target)); assert.equal(result.allowed, false);
    });
    await t.test("the exact expiration cutoff is inclusive, then denied without changing stored approval", async () => {
      restore(); updateEvidence({ expires_at: cutoff });
      const before = await evaluate({ effectiveAt: cutoff + "T23:59:59.999Z", scheduledFor: cutoff + "T23:59:59.999Z" });
      assert.deepEqual(targetReasons(before), []); assert.equal(before.validThrough, cutoff);
      const after = await evaluate({ effectiveAt: "2030-09-28T00:00:00.000Z", scheduledFor: "2030-09-28T00:00:00.000Z" });
      assert.equal(targetReasons(after)[0]?.code, "required_evidence_missing_or_expired");
      assert.equal(database.prepare("SELECT status FROM provider_evidence_submissions WHERE id=?").get(target).status, "accepted");
    });
    await t.test("every work stage rejects documents expired before the later work or recheck time", async () => {
      restore(); updateEvidence({ expires_at: "2030-09-26" });
      for (const stage of api.ELIGIBILITY_STAGES) {
        const result = await evaluate({ stage });
        assert.equal(targetReasons(result)[0]?.code, "required_evidence_missing_or_expired", stage);
        assert.ok(!result.evidenceIds.includes(target)); assert.equal(result.allowed, false);
      }
      updateEvidence({ expires_at: cutoff });
      assert.ok(targetReasons(await evaluate({ scheduledFor: "2030-09-28T12:00:00.000Z" })).length);
      assert.ok(targetReasons(await evaluate({ effectiveAt: "2030-09-28T12:00:00.000Z" })).length);
    });
    await t.test("pending, quarantined, rejected and wrong-scope replacements cannot extend expired evidence", async () => {
      for (const change of [{ status: "pending" }, { storage_key: "synthetic/replacement" }, { status: "rejected" },
        { provider_id: "someone-else" }, { service_code: "vehicle_lockout" }, { jurisdiction: "US-MD-Other" }]) {
        restore(); updateEvidence({ expires_at: "2030-09-26" });
        seed("provider_evidence_submissions", { id: "replacement", requirement_key: target, ...evidenceBase, supersedes_evidence_id: target, ...change });
        const result = await evaluate();
        assert.ok(targetReasons(result).length, JSON.stringify(change)); assert.ok(!result.evidenceIds.includes("replacement"));
      }
      restore(); updateEvidence({ expires_at: "2030-09-26" });
      seed("provider_evidence_submissions", { id: "replacement", requirement_key: target, ...evidenceBase, supersedes_evidence_id: target });
      assert.deepEqual(targetReasons(await evaluate()), []);
      assert.ok((await evaluate()).evidenceIds.includes("replacement"));
    });
    await t.test("future-effective evidence is rejected before it starts, then qualifies at its start", async () => {
      restore(); updateEvidence({ effective_at: "2030-09-28" });
      assert.ok(targetReasons(await evaluate()).length, "future policy must not cover work before it starts");
      assert.deepEqual(targetReasons(await evaluate({ scheduledFor: "2030-09-28T00:00:00.000Z" })), []);
    });
    await t.test("invalid supplied start dates cannot be treated as current evidence", async () => {
      restore(); updateEvidence({ effective_at: "not-a-date" });
      assert.ok(targetReasons(await evaluate()).length);
    });
    await t.test("an expired or future-effective pathway cannot retain usable service approval", async () => {
      restore(); database.prepare("UPDATE provider_pathway_profiles SET valid_through='2030-09-26'").run();
      assert.ok((await evaluate()).reasons.some(reason => reason.code === "pathway_not_current"));
      restore(); database.prepare("UPDATE provider_pathway_profiles SET effective_at='2030-09-28'").run();
      assert.ok((await evaluate()).reasons.some(reason => reason.code === "pathway_not_current"));
    });
    await t.test("real-mode checks retain launch denial and recheck external authenticity independently", async () => {
      restore(); updateEvidence({ authenticity_valid_through: "2030-09-26" });
      const result = await evaluate({ testOnly: false });
      assert.equal(result.allowed, false); assert.ok(result.reasons.some(reason => reason.code === "marketplace_onboarding_only"));
      assert.equal(targetReasons(result)[0]?.code, "evidence_authenticity_not_current");
      assert.equal(database.prepare("SELECT count(*) n FROM stripe_payments").get().n, 0);
      assert.equal(database.prepare("SELECT count(*) n FROM email_notification_outbox").get().n, 0);
    });
  } finally {
    globalThis.fetch = originalFetch; delete globalThis.__evidenceValidity; database.close();
    assert.equal(dirname(scratch), tempRoot); assert.ok(scratch.startsWith(join(tempRoot, "tuveloz-evidence-validity-")));
    rmSync(scratch, { recursive: true, force: true });
  }
});
