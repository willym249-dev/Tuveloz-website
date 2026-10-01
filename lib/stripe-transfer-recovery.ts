import type Stripe from "stripe";
import { and, eq, or, sql } from "drizzle-orm";
import { getDb } from "../db";
import { paymentAdjustments, stripePayments } from "../db/schema";
import { stripeLiveModeEnabled } from "./stripe";

type Payment = typeof stripePayments.$inferSelect;
type Attempt = typeof paymentAdjustments.$inferSelect;
export class TransferReviewError extends Error {}
export const transferAttemptKey = (id: string) => `tuveloz-release-${id}`;

function requireMatch(value: unknown, message: string): asserts value {
  if (!value) throw new TransferReviewError(message);
}
function objectId(value: unknown): string {
  return typeof value === "string" ? value : value && typeof value === "object"
    && "id" in value && typeof value.id === "string" ? value.id : "";
}
function snapshot(payment: Payment) {
  return { id: payment.id, requestId: payment.requestId, quoteId: payment.quoteId,
    providerApplicationId: payment.providerApplicationId, connectedAccountId: payment.connectedAccountId,
    paymentIntentId: payment.paymentIntentId, chargeId: payment.chargeId, transferGroup: payment.transferGroup,
    currency: payment.currency, providerAmountCents: payment.providerAmountCents,
    applicationFeeCents: payment.applicationFeeCents, customerTotalCents: payment.customerTotalCents,
    scopeVersion: payment.scopeVersion, scopeAuthorizationDecisionId: payment.scopeAuthorizationDecisionId,
    authorizedPriceSnapshot: payment.authorizedPriceSnapshot };
}
function samePayment(payment: Payment) {
  const values = snapshot(payment);
  return and(eq(stripePayments.id, payment.id),
    sql`json_array(${sql.join(Object.keys(values).map(key => sql`${stripePayments[key as keyof typeof values]}`), sql`, `)}) = ${JSON.stringify(Object.values(values))}`);
}
export function requireTransferPayment(payment: Payment) {
  requireMatch(payment.paymentType === "quote" && payment.settlementStrategy === "separate_transfer"
    && payment.requestId && payment.quoteId && payment.paymentIntentId && payment.chargeId
    && payment.paidAt && payment.connectedAccountId && payment.currency === "usd"
    && payment.transferGroup === `tuveloz_${payment.id}` && payment.id.length <= 120
    && Number.isSafeInteger(payment.providerAmountCents) && payment.providerAmountCents > 0
    && Number.isSafeInteger(payment.applicationFeeCents) && payment.applicationFeeCents >= 0
    && Number.isSafeInteger(payment.customerTotalCents)
    && payment.providerAmountCents + payment.applicationFeeCents === payment.customerTotalCents
    && payment.scopeVersion > 0 && payment.scopeAuthorizationDecisionId && payment.authorizedPriceSnapshot !== "{}",
  "This transfer needs a complete, settled payment and its approved amount.");
}
export async function savedTransferAttempt(payment: Payment) {
  const [attempt] = await getDb().select().from(paymentAdjustments)
    .where(eq(paymentAdjustments.idempotencyKey, transferAttemptKey(payment.id))).limit(1);
  if (attempt) {
    let details: Record<string, unknown> = {};
    try { details = JSON.parse(attempt.details); } catch { /* Invalid evidence must not unlock sending. */ }
    requireMatch(attempt.adjustmentType === "stripe_provider_transfer" && attempt.paymentId === payment.id
      && attempt.amountCents === payment.providerAmountCents && attempt.currency === payment.currency
      && JSON.stringify(details.payment) === JSON.stringify(snapshot(payment)),
    "The saved transfer attempt no longer matches this payment. Keep it under review.");
  }
  return attempt;
}

/** A permanent reservation survives lost replies, local write failures and Stripe key expiry. */
export async function reserveProviderTransfer(payment: Payment, owner: string, decisionId: string) {
  const now = new Date().toISOString(), id = crypto.randomUUID();
  const db = getDb();
  const [attempt] = await db.insert(paymentAdjustments).select(db.select({
    id: sql<string>`${id}`.as("id"), paymentId: sql<string>`${payment.id}`.as("payment_id"),
    requestId: sql<string>`${payment.requestId!}`.as("request_id"), quoteId: sql<string>`${payment.quoteId!}`.as("quote_id"),
    adjustmentType: sql<string>`'stripe_provider_transfer'`.as("adjustment_type"),
    amountCents: sql<number>`${payment.providerAmountCents}`.as("amount_cents"), currency: sql<string>`${payment.currency}`.as("currency"),
    status: sql<string>`'transfer_submission_unconfirmed'`.as("status"), reasonCode: sql<string>`'owner_completion_release'`.as("reason_code"),
    details: sql<string>`${JSON.stringify({ payment: snapshot(payment), authorizationDecisionId: decisionId })}`.as("details"),
    requestedByRole: sql<string>`'owner'`.as("requested_by_role"), requestedById: sql<string>`${owner}`.as("requested_by_id"),
    requestedAt: sql<string>`${now}`.as("requested_at"), decidedBy: sql<string>`${owner}`.as("decided_by"), decidedAt: sql<string>`${now}`.as("decided_at"),
    providerImpactCents: sql<number>`0`.as("provider_impact_cents"), customerImpactCents: sql<number>`0`.as("customer_impact_cents"),
    stripeRefundId: sql<string>`''`.as("stripe_refund_id"), stripeDisputeId: sql<string>`''`.as("stripe_dispute_id"), transferReversalId: sql<string>`''`.as("transfer_reversal_id"),
    idempotencyKey: sql<string>`${transferAttemptKey(payment.id)}`.as("idempotency_key"), createdAt: sql<string>`${now}`.as("created_at"), updatedAt: sql<string>`${now}`.as("updated_at"),
  }).from(stripePayments).where(and(samePayment(payment), eq(stripePayments.status, payment.status),
    eq(stripePayments.updatedAt, payment.updatedAt), eq(stripePayments.refundAmountCents, 0),
    eq(stripePayments.refundStatus, ""), eq(stripePayments.disputeStatus, ""), eq(stripePayments.releasedAt, ""),
    sql`coalesce(${stripePayments.transferId}, '') = ''`,
    sql`exists (select 1 from customer_requests where id = ${payment.requestId} and status = 'completed' and is_test_job = 'no')`,
    sql`exists (select 1 from provider_quotes where id = ${payment.quoteId} and request_id = ${payment.requestId}
      and scope_version = ${payment.scopeVersion} and status = 'accepted')`,
    sql`not exists (select 1 from job_change_orders where request_id = ${payment.requestId} and status = 'pending_customer')`,
    sql`not exists (select 1 from job_incidents where request_id = ${payment.requestId} and (hold_payments = 'yes' or status in ('open','under_review','insurer_review')))`,
    sql`not exists (select 1 from job_cancellations where request_id = ${payment.requestId} and status in ('submitted','under_review'))`,
    sql`not exists (select 1 from payment_adjustments where request_id = ${payment.requestId} and
      ((adjustment_type in ('refund_request','cancellation_refund') and status in ('requested','under_review','approved','approved_test_only'))
      or (adjustment_type in ('dispute','reserve') and status = 'active')))`,
  ))).onConflictDoNothing().returning();
  requireMatch(attempt, "The payment changed or a transfer is already reserved. Check its saved status before continuing.");
  return attempt;
}

export async function recordProviderTransfer(payment: Payment, transfer: Stripe.Transfer, owner: string, attempt?: Attempt) {
  requireMatch(typeof transfer.id === "string" && transfer.id.startsWith("tr_") && transfer.object === "transfer"
    && transfer.amount === payment.providerAmountCents && transfer.currency === payment.currency
    && objectId(transfer.destination) === payment.connectedAccountId && objectId(transfer.source_transaction) === payment.chargeId
    && transfer.transfer_group === payment.transferGroup && transfer.livemode === stripeLiveModeEnabled()
    && transfer.metadata?.tuveloz_payment_record_id === payment.id
    && transfer.metadata?.tuveloz_request_id === payment.requestId && transfer.metadata?.tuveloz_quote_id === payment.quoteId
    && (!attempt || transfer.metadata?.tuveloz_transfer_execution_id === attempt.id)
    && Number.isSafeInteger(transfer.created) && transfer.created > 0
    && transfer.reversed === false && transfer.amount_reversed === 0,
  "Stripe's transfer does not match this payment, or it has been reversed. Keep it under review.");
  const releasedAt = new Date(transfer.created * 1000).toISOString();
  // Recording a money movement must never clear a newer refund, dispute or other hold.
  const [saved] = await getDb().update(stripePayments).set({ transferId: transfer.id,
    status: sql`case when ${stripePayments.status} in ('paid_pending_completion','ready_for_release','released')
      and ${stripePayments.refundAmountCents} = 0 and ${stripePayments.refundStatus} = '' and ${stripePayments.disputeStatus} = ''
      then 'released' else ${stripePayments.status} end`,
    releasedAt, releasedBy: attempt?.requestedById || payment.releasedBy || owner, updatedAt: new Date().toISOString(),
  }).where(and(samePayment(payment), or(sql`coalesce(${stripePayments.transferId}, '') = ''`, eq(stripePayments.transferId, transfer.id))))
    .returning();
  requireMatch(saved, "The transfer exists in Stripe, but its local payment needs review. Do not send it again.");
  if (attempt) await getDb().update(paymentAdjustments).set({ status: "transfer_recorded", updatedAt: new Date().toISOString() })
    .where(and(eq(paymentAdjustments.id, attempt.id), eq(paymentAdjustments.details, attempt.details)));
  return { ok: true as const, paymentId: payment.id, transferConfirmed: true as const, transferId: transfer.id, releasedAt,
    transferReviewRequired: saved.status !== "released", paymentStatus: saved.status };
}

/** Read Stripe only; a missing or uncertain result never initiates a replacement transfer. */
export async function recoverProviderTransfer(stripe: Stripe, payment: Payment, owner: string, attempt?: Attempt) {
  requireTransferPayment(payment);
  const transfers = await stripe.transfers.list({ transfer_group: payment.transferGroup!, limit: 2 });
  requireMatch(!transfers.has_more && transfers.data.length <= 1,
    "More than one transfer is associated with this payment. Keep it under review.");
  if (!transfers.data.length) return { ok: false as const, transferConfirmed: false as const, transferReviewRequired: true,
    error: "No matching transfer is confirmed in Stripe. Keep this payment under review; do not send it again." };
  const transfer = await stripe.transfers.retrieve(transfers.data[0].id);
  requireMatch(transfer.id === transfers.data[0].id, "Stripe returned an unexpected transfer reference. Keep it under review.");
  requireMatch(!payment.transferId || payment.transferId === transfer.id, "The saved and Stripe transfer references do not agree.");
  return recordProviderTransfer(payment, transfer, owner, attempt);
}
