import { and, asc, eq, gt, inArray, lte, or } from "drizzle-orm";
import type Stripe from "stripe";
import { getDb } from "../db";
import { stripePayments } from "../db/schema";
import { getStripeClient } from "./stripe";

export function stripeObjectId(
  value: string | { id: string } | null | undefined,
) {
  return typeof value === "string" ? value : value?.id ?? "";
}

const REFUND_HOLD_PAYMENT_STATUSES = new Set([
  "refund_pending",
  "refund_requires_action",
  "refund_failed_review",
  "refund_canceled_review",
  "refund_status_review",
]);

function destinationTransferId(charge: Stripe.Charge | null) {
  if (!charge?.transfer) return "";
  return typeof charge.transfer === "string"
    ? charge.transfer
    : charge.transfer.id;
}

export async function expireOpenCheckoutSessionsForLaunchShutdown() {
  const db = getDb();
  const result = {
    examined: 0,
    expired: 0,
    alreadyFinal: 0,
    failed: 0,
  };
  let stripeClient: Stripe | null = null;
  let stripeUnavailable = false;
  let cursor = "";

  while (true) {
    const openPayments = await db.select({
      id: stripePayments.id,
      checkoutSessionId: stripePayments.checkoutSessionId,
    }).from(stripePayments)
      .where(cursor
        ? and(
            inArray(stripePayments.status, [
              "checkout_creating",
              "checkout_open",
              "checkout_release_recheck",
              "checkout_expiration_unconfirmed",
            ]),
            gt(stripePayments.id, cursor),
          )
        : inArray(stripePayments.status, [
            "checkout_creating",
            "checkout_open",
            "checkout_release_recheck",
            "checkout_expiration_unconfirmed",
          ]))
      .orderBy(asc(stripePayments.id))
      .limit(100);
    if (openPayments.length === 0) break;

    result.examined += openPayments.length;

    for (const payment of openPayments) {
      cursor = payment.id;
      const quarantined = await db.update(stripePayments).set({
        status: "checkout_expiration_unconfirmed",
        updatedAt: new Date().toISOString(),
      }).where(and(
        eq(stripePayments.id, payment.id),
        inArray(stripePayments.status, [
          "checkout_creating",
          "checkout_open",
          "checkout_release_recheck",
          "checkout_expiration_unconfirmed",
        ]),
      )).returning({ id: stripePayments.id });
      if (!quarantined.length) {
        result.alreadyFinal += 1;
        continue;
      }
      if (!payment.checkoutSessionId) {
        result.failed += 1;
        continue;
      }
      if (!stripeClient && !stripeUnavailable) {
        try {
          stripeClient = getStripeClient();
        } catch (error) {
          stripeUnavailable = true;
          console.error("Unable to initialize Stripe for launch-shutdown cleanup", error);
        }
      }
      if (!stripeClient) {
        result.failed += 1;
        continue;
      }
      try {
        const session = await stripeClient.checkout.sessions.retrieve(
          payment.checkoutSessionId,
        );
        if (session.status === "open") {
          await stripeClient.checkout.sessions.expire(session.id);
        }
        if (session.status === "open" || session.status === "expired") {
          await db.update(stripePayments).set({
            status: "checkout_expired_launch_readiness",
            updatedAt: new Date().toISOString(),
          }).where(and(
            eq(stripePayments.id, payment.id),
            eq(stripePayments.status, "checkout_expiration_unconfirmed"),
          ));
          result.expired += 1;
        } else {
          // A completed Session remains open locally until the normal Stripe
          // reconciliation path verifies its payment state and exact scope.
          result.alreadyFinal += 1;
        }
      } catch (error) {
        result.failed += 1;
        console.error("Unable to expire Checkout Session after launch shutdown", {
          paymentId: payment.id,
          error,
        });
      }
    }

    if (openPayments.length < 100) break;
  }
  return result;
}

/**
 * Applies a successful hosted Checkout result to the local payment record.
 * Stripe remains the source of truth: the server verifies amount, currency,
 * PaymentIntent status, and charge ID before changing local state.
 */
export async function recordPaidCheckoutSession(
  stripeClient: Stripe,
  session: Stripe.Checkout.Session,
) {
  const paymentRecordId = session.metadata?.tuveloz_payment_record_id ?? "";
  if (!paymentRecordId) {
    console.warn("Ignoring a Checkout Session without Tuveloz payment metadata", {
      sessionId: session.id,
    });
    return;
  }

  const [payment] = await getDb().select().from(stripePayments)
    .where(eq(stripePayments.id, paymentRecordId))
    .limit(1);
  if (!payment) {
    console.warn("Ignoring a Checkout Session with an unknown payment record", {
      sessionId: session.id,
      paymentRecordId,
    });
    return;
  }

  const launchReadinessHold = payment.status === "checkout_release_recheck"
    || payment.status === "checkout_expiration_unconfirmed";
  if (
    (payment.status !== "checkout_open" && !launchReadinessHold)
    || payment.checkoutSessionId !== session.id
    || (
      payment.paymentType === "quote"
      && (
        session.metadata?.tuveloz_request_id !== payment.requestId
        || session.metadata?.tuveloz_quote_id !== payment.quoteId
        || session.metadata?.tuveloz_scope_version !== String(payment.scopeVersion)
        || session.metadata?.tuveloz_scope_authorization_id
          !== payment.scopeAuthorizationDecisionId
      )
    )
  ) {
    console.warn("Ignoring a paid Checkout Session whose local scope binding is no longer current", {
      paymentRecordId,
      sessionId: session.id,
      localStatus: payment.status,
    });
    return;
  }

  if (
    session.payment_status !== "paid"
    || session.amount_total !== payment.customerTotalCents
    || session.currency !== payment.currency
  ) {
    console.error("Stripe Checkout amount or status did not match Tuveloz", {
      paymentRecordId,
      sessionId: session.id,
      paymentStatus: session.payment_status,
      amountTotal: session.amount_total,
      expectedAmount: payment.customerTotalCents,
      currency: session.currency,
      expectedCurrency: payment.currency,
    });
    return;
  }

  const paymentIntentId = stripeObjectId(session.payment_intent);
  if (!paymentIntentId) {
    console.error("Paid Checkout Session has no PaymentIntent", {
      paymentRecordId,
      sessionId: session.id,
    });
    return;
  }

  // Expanding latest_charge gives the source charge needed for a delayed
  // separate transfer after a quote-based job is completed.
  const paymentIntent = await stripeClient.paymentIntents.retrieve(
    paymentIntentId,
    { expand: ["latest_charge"] },
  );
  const charge = paymentIntent.latest_charge
    && typeof paymentIntent.latest_charge !== "string"
    ? paymentIntent.latest_charge
    : null;
  if (
    paymentIntent.status !== "succeeded"
    || paymentIntent.amount_received !== payment.customerTotalCents
    || !charge
  ) {
    console.error("Stripe PaymentIntent did not match the paid Checkout Session", {
      paymentRecordId,
      paymentIntentId,
      paymentIntentStatus: paymentIntent.status,
      amountReceived: paymentIntent.amount_received,
    });
    return;
  }

  const nextStatus = launchReadinessHold
    ? "paid_launch_readiness_hold"
    : payment.refundAmountCents > 0
        || payment.disputeStatus
        || REFUND_HOLD_PAYMENT_STATUSES.has(payment.status)
      ? payment.status
      : payment.settlementStrategy === "destination_charge"
        ? "paid_and_transferred"
        : "paid_pending_completion";

  // A completion status never makes money releasable by itself. Separate
  // transfers remain pending until the release endpoint rechecks stage
  // eligibility, invoice/authorization parity, incidents, cancellations,
  // refunds, disputes, reserves, and the provider timer.

  const now = new Date().toISOString();
  await getDb().update(stripePayments).set({
    checkoutSessionId: session.id,
    paymentIntentId,
    chargeId: charge.id,
    transferId: payment.settlementStrategy === "destination_charge"
      ? destinationTransferId(charge) || payment.transferId
      : payment.transferId,
    customerEmail:
      session.customer_details?.email
      || session.customer_email
      || payment.customerEmail,
    status: nextStatus,
    paidAt: payment.paidAt || now,
    updatedAt: now,
  }).where(eq(stripePayments.id, payment.id));
}

const CHECKOUT_FAILURE_MUTABLE_STATUSES = new Set([
  "checkout_creating",
  "checkout_open",
  "checkout_release_recheck",
  "checkout_expiration_unconfirmed",
]);

export async function recordCheckoutSessionStatus(
  session: Stripe.Checkout.Session,
  status: "checkout_expired" | "payment_failed",
) {
  const paymentRecordId = session.metadata?.tuveloz_payment_record_id ?? "";
  if (!paymentRecordId) return;

  const [payment] = await getDb().select({
    id: stripePayments.id,
    status: stripePayments.status,
  }).from(stripePayments)
    .where(eq(stripePayments.id, paymentRecordId))
    .limit(1);
  if (!payment) return;

  // Stripe may deliver webhooks more than once or out of order. An old
  // expiration/failure event must never replace a successful, refunded, or
  // disputed payment state.
  if (!CHECKOUT_FAILURE_MUTABLE_STATUSES.has(payment.status)) {
    console.warn("Ignoring a late Checkout failure status", {
      paymentRecordId,
      currentStatus: payment.status,
      ignoredStatus: status,
    });
    return;
  }

  await getDb().update(stripePayments).set({
    status,
    updatedAt: new Date().toISOString(),
  }).where(eq(stripePayments.id, payment.id));
}

async function paymentForStripeObject(
  chargeId: string,
  paymentIntentId: string,
) {
  if (!chargeId && !paymentIntentId) return null;
  const condition = chargeId && paymentIntentId
    ? or(
        eq(stripePayments.chargeId, chargeId),
        eq(stripePayments.paymentIntentId, paymentIntentId),
      )
    : chargeId
      ? eq(stripePayments.chargeId, chargeId)
      : eq(stripePayments.paymentIntentId, paymentIntentId);
  const [payment] = await getDb().select().from(stripePayments)
    .where(condition)
    .limit(1);
  return payment ?? null;
}

function paymentStatusAfterRefundedCharge(
  payment: typeof stripePayments.$inferSelect,
  charge: Stripe.Charge,
) {
  if (payment.disputeStatus || REFUND_HOLD_PAYMENT_STATUSES.has(payment.status)) {
    return payment.status;
  }
  if (charge.amount_refunded <= 0) return payment.status;
  return charge.refunded ? "refunded" : "partially_refunded";
}

export async function recordRefundedCharge(
  stripeClient: Stripe,
  eventCharge: Stripe.Charge,
) {
  // Re-read Stripe instead of trusting a potentially delayed snapshot. This
  // prevents an old charge.refunded delivery from reducing a newer hold.
  const charge = await stripeClient.charges.retrieve(eventCharge.id);
  const payment = await paymentForStripeObject(
    charge.id,
    stripeObjectId(charge.payment_intent),
  );
  if (!payment) {
    console.warn("Ignoring a refunded charge without a Tuveloz payment record", {
      chargeId: charge.id,
    });
    return;
  }

  const now = new Date().toISOString();
  await getDb().update(stripePayments).set({
    refundAmountCents: charge.amount_refunded,
    refundedAt: charge.amount_refunded > 0
      ? payment.refundedAt || now
      : "",
    status: paymentStatusAfterRefundedCharge(payment, charge),
    updatedAt: now,
  }).where(eq(stripePayments.id, payment.id));
}

function refundPaymentStatus(
  payment: typeof stripePayments.$inferSelect,
  refund: Stripe.Refund,
  charge: Stripe.Charge,
) {
  if (payment.disputeStatus) return payment.status;
  switch (refund.status) {
    case "succeeded":
      return charge.refunded ? "refunded" : "partially_refunded";
    case "pending":
      return "refund_pending";
    case "requires_action":
      return "refund_requires_action";
    case "failed":
      return "refund_failed_review";
    case "canceled":
      return "refund_canceled_review";
    default:
      return "refund_status_review";
  }
}

/**
 * Reconciles the current Refund and Charge after refund.created,
 * refund.updated, refund.failed, or the legacy charge.refund.updated event.
 * Every non-succeeded asynchronous state places a release hold.
 */
export async function recordRefundStatus(
  stripeClient: Stripe,
  eventRefund: Stripe.Refund,
  eventId: string,
  eventCreated: number,
) {
  const refund = await stripeClient.refunds.retrieve(eventRefund.id);
  const chargeId = stripeObjectId(refund.charge) || stripeObjectId(eventRefund.charge);
  if (!chargeId) {
    console.warn("Ignoring a refund without a Stripe Charge", {
      eventId,
      refundId: refund.id,
    });
    return;
  }
  const charge = await stripeClient.charges.retrieve(chargeId);
  const payment = await paymentForStripeObject(
    charge.id,
    stripeObjectId(charge.payment_intent) || stripeObjectId(refund.payment_intent),
  );
  if (!payment) {
    console.warn("Ignoring a refund without a Tuveloz payment record", {
      eventId,
      refundId: refund.id,
      chargeId,
    });
    return;
  }
  if (eventCreated < payment.lastRefundEventCreated) {
    console.warn("Ignoring an older Stripe refund event", {
      eventId,
      refundId: refund.id,
      eventCreated,
      lastRefundEventCreated: payment.lastRefundEventCreated,
    });
    return;
  }

  const nextStatus = refundPaymentStatus(payment, refund, charge);
  if (
    eventCreated === payment.lastRefundEventCreated
    && REFUND_HOLD_PAYMENT_STATUSES.has(payment.status)
    && !REFUND_HOLD_PAYMENT_STATUSES.has(nextStatus)
  ) {
    // Stripe event timestamps have one-second precision. An equally timed safe
    // event cannot clear an already-recorded adverse refund state.
    return;
  }

  const now = new Date().toISOString();
  await getDb().update(stripePayments).set({
    refundAmountCents: charge.amount_refunded,
    refundedAt: charge.amount_refunded > 0 ? payment.refundedAt || now : "",
    refundStatus: refund.status ?? "unknown",
    refundUpdatedAt: now,
    refundFailureReason: refund.failure_reason?.slice(0, 120) ?? "",
    lastRefundId: refund.id,
    lastRefundEventCreated: eventCreated,
    lastRefundEventId: eventId,
    status: nextStatus,
    updatedAt: now,
  }).where(and(
    eq(stripePayments.id, payment.id),
    lte(stripePayments.lastRefundEventCreated, eventCreated),
  ));
}

export async function recordDisputeStatus(
  stripeClient: Stripe,
  eventDispute: Stripe.Dispute,
  eventId: string,
  eventCreated: number,
) {
  // Re-read the dispute so delayed created/updated/funds events converge on
  // Stripe's current status rather than regressing local state.
  const dispute = await stripeClient.disputes.retrieve(eventDispute.id);
  const payment = await paymentForStripeObject(
    stripeObjectId(dispute.charge),
    stripeObjectId(dispute.payment_intent),
  );
  if (!payment) {
    console.warn("Ignoring a dispute without a Tuveloz payment record", {
      disputeId: dispute.id,
    });
    return;
  }
  if (eventCreated < payment.lastDisputeEventCreated) {
    console.warn("Ignoring an older Stripe dispute event", {
      eventId,
      disputeId: dispute.id,
      eventCreated,
      lastDisputeEventCreated: payment.lastDisputeEventCreated,
    });
    return;
  }

  const now = new Date().toISOString();
  const status = dispute.status === "won"
    ? "dispute_won_review"
    : dispute.status === "lost"
      ? "dispute_lost"
      : "disputed";
  await getDb().update(stripePayments).set({
    disputeStatus: dispute.status,
    disputeUpdatedAt: now,
    lastDisputeId: dispute.id,
    lastDisputeEventCreated: eventCreated,
    lastDisputeEventId: eventId,
    status,
    updatedAt: now,
  }).where(and(
    eq(stripePayments.id, payment.id),
    lte(stripePayments.lastDisputeEventCreated, eventCreated),
  ));
}

export function publicPaymentSummary(
  payment: typeof stripePayments.$inferSelect | undefined,
) {
  if (!payment) return null;
  return {
    id: payment.id,
    paymentType: payment.paymentType,
    scopeVersion: payment.scopeVersion,
    productName: payment.productName,
    currency: payment.currency,
    quantity: payment.quantity,
    providerAmountCents: payment.providerAmountCents,
    applicationFeeCents: payment.applicationFeeCents,
    customerTotalCents: payment.customerTotalCents,
    status: payment.status,
    paidAt: payment.paidAt,
    releasedAt: payment.releasedAt,
    refundAmountCents: payment.refundAmountCents,
    refundedAt: payment.refundedAt,
    refundStatus: payment.refundStatus,
    disputeStatus: payment.disputeStatus,
  };
}
