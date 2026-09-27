import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { build } from "esbuild";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import { accountEmailDelivery } from "../lib/account-email-delivery.ts";

const owner = "owner@example.invalid";
const approved = () => ({
  APP_ENVIRONMENT: "staging", SITE_URL: "https://staging.tuveloz.com",
  OWNER_EMAIL: owner, STAGING_AUTH_EMAIL_ENABLED: "true",
  STAGING_AUTH_EMAIL_EXPIRES_AT: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  STAGING_AUTH_RESEND_API_KEY: "synthetic-staging-only-key",
  STAGING_AUTH_FROM_EMAIL: "Tuveloz Test <test@example.invalid>",
});

test("staging authentication email requires a bounded owner-only configuration", () => {
  for (const overrides of [
    { STAGING_AUTH_EMAIL_ENABLED: undefined }, { STAGING_AUTH_EMAIL_ENABLED: "false" },
    { STAGING_AUTH_EMAIL_EXPIRES_AT: "" }, { STAGING_AUTH_EMAIL_EXPIRES_AT: "not-a-date" },
    { STAGING_AUTH_EMAIL_EXPIRES_AT: new Date(Date.now() - 1000).toISOString() },
    { STAGING_AUTH_EMAIL_EXPIRES_AT: new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString() },
    { OWNER_EMAIL: "" }, { OWNER_EMAIL: "invalid" },
    { SITE_URL: "https://tuveloz.com" }, { SITE_URL: "https://staging.tuveloz.com.attacker.invalid" },
    { SITE_URL: "http://staging.tuveloz.com" }, { APP_ENVIRONMENT: undefined },
    { STAGING_AUTH_RESEND_API_KEY: "" }, { STAGING_AUTH_FROM_EMAIL: "" },
    { RESEND_API_KEY: "synthetic-production-key" }, { RESEND_FROM_EMAIL: "live@example.invalid" },
  ]) assert.throws(() => accountEmailDelivery(owner, { ...approved(), ...overrides }), /outside its approved scope/);
  assert.throws(() => accountEmailDelivery("outsider@example.invalid", approved()), /outside its approved scope/);
  assert.throws(() => accountEmailDelivery("owner+alias@example.invalid", approved()), /outside its approved scope/);
  assert.throws(() => accountEmailDelivery("owner@example.invalid,other@example.invalid", approved()), /outside its approved scope/);
  const settings = accountEmailDelivery("OWNER@example.invalid", approved());
  assert.equal(settings.apiKey, "synthetic-staging-only-key");
  assert.match(settings.subjectPrefix, /private test/);
  assert.match(settings.notice, /does not sign you in to the live website/);
});

test("production and loopback retain their normal sender and ignore staging credentials", () => {
  for (const SITE_URL of ["https://tuveloz.com", "http://127.0.0.1:3000", undefined]) {
    const settings = accountEmailDelivery("customer@example.invalid", {
      ...approved(), APP_ENVIRONMENT: undefined, SITE_URL,
      RESEND_API_KEY: "normal-key", RESEND_FROM_EMAIL: "normal@example.invalid",
    });
    assert.deepEqual(settings, { apiKey: "normal-key", from: "normal@example.invalid", subjectPrefix: "", notice: "" });
  }
  assert.throws(() => accountEmailDelivery(owner, {
    ...approved(), APP_ENVIRONMENT: undefined, SITE_URL: "https://tuveloz-staging.example.workers.dev",
  }), /outside its approved scope/);
});

// Executes real challenge creation, HMAC verification, sessions and migrated SQL.
// Fetch is intercepted: no real mailbox or vendor receives any test request.
test("staging uses ordinary single-use authentication while all other email stays disabled", async t => {
  const repo = resolve(import.meta.dirname, "..");
  const scratch = mkdtempSync(join(tmpdir(), "tuveloz-staging-auth-"));
  const database = new DatabaseSync(":memory:");
  const originalFetch = globalThis.fetch;
  const deliveries = [];
  const state = { env: { ...approved(), AUTH_CODE_SECRET: "synthetic-staging-auth-secret-for-local-tests-only" }, db: null };
  globalThis.__stagingAuthEmail = state;
  try {
    for (const entry of JSON.parse(readFileSync(join(repo, "drizzle/meta/_journal.json"), "utf8")).entries) {
      for (const sql of readFileSync(join(repo, "drizzle", entry.tag + ".sql"), "utf8").split("--> statement-breakpoint")) {
        if (sql.trim()) database.exec(sql);
      }
    }
    state.db = drizzle(async (query, params, method) => {
      if (method === "run") { database.prepare(query).run(...params); return { rows: [] }; }
      database.exec("PRAGMA short_column_names=OFF; PRAGMA full_column_names=ON;");
      try {
        const statement = database.prepare(query);
        return { rows: method === "get" ? Object.values(statement.get(...params) ?? {})
          : statement.all(...params).map(row => Object.values(row)) };
      } finally { database.exec("PRAGMA short_column_names=ON; PRAGMA full_column_names=OFF;"); }
    });
    const outfile = join(scratch, "auth.cjs");
    await build({ absWorkingDir: repo, stdin: { contents: `
      export { requestAccountCode, verifyAccountCode, requestPasswordVerification } from "./lib/account-auth";
      export { queueOwnerSupportMessage } from "./lib/email-notifications";
    `, resolveDir: repo, loader: "ts" }, outfile, bundle: true, platform: "node", format: "cjs", target: "node22", logLevel: "silent",
      plugins: [{ name: "isolated-staging-auth", setup(builder) {
        builder.onResolve({ filter: /^cloudflare:workers$/ }, () => ({ path: "env", namespace: "fixture" }));
        builder.onResolve({ filter: /(?:^|\/)db$/ }, args => args.path.startsWith(".") ? { path: "db", namespace: "fixture" } : null);
        builder.onLoad({ filter: /.*/, namespace: "fixture" }, args => ({ loader: "js", contents: args.path === "env"
          ? "export const env = globalThis.__stagingAuthEmail.env;"
          : "export function getDb() { return globalThis.__stagingAuthEmail.db; }" }));
      } }],
    });
    const api = createRequire(import.meta.url)(outfile);
    for (const email of [owner, "outsider@example.invalid"]) database.prepare(
      `INSERT INTO customer_requests (id,name,email,zip,vehicle,service,details,is_test_job,
        parts_source,parts_preference,labor_only_parts_acknowledged_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    ).run(email, "SYNTHETIC", email, "20910", "Synthetic", "Synthetic", "Synthetic authentication test", "yes",
      "No parts needed — labor only", "No preference", new Date().toISOString());
    globalThis.fetch = async (url, options) => {
      assert.equal(String(url), "https://api.resend.com/emails");
      deliveries.push({ headers: options.headers, ...JSON.parse(options.body) });
      return Response.json({ id: "synthetic-delivery" });
    };
    await t.test("approved sign-in sends only to the owner and preserves code verification", async () => {
      await api.requestAccountCode(owner, "customer");
      assert.equal(deliveries.length, 1);
      assert.deepEqual(deliveries[0].to, [owner]);
      assert.equal(deliveries[0].headers.authorization, "Bearer synthetic-staging-only-key");
      assert.match(deliveries[0].subject, /^\[Tuveloz private test\]/);
      const code = deliveries[0].text.match(/^\d{6}$/m)?.[0]; assert.ok(code);
      assert.equal(database.prepare("SELECT count(*) AS n FROM auth_sessions").get().n, 0);
      assert.deepEqual(await api.verifyAccountCode(owner, "customer", "000000" === code ? "111111" : "000000"), { ok: false });
      const session = await api.verifyAccountCode(owner, "customer", code); assert.ok(session?.token);
      assert.equal(session.role, "customer");
      assert.deepEqual(await api.verifyAccountCode(owner, "customer", code), { ok: false }, "used code must not work twice");
      assert.equal(database.prepare("SELECT count(*) AS n FROM auth_sessions").get().n, 1);
    });
    await t.test("password challenges use the same owner restriction and test label", async () => {
      await api.requestPasswordVerification(owner, "customer", "create");
      assert.equal(deliveries.length, 2); assert.deepEqual(deliveries[1].to, [owner]);
      assert.match(deliveries[1].subject, /^\[Tuveloz private test\]/);
      await assert.rejects(api.requestPasswordVerification("outsider@example.invalid", "customer", "create"), /outside its approved scope/);
      assert.equal(database.prepare("SELECT count(*) AS n FROM password_verification_codes WHERE email=?").get("outsider@example.invalid").n, 0);
      assert.equal(deliveries.length, 2);
    });
    await t.test("outsiders, expired approval and missing settings do not send or leave a challenge", async () => {
      await assert.rejects(api.requestAccountCode("outsider@example.invalid", "customer"), /outside its approved scope/);
      assert.equal(database.prepare("SELECT count(*) AS n FROM login_codes WHERE email=?").get("outsider@example.invalid").n, 0);
      for (const overrides of [
        { STAGING_AUTH_EMAIL_ENABLED: "false" },
        { STAGING_AUTH_EMAIL_EXPIRES_AT: new Date(Date.now() - 1000).toISOString() },
        { STAGING_AUTH_RESEND_API_KEY: "" },
      ]) {
        database.exec("DELETE FROM public_write_rate_limits");
        Object.assign(state.env, approved(), overrides);
        await assert.rejects(api.requestAccountCode(owner, "customer"), /outside its approved scope/);
        assert.equal(database.prepare("SELECT count(*) AS n FROM login_codes WHERE used_at=''").get().n, 0);
        assert.equal(deliveries.length, 2);
      }
    });
    await t.test("the dedicated key cannot enable ordinary support delivery", async () => {
      Object.assign(state.env, approved());
      await assert.rejects(api.queueOwnerSupportMessage({ requestId: "synthetic", fingerprint: "synthetic", email: owner,
        message: "Synthetic only", audience: "customer", language: "en" }), /not configured/);
      assert.equal(deliveries.length, 2);
      assert.equal(database.prepare("SELECT count(*) AS n FROM email_notification_outbox").get().n, 0);
    });
  } finally {
    globalThis.fetch = originalFetch;
    delete globalThis.__stagingAuthEmail;
    database.close();
    const directory = resolve(scratch);
    assert.ok(directory.startsWith(resolve(tmpdir()) + "\\") || directory.startsWith(resolve(tmpdir()) + "/"));
    rmSync(directory, { recursive: true, force: true });
  }
});
