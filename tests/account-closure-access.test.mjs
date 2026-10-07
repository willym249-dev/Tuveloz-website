import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { build } from "esbuild";
import { drizzle } from "drizzle-orm/sqlite-proxy";

test("persistent whole-account closure blocks authentication without erasing shared records", async t => {
  const repo = resolve(import.meta.dirname, ".."), database = new DatabaseSync(":memory:");
  const scratch = mkdtempSync(join(tmpdir(), "tuveloz-closed-access-"));
  const originalFetch = globalThis.fetch;
  const deliveries = [];
  const origin = "https://tuveloz.invalid", alpha = "alpha@example.invalid", bravo = "bravo@example.invalid";
  const password = "Synthetic password 123!";
  const state = { db: null, beforeQuery: null, failClosureRead: false, env: {
    SITE_URL: origin, AUTH_CODE_SECRET: "synthetic-account-closure-secret",
    RESEND_API_KEY: "synthetic-no-network-key", RESEND_FROM_EMAIL: "test@example.invalid",
  } };
  globalThis.__closedAccess = state;
  const seed = (table, values) => {
    const names = Object.keys(values);
    database.prepare(`INSERT INTO ${table} (${names.join(",")}) VALUES (${names.map(() => "?").join(",")})`).run(...Object.values(values));
  };
  const close = email => seed("account_closures", { email, privacy_request_id: `closure-${email}`,
    case_reference: "SYNTHETIC-REVIEW-ONLY", review_after: "2026-11-07" });
  try {
    for (const entry of JSON.parse(readFileSync(join(repo, "drizzle/meta/_journal.json"), "utf8")).entries) {
      database.exec(readFileSync(join(repo, "drizzle", `${entry.tag}.sql`), "utf8"));
    }
    state.env.DB = { prepare(query) {
      let values = [];
      return { bind(...params) { values = params; return this; },
        async first() { return database.prepare(query).get(...values) ?? null; },
        async all() { return { results: database.prepare(query).all(...values) }; },
        async run() { return { meta: { changes: Number(database.prepare(query).run(...values).changes) } }; },
      };
    } };
    state.db = drizzle(async (query, params, method) => {
      if (state.failClosureRead && /account_closures/.test(query)) throw Error("Synthetic unavailable closure state");
      if (state.beforeQuery?.pattern.test(query)) {
        const callback = state.beforeQuery.run; state.beforeQuery = null; callback();
      }
      if (method === "run") { database.prepare(query).run(...params); return { rows: [] }; }
      database.exec("PRAGMA short_column_names=OFF; PRAGMA full_column_names=ON");
      try {
        const statement = database.prepare(query);
        return { rows: method === "get" ? Object.values(statement.get(...params) ?? {})
          : statement.all(...params).map(row => Object.values(row)) };
      } finally { database.exec("PRAGMA short_column_names=ON; PRAGMA full_column_names=OFF"); }
    });
    globalThis.fetch = async (_url, options) => {
      const body = JSON.parse(options.body);
      assert.ok(body.to.every(email => email.endsWith("@example.invalid")));
      deliveries.push(body);
      return Response.json({ id: "synthetic-email" });
    };
    const bundle = join(scratch, "access.cjs");
    await build({ absWorkingDir: repo, stdin: { contents: `
      export * from "./lib/account-auth";
      export * from "./lib/account-closure";
      export * from "./lib/phone-auth";
      export { beginPasskeyAuthentication, finishPasskeyAuthentication } from "./lib/passkeys";
      export { GET as health } from "./app/api/health/route";
    `, resolveDir: repo, loader: "ts" }, bundle: true, platform: "node", format: "cjs", outfile: bundle,
      target: "node22", logLevel: "silent", plugins: [{ name: "isolated-auth-database", setup(builder) {
        builder.onResolve({ filter: /^cloudflare:workers$/ }, () => ({ path: "env", namespace: "fixture" }));
        builder.onResolve({ filter: /(?:^|\/)db$/ }, args => args.path.startsWith(".") ? { path: "db", namespace: "fixture" } : null);
        builder.onLoad({ filter: /.*/, namespace: "fixture" }, args => ({ loader: "js", contents: args.path === "env"
          ? "export const env=globalThis.__closedAccess.env;" : "export const getDb=()=>globalThis.__closedAccess.db;" }));
      } }] });
    const api = createRequire(import.meta.url)(bundle);
    const codeFor = purpose => {
      const email = deliveries.findLast(item => item.to.includes(alpha) && item.subject.includes(purpose));
      return email.text.match(/\b\d{6}\b/)[0];
    };
    const createPassword = async email => {
      assert.equal((await api.requestPasswordVerification(email, "customer", "create")).delivered, true);
      const code = deliveries.at(-1).text.match(/\b\d{6}\b/)[0];
      assert.equal((await api.completePasswordVerification(email, "customer", "create", code, password, true)).ok, true);
    };
    await createPassword(alpha); await createPassword(bravo);
    seed("provider_applications", { id: "provider-alpha", name: "Synthetic provider", email: alpha,
      service: "provisional_12v_jump_start", service_area: "Montgomery County", experience: "Synthetic",
      insurance_status: "unverified", status: "new", is_test_provider: "yes" });
    seed("customer_requests", { id: "job-alpha", name: "Synthetic customer", email: alpha, zip: "20910",
      vehicle: "Synthetic vehicle", service: "provisional_12v_jump_start", details: "Synthetic shared record",
      parts_source: "No parts needed — labor only", parts_preference: "No preference",
      labor_only_parts_acknowledged_at: new Date().toISOString() });
    seed("account_phone_numbers", { email: alpha, phone_e164: "+12025550123", verified_at: new Date().toISOString() });
    seed("phone_login_codes", { id: "pending-phone", phone_e164: "+12025550123", email: "", purpose: "signin",
      code_hash: "synthetic", expires_at: new Date(Date.now() + 600000).toISOString() });
    seed("passkey_credentials", { id: "synthetic-passkey", email: alpha, role: "provider", webauthn_user_id: "synthetic-user",
      public_key: "synthetic-not-a-real-key", device_type: "singleDevice" });
    const alphaSession = await api.createAccountSession(alpha, "customer");
    const providerSession = await api.createAccountSession(alpha, "provider");
    const bravoSession = await api.createAccountSession(bravo, "customer");
    assert.ok(alphaSession); assert.ok(providerSession); assert.ok(bravoSession);
    const storedProviderSession = database.prepare("SELECT * FROM auth_sessions WHERE email=? AND role='provider'").get(alpha);
    const signed = session => new Request(origin, { headers: { cookie: api.sessionCookie(new Request(origin), session.token).split(";")[0] } });
    assert.equal((await api.requestAccountCode(alpha, "customer")).delivered, true);
    const loginCode = codeFor("sign-in code");
    assert.equal((await api.requestPasswordVerification(alpha, "customer", "reset")).delivered, true);
    const resetCode = codeFor("Reset");

    await t.test("failed session revocation rolls back the closure and all challenge changes", () => {
      const before = database.prepare("SELECT count(*) AS n FROM auth_sessions WHERE email=?").get(alpha).n;
      database.exec("CREATE TRIGGER synthetic_revoke_failure BEFORE DELETE ON auth_sessions BEGIN SELECT RAISE(ABORT,'synthetic revoke failure'); END");
      assert.throws(() => close(alpha), /synthetic revoke failure/);
      assert.equal(database.prepare("SELECT count(*) AS n FROM account_closures WHERE email=?").get(alpha).n, 0);
      assert.equal(database.prepare("SELECT count(*) AS n FROM auth_sessions WHERE email=?").get(alpha).n, before);
      assert.equal(database.prepare("SELECT count(*) AS n FROM login_codes WHERE email=? AND used_at=''").get(alpha).n, 1);
      database.exec("DROP TRIGGER synthetic_revoke_failure");
    });
    await t.test("closure revokes both role sessions and pending codes atomically, preserving the other account", async () => {
      close(alpha);
      assert.equal(database.prepare("SELECT count(*) AS n FROM auth_sessions WHERE email=?").get(alpha).n, 0);
      for (const table of ["login_codes", "password_verification_codes", "phone_login_codes"]) {
        assert.equal(database.prepare(`SELECT count(*) AS n FROM ${table} WHERE used_at=''`).get().n, 0);
      }
      assert.equal(await api.getAccountSession(signed(alphaSession)), null);
      assert.equal(await api.getPrivacyAccountSession(signed(providerSession)), null);
      assert.equal((await api.getAccountSession(signed(bravoSession))).email, bravo);
      assert.equal(database.prepare("SELECT count(*) AS n FROM provider_applications").get().n, 1);
      assert.equal(database.prepare("SELECT count(*) AS n FROM customer_requests").get().n, 1);
      assert.equal(database.prepare("SELECT count(*) AS n FROM account_credentials").get().n, 2);
    });
    await t.test("a stored closed provider session cannot use the privacy eligibility fallback", async () => {
      // Inject an obsolete session into an isolated database only. Restore the
      // insertion guard before exercising the real session reader.
      const original = database.prepare("SELECT sql FROM sqlite_master WHERE name='closed_account_session_insert'").get().sql;
      database.exec("DROP TRIGGER closed_account_session_insert");
      seed("auth_sessions", { ...storedProviderSession });
      database.exec(original);
      assert.equal(await api.getAccountSession(signed(providerSession)), null);
      assert.equal(await api.getPrivacyAccountSession(signed(providerSession)), null);
    });
    await t.test("retained records, passwords and recovery codes cannot recreate access or send new challenges", async () => {
      const sent = deliveries.length;
      assert.deepEqual(await api.eligibleAccountRoles(alpha), []);
      assert.equal(await api.createAccountSession(alpha, "customer"), null);
      assert.equal(await api.createAccountSession(alpha, "provider"), null);
      assert.equal((await api.verifyAccountCode(alpha, "customer", loginCode)).ok, false);
      assert.equal((await api.completePasswordVerification(alpha, "customer", "reset", resetCode, password, true)).ok, false);
      assert.equal((await api.signInWithPassword(alpha, "customer", password)).ok, false);
      assert.equal(await api.accountPasswordMatches(alpha, password), false);
      assert.equal(await api.accountHasPassword(alpha), false);
      for (const purpose of ["create", "reset"]) assert.equal((await api.requestPasswordVerification(alpha, "customer", purpose)).delivered, false);
      assert.equal((await api.requestAccountCode(alpha, "provider")).delivered, false);
      assert.equal((await api.requestPhoneSignInCode("+12025550123")).delivered, false);
      assert.equal((await api.verifyPhoneSignInCode("+12025550123", "123456")).ok, false);
      assert.equal((await api.requestPhoneChangeCode(alpha, "+12025550125")).delivered, false);
      assert.equal((await api.confirmPhoneChange(alpha, "customer", "+12025550125", "123456")).ok, false);
      assert.equal(deliveries.length, sent);
    });
    await t.test("a retained passkey is refused after a real signed challenge is issued", async () => {
      const challenge = await api.beginPasskeyAuthentication(new Request(origin));
      const request = new Request(origin, { headers: { cookie: challenge.cookie.split(";")[0] } });
      assert.equal((await api.finishPasskeyAuthentication(request, { id: "synthetic-passkey", response: {} })).ok, false);
    });
    await t.test("database constraints block stale writes and case variants at the access boundary", () => {
      const blocked = sql => assert.throws(() => database.exec(sql), /Account access is closed/);
      blocked(`INSERT INTO auth_sessions (id,token_hash,email,role,expires_at) VALUES ('late-session','late-token',' ALPHA@EXAMPLE.INVALID ','customer','2099-01-01')`);
      blocked(`UPDATE account_credentials SET password_hash='replacement' WHERE email='${alpha}'`);
      blocked(`INSERT INTO login_codes (id,email,role,code_hash,expires_at) VALUES ('late-code','${alpha}','customer','hash','2099-01-01')`);
      blocked(`INSERT INTO password_verification_codes (id,email,role,purpose,code_hash,expires_at) VALUES ('late-reset','${alpha}','customer','reset','hash','2099-01-01')`);
      blocked(`INSERT INTO phone_login_codes (id,phone_e164,purpose,email,code_hash,expires_at) VALUES ('late-phone','+12025550123','signin','','hash','2099-01-01')`);
      blocked(`UPDATE account_phone_numbers SET phone_e164='+12025550125' WHERE email='${alpha}'`);
      blocked(`UPDATE passkey_credentials SET public_key='replacement' WHERE email='${alpha}'`);
      assert.equal(database.prepare("SELECT password_hash FROM account_credentials WHERE email=?").get(alpha).password_hash === "replacement", false);
    });
    await t.test("closure committed after eligibility is read prevents the final session insert", async () => {
      const race = "race@example.invalid";
      await createPassword(race);
      state.beforeQuery = { pattern: /insert into "auth_sessions"/i, run: () => close(race) };
      assert.equal(await api.createAccountSession(race, "customer"), null);
      assert.equal(database.prepare("SELECT count(*) AS n FROM auth_sessions WHERE email=?").get(race).n, 0);
    });
    await t.test("a password-creation race cannot restore credentials or optional consent", async () => {
      const race = "create-race@example.invalid";
      assert.equal((await api.requestPasswordVerification(race, "customer", "create")).delivered, true);
      const code = deliveries.at(-1).text.match(/\b\d{6}\b/)[0];
      state.beforeQuery = { pattern: /insert into "account_credentials"/i, run: () => close(race) };
      assert.equal((await api.completePasswordVerification(race, "customer", "create", code, password, true, true)).ok, false);
      assert.equal(database.prepare("SELECT count(*) AS n FROM account_credentials WHERE email=?").get(race).n, 0);
      assert.equal(database.prepare("SELECT count(*) AS n FROM account_communication_preferences WHERE email=?").get(race).n, 0);
    });
    await t.test("unavailable closure state fails closed and leaves ordinary accounts intact", async () => {
      state.failClosureRead = true;
      await assert.rejects(api.createAccountSession(bravo, "customer"), error => /unavailable closure state/.test(error.cause?.message ?? ""));
      state.failClosureRead = false;
      assert.ok(await api.createAccountSession(bravo, "customer"));
      assert.equal(await api.accountIsClosed(" ALPHA@EXAMPLE.INVALID "), true);
    });
    await t.test("deployment health rejects missing or ineffective closure guards", async () => {
      assert.equal((await api.health()).status, 200);
      const name = "closed_account_session_insert";
      const original = database.prepare("SELECT sql FROM sqlite_master WHERE name=?").get(name).sql;
      database.exec(`DROP TRIGGER ${name}`);
      const missing = await api.health();
      assert.equal(missing.status, 503);
      assert.ok((await missing.json()).missingGuardedTriggers.includes(name));
      database.exec(`CREATE TRIGGER ${name} BEFORE INSERT ON auth_sessions BEGIN SELECT 1; END`);
      assert.equal((await api.health()).status, 503);
      database.exec(`DROP TRIGGER ${name}`); database.exec(original);
      assert.equal((await api.health()).status, 200);
    });
  } finally {
    globalThis.fetch = originalFetch; delete globalThis.__closedAccess;
    database.close(); rmSync(scratch, { recursive: true, force: true });
  }
});
