import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { createRequire } from "node:module";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { build } from "esbuild";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import Stripe from "stripe";

test("payment notifications preserve session binding and concurrent safety holds", async t => {
  const repo = resolve(import.meta.dirname, "..");
  const tempRoot = resolve(tmpdir());
  const scratch = mkdtempSync(join(tempRoot, "tuveloz-payment-notification-"));
  const database = new DatabaseSync(":memory:");
  const originalFetch = globalThis.fetch;
  const originalError = console.error, originalWarn = console.warn;
  const secret = "whsec_synthetic_payment_notification_fixture";
  const state = { db: null, beforePaymentWrite: null, env: {
    STRIPE_SECRET_KEY: "sk_test_synthetic_payment_notification_fixture",
    STRIPE_PAYMENT_WEBHOOK_SECRET: secret, STRIPE_ALLOW_LIVE_MODE: "false",
  } };
  globalThis.__paymentNotificationBehavior = state;
  let sequence = 0;
  const session = id => ({ id, object: "checkout.session", metadata: {
    tuveloz_payment_record_id: "payment-synthetic",
  } });
  const payment = () => database.prepare("SELECT * FROM stripe_payments WHERE id='payment-synthetic'").get();
  const seed = (status = "checkout_open") => {
    state.beforePaymentWrite = null;
    database.prepare("DELETE FROM stripe_payments WHERE id='payment-synthetic'").run();
    database.prepare(`INSERT INTO stripe_payments
      (id,payment_type,product_name,provider_application_id,connected_account_id,
       provider_amount_cents,application_fee_cents,customer_total_cents,
       settlement_strategy,checkout_session_id,payment_intent_id,charge_id,status)
      VALUES ('payment-synthetic','product','Synthetic test only','provider-synthetic',
      'acct_synthetic',10000,500,10500,'separate_charge_and_transfer',
      'cs_current','pi_synthetic','ch_synthetic',?)`).run(status);
  };
  try {
    globalThis.fetch = async () => { throw Error("Outbound calls are forbidden in this isolated test"); };
    console.error = () => {}; console.warn = () => {};
    for (const entry of JSON.parse(readFileSync(join(repo, "drizzle/meta/_journal.json"), "utf8")).entries) {
      for (const statement of readFileSync(join(repo, "drizzle", entry.tag + ".sql"), "utf8").split("--> statement-breakpoint")) {
        if (statement.trim()) database.exec(statement);
      }
    }
    state.db = drizzle(async (query, params, method) => {
      if (query.startsWith('update "stripe_payments"') && state.beforePaymentWrite) {
        const interleave = state.beforePaymentWrite;
        state.beforePaymentWrite = null;
        interleave();
      }
      if (method === "run") { database.prepare(query).run(...params); return { rows: [] }; }
      database.exec("PRAGMA short_column_names=OFF; PRAGMA full_column_names=ON;");
      try {
        const statement = database.prepare(query);
        return { rows: method === "get" ? Object.values(statement.get(...params) ?? {})
          : statement.all(...params).map(row => Object.values(row)) };
      } finally { database.exec("PRAGMA short_column_names=ON; PRAGMA full_column_names=OFF;"); }
    });
    const bundle = join(scratch, "notifications.cjs");
    await build({ absWorkingDir: repo, stdin: { contents: `
      export { POST } from "./app/api/stripe/webhooks/payments/route";
      export { recordPaidCheckoutSession, recordRefundStatus, recordDisputeStatus } from "./lib/stripe-payments";
      export { stripeLiveModeEnabled } from "./lib/stripe";
    `, resolveDir: repo, loader: "ts" }, bundle: true, platform: "node", format: "cjs",
      outfile: bundle, target: "node22", logLevel: "silent", plugins: [{ name: "local-bindings", setup(builder) {
        builder.onResolve({ filter: /^cloudflare:workers$/ }, () => ({ path: "env", namespace: "fixture" }));
        builder.onResolve({ filter: /(?:^|\/)db$/ }, args => args.path.startsWith(".") ? { path: "db", namespace: "fixture" } : null);
        builder.onLoad({ filter: /.*/, namespace: "fixture" }, args => ({ loader: "js", contents: args.path === "env"
          ? "export const env = globalThis.__paymentNotificationBehavior.env;"
          : "export function getDb() { return globalThis.__paymentNotificationBehavior.db; }" }));
      } }] });
    const api = createRequire(import.meta.url)(bundle);
    const send = async (type, object, signingSecret = secret, id = `evt_synthetic_payment_${++sequence}`) => {
      const payload = JSON.stringify({ id, object: "event", type, livemode: false,
        created: 1790467200 + sequence, data: { object } });
      return api.POST(new Request("https://tuveloz.invalid/api/stripe/webhooks/payments", {
        method: "POST", body: payload, headers: { "stripe-signature":
          Stripe.webhooks.generateTestHeaderString({ payload, secret: signingSecret }) },
      }));
    };
    await t.test("forged notifications cannot change payment data", async () => {
      seed();
      assert.equal((await send("checkout.session.expired", session("cs_current"), "whsec_wrong")).status, 400);
      assert.equal(payment().status, "checkout_open");
      assert.equal(database.prepare("SELECT count(*) n FROM stripe_webhook_events").get().n, 0);
    });
    await t.test("an unrelated checkout session cannot expire or fail the current payment", async () => {
      for (const type of ["checkout.session.expired", "checkout.session.async_payment_failed"]) {
        seed();
        assert.equal((await send(type, session("cs_old_attempt"))).status, 200);
        assert.equal(payment().status, "checkout_open");
      }
    });
    await t.test("matching failures apply once and settled states survive late notifications", async () => {
      for (const [type, expected] of [["checkout.session.expired", "checkout_expired"],
        ["checkout.session.async_payment_failed", "payment_failed"]]) {
        for (const pendingStatus of ["checkout_creating", "checkout_open", "checkout_release_recheck", "checkout_expiration_unconfirmed"]) {
          seed(pendingStatus);
          const id = `evt_synthetic_duplicate_${++sequence}`;
          assert.equal((await send(type, session("cs_current"), secret, id)).status, 200);
          assert.equal(payment().status, expected);
          assert.deepEqual(await (await send(type, session("cs_current"), secret, id)).json(), { received: true, duplicate: true });
        }
        for (const protectedStatus of ["paid_pending_completion", "refunded", "refund_failed_review", "disputed"]) {
          seed(protectedStatus);
          assert.equal((await send(type, session("cs_current"))).status, 200);
          assert.equal(payment().status, protectedStatus);
        }
      }
    });
    await t.test("completion and safety holds concurrent with a failure notification are preserved", async () => {
      for (const protectedStatus of ["paid_pending_completion", "refund_failed_review", "disputed"]) {
        seed();
        state.beforePaymentWrite = () => database.prepare(
          "UPDATE stripe_payments SET status=?,paid_at='synthetic-paid' WHERE id='payment-synthetic'"
        ).run(protectedStatus);
        assert.equal((await send("checkout.session.async_payment_failed", session("cs_current"))).status, 200);
        assert.equal(payment().status, protectedStatus);
        assert.equal(payment().paid_at, "synthetic-paid");
      }
    });
    await t.test("a session replaced between the read and write keeps its current state", async () => {
      seed();
      state.beforePaymentWrite = () => database.prepare(
        "UPDATE stripe_payments SET checkout_session_id='cs_replacement' WHERE id='payment-synthetic'"
      ).run();
      assert.equal((await send("checkout.session.expired", session("cs_current"))).status, 200);
      assert.equal(payment().status, "checkout_open");
      assert.equal(payment().checkout_session_id, "cs_replacement");
    });
    await t.test("refund and dispute reconciliation keep adverse and out-of-order holds", async () => {
      seed("paid_pending_completion");
      let refundStatus = "failed", disputeStatus = "needs_response";
      const readOnlyStripe = {
        refunds: { retrieve: async () => ({ id: "re_synthetic", charge: "ch_synthetic", status: refundStatus }) },
        charges: { retrieve: async () => ({ id: "ch_synthetic", payment_intent: "pi_synthetic", amount_refunded: 500, refunded: false }) },
        disputes: { retrieve: async () => ({ id: "dp_synthetic", charge: "ch_synthetic", status: disputeStatus }) },
      };
      await api.recordRefundStatus(readOnlyStripe, { id: "re_synthetic" }, "evt_refund_failed", 200);
      assert.equal(payment().status, "refund_failed_review");
      refundStatus = "succeeded";
      for (const time of [199, 200]) {
        await api.recordRefundStatus(readOnlyStripe, { id: "re_synthetic" }, `evt_refund_old_${time}`, time);
        assert.equal(payment().status, "refund_failed_review");
      }
      await api.recordDisputeStatus(readOnlyStripe, { id: "dp_synthetic" }, "evt_dispute", 300);
      assert.equal(payment().status, "disputed");
      await api.recordRefundStatus(readOnlyStripe, { id: "re_synthetic" }, "evt_refund_later", 301);
      assert.equal(payment().status, "disputed");
      disputeStatus = "won";
      await api.recordDisputeStatus(readOnlyStripe, { id: "dp_synthetic" }, "evt_dispute_old", 299);
      assert.equal(payment().status, "disputed");
      await api.recordDisputeStatus(readOnlyStripe, { id: "dp_synthetic" }, "evt_dispute_won", 302);
      assert.equal(payment().status, "dispute_won_review");
      assert.equal(payment().released_at, "");
      assert.equal(payment().transfer_id, null);
      assert.equal(api.stripeLiveModeEnabled(), false);
      assert.equal(database.prepare("SELECT count(*) n FROM email_notification_outbox").get().n, 0);
    });
    const paidSession = { ...session("cs_current"), payment_status: "paid", amount_total: 10500,
      currency: "usd", payment_intent: "pi_synthetic" };
    const paidStripe = { paymentIntents: { retrieve: async () => ({ id: "pi_synthetic",
      status: "succeeded", amount_received: 10500, latest_charge: { id: "ch_synthetic" } }) } };
    await t.test("matching completion records payment without bypassing an existing launch hold", async () => {
      for (const [initial, expected] of [["checkout_open", "paid_pending_completion"],
        ["checkout_release_recheck", "paid_launch_readiness_hold"],
        ["checkout_expiration_unconfirmed", "paid_launch_readiness_hold"]]) {
        seed(initial);
        await api.recordPaidCheckoutSession(paidStripe, paidSession);
        assert.equal(payment().status, expected);
        assert.equal(payment().charge_id, "ch_synthetic");
        assert.ok(payment().paid_at);
        assert.equal(payment().released_at, "");
      }
    });
    await t.test("a completion notification cannot overwrite a newer refund or dispute hold", async () => {
      for (const protectedStatus of ["refund_failed_review", "disputed", "paid_launch_readiness_hold"]) {
        seed();
        state.beforePaymentWrite = () => database.prepare(
          "UPDATE stripe_payments SET status=? WHERE id='payment-synthetic'"
        ).run(protectedStatus);
        await api.recordPaidCheckoutSession(paidStripe, paidSession);
        assert.equal(payment().status, protectedStatus);
      }
    });
    await t.test("a completion notification cannot update a replaced checkout session", async () => {
      seed();
      state.beforePaymentWrite = () => database.prepare(
        "UPDATE stripe_payments SET checkout_session_id='cs_replacement' WHERE id='payment-synthetic'"
      ).run();
      await api.recordPaidCheckoutSession(paidStripe, paidSession);
      assert.equal(payment().checkout_session_id, "cs_replacement");
      assert.equal(payment().status, "checkout_open");
    });
  } finally {
    globalThis.fetch = originalFetch; console.error = originalError; console.warn = originalWarn;
    database.close(); delete globalThis.__paymentNotificationBehavior;
    assert.equal(dirname(resolve(scratch)), tempRoot);
    assert.ok(scratch.startsWith(join(tempRoot, "tuveloz-payment-notification-")));
    rmSync(scratch, { recursive: true, force: true });
  }
});
