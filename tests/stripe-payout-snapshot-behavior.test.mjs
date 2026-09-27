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

// Executes the actual route, signature verification, receipt queries and
// payout-safety queries against migrated local SQL. No vendor calls or money.
test("signed payout snapshots preserve holds and recover safely", async t => {
  const repo = resolve(import.meta.dirname, "..");
  const tempRoot = resolve(tmpdir());
  const scratch = mkdtempSync(join(tempRoot, "tuveloz-payout-snapshot-"));
  const database = new DatabaseSync(":memory:");
  const originalFetch = globalThis.fetch;
  const originalError = console.error, originalWarn = console.warn;
  const secret = "whsec_synthetic_payout_behavior_fixture";
  const account = "acct_synthetic_payout_behavior";
  const state = { db: null, failSnapshot: false, env: {
    STRIPE_SECRET_KEY: "sk_test_synthetic_payout_behavior_fixture",
    STRIPE_CONNECTED_ACCOUNT_WEBHOOK_SECRET: secret,
    STRIPE_ALLOW_LIVE_MODE: "false",
  } };
  globalThis.__payoutSnapshotBehavior = state;
  let sequence = 0;
  const event = (type, object, created, overrides = {}) => ({
    id: `evt_synthetic_payout_${++sequence}`, object: "event", type,
    account, created, livemode: false, data: { object }, ...overrides,
  });
  const bank = (status = "verified") => ({ id: "ba_synthetic", object: "bank_account", status });
  const payout = (status) => ({ id: "po_synthetic", object: "payout", status,
    ...(status === "failed" ? { failure_code: "account_closed" } : {}) });
  const request = (value, signingSecret = secret) => {
    const payload = JSON.stringify(value);
    return new Request("https://tuveloz.invalid/api/stripe/webhooks/connected-accounts", {
      method: "POST", body: payload,
      headers: { "stripe-signature": Stripe.webhooks.generateTestHeaderString({ payload, secret: signingSecret }) },
    });
  };
  const receipt = id => database.prepare("SELECT * FROM stripe_webhook_events WHERE event_id=?").get(id);
  const snapshot = () => database.prepare("SELECT * FROM stripe_connected_account_snapshots WHERE connected_account_id=?").get(account);
  try {
    globalThis.fetch = async () => { throw Error("Network must not be used by the local payout test"); };
    console.error = () => {}; console.warn = () => {};
    for (const entry of JSON.parse(readFileSync(join(repo, "drizzle/meta/_journal.json"), "utf8")).entries) {
      for (const statement of readFileSync(join(repo, "drizzle", entry.tag + ".sql"), "utf8").split("--> statement-breakpoint")) {
        if (statement.trim()) database.exec(statement);
      }
    }
    database.prepare(`INSERT INTO provider_applications
      (id,name,email,service,service_area,experience,insurance_status,is_test_provider,stripe_account_id)
      VALUES ('synthetic-provider','SYNTHETIC','payout@example.invalid','provisional_12v_jump_start',
      'Montgomery County, Maryland','Local test only','unverified','yes',?)`).run(account);
    state.db = drizzle(async (query, params, method) => {
      if (state.failSnapshot && query.startsWith('insert into "stripe_connected_account_snapshots"')) {
        throw Error("Synthetic snapshot storage failure");
      }
      if (method === "run") { database.prepare(query).run(...params); return { rows: [] }; }
      database.exec("PRAGMA short_column_names=OFF; PRAGMA full_column_names=ON;");
      try {
        const statement = database.prepare(query);
        return { rows: method === "get" ? Object.values(statement.get(...params) ?? {})
          : statement.all(...params).map(row => Object.values(row)) };
      } finally { database.exec("PRAGMA short_column_names=ON; PRAGMA full_column_names=OFF;"); }
    });
    const bundle = join(scratch, "payout.cjs");
    await build({ absWorkingDir: repo, stdin: { contents: `
      export { POST } from "./app/api/stripe/webhooks/connected-accounts/route";
      export { connectedAccountPayoutSafety } from "./lib/stripe-connected-account-snapshots";
      export { claimStripeWebhookEvent } from "./lib/stripe-webhook-events";
      export { getStripeClient, stripeLiveModeEnabled } from "./lib/stripe";
    `, resolveDir: repo, loader: "ts" }, bundle: true, platform: "node", format: "cjs",
      outfile: bundle, target: "node22", logLevel: "silent", plugins: [{ name: "local-bindings", setup(builder) {
        builder.onResolve({ filter: /^cloudflare:workers$/ }, () => ({ path: "env", namespace: "fixture" }));
        builder.onResolve({ filter: /(?:^|\/)db$/ }, args => args.path.startsWith(".") ? { path: "db", namespace: "fixture" } : null);
        builder.onLoad({ filter: /.*/, namespace: "fixture" }, args => ({ loader: "js", contents: args.path === "env"
          ? "export const env = globalThis.__payoutSnapshotBehavior.env;"
          : "export function getDb() { return globalThis.__payoutSnapshotBehavior.db; }" }));
      } }] });
    const api = createRequire(import.meta.url)(bundle);
    const send = value => api.POST(request(value));
    await t.test("missing snapshots, missing signatures and forged signatures fail closed", async () => {
      assert.equal((await api.connectedAccountPayoutSafety(account)).allowed, false);
      assert.equal((await api.POST(new Request("https://tuveloz.invalid", { method: "POST", body: "{}" }))).status, 400);
      assert.equal((await api.POST(request(event("payout.paid", payout("paid"), 100), "whsec_wrong"))).status, 400);
      assert.equal(database.prepare("SELECT count(*) n FROM stripe_webhook_events").get().n, 0);
    });
    await t.test("unmapped accounts are ignored and completed receipts are idempotent", async () => {
      const value = event("payout.failed", payout("failed"), 100, { account: "acct_unmapped_synthetic" });
      assert.equal((await send(value)).status, 200);
      assert.equal(receipt(value.id).status, "ignored");
      assert.deepEqual(await (await send(value)).json(), { received: true, duplicate: true });
      assert.equal(receipt(value.id).attempt_count, 1); assert.equal(snapshot(), undefined);
    });
    await t.test("signature verification works with locked or absent payment credentials", async () => {
      try {
        state.env.STRIPE_SECRET_KEY = "sk_live_synthetic_locked_fixture";
        assert.equal(api.stripeLiveModeEnabled(), false);
        assert.throws(() => api.getStripeClient(), /live mode is code-disabled/);
        const value = event("payout.failed", payout("failed"), 100, { account: "acct_unmapped_locked_fixture" });
        assert.equal((await api.POST(request(value, "whsec_wrong"))).status, 400);
        assert.equal((await send(value)).status, 200);
        assert.equal(receipt(value.id).status, "ignored");
        delete state.env.STRIPE_SECRET_KEY;
        assert.throws(() => api.getStripeClient(), /not configured/);
        assert.deepEqual(await (await send(value)).json(), { received: true, duplicate: true });
        assert.equal(snapshot(), undefined);
      } finally { state.env.STRIPE_SECRET_KEY = "sk_test_synthetic_payout_behavior_fixture"; }
    });
    await t.test("failed payouts hold funds and stale or equal-time success cannot clear a hold", async () => {
      await send(event("account.external_account.created", bank(), 100));
      assert.equal((await api.connectedAccountPayoutSafety(account)).allowed, true);
      const failure = event("payout.failed", payout("failed"), 200);
      assert.equal((await send(failure)).status, 200);
      assert.equal(receipt(failure.id).status, "processed");
      assert.equal((await api.connectedAccountPayoutSafety(account)).allowed, false);
      assert.equal(snapshot().payout_hold_reason, "payout_failed:account_closed");
      const original = snapshot();
      assert.deepEqual(await (await send(failure)).json(), { received: true, duplicate: true });
      assert.deepEqual(snapshot(), original);
      for (const created of [199, 200]) {
        await send(event("payout.paid", payout("paid"), created));
        assert.equal(snapshot().payout_failure_hold, 1);
      }
      await send(event("payout.paid", payout("paid"), 201));
      assert.equal(snapshot().payout_failure_hold, 0);
      assert.equal((await api.connectedAccountPayoutSafety(account)).allowed, true);
    });
    await t.test("bank deletion and invalid cards remain held independently of payout recovery", async () => {
      await send(event("account.external_account.deleted", { ...bank(), deleted: true }, 300));
      await send(event("payout.paid", payout("paid"), 301));
      assert.equal(snapshot().external_account_hold, 1);
      assert.equal((await api.connectedAccountPayoutSafety(account)).allowed, false);
      for (const created of [299, 300]) {
        await send(event("account.external_account.updated", bank(), created));
        assert.equal(snapshot().external_account_hold, 1);
      }
      await send(event("account.external_account.updated", { id: "card_synthetic", object: "card",
        exp_month: 1, exp_year: 2000, available_payout_methods: ["instant"] }, 1790467200));
      assert.equal(snapshot().external_account_hold_reason, "external_card_expired");
      await send(event("account.external_account.updated", bank(), 1790467201));
      assert.equal((await api.connectedAccountPayoutSafety(account)).allowed, true);
    });
    await t.test("live snapshots cannot enable payouts while the integration is in test mode", async () => {
      await send(event("account.external_account.updated", bank(), 1790467210, { livemode: true }));
      const safety = await api.connectedAccountPayoutSafety(account);
      assert.equal(safety.allowed, false); assert.match(safety.reasons.join(" "), /payment mode/);
      await send(event("account.external_account.updated", bank(), 1790467211));
      assert.equal((await api.connectedAccountPayoutSafety(account)).allowed, true);
    });
    await t.test("storage failures stay retryable and duplicates do not reapply recovered events", async () => {
      const value = event("payout.canceled", payout("canceled"), 1790467220);
      state.failSnapshot = true;
      assert.ok((await send(value)).status >= 500);
      assert.equal(receipt(value.id).status, "failed");
      assert.equal(receipt(value.id).last_error, "processing_failed");
      state.failSnapshot = false;
      assert.equal((await send(value)).status, 200);
      assert.equal(receipt(value.id).attempt_count, 2);
      assert.equal(snapshot().payout_failure_hold, 1);
      assert.deepEqual(await (await send(value)).json(), { received: true, duplicate: true });
      assert.equal(receipt(value.id).attempt_count, 2);
    });
    await t.test("in-flight claims retry later and abandoned processing leases recover", async () => {
      const value = event("payout.failed", payout("failed"), 1790467230);
      await api.claimStripeWebhookEvent({ endpoint: "connected_account_snapshot", eventId: value.id,
        eventType: value.type, livemode: false, connectedAccountId: account, objectId: value.data.object.id });
      const busy = await send(value);
      assert.equal(busy.status, 503); assert.equal(busy.headers.get("retry-after"), "5");
      database.prepare("UPDATE stripe_webhook_events SET last_attempt_at=? WHERE event_id=?")
        .run("2000-01-01T00:00:00.000Z", value.id);
      assert.equal((await send(value)).status, 200);
      assert.equal(receipt(value.id).status, "processed"); assert.equal(receipt(value.id).attempt_count, 2);
      assert.equal(database.prepare("SELECT count(*) n FROM stripe_payments").get().n, 0);
      assert.equal(database.prepare("SELECT count(*) n FROM email_notification_outbox").get().n, 0);
      assert.equal(database.prepare("SELECT status FROM provider_applications WHERE id='synthetic-provider'").get().status, "new");
    });
  } finally {
    globalThis.fetch = originalFetch; console.error = originalError; console.warn = originalWarn;
    database.close(); delete globalThis.__payoutSnapshotBehavior;
    assert.equal(dirname(resolve(scratch)), tempRoot);
    assert.ok(scratch.startsWith(join(tempRoot, "tuveloz-payout-snapshot-")));
    rmSync(scratch, { recursive: true, force: true });
  }
});
