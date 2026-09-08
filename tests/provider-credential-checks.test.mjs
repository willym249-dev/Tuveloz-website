import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { build } from "esbuild";
import { drizzle } from "drizzle-orm/sqlite-proxy";

// Executes the real admin route, SQL, audit and review validation against an
// isolated migrated database. Only authentication, delivery and external API
// responses are fixtures. No private files, outbound sends or production data.
test("provider credential checks bind official results and enforce insurance confirmation", async t => {
  const repo = resolve(import.meta.dirname, "..");
  const out = mkdtempSync(join(tmpdir(), "tuveloz-credential-test-"));
  const sql = new DatabaseSync(":memory:");
  const originalFetch = globalThis.fetch;
  const state = { network: 0, notifications: 0, cleanup: 0 };
  globalThis.__credentialTest = state;
  const stubs = {
    cloudflare: 'export const env = { SITE_URL: "https://tuveloz.invalid" };',
    database: 'export function getDb() { return globalThis.__credentialTestDb; }',
    owner: 'export async function verifyOwnerRequest(request) { return {ok:request.headers.get("x-test-owner") === "yes",email:"owner@example.invalid"}; }',
    notifications: 'export async function notifyProviderEvidenceDecision() { globalThis.__credentialTest.notifications++; } export async function notifyProviderEvidenceScanBlocked() { globalThis.__credentialTest.notifications++; }',
    stripe: 'export async function expireOpenCheckoutSessionsForLaunchShutdown() { globalThis.__credentialTest.cleanup++; return {}; }',
  };
  try {
    const bundle = join(out, "route.cjs");
    await build({
      absWorkingDir: repo, stdin: { contents: 'export { POST, GET } from "./app/api/admin/provider-compliance/route"; export { getEvidenceRequirements, POLICY_JURISDICTION, POLICY_VERSION } from "./lib/provider-policy";', resolveDir: repo, loader: "ts" },
      bundle: true, platform: "node", format: "cjs", outfile: bundle, target: "node22", logLevel: "silent",
      plugins: [{ name: "test-boundaries", setup(builder) {
        builder.onResolve({ filter: /^cloudflare:workers$/ }, () => ({ path: "cloudflare", namespace: "fixture" }));
        builder.onResolve({ filter: /(?:^|\/)db$/ }, args => args.path.startsWith(".") ? { path: "database", namespace: "fixture" } : null);
        const seams = { "owner-auth": "owner", "provider-compliance-notifications": "notifications", "stripe-payments": "stripe" };
        builder.onResolve({ filter: /\/(owner-auth|provider-compliance-notifications|stripe-payments)$/ }, args => ({ path: seams[args.path.split("/").pop()], namespace: "fixture" }));
        builder.onLoad({ filter: /.*/, namespace: "fixture" }, args => ({ contents: stubs[args.path], loader: "js" }));
      } }],
    });
    for (const entry of JSON.parse(readFileSync(join(repo, "drizzle/meta/_journal.json"), "utf8")).entries) {
      for (const statement of readFileSync(join(repo, "drizzle", entry.tag + ".sql"), "utf8").split("--> statement-breakpoint")) {
        if (statement.trim()) sql.exec(statement);
      }
    }
    globalThis.__credentialTestDb = drizzle(async (query, params, method) => {
      const statement = sql.prepare(query);
      if (method === "run") { statement.run(...params); return { rows: [] }; }
      return { rows: method === "get" ? Object.values(statement.get(...params) ?? {}) : statement.all(...params).map(row => Object.values(row)) };
    });
    const api = createRequire(import.meta.url)(bundle);
    const seed = (table, values) => {
      const keys = Object.keys(values);
      sql.prepare(`INSERT INTO ${table} (${keys.join(",")}) VALUES (${keys.map(() => "?").join(",")})`).run(...Object.values(values));
    };
    const service = "battery_replacement", providerId = "synthetic-credential-applicant";
    assert.ok(api.getEvidenceRequirements(service, "independent_startup").includes("ocp_vehicle_service_registration"));
    const day = offset => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
    seed("provider_applications", { id: providerId, name: "SYNTHETIC APPLICANT", email: "applicant@example.invalid", service: service + " | vehicle_lockout",
      service_area: "Montgomery County, Maryland", experience: "Test only", insurance_status: "unverified", is_test_provider: "no" });
    seed("provider_pathway_profiles", { id: "path", provider_id: providerId, provider_person_id: "person", relationship_path: "independent_startup",
      provider_level: "specialty_provider", pathway_version: 1, policy_version: api.POLICY_VERSION });
    for (const [id, requirement] of [["county", "ocp_vehicle_service_registration"], ["insurance", "general_liability_coi"]]) {
      seed("provider_evidence_submissions", { id, provider_id: providerId, person_id: "person", service_code: id === "insurance" ? "vehicle_lockout" : service,
        requirement_key: requirement, jurisdiction: api.POLICY_JURISDICTION, evidence_type: "document",
        storage_key: "synthetic/no-file", content_type: "application/pdf", document_hash: "a".repeat(64),
        issuer: "SYNTHETIC ISSUER", effective_at: day(-20), expires_at: day(90) });
      seed("evidence_file_scans", { id: id + "-scan", evidence_submission_id: id, provider_id: providerId,
        file_hash: "a".repeat(64), status: "clean", scan_provider: "synthetic", requested_at: new Date().toISOString() });
    }
    globalThis.fetch = async url => {
      state.network++;
      assert.equal(new URL(url).origin, "https://data.montgomerycountymd.gov");
      return Response.json(String(url).includes("/api/views/")
        ? { id: "dngn-wp3e", rowsUpdatedAt: Math.floor(Date.now() / 1000) - 86400 }
        : [{ registration_no: "26-MT-123456", corporation_name: "SYNTHETIC BUSINESS LLC", issue_date: day(-20), expire_date: day(90) }]);
    };
    const post = async (body, owner = true, origin = "https://tuveloz.invalid") => {
      const response = await api.POST(new Request("https://tuveloz.invalid/api/admin/provider-compliance", {
        method: "POST", headers: { "content-type": "application/json", origin, "x-test-owner": owner ? "yes" : "no" }, body: JSON.stringify(body),
      }));
      return { status: response.status, body: await response.json() };
    };
    const payload = { action: "check-county-registration", providerId, evidenceId: "county", registrationNumber: "26-MT-123456", expectedLegalName: "SYNTHETIC BUSINESS LLC" };
    const evidenceBefore = sql.prepare("SELECT * FROM provider_evidence_submissions").all();
    await t.test("unauthorized, cross-origin, wrong-provider and wrong-type lookups do not query the county", async () => {
      assert.equal((await post(payload, false)).status, 403);
      assert.equal((await post(payload, true, "https://other.invalid")).status, 403);
      assert.equal((await post({ ...payload, providerId: "wrong" })).status, 404);
      assert.equal((await post({ ...payload, evidenceId: "insurance" })).status, 400);
      assert.equal(state.network, 0);
    });
    await t.test("quarantined or changed files and outdated application scope cannot query the county", async () => {
      for (const status of ["pending", "failed", "infected"]) {
        sql.prepare("UPDATE evidence_file_scans SET status=? WHERE id='county-scan'").run(status);
        assert.equal((await post(payload)).status, 423);
      }
      sql.prepare("UPDATE evidence_file_scans SET status='clean', file_hash=? WHERE id='county-scan'").run("b".repeat(64));
      assert.equal((await post(payload)).status, 423);
      sql.prepare("UPDATE evidence_file_scans SET file_hash=? WHERE id='county-scan'").run("a".repeat(64));
      sql.prepare("UPDATE provider_evidence_submissions SET jurisdiction='US-MD-Other' WHERE id='county'").run();
      assert.equal((await post(payload)).status, 409);
      sql.prepare("UPDATE provider_evidence_submissions SET jurisdiction=? WHERE id='county'").run(api.POLICY_JURISDICTION);
      assert.equal(state.network, 0);
    });
    await t.test("an actual route lookup saves a bound source receipt without approval or notification", async () => {
      const result = await post(payload);
      assert.equal(result.status, 200, JSON.stringify(result));
      assert.equal(result.body.check.status, "record_match");
      assert.equal(state.network, 2);
      const audit = sql.prepare("SELECT * FROM provider_audit_events WHERE id=?").get(result.body.check.receiptId);
      assert.equal(audit.entity_id, "county");
      assert.equal(JSON.parse(audit.metadata).documentHash, "a".repeat(64));
      assert.deepEqual(sql.prepare("SELECT * FROM provider_evidence_submissions").all(), evidenceBefore);
      assert.equal(state.notifications, 0);
      assert.equal(state.cleanup, 0);
      const response = await api.GET(new Request("https://tuveloz.invalid/api/admin/provider-compliance?registrationEvidenceId=county", { headers: { "x-test-owner": "yes" } }));
      assert.equal((await response.json()).check.receiptId, audit.id);
      sql.prepare("UPDATE provider_evidence_submissions SET document_hash=? WHERE id='county'").run("b".repeat(64));
      const changed = await api.GET(new Request("https://tuveloz.invalid/api/admin/provider-compliance?registrationEvidenceId=county", { headers: { "x-test-owner": "yes" } }));
      assert.equal((await changed.json()).check, null, "Receipt cannot transfer to a different document");
      sql.prepare("UPDATE provider_evidence_submissions SET document_hash=? WHERE id='county'").run("a".repeat(64));
    });
    const review = { action: "review-evidence", providerId, evidenceId: "insurance", status: "accepted", reasonCode: "owner_evidence_accepted",
      authenticityVerificationMethod: "insurer_or_broker_confirmation", authenticityVerifiedBy: "Synthetic verifier",
      authenticityVerificationReference: "SYNTHETIC-NO-POLICY-001", authenticitySourceUrl: "https://insurer.example.invalid/confirmation",
      authenticityVerifiedAt: day(0), authenticityValidThrough: day(30), verifiedLegalBusinessName: "SYNTHETIC BUSINESS LLC", legalBusinessNameConfirmed: true };
    await t.test("insurance review rejects missing confirmation and official business lookup substitution", async () => {
      assert.equal((await post(review)).status, 400);
      assert.equal((await post({ ...review, authenticityVerificationMethod: "official_online_lookup", authenticitySourceUrl: "https://www.maryland.gov/" })).status, 400);
      assert.equal(sql.prepare("SELECT status FROM provider_evidence_submissions WHERE id='insurance'").get().status, "pending");
      assert.equal((await post({ ...review, evidenceId: "county", authenticityVerificationMethod: "official_online_lookup", authenticitySourceUrl: "https://data.montgomerycountymd.gov/resource/dngn-wp3e.json" })).status, 400);
    });
    await t.test("documented synthetic confirmation saves only its exact review and clears on correction", async () => {
      const insuranceConfirmation = { organization: "SYNTHETIC INSURER", contact: "https://insurer.example.invalid/contact",
        independentlySourced: true, insuredAndPolicyConfirmed: true, datesAndLimitsConfirmed: true, serviceAndLocationConfirmed: true };
      const result = await post({ ...review, insuranceConfirmation });
      assert.equal(result.status, 200, JSON.stringify(result));
      const saved = sql.prepare("SELECT * FROM provider_evidence_submissions WHERE id='insurance'").get();
      assert.equal(saved.status, "accepted");
      assert.equal(JSON.parse(saved.evidence_scope).insuranceConfirmation.organization, "SYNTHETIC INSURER");
      assert.equal((await post({ ...review, status: "needs_correction", reasonCode: "issuer_or_authority_unverified", notes: "Synthetic correction test" })).status, 200);
      assert.equal(JSON.parse(sql.prepare("SELECT evidence_scope FROM provider_evidence_submissions WHERE id='insurance'").get().evidence_scope).insuranceConfirmation, undefined);
      const provider = sql.prepare("SELECT status, verification_status, approved_services FROM provider_applications WHERE id=?").get(providerId);
      assert.notEqual(provider.status, "approved");
      assert.notEqual(provider.verification_status, "verified");
      assert.equal(provider.approved_services, "");
    });
  } finally {
    globalThis.fetch = originalFetch;
    delete globalThis.__credentialTestDb;
    delete globalThis.__credentialTest;
    sql.close();
    rmSync(out, { recursive: true, force: true });
  }
});
