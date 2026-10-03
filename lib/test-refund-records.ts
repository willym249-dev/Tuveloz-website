import { and, eq, exists, getTableColumns, sql, type SQL } from "drizzle-orm";
import type { SQLiteTable } from "drizzle-orm/sqlite-core";
import { getDb } from "../db";
import { customerRequests, jobChangeOrders, jobLifecycleEvents, paymentAdjustments, providerApplications, providerQuotes } from "../db/schema";
import { prepareJobLifecycleEvent, type AssignedJobOperationContext } from "./job-operations";
import type { TestRefundPrice, testRefundAllocation } from "./test-refund-allocation";

type Source = {
  context: AssignedJobOperationContext;
  quote: typeof providerQuotes.$inferSelect;
  changes: Array<typeof jobChangeOrders.$inferSelect>;
};

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

function sourceGuard({ context: c, quote, changes }: Source, count: number, previousHash: string) {
  const db = getDb();
  return and(
    exists(db.select({ id: customerRequests.id }).from(customerRequests).where(and(
      eq(customerRequests.id, c.requestId), eq(customerRequests.isTestJob, "yes"), eq(customerRequests.status, c.requestStatus),
      eq(customerRequests.email, c.customerEmail), eq(customerRequests.assignmentVersion, c.assignmentVersion)))),
    exists(db.select({ id: providerApplications.id }).from(providerApplications).where(and(
      eq(providerApplications.id, c.providerId), eq(providerApplications.isTestProvider, "yes"), eq(providerApplications.email, c.providerEmail)))),
    exists(db.select({ id: providerQuotes.id }).from(providerQuotes).where(and(
      eq(providerQuotes.id, c.quoteId), eq(providerQuotes.requestId, c.requestId), eq(providerQuotes.status, "accepted"),
      eq(providerQuotes.scopeVersion, c.scopeVersion), eq(providerQuotes.providerEmail, c.providerEmail), unchanged(providerQuotes, quote)))),
    sql`coalesce((select max(proposed_scope_version) from job_change_orders where request_id = ${c.requestId}
      and quote_id = ${c.quoteId} and status = 'authorized'), 0) = ${changes[0]?.proposedScopeVersion ?? 0}`,
    sql`(select count(*) from job_change_orders where request_id = ${c.requestId} and quote_id = ${c.quoteId}
      and status = 'authorized' and proposed_scope_version = ${changes[0]?.proposedScopeVersion ?? 0}) = ${changes.length}`,
    ...changes.map(change => exists(db.select({ id: jobChangeOrders.id }).from(jobChangeOrders).where(and(
      eq(jobChangeOrders.id, change.id), unchanged(jobChangeOrders, change))))),
    sql`not exists (select 1 from stripe_payments where request_id = ${c.requestId})`,
    sql`(select count(*) from job_lifecycle_events where request_id = ${c.requestId}) = ${count}`,
    sql`coalesce((select event_hash from job_lifecycle_events where request_id = ${c.requestId} order by occurred_at desc limit 1), '') = ${previousHash}`,
  );
}

// Simulation bookkeeping only. Neither operation calls Stripe or authorizes
// a real refund, a partial-refund policy, or provider recovery.
export async function saveTestRefundRequest(input: Source & {
  id: string; amountCents: number; reasonCode: string; explanation: string;
  priceSnapshot: TestRefundPrice; idempotencyKey: string;
  actorRole: "customer" | "provider"; actorEmail: string; now: string;
}) {
  const { context: c } = input;
  if (!c.isTestJob || !c.isTestProvider) return false;
  const db = getDb();
  const [history] = await db.select({ count: sql<number>`count(*)` }).from(jobLifecycleEvents)
    .where(eq(jobLifecycleEvents.requestId, c.requestId));
  const event = await prepareJobLifecycleEvent({
    requestId: c.requestId, quoteId: c.quoteId, providerId: c.providerId,
    actorRole: input.actorRole, actorId: input.actorEmail, eventType: "refund_requested",
    fromStatus: c.requestStatus, toStatus: c.requestStatus, scopeVersion: c.scopeVersion,
    reasonCode: input.reasonCode, details: { adjustmentId: input.id, amountCents: input.amountCents, stripeExecutionAllowed: false },
  });
  const claim = db.insert(jobLifecycleEvents).select(db.select(literals(event)).from(providerQuotes).where(and(
    eq(providerQuotes.id, c.quoteId), sourceGuard(input, history.count, event.previousEventHash),
    sql`not exists (select 1 from payment_adjustments where idempotency_key = ${input.idempotencyKey})`,
  )).limit(1)).returning({ id: jobLifecycleEvents.id });
  const values = {
    id: input.id, paymentId: "", requestId: c.requestId, quoteId: c.quoteId, adjustmentType: "refund_request",
    amountCents: input.amountCents, currency: "usd", status: "requested", reasonCode: input.reasonCode,
    details: JSON.stringify({ explanation: input.explanation, priceSnapshot: input.priceSnapshot, testOnly: true, stripeExecutionAllowed: false }),
    requestedByRole: input.actorRole, requestedById: input.actorEmail, requestedAt: input.now, decidedBy: "", decidedAt: "",
    providerImpactCents: 0, customerImpactCents: 0, stripeRefundId: "", stripeDisputeId: "", transferReversalId: "",
    idempotencyKey: input.idempotencyKey, createdAt: input.now, updatedAt: input.now,
  };
  const save = db.insert(paymentAdjustments).select(db.select(literals(values)).from(jobLifecycleEvents)
    .where(eq(jobLifecycleEvents.id, event.id)).limit(1));
  const [saved] = await db.batch([claim, save] as const);
  return saved.length === 1;
}

export async function saveTestRefundDecision(input: Source & {
  adjustment: typeof paymentAdjustments.$inferSelect;
  allocation: ReturnType<typeof testRefundAllocation>;
  decision: "approve" | "deny"; decisionReason: string; ownerEmail: string; now: string;
}) {
  const { context: c, adjustment, allocation, decision, decisionReason, ownerEmail, now } = input;
  if (!c.isTestJob || !c.isTestProvider || adjustment.status !== "requested"
    || adjustment.adjustmentType !== "refund_request" || adjustment.requestId !== c.requestId
    || adjustment.quoteId !== c.quoteId || adjustment.currency !== "usd"
    || adjustment.paymentId || adjustment.stripeRefundId || adjustment.stripeDisputeId || adjustment.transferReversalId) return false;
  const db = getDb();
  const [history] = await db.select({ count: sql<number>`count(*)` }).from(jobLifecycleEvents)
    .where(eq(jobLifecycleEvents.requestId, c.requestId));
  const event = await prepareJobLifecycleEvent({
    requestId: c.requestId, quoteId: c.quoteId, providerId: c.providerId, actorRole: "owner", actorId: ownerEmail,
    eventType: decision === "approve" ? "test_refund_approved_no_execution" : "refund_denied",
    fromStatus: c.requestStatus, toStatus: c.requestStatus, scopeVersion: c.scopeVersion,
    reasonCode: adjustment.reasonCode,
    details: { adjustmentId: adjustment.id, amountCents: adjustment.amountCents, allocation, stripeExecutionAllowed: false },
  });
  const claim = db.insert(jobLifecycleEvents).select(db.select(literals(event)).from(paymentAdjustments).where(and(
    eq(paymentAdjustments.id, adjustment.id), unchanged(paymentAdjustments, adjustment),
    sourceGuard(input, history.count, event.previousEventHash),
  )).limit(1)).returning({ id: jobLifecycleEvents.id });
  const save = db.update(paymentAdjustments).set({
    status: decision === "approve" ? "approved_test_only" : "denied",
    details: JSON.stringify({ priorDetails: adjustment.details, decisionReason, allocation, testOnly: true, stripeExecutionAllowed: false }),
    decidedBy: ownerEmail, decidedAt: now, providerImpactCents: allocation ? -allocation.providerRefundCents : 0,
    customerImpactCents: allocation?.customerRefundCents ?? 0, updatedAt: now,
  }).where(and(eq(paymentAdjustments.id, adjustment.id), exists(db.select({ id: jobLifecycleEvents.id })
    .from(jobLifecycleEvents).where(eq(jobLifecycleEvents.id, event.id)))));
  const [saved] = await db.batch([claim, save] as const);
  return saved.length === 1;
}
