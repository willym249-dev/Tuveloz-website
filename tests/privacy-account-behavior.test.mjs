import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { createRequire } from "node:module";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { build } from "esbuild";
import { drizzle } from "drizzle-orm/sqlite-proxy";

test("privacy tools isolate real signed sessions and migrated account records", async t => {
  const repo = resolve(import.meta.dirname, "..");
  const tempRoot = resolve(tmpdir());
  const scratch = mkdtempSync(join(tempRoot, "tuveloz-privacy-account-"));
  const database = new DatabaseSync(":memory:");
  const originalFetch = globalThis.fetch, originalError = console.error;
  const origin = "https://tuveloz.invalid";
  const state = { db: null, failQuery: null, env: {
    SITE_URL: origin, AUTH_CODE_SECRET: "synthetic-local-privacy-session-secret",
    DB: { prepare(query) {
      let values = [];
      const statement = () => {
        if (state.failQuery?.test(query)) throw Error("SYNTHETIC PRIVATE DATABASE FAILURE");
        return database.prepare(query);
      };
      return {
        bind(...params) { values = params; return this; },
        async first() { return statement().get(...values) ?? null; },
        async all() { return { results: statement().all(...values) }; },
        async run() { return { meta: { changes: Number(statement().run(...values).changes) } }; },
      };
    } },
  } };
  globalThis.__privacyAccountBehavior = state;
  const seed = (table, values) => {
    const columns = Object.keys(values);
    database.prepare(`INSERT INTO ${table} (${columns.join(",")}) VALUES (${columns.map(() => "?").join(",")})`).run(...Object.values(values));
  };
  try {
    globalThis.fetch = async () => { throw Error("Outbound calls are forbidden in this isolated test"); };
    console.error = () => {};
    for (const entry of JSON.parse(readFileSync(join(repo, "drizzle/meta/_journal.json"), "utf8")).entries) {
      for (const statement of readFileSync(join(repo, "drizzle", entry.tag + ".sql"), "utf8").split("--> statement-breakpoint")) {
        if (statement.trim()) database.exec(statement);
      }
    }
    state.db = drizzle(async (query, params, method) => {
      if (state.failQuery?.test(query)) throw Error("SYNTHETIC PRIVATE DATABASE FAILURE");
      if (method === "run") { database.prepare(query).run(...params); return { rows: [] }; }
      database.exec("PRAGMA short_column_names=OFF; PRAGMA full_column_names=ON;");
      try {
        const statement = database.prepare(query);
        return { rows: method === "get" ? Object.values(statement.get(...params) ?? {})
          : statement.all(...params).map(row => Object.values(row)) };
      } finally { database.exec("PRAGMA short_column_names=ON; PRAGMA full_column_names=OFF;"); }
    });
    const bundle = join(scratch, "privacy.cjs");
    await build({ absWorkingDir: repo, stdin: { contents: `
      export { GET as download } from "./app/api/privacy-center/export/route";
      export { GET as history, POST as change } from "./app/api/privacy-center/route";
      export { createAccountSession, sessionCookie, getAccountSession } from "./lib/account-auth";
    `, resolveDir: repo, loader: "ts" }, bundle: true, platform: "node", format: "cjs",
      outfile: bundle, target: "node22", logLevel: "silent", plugins: [{ name: "local-bindings", setup(builder) {
        builder.onResolve({ filter: /^cloudflare:workers$/ }, () => ({ path: "env", namespace: "fixture" }));
        builder.onResolve({ filter: /(?:^|\/)db$/ }, args => args.path.startsWith(".") ? { path: "db", namespace: "fixture" } : null);
        builder.onLoad({ filter: /.*/, namespace: "fixture" }, args => ({ loader: "js", contents: args.path === "env"
          ? "export const env = globalThis.__privacyAccountBehavior.env;"
          : "export function getDb() { return globalThis.__privacyAccountBehavior.db; }" }));
      } }] });
    const api = createRequire(import.meta.url)(bundle);
    const headers = {};
    for (const account of ["alpha", "bravo", "customer-only"]) {
      const email = `${account}@example.invalid`;
      seed("account_credentials", { email, password_hash: `SECRET-HASH-${account}`, password_salt: `SECRET-SALT-${account}`,
        password_iterations: 100000, verified_at: new Date().toISOString() });
      seed("customer_requests", { id: `job-${account}`, name: `SYNTHETIC ${account}`, email, zip: "20910", vehicle: "Synthetic vehicle",
        service: "provisional_12v_jump_start", details: `PRIVATE JOB ${account}`, status: "new", is_test_job: "yes",
        parts_source: "No parts needed — labor only", parts_preference: "No preference", labor_only_parts_acknowledged_at: new Date().toISOString() });
      seed("customer_vehicles", { id: `vehicle-${account}`, customer_email: email, make: "Synthetic", model: account, vin: `PRIVATE-VIN-${account}` });
      seed("privacy_requests", { id: `privacy-customer-${account}`, email, role: "customer", request_type: "access", details: `PRIVATE CUSTOMER REQUEST ${account}` });
      if (account !== "customer-only") {
        seed("provider_applications", { id: `provider-${account}`, name: `SYNTHETIC ${account}`, email,
          service: "provisional_12v_jump_start", service_area: "Montgomery County, Maryland", experience: `PRIVATE APPLICATION ${account}`,
          insurance_status: "unverified", is_test_provider: "yes", status: "new", verification_status: "not reviewed" });
        seed("provider_evidence_submissions", { id: `evidence-${account}`, provider_id: `provider-${account}`,
          requirement_key: "synthetic-insurance", jurisdiction: "US-MD-MontgomeryCounty", evidence_type: "synthetic",
          issuer: `PRIVATE ISSUER ${account}`, storage_key: `SECRET-STORAGE-${account}`, document_hash: `SECRET-DOCUMENT-HASH-${account}` });
        seed("privacy_requests", { id: `privacy-provider-${account}`, email, role: "provider", request_type: "access", details: `PRIVATE PROVIDER REQUEST ${account}` });
      }
      const session = await api.createAccountSession(email, "customer"); assert.ok(session);
      headers[account] = { cookie: api.sessionCookie(new Request(origin), session.token).split(";")[0] };
    }
    const request = (account = "alpha", query = "", method = "GET", body, requestOrigin = origin) => new Request(origin + "/api/privacy-center" + query, {
      method, headers: { ...headers[account], origin: requestOrigin, ...(method === "POST" ? { "content-type": "application/json" } : {}) },
      ...(method === "POST" ? { body: JSON.stringify(body) } : {}),
    });
    await t.test("missing, forged and revoked sessions cannot download or read privacy history", async () => {
      for (const method of ["download", "history"]) {
        for (const cookie of ["", headers.alpha.cookie + "forged"]) {
          const response = await api[method](new Request(origin + "/api/privacy-center", { headers: { cookie } }));
          assert.equal(response.status, 401);
          assert.equal(response.headers.get("cache-control"), "private, no-store");
        }
        const session = await api.createAccountSession("alpha@example.invalid", "customer");
        const cookie = api.sessionCookie(new Request(origin), session.token).split(";")[0];
        database.prepare("DELETE FROM auth_sessions WHERE id=(SELECT id FROM auth_sessions ORDER BY rowid DESC LIMIT 1)").run();
        assert.equal((await api[method](new Request(origin, { headers: { cookie } }))).status, 401);
      }
    });
    await t.test("invalid scopes and provider access without an owned application are refused", async () => {
      for (const method of ["download", "history"]) {
        for (const query of ["?scope=admin", "?scope=provider&scope=customer"]) assert.equal((await api[method](request("alpha", query))).status, 400);
        assert.equal((await api[method](request("customer-only", "?scope=provider&providerId=provider-alpha"))).status, 401);
      }
    });
    await t.test("customer exports include only owned records and never expose credentials", async () => {
      for (const account of ["alpha", "bravo"]) {
        const response = await api.download(request(account, "?scope=customer&email=customer-only@example.invalid"));
        assert.equal(response.status, 200);
        assert.equal(response.headers.get("cache-control"), "private, no-store");
        assert.equal(response.headers.get("x-content-type-options"), "nosniff");
        assert.match(response.headers.get("content-disposition"), /attachment; filename="tuveloz-customer-data-/);
        const data = await response.json(), serialized = JSON.stringify(data);
        assert.equal(data.accountEmail, `${account}@example.invalid`);
        assert.deepEqual(data.jobRequests.map(row => row.id), [`job-${account}`]);
        assert.deepEqual(data.savedVehicles.map(row => row.vin), [`PRIVATE-VIN-${account}`]);
        assert.deepEqual(data.privacyRequests.map(row => row.id), [`privacy-customer-${account}`]);
        assert.doesNotMatch(serialized, /SECRET-|customer-only|PRIVATE PROVIDER/);
        assert.doesNotMatch(serialized, account === "alpha" ? /bravo/ : /alpha/);
      }
    });
    await t.test("blocked or declined providers keep their own export without gaining marketplace access", async () => {
      for (const status of ["pending", "blocked", "declined"]) {
        database.prepare("UPDATE provider_applications SET status=?,verification_status='blocked' WHERE id='provider-alpha'").run(status);
        const response = await api.download(request("alpha", "?scope=provider&providerId=provider-bravo"));
        assert.equal(response.status, 200);
        const data = await response.json(), serialized = JSON.stringify(data);
        assert.equal(data.accountRole, "provider");
        assert.deepEqual(data.providerApplication.map(row => row.id), ["provider-alpha"]);
        assert.deepEqual(data.providerEvidenceMetadata.map(row => row.id), ["evidence-alpha"]);
        assert.deepEqual(data.privacyRequests.map(row => row.id), ["privacy-provider-alpha"]);
        assert.doesNotMatch(serialized, /bravo|SECRET-|PRIVATE CUSTOMER REQUEST|PRIVATE-VIN/);
        assert.equal((await api.getAccountSession(request())).role, "customer");
        assert.equal(database.prepare("SELECT verification_status FROM provider_applications WHERE id='provider-alpha'").get().verification_status, "blocked");
      }
    });
    await t.test("privacy history and withdrawals are scoped to the signed-in account and role", async () => {
      for (const scope of ["customer", "provider"]) {
        const data = await (await api.history(request("alpha", `?scope=${scope}`))).json();
        assert.deepEqual(data.requests.map(row => row.id), [`privacy-${scope}-alpha`]);
        const foreign = await api.change(request("alpha", `?scope=${scope}`, "POST", { action: "withdraw-request", id: `privacy-${scope}-bravo` }));
        assert.equal(foreign.status, 400);
        assert.equal(database.prepare("SELECT status FROM privacy_requests WHERE id=?").get(`privacy-${scope}-bravo`).status, "submitted");
      }
      const response = await api.change(request("alpha", "?scope=customer", "POST", { action: "withdraw-request", id: "privacy-customer-alpha" }));
      assert.equal(response.status, 200);
      assert.equal(database.prepare("SELECT status FROM privacy_requests WHERE id='privacy-customer-alpha'").get().status, "withdrawn");
    });
    await t.test("forged origins cannot change privacy preferences", async () => {
      const response = await api.change(request("alpha", "?scope=customer", "POST", { action: "save-preferences", marketingEmail: true }, "https://unrelated.invalid"));
      assert.equal(response.status, 403);
      assert.equal(database.prepare("SELECT marketing_email FROM account_communication_preferences WHERE email='alpha@example.invalid' AND role='customer'").get().marketing_email, "no");
    });
    await t.test("export storage failures return a private retryable response without internal details", async () => {
      state.failQuery = /FROM customer_vehicles/i;
      try {
        const response = await api.download(request());
        assert.equal(response.status, 503);
        assert.equal(response.headers.get("cache-control"), "private, no-store");
        assert.doesNotMatch(await response.text(), /SYNTHETIC PRIVATE|SELECT|customer_vehicles/);
      } finally { state.failQuery = null; }
    });
    await t.test("an authentication storage outage returns a private retryable response", async () => {
      state.failQuery = /auth_sessions/i;
      try {
        for (const method of ["download", "history"]) {
          const response = await api[method](request());
          assert.equal(response.status, 503);
          assert.equal(response.headers.get("cache-control"), "private, no-store");
          assert.doesNotMatch(await response.text(), /SYNTHETIC PRIVATE|SELECT|auth_sessions/);
        }
      } finally { state.failQuery = null; }
    });
    await t.test("history storage failures return a clear retry response", async () => {
      state.failQuery = /FROM account_communication_preferences/i;
      try {
        const response = await api.history(request());
        assert.equal(response.status, 503);
        assert.equal(response.headers.get("cache-control"), "private, no-store");
        assert.doesNotMatch(await response.text(), /SYNTHETIC PRIVATE|SELECT|account_communication_preferences/);
      } finally { state.failQuery = null; }
    });
    await t.test("preference updates stay private during auth and storage failures", async () => {
      for (const failure of [/auth_sessions/i, /UPDATE account_communication_preferences/i]) {
        state.failQuery = failure;
        try {
          const response = await api.change(request("alpha", "?scope=customer", "POST", { action: "save-preferences", marketingEmail: true }));
          assert.equal(response.status, 503);
          assert.equal(response.headers.get("cache-control"), "private, no-store");
          assert.doesNotMatch(await response.text(), /SYNTHETIC PRIVATE|SELECT|UPDATE|auth_sessions/);
          assert.equal(database.prepare("SELECT marketing_email FROM account_communication_preferences WHERE email='alpha@example.invalid' AND role='customer'").get().marketing_email, "no");
        } finally { state.failQuery = null; }
      }
    });
    await t.test("a failed confirmation read preserves a saved choice and allows later verification", async () => {
      state.failQuery = /FROM account_communication_preferences/i;
      try {
        const response = await api.change(request("alpha", "?scope=customer", "POST", { action: "save-preferences", marketingEmail: true,
          email: "bravo@example.invalid", role: "provider" }));
        assert.equal(response.status, 503);
        assert.match((await response.json()).error, /confirm|check/i);
      } finally { state.failQuery = null; }
      const data = await (await api.history(request())).json();
      assert.equal(data.preferences.marketingEmail, true);
      assert.equal((await (await api.history(request("alpha", "?scope=provider"))).json()).preferences.marketingEmail, false);
      assert.equal((await (await api.history(request("bravo"))).json()).preferences.marketingEmail, false);
    });
    await t.test("malformed request bodies receive a useful private validation error", async () => {
      for (const body of ["{invalid", "null", "[]", '"text"']) {
        const response = await api.change(new Request(origin + "/api/privacy-center", { method: "POST", headers: { ...headers.alpha,
          origin, "content-type": "application/json" }, body }));
        assert.equal(response.status, 400);
        assert.equal(response.headers.get("cache-control"), "private, no-store");
        assert.equal((await response.json()).error, "Please send a valid privacy request.");
      }
    });
  } finally {
    globalThis.fetch = originalFetch; console.error = originalError;
    database.close(); delete globalThis.__privacyAccountBehavior;
    assert.equal(dirname(resolve(scratch)), tempRoot);
    assert.ok(scratch.startsWith(join(tempRoot, "tuveloz-privacy-account-")));
    rmSync(scratch, { recursive: true, force: true });
  }
});
