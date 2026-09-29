import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { build } from "esbuild";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import Stripe from "stripe";

// Real receipt SQL, including UPDATE RETURNING, against the migrated schema.
// No Stripe credentials, requests, participant records or money movements.
test("Stripe receipt completion belongs to the attempt that acquired it", async t => {
  const repo = resolve(import.meta.dirname, "..");
  const tempRoot = resolve(tmpdir());
  const scratch = mkdtempSync(join(tempRoot, "tuveloz-webhook-claims-"));
  const database = new DatabaseSync(":memory:");
  const originalFetch = globalThis.fetch;
  const originalError = console.error, originalWarn = console.warn;
  const secret = "whsec_synthetic_receipt_claims";
  const state = { db: null, beforeComplete: null, events: new Map(), env: {
    STRIPE_SECRET_KEY: "sk_test_synthetic_receipt_claims",
    STRIPE_IDENTITY_SECRET_KEY: "rk_test_synthetic_receipt_claims",
    IDENTITY_VERIFICATION_PROVIDERS: "stripe_identity",
    STRIPE_PAYMENT_WEBHOOK_SECRET: secret, STRIPE_CONNECT_WEBHOOK_SECRET: secret,
    STRIPE_IDENTITY_WEBHOOK_SECRET: secret, STRIPE_CONNECTED_ACCOUNT_WEBHOOK_SECRET: secret,
    STRIPE_ALLOW_LIVE_MODE: "false",
  } };
  globalThis.__webhookClaims = state;
  const receipt = claim => database.prepare("SELECT * FROM stripe_webhook_events WHERE id=?").get(claim.id);
  const expire = claim => database.prepare("UPDATE stripe_webhook_events SET last_attempt_at=? WHERE id=?")
    .run("2000-01-01T00:00:00.000Z", claim.id);
  let sequence = 0;
  const event = (endpoint = "payments") => ({ endpoint, eventId: `evt_synthetic_claim_${++sequence}`,
    eventType: "synthetic.only", livemode: false });
  try {
    console.error = () => {}; console.warn = () => {};
    globalThis.fetch = async (input, options = {}) => {
      const url = new URL(String(input));
      assert.equal(options.method ?? "GET", "GET", "No remote writes permitted");
      assert.equal(url.origin, "https://api.stripe.com");
      assert.ok(url.pathname.startsWith("/v2/core/events/"));
      const value = state.events.get(url.pathname.split("/").at(-1));
      assert.ok(value, "Only prepared local fixtures may be read");
      return Response.json(value);
    };
    for (const entry of JSON.parse(readFileSync(join(repo, "drizzle/meta/_journal.json"), "utf8")).entries) {
      for (const query of readFileSync(join(repo, "drizzle", entry.tag + ".sql"), "utf8").split("--> statement-breakpoint")) {
        if (query.trim()) database.exec(query);
      }
    }
    state.db = drizzle(async (query, params, method) => {
      assert.ok(params.length <= 100, "D1 parameter limit");
      if (state.beforeComplete && query.startsWith('update "stripe_webhook_events"')
        && (params[0] === "processed" || params[0] === "ignored")) {
        const interleave = state.beforeComplete; state.beforeComplete = null;
        await interleave();
      }
      if (method === "run") { database.prepare(query).run(...params); return { rows: [] }; }
      database.exec("PRAGMA short_column_names=OFF; PRAGMA full_column_names=ON;");
      try {
        const statement = database.prepare(query);
        return { rows: method === "get" ? Object.values(statement.get(...params) ?? {})
          : statement.all(...params).map(row => Object.values(row)) };
      } finally { database.exec("PRAGMA short_column_names=ON; PRAGMA full_column_names=OFF;"); }
    });
    const bundle = join(scratch, "claims.cjs");
    await build({ absWorkingDir: repo, stdin: { contents: `
      export * from "./lib/stripe-webhook-events";
      export { POST as payments } from "./app/api/stripe/webhooks/payments/route";
      export { POST as identity } from "./app/api/stripe/webhooks/identity/route";
      export { POST as connect_thin } from "./app/api/stripe/webhooks/connect/route";
      export { POST as connected_account_snapshot } from "./app/api/stripe/webhooks/connected-accounts/route";
    `, resolveDir: repo, loader: "ts" },
      bundle: true, platform: "node", format: "cjs", outfile: bundle, target: "node22", logLevel: "silent",
      plugins: [{ name: "local-database", setup(builder) {
        builder.onResolve({ filter: /^cloudflare:workers$/ }, () => ({ path: "env", namespace: "fixture" }));
        builder.onResolve({ filter: /(?:^|\/)db$/ }, args => args.path.startsWith(".")
          ? { path: "db", namespace: "fixture" } : null);
        builder.onLoad({ filter: /.*/, namespace: "fixture" }, args => ({ loader: "js",
          contents: args.path === "env" ? "export const env = globalThis.__webhookClaims.env;"
            : "export function getDb() { return globalThis.__webhookClaims.db; }" }));
      } }] });
    const api = createRequire(import.meta.url)(bundle);
    const finish = (claim, status = "processed") => api.completeStripeWebhookEvent(claim, status);
    const fail = claim => api.failStripeWebhookEvent(claim);

    await t.test("a delayed completion cannot acknowledge the newer retry", async () => {
      const input = event();
      const first = await api.claimStripeWebhookEvent(input);
      expire(first);
      const second = await api.claimStripeWebhookEvent(input);
      assert.equal(second.shouldProcess, true);
      const before = receipt(second);
      assert.equal(before.attempt_count, 2);
      await assert.rejects(finish(first), /processing claim/);
      assert.deepEqual(receipt(second), before);
      await finish(second);
      assert.equal(receipt(second).status, "processed");
    });

    await t.test("a delayed failure cannot fail or reclaim the newer retry", async () => {
      const input = event("identity");
      const first = await api.claimStripeWebhookEvent(input);
      expire(first);
      const second = await api.claimStripeWebhookEvent(input);
      const before = receipt(second);
      await fail(first);
      assert.deepEqual(receipt(second), before);
      const third = await api.claimStripeWebhookEvent(input);
      assert.equal(third.shouldProcess, false);
      assert.equal(third.busy, true);
      assert.equal(receipt(second).attempt_count, 2);
      await finish(second);
    });

    await t.test("a busy duplicate has no right to complete or fail the active attempt", async () => {
      const input = event("connect_thin");
      const active = await api.claimStripeWebhookEvent(input);
      const duplicate = await api.claimStripeWebhookEvent(input);
      assert.equal(duplicate.shouldProcess, false);
      assert.equal(duplicate.busy, true);
      const before = receipt(active);
      await assert.rejects(finish(duplicate), /processing claim/);
      await fail(duplicate);
      assert.deepEqual(receipt(active), before);
      await finish(active, "ignored");
      const completed = receipt(active);
      await fail(active);
      assert.deepEqual(receipt(active), completed);
      assert.equal((await api.claimStripeWebhookEvent(input)).busy, false);
    });

    await t.test("current failures can retry and only one concurrent caller reclaims the lease", async () => {
      const input = event("connected_account_snapshot");
      const first = await api.claimStripeWebhookEvent(input);
      await fail(first);
      assert.equal(receipt(first).status, "failed");
      assert.equal(receipt(first).last_error, "processing_failed");
      const claims = await Promise.all([api.claimStripeWebhookEvent(input), api.claimStripeWebhookEvent(input)]);
      assert.equal(claims.filter(claim => claim.shouldProcess).length, 1);
      assert.equal(claims.filter(claim => claim.busy).length, 1);
      const second = claims.find(claim => claim.shouldProcess);
      assert.equal(receipt(second).attempt_count, 2);
      assert.equal(receipt(second).last_error, "");
      await finish(second);
      const completed = receipt(second);
      await fail(first);
      assert.deepEqual(receipt(second), completed);
      assert.equal((await api.claimStripeWebhookEvent(input)).shouldProcess, false);
    });

    await t.test("every actual signed route preserves a newer claim in its error handler", async () => {
      for (const endpoint of ["payments", "identity", "connect_thin", "connected_account_snapshot"]) {
        const input = event(endpoint);
        const value = { id: input.eventId, type: input.eventType, livemode: false,
          object: endpoint === "connect_thin" ? "v2.core.event" : "event",
          created: Math.floor(Date.now() / 1000), data: { object: { id: "obj_synthetic" } } };
        state.events.set(value.id, value);
        let replacement, before;
        state.beforeComplete = async () => {
          const first = { id: `${endpoint}:${value.id}` };
          expire(first);
          replacement = await api.claimStripeWebhookEvent(input);
          assert.equal(replacement.shouldProcess, true);
          before = receipt(replacement);
        };
        const payload = JSON.stringify(value);
        const request = () => new Request(`https://tuveloz.invalid/${endpoint}`, { method: "POST", body: payload,
          headers: { "stripe-signature": Stripe.webhooks.generateTestHeaderString({ payload, secret }) } });
        assert.equal((await api[endpoint](request())).status, 502, endpoint);
        assert.ok(replacement, `${endpoint} must reach receipt completion`);
        assert.equal(before.attempt_count, 2);
        assert.deepEqual(receipt(replacement), before, `${endpoint} must not fail the replacement claim`);
        const busy = await api[endpoint](request());
        assert.equal(busy.status, 503);
        await finish(replacement, "ignored");
        assert.deepEqual(await (await api[endpoint](request())).json(), { received: true, duplicate: true });
      }
      for (const table of ["stripe_payments", "payment_adjustments", "provider_applications", "email_notification_outbox"]) {
        assert.equal(database.prepare(`SELECT count(*) n FROM ${table}`).get().n, 0);
      }
    });
  } finally {
    globalThis.fetch = originalFetch;
    console.error = originalError; console.warn = originalWarn;
    database.close(); delete globalThis.__webhookClaims;
    assert.equal(dirname(resolve(scratch)), tempRoot);
    assert.ok(scratch.startsWith(join(tempRoot, "tuveloz-webhook-claims-")));
    rmSync(scratch, { recursive: true, force: true });
  }
});
