import { desc, eq } from "drizzle-orm";
import { getDb } from "../../../../../db";
import {
  accountCredentials,
  customerProfiles,
  customerRequests,
  providerApplications,
  stripePayments,
} from "../../../../../db/schema";
import { isSameOriginRequest } from "../../../../../lib/account-auth";
import {
  getAuthenticatedEmail,
  isVerifiedOwnerRequest,
} from "../../../../../lib/owner-auth";
import {
  getStripeClient,
  retrieveRecipientAccountStatus,
  stripeErrorResponse,
} from "../../../../../lib/stripe";

export async function GET(request: Request) {
  if (!(await isVerifiedOwnerRequest(request))) {
    return Response.json({ error: "Owner access required." }, { status: 403 });
  }

  const payments = await getDb().select({
    id: stripePayments.id,
    paymentType: stripePayments.paymentType,
    requestId: stripePayments.requestId,
    quoteId: stripePayments.quoteId,
    productName: stripePayments.productName,
    providerName: providerApplications.name,
    customerEmail: stripePayments.customerEmail,
    customerAccountEmail: accountCredentials.email,
    customerDisplayName: customerProfiles.displayName,
    currency: stripePayments.currency,
    quantity: stripePayments.quantity,
    providerAmountCents: stripePayments.providerAmountCents,
    applicationFeeCents: stripePayments.applicationFeeCents,
    customerTotalCents: stripePayments.customerTotalCents,
    settlementStrategy: stripePayments.settlementStrategy,
    status: stripePayments.status,
    jobStatus: customerRequests.status,
    checkoutSessionId: stripePayments.checkoutSessionId,
    paymentIntentId: stripePayments.paymentIntentId,
    transferId: stripePayments.transferId,
    paidAt: stripePayments.paidAt,
    releasedAt: stripePayments.releasedAt,
    releasedBy: stripePayments.releasedBy,
    refundAmountCents: stripePayments.refundAmountCents,
    refundedAt: stripePayments.refundedAt,
    disputeStatus: stripePayments.disputeStatus,
    disputeUpdatedAt: stripePayments.disputeUpdatedAt,
    createdAt: stripePayments.createdAt,
  }).from(stripePayments)
    .leftJoin(
      providerApplications,
      eq(providerApplications.id, stripePayments.providerApplicationId),
    )
    .leftJoin(
      customerRequests,
      eq(customerRequests.id, stripePayments.requestId),
    )
    .leftJoin(
      accountCredentials,
      eq(accountCredentials.email, stripePayments.customerEmail),
    )
    .leftJoin(
      customerProfiles,
      eq(customerProfiles.email, stripePayments.customerEmail),
    )
    .orderBy(desc(stripePayments.createdAt))
    .limit(100);

  return Response.json({
    payments: payments.map((payment) => {
      const { customerAccountEmail, ...safePayment } = payment;
      const readyAfterCompletion =
        payment.settlementStrategy === "separate_transfer"
        && payment.status === "paid_pending_completion"
        && payment.refundAmountCents === 0
        && !payment.disputeStatus
        && payment.jobStatus === "completed";
      return {
        ...safePayment,
        customerHasAccount: Boolean(customerAccountEmail),
        status: readyAfterCompletion ? "ready_for_release" : payment.status,
        canRelease:
          payment.settlementStrategy === "separate_transfer"
          && payment.jobStatus === "completed"
          && payment.refundAmountCents === 0
          && !payment.disputeStatus
          && (payment.status === "paid_pending_completion"
            || payment.status === "ready_for_release"),
      };
    }),
  });
}

export async function POST(request: Request) {
  if (!(await isVerifiedOwnerRequest(request))) {
    return Response.json({ error: "Owner access required." }, { status: 403 });
  }
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "Cross-origin transfer release is not allowed." }, { status: 403 });
  }

  const body = (await request.json()) as { paymentId?: unknown };
  const paymentId = typeof body.paymentId === "string"
    ? body.paymentId.trim().slice(0, 120)
    : "";
  if (!paymentId) {
    return Response.json({ error: "Choose a payment to release." }, { status: 400 });
  }

  const [payment] = await getDb().select().from(stripePayments)
    .where(eq(stripePayments.id, paymentId))
    .limit(1);
  if (!payment) {
    return Response.json({ error: "Payment record not found." }, { status: 404 });
  }
  if (payment.transferId || payment.status === "released") {
    return Response.json({
      ok: true,
      alreadyReleased: true,
      transferId: payment.transferId,
      releasedAt: payment.releasedAt,
    });
  }
  if (
    payment.settlementStrategy !== "separate_transfer"
    || !payment.requestId
    || !payment.paymentIntentId
  ) {
    return Response.json(
      { error: "This payment does not use the completion-release flow." },
      { status: 409 },
    );
  }

  const [job] = await getDb().select({ status: customerRequests.status })
    .from(customerRequests)
    .where(eq(customerRequests.id, payment.requestId))
    .limit(1);
  if (job?.status !== "completed") {
    return Response.json(
      { error: "The provider must mark the job completed before funds can be released." },
      { status: 409 },
    );
  }
  if (
    payment.status !== "paid_pending_completion"
    && payment.status !== "ready_for_release"
  ) {
    return Response.json(
      { error: "Stripe has not confirmed a successful customer payment." },
      { status: 409 },
    );
  }
  if (payment.refundAmountCents > 0 || payment.disputeStatus) {
    return Response.json(
      { error: "A refunded or disputed payment cannot be released." },
      { status: 409 },
    );
  }

  try {
    const stripeClient = getStripeClient();
    const accountStatus = await retrieveRecipientAccountStatus(
      stripeClient,
      payment.connectedAccountId,
    );
    if (!accountStatus.readyToReceivePayments) {
      return Response.json(
        { error: "The connected account cannot receive transfers right now." },
        { status: 409 },
      );
    }

    // Re-read the PaymentIntent at release time. The stored IDs help locate it,
    // but Stripe's succeeded state and amount are the final authority.
    const paymentIntent = await stripeClient.paymentIntents.retrieve(
      payment.paymentIntentId,
      { expand: ["latest_charge"] },
    );
    const charge = paymentIntent.latest_charge
      && typeof paymentIntent.latest_charge !== "string"
      ? paymentIntent.latest_charge
      : null;
    const chargeId = charge?.id ?? "";
    if (
      paymentIntent.status !== "succeeded"
      || paymentIntent.amount_received !== payment.customerTotalCents
      || !chargeId
      || charge.refunded
      || charge.amount_refunded > 0
      || charge.disputed
      || paymentIntent.metadata.tuveloz_payment_record_id !== payment.id
    ) {
      return Response.json(
        { error: "Stripe payment verification failed; no transfer was created." },
        { status: 409 },
      );
    }

    // source_transaction ties the transfer to the customer's successful charge.
    // The idempotency key prevents two owner clicks from paying twice.
    const transfer = await stripeClient.transfers.create(
      {
        amount: payment.providerAmountCents,
        currency: payment.currency,
        destination: payment.connectedAccountId,
        source_transaction: chargeId,
        transfer_group: payment.transferGroup ?? undefined,
        metadata: {
          tuveloz_payment_record_id: payment.id,
          tuveloz_request_id: payment.requestId,
          ...(payment.quoteId ? { tuveloz_quote_id: payment.quoteId } : {}),
        },
      },
      {
        idempotencyKey: `tuveloz-release-${payment.id}`,
      },
    );

    const releasedAt = new Date().toISOString();
    await getDb().update(stripePayments).set({
      chargeId,
      transferId: transfer.id,
      status: "released",
      releasedAt,
      releasedBy: getAuthenticatedEmail(request),
      updatedAt: releasedAt,
    }).where(eq(stripePayments.id, payment.id));

    return Response.json({
      ok: true,
      transferId: transfer.id,
      releasedAt,
    });
  } catch (error) {
    return stripeErrorResponse(error, "Unable to release the provider transfer.");
  }
}
