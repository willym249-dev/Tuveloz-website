import type Stripe from "stripe";
import { and, eq, sql } from "drizzle-orm";
import { getDb } from "../db";
import {
  customerRequests, jobCancellations, jobIncidents, paymentAdjustments,
  providerApplications, providerJobRecords, stripePayments,
} from "../db/schema";
import { getStripeClient, stripeLiveModeEnabled } from "./stripe";
import { runtimeMarketplaceActionAllowed } from "./runtime-marketplace-action";

type Adjustment = typeof paymentAdjustments.$inferSelect;
type Payment = typeof stripePayments.$inferSelect;

export class FullRefundReviewError extends Error {
  constructor(message: string, public status = 409) { super(message); }
}

function requireReview(condition: unknown, message: string): asserts condition {
  if (!condition) throw new FullRefundReviewError(message);
}

function objectId(value: unknown): string {
  return typeof value === "string" ? value
    : value && typeof value === "object" && "id" in value && typeof value.id === "string" ? value.id : "";
}

export function fullRefundPaymentSnapshot(payment: Payment) {
  return {
    paymentId: payment.id, requestId: payment.requestId, quoteId: payment.quoteId,
    providerApplicationId: payment.providerApplicationId, connectedAccountId: payment.connectedAccountId, customerEmail: payment.customerEmail,
    scopeVersion: payment.scopeVersion, scopeAuthorizationDecisionId: payment.scopeAuthorizationDecisionId,
    authorizedPriceSnapshot: payment.authorizedPriceSnapshot,
    paymentIntentId: payment.paymentIntentId, chargeId: payment.chargeId, transferGroup: payment.transferGroup,
    currency: payment.currency, customerRefundCents: payment.customerTotalCents,
    providerRefundCents: payment.providerAmountCents, customerFeeRefundCents: payment.applicationFeeCents,
  };
}

function approvedSnapshotMatches(decision: Adjustment, payment: Payment) {
  try {
    const recorded = JSON.parse(decision.details).paymentSnapshot;
    return recorded && Object.entries(fullRefundPaymentSnapshot(payment)).every(([key, value]) => recorded[key] === value);
  } catch { return false; }
}

function result(execution: Adjustment) {
  return {
    executionId: execution.id, status: execution.status,
    stripeRefundId: execution.stripeRefundId || null,
    // Approval, submission, pending and uncertain results are never success.
    refundSucceeded: execution.status === "refund_succeeded",
    customerRefundCents: execution.amountCents,
  };
}

function nextVersion(execution: Adjustment) {
  return new Date(Math.max(Date.now(), (Date.parse(execution.updatedAt) || 0) + 1)).toISOString();
}

async function saveRefund(execution: Adjustment, payment: Payment, refund: Stripe.Refund) {
  requireReview(
    refund.id && objectId(refund.charge) === payment.chargeId
      && objectId(refund.payment_intent) === payment.paymentIntentId
      && refund.amount === execution.amountCents && refund.currency === payment.currency
      && refund.metadata?.tuveloz_refund_execution_id === execution.id
      && refund.metadata?.tuveloz_payment_record_id === payment.id,
    "Stripe's refund does not match this payment and approval. Keep it under review.",
  );
  const status = ["succeeded", "pending", "requires_action", "failed", "canceled"].includes(refund.status ?? "")
    ? `refund_${refund.status}` : "refund_status_review";
  // Strictly advance this row's version even when two writes share a clock
  // millisecond. A slower Stripe read must not replace a newer reconciliation.
  const updatedAt = nextVersion(execution);
  const [saved] = await getDb().update(paymentAdjustments).set({
    status, stripeRefundId: refund.id, updatedAt,
  }).where(and(eq(paymentAdjustments.id, execution.id), eq(paymentAdjustments.status, execution.status),
    eq(paymentAdjustments.updatedAt, execution.updatedAt)))
    .returning();
  // Another reconciliation won. Never overwrite its newer result.
  if (saved) return result(saved);
  const [current] = await getDb().select().from(paymentAdjustments).where(eq(paymentAdjustments.id, execution.id)).limit(1);
  requireReview(current, "The refund record needs review.");
  return result(current);
}

async function recoverRefund(stripe: Stripe, execution: Adjustment, payment: Payment) {
  if (execution.stripeRefundId) {
    return saveRefund(execution, payment, await stripe.refunds.retrieve(execution.stripeRefundId));
  }
  // Never retry the mutation after an uncertain outcome. Stripe may prune an
  // idempotency key after 24 hours. Find the original operation by its durable
  // metadata instead; even a late retry must not send a second refund.
  for await (const refund of stripe.refunds.list({ charge: payment.chargeId!, limit: 100 })) {
    if (refund.metadata?.tuveloz_refund_execution_id === execution.id) {
      return saveRefund(execution, payment, await stripe.refunds.retrieve(refund.id));
    }
  }
  return { ...result(execution), recovery: "not_found" as const };
}

/**
 * First execution slice: owner-approved, full, pre-work cancellation refunds
 * on an unreleased separate-transfer payment. Partial refunds, prior refunds,
 * post-start work and provider recovery need their own reviewed workflows.
 * Existing simulation approvals cannot enter this path. No testOnly override.
 */
export async function executeApprovedFullRefund(adjustmentId: string, ownerEmail: string, options: { reconcileOnly?: boolean; retryNotSent?: boolean } = {}) {
  // Status recovery cannot send money. Keep it available for a saved attempt
  // during a pause; all submissions still require the original release gates.
  // The Stripe client independently preserves its live-key lock for reads too.
  if (!options.reconcileOnly && !(await runtimeMarketplaceActionAllowed("payout", { testOnly: false }))) {
    throw new FullRefundReviewError("Stripe refund execution is not open yet.", 503);
  }
  const db = getDb();
  const [decision] = await db.select().from(paymentAdjustments).where(eq(paymentAdjustments.id, adjustmentId)).limit(1);
  requireReview(decision?.status === "approved" && decision.adjustmentType === "cancellation_refund"
    && decision.decidedBy && decision.decidedAt && decision.paymentId
    && !decision.stripeRefundId && !decision.transferReversalId && !decision.stripeDisputeId,
  "Choose a reviewed cancellation refund bound to a settled payment.");
  const [payment] = await db.select().from(stripePayments).where(eq(stripePayments.id, decision.paymentId)).limit(1);
  requireReview(payment && payment.paymentType === "quote" && payment.settlementStrategy === "separate_transfer"
    && payment.id.length <= 200
    && payment.requestId && payment.quoteId && payment.paymentIntentId && payment.chargeId && payment.paidAt
    && payment.transferGroup === `tuveloz_${payment.id}`
    && payment.scopeVersion > 0 && payment.scopeAuthorizationDecisionId && payment.authorizedPriceSnapshot !== "{}"
    && decision.requestId === payment.requestId && decision.quoteId === payment.quoteId
    && decision.currency === payment.currency && payment.currency === "usd"
    && Number.isSafeInteger(payment.providerAmountCents) && payment.providerAmountCents > 0
    && Number.isSafeInteger(payment.applicationFeeCents) && payment.applicationFeeCents >= 0
    && Number.isSafeInteger(payment.customerTotalCents)
    && payment.providerAmountCents + payment.applicationFeeCents === payment.customerTotalCents
    && decision.amountCents === payment.customerTotalCents
    && decision.customerImpactCents === payment.customerTotalCents
    && decision.providerImpactCents === -payment.providerAmountCents,
  "The refund must match the complete saved customer payment, including the Customer Service Fee.");
  requireReview(approvedSnapshotMatches(decision, payment), "The approved payment snapshot is missing or has changed. Review the refund again.");

  const key = `tuveloz-full-refund-${payment.id}`;
  const details = JSON.stringify({ decisionId: decision.id, ...fullRefundPaymentSnapshot(payment) });
  const [existing] = await db.select().from(paymentAdjustments).where(eq(paymentAdjustments.idempotencyKey, key)).limit(1);
  if (existing) {
    requireReview(existing.details === details && existing.paymentId === payment.id
      && existing.adjustmentType === "stripe_full_refund" && existing.amountCents === payment.customerTotalCents
      && existing.currency === payment.currency, "Another refund decision already reserved this payment.");
    requireReview(existing.stripeRefundId || ["refund_submission_unconfirmed", "refund_not_sent_review"].includes(existing.status),
      "The saved refund status is missing its Stripe reference. Keep it under review.");
    if (existing.status !== "refund_not_sent_review") return recoverRefund(getStripeClient(), existing, payment);
    requireReview(!existing.stripeRefundId, "The unsent record contains a Stripe refund. Keep it under review.");
    if (!options.retryNotSent || options.reconcileOnly) return { ...result(existing), recovery: "not_sent" as const };
  }
  requireReview(!options.reconcileOnly, "No Stripe refund attempt is saved. Review the payment before choosing Send refund.");
  requireReview(!options.retryNotSent || existing, "No confirmed unsent attempt is available to retry. Refresh the saved review.");

  const [[job], [provider], cancellations, work, incidents] = await Promise.all([
    db.select().from(customerRequests).where(eq(customerRequests.id, payment.requestId)).limit(1),
    db.select().from(providerApplications).where(eq(providerApplications.id, payment.providerApplicationId)).limit(1),
    db.select().from(jobCancellations).where(and(eq(jobCancellations.requestId, payment.requestId),
      eq(jobCancellations.paymentAdjustmentId, decision.id))),
    db.select().from(providerJobRecords).where(eq(providerJobRecords.requestId, payment.requestId)),
    db.select({ id: jobIncidents.id }).from(jobIncidents).where(and(eq(jobIncidents.requestId, payment.requestId), eq(jobIncidents.holdPayments, "yes"))).limit(1),
  ]);
  requireReview(job?.isTestJob === "no" && job.status === "cancelled" && provider?.isTestProvider === "no",
    "Only a cancelled real job can use this refund path. Simulation records never create Stripe refunds.");
  requireReview(!incidents.length, "An incident has a payment hold. Resolve that review before sending a refund.");
  requireReview(cancellations.length === 1, "The recorded cancellation needs review.");
  const cancellation = cancellations[0];
  requireReview(cancellation.status === "approved" && cancellation.quoteId === payment.quoteId
    && cancellation.decisionBy && cancellation.decisionAt && cancellation.decisionReason
    && ["provider_cancel", "provider_no_show", "customer_cancel"].includes(cancellation.cancellationType)
    && cancellation.cancellationType === decision.reasonCode
    && cancellation.proposedRefundCents === payment.customerTotalCents && cancellation.retainedAmountCents === 0
    && cancellation.workPerformedCents === 0 && cancellation.partsCommittedCents === 0
    && work.every(record => !record.jobStartDecisionId && !record.completionDecisionId && !record.timerStartedAt
      && record.trackedSeconds === 0 && record.billableMinutes === 0 && record.workStatus === "scheduled"),
  "This cancellation is outside the approved full refund before work starts. Review it separately.");
  requireReview(payment.status === "paid_pending_completion" && !payment.transferId && !payment.releasedAt
    && !payment.disputeStatus && !payment.refundStatus && !payment.lastRefundId && payment.refundAmountCents === 0,
  "A transfer, prior refund or payment hold needs review before another money movement.");

  const stripe = getStripeClient();
  const intent = await stripe.paymentIntents.retrieve(payment.paymentIntentId, { expand: ["latest_charge"] });
  const charge = intent.latest_charge && typeof intent.latest_charge !== "string" ? intent.latest_charge : null;
  requireReview(intent.id === payment.paymentIntentId && intent.status === "succeeded"
    && intent.amount === payment.customerTotalCents && intent.amount_received === payment.customerTotalCents
    && intent.currency === payment.currency && intent.livemode === stripeLiveModeEnabled()
    && intent.transfer_group === payment.transferGroup
    && intent.metadata.tuveloz_payment_record_id === payment.id
    && charge?.id === payment.chargeId && objectId(charge.payment_intent) === payment.paymentIntentId
    && charge.paid && charge.captured && charge.status === "succeeded"
    && charge.currency === payment.currency && charge.amount === payment.customerTotalCents
    && charge.amount_captured === payment.customerTotalCents && charge.livemode === intent.livemode
    && !charge.refunded && charge.amount_refunded === 0 && !charge.disputed
    && !charge.transfer && !charge.transfer_data && !intent.transfer_data,
  "Stripe has not confirmed an unrefunded, unreleased payment for this exact amount.");
  const prior = await stripe.refunds.list({ charge: charge.id, limit: 1 });
  requireReview(prior.data.length === 0, "Stripe already has a refund for this charge. Review it before proceeding.");
  // Separate transfers are not necessarily stored on Charge.transfer. Query
  // the payment's own group too, including a transfer whose local write failed.
  const transfers = await stripe.transfers.list({ transfer_group: payment.transferGroup, limit: 1 });
  requireReview(transfers.data.length === 0, "Stripe already has a provider transfer for this payment. Review recovery separately.");
  // Recheck after the network reads, before reserving any operation.
  if (!(await runtimeMarketplaceActionAllowed("payout", { testOnly: false }))) {
    throw new FullRefundReviewError("Stripe refund execution is not open yet.", 503);
  }
  // A confirmed unsent attempt may be explicitly reclaimed only after every
  // eligibility/network check above. Reuse its permanent id/key, compare the
  // exact row version and advance it, so concurrent/stale retries cannot send.
  // An uncertain attempt never enters this branch, even after key expiry.
  const [execution] = existing ? await db.update(paymentAdjustments).set({
    status: "refund_submission_unconfirmed", updatedAt: nextVersion(existing),
  }).where(and(eq(paymentAdjustments.id, existing.id), eq(paymentAdjustments.status, "refund_not_sent_review"),
    eq(paymentAdjustments.updatedAt, existing.updatedAt), eq(paymentAdjustments.details, details),
    eq(paymentAdjustments.stripeRefundId, ""), eq(paymentAdjustments.amountCents, payment.customerTotalCents),
    eq(paymentAdjustments.paymentId, payment.id), eq(paymentAdjustments.idempotencyKey, key),
    eq(paymentAdjustments.adjustmentType, "stripe_full_refund"), eq(paymentAdjustments.currency, payment.currency)))
    .returning() : await db.insert(paymentAdjustments).values({
    id: crypto.randomUUID(), paymentId: payment.id, requestId: payment.requestId, quoteId: payment.quoteId,
    adjustmentType: "stripe_full_refund", amountCents: payment.customerTotalCents, currency: payment.currency,
    status: "refund_submission_unconfirmed", reasonCode: decision.reasonCode, details,
    requestedByRole: "owner", requestedById: ownerEmail, decidedBy: decision.decidedBy, decidedAt: decision.decidedAt,
    // Impacts stay on the original decision; this row is execution evidence,
    // not a second accounting adjustment or provider transfer reversal.
    idempotencyKey: key,
  }).onConflictDoNothing().returning();
  if (!execution) {
    throw new FullRefundReviewError("A refund is already reserved for this payment. Refresh to check its status.");
  }
  const [held] = await db.update(stripePayments).set({ status: "refund_status_review", updatedAt: new Date().toISOString() })
    .where(and(eq(stripePayments.id, payment.id), eq(stripePayments.status, payment.status),
      eq(stripePayments.refundAmountCents, 0), eq(stripePayments.refundStatus, ""), eq(stripePayments.disputeStatus, ""),
      sql`coalesce(${stripePayments.transferId}, '') = ''`, eq(stripePayments.releasedAt, ""),
      eq(stripePayments.chargeId, payment.chargeId), eq(stripePayments.paymentIntentId, payment.paymentIntentId),
      eq(stripePayments.customerTotalCents, payment.customerTotalCents),
      eq(stripePayments.providerAmountCents, payment.providerAmountCents), eq(stripePayments.applicationFeeCents, payment.applicationFeeCents),
      eq(stripePayments.scopeVersion, payment.scopeVersion), eq(stripePayments.authorizedPriceSnapshot, payment.authorizedPriceSnapshot),
      eq(stripePayments.scopeAuthorizationDecisionId, payment.scopeAuthorizationDecisionId),
      eq(stripePayments.providerApplicationId, payment.providerApplicationId),
      eq(stripePayments.connectedAccountId, payment.connectedAccountId), eq(stripePayments.customerEmail, payment.customerEmail),
      eq(stripePayments.requestId, payment.requestId), eq(stripePayments.quoteId, payment.quoteId),
      eq(stripePayments.currency, payment.currency), eq(stripePayments.lastRefundId, ""),
      eq(stripePayments.transferGroup, payment.transferGroup),
      sql`exists (select 1 from payment_adjustments where id = ${execution.id} and status = 'refund_submission_unconfirmed'
        and updated_at = ${execution.updatedAt} and stripe_refund_id = '' and details = ${details})`,
      sql`exists (select 1 from payment_adjustments where id = ${decision.id} and status = 'approved' and details = ${decision.details}
        and amount_cents = ${payment.customerTotalCents} and payment_id = ${payment.id} and stripe_refund_id = ''
        and provider_impact_cents = ${-payment.providerAmountCents} and customer_impact_cents = ${payment.customerTotalCents})`,
      sql`exists (select 1 from customer_requests where id = ${payment.requestId} and status = 'cancelled' and is_test_job = 'no')`,
      sql`exists (select 1 from provider_applications where id = ${provider.id} and is_test_provider = 'no')`,
      sql`exists (select 1 from job_cancellations where id = ${cancellation.id} and status = 'approved'
        and payment_adjustment_id = ${decision.id} and proposed_refund_cents = ${payment.customerTotalCents}
        and cancellation_type = ${decision.reasonCode} and quote_id = ${payment.quoteId}
        and retained_amount_cents = 0 and work_performed_cents = 0 and parts_committed_cents = 0)`,
      sql`not exists (select 1 from provider_job_records where request_id = ${payment.requestId}
        and (job_start_decision_id <> '' or completion_decision_id <> '' or timer_started_at <> ''
          or tracked_seconds <> 0 or billable_minutes <> 0 or work_status <> 'scheduled'))`,
      sql`not exists (select 1 from job_incidents where request_id = ${payment.requestId} and hold_payments = 'yes')`,
    )).returning({ id: stripePayments.id });
  if (!held) {
    await db.update(paymentAdjustments).set({ status: "refund_not_sent_review", updatedAt: nextVersion(execution) })
      .where(and(eq(paymentAdjustments.id, execution.id), eq(paymentAdjustments.status, "refund_submission_unconfirmed"),
        eq(paymentAdjustments.updatedAt, execution.updatedAt)));
    throw new FullRefundReviewError("The payment changed during refund review. No new refund was sent.");
  }
  // Once this call is attempted, an error is an uncertain result, not proof of
  // failure. Preserve the permanent reservation and hold until reconciliation.
  try {
    const refund = await stripe.refunds.create({
      charge: charge.id, amount: payment.customerTotalCents,
      metadata: { tuveloz_payment_record_id: payment.id, tuveloz_refund_execution_id: execution.id,
        tuveloz_refund_decision_id: decision.id },
    }, { idempotencyKey: key, maxNetworkRetries: 0 });
    return await saveRefund(execution, payment, refund);
  } catch {
    return result(execution);
  }
}
