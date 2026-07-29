import { eq, or } from "drizzle-orm";
import type Stripe from "stripe";
import { getDb } from "../db";
import { customerRequests, stripePayments } from "../db/schema";

export function stripeObjectId(
  value: string | { id: string } | null | undefined,
) {
  return typeof value === "string" ? value : value?.id ?? "";
}

function destinationTransferId(charge: Stripe.Charge | null) {
  if (!charge?.transfer) return "";
  return typeof charge.transfer === "string"
    ? charge.transfer
    : charge.transfer.id;
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

  let nextStatus = payment.refundAmountCents > 0 || payment.disputeStatus
    ? payment.status
    : payment.settlementStrategy === "destination_charge"
      ? "paid_and_transferred"
      : "paid_pending_completion";

  if (
    !payment.disputeStatus
    && payment.refundAmountCents === 0
    && payment.requestId
    && payment.settlementStrategy === "separate_transfer"
  ) {
    const [job] = await getDb().select({ status: customerRequests.status })
      .from(customerRequests)
      .where(eq(customerRequests.id, payment.requestId))
      .limit(1);
    if (job?.status === "completed") nextStatus = "ready_for_release";
  }

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

export async function recordRefundedCharge(charge: Stripe.Charge) {
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
    status: charge.refunded ? "refunded" : "partially_refunded",
    updatedAt: now,
  }).where(eq(stripePayments.id, payment.id));
}

export async function recordDisputeStatus(dispute: Stripe.Dispute) {
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

  const now = new Date().toISOString();
  const status = dispute.status === "won"
    ? "dispute_won_review"
    : dispute.status === "lost"
      ? "dispute_lost"
      : "disputed";
  await getDb().update(stripePayments).set({
    disputeStatus: dispute.status,
    disputeUpdatedAt: now,
    status,
    updatedAt: now,
  }).where(eq(stripePayments.id, payment.id));
}

export function publicPaymentSummary(
  payment: typeof stripePayments.$inferSelect | undefined,
) {
  if (!payment) return null;
  return {
    id: payment.id,
    paymentType: payment.paymentType,
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
    disputeStatus: payment.disputeStatus,
  };
}
