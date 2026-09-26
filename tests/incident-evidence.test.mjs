import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { createRequire } from "node:module";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { build } from "esbuild";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import { exportJWK, generateKeyPair, SignJWT } from "jose";

// Real auth, upload, incident routes and SQL; synthetic Cloudflare bindings.
// The fixture never talks to a real key service, bucket, customer or payment API.
test("incident evidence is private, append-only, job-bound and atomically audited", async t => {
  const repo = resolve(import.meta.dirname, "..");
  const tempRoot = resolve(tmpdir());
  const scratch = mkdtempSync(join(tempRoot, "tuveloz-incident-evidence-"));
  const database = new DatabaseSync(":memory:");
  const originalFetch = globalThis.fetch;
  const originalError = console.error;
  const objects = new Map();
  const origin = "https://tuveloz.invalid";
  const issuer = "https://synthetic-evidence.cloudflareaccess.com";
  const owner = "owner@example.invalid";
  const state = { db: null, beforeBatch: null, failBatch: false, loseAcknowledgement: false, env: {
    SITE_URL: origin, AUTH_CODE_SECRET: "synthetic-local-evidence-session-secret", OWNER_EMAIL: owner,
    TEAM_DOMAIN: issuer, OWNER_ACCESS_AUD: "synthetic-evidence",
    DB: {
      prepare(query) {
        let values = [];
        return {
          bind(...params) { values = params; return this; },
          async first() { return database.prepare(query).get(...values) ?? null; },
          async all() { return { results: database.prepare(query).all(...values) }; },
          async run() { const result = database.prepare(query).run(...values); return { meta: { changes: Number(result.changes) } }; },
        };
      },
      async batch(statements) {
        state.beforeBatch?.(); state.beforeBatch = null;
        database.exec("BEGIN");
        const results = [];
        try {
          for (const [index, statement] of statements.entries()) {
            if (state.failBatch && index === 1) throw new Error("SYNTHETIC: second statement failed");
            results.push(await statement.run());
          }
          database.exec("COMMIT");
        } catch (error) { database.exec("ROLLBACK"); throw error; }
        if (state.loseAcknowledgement) throw new Error("SYNTHETIC: acknowledgement lost");
        return results;
      },
    },
    BUCKET: {
      async put(key, bytes, metadata) { objects.set(key, { body: new Uint8Array(bytes).slice(), ...metadata }); },
      async get(key) { return objects.get(key) ?? null; },
      async delete(key) { objects.delete(key); },
    },
  } };
  globalThis.__incidentEvidence = state;
  const seed = (table, values) => {
    const columns = Object.keys(values);
    database.prepare(`INSERT INTO ${table} (${columns.join(",")}) VALUES (${columns.map(() => "?").join(",")})`)
      .run(...Object.values(values));
  };
  const row = id => database.prepare("SELECT * FROM job_incidents WHERE id=?").get(id);
  const audits = () => database.prepare("SELECT * FROM job_lifecycle_events WHERE event_type='incident_evidence_linked'").all();
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aS1cAAAAASUVORK5CYII=", "base64");
  try {
    const keys = await generateKeyPair("RS256");
    const publicKey = { ...await exportJWK(keys.publicKey), kid: "synthetic", alg: "RS256", use: "sig" };
    const ownerToken = await new SignJWT({ email: owner }).setProtectedHeader({ alg: "RS256", kid: "synthetic" })
      .setIssuer(issuer).setAudience("synthetic-evidence").setIssuedAt().setExpirationTime("5m").sign(keys.privateKey);
    const ownerHeaders = { "cf-access-jwt-assertion": ownerToken };
    globalThis.fetch = async url => {
      assert.equal(String(url), issuer + "/cdn-cgi/access/certs", "external request forbidden");
      return Response.json({ keys: [publicKey] });
    };
    console.error = (...args) => assert.match(String(args[0]), /Unable to confirm incident evidence link/);
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
        return { rows: method === "get" ? Object.values(statement.get(...params) ?? {})
          : statement.all(...params).map(value => Object.values(value)) };
      } finally { database.exec("PRAGMA short_column_names=ON; PRAGMA full_column_names=OFF;"); }
    });
    const bundle = join(scratch, "route.cjs");
    await build({ absWorkingDir: repo, stdin: { contents: `
      export { GET, POST } from "./app/api/job-operations/route";
      export { POST as upload } from "./app/api/job-evidence/route";
      export { createAccountSession, sessionCookie } from "./lib/account-auth";
    `, resolveDir: repo, loader: "ts" }, bundle: true, platform: "node", format: "cjs", outfile: bundle, target: "node22", logLevel: "silent",
      plugins: [{ name: "local-bindings", setup(builder) {
        builder.onResolve({ filter: /^cloudflare:workers$/ }, () => ({ path: "env", namespace: "fixture" }));
        builder.onResolve({ filter: /(?:^|\/)db$/ }, args => args.path.startsWith(".") ? { path: "db", namespace: "fixture" } : null);
        builder.onLoad({ filter: /.*/, namespace: "fixture" }, args => ({ loader: "js", contents: args.path === "env"
          ? "export const env = globalThis.__incidentEvidence.env;" : "export function getDb() { return globalThis.__incidentEvidence.db; }" }));
      } }],
    });
    const api = createRequire(import.meta.url)(bundle);
    const now = new Date().toISOString();
    seed("provider_applications", { id: "synthetic-provider", name: "SYNTHETIC PROVIDER", email: "provider@example.invalid",
      service: "provisional_12v_jump_start", service_area: "Montgomery County, Maryland", experience: "Synthetic only",
      insurance_status: "unverified", is_test_provider: "yes", status: "new", verification_status: "not reviewed" });
    for (const [id, email] of [["synthetic-job", "customer@example.invalid"], ["other-job", "other@example.invalid"]]) {
      seed("customer_requests", { id, name: "SYNTHETIC CUSTOMER", email, zip: "20910", vehicle: "Synthetic vehicle",
        service: "provisional_12v_jump_start", details: "Evidence test only", status: "quote accepted", is_test_job: "yes",
        service_codes: '["provisional_12v_jump_start"]', jurisdiction: "US-MD-MontgomeryCounty",
        parts_source: "No parts needed — labor only", parts_preference: "No preference", labor_only_parts_acknowledged_at: now });
      seed("provider_quotes", { id: `${id}-quote`, request_id: id, provider_name: "SYNTHETIC PROVIDER",
        provider_email: "provider@example.invalid", price_cents: "100", labor_price_cents: "100", parts_price_cents: "0",
        labor_only_parts_confirmed_at: now, part_type: "No parts needed", availability: "Synthetic only", message: "Synthetic quote",
        service_codes: '["provisional_12v_jump_start"]', status: "accepted", customer_fee_rate_bps: 500,
        customer_fee_cents: "5", customer_total_cents: "105" });
    }
    const sessionHeaders = async (email, role) => {
      const session = await api.createAccountSession(email, role); assert.ok(session);
      return { cookie: api.sessionCookie(new Request(origin), session.token).split(";")[0] };
    };
    const customer = await sessionHeaders("customer@example.invalid", "customer");
    const provider = await sessionHeaders("provider@example.invalid", "provider");
    const outsider = await sessionHeaders("other@example.invalid", "customer");
    const post = async (values, headers = customer) => {
      const result = await api.POST(new Request(origin + "/api/job-operations", { method: "POST",
        headers: { origin, "content-type": "application/json", ...headers }, body: JSON.stringify({ requestId: "synthetic-job", ...values }) }));
      return { status: result.status, body: await result.json() };
    };
    const get = (headers = customer, query = "") => api.GET(new Request(origin + "/api/job-operations?requestId=synthetic-job" + query, { headers }));
    const report = await post({ action: "report-incident", incidentType: "property_damage", severity: "serious", summary: "SYNTHETIC: mark noticed on vehicle during rehearsal" });
    assert.equal(report.status, 201); const incidentId = report.body.incidentId;
    const initial = row(incidentId);
    const upload = async (note, image = false) => {
      const form = new FormData();
      Object.entries({ action: "add", requestId: "synthetic-job", evidenceType: "customer-condition", note }).forEach(([key, value]) => form.set(key, value));
      if (image) form.set("image", new File([png], "synthetic.png", { type: "image/png" }));
      const result = await api.upload(new Request(origin + "/api/job-evidence", { method: "POST", headers: { origin, ...customer }, body: form }));
      assert.equal(result.status, 201); return (await result.json()).evidenceId;
    };
    const photoId = await upload("SYNTHETIC: vehicle condition photo", true);
    const noteId = await upload("SYNTHETIC: additional factual note");
    seed("job_evidence_items", { id: "foreign-photo", request_id: "other-job", provider_email: "provider@example.invalid",
      customer_email: "other@example.invalid", uploaded_by_email: "other@example.invalid", uploaded_by_role: "customer",
      evidence_type: "customer-condition", image_key: "private/foreign.png", note: "Must not be exposed" });
    seed("job_evidence_items", { id: "wrong-parties", request_id: "synthetic-job", provider_email: "other-provider@example.invalid",
      customer_email: "customer@example.invalid", uploaded_by_email: "customer@example.invalid", uploaded_by_role: "customer",
      evidence_type: "customer-condition", image_key: "private/old-assignment.png", note: "Wrong provider assignment" });
    const link = (evidenceId, headers = customer, changes = {}) => post({ action: "link-incident-evidence", incidentId, evidenceId, ...changes }, headers);
    await t.test("forged credentials, outsiders, other jobs and wrong assignments cannot link or read", async () => {
      assert.equal((await link(photoId, {})).status, 401);
      assert.equal((await link(photoId, { "cf-access-authenticated-user-email": owner })).status, 401);
      assert.equal((await link(photoId, outsider)).status, 403);
      assert.equal((await link(photoId, { ...customer, origin: "https://other.invalid" })).status, 403);
      for (const id of ["foreign-photo", "wrong-parties", "https://other.invalid/photo", "missing"]) {
        assert.equal((await link(id)).status, 404);
        assert.equal((await get(ownerHeaders, `&evidenceId=${encodeURIComponent(id)}`)).status, 404);
      }
      assert.equal((await link(photoId, customer, { incidentId: "missing" })).status, 404);
      assert.deepEqual(row(incidentId), initial); assert.equal(audits().length, 0);
      assert.equal((await get(outsider, `&evidenceId=${photoId}`)).status, 403);
      assert.equal((await get({}, `&evidenceId=${photoId}`)).status, 401);
    });
    await t.test("a participant links a saved upload and authorized actors can read its exact bytes", async () => {
      assert.equal((await link(photoId)).status, 200);
      assert.deepEqual(JSON.parse(row(incidentId).evidence_references), [photoId]);
      for (const headers of [customer, provider, ownerHeaders]) {
        const result = await get(headers, `&evidenceId=${photoId}`);
        assert.equal(result.status, 200); assert.equal(result.headers.get("cache-control"), "private, no-store");
        assert.equal(result.headers.get("x-content-type-options"), "nosniff");
        assert.deepEqual(Buffer.from(await result.arrayBuffer()), png);
        const listing = await (await get(headers)).json();
        assert.deepEqual(listing.incidents[0].evidenceIds, [photoId]);
        assert.equal(listing.evidence.length, 2); assert.ok(listing.evidence.every(item => !("imageKey" in item)));
      }
      assert.equal((await get(ownerHeaders, `&evidenceId=${noteId}`)).status, 404);
      assert.equal(audits()[0].actor_id, "customer@example.invalid");
    });
    await t.test("duplicates are idempotent and another participant appends without replacing the first link", async () => {
      assert.equal((await link(photoId)).body.alreadyLinked, true); assert.equal(audits().length, 1);
      assert.equal((await link(noteId, provider)).status, 200);
      assert.deepEqual(JSON.parse(row(incidentId).evidence_references), [photoId, noteId]);
      assert.equal(audits()[1].actor_id, "provider@example.invalid");
    });
    const nextNote = await upload("SYNTHETIC: note for owner review");
    await t.test("failed transactions roll back both link and audit", async () => {
      const before = row(incidentId), count = audits().length;
      state.failBatch = true;
      try { assert.equal((await link(nextNote, ownerHeaders)).status, 503); }
      finally { state.failBatch = false; }
      assert.deepEqual(row(incidentId), before); assert.equal(audits().length, count);
    });
    await t.test("concurrent changes to evidence, status or test isolation reject the stale append", async () => {
      for (const [query, restore] of [
        ["UPDATE job_incidents SET evidence_references='[\"concurrent-reference\"]' WHERE id=?", "UPDATE job_incidents SET evidence_references=? WHERE id=?"],
        ["UPDATE job_incidents SET status='resolved' WHERE id=?", "UPDATE job_incidents SET status=? WHERE id=?"],
        ["UPDATE customer_requests SET is_test_job='no' WHERE id='synthetic-job'", "UPDATE customer_requests SET is_test_job='yes' WHERE id='synthetic-job'"],
      ]) {
        const before = row(incidentId), count = audits().length;
        state.beforeBatch = () => database.prepare(query).run(...(query.includes("?") ? [incidentId] : []));
        assert.equal((await link(nextNote, ownerHeaders)).status, 409); assert.equal(audits().length, count);
        if (restore.includes("evidence_references")) {
          assert.equal(row(incidentId).evidence_references, '["concurrent-reference"]');
          database.prepare(restore).run(before.evidence_references, incidentId);
        } else if (restore.includes("status=?")) database.prepare(restore).run(before.status, incidentId);
        else database.exec(restore);
      }
    });
    await t.test("a lost acknowledgement can be retried without a second link or audit", async () => {
      state.loseAcknowledgement = true;
      try { assert.equal((await link(nextNote, ownerHeaders)).status, 503); }
      finally { state.loseAcknowledgement = false; }
      const count = audits().length;
      assert.equal((await link(nextNote, ownerHeaders)).body.alreadyLinked, true);
      assert.equal(audits().length, count);
      assert.equal(audits().at(-1).actor_id, owner);
    });
    await t.test("closed incidents, corrupt links and real jobs fail closed", async () => {
      const before = row(incidentId);
      database.prepare("UPDATE job_incidents SET status='resolved' WHERE id=?").run(incidentId);
      assert.equal((await link(photoId)).status, 409);
      database.prepare("UPDATE job_incidents SET status='open',evidence_references='not-json' WHERE id=?").run(incidentId);
      assert.equal((await link(photoId)).status, 409);
      assert.equal((await (await get()).json()).incidents[0].evidenceIds, null);
      database.prepare("UPDATE job_incidents SET evidence_references=? WHERE id=?").run(before.evidence_references, incidentId);
      database.exec("UPDATE customer_requests SET is_test_job='no' WHERE id='synthetic-job'");
      try {
        assert.equal((await link(photoId, ownerHeaders, { testOnly: true })).status, 503);
        assert.equal((await get(ownerHeaders, `&evidenceId=${photoId}`)).status, 503);
      } finally { database.exec("UPDATE customer_requests SET is_test_job='yes' WHERE id='synthetic-job'"); }
    });
    const final = row(incidentId);
    assert.equal(final.hold_payments, initial.hold_payments);
    assert.equal(final.resolution, initial.resolution);
    assert.equal(final.work_stopped_at, initial.work_stopped_at);
    assert.equal(final.insurer_notified_at, initial.insurer_notified_at);
    assert.equal(final.status, initial.status);
    // Labeled local authorization fixtures satisfy the existing database gate;
    // do not remove triggers just to seed a running timer for this regression.
    for (const requestId of ["synthetic-job", "other-job"]) {
      const authorization = { id: `${requestId}-authorization`, request_id: requestId, quote_id: `${requestId}-quote`,
        provider_id: "synthetic-provider", provider_email: "provider@example.invalid", status: "signed",
        customer_email: requestId === "synthetic-job" ? "customer@example.invalid" : "other@example.invalid",
        scope_version: database.prepare("SELECT scope_version FROM provider_quotes WHERE id=?").get(`${requestId}-quote`).scope_version,
        customer_signature_at: now, document_hash: "synthetic-local-authorization-only" };
      for (const column of database.prepare("PRAGMA table_info(repair_authorization_records)").all()) {
        if (column.notnull && column.dflt_value === null && !(column.name in authorization)) {
          authorization[column.name] = column.type.toLowerCase() === "integer" ? 0 : "SYNTHETIC LOCAL FIXTURE";
        }
      }
      seed("repair_authorization_records", authorization);
    }
    seed("provider_job_records", { id: "synthetic-work", request_id: "synthetic-job", provider_email: "provider@example.invalid",
      work_status: "in progress", timer_started_at: now, tracked_seconds: 120, billable_minutes: 2 });
    seed("provider_job_records", { id: "other-work", request_id: "other-job", provider_email: "provider@example.invalid",
      work_status: "in progress", timer_started_at: now });
    const work = () => database.prepare("SELECT * FROM provider_job_records WHERE id='synthetic-work'").get();
    const otherWork = database.prepare("SELECT * FROM provider_job_records WHERE id='other-work'").get();
    await t.test("emergency contact and safety-stop reports stop work regardless of a low severity selection", async () => {
      for (const headers of [customer, provider]) {
        for (const values of [
          { incidentType: "other", severity: "low", emergencyServicesContacted: true },
          { incidentType: "other", severity: "moderate", emergencyServicesContacted: "yes" },
          { incidentType: "safety_stop", severity: "low" },
        ]) {
          database.prepare("UPDATE provider_job_records SET work_status='in progress',timer_started_at=? WHERE id='synthetic-work'").run(now);
          const reported = await post({ action: "report-incident", summary: "SYNTHETIC: safety signal regression only", ...values }, headers);
          assert.equal(reported.status, 201);
          assert.equal(reported.body.workStopped, true, JSON.stringify(values));
          assert.equal(reported.body.paymentHold, true);
          const incident = row(reported.body.incidentId);
          assert.notEqual(incident.work_stopped_at, "");
          assert.equal(incident.hold_payments, "yes");
          assert.equal(incident.emergency_services_contacted, values.emergencyServicesContacted ? "yes" : "no");
          assert.equal(work().work_status, "stop work");
          assert.equal(work().timer_started_at, "");
          assert.equal(work().tracked_seconds, 120);
          assert.equal(work().billable_minutes, 2);
          const audit = database.prepare("SELECT * FROM job_lifecycle_events WHERE request_id='synthetic-job' ORDER BY rowid DESC LIMIT 1").get();
          assert.equal(audit.event_type, "incident_stop_work");
          assert.equal(JSON.parse(audit.details).incidentId, reported.body.incidentId);
          assert.deepEqual(database.prepare("SELECT * FROM provider_job_records WHERE id='other-work'").get(), otherWork);
        }
      }
    });
    await t.test("a routine claim holds payment without claiming work has stopped", async () => {
      for (const emergencyServicesContacted of [false, "no", undefined]) {
        database.prepare("UPDATE provider_job_records SET work_status='in progress',timer_started_at=? WHERE id='synthetic-work'").run(now);
        const before = work();
        const reported = await post({ action: "report-incident", incidentType: "service_quality_claim", severity: "low",
          emergencyServicesContacted, summary: "SYNTHETIC: routine claim with no safety signal" });
        assert.equal(reported.status, 201);
        assert.equal(reported.body.workStopped, false);
        assert.equal(reported.body.paymentHold, true);
        assert.equal(row(reported.body.incidentId).work_stopped_at, "");
        assert.deepEqual(work(), before);
      }
    });
    assert.equal(database.prepare("SELECT count(*) AS n FROM stripe_payments").get().n, 0);
    assert.equal(database.prepare("SELECT count(*) AS n FROM account_notifications").get().n, 0);
  } finally {
    globalThis.fetch = originalFetch; console.error = originalError;
    database.close(); delete globalThis.__incidentEvidence;
    assert.equal(dirname(resolve(scratch)), tempRoot);
    assert.ok(scratch.startsWith(join(tempRoot, "tuveloz-incident-evidence-")));
    rmSync(scratch, { recursive: true, force: true });
  }
});
