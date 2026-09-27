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
      export { recordPaidCheckoutSession, recordRefundStatus, recordRefundedCharge, recordDisputeStatus } from "./lib/stripe-payments";
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
    const reconciliationStripe = ({ refundStatus = "succeeded", disputeStatus = "needs_response", amount = 500, full = false } = {}) => ({
      refunds: { retrieve: async () => ({ id: "re_synthetic", charge: "ch_synthetic", status: refundStatus }) },
      charges: { retrieve: async () => ({ id: "ch_synthetic", payment_intent: "pi_synthetic", amount_refunded: amount, refunded: full }) },
      disputes: { retrieve: async () => ({ id: "dp_synthetic", charge: "ch_synthetic", status: disputeStatus }) },
    });
    await t.test("a concurrent dispute survives both refund update paths", async () => {
      for (const method of ["recordRefundStatus", "recordRefundedCharge"]) {
        seed("paid_pending_completion");
        state.beforePaymentWrite = () => database.exec(`UPDATE stripe_payments SET
          status='disputed',dispute_status='needs_response',last_dispute_event_created=300
          WHERE id='payment-synthetic'`);
        await api[method](reconciliationStripe(), { id: method === "recordRefundStatus" ? "re_synthetic" : "ch_synthetic" }, "evt_refund", 301);
        assert.equal(payment().status, "disputed", method);
        assert.equal(payment().dispute_status, "needs_response");
        assert.equal(payment().refund_amount_cents, 500);
        if (method === "recordRefundStatus") assert.equal(payment().last_refund_event_id, "evt_refund");
      }
    });
    await t.test("equal-time refund success cannot erase an adverse refund, including during a dispute", async () => {
      for (const disputed of [false, true]) {
        for (const concurrent of [false, true]) {
          seed("paid_pending_completion");
          const adverse = () => database.prepare(`UPDATE stripe_payments SET status=?,dispute_status=?,
            refund_status='failed',refund_failure_reason='lost_or_stolen_card',last_refund_event_created=400,
            last_refund_event_id='evt_refund_failed' WHERE id='payment-synthetic'`
          ).run(disputed ? "disputed" : "refund_failed_review", disputed ? "needs_response" : "");
          if (concurrent) state.beforePaymentWrite = adverse; else adverse();
          await api.recordRefundStatus(reconciliationStripe(), { id: "re_synthetic" }, "evt_refund_success", 400);
          assert.equal(payment().refund_status, "failed", JSON.stringify({ disputed, concurrent }));
          assert.equal(payment().last_refund_event_id, "evt_refund_failed");
          assert.equal(payment().refund_failure_reason, "lost_or_stolen_card");
          assert.equal(payment().status, disputed ? "disputed" : "refund_failed_review");
          // A strictly newer authoritative refund update can still reconcile.
          await api.recordRefundStatus(reconciliationStripe(), { id: "re_synthetic" }, "evt_refund_success_new", 401);
          assert.equal(payment().refund_status, "succeeded");
          assert.equal(payment().status, disputed ? "disputed" : "partially_refunded");
        }
      }
    });
    await t.test("delayed charge snapshots cannot reduce a recorded refund or erase its first date", async () => {
      for (const method of ["recordRefundStatus", "recordRefundedCharge"]) {
        for (const amount of [0, 500]) {
          seed("paid_pending_completion");
          state.beforePaymentWrite = () => database.exec(`UPDATE stripe_payments SET status='refunded',
            refund_amount_cents=10500,refunded_at='synthetic-first-refund' WHERE id='payment-synthetic'`);
          const stripe = reconciliationStripe({ amount });
          let reads = 0;
          stripe.charges.retrieve = async () => ({ id: "ch_synthetic", payment_intent: "pi_synthetic",
            amount_refunded: ++reads === 1 ? amount : 10500, refunded: reads > 1 });
          await api[method](stripe, { id: method === "recordRefundStatus" ? "re_synthetic" : "ch_synthetic" }, "evt_delayed_charge", 402);
          assert.equal(reads, 2, "a concurrent refund requires a fresh Stripe read");
          assert.equal(payment().refund_amount_cents, 10500, method);
          assert.equal(payment().refunded_at, "synthetic-first-refund");
          assert.equal(payment().status, "refunded");
        }
      }
    });
    await t.test("charge aggregate updates cannot clear a concurrent failed refund", async () => {
      seed("paid_pending_completion");
      state.beforePaymentWrite = () => database.exec(`UPDATE stripe_payments SET status='refund_failed_review',
        refund_status='failed',last_refund_event_created=500 WHERE id='payment-synthetic'`);
      await api.recordRefundedCharge(reconciliationStripe(), { id: "ch_synthetic" });
      assert.equal(payment().status, "refund_failed_review");
      assert.equal(payment().refund_status, "failed");
      assert.equal(payment().refund_amount_cents, 500);
    });
    await t.test("equal-time dispute victory cannot replace a concurrent adverse dispute", async () => {
      for (const concurrent of [false, true]) {
        seed("paid_pending_completion");
        const adverse = () => database.exec(`UPDATE stripe_payments SET status='dispute_lost',
          dispute_status='lost',last_dispute_event_created=600,last_dispute_event_id='evt_dispute_lost'
          WHERE id='payment-synthetic'`);
        if (concurrent) state.beforePaymentWrite = adverse; else adverse();
        await api.recordDisputeStatus(reconciliationStripe({ disputeStatus: "won" }), { id: "dp_synthetic" }, "evt_dispute_won", 600);
        assert.equal(payment().dispute_status, "lost");
        assert.equal(payment().last_dispute_event_id, "evt_dispute_lost");
        await api.recordDisputeStatus(reconciliationStripe({ disputeStatus: "won" }), { id: "dp_synthetic" }, "evt_dispute_won_new", 601);
        assert.equal(payment().dispute_status, "won");
        assert.equal(payment().status, "dispute_won_review");
      }
    });
    await t.test("refund and dispute updates record their facts without removing a launch hold", async () => {
      for (const method of ["recordRefundStatus", "recordRefundedCharge", "recordDisputeStatus"]) {
        for (const concurrent of [false, true]) {
          seed(concurrent ? "paid_pending_completion" : "paid_launch_readiness_hold");
          if (concurrent) state.beforePaymentWrite = () => database.exec(`UPDATE stripe_payments
            SET status='paid_launch_readiness_hold' WHERE id='payment-synthetic'`);
          await api[method](reconciliationStripe(), { id: method === "recordRefundedCharge" ? "ch_synthetic" : "synthetic_object" }, "evt_launch_hold", 700);
          assert.equal(payment().status, "paid_launch_readiness_hold", method);
          if (method === "recordDisputeStatus") assert.equal(payment().dispute_status, "needs_response");
          else assert.equal(payment().refund_amount_cents, 500);
          assert.equal(payment().released_at, "");
          assert.equal(payment().transfer_id, null);
        }
      }
    });
    await t.test("retry records a newer total even when an earlier partial refund wins the first write", async () => {
      for (const method of ["recordRefundStatus", "recordRefundedCharge"]) {
        seed("paid_pending_completion");
        const stripe = reconciliationStripe({ amount: 1000 });
        let reads = 0;
        stripe.charges.retrieve = async () => {
          if (++reads === 1) database.exec(`UPDATE stripe_payments SET status='partially_refunded',
            refund_amount_cents=500,refunded_at='synthetic-first-refund' WHERE id='payment-synthetic'`);
          return { id: "ch_synthetic", payment_intent: "pi_synthetic", amount_refunded: 1000, refunded: false };
        };
        await api[method](stripe, { id: method === "recordRefundStatus" ? "re_synthetic" : "ch_synthetic" }, "evt_latest_charge", 800);
        assert.equal(reads, 2);
        assert.equal(payment().refund_amount_cents, 1000);
        assert.equal(payment().refunded_at, "synthetic-first-refund");
      }
    });
    await t.test("an authoritative refund failure can correct the total without releasing its hold", async () => {
      seed("refund_pending");
      database.exec(`UPDATE stripe_payments SET refund_status='pending',refund_amount_cents=500,
        refunded_at='synthetic-pending-refund',last_refund_event_created=800 WHERE id='payment-synthetic'`);
      await api.recordRefundStatus(reconciliationStripe({ refundStatus: "failed", amount: 0 }), { id: "re_synthetic" }, "evt_failed_correction", 801);
      assert.equal(payment().refund_amount_cents, 0);
      assert.equal(payment().refunded_at, "");
      assert.equal(payment().status, "refund_failed_review");
      assert.equal(payment().refund_status, "failed");
    });
    await t.test("persistent refund contention stays retryable and does not release money", async () => {
      for (const method of ["recordRefundStatus", "recordRefundedCharge"]) {
        seed("refund_pending");
        const stripe = reconciliationStripe();
        let reads = 0;
        stripe.charges.retrieve = async () => {
          database.prepare(`UPDATE stripe_payments SET refund_amount_cents=? WHERE id='payment-synthetic'`).run(++reads);
          return { id: "ch_synthetic", payment_intent: "pi_synthetic", amount_refunded: 500, refunded: false };
        };
        await assert.rejects(api[method](stripe, { id: method === "recordRefundStatus" ? "re_synthetic" : "ch_synthetic" }, "evt_contended", 900), /retry required/);
        assert.equal(reads, 3);
        assert.equal(payment().refund_amount_cents, 3);
        assert.equal(payment().status, "refund_pending");
        assert.equal(payment().released_at, "");
        assert.equal(payment().transfer_id, null);
      }
    });
    await t.test("refunds still reconcile by PaymentIntent before checkout records its Charge ID", async () => {
      for (const method of ["recordRefundStatus", "recordRefundedCharge"]) {
        seed("paid_pending_completion");
        database.exec("UPDATE stripe_payments SET charge_id='' WHERE id='payment-synthetic'");
        await api[method](reconciliationStripe(), { id: method === "recordRefundStatus" ? "re_synthetic" : "ch_synthetic" }, "evt_before_checkout", 950);
        assert.equal(payment().refund_amount_cents, 500);
        assert.equal(payment().status, "partially_refunded");
      }
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
