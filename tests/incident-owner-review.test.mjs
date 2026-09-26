import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { createRequire } from "node:module";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { build } from "esbuild";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import { exportJWK, generateKeyPair, SignJWT } from "jose";

// Real owner verification, route, SQL, incident rules, and audit writes.
// Only Cloudflare bindings and JWKS transport are local fixtures. Keys are
// generated in memory and never work against Cloudflare or Tuveloz production.
test("owner incident decisions verify signed credentials and preserve payment holds", async t => {
  const repo = resolve(import.meta.dirname, "..");
  const tempRoot = resolve(tmpdir());
  const scratch = mkdtempSync(join(tempRoot, "tuveloz-incident-owner-"));
  const database = new DatabaseSync(":memory:");
  const originalFetch = globalThis.fetch;
  const issuer = "https://synthetic-tuveloz-test.cloudflareaccess.com";
  const email = "owner@example.invalid";
  const audience = "synthetic-owner-review";
  const env = { OWNER_EMAIL: email, TEAM_DOMAIN: issuer, OWNER_ACCESS_AUD: audience,
    AUTH_CODE_SECRET: "synthetic-auth-secret-for-local-tests-only", SITE_URL: "https://tuveloz.invalid" };
  const state = { env, db: null };
  globalThis.__incidentOwnerReview = state;
  const network = [];
  const keys = await generateKeyPair("RS256");
  const wrongKeys = await generateKeyPair("RS256");
  const publicKey = { ...await exportJWK(keys.publicKey), kid: "synthetic-key", alg: "RS256", use: "sig" };
  const sign = (changes = {}, key = keys.privateKey) => new SignJWT({ email, ...changes })
    .setProtectedHeader({ alg: "RS256", kid: "synthetic-key" })
    .setIssuer(changes.iss ?? issuer).setAudience(changes.aud ?? audience)
    .setIssuedAt().setExpirationTime(changes.exp ?? "5m").sign(key);
  const seed = (table, values) => {
    const columns = Object.keys(values);
    database.prepare(`INSERT INTO ${table} (${columns.join(",")}) VALUES (${columns.map(() => "?").join(",")})`)
      .run(...Object.values(values));
  };
  const row = id => database.prepare("SELECT * FROM job_incidents WHERE id=?").get(id);
  const auditCount = () => database.prepare("SELECT count(*) AS n FROM job_lifecycle_events").get().n;
  const now = new Date().toISOString();
  try {
    globalThis.fetch = async url => {
      const requested = String(url);
      network.push(requested);
      assert.equal(requested, `${issuer}/cdn-cgi/access/certs`, "unexpected outbound request");
      return Response.json({ keys: [publicKey] });
    };
    for (const entry of JSON.parse(readFileSync(join(repo, "drizzle/meta/_journal.json"), "utf8")).entries) {
      for (const statement of readFileSync(join(repo, "drizzle", entry.tag + ".sql"), "utf8").split("--> statement-breakpoint")) {
        if (statement.trim()) database.exec(statement);
      }
    }
    state.db = drizzle(async (query, params, method) => {
      if (method === "run") { database.prepare(query).run(...params); return { rows: [] }; }
      // Node 22.13 lacks setReturnArrays. Qualified names preserve separate
      // joined id/email columns until the proxy converts the row to an array.
      database.exec("PRAGMA short_column_names=OFF; PRAGMA full_column_names=ON;");
      try {
        const statement = database.prepare(query);
        return { rows: method === "get" ? Object.values(statement.get(...params) ?? {})
          : statement.all(...params).map(value => Object.values(value)) };
      } finally {
        database.exec("PRAGMA short_column_names=ON; PRAGMA full_column_names=OFF;");
      }
    });
    const bundle = join(scratch, "route.cjs");
    await build({ absWorkingDir: repo, stdin: { contents: 'export { POST } from "./app/api/job-operations/route";', resolveDir: repo, loader: "ts" },
      bundle: true, platform: "node", format: "cjs", outfile: bundle, target: "node22", logLevel: "silent",
      plugins: [{ name: "local-cloudflare-bindings", setup(builder) {
        builder.onResolve({ filter: /^cloudflare:workers$/ }, () => ({ path: "env", namespace: "fixture" }));
        builder.onResolve({ filter: /(?:^|\/)db$/ }, args => args.path.startsWith(".") ? { path: "db", namespace: "fixture" } : null);
        builder.onLoad({ filter: /.*/, namespace: "fixture" }, args => ({ loader: "js", contents: args.path === "env"
          ? "export const env = globalThis.__incidentOwnerReview.env;"
          : "export function getDb() { return globalThis.__incidentOwnerReview.db; }" }));
      } }],
    });
    const api = createRequire(import.meta.url)(bundle);
    seed("provider_applications", { id: "synthetic-provider", name: "SYNTHETIC PROVIDER", email: "provider@example.invalid",
      service: "provisional_12v_jump_start", service_area: "Montgomery County, Maryland", experience: "Synthetic only",
      insurance_status: "unverified", is_test_provider: "yes", status: "approved", verification_status: "verified" });
    for (const requestId of ["synthetic-job", "other-job"]) {
      seed("customer_requests", { id: requestId, name: "SYNTHETIC CUSTOMER", email: "customer@example.invalid", zip: "20910",
        vehicle: "Synthetic vehicle", service: "provisional_12v_jump_start", details: "Local incident rehearsal only",
        status: "assigned", is_test_job: "yes", service_codes: '["provisional_12v_jump_start"]',
        jurisdiction: "US-MD-MontgomeryCounty", parts_source: "No parts needed — labor only", parts_preference: "No preference",
        labor_only_parts_acknowledged_at: now });
      seed("provider_quotes", { id: `${requestId}-quote`, request_id: requestId, provider_name: "SYNTHETIC PROVIDER",
        provider_email: "provider@example.invalid", price_cents: "12000", labor_price_cents: "12000", parts_price_cents: "0",
        labor_only_parts_confirmed_at: now, part_type: "No parts needed", availability: "today", message: "Synthetic quote",
        service_codes: '["provisional_12v_jump_start"]', status: "accepted", customer_fee_rate_bps: 500,
        customer_fee_cents: "600", customer_total_cents: "12600" });
    }
    const seedIncident = (id, requestId = "synthetic-job") => seed("job_incidents", { id, request_id: requestId,
      quote_id: `${requestId}-quote`, provider_id: "synthetic-provider", reporter_role: "customer", reporter_email: "customer@example.invalid",
      incident_type: "property_damage", severity: "serious", summary: "SYNTHETIC: scuff reported during a local rehearsal",
      occurred_at: now, property_damage_reported: "yes", work_stopped_at: now });
    seedIncident("pending"); seedIncident("release"); seedIncident("other-incident", "other-job");
    const validToken = await sign();
    const post = async (body, headers = { "cf-access-jwt-assertion": validToken }) => {
      const response = await api.POST(new Request("https://tuveloz.invalid/api/job-operations", {
        method: "POST", headers: { "content-type": "application/json", origin: "https://tuveloz.invalid", ...headers },
        body: JSON.stringify({ requestId: "synthetic-job", ...body }),
      }));
      return { status: response.status, body: await response.json() };
    };
    const decision = { action: "resolve-incident", incidentId: "pending", resolution: "Synthetic review completed for this test.", insurerNotified: true };
    await t.test("forged, expired, wrong-owner and misdirected tokens cannot alter an incident", async () => {
      const before = row("pending");
      assert.equal((await post(decision, { "cf-access-authenticated-user-email": email })).status, 401);
      for (const token of [await sign({ exp: Math.floor(Date.now() / 1000) - 60 }),
        await sign({ email: "not-owner@example.invalid" }), await sign({ aud: "other-audience" }),
        await sign({ iss: "https://another.cloudflareaccess.com" }), await sign({}, wrongKeys.privateKey)]) {
        assert.equal((await post(decision, { "cf-access-jwt-assertion": token })).status, 401);
      }
      assert.equal((await post(decision, { "cf-access-jwt-assertion": validToken, "cf-access-authenticated-user-email": "spoof@example.invalid" })).status, 401);
      assert.equal((await post(decision, { "cf-access-jwt-assertion": validToken, origin: "https://other.invalid" })).status, 403);
      assert.deepEqual(row("pending"), before); assert.equal(auditCount(), 0);
    });
    await t.test("damage resolution needs insurer-notice confirmation and stays bound to its job", async () => {
      const before = row("pending");
      assert.equal((await post({ ...decision, insurerNotified: false })).status, 400);
      assert.equal((await post({ ...decision, resolution: "short" })).status, 400);
      assert.equal((await post({ ...decision, incidentId: "other-incident" })).status, 404);
      assert.deepEqual(row("pending"), before); assert.equal(row("other-incident").status, "open");
      assert.equal(auditCount(), 0);
    });
    await t.test("a valid signed cookie resolves an incident while preserving its hold by default", async () => {
      const result = await post(decision, { cookie: `CF_Authorization=${validToken}` });
      assert.equal(result.status, 200); assert.equal(result.body.paymentHoldReleased, false);
      assert.equal(row("pending").status, "resolved"); assert.equal(row("pending").hold_payments, "yes");
      assert.ok(row("pending").insurer_notified_at); assert.ok(row("pending").resolved_at);
      const audit = database.prepare("SELECT * FROM job_lifecycle_events WHERE event_type='incident_resolved'").get();
      assert.equal(audit.actor_role, "owner"); assert.equal(audit.actor_id, email);
      assert.equal((await post(decision)).status, 409); assert.equal(auditCount(), 1);
    });
    await t.test("explicit incident release requires a verified owner and records that same owner", async () => {
      const result = await post({ ...decision, incidentId: "release", releasePaymentHold: true },
        { cookie: `__Host-tuveloz_owner_access=${validToken}` });
      assert.equal(result.status, 200); assert.equal(result.body.paymentHoldReleased, true);
      assert.equal(row("release").hold_payments, "no");
      const audits = database.prepare("SELECT actor_id,details FROM job_lifecycle_events WHERE event_type='incident_resolved'").all();
      assert.ok(audits.every(audit => audit.actor_id === email));
      assert.ok(audits.some(audit => JSON.parse(audit.details).paymentHoldReleased === true));
    });
    await t.test("a retained incident hold can be released later without rewriting its resolution", async () => {
      const before = row("pending");
      const release = { action: "release-incident-hold", incidentId: "pending", releaseReason: "Synthetic claim review completed.", confirmHoldRelease: true };
      const auditBefore = auditCount();
      assert.equal((await post(release, { "cf-access-authenticated-user-email": email })).status, 401);
      assert.equal((await post({ ...release, incidentId: "other-incident" })).status, 404);
      assert.equal((await post({ ...release, incidentId: "release" })).status, 409);
      assert.equal((await post({ ...release, confirmHoldRelease: false })).status, 400);
      assert.equal((await post({ ...release, releaseReason: "short" })).status, 400);
      seedIncident("still-open");
      assert.equal((await post({ ...release, incidentId: "still-open" })).status, 409);
      database.prepare("UPDATE job_incidents SET insurer_notified_at='' WHERE id='pending'").run();
      assert.equal((await post(release)).status, 400);
      database.prepare("UPDATE job_incidents SET insurer_notified_at=? WHERE id='pending'").run(before.insurer_notified_at);
      assert.equal(auditCount(), auditBefore); assert.deepEqual(row("pending"), before);
      const result = await post(release, { cookie: `__Host-tuveloz_owner_access=${validToken}` });
      assert.equal(result.status, 200); assert.equal(result.body.transferCreated, false);
      assert.equal(row("pending").hold_payments, "no");
      assert.equal(row("pending").resolution, before.resolution);
      assert.equal(row("pending").resolved_at, before.resolved_at);
      assert.equal(row("still-open").hold_payments, "yes");
      assert.equal(row("other-incident").hold_payments, "yes");
      const audit = database.prepare("SELECT * FROM job_lifecycle_events WHERE event_type='incident_payment_hold_released'").get();
      assert.equal(audit.actor_id, email); assert.equal(JSON.parse(audit.details).releaseReason, release.releaseReason);
      assert.equal((await post(release)).status, 409); assert.equal(auditCount(), auditBefore + 1);
    });
    await t.test("reserve release is validated, scoped, audited and cannot run twice", async () => {
      for (const [id, requestId] of [["reserve", "synthetic-job"], ["other-reserve", "other-job"]]) {
        seed("payment_adjustments", { id, request_id: requestId, quote_id: `${requestId}-quote`, adjustment_type: "reserve",
          amount_cents: 500, status: "active", reason_code: "synthetic_review", requested_by_role: "owner", requested_by_id: email,
          idempotency_key: `synthetic-${id}` });
      }
      const payload = { action: "resolve-payment-hold", adjustmentId: "reserve", resolution: "Synthetic reserve reviewed." };
      assert.equal((await post({ ...payload, resolution: "no" })).status, 400);
      assert.equal((await post({ ...payload, adjustmentId: "other-reserve" })).status, 404);
      assert.equal((await post(payload)).status, 200);
      const reserve = database.prepare("SELECT * FROM payment_adjustments WHERE id='reserve'").get();
      assert.equal(reserve.status, "resolved"); assert.equal(reserve.decided_by, email); assert.ok(reserve.decided_at);
      assert.equal(database.prepare("SELECT status FROM payment_adjustments WHERE id='other-reserve'").get().status, "active");
      assert.equal((await post(payload)).status, 409);
      assert.equal(database.prepare("SELECT count(*) AS n FROM job_lifecycle_events WHERE event_type='payment_hold_resolved'").get().n, 1);
    });
    assert.ok(network.length > 0, "real JWT verification must fetch the fixture public key");
    assert.ok(network.every(url => url === `${issuer}/cdn-cgi/access/certs`));
    assert.equal(database.prepare("SELECT count(*) AS n FROM stripe_payments").get().n, 0);
  } finally {
    globalThis.fetch = originalFetch;
    database.close(); delete globalThis.__incidentOwnerReview;
    // Delete only the directory this test created, never a computed repo path.
    assert.equal(dirname(resolve(scratch)), tempRoot);
    assert.ok(scratch.startsWith(join(tempRoot, "tuveloz-incident-owner-")));
    rmSync(scratch, { recursive: true, force: true });
  }
});
