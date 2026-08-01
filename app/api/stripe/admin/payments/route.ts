import { and, desc, eq, sql } from "drizzle-orm";
import { getDb } from "../../../../../db";
import {
  accountCredentials,
  customerProfiles,
  customerRequests,
  jobCancellations,
  jobChangeOrders,
  jobIncidents,
  jobScopeVersions,
  paymentAdjustments,
  providerApplications,
  providerInvoices,
  providerJobRecords,
  stripeConnectedAccountSnapshots,
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
import {
  marketplacePausedMessage,
} from "../../../../../lib/launch-status";
import { runtimeMarketplaceActionAllowed } from "../../../../../lib/runtime-marketplace-action";
import { runtimeRealMarketplaceReleaseDecision } from "../../../../../lib/runtime-launch-readiness";
import {
  appendJobLifecycleEvent,
  assessPayoutReadiness,
  evaluateAssignedJobStage,
  jobAuthorizationDecisionMatchesContext,
} from "../../../../../lib/job-operations";
import { connectedAccountPayoutSafety } from "../../../../../lib/stripe-connected-account-snapshots";

function marketplacePausedResponse() {
  return Response.json(
    {
      error: marketplacePausedMessage("payout"),
      code: "MARKETPLACE_ONBOARDING_ONLY",
    },
    {
      status: 503,
      headers: { "cache-control": "no-store", "retry-after": "86400" },
    },
  );
}

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
    refundStatus: stripePayments.refundStatus,
    refundUpdatedAt: stripePayments.refundUpdatedAt,
    refundFailureReason: stripePayments.refundFailureReason,
    disputeStatus: stripePayments.disputeStatus,
    disputeUpdatedAt: stripePayments.disputeUpdatedAt,
    connectedAccountSnapshotId:
      stripeConnectedAccountSnapshots.connectedAccountId,
    payoutFailureHold: stripeConnectedAccountSnapshots.payoutFailureHold,
    payoutHoldReason: stripeConnectedAccountSnapshots.payoutHoldReason,
    externalAccountHold: stripeConnectedAccountSnapshots.externalAccountHold,
    externalAccountHoldReason:
      stripeConnectedAccountSnapshots.externalAccountHoldReason,
    lastPayoutStatus: stripeConnectedAccountSnapshots.lastPayoutStatus,
    lastExternalAccountStatus:
      stripeConnectedAccountSnapshots.lastExternalAccountStatus,
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
      sql`lower(${accountCredentials.email}) = lower(${stripePayments.customerEmail})`,
    )
    .leftJoin(
      customerProfiles,
      sql`lower(${customerProfiles.email}) = lower(${stripePayments.customerEmail})`,
    )
    .leftJoin(
      stripeConnectedAccountSnapshots,
      eq(
        stripeConnectedAccountSnapshots.connectedAccountId,
        stripePayments.connectedAccountId,
      ),
    )
    .orderBy(desc(stripePayments.createdAt))
    .limit(100);

  return Response.json({
    payments: payments.map((payment) => {
      const { customerAccountEmail, ...safePayment } = payment;
      return {
        ...safePayment,
        customerHasAccount: Boolean(customerAccountEmail),
        // Completion is only one prerequisite. The POST release endpoint is
        // the authority for eligibility, invoice, incident, cancellation,
        // refund, dispute, reserve, and timer checks.
        canRelease: false,
        releaseReviewRequired: payment.settlementStrategy === "separate_transfer"
          && payment.status === "paid_pending_completion",
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

  const [job] = await getDb().select({
    status: customerRequests.status,
    isTestJob: customerRequests.isTestJob,
  })
    .from(customerRequests)
    .where(eq(customerRequests.id, payment.requestId))
    .limit(1);
  if (job?.status !== "completed") {
    return Response.json(
      { error: "The provider must mark the job completed before funds can be released." },
      { status: 409 },
    );
  }
  // Test jobs never create Stripe payments. Real money movement also remains
  // code-blocked in onboarding-only mode, before any Stripe API mutation.
  if (job.isTestJob === "yes") {
    return Response.json(
      { error: "A test job must never have a Stripe payment or transfer." },
      { status: 409 },
    );
  }
  if (!(await runtimeMarketplaceActionAllowed("payout", { testOnly: false }))) {
    return marketplacePausedResponse();
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
  const connectedAccountSafety = await connectedAccountPayoutSafety(
    payment.connectedAccountId,
  );
  if (!connectedAccountSafety.allowed) {
    return Response.json({
      error: connectedAccountSafety.reasons[0]
        || "The provider payout account requires review.",
      code: "STRIPE_CONNECTED_ACCOUNT_PAYOUT_HOLD",
      reasons: connectedAccountSafety.reasons,
    }, { status: 409, headers: { "cache-control": "no-store" } });
  }

  const stageDecision = await evaluateAssignedJobStage({
    requestId: payment.requestId,
    stage: "payout",
    effectiveAt: new Date().toISOString(),
  });
  if (!stageDecision.allowed || !stageDecision.result?.decisionId || !stageDecision.context) {
    return Response.json({
      error: stageDecision.error,
      code: "PAYOUT_ELIGIBILITY_DENIED",
      reasons: stageDecision.result?.reasons ?? [],
    }, { status: stageDecision.status, headers: { "cache-control": "no-store" } });
  }
  const context = stageDecision.context;
  const db = getDb();
  const [authorizedScope] = await db.select({
    authorizationDecisionId: jobScopeVersions.authorizationDecisionId,
    priceBreakdown: jobScopeVersions.priceBreakdown,
  }).from(jobScopeVersions).where(and(
    eq(jobScopeVersions.requestId, payment.requestId),
    eq(jobScopeVersions.quoteId, context.quoteId),
    eq(jobScopeVersions.version, context.scopeVersion),
  )).limit(1);
  if (
    !authorizedScope
    || payment.scopeVersion !== context.scopeVersion
    || payment.scopeAuthorizationDecisionId !== authorizedScope.authorizationDecisionId
    || payment.authorizedPriceSnapshot !== authorizedScope.priceBreakdown
  ) {
    return Response.json({
      error: "The paid amount is not bound to the current customer-authorized scope and price snapshot.",
      code: "PAYOUT_SCOPE_PAYMENT_SNAPSHOT_MISMATCH",
    }, { status: 409, headers: { "cache-control": "no-store" } });
  }
  const [jobRecord] = await db.select().from(providerJobRecords)
    .where(and(
      eq(providerJobRecords.requestId, payment.requestId),
      eq(providerJobRecords.providerEmail, context.providerEmail),
    )).limit(1);
  const [finalInvoice] = await db.select().from(providerInvoices)
    .where(and(
      eq(providerInvoices.requestId, payment.requestId),
      eq(providerInvoices.scopeVersion, context.scopeVersion),
    )).limit(1);
  const [incidents, cancellations, changes, adjustments] = await Promise.all([
    db.select().from(jobIncidents).where(eq(jobIncidents.requestId, payment.requestId)),
    db.select().from(jobCancellations).where(eq(jobCancellations.requestId, payment.requestId)),
    db.select().from(jobChangeOrders).where(eq(jobChangeOrders.requestId, payment.requestId)),
    db.select().from(paymentAdjustments).where(eq(paymentAdjustments.requestId, payment.requestId)),
  ]);
  const [actualStartCurrent, completionCurrent] = await Promise.all([
    jobAuthorizationDecisionMatchesContext(
      context,
      jobRecord?.jobStartDecisionId || "",
      "job_start",
    ),
    jobAuthorizationDecisionMatchesContext(
      context,
      jobRecord?.completionDecisionId || "",
      "completion",
    ),
  ]);
  const readiness = assessPayoutReadiness({
    jobCompleted: job.status === "completed"
      && jobRecord?.workStatus === "completed"
      && actualStartCurrent,
    completionDecisionId: completionCurrent
      ? jobRecord?.completionDecisionId || ""
      : "",
    finalInvoiceStatus: finalInvoice?.status || "",
    finalInvoiceTotalCents: finalInvoice?.totalAmountCents ?? -1,
    // The paid provider amount is the maximum releasable authorization. A
    // changed invoice requires a separately approved payment flow.
    authorizedTotalCents: payment.providerAmountCents,
    openIncidentCount: incidents.filter((item) => (
      ["open", "under_review", "insurer_review"].includes(item.status)
      || item.holdPayments === "yes"
    )).length,
    openClaimCount: incidents.filter((item) => (
      ["injury", "property_damage", "service_quality_claim"].includes(item.incidentType)
      && item.status !== "resolved"
    )).length,
    unresolvedCancellationCount: cancellations.filter((item) => (
      ["submitted", "under_review"].includes(item.status)
    )).length,
    unauthorizedChangeOrderCount: changes.filter((item) => item.status === "pending_customer").length,
    pendingRefundCount: adjustments.filter((item) => (
      ["refund_request", "cancellation_refund"].includes(item.adjustmentType)
      && ["requested", "under_review"].includes(item.status)
    )).length,
    approvedRefundAmountCents: payment.refundAmountCents + adjustments.filter((item) => (
      ["refund_request", "cancellation_refund"].includes(item.adjustmentType)
      && ["approved", "approved_test_only"].includes(item.status)
    )).reduce((sum, item) => sum + item.amountCents, 0),
    openDisputeCount: (payment.disputeStatus ? 1 : 0) + adjustments.filter((item) => (
      item.adjustmentType === "dispute" && item.status === "active"
    )).length,
    activeReserveAmountCents: adjustments.filter((item) => (
      item.adjustmentType === "reserve" && item.status === "active"
    )).reduce((sum, item) => sum + item.amountCents, 0),
    providerTimerRunning: Boolean(jobRecord?.timerStartedAt),
  });
  if (!readiness.allowed) {
    return Response.json({
      error: readiness.reasons[0] || "Payout release controls did not pass.",
      code: "PAYOUT_OPERATIONAL_HOLD",
      ...readiness,
    }, { status: 409, headers: { "cache-control": "no-store" } });
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
      || !charge
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
    const releaseDecision = await runtimeRealMarketplaceReleaseDecision();
    if (!releaseDecision.approved) {
      return marketplacePausedResponse();
    }
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
          tuveloz_launch_onboarding_ids:
            releaseDecision.providerOnboardingDecisionIds.join(",").slice(0, 500),
          tuveloz_launch_pilot_ids:
            releaseDecision.transactionPilotDecisionIds.join(",").slice(0, 500),
          tuveloz_launch_checked_at: releaseDecision.checkedAt,
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
    await appendJobLifecycleEvent({
      requestId: payment.requestId,
      quoteId: payment.quoteId || "",
      providerId: payment.providerApplicationId,
      actorRole: "owner",
      actorId: getAuthenticatedEmail(request),
      eventType: "provider_payout_released",
      fromStatus: job.status,
      toStatus: job.status,
      scopeVersion: context.scopeVersion,
      authorizationSnapshotId: stageDecision.result.decisionId,
      reasonCode: "all_payout_controls_passed",
      details: {
        paymentId: payment.id,
        transferId: transfer.id,
        providerAmountCents: payment.providerAmountCents,
      },
    });

    return Response.json({
      ok: true,
      transferId: transfer.id,
      releasedAt,
    });
  } catch (error) {
    return stripeErrorResponse(error, "Unable to release the provider transfer.");
  }
}
