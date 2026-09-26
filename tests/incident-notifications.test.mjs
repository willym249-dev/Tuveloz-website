import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { createRequire } from "node:module";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { build } from "esbuild";
import { drizzle } from "drizzle-orm/sqlite-proxy";

// Real migrated SQL, alert construction, event policy and delivery retries.
// Only Cloudflare bindings and email transport are local fixtures. No network.
test("incident owner alerts persist, recover and quarantine test reports", async t => {
  const repo = resolve(import.meta.dirname, "..");
  const tempRoot = resolve(tmpdir());
  const scratch = mkdtempSync(join(tempRoot, "tuveloz-incident-mail-"));
  const database = new DatabaseSync(":memory:");
  const originalFetch = globalThis.fetch;
  const originalError = console.error;
  const outbound = [], errors = [];
  const state = { failInsert: false, failTransport: false, missingReceipt: false, db: null, env: {
    OWNER_EMAIL: "owner@example.invalid", SITE_URL: "https://tuveloz.invalid",
    RESEND_API_KEY: "synthetic-no-credential", RESEND_FROM_EMAIL: "Tuveloz <sender@example.invalid>",
  } };
  globalThis.__incidentNotifications = state;
  const seed = (table, values) => {
    const columns = Object.keys(values);
    database.prepare(`INSERT INTO ${table} (${columns.join(",")}) VALUES (${columns.map(() => "?").join(",")})`)
      .run(...Object.values(values));
  };
  const alert = id => database.prepare("SELECT * FROM email_notification_outbox WHERE event_key IN (?,?)")
    .get(`owner:incident:job-report:${id}`, `test:incident:job-report:${id}`);
  const incident = (id, jobFlag = "yes", providerFlag = "yes", changes = {}) => {
    seed("provider_applications", { id: `provider-${id}`, name: "SYNTHETIC", email: `provider-${id}@example.invalid`,
      service: "provisional_12v_jump_start", service_area: "Montgomery County, Maryland", experience: "Synthetic only",
      insurance_status: "unverified", is_test_provider: providerFlag });
    seed("customer_requests", { id: `job-${id}`, name: "SYNTHETIC", email: `customer-${id}@example.invalid`, zip: "20910",
      vehicle: "Synthetic vehicle", service: "provisional_12v_jump_start", details: "Local test only", is_test_job: jobFlag,
      parts_source: "No parts needed — labor only", parts_preference: "No preference", labor_only_parts_acknowledged_at: "2026-09-26T00:00:00Z" });
    seed("provider_quotes", { id: `quote-${id}`, request_id: `job-${id}`, provider_name: "SYNTHETIC",
      provider_email: `provider-${id}@example.invalid`, price_cents: "100", labor_price_cents: "100", parts_price_cents: "0",
      labor_only_parts_confirmed_at: "2026-09-26T00:00:00Z", part_type: "No parts needed", availability: "Synthetic only", message: "Local test" });
    seed("job_incidents", { id, request_id: `job-${id}`, quote_id: `quote-${id}`, provider_id: `provider-${id}`,
      reporter_role: "customer", reporter_email: `customer-${id}@example.invalid`, incident_type: "harassment", severity: "serious",
      summary: "PRIVATE REPORT TEXT MUST NOT BE EMAILED", location_summary: "PRIVATE ADDRESS MUST NOT BE EMAILED",
      evidence_references: '["private-photo"]', occurred_at: "2026-09-26T00:00:00Z", ...changes });
  };
  try {
    console.error = (...args) => errors.push(args);
    globalThis.fetch = async (url, options) => {
      assert.equal(String(url), "https://api.resend.com/emails", "no other external request is allowed");
      outbound.push({ key: options.headers["Idempotency-Key"], body: JSON.parse(options.body) });
      if (state.failTransport) return new Response("Synthetic delivery outage", { status: 503 });
      return Response.json(state.missingReceipt ? {} : { id: `synthetic-receipt-${outbound.length}` });
    };
    for (const entry of JSON.parse(readFileSync(join(repo, "drizzle/meta/_journal.json"), "utf8")).entries) {
      for (const statement of readFileSync(join(repo, "drizzle", entry.tag + ".sql"), "utf8").split("--> statement-breakpoint")) {
        if (statement.trim()) database.exec(statement);
      }
    }
    state.db = drizzle(async (query, params, method) => {
      if (state.failInsert && query.startsWith('insert into "email_notification_outbox"')) throw Error("Synthetic enqueue outage");
      if (method === "run") { database.prepare(query).run(...params); return { rows: [] }; }
      database.exec("PRAGMA short_column_names=OFF; PRAGMA full_column_names=ON;");
      try {
        const statement = database.prepare(query);
        return { rows: method === "get" ? Object.values(statement.get(...params) ?? {})
          : statement.all(...params).map(row => Object.values(row)) };
      } finally { database.exec("PRAGMA short_column_names=ON; PRAGMA full_column_names=OFF;"); }
    });
    const bundle = join(scratch, "alerts.cjs");
    await build({ absWorkingDir: repo, stdin: { contents: `
      export { queueIncidentOwnerAlert, recoverIncidentOwnerAlerts } from "./lib/incident-notifications";
      export { flushPendingEmailNotifications } from "./lib/email-notifications";
    `, resolveDir: repo, loader: "ts" }, bundle: true, platform: "node", format: "cjs", outfile: bundle, target: "node22", logLevel: "silent",
      plugins: [{ name: "local-bindings", setup(builder) {
        builder.onResolve({ filter: /^cloudflare:workers$/ }, () => ({ path: "env", namespace: "fixture" }));
        builder.onResolve({ filter: /(?:^|\/)db$/ }, args => args.path.startsWith(".") ? { path: "db", namespace: "fixture" } : null);
        builder.onLoad({ filter: /.*/, namespace: "fixture" }, args => ({ loader: "js", contents: args.path === "env"
          ? "export const env = globalThis.__incidentNotifications.env;" : "export function getDb() { return globalThis.__incidentNotifications.db; }" }));
      } }],
    });
    const api = createRequire(import.meta.url)(bundle);
    await t.test("test and mixed assignments never send and cannot be reclassified on retry", async () => {
      for (const [id, jobFlag, providerFlag] of [["test", "yes", "yes"], ["test-job", "yes", "no"], ["test-provider", "no", "yes"], ["unknown-flag", "unknown", "no"]]) {
        incident(id, jobFlag, providerFlag);
        assert.equal(await api.queueIncidentOwnerAlert(id), "test_only");
        const queued = alert(id);
        assert.match(queued.subject, /^TEST ONLY/);
        assert.equal(queued.recipient_email, state.env.OWNER_EMAIL);
        await api.flushPendingEmailNotifications(20);
        assert.equal(alert(id).attempts, 0); assert.equal(alert(id).sent_at, "");
        database.prepare("UPDATE customer_requests SET is_test_job='no' WHERE id=?").run(`job-${id}`);
        database.prepare("UPDATE provider_applications SET is_test_provider='no' WHERE id=?").run(`provider-${id}`);
        assert.equal(await api.queueIncidentOwnerAlert(id), "test_only");
        assert.deepEqual(alert(id), queued);
      }
      assert.equal(outbound.length, 0);
      assert.deepEqual(await api.recoverIncidentOwnerAlerts(), { queued: 0, failed: 0 });
    });
    await t.test("staging quarantines even incorrectly real-flagged fixtures", async () => {
      state.env.APP_ENVIRONMENT = "staging"; incident("staging", "no", "no");
      assert.equal(await api.queueIncidentOwnerAlert("staging"), "test_only");
      delete state.env.APP_ENVIRONMENT;
      await api.flushPendingEmailNotifications(20); assert.equal(outbound.length, 0);
    });
    await t.test("real-record alerts go only to the configured owner and omit private report details", async () => {
      incident("real-shaped", "no", "no");
      assert.deepEqual(await Promise.all([api.queueIncidentOwnerAlert("real-shaped"), api.queueIncidentOwnerAlert("real-shaped")]), ["queued", "queued"]);
      assert.equal(database.prepare("SELECT count(*) n FROM email_notification_outbox WHERE id='incident-owner-alert:real-shaped'").get().n, 1);
      const queued = alert("real-shaped");
      assert.equal(queued.status, "pending"); assert.equal(outbound.length, 0, "queueing is not sending");
      assert.doesNotMatch(queued.text_body, /PRIVATE|private-photo|harassment|customer-.*@|provider-.*@/);
      assert.match(queued.text_body, /A report has been saved/); assert.match(queued.text_body, /Se guardó un reporte/);
      assert.match(queued.text_body, /https:\/\/tuveloz.invalid\/admin\/compliance-operations/);
      state.missingReceipt = true;
      await api.flushPendingEmailNotifications(20);
      assert.equal(alert("real-shaped").status, "failed"); assert.equal(alert("real-shaped").sent_at, "");
      state.missingReceipt = false; state.failTransport = true;
      await api.flushPendingEmailNotifications(20);
      assert.equal(alert("real-shaped").attempts, 2);
      state.failTransport = false;
      await api.flushPendingEmailNotifications(20);
      assert.equal(alert("real-shaped").status, "sent"); assert.ok(alert("real-shaped").sent_at);
      assert.equal(outbound.length, 3); assert.equal(new Set(outbound.map(mail => mail.key)).size, 1);
      assert.ok(outbound.every(mail => mail.body.to.length === 1 && mail.body.to[0] === "owner@example.invalid"));
      await api.queueIncidentOwnerAlert("real-shaped"); await api.recoverIncidentOwnerAlerts(); await api.flushPendingEmailNotifications(20);
      assert.equal(outbound.length, 3, "a confirmed alert must not be resent");
    });
    await t.test("missing owner configuration and interrupted queueing recover without replacing the incident", async () => {
      incident("recovery"); const original = database.prepare("SELECT * FROM job_incidents WHERE id='recovery'").get();
      state.env.OWNER_EMAIL = "";
      await assert.rejects(api.queueIncidentOwnerAlert("recovery"), /not configured/);
      assert.equal(alert("recovery"), undefined);
      state.env.OWNER_EMAIL = "owner@example.invalid"; state.failInsert = true;
      assert.deepEqual(await api.recoverIncidentOwnerAlerts(), { queued: 0, failed: 1 });
      state.failInsert = false;
      assert.deepEqual(await api.recoverIncidentOwnerAlerts(), { queued: 1, failed: 0 });
      const saved = alert("recovery");
      assert.deepEqual(await api.recoverIncidentOwnerAlerts(), { queued: 0, failed: 0 });
      assert.deepEqual(alert("recovery"), saved);
      assert.deepEqual(database.prepare("SELECT * FROM job_incidents WHERE id='recovery'").get(), original);
      assert.equal(original.hold_payments, "yes");
      assert.ok(errors.some(args => args[0] === "Unable to queue incident owner alert"));
    });
    await t.test("recovery is bounded and excludes closed reports and broken assignment links", async () => {
      incident("closed", "no", "no", { status: "resolved" });
      incident("wrong-quote", "no", "no", { quote_id: "quote-closed" });
      incident("missing-provider", "no", "no", { provider_id: "missing" });
      for (const id of ["closed", "wrong-quote", "missing-provider", "missing"]) {
        assert.equal(await api.queueIncidentOwnerAlert(id), "unavailable"); assert.equal(alert(id), undefined);
      }
      for (const id of ["batch-1", "batch-2", "batch-3"]) incident(id);
      assert.deepEqual(await api.recoverIncidentOwnerAlerts(2), { queued: 2, failed: 0 });
      assert.deepEqual(await api.recoverIncidentOwnerAlerts(2), { queued: 1, failed: 0 });
      assert.deepEqual(await api.recoverIncidentOwnerAlerts(), { queued: 0, failed: 0 });
      await api.flushPendingEmailNotifications(20); assert.equal(outbound.length, 3);
      assert.equal(database.prepare("SELECT count(*) n FROM account_notifications").get().n, 0);
      assert.equal(database.prepare("SELECT count(*) n FROM stripe_payments").get().n, 0);
    });
  } finally {
    globalThis.fetch = originalFetch; console.error = originalError;
    database.close(); delete globalThis.__incidentNotifications;
    assert.equal(dirname(resolve(scratch)), tempRoot);
    assert.ok(scratch.startsWith(join(tempRoot, "tuveloz-incident-mail-")));
    rmSync(scratch, { recursive: true, force: true });
  }
});
