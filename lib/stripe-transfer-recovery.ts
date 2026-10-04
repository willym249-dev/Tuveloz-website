import type Stripe from "stripe";
import { and, eq, or, sql } from "drizzle-orm";
import { getDb } from "../db";
import { paymentAdjustments, providerInvoices, stripePayments } from "../db/schema";
import { stripeLiveModeEnabled } from "./stripe";

type Payment = typeof stripePayments.$inferSelect;
type Attempt = typeof paymentAdjustments.$inferSelect;
type TransferInvoice = Pick<typeof providerInvoices.$inferSelect,
  "id" | "requestId" | "quoteId" | "providerId" | "scopeVersion" | "status" | "totalAmountCents"> & {
    documentHash: string;
    customerSignatureAt: string;
    customerCopyDeliveredAt: string;
    providerCopyRetainedAt: string;
  };
export class TransferReviewError extends Error {}
export const transferAttemptKey = (id: string) => `tuveloz-release-${id}`;
export const transferReversalReviewKey = (id: string) => `tuveloz-transfer-reversal-${id}`;

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
function invoiceSnapshot(invoice: TransferInvoice) {
  return { id: invoice.id, requestId: invoice.requestId, quoteId: invoice.quoteId,
    providerId: invoice.providerId, scopeVersion: invoice.scopeVersion, status: invoice.status,
    totalAmountCents: invoice.totalAmountCents, documentHash: invoice.documentHash,
    customerSignatureAt: invoice.customerSignatureAt, customerCopyDeliveredAt: invoice.customerCopyDeliveredAt,
    providerCopyRetainedAt: invoice.providerCopyRetainedAt };
}

/** Check the existing invoice release gate before asking Stripe to move money. */
export function requireTransferInvoice(payment: Payment, invoice: TransferInvoice | undefined): asserts invoice is TransferInvoice {
  requireMatch(invoice && invoice.id && invoice.requestId === payment.requestId
    && invoice.quoteId === payment.quoteId && invoice.providerId === payment.providerApplicationId
    && invoice.scopeVersion === payment.scopeVersion && invoice.status === "final"
    && Number.isSafeInteger(invoice.totalAmountCents) && invoice.totalAmountCents === payment.providerAmountCents
    && [invoice.documentHash, invoice.customerSignatureAt, invoice.customerCopyDeliveredAt, invoice.providerCopyRetainedAt]
      .every(value => typeof value === "string" && value.trim().length > 0),
  "Before sending payment, the final invoice must match this job, provider and amount, with the customer's signature, delivered customer copy and retained provider copy.");
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
export async function reserveProviderTransfer(payment: Payment, owner: string, decisionId: string, invoice: TransferInvoice) {
  requireTransferInvoice(payment, invoice);
  const reviewedInvoice = invoiceSnapshot(invoice);
  const now = new Date().toISOString(), id = crypto.randomUUID();
  const db = getDb();
  const [attempt] = await db.insert(paymentAdjustments).select(db.select({
    id: sql<string>`${id}`.as("id"), paymentId: sql<string>`${payment.id}`.as("payment_id"),
    requestId: sql<string>`${payment.requestId!}`.as("request_id"), quoteId: sql<string>`${payment.quoteId!}`.as("quote_id"),
    adjustmentType: sql<string>`'stripe_provider_transfer'`.as("adjustment_type"),
    amountCents: sql<number>`${payment.providerAmountCents}`.as("amount_cents"), currency: sql<string>`${payment.currency}`.as("currency"),
    status: sql<string>`'transfer_submission_unconfirmed'`.as("status"), reasonCode: sql<string>`'owner_completion_release'`.as("reason_code"),
    details: sql<string>`${JSON.stringify({ payment: snapshot(payment), authorizationDecisionId: decisionId, invoice: reviewedInvoice })}`.as("details"),
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
    // The reservation binds the reviewed invoice before the external transfer.
    // The post-transfer database trigger is a backstop, not permission to send.
    sql`exists (select 1 from provider_invoices invoice where invoice.id = ${invoice.id}
      and json_array(invoice.id, invoice.request_id, invoice.quote_id, invoice.provider_id,
        invoice.scope_version, invoice.status, invoice.total_amount_cents, invoice.document_hash,
        invoice.customer_signature_at, invoice.customer_copy_delivered_at, invoice.provider_copy_retained_at)
        = ${JSON.stringify(Object.values(reviewedInvoice))})`,
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

function requireMatchingTransfer(payment: Payment, transfer: Stripe.Transfer, attempt?: Attempt) {
  requireTransferPayment(payment);
  requireMatch(typeof transfer.id === "string" && transfer.id.startsWith("tr_") && transfer.object === "transfer"
    && (!payment.transferId || payment.transferId === transfer.id)
    && transfer.amount === payment.providerAmountCents && transfer.currency === payment.currency
    && objectId(transfer.destination) === payment.connectedAccountId && objectId(transfer.source_transaction) === payment.chargeId
    && transfer.transfer_group === payment.transferGroup && transfer.livemode === stripeLiveModeEnabled()
    && transfer.metadata?.tuveloz_payment_record_id === payment.id
    && transfer.metadata?.tuveloz_request_id === payment.requestId && transfer.metadata?.tuveloz_quote_id === payment.quoteId
    && (!attempt || transfer.metadata?.tuveloz_transfer_execution_id === attempt.id)
    && Number.isSafeInteger(transfer.created) && transfer.created > 0
    && Number.isFinite(new Date(transfer.created * 1000).getTime())
    && Number.isSafeInteger(transfer.amount_reversed) && transfer.amount_reversed >= 0
    && transfer.amount_reversed <= transfer.amount
    && transfer.reversed === (transfer.amount_reversed === transfer.amount),
  "Stripe's transfer does not match this payment. Keep it under review.");
}

/** Sticky review evidence only, never a refund, recovery ledger or collection instruction. */
async function recordTransferReversalReview(payment: Payment, transfer: Stripe.Transfer, attempt?: Attempt) {
  requireMatchingTransfer(payment, transfer, attempt);
  requireMatch(transfer.amount_reversed > 0, "Stripe has not confirmed a transfer reversal.");
  const db = getDb(), now = new Date().toISOString();
  const key = transferReversalReviewKey(payment.id);
  const details = JSON.stringify({ payment: snapshot(payment), transferId: transfer.id,
    observation: "full_or_partial_reversal", accountingEntry: false, collectionAuthorized: false });
  const [prior] = await db.select().from(paymentAdjustments).where(eq(paymentAdjustments.idempotencyKey, key)).limit(1);
  requireMatch(!prior || (prior.adjustmentType === "stripe_transfer_reversal_review"
    && prior.paymentId === payment.id && prior.requestId === payment.requestId && prior.quoteId === payment.quoteId
    && prior.details === details && prior.amountCents === 0 && prior.providerImpactCents === 0
    && prior.customerImpactCents === 0 && prior.currency === payment.currency && prior.status === "review_required"),
  "The saved transfer-reversal review does not match this payment. Keep it under review.");
  const binding = and(samePayment(payment), eq(stripePayments.paymentType, "quote"),
    eq(stripePayments.settlementStrategy, "separate_transfer"), eq(stripePayments.paidAt, payment.paidAt),
    or(sql`coalesce(${stripePayments.transferId}, '') = ''`, eq(stripePayments.transferId, transfer.id)));
  // Supply every column in schema order. The conditional insert and payment
  // update share one D1 transaction; an interrupted write cannot lose the hold.
  const marker = db.insert(paymentAdjustments).select(db.select({
    id: sql<string>`${crypto.randomUUID()}`.as("id"), paymentId: sql<string>`${payment.id}`.as("payment_id"),
    requestId: sql<string>`${payment.requestId!}`.as("request_id"), quoteId: sql<string>`${payment.quoteId!}`.as("quote_id"),
    adjustmentType: sql<string>`'stripe_transfer_reversal_review'`.as("adjustment_type"),
    amountCents: sql<number>`0`.as("amount_cents"), currency: sql<string>`${payment.currency}`.as("currency"),
    status: sql<string>`'review_required'`.as("status"), reasonCode: sql<string>`'processor_transfer_reversed'`.as("reason_code"),
    details: sql<string>`${details}`.as("details"), requestedByRole: sql<string>`'system'`.as("requested_by_role"),
    requestedById: sql<string>`'stripe_reconciliation'`.as("requested_by_id"), requestedAt: sql<string>`${now}`.as("requested_at"),
    decidedBy: sql<string>`''`.as("decided_by"), decidedAt: sql<string>`''`.as("decided_at"),
    providerImpactCents: sql<number>`0`.as("provider_impact_cents"), customerImpactCents: sql<number>`0`.as("customer_impact_cents"),
    stripeRefundId: sql<string>`''`.as("stripe_refund_id"), stripeDisputeId: sql<string>`''`.as("stripe_dispute_id"),
    transferReversalId: sql<string>`''`.as("transfer_reversal_id"), idempotencyKey: sql<string>`${key}`.as("idempotency_key"),
    createdAt: sql<string>`${now}`.as("created_at"), updatedAt: sql<string>`${now}`.as("updated_at"),
  }).from(stripePayments).where(binding)).onConflictDoNothing();
  const update = db.update(stripePayments).set({ transferId: transfer.id,
    releasedAt: sql`case when ${stripePayments.releasedAt} = '' then ${new Date(transfer.created * 1000).toISOString()}
      else ${stripePayments.releasedAt} end`, updatedAt: now,
  }).where(and(binding, sql`exists (select 1 from payment_adjustments where idempotency_key = ${key}
    and adjustment_type = 'stripe_transfer_reversal_review' and payment_id = ${payment.id} and details = ${details}
    and amount_cents = 0 and provider_impact_cents = 0 and customer_impact_cents = 0 and status = 'review_required')`))
    .returning({ id: stripePayments.id });
  const [, saved] = await db.batch([marker, update] as const);
  requireMatch(saved.length === 1, "The payment changed while recording the reversal. Refresh its review; do not send another transfer.");
}

/** Signed platform event: re-read Stripe, then apply only the exact job transfer. */
export async function recordReversedProviderTransfer(stripe: Stripe, eventTransfer: Stripe.Transfer,
  eventLivemode: boolean, connectedAccountId: string) {
  requireMatch(!connectedAccountId && eventLivemode === stripeLiveModeEnabled(),
    "This transfer notification belongs to another Stripe account or payment mode.");
  requireMatch(typeof eventTransfer.id === "string" && eventTransfer.id.startsWith("tr_"), "Invalid transfer notification.");
  const transfer = await stripe.transfers.retrieve(eventTransfer.id);
  requireMatch(transfer.id === eventTransfer.id, "Stripe returned an unexpected transfer reference.");
  const paymentId = transfer.metadata?.tuveloz_payment_record_id;
  const payments = await getDb().select().from(stripePayments).where(or(eq(stripePayments.transferId, transfer.id),
    paymentId ? eq(stripePayments.id, paymentId) : undefined)).limit(2);
  if (!payments.length && !paymentId) return; // An unrelated platform transfer is not a Tuveloz job.
  requireMatch(payments.length <= 1, "This Stripe transfer matches conflicting payment records. Keep it under review.");
  const payment = payments[0];
  requireMatch(payment, "The transfer's Tuveloz payment is not available yet. Retry reconciliation.");
  const attempt = await savedTransferAttempt(payment);
  requireMatchingTransfer(payment, transfer, attempt);
  if (!payment.transferId) {
    const group = await stripe.transfers.list({ transfer_group: payment.transferGroup!, limit: 2 });
    requireMatch(!group.has_more && group.data.length === 1 && group.data[0].id === transfer.id,
      "The original transfer is not unambiguous. Keep this payment under review.");
  }
  await recordTransferReversalReview(payment, transfer, attempt);
}

export async function recordProviderTransfer(payment: Payment, transfer: Stripe.Transfer, owner: string, attempt?: Attempt) {
  requireMatchingTransfer(payment, transfer, attempt);
  if (transfer.amount_reversed > 0) {
    await recordTransferReversalReview(payment, transfer, attempt);
    throw new TransferReviewError("Stripe reports a full or partial reversal of this provider transfer. The payment is saved for review; no replacement transfer was sent.");
  }
  const [reversalReview] = await getDb().select({ id: paymentAdjustments.id }).from(paymentAdjustments)
    .where(eq(paymentAdjustments.idempotencyKey, transferReversalReviewKey(payment.id))).limit(1);
  requireMatch(!reversalReview, "This transfer has a saved reversal warning. Review Stripe before taking another payment action.");
  const releasedAt = new Date(transfer.created * 1000).toISOString();
  // Recording a money movement must never clear a newer refund, dispute or other hold.
  const [saved] = await getDb().update(stripePayments).set({ transferId: transfer.id,
    status: sql`case when ${stripePayments.status} in ('paid_pending_completion','ready_for_release','released')
      and ${stripePayments.refundAmountCents} = 0 and ${stripePayments.refundStatus} = '' and ${stripePayments.disputeStatus} = ''
      and not exists (select 1 from payment_adjustments where idempotency_key = ${transferReversalReviewKey(payment.id)})
      then 'released' else ${stripePayments.status} end`,
    releasedAt, releasedBy: attempt?.requestedById || payment.releasedBy || owner, updatedAt: new Date().toISOString(),
  }).where(and(samePayment(payment), or(sql`coalesce(${stripePayments.transferId}, '') = ''`, eq(stripePayments.transferId, transfer.id)),
    sql`not exists (select 1 from payment_adjustments where idempotency_key = ${transferReversalReviewKey(payment.id)})`))
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
