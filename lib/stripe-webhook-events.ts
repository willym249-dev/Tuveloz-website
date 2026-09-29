import { and, eq, lte, or, sql } from "drizzle-orm";
import { getDb } from "../db";
import { stripeWebhookEvents } from "../db/schema";

export type StripeWebhookEndpoint =
  | "payments"
  | "connect_thin"
  | "connected_account_snapshot"
  | "identity";

const WEBHOOK_PROCESSING_LEASE_MS = 5 * 60 * 1000;

type ClaimInput = {
  endpoint: StripeWebhookEndpoint;
  eventId: string;
  eventType: string;
  livemode: boolean;
  connectedAccountId?: string;
  objectId?: string;
};

type StripeWebhookClaimIdentity = {
  id: string;
};

export type StripeWebhookClaim = StripeWebhookClaimIdentity & (
  | { shouldProcess: true; attemptCount: number; duplicate: false; busy: false }
  | { shouldProcess: false; attemptCount: null; duplicate: true; busy: boolean }
);

/**
 * Claims one endpoint/event pair for processing.
 *
 * A failed attempt can be retried immediately. A processing claim can be
 * reclaimed only after its short lease expires, which prevents concurrent
 * Stripe deliveries from entering the handler together during the lease while
 * still allowing recovery if a Worker dies mid-request. The returned attempt
 * number owns receipt completion/failure: an old Worker cannot overwrite the
 * receipt after another delivery reclaims it. Domain handlers must still make
 * their own writes idempotent because an expired Worker can resume late.
 */
export async function claimStripeWebhookEvent(
  input: ClaimInput,
): Promise<StripeWebhookClaim> {
  const db = getDb();
  const id = `${input.endpoint}:${input.eventId}`;
  const now = new Date();
  const nowIso = now.toISOString();
  const [inserted] = await db.insert(stripeWebhookEvents).values({
    id,
    endpoint: input.endpoint,
    eventId: input.eventId,
    eventType: input.eventType,
    livemode: input.livemode ? 1 : 0,
    connectedAccountId: input.connectedAccountId?.slice(0, 255) ?? "",
    objectId: input.objectId?.slice(0, 255) ?? "",
    status: "processing",
    attemptCount: 1,
    receivedAt: nowIso,
    lastAttemptAt: nowIso,
  }).onConflictDoNothing({ target: stripeWebhookEvents.id }).returning({
    id: stripeWebhookEvents.id,
    attemptCount: stripeWebhookEvents.attemptCount,
  });
  if (inserted) {
    return { id, attemptCount: inserted.attemptCount, shouldProcess: true, duplicate: false, busy: false };
  }

  const [existing] = await db.select({
    status: stripeWebhookEvents.status,
  }).from(stripeWebhookEvents).where(eq(stripeWebhookEvents.id, id)).limit(1);
  if (!existing) {
    throw new Error("Stripe webhook receipt could not be claimed.");
  }
  if (existing.status === "processed" || existing.status === "ignored") {
    return { id, attemptCount: null, shouldProcess: false, duplicate: true, busy: false };
  }

  const staleAt = new Date(now.getTime() - WEBHOOK_PROCESSING_LEASE_MS).toISOString();
  const [reclaimed] = await db.update(stripeWebhookEvents).set({
    status: "processing",
    attemptCount: sql`${stripeWebhookEvents.attemptCount} + 1`,
    lastAttemptAt: nowIso,
    lastError: "",
  }).where(and(
    eq(stripeWebhookEvents.id, id),
    or(
      eq(stripeWebhookEvents.status, "failed"),
      and(
        eq(stripeWebhookEvents.status, "processing"),
        lte(stripeWebhookEvents.lastAttemptAt, staleAt),
      ),
    ),
  )).returning({ id: stripeWebhookEvents.id, attemptCount: stripeWebhookEvents.attemptCount });

  return reclaimed
    ? { id, attemptCount: reclaimed.attemptCount, shouldProcess: true, duplicate: false, busy: false }
    : { id, attemptCount: null, shouldProcess: false, duplicate: true, busy: true };
}

export async function completeStripeWebhookEvent(
  claim: StripeWebhookClaim,
  status: "processed" | "ignored" = "processed",
) {
  if (!claim.shouldProcess || !Number.isSafeInteger(claim.attemptCount) || claim.attemptCount < 1) {
    throw new Error("Stripe webhook receipt has no processing claim.");
  }
  const [completed] = await getDb().update(stripeWebhookEvents).set({
    status,
    processedAt: new Date().toISOString(),
    lastError: "",
  }).where(and(
    eq(stripeWebhookEvents.id, claim.id),
    eq(stripeWebhookEvents.attemptCount, claim.attemptCount),
    eq(stripeWebhookEvents.status, "processing"),
  )).returning({ id: stripeWebhookEvents.id });
  if (!completed) {
    throw new Error("Stripe webhook receipt lost its processing claim.");
  }
}

export async function failStripeWebhookEvent(claim: StripeWebhookClaim) {
  if (!claim.shouldProcess || !Number.isSafeInteger(claim.attemptCount) || claim.attemptCount < 1) return;
  await getDb().update(stripeWebhookEvents).set({
    status: "failed",
    // Do not persist raw Stripe errors or payloads. They can contain financial
    // or account details; the full error remains only in restricted logs.
    lastError: "processing_failed",
  }).where(and(
    eq(stripeWebhookEvents.id, claim.id),
    eq(stripeWebhookEvents.attemptCount, claim.attemptCount),
    eq(stripeWebhookEvents.status, "processing"),
  ));
}
