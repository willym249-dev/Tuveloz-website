import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { createRequire } from "node:module";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { build } from "esbuild";
import { drizzle } from "drizzle-orm/sqlite-proxy";

// Actual authentication, route and migrated constraints. Only Cloudflare storage
// bindings are replaced; all external requests fail, including Stripe/email.
test("repair records bind participant decisions to the displayed document without moving money", async t => {
  const repo = resolve(import.meta.dirname, "..");
  const scratch = mkdtempSync(join(tmpdir(), "tuveloz-repair-records-"));
  const database = new DatabaseSync(":memory:");
  const originalFetch = globalThis.fetch, originalError = console.error;
  const origin = "https://tuveloz.invalid", errors = [];
  let networkCalls = 0;
  const state = { db: null, batchBarrier: null, beforeBatch: null, failWrite: "", writes: [], realAllowed: false, serviceFixtureAllowed: false, providerAllowed: true, eligibilityCalls: [], gateCalls: [], tamperInvoice: false, env: {
    AUTH_CODE_SECRET: "synthetic-repair-auth-local-only", SITE_URL: origin,
  } };
  const execute = (sql, values, method) => {
    assert.ok(values.length <= 100, "D1 bind limit must be respected");
    const statement = database.prepare(sql);
    if (method === "first") {
      const row = statement.get(...values) ?? null;
      return row && state.tamperInvoice && sql.includes("FROM provider_invoices") ? { ...row, workSummary: "TAMPERED visible work" } : row;
    }
    if (method === "all") return { results: statement.all(...values) };
    if (state.failWrite && sql.includes(state.failWrite)) throw Error("SYNTHETIC write failure");
    const result = statement.run(...values);
    state.writes.push({ sql, changes: Number(result.changes) });
    return { success: true, meta: { changes: Number(result.changes) } };
  };
  state.env.DB = {
    prepare(sql) {
      let values = [];
      return { bind(...params) { values = params; return this; },
        first: async () => execute(sql, values, "first"), all: async () => execute(sql, values, "all"),
        run: async () => execute(sql, values, "run"), execute: () => execute(sql, values, "run") };
    },
    async batch(statements) {
      await state.batchBarrier?.();
      if (state.beforeBatch) { const callback = state.beforeBatch; state.beforeBatch = null; callback(); }
      database.exec("BEGIN");
      try { const results = statements.map(statement => statement.execute()); database.exec("COMMIT"); return results; }
      catch (error) { database.exec("ROLLBACK"); throw error; }
    },
  };
  globalThis.__repairRecordsRuntime = state;
  const seed = (table, values) => {
    const keys = Object.keys(values);
    database.prepare(`INSERT INTO ${table} (${keys.join(",")}) VALUES (${keys.map(() => "?").join(",")})`).run(...Object.values(values));
  };
  const rows = table => database.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all();
  const records = () => Object.fromEntries(["repair_authorization_records", "repair_authorization_items", "provider_invoices", "provider_invoice_items", "customer_agreement_acceptances"].map(table => [table, rows(table)]));
  const financials = () => Object.fromEntries(["stripe_payments", "payment_adjustments", "provider_job_records"].map(table => [table, rows(table)]));
  const now = new Date().toISOString();
  const lineItems = [{ lineType: "labor", description: "SYNTHETIC authorized labor", partNumber: "", partCondition: "not_applicable", quantity: 1, unitAmountCents: 10000, lineAmountCents: 10000, laborMinutes: 60, mechanicIdentifier: "SYNTHETIC-1" }];
  const authorization = { action: "save-authorization", status: "presented", lineItems,
    providerBusinessName: "SYNTHETIC provider", providerBusinessAddress: "SYNTHETIC business address", providerBusinessPhone: "2025550100", countyRegistrationNumber: "SYNTHETIC-REG",
    customerName: "SYNTHETIC customer", customerAddress: "SYNTHETIC customer address", vehicleYear: "2020", vehicleMakeModel: "SYNTHETIC car", vehicleTag: "SYNTHETIC", vehicleVin: "", odometerReading: 100,
    customerInstructions: "SYNTHETIC authorized labor request", providerDiagnosis: "SYNTHETIC diagnosis", laborBillingMethod: "other_flat_rate", laborDisclosure: "SYNTHETIC agreed flat labor price",
    completionDisclosure: "SYNTHETIC completion plan", estimateFeeCents: 0, surchargeCents: 0, surchargeDescription: "", replacedPartsChoice: "not_applicable", providerRepresentativeName: "SYNTHETIC provider", providerRepresentativeTitle: "Technician", providerCertified: true };
  const invoice = { action: "save-invoice", status: "final", lineItems, workSummary: "SYNTHETIC labor was completed", warrantyProvider: "none_offered", warrantyTerms: "SYNTHETIC test warranty terms", warrantyWorkStatement: "SYNTHETIC work statement", returnedPartsChoice: "not_applicable", mechanicIdentifiers: ["SYNTHETIC-1"], providerRepresentativeName: "SYNTHETIC provider", providerRepresentativeTitle: "Technician", providerCertified: true };
  try {
    globalThis.fetch = async () => { networkCalls++; throw Error("External requests forbidden in repair-record rehearsal"); };
    console.error = (...args) => errors.push(args.map(String).join(" "));
    for (const entry of JSON.parse(readFileSync(join(repo, "drizzle/meta/_journal.json"), "utf8")).entries) {
      for (const sql of readFileSync(join(repo, "drizzle", entry.tag + ".sql"), "utf8").split("--> statement-breakpoint")) if (sql.trim()) database.exec(sql);
    }
    state.db = drizzle(async (sql, params, method) => {
      if (method === "run") { execute(sql, params, "run"); return { rows: [] }; }
      database.exec("PRAGMA short_column_names=OFF; PRAGMA full_column_names=ON;");
      try { const statement = database.prepare(sql); return { rows: method === "get" ? Object.values(statement.get(...params) ?? {}) : statement.all(...params).map(row => Object.values(row)) }; }
      finally { database.exec("PRAGMA short_column_names=ON; PRAGMA full_column_names=OFF;"); }
    });
    const bundle = join(scratch, "route.cjs");
    await build({ absWorkingDir: repo, stdin: { contents: `export { GET, POST } from "./app/api/repair-records/route"; export { createAccountSession, sessionCookie } from "./lib/account-auth"; export { repairRecordAccess } from "./lib/repair-record-access"; export { ELECTRONIC_SIGNATURE_NOTICE } from "./lib/maryland-repair-records";`, resolveDir: repo, loader: "ts" }, bundle: true, platform: "node", format: "cjs", outfile: bundle, target: "node22", logLevel: "silent",
      plugins: [{ name: "repair-local-storage", setup(builder) {
        builder.onResolve({ filter: /^cloudflare:workers$/ }, () => ({ path: "env", namespace: "fixture" }));
        builder.onResolve({ filter: /provider-policy\.ts$/, namespace: "fixture" }, () => ({ path: resolve(repo, "lib/provider-policy.ts"), namespace: "file" }));
        builder.onResolve({ filter: /(?:^|\/)db$/ }, args => args.path.startsWith(".") ? { path: "db", namespace: "fixture" } : null);
        builder.onResolve({ filter: /^\.\/(runtime-marketplace-action|job-operations|provider-eligibility-engine|provider-policy)$/ }, args => args.importer.replaceAll("\\", "/").endsWith("lib/repair-record-access.ts") ? { path: args.path, namespace: "fixture" } : null);
        builder.onLoad({ filter: /.*/, namespace: "fixture" }, args => ({ loader: "js", contents: {
          env: "export const env = globalThis.__repairRecordsRuntime.env;",
          db: "export function getDb() { return globalThis.__repairRecordsRuntime.db; }",
          "./runtime-marketplace-action": "export async function runtimeMarketplaceActionAllowed(action) { const s=globalThis.__repairRecordsRuntime; s.gateCalls.push(action); return s.realAllowed; }",
          "./job-operations": "export async function assignedJobOperationContext(id,email) { return globalThis.__repairRecordsRuntime.assignment(id,email); } export async function evaluateAssignedJobStage(input) { const s=globalThis.__repairRecordsRuntime; s.eligibilityCalls.push(input); return {allowed:s.providerAllowed,context:s.assignment(input.requestId,input.providerEmail)}; }",
          "./provider-eligibility-engine": "export async function evaluateStageEligibility(input) { const s=globalThis.__repairRecordsRuntime; s.eligibilityCalls.push(input); return {allowed:s.providerAllowed}; }",
          "./provider-policy": `import {getServiceDefaultDenyStatus as actualService,jurisdictionIsOpenForService as actualJurisdiction} from ${JSON.stringify(resolve(repo, "lib/provider-policy.ts"))}; export function getServiceDefaultDenyStatus(code) { return globalThis.__repairRecordsRuntime.serviceFixtureAllowed ? {enabled:code==='provisional_12v_jump_start'} : actualService(code); } export function jurisdictionIsOpenForService(place) { return globalThis.__repairRecordsRuntime.serviceFixtureAllowed ? place==='US-MD-MontgomeryCounty' : actualJurisdiction(place); }`,
        }[args.path] }));
      } }],
    });
    const api = createRequire(import.meta.url)(bundle);
    for (const [id, email, flag] of [["provider", "provider@example.invalid", "yes"], ["real-provider", "real-provider@example.invalid", "no"], ["outsider-provider", "outsider-provider@example.invalid", "yes"]]) {
      seed("provider_applications", { id, name: "SYNTHETIC provider", email, service: "provisional_12v_jump_start", service_area: "Montgomery County, Maryland", experience: "Synthetic only", insurance_status: "unverified", is_test_provider: flag, status: "new", verification_status: "not reviewed" });
    }
    function seedJob(id, options = {}) {
      const { email = "customer@example.invalid", providerEmail = "provider@example.invalid", isTest = "yes" } = options;
      seed("customer_requests", { id, name: "SYNTHETIC customer", email, zip: "20910", vehicle: "SYNTHETIC vehicle", service: "provisional_12v_jump_start", details: "SYNTHETIC repair test", status: "quote accepted", is_test_job: isTest,
        service_codes: '["provisional_12v_jump_start"]', jurisdiction: "US-MD-MontgomeryCounty", parts_source: "No parts needed — labor only", parts_preference: "No preference", labor_only_parts_acknowledged_at: now });
      seed("provider_quotes", { id: `${id}-quote`, request_id: id, provider_name: "SYNTHETIC provider", provider_email: providerEmail, price_cents: "10000", labor_price_cents: "10000", parts_price_cents: "0", labor_only_parts_confirmed_at: now,
        part_type: "No parts needed", availability: "Synthetic only", message: "SYNTHETIC quote", service_codes: '["provisional_12v_jump_start"]', status: "accepted", customer_fee_rate_bps: 500, customer_fee_cents: "500", customer_total_cents: "10500", scope_version: 1 });
    }
    seedJob("owned"); seedJob("foreign", { email: "outsider@example.invalid", providerEmail: "outsider-provider@example.invalid" });
    state.assignment = (id, email) => {
      const row = database.prepare(`SELECT request.id AS requestId, quote.id AS quoteId, provider.id AS providerId, quote.scope_version AS scopeVersion, request.assignment_version AS assignmentVersion, request.jurisdiction, request.service_codes AS serviceCodes, request.is_test_job AS isTestJob, provider.is_test_provider AS isTestProvider FROM customer_requests request JOIN provider_quotes quote ON quote.request_id=request.id AND quote.status='accepted' JOIN provider_applications provider ON provider.email=quote.provider_email WHERE request.id=? AND quote.provider_email=?`).get(id, email);
      return row ? { ...row, providerEmail: email, isTestJob: row.isTestJob === "yes", isTestProvider: row.isTestProvider === "yes", serviceCodes: JSON.parse(row.serviceCodes), personId: "synthetic-person", supervisorPersonId: "", scheduledFor: "", customerProviderDisclosureAcceptedAt: now, jobFacts: {} } : null;
    };
    const cookieFor = async (email, role) => {
      const session = await api.createAccountSession(email, role); assert.ok(session);
      return api.sessionCookie(new Request(origin), session.token).split(";")[0];
    };
    const customer = await cookieFor("customer@example.invalid", "customer"), provider = await cookieFor("provider@example.invalid", "provider");
    const outsider = await cookieFor("outsider@example.invalid", "customer"), otherProvider = await cookieFor("outsider-provider@example.invalid", "provider");
    const get = async (cookie = customer) => { const result = await api.GET(new Request(origin + "/api/repair-records", { headers: { cookie } })); return { status: result.status, body: await result.json() }; };
    const post = async (id, body, cookie = customer, from = origin) => {
      const result = await api.POST(new Request(origin + "/api/repair-records", { method: "POST", headers: { origin: from, cookie, "content-type": "application/json" }, body: JSON.stringify({ requestId: id, expectedQuoteId: `${id}-quote`, expectedScopeVersion: 1, ...(body.action?.startsWith("save-") ? { expectedRecordId: "", expectedUpdatedAt: "" } : {}), ...body }) }));
      assert.equal(result.headers.get("cache-control"), "private, no-store"); return { status: result.status, body: await result.json() };
    };
    const successful = reply => { assert.equal(reply.status, 200, JSON.stringify(reply.body)); assert.equal(reply.body.ok, true); return reply.body; };
    const displayed = record => ({ expectedRecordId: record.id, expectedDocumentHash: record.documentHash });
    async function finalInvoice(id) {
      seedJob(id);
      let body = successful(await post(id, authorization, provider));
      const record = body.jobs.find(job => job.requestId === id).authorization;
      successful(await post(id, { action: "sign-authorization", ...displayed(record), acceptedByName: "SYNTHETIC customer", signatureAccepted: true }));
      database.prepare("UPDATE customer_requests SET status='completed' WHERE id=?").run(id);
      body = successful(await post(id, invoice, provider));
      return body.jobs.find(job => job.requestId === id).invoice;
    }
    await t.test("real signed sessions scope reads and writes to the exact participant", async () => {
      assert.equal((await get("")).status, 401); assert.equal((await get("__Host-tuveloz_session=forged")).status, 401);
      assert.deepEqual((await get()).body.jobs.map(job => job.requestId), ["owned"]);
      assert.deepEqual((await get(provider)).body.jobs.map(job => job.requestId), ["owned"]);
      const before = records();
      for (const [id, body, cookie, from, expected] of [
        ["owned", authorization, otherProvider, origin, 404], ["foreign", authorization, provider, origin, 404],
        ["owned", authorization, customer, origin, 403], ["owned", authorization, provider, "https://outsider.invalid", 403],
        ["owned", { action: "sign-invoice" }, outsider, origin, 404], ["owned", authorization, "", origin, 401],
      ]) assert.equal((await post(id, body, cookie, from)).status, expected);
      assert.deepEqual(records(), before);
    });
    await t.test("stored real and mixed jobs cannot acquire test privileges from request fields", async () => {
      seedJob("real", { providerEmail: "real-provider@example.invalid", isTest: "no" });
      seedJob("mixed-test-job", { providerEmail: "real-provider@example.invalid" });
      seedJob("mixed-real-job", { isTest: "no" });
      const snapshot = (await get()).body;
      const real = snapshot.jobs.find(job => job.requestId === "real");
      assert.ok(real); assert.equal(real.isTest, false); assert.equal(real.writesAllowed, false); assert.equal(snapshot.realJobsEnabled, false);
      assert.ok(!snapshot.jobs.some(job => job.requestId.startsWith("mixed-")), "mixed persisted modes are excluded");
      const realProvider = await cookieFor("real-provider@example.invalid", "provider"), before = records();
      const blocked = await post("real", { ...authorization, testOnly: true, isTest: true, realJobsEnabled: true }, realProvider);
      assert.equal(blocked.status, 503); assert.notEqual(blocked.body.ok, true);
      assert.equal((await post("mixed-test-job", authorization, realProvider)).status, 404);
      assert.equal((await post("mixed-real-job", authorization, provider)).status, 404);
      assert.deepEqual(records(), before);
    });
    await t.test("open global gates do not bypass a denied service, mismatched scope or jurisdiction", () => {
      const job = { isTestJob: "no", isTestProvider: "no", requestStatus: "completed", serviceCodes: '["provisional_12v_jump_start"]', quoteServiceCodes: '["provisional_12v_jump_start"]', jurisdiction: "US-MD-MontgomeryCounty" };
      for (const change of [
        { serviceCodes: '["unapproved-service"]', quoteServiceCodes: '["unapproved-service"]' },
        { quoteServiceCodes: '["another-service"]' }, { serviceCodes: "not-json" },
        { serviceCodes: '[]', quoteServiceCodes: '[]' }, { jurisdiction: "UNAPPROVED" },
        { isTestJob: "yes", isTestProvider: "no" }, { requestStatus: "cancelled" },
      ]) {
        const access = api.repairRecordAccess({ ...job, ...change }, { authorization: true, invoice: true });
        assert.equal(access.writesAllowed, false); assert.equal(access.authorizationWritesAllowed, false); assert.equal(access.invoiceWritesAllowed, false);
      }
    });
    await t.test("a real allowed GET cannot authorize a later write after readiness or provider eligibility is denied", async () => {
      const realProvider = await cookieFor("real-provider@example.invalid", "provider");
      // Controlled launch dependencies exercise the future allowed path; this
      // is not evidence that any real service/provider is currently approved.
      state.realAllowed = true; state.serviceFixtureAllowed = true;
      try {
        const before = records(), visible = (await get()).body.jobs.find(job => job.requestId === "real");
        assert.equal(visible.authorizationWritesAllowed, true, JSON.stringify(visible));
        state.realAllowed = false;
        assert.equal((await post("real", authorization, realProvider)).status, 503);
        state.realAllowed = true; state.providerAllowed = false;
        assert.equal((await post("real", authorization, realProvider)).status, 409);
        assert.deepEqual(records(), before);
        state.providerAllowed = true;
        const body = successful(await post("real", authorization, realProvider)), record = body.jobs.find(job => job.requestId === "real").authorization;
        successful(await post("real", { action: "sign-authorization", ...displayed(record), acceptedByName: "REAL FIXTURE CUSTOMER", signatureAccepted: true }));
        database.prepare("UPDATE customer_requests SET status='completed' WHERE id='real'").run();
        const saved = successful(await post("real", invoice, realProvider)).jobs.find(job => job.requestId === "real").invoice;
        successful(await post("real", { action: "sign-invoice", ...displayed(saved), acceptedByName: "REAL FIXTURE CUSTOMER", signatureAccepted: true }));
        const booking = state.eligibilityCalls.filter(call => call.stage === "booking"), completion = state.eligibilityCalls.filter(call => call.stage === "completion");
        assert.ok(booking.length); assert.ok(completion.length);
        assert.ok(booking.every(call => call.persist === false && call.testOnly === false));
        assert.ok(completion.every(call => call.persist === false));
        assert.ok(state.gateCalls.includes("job_start") && state.gateCalls.includes("completion"));
        state.realAllowed = false;
        const frozen = records();
        const paused = (await get()).body.jobs.find(job => job.requestId === "real");
        assert.equal(paused.invoice.customerSignatureName, "REAL FIXTURE CUSTOMER"); assert.equal(paused.writesAllowed, false);
        assert.equal((await post("real", { action: "receive-invoice-copy", ...displayed(saved), copyReceived: true })).status, 503);
        assert.deepEqual(records(), frozen);
      } finally { state.realAllowed = false; state.serviceFixtureAllowed = false; state.providerAllowed = true; }
    });
    let original;
    await t.test("a sequential stale draft cannot overwrite a newer edit or presentation", async () => {
      seedJob("draft-revision");
      const initial = successful(await post("draft-revision", { ...authorization, status: "draft" }, provider)).jobs.find(job => job.requestId === "draft-revision").authorization;
      const revision = { expectedRecordId: initial.id, expectedUpdatedAt: initial.updatedAt };
      const newer = successful(await post("draft-revision", { ...authorization, ...revision, status: "draft", providerDiagnosis: "NEWER saved diagnosis" }, provider)).jobs.find(job => job.requestId === "draft-revision").authorization;
      assert.notEqual(newer.updatedAt, initial.updatedAt, "revision advances even within one millisecond");
      const before = records();
      const stale = await post("draft-revision", { ...authorization, ...revision, status: "draft", providerDiagnosis: "OLDER stale diagnosis" }, provider);
      assert.equal(stale.status, 409); assert.notEqual(stale.body.ok, true); assert.deepEqual(records(), before);
      successful(await post("draft-revision", { ...authorization, expectedRecordId: newer.id, expectedUpdatedAt: newer.updatedAt }, provider));
      const presented = records();
      assert.equal((await post("draft-revision", { ...authorization, ...revision, status: "draft" }, provider)).status, 409);
      assert.deepEqual(records(), presented);
    });
    await t.test("an assignment change between validation and transaction aborts every record write", async () => {
      seedJob("assignment-race"); const before = records();
      state.beforeBatch = () => database.prepare("UPDATE customer_requests SET assignment_version=assignment_version+1 WHERE id='assignment-race'").run();
      const result = await post("assignment-race", authorization, provider);
      assert.equal(result.status, 409); assert.notEqual(result.body.ok, true); assert.deepEqual(records(), before);
    });
    await t.test("finalization and signing require the exact displayed record and fresh affirmative consent", async () => {
      original = await finalInvoice("signing"); const before = records();
      for (const change of [{ expectedRecordId: "another-invoice" }, { expectedDocumentHash: "0".repeat(64) }, { expectedRecordId: undefined }, { expectedDocumentHash: undefined }, { expectedQuoteId: "stale-quote" }, { expectedScopeVersion: 2 }, { signatureAccepted: false }]) {
        const reply = await post("signing", { action: "sign-invoice", ...displayed(original), acceptedByName: "SYNTHETIC customer", signatureAccepted: true, ...change });
        assert.ok([400, 409].includes(reply.status), JSON.stringify(reply.body)); assert.notEqual(reply.body.ok, true);
      }
      const unsignedCopy = await post("signing", { action: "receive-invoice-copy", ...displayed(original), copyReceived: true });
      assert.equal(unsignedCopy.status, 409); assert.notEqual(unsignedCopy.body.ok, true);
      assert.deepEqual(records(), before);
      const reply = successful(await post("signing", { action: "sign-invoice", ...displayed(original), acceptedByName: "ORIGINAL SIGNER", signatureAccepted: true }));
      assert.equal(reply.paymentReleased, false); assert.equal(reply.recordId, original.id); assert.equal(reply.documentHash, original.documentHash);
    });
    await t.test("duplicate signing and repeated copy retrieval preserve original signature and financial records", async () => {
      const before = records(), money = financials();
      const duplicate = await post("signing", { action: "sign-invoice", ...displayed(original), acceptedByName: "REPLACEMENT SIGNER", signatureAccepted: true });
      assert.equal(duplicate.status, 409); assert.notEqual(duplicate.body.ok, true); assert.deepEqual(records(), before);
      const retry = successful(await post("signing", { action: "sign-invoice", ...displayed(original), acceptedByName: "ORIGINAL SIGNER", signatureAccepted: true }));
      assert.equal(retry.alreadySigned, true); assert.deepEqual(records(), before);
      for (let attempt = 0; attempt < 2; attempt++) {
        successful(await post("signing", { action: "receive-invoice-copy", ...displayed(original), copyReceived: true }));
        await get(); assert.deepEqual(records(), before, "copy reads must preserve signature, acceptance and original delivery timestamps");
      }
      assert.equal((await post("signing", { action: "receive-invoice-copy", ...displayed(original), copyReceived: true }, provider)).status, 403);
      assert.deepEqual(financials(), money);
    });
    await t.test("two simultaneous signatures commit one acceptance and never report a second success", async () => {
      const record = await finalInvoice("concurrent"), before = rows("customer_agreement_acceptances").length;
      let arrived = 0, release;
      const barrier = new Promise(resolve => { release = resolve; });
      state.batchBarrier = async () => { if (++arrived === 2) release(); await barrier; };
      let replies;
      try { replies = await Promise.all(["FIRST", "SECOND"].map(name => post("concurrent", { action: "sign-invoice", ...displayed(record), acceptedByName: name, signatureAccepted: true }))); }
      finally { state.batchBarrier = null; }
      assert.deepEqual(replies.map(reply => reply.status).sort(), [200, 409]);
      assert.equal(replies.filter(reply => reply.body.ok === true).length, 1);
      assert.equal(rows("customer_agreement_acceptances").length, before + 1);
      const saved = database.prepare("SELECT * FROM provider_invoices WHERE id=?").get(record.id);
      const acceptance = database.prepare("SELECT * FROM customer_agreement_acceptances WHERE request_id=? AND agreement_key='provider_final_invoice_signature'").get("concurrent");
      assert.equal(saved.customer_signature_name, acceptance.accepted_by_name);
      assert.equal(saved.customer_signature_at, acceptance.accepted_at);
    });
    await t.test("a failed signing batch rolls back both the signature and acceptance", async () => {
      const record = await finalInvoice("rollback"), before = records();
      state.failWrite = "INSERT INTO customer_agreement_acceptances";
      try { const reply = await post("rollback", { action: "sign-invoice", ...displayed(record), acceptedByName: "SYNTHETIC", signatureAccepted: true }); assert.ok(reply.status >= 400); assert.notEqual(reply.body.ok, true); }
      finally { state.failWrite = ""; }
      assert.deepEqual(records(), before);
    });
    await t.test("different visible invoice fields cannot be signed against an unchanged frozen hash", async () => {
      const record = await finalInvoice("tamper"), before = records(); state.tamperInvoice = true;
      try { const result = await post("tamper", { action: "sign-invoice", ...displayed(record), acceptedByName: "SYNTHETIC", signatureAccepted: true }); assert.equal(result.status, 409); assert.notEqual(result.body.ok, true); }
      finally { state.tamperInvoice = false; }
      assert.deepEqual(records(), before);
    });
    await t.test("copy-only recovery fills missing delivery without inventing or replacing signature evidence", async () => {
      for (const genuine of [false, true]) {
        const id = `legacy-copy-${genuine}`, record = await finalInvoice(id), signedAt = "2026-10-01T12:00:00.000Z", retainedAt = "2026-10-01T12:01:00.000Z";
        database.prepare(`UPDATE provider_invoices SET customer_signature_name='HISTORICAL SIGNER',customer_signature_action='typed-name-and-affirmative-final-invoice-checkbox',customer_signature_at=?,customer_signature_session_id='historical-session',customer_signature_ip='192.0.2.1',customer_signature_device='{}',provider_copy_retained_at=? WHERE id=?`).run(signedAt, retainedAt, record.id);
        if (genuine) seed("customer_agreement_acceptances", { id: `${id}-acceptance`, customer_email: "customer@example.invalid", request_id: id, quote_id: `${id}-quote`, scope_version: 1, scope_snapshot: record.documentSnapshot, agreement_key: "provider_final_invoice_signature", agreement_version: "maryland-repair-records-2026-08-01-v2", agreement_hash: record.documentHash, agreement_text: `${record.documentSnapshot}\n${api.ELECTRONIC_SIGNATURE_NOTICE}`, accepted_by_name: "HISTORICAL SIGNER", acceptance_action: "typed-name-and-affirmative-final-invoice-checkbox", accepted_at: signedAt, ip_address: "192.0.2.1", session_id: "historical-session", device_context: "{}" });
        const before = database.prepare("SELECT * FROM provider_invoices WHERE id=?").get(record.id), count = rows("customer_agreement_acceptances").length;
        const result = await post(id, { action: "receive-invoice-copy", ...displayed(record), copyReceived: true });
        if (!genuine) {
          assert.equal(result.status, 409); assert.deepEqual(database.prepare("SELECT * FROM provider_invoices WHERE id=?").get(record.id), before);
          assert.throws(() => database.prepare("UPDATE provider_invoices SET customer_copy_delivery_method='secure-account-copy',customer_copy_delivered_to='customer@example.invalid',customer_copy_delivered_at=? WHERE id=?").run(now, record.id), /matching original customer signature evidence/);
        } else {
          successful(result); const after = database.prepare("SELECT * FROM provider_invoices WHERE id=?").get(record.id);
          for (const key of Object.keys(before).filter(key => key.startsWith("customer_signature_"))) assert.equal(after[key], before[key]);
          assert.equal(after.provider_copy_retained_at, retainedAt); assert.ok(after.customer_copy_delivered_at); assert.equal(after.customer_copy_delivered_to, "customer@example.invalid");
          assert.throws(() => database.prepare("UPDATE provider_invoices SET customer_signature_name='REPLACEMENT' WHERE id=?").run(record.id), /immutable/);
          assert.throws(() => database.prepare("UPDATE provider_invoices SET customer_copy_delivered_at='2030-01-01' WHERE id=?").run(record.id), /immutable/);
          successful(await post(id, { action: "receive-invoice-copy", ...displayed(record), copyReceived: true }));
          assert.deepEqual(database.prepare("SELECT * FROM provider_invoices WHERE id=?").get(record.id), after);
        }
        assert.equal(rows("customer_agreement_acceptances").length, count);
      }
    });
    assert.equal(networkCalls, 0);
    assert.deepEqual(financials(), { stripe_payments: [], payment_adjustments: [], provider_job_records: [] });
    assert.ok(!state.writes.some(write => /(?:UPDATE|INSERT INTO|DELETE FROM)\s+(?:stripe_payments|payment_adjustments)/i.test(write.sql)), "repair route cannot move or reserve money");
  } finally {
    globalThis.fetch = originalFetch; console.error = originalError; delete globalThis.__repairRecordsRuntime;
    database.close();
    assert.equal(dirname(scratch), resolve(tmpdir())); rmSync(scratch, { recursive: true, force: true });
  }
});
