import { and, asc, desc, eq, exists, getTableColumns, inArray, ne, sql } from "drizzle-orm";
import type { SQLiteTable } from "drizzle-orm/sqlite-core";
import { getDb } from "../db";
import { customerRequests, jobCancellations, jobIncidents, jobScopeVersions, paymentAdjustments, providerApplications, providerInvoices, providerJobRecords, stripePayments } from "../db/schema";
import { fullRefundPaymentSnapshot, FullRefundReviewError } from "./stripe-full-refund";
import { runtimeMarketplaceActionAllowed } from "./runtime-marketplace-action";
import { refundScopeEvidence } from "./stripe-refund-scope-evidence";

const pendingStatuses = ["submitted", "under_review"];
const approvalKey = (id: string) => `tuveloz-cancellation-approval-${id}`;

async function digest(value: unknown) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(value)));
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, "0")).join("");
}

// Compare the complete saved row inside the transaction, including nulls. JSON
// arrays keep the D1 bind count small; chunks stay below SQLite argument limits.
function unchanged<T extends SQLiteTable>(table: T, row: T["$inferSelect"]) {
  const columns = Object.entries(getTableColumns(table));
  return and(...Array.from({ length: Math.ceil(columns.length / 24) }, (_, index) => {
    const chunk = columns.slice(index * 24, index * 24 + 24);
    return sql`json_array(${sql.join(chunk.map(([, column]) => sql`${column}`), sql`, `)}) = ${JSON.stringify(chunk.map(([key]) => row[key]))}`;
  }));
}

async function factsFor(id: string) {
  const db = getDb();
  const [cancellation] = await db.select().from(jobCancellations).where(eq(jobCancellations.id, id)).limit(1);
  if (!cancellation) throw new FullRefundReviewError("Cancellation not found.", 404);
  const [[job], payments, work, incidents, adjustments] = await Promise.all([
    db.select().from(customerRequests).where(eq(customerRequests.id, cancellation.requestId)).limit(1),
    db.select().from(stripePayments).where(and(eq(stripePayments.requestId, cancellation.requestId),
      eq(stripePayments.quoteId, cancellation.quoteId), ne(stripePayments.paidAt, ""))).orderBy(asc(stripePayments.id)).limit(2),
    db.select().from(providerJobRecords).where(eq(providerJobRecords.requestId, cancellation.requestId)).orderBy(asc(providerJobRecords.id)),
    db.select({ id: jobIncidents.id }).from(jobIncidents).where(and(eq(jobIncidents.requestId, cancellation.requestId), eq(jobIncidents.holdPayments, "yes"))),
    db.select().from(paymentAdjustments).where(and(eq(paymentAdjustments.requestId, cancellation.requestId),
      eq(paymentAdjustments.quoteId, cancellation.quoteId))).orderBy(asc(paymentAdjustments.id)),
  ]);
  if (!job || job.isTestJob !== "no") throw new FullRefundReviewError("Real cancellation not found. Simulation records use the test console.", 404);
  const payment = payments.length === 1 ? payments[0] : null;
  const [provider] = payment ? await db.select().from(providerApplications).where(eq(providerApplications.id, payment.providerApplicationId)).limit(1) : [];
  if (provider?.isTestProvider === "yes") throw new FullRefundReviewError("Simulation records use the test console.", 404);
  // Inspect the paid version, including mismatched rows so missing/mismatched
  // evidence is explicit. Never substitute the current job's newer scope.
  const [scopes, invoices] = payment ? await Promise.all([
    db.select().from(jobScopeVersions).where(and(eq(jobScopeVersions.requestId, cancellation.requestId),
      eq(jobScopeVersions.version, payment.scopeVersion))).orderBy(asc(jobScopeVersions.id)).limit(2),
    db.select().from(providerInvoices).where(and(eq(providerInvoices.requestId, cancellation.requestId),
      eq(providerInvoices.scopeVersion, payment.scopeVersion))).orderBy(asc(providerInvoices.id)).limit(2),
  ]) : [[], []];
  return { cancellation, job, payments, payment, provider: provider ?? null, work, incidents, adjustments, scopes, invoices };
}

function blockersFor(facts: Awaited<ReturnType<typeof factsFor>>) {
  const { cancellation: c, job, payment: p, provider, work, incidents, adjustments } = facts;
  const blockers: string[] = [];
  if (!pendingStatuses.includes(c.status) || c.paymentAdjustmentId || c.decisionAt) blockers.push("This cancellation already has a decision or needs a separate review.");
  if (!["provider_cancel", "provider_no_show", "customer_cancel"].includes(c.cancellationType)) blockers.push("This cancellation type is outside the approved full-refund rule.");
  if (!["assigned", "scheduled", "cancelled"].includes(job.status)) blockers.push("The job is not waiting for work or cancelled.");
  if (c.workPerformedCents !== 0 || c.partsCommittedCents !== 0 || c.retainedAmountCents !== 0
    || work.some(record => record.jobStartDecisionId || record.completionDecisionId || record.timerStartedAt
      || record.trackedSeconds !== 0 || record.billableMinutes !== 0 || record.workStatus !== "scheduled")) blockers.push("Work, parts, or a retained amount needs a separate review.");
  if (incidents.length) blockers.push("An incident still has a payment hold. Resolve that review first.");
  if (!p || !provider || provider.isTestProvider !== "no") blockers.push("A single settled payment and its real provider must be identified.");
  else {
    if (p.paymentType !== "quote" || p.settlementStrategy !== "separate_transfer" || p.currency !== "usd"
      || !p.requestId || !p.quoteId || !p.paymentIntentId || !p.chargeId || p.transferGroup !== `tuveloz_${p.id}`
      || p.id.length > 200 || p.scopeVersion <= 0 || !p.scopeAuthorizationDecisionId || p.authorizedPriceSnapshot === "{}"
      || !Number.isSafeInteger(p.providerAmountCents) || p.providerAmountCents <= 0
      || !Number.isSafeInteger(p.applicationFeeCents) || p.applicationFeeCents < 0
      || !Number.isSafeInteger(p.customerTotalCents) || p.customerTotalCents !== p.providerAmountCents + p.applicationFeeCents) blockers.push("The settled payment or its authorized amount is incomplete.");
    if (p.status !== "paid_pending_completion" || p.transferId || p.releasedAt || p.disputeStatus
      || p.refundStatus || p.lastRefundId || p.refundAmountCents !== 0) blockers.push("A transfer, refund, dispute, or payment hold needs a separate review.");
  }
  if (adjustments.length) blockers.push("This payment already has an adjustment. Review its saved decision and refund status.");
  return blockers;
}

export async function listRefundReviews() {
  const rows = await getDb().select({ id: jobCancellations.id, requestId: jobCancellations.requestId,
    customerName: customerRequests.name, cancellationType: jobCancellations.cancellationType,
    status: jobCancellations.status, requestedAt: jobCancellations.requestedAt })
    .from(jobCancellations).innerJoin(customerRequests, eq(customerRequests.id, jobCancellations.requestId))
    .where(and(eq(customerRequests.isTestJob, "no"), inArray(jobCancellations.status, [...pendingStatuses, "approved"]),
      sql`not exists (select 1 from stripe_payments sp join provider_applications pa on pa.id = sp.provider_application_id
        where sp.request_id = ${jobCancellations.requestId} and sp.quote_id = ${jobCancellations.quoteId} and pa.is_test_provider = 'yes')`))
    .orderBy(sql`case when ${jobCancellations.status} = 'approved' then 1 else 0 end`, desc(jobCancellations.requestedAt), asc(jobCancellations.id)).limit(101);
  return { cases: rows.slice(0, 100), hasMore: rows.length > 100 };
}

export async function getRefundReview(id: string) {
  const facts = await factsFor(id);
  const enabled = await runtimeMarketplaceActionAllowed("refund", { testOnly: false });
  const { cancellation: c, job, payment: p, provider, adjustments } = facts;
  const approval = adjustments.find(row => row.id === c.paymentAdjustmentId && row.adjustmentType === "cancellation_refund");
  const execution = p ? adjustments.find(row => row.idempotencyKey === `tuveloz-full-refund-${p.id}`) : null;
  return {
    cancellationId: c.id, requestId: c.requestId, cancellationType: c.cancellationType,
    reason: c.reason, requestedAt: c.requestedAt, customerName: job.name,
    providerName: provider?.name ?? "Provider not identified", jobStatus: job.status,
    providerTravelStarted: c.providerTravelStarted === "yes", workRecorded: facts.work.some(row => row.workStatus !== "scheduled" || row.jobStartDecisionId || row.trackedSeconds),
    payment: p ? { id: p.id, stripePaymentIntentId: p.paymentIntentId, currency: p.currency, paidAt: p.paidAt, status: p.status,
      providerAmountCents: p.providerAmountCents, customerFeeCents: p.applicationFeeCents,
      customerTotalCents: p.customerTotalCents } : null,
    // An explicit read-only projection of the same facts used for this review.
    // Raw notes, contacts, documents and processor payloads remain private.
    evidence: {
      ...refundScopeEvidence(p, facts.scopes, facts.invoices),
      workRecords: facts.work.map(row => ({ id: row.id, workStatus: row.workStatus,
        jobStartDecisionId: row.jobStartDecisionId, completionDecisionId: row.completionDecisionId,
        trackedSeconds: row.trackedSeconds, billableMinutes: row.billableMinutes })),
      incidentHoldIds: facts.incidents.map(row => row.id),
      payment: p ? { scopeVersion: p.scopeVersion, scopeAuthorizationDecisionId: p.scopeAuthorizationDecisionId,
        transferId: p.transferId ?? "", releasedAt: p.releasedAt, refundAmountCents: p.refundAmountCents,
        refundStatus: p.refundStatus, disputeStatus: p.disputeStatus, lastRefundId: p.lastRefundId } : null,
      adjustments: adjustments.map(row => ({ id: row.id, adjustmentType: row.adjustmentType, status: row.status,
        amountCents: row.amountCents, currency: row.currency, providerImpactCents: row.providerImpactCents,
        customerImpactCents: row.customerImpactCents, stripeRefundId: row.stripeRefundId,
        transferReversalId: row.transferReversalId, requestedAt: row.requestedAt, decidedAt: row.decidedAt })),
    },
    enabled, blockers: blockersFor(facts), reviewToken: await digest(facts),
    approval: approval ? { id: approval.id, status: approval.status, decidedAt: approval.decidedAt,
      reason: c.decisionReason, amountCents: approval.amountCents } : null,
    execution: execution ? { status: execution.status, stripeRefundId: execution.stripeRefundId || null } : null,
  };
}
export type RefundReview = Awaited<ReturnType<typeof getRefundReview>>;
export type RefundReviewQueue = Awaited<ReturnType<typeof listRefundReviews>>;

export async function approveFullRefund(input: { cancellationId: string; reviewToken: string; reason: string }, ownerEmail: string) {
  if (!(await runtimeMarketplaceActionAllowed("refund", { testOnly: false }))) throw new FullRefundReviewError("Refund approvals are not open yet.", 503);
  const db = getDb(), key = approvalKey(input.cancellationId);
  const [existing] = await db.select().from(paymentAdjustments).where(eq(paymentAdjustments.idempotencyKey, key)).limit(1);
  if (existing) {
    let details;
    try { details = JSON.parse(existing.details); } catch { /* Invalid stored record must fail closed. */ }
    if (existing.status !== "approved" || existing.adjustmentType !== "cancellation_refund" || existing.decidedBy !== ownerEmail
      || details?.cancellationId !== input.cancellationId
      || details?.reviewToken !== input.reviewToken || details?.reviewReason !== input.reason) {
      throw new FullRefundReviewError("A decision is already saved. Refresh this cancellation to review it.");
    }
    return { adjustmentId: existing.id, alreadySaved: true, refundSent: false };
  }
  const facts = await factsFor(input.cancellationId);
  if (await digest(facts) !== input.reviewToken) throw new FullRefundReviewError("The records changed. Refresh the review and confirm the updated details.");
  const blockers = blockersFor(facts);
  if (blockers.length) throw new FullRefundReviewError(blockers.join(" "));
  const { cancellation: c, job, payment: p, provider } = facts;
  if (!p || !provider) throw new FullRefundReviewError("A settled payment is required.");
  if (!(await runtimeMarketplaceActionAllowed("refund", { testOnly: false }))) throw new FullRefundReviewError("Refund approvals are not open yet.", 503);
  const id = crypto.randomUUID(), now = new Date().toISOString();
  const details = JSON.stringify({ paymentSnapshot: fullRefundPaymentSnapshot(p), cancellationId: c.id,
    reviewToken: input.reviewToken, reviewReason: input.reason, cancellationReason: c.reason,
    providerTravelStarted: c.providerTravelStarted, processingFeeResponsibility: "tuveloz" });
  const insert = db.insert(paymentAdjustments).select(db.select({
    id: sql<string>`${id}`.as("id"), paymentId: sql<string>`${p.id}`.as("paymentId"),
    requestId: sql<string>`${p.requestId}`.as("requestId"), quoteId: sql<string>`${p.quoteId}`.as("quoteId"),
    adjustmentType: sql<string>`'cancellation_refund'`.as("adjustmentType"),
    amountCents: sql<number>`${p.customerTotalCents}`.as("amountCents"), currency: sql<string>`${p.currency}`.as("currency"),
    status: sql<string>`'approved'`.as("status"), reasonCode: sql<string>`${c.cancellationType}`.as("reasonCode"),
    details: sql<string>`${details}`.as("details"), requestedByRole: sql<string>`'owner'`.as("requestedByRole"),
    requestedById: sql<string>`${ownerEmail}`.as("requestedById"), requestedAt: sql<string>`${now}`.as("requestedAt"),
    decidedBy: sql<string>`${ownerEmail}`.as("decidedBy"), decidedAt: sql<string>`${now}`.as("decidedAt"),
    providerImpactCents: sql<number>`${-p.providerAmountCents}`.as("providerImpactCents"),
    customerImpactCents: sql<number>`${p.customerTotalCents}`.as("customerImpactCents"),
    stripeRefundId: sql<string>`''`.as("stripeRefundId"), stripeDisputeId: sql<string>`''`.as("stripeDisputeId"),
    transferReversalId: sql<string>`''`.as("transferReversalId"), idempotencyKey: sql<string>`${key}`.as("idempotencyKey"),
    createdAt: sql<string>`${now}`.as("createdAt"), updatedAt: sql<string>`${now}`.as("updatedAt"),
  }).from(jobCancellations).where(and(eq(jobCancellations.id, c.id), unchanged(jobCancellations, c),
    exists(db.select({ id: customerRequests.id }).from(customerRequests).where(and(eq(customerRequests.id, job.id), unchanged(customerRequests, job)))),
    exists(db.select({ id: stripePayments.id }).from(stripePayments).where(and(eq(stripePayments.id, p.id), unchanged(stripePayments, p)))),
    exists(db.select({ id: providerApplications.id }).from(providerApplications).where(and(eq(providerApplications.id, provider.id), unchanged(providerApplications, provider)))),
    // Read-only evidence changes invalidate approval, including a row inserted
    // after a review displayed "missing". These are snapshot guards, not new
    // invoice/scope eligibility rules.
    sql`(select count(*) from job_scope_versions where request_id = ${c.requestId} and version = ${p.scopeVersion}) = ${facts.scopes.length}`,
    ...facts.scopes.map(row => exists(db.select({ id: jobScopeVersions.id }).from(jobScopeVersions)
      .where(and(eq(jobScopeVersions.id, row.id), unchanged(jobScopeVersions, row))))),
    sql`(select count(*) from provider_invoices where request_id = ${c.requestId} and scope_version = ${p.scopeVersion}) = ${facts.invoices.length}`,
    ...facts.invoices.map(row => exists(db.select({ id: providerInvoices.id }).from(providerInvoices)
      .where(and(eq(providerInvoices.id, row.id), unchanged(providerInvoices, row))))),
    sql`(select count(*) from stripe_payments where request_id = ${c.requestId} and quote_id = ${c.quoteId} and paid_at <> '') = 1`,
    sql`not exists (select 1 from payment_adjustments where payment_id = ${p.id} or (request_id = ${c.requestId} and quote_id = ${c.quoteId}))`,
    sql`not exists (select 1 from job_incidents where request_id = ${c.requestId} and hold_payments = 'yes')`,
    sql`not exists (select 1 from provider_job_records where request_id = ${c.requestId}
      and (job_start_decision_id <> '' or completion_decision_id <> '' or timer_started_at <> ''
        or tracked_seconds <> 0 or billable_minutes <> 0 or work_status <> 'scheduled'))`,
  )).limit(1)).onConflictDoNothing().returning({ id: paymentAdjustments.id });
  const inserted = exists(db.select({ id: paymentAdjustments.id }).from(paymentAdjustments).where(eq(paymentAdjustments.id, id)));
  const cancel = db.update(jobCancellations).set({ status: "approved", proposedRefundCents: p.customerTotalCents,
    retainedAmountCents: 0, decisionBy: ownerEmail, decisionAt: now, decisionReason: input.reason,
    paymentAdjustmentId: id, updatedAt: now }).where(and(eq(jobCancellations.id, c.id), inserted)).returning({ id: jobCancellations.id });
  const stopJob = db.update(customerRequests).set({ status: "cancelled" })
    .where(and(eq(customerRequests.id, job.id), inserted)).returning({ id: customerRequests.id });
  // All writes share one D1 transaction. A race loses the conditional insert;
  // downstream writes require that unique new decision. A crash rolls back all.
  const [saved, cancelled, stopped] = await db.batch([insert, cancel, stopJob] as const);
  if (!saved.length) throw new FullRefundReviewError("The records changed while saving. Refresh the review before approving.");
  if (cancelled.length !== 1 || stopped.length !== 1) throw new Error("Atomic refund approval invariant failed.");
  return { adjustmentId: id, alreadySaved: false, refundSent: false };
}
