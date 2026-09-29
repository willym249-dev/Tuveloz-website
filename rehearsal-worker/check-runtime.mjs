// Local-only integration check of the actual Wrangler bundle, not a deployment.
// First: wrangler deploy --dry-run --config rehearsal-worker/wrangler.example.jsonc
//   --outdir outputs/stripe-delivery-rehearsal-bundle
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import Stripe from "stripe";

const root = resolve(import.meta.dirname, "..");
const tempRoot = resolve(tmpdir());
const scratch = await mkdtemp(join(tempRoot, "tuveloz-delivery-runtime-"));
const secret = "whsec_local_runtime_only";
const event = {
  id: "evt_syntheticTransport", object: "event", type: "checkout.session.expired",
  livemode: false, created: Math.floor(Date.now() / 1000),
  context: "acct_syntheticRehearsal",
  data: { object: {
    id: "cs_test_syntheticUnpaid", object: "checkout.session", livemode: false,
    status: "expired", payment_status: "unpaid", metadata: {},
    payment_intent: null, subscription: null, invoice: null,
    customer: null, customer_email: null, customer_details: null,
  } },
};
let runtime;
let outgoing = 0;
try {
  const bindings = {
    APP_ENVIRONMENT: "stripe_delivery_rehearsal", REHEARSAL_ENABLED: "true",
    REHEARSAL_STARTS_AT: new Date(Date.now() - 30_000).toISOString(),
    REHEARSAL_EXPIRES_AT: new Date(Date.now() + 30 * 60_000).toISOString(),
    REHEARSAL_EVENT_ID: event.id, REHEARSAL_SESSION_ID: event.data.object.id,
    REHEARSAL_ACCOUNT_CONTEXT: event.context,
    STRIPE_SECRET_KEY: "rk_test_synthetic_local_only",
    STRIPE_PAYMENT_WEBHOOK_SECRET: secret, STRIPE_ALLOW_LIVE_MODE: "false",
  };
  const options = {
    name: "local-rehearsal-runtime-check", modules: true,
    scriptPath: join(import.meta.dirname, "outputs/stripe-delivery-rehearsal-bundle/payment-delivery.js"),
    compatibilityDate: "2026-07-27", compatibilityFlags: ["nodejs_compat"],
    bindings, d1Databases: { DB: "synthetic-receipts-only" }, d1Persist: join(scratch, "d1"),
    outboundService() { outgoing++; throw new Error("External calls forbidden"); },
  };
  runtime = new Miniflare(convertV4MiniflareOptions(options));
  const db = await runtime.getD1Database("DB");
  const migration = await readFile(join(root, "drizzle/0045_chilly_maginty.sql"), "utf8");
  const statements = migration.split("--> statement-breakpoint")
    .filter(sql => /CREATE (?:TABLE|(?:UNIQUE )?INDEX).*stripe_webhook_events/.test(sql));
  assert.equal(statements.length, 4);
  for (const sql of statements) await db.prepare(sql).run();
  const body = JSON.stringify(event);
  const signature = Stripe.webhooks.generateTestHeaderString({ payload: body, secret });
  const send = value => runtime.dispatchFetch("https://rehearsal.invalid/api/stripe/webhooks/payments", {
    method: "POST", body, headers: { "content-type": "application/json", "stripe-signature": value },
  });
  assert.equal((await send("t=1,v1=forged")).status, 400);
  assert.equal((await db.prepare("SELECT count(*) n FROM stripe_webhook_events").first()).n, 0);
  const first = await send(signature);
  assert.equal(first.status, 200);
  assert.deepEqual(await first.json(), { received: true });
  const before = await db.prepare("SELECT * FROM stripe_webhook_events").first();
  assert.equal(before.status, "processed");
  assert.equal(before.livemode, 0);
  assert.equal(before.attempt_count, 1);
  const duplicate = await send(signature);
  assert.equal(duplicate.status, 200);
  assert.deepEqual(await duplicate.json(), { received: true, duplicate: true });
  assert.deepEqual(await db.prepare("SELECT * FROM stripe_webhook_events").first(), before);
  assert.equal((await db.prepare("SELECT count(*) n FROM stripe_webhook_events").first()).n, 1);
  const tables = await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE '_cf_%'").all();
  assert.deepEqual(tables.results.map(row => row.name), ["stripe_webhook_events"]);
  await runtime.setOptions(convertV4MiniflareOptions({ ...options,
    bindings: { ...bindings, REHEARSAL_EXPIRES_AT: new Date(Date.now() - 1000).toISOString() },
  }));
  assert.equal((await send(signature)).status, 404);
  assert.equal(outgoing, 0);
  console.log(JSON.stringify({
    status: "passed", scope: "local Cloudflare runtime and D1 using the Wrangler-built real route",
    invalidSignature: 400, validEvent: 200, duplicate: 200, receiptCount: 1,
    attemptCount: 1, expiredWindow: 404, outboundCalls: 0, remoteDeployment: false,
  }, null, 2));
} finally {
  await runtime?.dispose();
  assert.equal(dirname(resolve(scratch)), tempRoot);
  assert.ok(scratch.startsWith(join(tempRoot, "tuveloz-delivery-runtime-")));
  await rm(scratch, { recursive: true, force: true });
}
