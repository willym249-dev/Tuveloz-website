import { and, eq, exists, getTableColumns, sql, type SQL } from "drizzle-orm";
import type { SQLiteTable } from "drizzle-orm/sqlite-core";
import { getDb } from "../db";
import { customerRequests, jobCancellations, jobChangeOrders, jobLifecycleEvents, paymentAdjustments, providerApplications, providerQuotes } from "../db/schema";
import { prepareJobLifecycleEvent, sha256JobOperationText, type AssignedJobOperationContext } from "./job-operations";
import type { TestRefundPrice, testRefundAllocation } from "./test-refund-allocation";

function unchanged<T extends SQLiteTable>(table: T, row: T["$inferSelect"]) {
  const columns = Object.entries(getTableColumns(table));
  return and(...Array.from({ length: Math.ceil(columns.length / 24) }, (_, index) => {
    const chunk = columns.slice(index * 24, index * 24 + 24);
    return sql`json_array(${sql.join(chunk.map(([, column]) => sql`${column}`), sql`, `)}) = ${JSON.stringify(chunk.map(([key]) => row[key]))}`;
  }));
}

function literals<T extends Record<string, string | number>>(values: T) {
  return Object.fromEntries(Object.entries(values).map(([key, value]) => [key, sql`${value}`.as(key)])) as {
    [K in keyof T]: SQL.Aliased<T[K]>;
  };
}

// Test records only. No Stripe operation or real-refund eligibility is added.
export async function saveTestCancellationDecision(input: {
  context: AssignedJobOperationContext;
  cancellation: typeof jobCancellations.$inferSelect;
  quote: typeof providerQuotes.$inferSelect;
  changes: Array<typeof jobChangeOrders.$inferSelect>;
  priceSnapshot: TestRefundPrice;
  allocation: ReturnType<typeof testRefundAllocation>;
  decision: "approve" | "deny";
  decisionReason: string;
  proposedRefundCents: number;
  retainedAmountCents: number;
  ownerEmail: string;
  now: string;
}) {
  const { context: c, cancellation, quote, changes, priceSnapshot, allocation,
    decision, decisionReason, proposedRefundCents, retainedAmountCents, ownerEmail, now } = input;
  if (!c.isTestJob || !c.isTestProvider) return false;
  const db = getDb();
  const [history] = await db.select({ count: sql<number>`count(*)` }).from(jobLifecycleEvents)
    .where(eq(jobLifecycleEvents.requestId, c.requestId));
  const adjustmentId = decision === "approve" && proposedRefundCents > 0 ? crypto.randomUUID() : "";
  const nextStatus = decision === "approve" ? "approved_test_only" : "denied";
  const event = await prepareJobLifecycleEvent({
    requestId: c.requestId, quoteId: c.quoteId, providerId: c.providerId,
    actorRole: "owner", actorId: ownerEmail,
    eventType: decision === "approve" ? "test_cancellation_approved" : "cancellation_denied",
    fromStatus: c.requestStatus, toStatus: decision === "approve" ? "cancelled" : c.requestStatus,
    scopeVersion: c.scopeVersion, reasonCode: cancellation.cancellationType,
    details: { cancellationId: cancellation.id, proposedRefundCents, retainedAmountCents, priceSnapshot, allocation, stripeExecutionAllowed: false },
  });
  // The unique new event is the transaction's claim. Losing a comparison
  // writes nothing; every later statement requires that exact event ID.
  const claim = db.insert(jobLifecycleEvents).select(db.select(literals(event)).from(jobCancellations).where(and(
    eq(jobCancellations.id, cancellation.id), unchanged(jobCancellations, cancellation),
    exists(db.select({ id: customerRequests.id }).from(customerRequests).where(and(
      eq(customerRequests.id, c.requestId), eq(customerRequests.isTestJob, "yes"), eq(customerRequests.status, c.requestStatus),
      eq(customerRequests.email, c.customerEmail), eq(customerRequests.assignmentVersion, c.assignmentVersion)))),
    exists(db.select({ id: providerApplications.id }).from(providerApplications).where(and(
      eq(providerApplications.id, c.providerId), eq(providerApplications.isTestProvider, "yes"), eq(providerApplications.email, c.providerEmail)))),
    exists(db.select({ id: providerQuotes.id }).from(providerQuotes).where(and(eq(providerQuotes.id, c.quoteId),
      eq(providerQuotes.requestId, c.requestId), eq(providerQuotes.status, "accepted"), eq(providerQuotes.scopeVersion, c.scopeVersion),
      eq(providerQuotes.providerEmail, c.providerEmail), unchanged(providerQuotes, quote)))),
    sql`coalesce((select max(proposed_scope_version) from job_change_orders where request_id = ${c.requestId}
      and quote_id = ${c.quoteId} and status = 'authorized'), 0) = ${changes[0]?.proposedScopeVersion ?? 0}`,
    sql`(select count(*) from job_change_orders where request_id = ${c.requestId} and quote_id = ${c.quoteId}
      and status = 'authorized' and proposed_scope_version = ${changes[0]?.proposedScopeVersion ?? 0}) = ${changes.length}`,
    ...changes.map(change => exists(db.select({ id: jobChangeOrders.id }).from(jobChangeOrders).where(and(
      eq(jobChangeOrders.id, change.id), unchanged(jobChangeOrders, change))))),
    sql`not exists (select 1 from stripe_payments where request_id = ${c.requestId})`,
    sql`not exists (select 1 from payment_adjustments where idempotency_key = ${await sha256JobOperationText(`test-cancellation-refund:${cancellation.id}`)})`,
    sql`(select count(*) from job_lifecycle_events where request_id = ${c.requestId}) = ${history.count}`,
    sql`coalesce((select event_hash from job_lifecycle_events where request_id = ${c.requestId} order by occurred_at desc limit 1), '') = ${event.previousEventHash}`,
  )).limit(1)).returning({ id: jobLifecycleEvents.id });
  const claimed = exists(db.select({ id: jobLifecycleEvents.id }).from(jobLifecycleEvents).where(eq(jobLifecycleEvents.id, event.id)));
  const saveDecision = db.update(jobCancellations).set({
    status: nextStatus, proposedRefundCents, retainedAmountCents, decisionBy: ownerEmail,
    decisionAt: now, decisionReason, paymentAdjustmentId: adjustmentId, updatedAt: now,
  }).where(and(eq(jobCancellations.id, cancellation.id), claimed));
  const saveJob = db.update(customerRequests).set({ status: decision === "approve" ? "cancelled" : c.requestStatus })
    .where(and(eq(customerRequests.id, c.requestId), claimed));
  const values = {
    id: adjustmentId, paymentId: "", requestId: c.requestId, quoteId: c.quoteId, adjustmentType: "cancellation_refund",
    amountCents: proposedRefundCents, currency: "usd", status: "approved_test_only", reasonCode: cancellation.cancellationType,
    details: JSON.stringify({ cancellationId: cancellation.id, priceSnapshot, allocation, testOnly: true, stripeExecutionAllowed: false }),
    requestedByRole: "owner", requestedById: ownerEmail, requestedAt: now, decidedBy: ownerEmail, decidedAt: now,
    providerImpactCents: -(allocation?.providerRefundCents ?? 0), customerImpactCents: proposedRefundCents,
    stripeRefundId: "", stripeDisputeId: "", transferReversalId: "",
    idempotencyKey: await sha256JobOperationText(`test-cancellation-refund:${cancellation.id}`), createdAt: now, updatedAt: now,
  };
  const saveAdjustment = db.insert(paymentAdjustments).select(db.select(literals(values))
    .from(jobLifecycleEvents).where(eq(jobLifecycleEvents.id, event.id)).limit(1));
  const [saved] = adjustmentId
    ? await db.batch([claim, saveDecision, saveAdjustment, saveJob] as const)
    : await db.batch([claim, saveDecision, saveJob] as const);
  return saved.length === 1;
}
