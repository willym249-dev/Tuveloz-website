import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { build } from "esbuild";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import Stripe from "stripe";

test("isolated hosted-delivery rehearsal uses the real route and fails closed", async t => {
  const repo = resolve(import.meta.dirname, "..");
  const tempRoot = resolve(tmpdir());
  const scratch = await mkdtemp(join(tempRoot, "tuveloz-delivery-rehearsal-"));
  const scriptPath = join(scratch, "worker.cjs");
  const database = new DatabaseSync(":memory:");
  const originalFetch = globalThis.fetch;
  const secret = "whsec_synthetic_local_rehearsal";
  const bindings = {
    APP_ENVIRONMENT: "stripe_delivery_rehearsal", REHEARSAL_ENABLED: "true",
    REHEARSAL_STARTS_AT: new Date(Date.now() - 30_000).toISOString(),
    REHEARSAL_EXPIRES_AT: new Date(Date.now() + 30 * 60_000).toISOString(),
    REHEARSAL_EVENT_ID: "evt_syntheticTransport",
    REHEARSAL_SESSION_ID: "cs_test_syntheticUnpaid",
    REHEARSAL_ACCOUNT_CONTEXT: "acct_syntheticRehearsal",
    STRIPE_SECRET_KEY: "rk_test_synthetic_local_only",
    STRIPE_PAYMENT_WEBHOOK_SECRET: secret, STRIPE_ALLOW_LIVE_MODE: "false",
  };
  const event = () => ({
    id: bindings.REHEARSAL_EVENT_ID, object: "event", type: "checkout.session.expired",
    livemode: false, created: Math.floor(Date.now() / 1000),
    context: bindings.REHEARSAL_ACCOUNT_CONTEXT,
    data: { object: {
      id: bindings.REHEARSAL_SESSION_ID, object: "checkout.session", livemode: false,
      status: "expired", payment_status: "unpaid", metadata: {},
      payment_intent: null, subscription: null, invoice: null,
      customer: null, customer_email: null, customer_details: null,
    } },
  });
  const origin = "https://rehearsal.invalid";
  const path = "/api/stripe/webhooks/payments";
  let outboundRequests = 0;
  const state = { env: { ...bindings }, db: null };
  globalThis.__deliveryRehearsal = state;
  try {
    globalThis.fetch = async () => {
      outboundRequests++;
      throw new Error("Outbound calls forbidden in this local rehearsal");
    };
    state.db = drizzle(async (query, params, method) => {
      assert.ok(params.length <= 100, "D1 parameter limit");
      if (method === "run") { database.prepare(query).run(...params); return { rows: [] }; }
      database.exec("PRAGMA short_column_names=OFF; PRAGMA full_column_names=ON;");
      try {
        const statement = database.prepare(query);
        return { rows: method === "get" ? Object.values(statement.get(...params) ?? {})
          : statement.all(...params).map(row => Object.values(row)) };
      } finally { database.exec("PRAGMA short_column_names=ON; PRAGMA full_column_names=OFF;"); }
    });
    await build({ absWorkingDir: repo, entryPoints: ["rehearsal-worker/payment-delivery.ts"],
      bundle: true, platform: "node", format: "cjs", outfile: scriptPath,
      target: "node22", logLevel: "silent", plugins: [{ name: "isolated-receipt-db", setup(builder) {
        builder.onResolve({ filter: /^cloudflare:workers$/ }, () => ({ path: "env", namespace: "fixture" }));
        builder.onResolve({ filter: /(?:^|\/)db$/ }, args => args.path.startsWith(".")
          ? { path: "db", namespace: "fixture" } : null);
        builder.onLoad({ filter: /.*/, namespace: "fixture" }, args => ({ loader: "js",
          contents: args.path === "env" ? "export const env = globalThis.__deliveryRehearsal.env;"
            : "export function getDb() { return globalThis.__deliveryRehearsal.db; }" }));
      } }] });
    const worker = createRequire(import.meta.url)(scriptPath).default;
    const dispatch = (url, options) => worker.fetch(new Request(url, options));
    const migration = await readFile(join(repo, "drizzle/0045_chilly_maginty.sql"), "utf8");
    const receiptSql = migration.split("--> statement-breakpoint")
      .filter(sql => /CREATE (?:TABLE|(?:UNIQUE )?INDEX).*stripe_webhook_events/.test(sql));
    assert.equal(receiptSql.length, 4);
    for (const sql of receiptSql) database.exec(sql);
    const count = () => database.prepare("SELECT count(*) AS n FROM stripe_webhook_events").get().n;
    const signed = async (value = event(), overrides = {}) => {
      const body = typeof value === "string" ? value : JSON.stringify(value);
      const signature = Stripe.webhooks.generateTestHeaderString({ payload: body, secret });
      return dispatch(origin + (overrides.path ?? path), {
        method: "POST", body,
        headers: { "content-type": "application/json", "stripe-signature": signature,
          ...overrides.headers },
      });
    };

    await t.test("missing, invalid and stale signatures cannot create a receipt", async () => {
      for (const signature of ["", "t=1,v1=invalid", Stripe.webhooks.generateTestHeaderString({
        payload: JSON.stringify(event()), secret, timestamp: 1,
      })]) assert.equal((await signed(event(), { headers: { "stripe-signature": signature } })).status, 400);
      assert.equal(await count(), 0);
    });
    await t.test("other paths, methods, content types and oversize bodies are refused", async () => {
      assert.equal((await dispatch(origin + path)).status, 405);
      assert.equal((await signed(event(), { path: "/admin" })).status, 404);
      assert.equal((await signed(event(), { path: path + "?debug=1" })).status, 404);
      assert.equal((await signed(event(), { headers: { "content-type": "text/plain" } })).status, 415);
      assert.equal((await signed(event(), { headers: { "content-encoding": "gzip" } })).status, 415);
      const oversized = { ...event(), padding: "x".repeat(33 * 1024) };
      assert.equal((await signed(oversized)).status, 413);
      assert.equal(await count(), 0);
    });
    await t.test("even valid signatures cannot admit a different event, live mode or payment data", async () => {
      const variants = [
        e => { e.id = "evt_other"; }, e => { e.type = "checkout.session.completed"; },
        e => { e.livemode = true; }, e => { e.account = "acct_other"; },
        e => { e.context = "acct_other"; }, e => { e.data.object.livemode = true; },
        e => { e.data.object.id = "cs_test_other"; }, e => { e.data.object.status = "open"; },
        e => { e.data.object.payment_status = "paid"; }, e => { e.data.object.payment_intent = "pi_other"; },
        e => { e.data.object.metadata = { tuveloz_payment_record_id: "never-touch" }; },
        e => { e.data.object.customer_email = "synthetic@example.invalid"; },
        e => { e.data.object.customer = "cus_other"; },
        e => { e.data.object.customer_details = {}; },
        e => { e.data.object.invoice = "in_other"; }, e => { e.data.object.subscription = "sub_other"; },
      ];
      for (const change of variants) {
        const value = event(); change(value);
        assert.equal((await signed(value)).status, 400);
      }
      assert.equal(await count(), 0);
    });
    await t.test("the real payment route persists one receipt and acknowledges a duplicate", async () => {
      const response = await signed();
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { received: true });
      assert.equal(response.headers.get("cache-control"), "private, no-store");
      const before = database.prepare("SELECT * FROM stripe_webhook_events").get();
      assert.equal(before.status, "processed");
      assert.equal(before.livemode, 0);
      assert.equal(before.attempt_count, 1);
      assert.equal(before.object_id, bindings.REHEARSAL_SESSION_ID);
      const snapshotWithoutContext = event();
      delete snapshotWithoutContext.context;
      const duplicate = await signed(snapshotWithoutContext);
      assert.equal(duplicate.status, 200);
      assert.deepEqual(await duplicate.json(), { received: true, duplicate: true });
      assert.deepEqual(database.prepare("SELECT * FROM stripe_webhook_events").get(), before);
      assert.equal(await count(), 1);
      assert.equal(outboundRequests, 0);
      // The database intentionally has no payment/provider tables to mutate.
      const tables = database.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
      assert.deepEqual(tables.map(row => row.name), ["stripe_webhook_events"]);
    });
    await t.test("disabled, premature, expired, overlong and misconfigured windows reject even a duplicate", async () => {
      const invalidConfigs = [
        { REHEARSAL_ENABLED: "false" }, { APP_ENVIRONMENT: "production" },
        { REHEARSAL_STARTS_AT: new Date(Date.now() + 60_000).toISOString() },
        { REHEARSAL_EXPIRES_AT: new Date(Date.now() - 1_000).toISOString() },
        { REHEARSAL_EXPIRES_AT: new Date(Date.now() + 61 * 60_000).toISOString() },
        { REHEARSAL_STARTS_AT: "invalid" }, { REHEARSAL_EVENT_ID: "" },
        { REHEARSAL_SESSION_ID: "cs_live_wrong" }, { STRIPE_SECRET_KEY: "rk_live_wrong" },
        { STRIPE_SECRET_KEY: "sk_test_unrestricted" },
        { REHEARSAL_ACCOUNT_CONTEXT: "" },
        { STRIPE_SECRET_KEY: "" }, { STRIPE_ALLOW_LIVE_MODE: "true" },
        { STRIPE_PAYMENT_WEBHOOK_SECRET: "" },
      ];
      for (const change of invalidConfigs) {
        Object.assign(state.env, bindings, change);
        assert.equal((await signed()).status, 404);
      }
      assert.equal(outboundRequests, 0);
    });
  } finally {
    database.close();
    globalThis.fetch = originalFetch;
    delete globalThis.__deliveryRehearsal;
    assert.equal(dirname(resolve(scratch)), tempRoot);
    assert.ok(scratch.startsWith(join(tempRoot, "tuveloz-delivery-rehearsal-")));
    await rm(scratch, { recursive: true, force: true });
  }
});
