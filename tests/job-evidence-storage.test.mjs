import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { createRequire } from "node:module";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { build } from "esbuild";
import { drizzle } from "drizzle-orm/sqlite-proxy";

// Real account authentication, multipart validation, routes and migrated SQL.
// Cloudflare's D1/R2 bindings are in-memory fixtures; no external traffic.
test("private evidence uploads preserve saved files and enforce account access", async t => {
  const repo = resolve(import.meta.dirname, "..");
  const tempRoot = resolve(tmpdir());
  const scratch = mkdtempSync(join(tempRoot, "tuveloz-evidence-storage-"));
  const database = new DatabaseSync(":memory:");
  const objects = new Map();
  const originalFetch = globalThis.fetch;
  const originalError = console.error;
  const loggedErrors = [];
  const origin = "https://tuveloz.invalid";
  const state = { db: null, failure: "", env: {
    AUTH_CODE_SECRET: "synthetic-evidence-auth-secret-local-only", SITE_URL: origin,
    DB: { prepare(query) {
      let values = [];
      return {
        bind(...params) { values = params; return this; },
        async first() { return database.prepare(query).get(...values) ?? null; },
        async all() {
          if (state.failure === "refresh" && query.includes("FROM job_evidence_items")) {
            throw new Error("SYNTHETIC: evidence list temporarily unavailable");
          }
          return { results: database.prepare(query).all(...values) };
        },
        async run() {
          if (state.failure === "insert" && query.includes("INSERT INTO job_evidence_items")) {
            throw new Error("SYNTHETIC: evidence insert rejected");
          }
          const result = database.prepare(query).run(...values);
          return { success: true, meta: { changes: Number(result.changes) } };
        },
      };
    } },
    BUCKET: {
      async put(key, bytes, metadata) {
        if (state.failure === "upload") throw new Error("SYNTHETIC: storage unavailable");
        objects.set(key, { bytes: new Uint8Array(bytes).slice(), ...metadata });
      },
      async get(key) {
        const object = objects.get(key);
        return object ? { body: object.bytes, httpMetadata: object.httpMetadata } : null;
      },
      async delete(key) { objects.delete(key); },
    },
  } };
  globalThis.__jobEvidenceStorage = state;
  const seed = (table, values) => {
    const columns = Object.keys(values);
    database.prepare(`INSERT INTO ${table} (${columns.join(",")}) VALUES (${columns.map(() => "?").join(",")})`)
      .run(...Object.values(values));
  };
  const count = () => database.prepare("SELECT count(*) AS n FROM job_evidence_items").get().n;
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aS1cAAAAASUVORK5CYII=", "base64");
  try {
    globalThis.fetch = async () => { throw new Error("Unexpected external request in isolated evidence test"); };
    console.error = (...args) => loggedErrors.push(args.map(String).join(" "));
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
      export { POST, GET } from "./app/api/job-evidence/route";
      export { GET as getImage } from "./app/api/job-evidence/image/route";
      export { createAccountSession, sessionCookie } from "./lib/account-auth";
    `, resolveDir: repo, loader: "ts" }, bundle: true, platform: "node", format: "cjs",
      outfile: bundle, target: "node22", logLevel: "silent",
      plugins: [{ name: "local-cloudflare-bindings", setup(builder) {
        builder.onResolve({ filter: /^cloudflare:workers$/ }, () => ({ path: "env", namespace: "fixture" }));
        builder.onResolve({ filter: /(?:^|\/)db$/ }, args => args.path.startsWith(".") ? { path: "db", namespace: "fixture" } : null);
        builder.onLoad({ filter: /.*/, namespace: "fixture" }, args => ({ loader: "js", contents: args.path === "env"
          ? "export const env = globalThis.__jobEvidenceStorage.env;"
          : "export function getDb() { return globalThis.__jobEvidenceStorage.db; }" }));
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
    const cookieFor = async email => {
      const session = await api.createAccountSession(email, "customer");
      assert.ok(session);
      return api.sessionCookie(new Request(origin), session.token).split(";")[0];
    };
    const cookie = await cookieFor("customer@example.invalid");
    const outsider = await cookieFor("other@example.invalid");
    const upload = (options = {}) => {
      const form = new FormData();
      for (const [key, value] of Object.entries({ action: "add", requestId: "synthetic-job", evidenceType: "customer-condition",
        note: "SYNTHETIC: condition photo for upload verification", ...(options.fields ?? {}) })) form.set(key, value);
      form.set("image", new File([options.bytes ?? png], "synthetic.png", { type: options.type ?? "image/png" }));
      return api.POST(new Request(origin + "/api/job-evidence", { method: "POST", body: form,
        headers: { origin: options.origin ?? origin, cookie: options.cookie ?? cookie } }));
    };
    const image = (id, account = cookie) => api.getImage(new Request(`${origin}/api/job-evidence/image?id=${id}`, { headers: { cookie: account } }));
    let savedId;
    await t.test("a real multipart file is saved and can only be read by its customer", async () => {
      const result = await upload();
      assert.equal(result.status, 201);
      const body = await result.json(); savedId = body.evidenceId;
      assert.equal(body.jobs[0].evidence[0].imageAvailable, true);
      const stored = database.prepare("SELECT * FROM job_evidence_items WHERE id=?").get(savedId);
      assert.deepEqual(Buffer.from(objects.get(stored.image_key).bytes), png);
      const read = await image(savedId);
      assert.equal(read.status, 200); assert.equal(read.headers.get("cache-control"), "private, no-store");
      assert.equal(read.headers.get("x-content-type-options"), "nosniff");
      assert.deepEqual(Buffer.from(await read.arrayBuffer()), png);
      assert.equal((await image(savedId, outsider)).status, 403);
      assert.equal((await image(savedId, "")).status, 401);
      assert.equal((await image(savedId, "__Host-tuveloz_session=forged")).status, 401);
    });
    await t.test("foreign jobs, origins, role changes, and malformed files cannot write", async () => {
      const before = count();
      for (const [options, status] of [
        [{ cookie: outsider }, 403], [{ cookie: "" }, 401], [{ origin: "https://other.invalid" }, 403],
        [{ fields: { evidenceType: "provider-before-work" } }, 400],
        [{ bytes: "This is plain text, not a PNG image." }, 400],
        [{ type: "image/svg+xml" }, 400], [{ bytes: new Uint8Array(8 * 1024 * 1024 + 1) }, 400],
      ]) assert.equal((await upload(options)).status, status);
      assert.equal(count(), before); assert.equal(objects.size, before);
    });
    await t.test("real jobs remain locked even if a caller requests test mode", async () => {
      database.prepare("UPDATE customer_requests SET is_test_job='no' WHERE id='synthetic-job'").run();
      database.prepare("UPDATE provider_applications SET is_test_provider='no' WHERE id='synthetic-provider'").run();
      try { assert.equal((await upload({ fields: { testOnly: "true" } })).status, 503); }
      finally {
        database.prepare("UPDATE customer_requests SET is_test_job='yes' WHERE id='synthetic-job'").run();
        database.prepare("UPDATE provider_applications SET is_test_provider='yes' WHERE id='synthetic-provider'").run();
      }
      assert.equal(count(), 1); assert.equal(objects.size, 1);
    });
    await t.test("failed storage and database inserts leave no new record or orphan file", async () => {
      for (const failure of ["upload", "insert"]) {
        state.failure = failure;
        try { assert.equal((await upload()).status, 400); }
        finally { state.failure = ""; }
        assert.equal(count(), 1); assert.equal(objects.size, 1);
        assert.equal((await image(savedId)).status, 200);
      }
    });
    await t.test("a failure after saving never deletes the image or reports the save as failed", async () => {
      state.failure = "refresh";
      let result;
      try { result = await upload(); } finally { state.failure = ""; }
      const latest = database.prepare("SELECT * FROM job_evidence_items WHERE id <> ?").get(savedId);
      assert.ok(latest, "the INSERT completed before the injected refresh failure");
      assert.ok(objects.has(latest.image_key), "a committed evidence record must retain its photo");
      assert.equal(result.status, 201);
      const body = await result.json();
      assert.equal(body.ok, true); assert.equal(body.evidenceId, latest.id); assert.equal(body.refreshRequired, true);
      assert.deepEqual(Buffer.from(await (await image(latest.id)).arrayBuffer()), png);
      const listing = await (await api.GET(new Request(origin + "/api/job-evidence", { headers: { cookie } }))).json();
      assert.equal(listing.jobs[0].evidence.length, 2);
    });
    assert.equal(database.prepare("SELECT count(*) AS n FROM account_notifications").get().n, 0);
    assert.equal(database.prepare("SELECT count(*) AS n FROM stripe_payments").get().n, 0);
    assert.ok(loggedErrors.every(message => message.includes("SYNTHETIC:")));
  } finally {
    globalThis.fetch = originalFetch; console.error = originalError;
    database.close(); delete globalThis.__jobEvidenceStorage;
    assert.equal(dirname(resolve(scratch)), tempRoot);
    assert.ok(scratch.startsWith(join(tempRoot, "tuveloz-evidence-storage-")));
    rmSync(scratch, { recursive: true, force: true });
  }
});
