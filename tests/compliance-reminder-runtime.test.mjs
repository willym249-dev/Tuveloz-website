import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { createRequire } from "node:module";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { build } from "esbuild";
import { drizzle } from "drizzle-orm/sqlite-proxy";

// Actual reminder sweep, outbox, event policy, SQL and audit. Only the runtime
// bindings and email transport are fixtures; no network or real records.
test("provider expiration reminders reach the outbox transport with scope and retry protection", async t => {
  const repo = resolve(import.meta.dirname, "..");
  const tempRoot = resolve(tmpdir());
  const scratch = mkdtempSync(join(tempRoot, "tuveloz-expiration-mail-"));
  const database = new DatabaseSync(":memory:");
  const originalFetch = globalThis.fetch;
  const outbound = [];
  const state = { db: null, failTransport: false, env: {
    RESEND_API_KEY: "synthetic-no-credential", RESEND_FROM_EMAIL: "Tuveloz <sender@example.invalid>",
    SITE_URL: "https://tuveloz.invalid",
  } };
  globalThis.__expirationMail = state;
  const now = new Date();
  const dueAt = new Date(now.getTime() - 60_000).toISOString();
  const expiresAt = new Date(now.getTime() + 90 * 86_400_000).toISOString().slice(0, 10);
  const seed = (table, values) => {
    const columns = Object.keys(values);
    database.prepare(`INSERT INTO ${table} (${columns.join(",")}) VALUES (${columns.map(() => "?").join(",")})`)
      .run(...Object.values(values));
  };
  const reset = () => {
    for (const table of ["provider_audit_events", "email_notification_outbox", "compliance_reminders", "provider_evidence_submissions", "provider_applications"]) {
      database.exec(`DELETE FROM ${table}`);
    }
    outbound.length = 0; state.failTransport = false; delete state.env.APP_ENVIRONMENT;
  };
  const reminder = (id, type = "evidence_expiration_60_day") => {
    const providerId = `provider-${id}`, evidenceId = `evidence-${id}`, email = `${id}@example.invalid`;
    const eventKey = `provider-evidence-expiration:${evidenceId}:${type}`;
    seed("provider_applications", { id: providerId, name: "SYNTHETIC", email, service: "battery_replacement",
      service_area: "Montgomery County, Maryland", experience: "Local test", insurance_status: "unverified", is_test_provider: "no" });
    seed("provider_evidence_submissions", { id: evidenceId, provider_id: providerId, requirement_key: "general_liability_coi",
      service_code: "battery_replacement", jurisdiction: "US-MD-MontgomeryCounty", evidence_type: "document", status: "accepted", expires_at: expiresAt });
    seed("compliance_reminders", { id, provider_id: providerId, evidence_submission_id: evidenceId, service_code: "battery_replacement",
      reminder_type: type, due_at: dueAt, recipient_email: email, event_key: eventKey, metadata: JSON.stringify({ expiresAt }), updated_at: dueAt });
    return { id, providerId, evidenceId, email, eventKey, outboxKey: `marketplace:${eventKey}` };
  };
  const pending = (item, eventKey = item.outboxKey, recipient = item.email) => seed("email_notification_outbox", {
    id: `mail-${item.id}`, event_key: eventKey, recipient_email: recipient, subject: "Synthetic expiration reminder",
    text_body: "Local test only", status: "pending", attempts: 0,
  });
  const row = id => database.prepare("SELECT * FROM compliance_reminders WHERE id=?").get(id);
  const mail = key => database.prepare("SELECT * FROM email_notification_outbox WHERE event_key=?").get(key);
  try {
    globalThis.fetch = async (url, options) => {
      assert.equal(String(url), "https://api.resend.com/emails", "unexpected network destination");
      const body = JSON.parse(options.body);
      assert.ok(body.to.every(email => email.endsWith("@example.invalid")));
      outbound.push({ key: options.headers["Idempotency-Key"], body });
      return state.failTransport ? new Response("Synthetic outage", { status: 503 }) : Response.json({ id: `synthetic-${outbound.length}` });
    };
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
    const bundle = join(scratch, "reminders.cjs");
    await build({ absWorkingDir: repo, stdin: { contents: `
      export { processDueComplianceReminders } from "./lib/compliance-reminder-delivery";
      export { flushPendingEmailNotifications } from "./lib/email-notifications";
    `, resolveDir: repo, loader: "ts" }, bundle: true, platform: "node", format: "cjs", outfile: bundle, target: "node22", logLevel: "silent",
      plugins: [{ name: "isolated-bindings", setup(builder) {
        builder.onResolve({ filter: /^cloudflare:workers$/ }, () => ({ path: "env", namespace: "fixture" }));
        builder.onResolve({ filter: /(?:^|\/)db$/ }, args => args.path.startsWith(".") ? { path: "db", namespace: "fixture" } : null);
        builder.onLoad({ filter: /.*/, namespace: "fixture" }, args => ({ loader: "js", contents: args.path === "env"
          ? "export const env = globalThis.__expirationMail.env;" : "export function getDb() { return globalThis.__expirationMail.db; }" }));
      } }],
    });
    const api = createRequire(import.meta.url)(bundle);
    await t.test("all five lead times and the entered-window notice send once without changing eligibility", async () => {
      reset();
      const types = [60, 30, 14, 7, 1].map(day => `evidence_expiration_${day}_day`).concat("evidence_expiration_window_entered");
      const items = types.map((type, i) => reminder(`schedule-${i}`, type));
      const evidenceBefore = database.prepare("SELECT * FROM provider_evidence_submissions ORDER BY id").all();
      assert.deepEqual(await api.processDueComplianceReminders(now), { claimed: 6, sent: 6, retried: 0, failed: 0, cancelled: 0 });
      for (const item of items) {
        assert.equal(row(item.id).status, "sent"); assert.equal(mail(item.outboxKey).status, "sent");
        assert.equal(mail(item.outboxKey).attempts, 1);
      }
      assert.equal(outbound.length, 6);
      await api.processDueComplianceReminders(now); await api.flushPendingEmailNotifications(20);
      assert.equal(outbound.length, 6, "accepted reminders must not be sent again");
      assert.deepEqual(database.prepare("SELECT * FROM provider_evidence_submissions ORDER BY id").all(), evidenceBefore);
      assert.equal(database.prepare("SELECT count(*) n FROM stripe_payments").get().n, 0);
    });
    await t.test("a failed send recovers with its original idempotency key", async () => {
      reset(); const item = reminder("retry"); state.failTransport = true;
      assert.equal((await api.processDueComplianceReminders(now)).retried, 1);
      assert.equal(row(item.id).sent_at, ""); assert.equal(mail(item.outboxKey).status, "failed");
      assert.ok(mail(item.outboxKey).attempts > 0);
      state.failTransport = false;
      assert.equal((await api.processDueComplianceReminders(new Date(now.getTime() + 60_000))).sent, 1);
      assert.equal(new Set(outbound.map(item => item.key)).size, 1);
      assert.equal(outbound[0].key, item.outboxKey);
      const count = outbound.length; await api.flushPendingEmailNotifications(20);
      assert.equal(outbound.length, count);
    });
    await t.test("the scheduled outbox flush recovers an already queued reminder", async () => {
      reset(); const item = reminder("queued"); pending(item);
      await api.flushPendingEmailNotifications(20);
      assert.equal(mail(item.outboxKey).status, "sent"); assert.equal(outbound.length, 1);
      assert.equal((await api.processDueComplianceReminders(now)).sent, 1);
      assert.equal(outbound.length, 1, "sweep must reconcile the accepted outbox without resending");
    });
    await t.test("unaccepted evidence cancels its reminder without sending", async () => {
      reset(); const item = reminder("unaccepted");
      database.prepare("UPDATE provider_evidence_submissions SET status='needs_correction' WHERE id=?").run(item.evidenceId);
      assert.equal((await api.processDueComplianceReminders(now)).cancelled, 1);
      assert.equal(mail(item.outboxKey), undefined); assert.equal(outbound.length, 0);
    });
    await t.test("queued reminders recheck provider, recipient, evidence scope and current expiration", async () => {
      const changes = [
        ["test provider", "UPDATE provider_applications SET is_test_provider='yes'"],
        ["unknown provider flag", "UPDATE provider_applications SET is_test_provider='unknown'"],
        ["missing provider", "DELETE FROM provider_applications"],
        ["changed recipient", "UPDATE provider_applications SET email='different@example.invalid'"],
        ["wrong evidence owner", "UPDATE provider_evidence_submissions SET provider_id='another-provider'"],
        ["wrong service", "UPDATE provider_evidence_submissions SET service_code='vehicle_lockout'"],
        ["revoked evidence", "UPDATE provider_evidence_submissions SET status='rejected'"],
        ["new expiration", "UPDATE provider_evidence_submissions SET expires_at='2099-01-01'"],
        ["cancelled reminder", "UPDATE compliance_reminders SET status='cancelled'"],
        ["future reminder", "UPDATE compliance_reminders SET due_at='2099-01-01T00:00:00.000Z'"],
        ["missing reminder", "DELETE FROM compliance_reminders"],
      ];
      for (const [label, mutation] of changes) {
        reset(); const item = reminder("blocked"); pending(item); database.exec(mutation);
        await api.flushPendingEmailNotifications(20);
        assert.equal(outbound.length, 0, label); assert.equal(mail(item.outboxKey).attempts, 0, label);
        assert.equal(mail(item.outboxKey).sent_at, "", label);
      }
      reset(); const item = reminder("staging"); pending(item); state.env.APP_ENVIRONMENT = "staging";
      await api.flushPendingEmailNotifications(20); assert.equal(outbound.length, 0);
    });
    await t.test("test-prefixed, unknown and transaction messages remain quarantined", async () => {
      for (const key of ["marketplace:test:provider-evidence-expiration:evidence:x", "marketplace:provider-evidence-expiration-other:evidence:x", "marketplace:payment:synthetic:paid"]) {
        reset(); const item = reminder("quarantine"); pending(item, key);
        await api.flushPendingEmailNotifications(20);
        assert.equal(outbound.length, 0); assert.equal(mail(key).attempts, 0); assert.equal(mail(key).status, "pending");
      }
    });
  } finally {
    globalThis.fetch = originalFetch; delete globalThis.__expirationMail; database.close();
    assert.equal(dirname(resolve(scratch)), tempRoot);
    assert.ok(scratch.startsWith(join(tempRoot, "tuveloz-expiration-mail-")));
    rmSync(scratch, { recursive: true, force: true });
  }
});
