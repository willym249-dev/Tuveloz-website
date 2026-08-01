import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("payment webhooks durably reconcile every asynchronous refund and dispute event", async () => {
  const [route, payments, receipts] = await Promise.all([
    source("app/api/stripe/webhooks/payments/route.ts"),
    source("lib/stripe-payments.ts"),
    source("lib/stripe-webhook-events.ts"),
  ]);

  for (const eventType of [
    "charge.refunded",
    "charge.refund.updated",
    "refund.created",
    "refund.failed",
    "refund.updated",
    "charge.dispute.created",
    "charge.dispute.updated",
    "charge.dispute.closed",
    "charge.dispute.funds_reinstated",
    "charge.dispute.funds_withdrawn",
  ]) {
    assert.ok(route.includes(`case "${eventType}"`), eventType);
  }
  assert.match(route, /endpoint: "payments"/);
  assert.match(route, /claimStripeWebhookEvent/);
  assert.match(route, /completeStripeWebhookEvent/);
  assert.match(route, /failStripeWebhookEvent/);
  assert.match(payments, /stripeClient\.refunds\.retrieve\(eventRefund\.id\)/);
  assert.match(payments, /stripeClient\.disputes\.retrieve\(eventDispute\.id\)/);
  assert.match(payments, /stripeClient\.charges\.retrieve/);
  assert.match(payments, /REFUND_HOLD_PAYMENT_STATUSES/);
  assert.match(payments, /refund_failed_review/);
  assert.match(payments, /lastRefundEventCreated/);
  assert.match(payments, /lastDisputeEventCreated/);

  assert.match(receipts, /WEBHOOK_PROCESSING_LEASE_MS/);
  assert.match(receipts, /onConflictDoNothing/);
  assert.match(receipts, /eq\(stripeWebhookEvents\.status, "failed"\)/);
  assert.match(receipts, /lte\(stripeWebhookEvents\.lastAttemptAt, staleAt\)/);
  assert.match(receipts, /status: "failed"/);
  assert.match(receipts, /lastError: "processing_failed"/);
  assert.doesNotMatch(receipts, /rawBody|request\.text|JSON\.stringify\(event/);
});

test("connected-account snapshots use a separate signed endpoint and fail closed", async () => {
  const [snapshotRoute, thinRoute, helper, stripe, payoutRelease, paymentAdmin, checkout, products] =
    await Promise.all([
      source("app/api/stripe/webhooks/connected-accounts/route.ts"),
      source("app/api/stripe/webhooks/connect/route.ts"),
      source("lib/stripe-connected-account-snapshots.ts"),
      source("lib/stripe.ts"),
      source("app/api/stripe/admin/payments/route.ts"),
      source("app/components/stripe-payment-admin.tsx"),
      source("app/api/stripe/checkout/route.ts"),
      source("app/api/stripe/products/route.ts"),
    ]);

  assert.match(snapshotRoute, /constructEventAsync/);
  assert.match(snapshotRoute, /STRIPE_CONNECTED_ACCOUNT_WEBHOOK_SECRET/);
  assert.match(snapshotRoute, /endpoint: "connected_account_snapshot"/);
  assert.doesNotMatch(snapshotRoute, /parseEventNotificationAsync|v2\.core\.events\.retrieve/);
  assert.match(thinRoute, /parseEventNotificationAsync/);
  assert.match(thinRoute, /endpoint: "connect_thin"/);
  assert.match(thinRoute, /claimStripeWebhookEvent/);
  assert.match(stripe, /STRIPE_CONNECTED_ACCOUNT_WEBHOOK_SECRET/);

  for (const eventType of [
    "account.external_account.created",
    "account.external_account.updated",
    "account.external_account.deleted",
    "payout.created",
    "payout.updated",
    "payout.paid",
    "payout.failed",
    "payout.canceled",
    "payout.reconciliation_completed",
  ]) {
    assert.ok(helper.includes(`"${eventType}"`), eventType);
  }
  assert.match(helper, /payout\.status === "failed" \|\| payout\.status === "canceled"/);
  assert.match(helper, /external_account_deleted/);
  assert.match(helper, /external_card_expired/);
  assert.match(helper, /No signed Stripe payout-account snapshot has been recorded/);
  assert.match(helper, /does not match the current payment mode/);
  assert.match(helper, /excluded\.last_payout_event_created </);
  assert.match(helper, /excluded\.last_external_account_event_created </);

  assert.match(payoutRelease, /connectedAccountPayoutSafety/);
  assert.match(payoutRelease, /STRIPE_CONNECTED_ACCOUNT_PAYOUT_HOLD/);
  assert.match(payoutRelease, /stripeConnectedAccountSnapshots/);
  assert.match(paymentAdmin, /no signed Stripe payout-account snapshot/);
  assert.match(checkout, /connectedAccountPayoutSafety/);
  assert.match(products, /connectedAccountPayoutSafety/);
});

test("Stripe hardening migration and deployment instructions include every durable control", async () => {
  const [schema, migration, envExample, deployment, health, launchStatus, stripe] =
    await Promise.all([
      source("db/schema.ts"),
      source("drizzle/0045_chilly_maginty.sql"),
      source(".env.example"),
      source("DEPLOYMENT.md"),
      source("app/api/health/route.ts"),
      source("lib/launch-status.ts"),
      source("lib/stripe.ts"),
    ]);

  for (const table of [
    "stripe_webhook_events",
    "stripe_connected_account_snapshots",
  ]) {
    assert.ok(schema.includes(`"${table}"`), table);
    assert.ok(migration.includes(`CREATE TABLE \`${table}\``), table);
  }
  for (const column of [
    "refund_status",
    "last_refund_event_created",
    "last_dispute_event_created",
    "payout_failure_hold",
    "external_account_hold",
  ]) {
    assert.ok(migration.includes(`\`${column}\``), column);
  }
  assert.match(envExample, /STRIPE_CONNECTED_ACCOUNT_WEBHOOK_SECRET=/);
  assert.match(deployment, /\/api\/stripe\/webhooks\/connected-accounts/);
  assert.match(deployment, /--forward-connect-to/);
  assert.match(deployment, /refund\.failed/);
  assert.match(deployment, /charge\.dispute\.funds_withdrawn/);
  assert.match(deployment, /payout\.failed/);
  assert.match(deployment, /account\.external_account\.deleted/);
  assert.match(health, /"stripe_webhook_events"/);
  assert.match(health, /"stripe_connected_account_snapshots"/);
  assert.match(health, /last_refund_event_created/);

  // This patch is reconciliation-only. It must not weaken either release gate.
  assert.match(launchStatus, /MARKETPLACE_MODE = "onboarding_only"/);
  assert.match(stripe, /STRIPE_LIVE_MODE_ENABLED = false as const/);
});
