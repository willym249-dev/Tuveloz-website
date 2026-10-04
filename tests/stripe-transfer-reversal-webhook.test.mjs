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

// Actual signatures, SDK requests, receipt claims and migrated SQL. Only local
// synthetic responses are allowed; this fixture never opens a payment gate.
test("signed transfer reversal notifications retain durable review evidence", async t => {
  const repo = resolve(import.meta.dirname, ".."), tempRoot = resolve(tmpdir());
  const scratch = mkdtempSync(join(tempRoot, "tuveloz-reversal-webhook-"));
  const originalFetch = globalThis.fetch, originalError = console.error;
  const secret = "whsec_synthetic_reversal_webhook_only";
  const state = { db: null, beforeRead: null, env: {
    STRIPE_SECRET_KEY: "sk_test_synthetic_reversal_webhook_only",
    STRIPE_PAYMENT_WEBHOOK_SECRET: secret, STRIPE_ALLOW_LIVE_MODE: "false",
  } };
  globalThis.__reversalWebhook = state;
  let database, transfer, reads = 0, sequence = 0;
  const now = "2026-10-04T12:00:00.000Z";
  const seedPayment = () => database.prepare(`INSERT INTO stripe_payments
    (id,payment_type,product_name,request_id,quote_id,provider_application_id,connected_account_id,
     currency,provider_amount_cents,application_fee_cents,customer_total_cents,
     settlement_strategy,payment_intent_id,charge_id,transfer_group,transfer_id,
     status,paid_at,released_at,scope_version,scope_authorization_decision_id,authorized_price_snapshot)
    VALUES ('payment-synthetic','quote','SYNTHETIC ONLY','job-synthetic','quote-synthetic','provider-synthetic',
     'acct_synthetic','usd',10000,500,10500,'separate_transfer','pi_synthetic','ch_synthetic',
     'tuveloz_payment-synthetic','tr_synthetic','released',?,?,1,'scope-synthetic',
     '{"laborAmountCents":10000}')`).run(now, now);
  const payment = () => database.prepare("SELECT * FROM stripe_payments WHERE id='payment-synthetic'").get();
  const markers = () => database.prepare("SELECT * FROM payment_adjustments").all();
  const receipt = id => database.prepare("SELECT * FROM stripe_webhook_events WHERE id=?").get(`payments:${id}`);
  const reset = () => {
    database?.close(); database = new DatabaseSync(":memory:");
    for (const entry of JSON.parse(readFileSync(join(repo, "drizzle/meta/_journal.json"), "utf8")).entries) {
      for (const sql of readFileSync(join(repo, "drizzle", `${entry.tag}.sql`), "utf8").split("--> statement-breakpoint")) {
        if (sql.trim()) database.exec(sql);
      }
    }
    const querySql = (query, params, method) => {
      assert.ok(params.length <= 100, "D1 statement parameter limit");
      if (method === "run") { database.prepare(query).run(...params); return { rows: [] }; }
      database.exec("PRAGMA short_column_names=OFF; PRAGMA full_column_names=ON;");
      try {
        const statement = database.prepare(query);
        return { rows: method === "get" ? Object.values(statement.get(...params) ?? {})
          : statement.all(...params).map(row => Object.values(row)) };
      } finally { database.exec("PRAGMA short_column_names=ON; PRAGMA full_column_names=OFF;"); }
    };
    state.db = drizzle(querySql, async queries => {
      database.exec("BEGIN");
      try {
        const result = queries.map(query => querySql(query.sql, query.params, query.method));
        database.exec("COMMIT"); return result;
      } catch (error) { database.exec("ROLLBACK"); throw error; }
    });
    seedPayment(); reads = 0; state.beforeRead = null;
    transfer = { id: "tr_synthetic", object: "transfer", amount: 10000, currency: "usd",
      destination: "acct_synthetic", source_transaction: "ch_synthetic", transfer_group: "tuveloz_payment-synthetic",
      created: 1791115200, livemode: false, amount_reversed: 2500, reversed: false,
      metadata: { tuveloz_payment_record_id: "payment-synthetic", tuveloz_request_id: "job-synthetic",
        tuveloz_quote_id: "quote-synthetic" } };
  };
  const assertReview = () => {
    assert.equal(payment().status, "released", "the review marker does not replace payment or safety-hold status");
    assert.equal(payment().transfer_id, "tr_synthetic");
    assert.equal(payment().released_at, now);
    assert.equal(payment().refund_amount_cents, 0);
    assert.equal(payment().refund_status, "");
    assert.equal(markers().length, 1);
    const marker = markers()[0];
    assert.equal(marker.adjustment_type, "stripe_transfer_reversal_review");
    assert.equal(marker.status, "review_required");
    for (const key of ["amount_cents", "provider_impact_cents", "customer_impact_cents"]) assert.equal(marker[key], 0);
    for (const key of ["stripe_refund_id", "transfer_reversal_id"]) assert.equal(marker[key], "");
    assert.equal(JSON.parse(marker.details).accountingEntry, false);
    assert.equal(JSON.parse(marker.details).collectionAuthorized, false);
  };
  try {
    console.error = () => {};
    globalThis.fetch = async (input, options = {}) => {
      const url = new URL(String(input));
      assert.equal(url.origin, "https://api.stripe.com", "no external destinations allowed");
      assert.equal(options.method ?? "GET", "GET", "processor writes are forbidden");
      assert.equal(url.pathname, `/v1/transfers/${transfer.id}`, "only the current synthetic transfer can be read");
      reads++; await state.beforeRead?.();
      return Response.json(transfer);
    };
    const bundle = join(scratch, "webhook.cjs");
    await build({ absWorkingDir: repo, entryPoints: ["app/api/stripe/webhooks/payments/route.ts"],
      bundle: true, platform: "node", format: "cjs", target: "node22", outfile: bundle, logLevel: "silent",
      plugins: [{ name: "reversal-webhook-fixture", setup(builder) {
        builder.onResolve({ filter: /^cloudflare:workers$/ }, () => ({ path: "env", namespace: "fixture" }));
        builder.onResolve({ filter: /(?:^|\/)db$/ }, args => args.path.startsWith(".") ? { path: "db", namespace: "fixture" } : null);
        builder.onLoad({ filter: /.*/, namespace: "fixture" }, args => ({ loader: "js", contents: args.path === "env"
          ? "export const env = globalThis.__reversalWebhook.env;"
          : "export const getDb = () => globalThis.__reversalWebhook.db;" }));
      } }] });
    const { POST } = createRequire(import.meta.url)(bundle);
    const event = (changes = {}) => ({ id: `evt_synthetic_reversal_${++sequence}`, object: "event",
      type: "transfer.reversed", created: 1791115200, livemode: false,
      data: { object: { id: "tr_synthetic", object: "transfer", amount_reversed: 0,
        reversed: false, destination: "acct_stale", metadata: {} } }, ...changes });
    const send = async (value, signingSecret = secret) => {
      const payload = JSON.stringify(value);
      return POST(new Request("https://tuveloz.invalid/api/stripe/webhooks/payments", { method: "POST", body: payload,
        headers: { "stripe-signature": Stripe.webhooks.generateTestHeaderString({ payload, secret: signingSecret }) } }));
    };
    await t.test("forged signatures cannot claim an event, read Stripe or mark a payment", async () => {
      reset(); const before = payment(), value = event();
      assert.equal((await send(value, "whsec_wrong_synthetic")).status, 400);
      assert.deepEqual(payment(), before); assert.deepEqual(markers(), []);
      assert.equal(receipt(value.id), undefined); assert.equal(reads, 0);
    });
    await t.test("signed partial and full events use the current transfer and completed duplicates do not reread", async () => {
      for (const reversedAmount of [2500, 10000]) {
        reset(); transfer.amount_reversed = reversedAmount; transfer.reversed = reversedAmount === transfer.amount;
        const value = event();
        assert.equal((await send(value)).status, 200); assertReview();
        assert.equal(receipt(value.id).status, "processed"); assert.equal(receipt(value.id).attempt_count, 1);
        assert.equal(reads, 1);
        const savedPayment = payment(), savedMarkers = markers(), savedReceipt = receipt(value.id);
        assert.deepEqual(await (await send(value)).json(), { received: true, duplicate: true });
        assert.equal(reads, 1); assert.deepEqual(payment(), savedPayment);
        assert.deepEqual(markers(), savedMarkers); assert.deepEqual(receipt(value.id), savedReceipt);
      }
    });
    await t.test("wrong event mode and connected-account context fail before reads and remain retryable", async () => {
      for (const changes of [{ livemode: true }, { account: "acct_other" }]) {
        reset(); const before = payment(), value = event(changes);
        for (const attempt of [1, 2]) {
          assert.equal((await send(value)).status, 502);
          assert.equal(receipt(value.id).status, "failed"); assert.equal(receipt(value.id).attempt_count, attempt);
        }
        assert.equal(reads, 0); assert.deepEqual(payment(), before); assert.deepEqual(markers(), []);
      }
    });
    await t.test("wrong current destination and stripped metadata on a known transfer cannot be acknowledged as safe", async () => {
      for (const corrupt of [() => { transfer.destination = "acct_wrong"; }, () => { transfer.metadata = {}; }]) {
        reset(); const originalTransfer = structuredClone(transfer), before = payment(), value = event(); corrupt();
        assert.equal((await send(value)).status, 502); assert.equal(receipt(value.id).status, "failed");
        assert.deepEqual(payment(), before); assert.deepEqual(markers(), []);
        transfer = originalTransfer;
        assert.equal((await send(value)).status, 200); assertReview();
        assert.equal(receipt(value.id).attempt_count, 2); assert.equal(reads, 2);
      }
    });
    await t.test("a competing delivery cannot enter a still-active event claim", async () => {
      reset(); const value = event();
      let entered, release;
      const started = new Promise(resolve => { entered = resolve; });
      const paused = new Promise(resolve => { release = resolve; });
      state.beforeRead = async () => { entered(); await paused; };
      const first = send(value);
      await started;
      try {
        const competing = await send(value);
        assert.equal(competing.status, 503); assert.equal(competing.headers.get("retry-after"), "5");
        assert.equal(reads, 1); assert.equal(receipt(value.id).attempt_count, 1); assert.deepEqual(markers(), []);
      } finally { release(); }
      assert.equal((await first).status, 200); assertReview();
      assert.equal(receipt(value.id).status, "processed");
    });
    await t.test("a failed payment write rolls back its marker and the same receipt retries once", async () => {
      reset(); const value = event(), before = payment();
      database.exec(`CREATE TEMP TRIGGER fail_reversal_payment BEFORE UPDATE ON stripe_payments
        BEGIN SELECT RAISE(ABORT, 'synthetic payment write failure'); END`);
      assert.equal((await send(value)).status, 502);
      assert.equal(receipt(value.id).status, "failed"); assert.deepEqual(payment(), before); assert.deepEqual(markers(), []);
      database.exec("DROP TRIGGER fail_reversal_payment");
      assert.equal((await send(value)).status, 200); assertReview();
      assert.equal(receipt(value.id).attempt_count, 2); assert.equal(reads, 2);
      const saved = markers();
      assert.deepEqual(await (await send(value)).json(), { received: true, duplicate: true });
      assert.deepEqual(markers(), saved); assert.equal(reads, 2);
    });
    await t.test("lost receipt completion retries a committed review without adding another marker", async () => {
      reset(); const value = event();
      database.exec(`CREATE TEMP TRIGGER fail_reversal_receipt BEFORE UPDATE ON stripe_webhook_events
        WHEN NEW.status='processed' BEGIN SELECT RAISE(ABORT, 'synthetic receipt completion failure'); END`);
      assert.equal((await send(value)).status, 502); assertReview();
      assert.equal(receipt(value.id).status, "failed"); const saved = markers();
      database.exec("DROP TRIGGER fail_reversal_receipt");
      assert.equal((await send(value)).status, 200); assertReview();
      assert.deepEqual(markers(), saved); assert.equal(receipt(value.id).status, "processed");
      assert.equal(receipt(value.id).attempt_count, 2); assert.equal(reads, 2);
    });
    await t.test("unmapped Tuveloz payments retry after local arrival; unrelated transfers may be acknowledged", async () => {
      reset(); database.exec("DELETE FROM stripe_payments"); const value = event();
      assert.equal((await send(value)).status, 502); assert.equal(receipt(value.id).status, "failed");
      assert.deepEqual(markers(), []); seedPayment();
      assert.equal((await send(value)).status, 200); assertReview(); assert.equal(receipt(value.id).attempt_count, 2);
      reset(); const before = payment(); transfer.id = "tr_unrelated"; transfer.metadata = {};
      const unrelated = event({ data: { object: { id: "tr_unrelated", object: "transfer", metadata: {} } } });
      assert.equal((await send(unrelated)).status, 200);
      assert.ok(["processed", "ignored"].includes(receipt(unrelated.id).status));
      assert.deepEqual(payment(), before); assert.deepEqual(markers(), []);
      assert.deepEqual(await (await send(unrelated)).json(), { received: true, duplicate: true }); assert.equal(reads, 1);
    });
  } finally {
    globalThis.fetch = originalFetch; console.error = originalError;
    database?.close(); delete globalThis.__reversalWebhook;
    assert.equal(dirname(resolve(scratch)), tempRoot);
    assert.ok(scratch.startsWith(join(tempRoot, "tuveloz-reversal-webhook-")));
    rmSync(scratch, { recursive: true, force: true });
  }
});
