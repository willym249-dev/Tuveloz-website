import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { build } from "esbuild";

test("closure preview reads migrated synthetic records without enabling deletion", async t => {
  const repo = resolve(import.meta.dirname, "..");
  const scratch = mkdtempSync(join(tmpdir(), "tuveloz-closure-preview-"));
  const database = new DatabaseSync(":memory:");
  const originalFetch = globalThis.fetch;
  const state = { owner: true, fail: false, beforeRead: null, queries: 0, env: {} };
  state.env.DB = { prepare(sql) {
    state.queries++;
    assert.match(sql.trim(), /^WITH subject AS/);
    let values;
    return { bind(...params) { values = params; return this; }, async all() {
      if (state.fail) throw Error("SECRET DATABASE FAILURE");
      if (state.beforeRead) { const fn = state.beforeRead; state.beforeRead = null; fn(); }
      return { results: database.prepare(sql).all(...values) };
    } };
  } };
  globalThis.__closurePreview = state;
  const seed = (table, values) => {
    // Fill required synthetic fields only; never reads a local or live account.
    const columns = database.prepare(`PRAGMA table_info(${table})`).all();
    for (const column of columns) {
      if ((column.notnull || column.pk) && column.dflt_value === null && !(column.name in values)) {
        values[column.name] = /INT/.test(column.type) ? 1 : `SECRET-${table}-${column.name}-${values.id || "test"}`;
      }
    }
    const names = Object.keys(values);
    database.prepare(`INSERT INTO ${table} (${names.join(",")}) VALUES (${names.map(() => "?").join(",")})`).run(...Object.values(values));
  };
  try {
    globalThis.fetch = async () => { throw Error("Network forbidden"); };
    for (const entry of JSON.parse(readFileSync(join(repo, "drizzle/meta/_journal.json"), "utf8")).entries) {
      database.exec(readFileSync(join(repo, "drizzle", `${entry.tag}.sql`), "utf8"));
    }
    const bundle = join(scratch, "preview.cjs");
    await build({ absWorkingDir: repo, stdin: { contents: `
      export { GET } from "./app/api/admin/privacy-requests/closure-preview/route";
      export * from "./lib/privacy-closure-preview";
    `, resolveDir: repo, loader: "ts" }, bundle: true, platform: "node", format: "cjs", outfile: bundle,
      target: "node22", logLevel: "silent", plugins: [{ name: "isolated-closure-preview", setup(builder) {
        builder.onResolve({ filter: /^cloudflare:workers$|\/owner-auth$/ }, args => ({ path: args.path, namespace: "fixture" }));
        builder.onLoad({ filter: /.*/, namespace: "fixture" }, args => ({ loader: "js", contents: args.path === "cloudflare:workers"
          ? "export const env=globalThis.__closurePreview.env;"
          : "export const isVerifiedOwnerRequest=async()=>globalThis.__closurePreview.owner;" }));
      } }] });
    const api = createRequire(import.meta.url)(bundle);
    const alpha = "alpha@example.invalid", bravo = "bravo@example.invalid";
    for (const who of ["alpha", "bravo"]) {
      const email = `${who}@example.invalid`;
      seed("account_credentials", { email });
      seed("auth_sessions", { id: `session-${who}`, email, role: "customer" });
      seed("provider_applications", { id: `provider-${who}`, email });
      seed("provider_evidence_submissions", { id: `evidence-${who}`, provider_id: `provider-${who}` });
      seed("customer_requests", { id: `job-${who}`, email, parts_source: "No parts needed — labor only",
        parts_preference: "No preference", labor_only_parts_acknowledged_at: new Date().toISOString() });
      seed("privacy_requests", { id: `closure-${who}`, email: email.toUpperCase(), role: "customer", request_type: "account-closure" });
    }
    seed("auth_sessions", { id: "provider-session-alpha", email: alpha, role: "provider" });
    seed("account_phone_numbers", { email: alpha, phone_e164: "+12025550123" });
    seed("phone_login_codes", { id: "phone-code-alpha", phone_e164: "+12025550123", email: "", purpose: "signin" });
    seed("phone_login_codes", { id: "phone-code-bravo", phone_e164: "+12025550124", email: "", purpose: "signin" });
    seed("provider_invoices", { id: "invoice-alpha", provider_id: "provider-alpha", request_id: "job-alpha" });
    seed("provider_invoice_items", { id: "item-alpha", invoice_id: "invoice-alpha", line_type: "labor" });
    seed("provider_invoices", { id: "invoice-bravo", provider_id: "provider-bravo", request_id: "job-bravo" });
    seed("provider_invoice_items", { id: "item-bravo", invoice_id: "invoice-bravo", line_type: "labor" });
    seed("repair_authorization_records", { id: "authorization-alpha", request_id: "job-alpha", customer_email: alpha, provider_email: "independent@example.invalid" });
    seed("repair_authorization_items", { id: "authorization-item-alpha", authorization_id: "authorization-alpha", line_type: "labor" });
    seed("job_messages", { id: "message-alpha", request_id: "job-alpha", sender_email: alpha, recipient_email: bravo });
    seed("job_messages", { id: "unrelated-message", request_id: "job-bravo", sender_email: bravo, recipient_email: "other@example.invalid" });
    seed("data_rights_requests", { id: "hold-alpha", requester_email: alpha, requester_role: "customer", request_type: "deletion", legal_hold: "yes" });
    seed("data_rights_requests", { id: "hold-bravo", requester_email: bravo, requester_role: "customer", request_type: "deletion", legal_hold: "yes" });
    seed("job_incidents", { id: "incident-alpha", request_id: "job-alpha", reporter_email: alpha, status: "open" });
    seed("job_incidents", { id: "incident-bravo", request_id: "job-bravo", reporter_email: bravo, status: "open" });
    const request = (query = "id=closure-alpha", origin = "https://tuveloz.invalid") => new Request(`https://tuveloz.invalid/api/admin/privacy-requests/closure-preview?${query}`, { headers: { origin } });
    const recordCounts = preview => Object.fromEntries(preview.groups.flatMap(group => group.sources.map(source => [source.table, source.recordCount])));
    database.exec("PRAGMA query_only=ON");

    await t.test("every migrated table is explicitly counted or flagged for manual review", () => {
      const expected = database.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all().map(row => row.name).sort();
      const classified = [...api.PRIVACY_PREVIEW_TABLES, ...api.PRIVACY_MANUAL_SOURCES.map(source => source.table)];
      assert.equal(new Set(classified).size, classified.length, "no duplicate table categories");
      assert.deepEqual(classified.sort(), expected, "new tables require explicit privacy review");
    });
    await t.test("both roles, phone codes and child records are counted without exposing private contents", async () => {
      const before = database.prepare("SELECT total_changes() AS changes").get().changes;
      const response = await api.GET(request("id=closure-alpha&email=bravo@example.invalid"));
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("cache-control"), "private, no-store");
      const text = await response.text();
      assert.doesNotMatch(text, /SECRET|alpha@example|bravo@example|12025550123|token_hash|password_hash/);
      const { preview } = JSON.parse(text), counts = recordCounts(preview);
      assert.equal(preview.scope, "whole-account"); assert.equal(preview.canExecute, false); assert.equal(preview.coverageComplete, false);
      assert.equal(counts.auth_sessions, 2); assert.equal(counts.account_credentials, 1); assert.equal(counts.provider_applications, 1);
      assert.equal(counts.phone_login_codes, 1); assert.equal(counts.provider_evidence_submissions, 1);
      assert.equal(counts.provider_invoice_items, 1); assert.equal(counts.repair_authorization_items, 1);
      assert.equal(counts.job_messages, 1); assert.equal(counts.customer_requests, 1);
      assert.deepEqual(preview.flags, { legalHolds: 1, incidents: 1 });
      assert.equal(database.prepare("SELECT total_changes() AS changes").get().changes, before);
    });
    await t.test("owner and origin checks run before any record lookup", async () => {
      const before = state.queries;
      state.owner = false;
      assert.equal((await api.GET(request())).status, 403);
      state.owner = true;
      assert.equal((await api.GET(request("id=closure-alpha", "https://other.invalid"))).status, 403);
      assert.equal(state.queries, before);
    });
    await t.test("a provider quote includes its shared job without pulling in the other person's account", async () => {
      database.exec("PRAGMA query_only=OFF");
      seed("provider_quotes", { id: "shared-quote", request_id: "job-bravo", provider_email: alpha,
        price_cents: "10000", labor_price_cents: "10000", parts_price_cents: "0",
        part_type: "No parts needed", labor_only_parts_confirmed_at: new Date().toISOString() });
      database.exec("PRAGMA query_only=ON");
      const { preview } = await (await api.GET(request())).json();
      const counts = recordCounts(preview);
      assert.equal(counts.customer_requests, 2, "the provider's quoted job needs shared-record review");
      assert.equal(counts.provider_invoice_items, 2, "shared job accounting cannot be silently ignored");
      assert.equal(counts.account_credentials, 1, "counterparty credentials are not the subject's account");
      assert.equal(counts.auth_sessions, 2);
      assert.equal(counts.provider_evidence_submissions, 1, "the other provider's documents remain outside the subject");
      assert.equal(counts.job_messages, 1, "unrelated correspondence is not pulled in with a quoted job");
      assert.deepEqual(preview.flags, { legalHolds: 1, incidents: 2 });
    });
    await t.test("missing IDs, malformed IDs and other request types never produce a plan", async () => {
      assert.equal((await api.GET(request(""))).status, 400);
      assert.equal((await api.GET(request("id=" + "a".repeat(101)))).status, 400);
      assert.equal((await api.GET(request("id=does-not-exist"))).status, 404);
      assert.equal((await api.GET(request("id=" + encodeURIComponent("' OR 1=1 --")))).status, 404);
      database.exec("PRAGMA query_only=OFF; UPDATE privacy_requests SET request_type='access' WHERE id='closure-alpha'; PRAGMA query_only=ON");
      assert.equal((await api.GET(request())).status, 409);
    });
    await t.test("withdrawn, completed and denied requests are rejected using the current snapshot", async () => {
      for (const status of ["withdrawn", "completed", "denied"]) {
        state.beforeRead = () => {
          database.exec("PRAGMA query_only=OFF");
          database.prepare("UPDATE privacy_requests SET request_type='account-closure', status=? WHERE id='closure-alpha'").run(status);
          database.exec("PRAGMA query_only=ON");
        };
        assert.equal((await api.GET(request())).status, 409);
      }
    });
    await t.test("database failure does not leak details or return a falsely empty report", async () => {
      state.fail = true;
      const response = await api.GET(request());
      assert.equal(response.status, 503); assert.equal(response.headers.get("cache-control"), "private, no-store");
      assert.doesNotMatch(await response.text(), /SECRET|preview|canExecute/);
      state.fail = false;
      assert.throws(() => api.closurePreview([{ item: "request", value: '{}' }]), /Incomplete/);
    });
  } finally {
    globalThis.fetch = originalFetch;
    delete globalThis.__closurePreview;
    database.close();
    rmSync(scratch, { recursive: true, force: true });
  }
});
