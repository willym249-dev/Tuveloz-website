import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { build } from "esbuild";
import { drizzle } from "drizzle-orm/d1";

// Production route, validation, storage adapter, SQL and audit. Only external
// account authentication, R2 transport and notification delivery are fixtures.
test("provider uploads recover from interrupted persistence without losing documents", async t => {
  const repo = resolve(import.meta.dirname, "..");
  const scratch = mkdtempSync(join(tmpdir(), "tuveloz-upload-recovery-"));
  const state = { objects: new Map(), fault: "", notifications: 0, loseCommitReply: false, failReads: false, failAfterCommit: false };
  let raw;
  const originalFetch = globalThis.fetch;
  globalThis.__uploadRecovery = state;
  const stubs = {
    cloudflare: 'export const env = globalThis.__uploadRecovery.env;',
    database: 'export function getDb() { return globalThis.__uploadRecovery.db; }',
    account: 'export async function getAccountSession() { return { role:"provider",email:"recovery@example.invalid" }; } export async function providerApplicationFor() { return {id:"recovery-provider",email:"recovery@example.invalid",service:"battery_replacement"}; }',
    notifications: 'export async function notifyProviderEvidenceReceived() { const s=globalThis.__uploadRecovery; s.notifications++; if(s.fault==="notification") throw Error("synthetic delivery outage"); }',
  };
  state.env = { SITE_URL: "https://tuveloz.invalid", OWNER_EMAIL: "owner@example.invalid", RESEND_API_KEY: "synthetic-no-credential", RESEND_FROM_EMAIL: "Tuveloz test <sender@example.invalid>", BUCKET: {
    async put(key, bytes, metadata) { state.objects.set(key, { bytes: Buffer.from(bytes), metadata }); },
    async delete(key) { state.objects.delete(key); },
    async get(key) {
      const object = state.objects.get(key);
      if (!object) return null;
      return { body: new Blob([object.bytes]).stream(), ...object.metadata };
    },
  } };
  const fail = query => {
    if (state.failReads && /^select /i.test(query)) throw Error("synthetic database unavailable");
    if (state.fault && query.startsWith(`insert into "${state.fault}"`)) throw Error("synthetic write interruption");
  };
  const client = {
    prepare(query) {
      let params = [];
      return {
        bind(...values) { params = values; return this; },
        async raw() { fail(query); return raw.prepare(query).all(...params).map(row => Object.values(row)); },
        async all() { fail(query); return { results: raw.prepare(query).all(...params), success: true }; },
        async run() { fail(query); const result = raw.prepare(query).run(...params); return { success: true, results: [], meta: { changes: Number(result.changes) } }; },
      };
    },
    async batch(statements) {
      raw.exec("BEGIN");
      let results;
      try {
        results = [];
        for (const statement of statements) results.push(await statement.run());
        raw.exec("COMMIT");
      } catch (error) { raw.exec("ROLLBACK"); throw error; }
      if (state.failAfterCommit) state.failReads = true;
      if (state.loseCommitReply) throw Error("synthetic lost commit acknowledgement");
      return results;
    },
  };
  function reset() {
    raw?.close();
    raw = new DatabaseSync(":memory:");
    for (const entry of JSON.parse(readFileSync(join(repo, "drizzle/meta/_journal.json"), "utf8")).entries) {
      for (const statement of readFileSync(join(repo, "drizzle", entry.tag + ".sql"), "utf8").split("--> statement-breakpoint")) {
        if (statement.trim()) raw.exec(statement);
      }
    }
    state.objects.clear(); state.fault = ""; state.notifications = 0; state.loseCommitReply = false; state.failReads = false; state.failAfterCommit = false;
    state.db = drizzle(client);
    raw.exec("INSERT INTO provider_applications(id,name,email,service,service_area,experience,insurance_status) VALUES('recovery-provider','SYNTHETIC RECOVERY APPLICANT','recovery@example.invalid','battery_replacement','Montgomery County, Maryland','Synthetic only','unverified');");
    raw.exec("INSERT INTO provider_pathway_profiles(id,provider_id,provider_person_id,relationship_path,provider_level,pathway_version,policy_version) VALUES('recovery-path','recovery-provider','recovery-person','independent_startup','standard_independent',1,'synthetic');");
  }
  const count = table => raw.prepare(`SELECT count(*) AS n FROM ${table}`).get().n;
  const tables = ["provider_evidence_submissions", "evidence_file_scans", "compliance_reminders", "provider_audit_events"];
  try {
    const bundle = join(scratch, "route.cjs");
    await build({ absWorkingDir: repo, stdin: { contents: 'export { POST } from "./app/api/provider-evidence/route"; export { flushPendingEmailNotifications } from "./lib/email-notifications";', resolveDir: repo, loader: "ts" },
      bundle: true, platform: "node", format: "cjs", outfile: bundle, target: "node22", logLevel: "silent",
      plugins: [{ name: "recovery-boundaries", setup(builder) {
        builder.onResolve({ filter: /^cloudflare:workers$/ }, () => ({ path: "cloudflare", namespace: "fixture" }));
        builder.onResolve({ filter: /(?:^|\/)db$/ }, args => args.path.startsWith(".") ? { path: "database", namespace: "fixture" } : null);
        const seams = { "account-auth": "account", "provider-compliance-notifications": "notifications" };
        builder.onResolve({ filter: /\/(account-auth|provider-compliance-notifications)$/ }, args => ({ path: seams[args.path.split("/").pop()], namespace: "fixture" }));
        builder.onLoad({ filter: /.*/, namespace: "fixture" }, args => ({ contents: stubs[args.path], loader: "js" }));
      } }],
    });
    const api = createRequire(import.meta.url)(bundle);
    const upload = async (changes = {}) => {
      const form = new FormData();
      for (const [key, value] of Object.entries({ serviceCode: "battery_replacement", requirementKey: "ocp_vehicle_service_registration", issuer: "SYNTHETIC ISSUER", effectiveAt: "2026-01-01", expiresAt: new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10) })) form.set(key, value);
      form.set("document", new File(["%PDF-1.4\nSYNTHETIC RECOVERY DOCUMENT; NOT A CREDENTIAL\n%%EOF"], "synthetic.pdf", { type: "application/pdf" }));
      for (const [key, value] of Object.entries(changes)) form.set(key, value);
      const response = await api.POST(new Request("https://tuveloz.invalid/api/provider-evidence", { method: "POST", headers: { origin: "https://tuveloz.invalid" }, body: form }));
      return { status: response.status, body: await response.json() };
    };
    for (const table of ["evidence_file_scans", "compliance_reminders", "provider_audit_events"]) {
      await t.test(`failure saving ${table} leaves a safe retry`, async () => {
        reset(); state.fault = table;
        assert.equal((await upload()).status, 500);
        for (const name of tables) assert.equal(count(name), 0, `${name} must roll back`);
        assert.equal(state.objects.size, 0);
        state.fault = "";
        assert.equal((await upload()).status, 201);
        assert.equal(count("provider_evidence_submissions"), 1);
        assert.equal(count("evidence_file_scans"), 1);
        assert.equal(count("provider_audit_events"), 1);
        assert.equal(state.objects.size, 1);
      });
    }
    await t.test("a notification failure cannot remove a saved file", async () => {
      reset(); state.fault = "notification";
      assert.equal((await upload()).status, 201);
      const evidence = raw.prepare("SELECT * FROM provider_evidence_submissions").get();
      assert.equal(evidence.status, "pending");
      assert.ok(state.objects.has(evidence.storage_key));
      assert.equal(count("provider_audit_events"), 1);
    });
    await t.test("a lost database acknowledgement is resolved from the saved receipt", async () => {
      reset(); state.loseCommitReply = true;
      const response = await upload();
      assert.equal(response.status, 201);
      const evidence = raw.prepare("SELECT * FROM provider_evidence_submissions").get();
      assert.equal(response.body.id, evidence.id);
      assert.ok(state.objects.has(evidence.storage_key));
      assert.equal(count("evidence_file_scans"), 1);
      assert.equal(count("provider_audit_events"), 1);
      state.loseCommitReply = false;
      const retry = await upload();
      assert.equal(retry.status, 200);
      assert.equal(retry.body.id, evidence.id);
      assert.equal(retry.body.duplicate, true);
      assert.equal(count("provider_evidence_submissions"), 1);
      assert.equal(state.objects.size, 1);
    });
    await t.test("uncertain persistence keeps the file private until the database recovers", async () => {
      reset(); state.loseCommitReply = true; state.failAfterCommit = true;
      assert.equal((await upload()).status, 500);
      assert.equal(state.objects.size, 1);
      assert.equal(count("provider_evidence_submissions"), 1);
      state.failReads = false; state.loseCommitReply = false; state.failAfterCommit = false;
      assert.equal((await upload()).status, 200);
      assert.equal(count("provider_evidence_submissions"), 1);
      assert.equal(state.objects.size, 1);
    });
    await t.test("a changed file or issuer is not silently treated as the saved upload", async () => {
      reset(); assert.equal((await upload()).status, 201);
      assert.equal((await upload({ issuer: "DIFFERENT SYNTHETIC ISSUER" })).status, 409);
      assert.equal((await upload({ document: new File(["%PDF-1.4\nDIFFERENT SYNTHETIC DOCUMENT"], "different.pdf", { type: "application/pdf" }) })).status, 409);
      assert.equal(count("provider_evidence_submissions"), 1);
      assert.equal(state.objects.size, 1);
    });
    await t.test("database guard rejects racing pending inserts but permits replacement after correction", async () => {
      reset(); assert.equal((await upload()).status, 201);
      const original = raw.prepare("SELECT * FROM provider_evidence_submissions").get();
      const keys = Object.keys(original);
      const insert = row => raw.prepare(`INSERT INTO provider_evidence_submissions (${keys.join(",")}) VALUES (${keys.map(() => "?").join(",")})`).run(...keys.map(key => row[key]));
      assert.throws(() => insert({ ...original, id: "synthetic-racing-upload" }), /provider_document_pending_conflict/);
      raw.prepare("UPDATE provider_evidence_submissions SET status='needs_correction' WHERE id=?").run(original.id);
      const replacement = await upload({ supersedesEvidenceId: original.id });
      assert.equal(replacement.status, 201);
      assert.equal((await upload({ supersedesEvidenceId: original.id })).status, 200);
      assert.equal(count("provider_evidence_submissions"), 2);
      assert.equal(state.objects.size, 2);
    });
    await t.test("database and document backup restore retains records, bytes, audit and safe retry", async () => {
      reset(); const initial = await upload(); assert.equal(initial.status, 201);
      const allTables = raw.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(row => row.name);
      const hash = value => createHash("sha256").update(value).digest("hex");
      const databaseDigest = () => hash(JSON.stringify(allTables.map(table => [table, raw.prepare(`SELECT * FROM "${table}"`).all().sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))])));
      const expectedDigest = databaseDigest();
      const databaseBackup = join(scratch, "synthetic-backup.sqlite");
      raw.prepare("VACUUM INTO ?").run(databaseBackup);
      const documentBackup = join(scratch, "synthetic-documents.json");
      const manifest = [...state.objects].map(([key, value]) => ({ key, bytes: value.bytes.toString("base64"), sha256: hash(value.bytes), metadata: value.metadata }));
      writeFileSync(documentBackup, JSON.stringify(manifest));
      const validateFiles = () => {
        for (const row of raw.prepare("SELECT storage_key,document_hash FROM provider_evidence_submissions WHERE storage_key<>''").all()) {
          const object = state.objects.get(row.storage_key);
          assert.ok(object, "Required document is missing from recovery");
          assert.equal(hash(object.bytes), row.document_hash, "Restored document bytes do not match the saved application");
          assert.equal(object.metadata.customMetadata.access, "private");
        }
      };
      // Simulate losing both working stores. Every path in this exercise is a
      // generated local scratch path; no cloud account or real record is read.
      raw.close(); raw = new DatabaseSync(":memory:"); state.objects.clear();
      assert.equal(raw.prepare("SELECT count(*) AS n FROM sqlite_master WHERE type='table'").get().n, 0);
      const backupReader = new DatabaseSync(databaseBackup, { readOnly: true });
      const restoredPath = join(scratch, "synthetic-restored.sqlite");
      try { backupReader.prepare("VACUUM INTO ?").run(restoredPath); } finally { backupReader.close(); }
      raw.close(); raw = new DatabaseSync(restoredPath);
      assert.throws(validateFiles, /document is missing/);
      for (const entry of JSON.parse(readFileSync(documentBackup, "utf8"))) {
        const bytes = Buffer.from(entry.bytes, "base64");
        assert.equal(hash(bytes), entry.sha256);
        state.objects.set(entry.key, { bytes, metadata: entry.metadata });
      }
      validateFiles();
      assert.equal(databaseDigest(), expectedDigest);
      assert.equal(raw.prepare("PRAGMA integrity_check").get().integrity_check, "ok");
      assert.deepEqual(raw.prepare("PRAGMA foreign_key_check").all(), []);
      const [key, saved] = [...state.objects][0];
      state.objects.set(key, { ...saved, bytes: Buffer.from("corrupted test document") });
      assert.throws(validateFiles, /bytes do not match/);
      state.objects.set(key, saved); validateFiles();
      const retry = await upload();
      assert.equal(retry.status, 200); assert.equal(retry.body.id, initial.body.id);
      assert.equal(count("provider_audit_events"), 1);
      assert.equal(count("service_activation_decisions"), 0);
      assert.equal(raw.prepare("SELECT status FROM provider_evidence_submissions").get().status, "pending");
    });
    const seedEmail = () => raw.exec("INSERT INTO email_notification_outbox(id,event_key,recipient_email,subject,text_body,status,attempts) VALUES('synthetic-mail','provider-evidence:received:synthetic','recovery@example.invalid','Synthetic receipt','Synthetic test only','pending',0)");
    await t.test("delivery exhaustion records one owner incident without an endless alert loop", async () => {
      reset(); seedEmail();
      globalThis.fetch = async url => { assert.equal(String(url), "https://api.resend.com/emails"); return new Response("synthetic outage", { status: 503 }); };
      for (let attempt = 0; attempt < 5; attempt++) await api.flushPendingEmailNotifications();
      const original = raw.prepare("SELECT status,attempts FROM email_notification_outbox WHERE id='synthetic-mail'").get();
      assert.equal(original.status, "failed"); assert.equal(original.attempts, 5);
      assert.equal(count("email_notification_outbox"), 2);
      const incident = raw.prepare("SELECT * FROM email_notification_outbox WHERE id<>'synthetic-mail'").get();
      assert.equal(incident.recipient_email, "owner@example.invalid");
      assert.ok(incident.event_key.startsWith("owner:incident:email-delivery-exhausted:"));
      for (let attempt = 0; attempt < 8; attempt++) await api.flushPendingEmailNotifications();
      assert.equal(count("email_notification_outbox"), 2);
      assert.equal(raw.prepare("SELECT attempts FROM email_notification_outbox WHERE id=?").get(incident.id).attempts, 5);
    });
    await t.test("an ambiguous email response retries the same delivery key", async () => {
      reset(); seedEmail();
      const deliveryKeys = new Set(); let calls = 0;
      globalThis.fetch = async (url, options) => {
        assert.equal(String(url), "https://api.resend.com/emails"); calls++;
        const key = options.headers["Idempotency-Key"]; assert.ok(key); deliveryKeys.add(key);
        if (calls === 1) throw Error("synthetic response lost after acceptance");
        return Response.json({ id: "synthetic-delivery-id" });
      };
      await api.flushPendingEmailNotifications();
      await api.flushPendingEmailNotifications();
      await api.flushPendingEmailNotifications();
      assert.equal(calls, 2); assert.equal(deliveryKeys.size, 1);
      assert.equal(count("email_notification_outbox"), 1);
      assert.equal(raw.prepare("SELECT status FROM email_notification_outbox").get().status, "sent");
    });
  } finally {
    globalThis.fetch = originalFetch;
    raw?.close(); delete globalThis.__uploadRecovery;
    rmSync(scratch, { recursive: true, force: true });
  }
});
