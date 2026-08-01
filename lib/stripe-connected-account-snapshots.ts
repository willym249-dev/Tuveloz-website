import { eq, sql } from "drizzle-orm";
import type Stripe from "stripe";
import { getDb } from "../db";
import {
  providerApplications,
  stripeConnectedAccountSnapshots,
} from "../db/schema";
import { stripeLiveModeEnabled } from "./stripe";
import { stripeObjectId } from "./stripe-payments";

const PAYOUT_EVENT_TYPES = new Set([
  "payout.canceled",
  "payout.created",
  "payout.failed",
  "payout.paid",
  "payout.reconciliation_completed",
  "payout.updated",
]);

const EXTERNAL_ACCOUNT_EVENT_TYPES = new Set([
  "account.external_account.created",
  "account.external_account.deleted",
  "account.external_account.updated",
]);

export function connectedAccountSnapshotEventSupported(type: string) {
  return PAYOUT_EVENT_TYPES.has(type) || EXTERNAL_ACCOUNT_EVENT_TYPES.has(type);
}

function externalAccountSnapshot(
  object: Stripe.Event.Data.Object,
  eventType: string,
  eventCreated: number,
) {
  const external = object as Stripe.BankAccount | Stripe.Card | Stripe.DeletedBankAccount;
  const deleted = eventType === "account.external_account.deleted" || "deleted" in external;
  if (deleted) {
    return {
      id: external.id,
      type: external.object,
      status: "deleted",
      hold: 1,
      reason: "external_account_deleted",
    };
  }

  if (external.object === "bank_account") {
    const safe = ["new", "validated", "verified"].includes(external.status);
    return {
      id: external.id,
      type: external.object,
      status: external.status,
      hold: safe ? 0 : 1,
      reason: safe ? "" : `external_bank_account_${external.status || "unconfirmed"}`,
    };
  }

  const card = external as Stripe.Card;
  const availableMethods = card.available_payout_methods ?? [];
  const eventDate = new Date(eventCreated * 1000);
  const notExpired = card.exp_year > eventDate.getUTCFullYear()
    || (
      card.exp_year === eventDate.getUTCFullYear()
      && card.exp_month >= eventDate.getUTCMonth() + 1
    );
  const safe = availableMethods.length > 0 && notExpired;
  return {
    id: card.id,
    type: card.object,
    status: safe ? "available" : notExpired ? "payout_method_unconfirmed" : "expired",
    hold: safe ? 0 : 1,
    reason: safe ? "" : notExpired ? "external_card_unconfirmed" : "external_card_expired",
  };
}

/**
 * Records standard connected-account snapshot events without mixing them with
 * the V2 thin account-requirements endpoint. Older events cannot clear a newer
 * hold; equally timed events can add a hold but cannot clear one.
 */
export async function recordConnectedAccountSnapshotEvent(event: Stripe.Event) {
  const connectedAccountId = stripeObjectId(event.account);
  if (!connectedAccountId) {
    console.warn("Ignoring a connected-account snapshot without event.account", {
      eventId: event.id,
      eventType: event.type,
    });
    return false;
  }

  const db = getDb();
  const [provider] = await db.select({ id: providerApplications.id })
    .from(providerApplications)
    .where(eq(providerApplications.stripeAccountId, connectedAccountId))
    .limit(1);
  if (!provider) {
    console.warn("Ignoring a Stripe snapshot for an unmapped connected account", {
      eventId: event.id,
      eventType: event.type,
      connectedAccountId,
    });
    return false;
  }

  const now = new Date().toISOString();
  if (PAYOUT_EVENT_TYPES.has(event.type)) {
    const payout = event.data.object as Stripe.Payout;
    const unsafe = payout.status === "failed" || payout.status === "canceled";
    const clear = payout.status === "paid";
    const payoutHold = unsafe ? 1 : clear ? 0 : null;
    const payoutHoldReason = unsafe
      ? `payout_${payout.status}${payout.failure_code ? `:${payout.failure_code}` : ""}`
      : clear
        ? ""
        : null;

    await db.insert(stripeConnectedAccountSnapshots).values({
      connectedAccountId,
      providerApplicationId: provider.id,
      livemode: event.livemode ? 1 : 0,
      payoutFailureHold: payoutHold ?? 0,
      payoutHoldReason: payoutHoldReason ?? "",
      lastPayoutId: payout.id,
      lastPayoutStatus: payout.status,
      lastPayoutFailureCode: payout.failure_code ?? "",
      lastPayoutLivemode: event.livemode ? 1 : 0,
      lastPayoutEventCreated: event.created,
      lastPayoutEventId: event.id,
      externalAccountHold: 1,
      externalAccountHoldReason: "no_snapshot",
      updatedAt: now,
    }).onConflictDoUpdate({
      target: stripeConnectedAccountSnapshots.connectedAccountId,
      set: {
        providerApplicationId: provider.id,
        livemode: event.livemode ? 1 : 0,
        payoutFailureHold: sql`CASE
          WHEN excluded.last_payout_event_created < ${stripeConnectedAccountSnapshots.lastPayoutEventCreated}
            THEN ${stripeConnectedAccountSnapshots.payoutFailureHold}
          WHEN excluded.last_payout_event_created = ${stripeConnectedAccountSnapshots.lastPayoutEventCreated}
            AND ${payoutHold ?? 0} = 0
            THEN ${stripeConnectedAccountSnapshots.payoutFailureHold}
          WHEN ${payoutHold === null ? 1 : 0} = 1
            THEN ${stripeConnectedAccountSnapshots.payoutFailureHold}
          ELSE ${payoutHold ?? 0}
        END`,
        payoutHoldReason: sql`CASE
          WHEN excluded.last_payout_event_created < ${stripeConnectedAccountSnapshots.lastPayoutEventCreated}
            THEN ${stripeConnectedAccountSnapshots.payoutHoldReason}
          WHEN excluded.last_payout_event_created = ${stripeConnectedAccountSnapshots.lastPayoutEventCreated}
            AND ${payoutHold ?? 0} = 0
            THEN ${stripeConnectedAccountSnapshots.payoutHoldReason}
          WHEN ${payoutHoldReason === null ? 1 : 0} = 1
            THEN ${stripeConnectedAccountSnapshots.payoutHoldReason}
          ELSE ${payoutHoldReason ?? ""}
        END`,
        lastPayoutId: sql`CASE WHEN excluded.last_payout_event_created >= ${stripeConnectedAccountSnapshots.lastPayoutEventCreated} THEN excluded.last_payout_id ELSE ${stripeConnectedAccountSnapshots.lastPayoutId} END`,
        lastPayoutStatus: sql`CASE WHEN excluded.last_payout_event_created >= ${stripeConnectedAccountSnapshots.lastPayoutEventCreated} THEN excluded.last_payout_status ELSE ${stripeConnectedAccountSnapshots.lastPayoutStatus} END`,
        lastPayoutFailureCode: sql`CASE WHEN excluded.last_payout_event_created >= ${stripeConnectedAccountSnapshots.lastPayoutEventCreated} THEN excluded.last_payout_failure_code ELSE ${stripeConnectedAccountSnapshots.lastPayoutFailureCode} END`,
        lastPayoutLivemode: sql`CASE WHEN excluded.last_payout_event_created >= ${stripeConnectedAccountSnapshots.lastPayoutEventCreated} THEN excluded.last_payout_livemode ELSE ${stripeConnectedAccountSnapshots.lastPayoutLivemode} END`,
        lastPayoutEventCreated: sql`MAX(${stripeConnectedAccountSnapshots.lastPayoutEventCreated}, excluded.last_payout_event_created)`,
        lastPayoutEventId: sql`CASE WHEN excluded.last_payout_event_created >= ${stripeConnectedAccountSnapshots.lastPayoutEventCreated} THEN excluded.last_payout_event_id ELSE ${stripeConnectedAccountSnapshots.lastPayoutEventId} END`,
        updatedAt: now,
      },
    });
    return true;
  }

  if (EXTERNAL_ACCOUNT_EVENT_TYPES.has(event.type)) {
    const external = externalAccountSnapshot(event.data.object, event.type, event.created);
    await db.insert(stripeConnectedAccountSnapshots).values({
      connectedAccountId,
      providerApplicationId: provider.id,
      livemode: event.livemode ? 1 : 0,
      payoutFailureHold: 0,
      externalAccountHold: external.hold,
      externalAccountHoldReason: external.reason,
      lastExternalAccountId: external.id,
      lastExternalAccountType: external.type,
      lastExternalAccountStatus: external.status,
      lastExternalAccountLivemode: event.livemode ? 1 : 0,
      lastExternalAccountEventCreated: event.created,
      lastExternalAccountEventId: event.id,
      updatedAt: now,
    }).onConflictDoUpdate({
      target: stripeConnectedAccountSnapshots.connectedAccountId,
      set: {
        providerApplicationId: provider.id,
        livemode: event.livemode ? 1 : 0,
        externalAccountHold: sql`CASE
          WHEN excluded.last_external_account_event_created < ${stripeConnectedAccountSnapshots.lastExternalAccountEventCreated}
            THEN ${stripeConnectedAccountSnapshots.externalAccountHold}
          WHEN excluded.last_external_account_event_created = ${stripeConnectedAccountSnapshots.lastExternalAccountEventCreated}
            AND excluded.external_account_hold = 0
            THEN ${stripeConnectedAccountSnapshots.externalAccountHold}
          ELSE excluded.external_account_hold
        END`,
        externalAccountHoldReason: sql`CASE
          WHEN excluded.last_external_account_event_created < ${stripeConnectedAccountSnapshots.lastExternalAccountEventCreated}
            THEN ${stripeConnectedAccountSnapshots.externalAccountHoldReason}
          WHEN excluded.last_external_account_event_created = ${stripeConnectedAccountSnapshots.lastExternalAccountEventCreated}
            AND excluded.external_account_hold = 0
            THEN ${stripeConnectedAccountSnapshots.externalAccountHoldReason}
          ELSE excluded.external_account_hold_reason
        END`,
        lastExternalAccountId: sql`CASE WHEN excluded.last_external_account_event_created >= ${stripeConnectedAccountSnapshots.lastExternalAccountEventCreated} THEN excluded.last_external_account_id ELSE ${stripeConnectedAccountSnapshots.lastExternalAccountId} END`,
        lastExternalAccountType: sql`CASE WHEN excluded.last_external_account_event_created >= ${stripeConnectedAccountSnapshots.lastExternalAccountEventCreated} THEN excluded.last_external_account_type ELSE ${stripeConnectedAccountSnapshots.lastExternalAccountType} END`,
        lastExternalAccountStatus: sql`CASE WHEN excluded.last_external_account_event_created >= ${stripeConnectedAccountSnapshots.lastExternalAccountEventCreated} THEN excluded.last_external_account_status ELSE ${stripeConnectedAccountSnapshots.lastExternalAccountStatus} END`,
        lastExternalAccountLivemode: sql`CASE WHEN excluded.last_external_account_event_created >= ${stripeConnectedAccountSnapshots.lastExternalAccountEventCreated} THEN excluded.last_external_account_livemode ELSE ${stripeConnectedAccountSnapshots.lastExternalAccountLivemode} END`,
        lastExternalAccountEventCreated: sql`MAX(${stripeConnectedAccountSnapshots.lastExternalAccountEventCreated}, excluded.last_external_account_event_created)`,
        lastExternalAccountEventId: sql`CASE WHEN excluded.last_external_account_event_created >= ${stripeConnectedAccountSnapshots.lastExternalAccountEventCreated} THEN excluded.last_external_account_event_id ELSE ${stripeConnectedAccountSnapshots.lastExternalAccountEventId} END`,
        updatedAt: now,
      },
    });
    return true;
  }

  return false;
}

export async function connectedAccountPayoutSafety(connectedAccountId: string) {
  const [snapshot] = await getDb().select().from(stripeConnectedAccountSnapshots)
    .where(eq(stripeConnectedAccountSnapshots.connectedAccountId, connectedAccountId))
    .limit(1);
  if (!snapshot) {
    return {
      allowed: false,
      reasons: ["No signed Stripe payout-account snapshot has been recorded."],
    };
  }

  const reasons: string[] = [];
  if (snapshot.payoutFailureHold) {
    reasons.push("Stripe reported a failed or canceled provider payout that requires review.");
  }
  if (snapshot.externalAccountHold) {
    reasons.push("The provider's Stripe external payout account is missing, changed, expired, or requires review.");
  }
  const expectedLivemode = stripeLiveModeEnabled() ? 1 : 0;
  if (
    snapshot.lastPayoutEventCreated > 0
    && snapshot.lastPayoutLivemode !== expectedLivemode
  ) {
    reasons.push("The recorded Stripe payout snapshot does not match the current payment mode.");
  }
  if (
    snapshot.lastExternalAccountEventCreated > 0
    && snapshot.lastExternalAccountLivemode !== expectedLivemode
  ) {
    reasons.push("The recorded Stripe external-account snapshot does not match the current payment mode.");
  }
  return { allowed: reasons.length === 0, reasons };
}
