import { and, desc, eq, sql } from "drizzle-orm";
import { getDb } from "../../../../../db";
import {
  accountCredentials,
  customerAgreementAcceptances,
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
  stripeLiveModeEnabled,
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
import { recordProviderTransfer, recoverProviderTransfer, requireTransferPayment, reserveProviderTransfer,
  savedTransferAttempt, TransferReviewError } from "../../../../../lib/stripe-transfer-recovery";
import {
  CUSTOMER_COMPLETION_AGREEMENT_KEY,
  CUSTOMER_COMPLETION_AGREEMENT_VERSION,
} from "../../../../../lib/customer-completion-confirmation";

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
    transferAttemptStatus: paymentAdjustments.status,
  }).from(stripePayments)
    .leftJoin(paymentAdjustments, and(eq(paymentAdjustments.paymentId, stripePayments.id),
      eq(paymentAdjustments.adjustmentType, "stripe_provider_transfer"),
      eq(paymentAdjustments.idempotencyKey, sql`'tuveloz-release-' || ${stripePayments.id}`)))
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
  }, { headers: { "cache-control": "no-store" } });
}

export async function POST(request: Request) {
  if (!(await isVerifiedOwnerRequest(request))) {
    return Response.json({ error: "Owner access required." }, { status: 403 });
  }
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "Cross-origin transfer release is not allowed." }, { status: 403 });
  }
  let body: { paymentId?: unknown; action?: unknown };
  try { body = await request.json(); } catch {
    return Response.json({ error: "Choose a payment and an explicit action." }, { status: 400, headers: { "cache-control": "no-store" } });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)
    || (body.action !== undefined && body.action !== "check_transfer" && body.action !== "release")) {
    return Response.json({ error: "Unknown payment action." }, { status: 400, headers: { "cache-control": "no-store" } });
  }
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
  try {
    requireTransferPayment(payment);
    const attempt = await savedTransferAttempt(payment);
    if (attempt || payment.transferId || payment.status === "released" || body.action === "check_transfer") {
      const recovered = await recoverProviderTransfer(getStripeClient(), payment, getAuthenticatedEmail(request), attempt);
      return Response.json(recovered, { status: recovered.ok ? 200 : 202, headers: { "cache-control": "no-store" } });
    }
  } catch (error) {
    if (error instanceof TransferReviewError) return Response.json({ error: error.message }, { status: 409, headers: { "cache-control": "no-store" } });
    return stripeErrorResponse(error, "Unable to check the provider transfer. No replacement transfer was sent.");
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
  if (payment.refundAmountCents > 0 || payment.refundStatus || payment.disputeStatus) {
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
  const [actualStartCurrent, completionCurrent, [completionConfirmation]] = await Promise.all([
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
    db.select({ id: customerAgreementAcceptances.id })
      .from(customerAgreementAcceptances)
      .where(and(
        eq(customerAgreementAcceptances.requestId, payment.requestId),
        eq(customerAgreementAcceptances.quoteId, context.quoteId),
        eq(customerAgreementAcceptances.scopeVersion, context.scopeVersion),
        eq(customerAgreementAcceptances.agreementKey, CUSTOMER_COMPLETION_AGREEMENT_KEY),
        eq(customerAgreementAcceptances.agreementVersion, CUSTOMER_COMPLETION_AGREEMENT_VERSION),
      )).limit(1),
  ]);
  const readiness = assessPayoutReadiness({
    jobCompleted: job.status === "completed"
      && jobRecord?.workStatus === "completed"
      && actualStartCurrent,
    completionDecisionId: completionCurrent
      ? jobRecord?.completionDecisionId || ""
      : "",
    customerCompletionConfirmed: Boolean(completionConfirmation),
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
      paymentIntent.id !== payment.paymentIntentId
      || paymentIntent.status !== "succeeded"
      || paymentIntent.amount !== payment.customerTotalCents
      || paymentIntent.amount_received !== payment.customerTotalCents
      || paymentIntent.currency !== payment.currency
      || paymentIntent.livemode !== stripeLiveModeEnabled()
      || paymentIntent.transfer_group !== payment.transferGroup
      || paymentIntent.transfer_data
      || !charge
      || chargeId !== payment.chargeId
      || (typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id) !== payment.paymentIntentId
      || !charge.paid || !charge.captured || charge.status !== "succeeded"
      || charge.amount !== payment.customerTotalCents || charge.amount_captured !== payment.customerTotalCents
      || charge.currency !== payment.currency || charge.livemode !== paymentIntent.livemode
      || charge.transfer || charge.transfer_data
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

    // Recover an older transfer whose local write was lost, even if it predates
    // the durable reservation. Never depend on Stripe retaining a key forever.
    const priorTransfers = await stripeClient.transfers.list({ transfer_group: payment.transferGroup!, limit: 1 });
    if (priorTransfers.data.length || priorTransfers.has_more) {
      const recovered = await recoverProviderTransfer(stripeClient, payment, getAuthenticatedEmail(request));
      return Response.json(recovered, { status: recovered.ok ? 200 : 202, headers: { "cache-control": "no-store" } });
    }
    // source_transaction ties the transfer to the customer's successful charge.
    // The local reservation is permanent; uncertain attempts become read-only.
    const releaseDecision = await runtimeRealMarketplaceReleaseDecision();
    if (!releaseDecision.approved) {
      return marketplacePausedResponse();
    }
    const attempt = await reserveProviderTransfer(payment, getAuthenticatedEmail(request), stageDecision.result.decisionId);
    if (!(await runtimeMarketplaceActionAllowed("payout", { testOnly: false }))) return marketplacePausedResponse();
    const transfer = await stripeClient.transfers.create(
      {
        amount: payment.providerAmountCents,
        currency: payment.currency,
        destination: payment.connectedAccountId,
        source_transaction: chargeId,
        transfer_group: payment.transferGroup ?? undefined,
        metadata: {
          tuveloz_transfer_execution_id: attempt.id,
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

    const confirmed = await recordProviderTransfer(payment, transfer, getAuthenticatedEmail(request), attempt);
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

    return Response.json(confirmed, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    if (error instanceof TransferReviewError) return Response.json({ error: error.message }, { status: 409, headers: { "cache-control": "no-store" } });
    return stripeErrorResponse(error, "Unable to release the provider transfer.");
  }
}
