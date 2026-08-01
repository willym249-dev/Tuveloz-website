import { and, desc, eq, exists, inArray, notExists, sql } from "drizzle-orm";
import { getDb } from "../../../db";
import {
  customerAgreementAcceptances,
  customerRequests,
  jobCancellations,
  jobChangeOrders,
  jobIncidents,
  jobLifecycleEvents,
  jobScopeVersions,
  paymentAdjustments,
  providerInvoices,
  providerJobRecords,
  providerQuotes,
  stripePayments,
} from "../../../db/schema";
import {
  getAccountSession,
  isSameOriginRequest,
  type AccountRole,
} from "../../../lib/account-auth";
import { customerPriceFor } from "../../../lib/customer-fee";
import { normalizeScheduledFor } from "../../../lib/customer-job-scope";
import {
  appendJobLifecycleEvent,
  assessPayoutReadiness,
  assignedJobOperationContext,
  evaluateAssignedJobStage,
  jobAuthorizationDecisionMatchesContext,
  JOB_OPERATIONS_RULES_VERSION,
  parseExactServiceCodes,
  sha256JobOperationText,
  type AssignedJobOperationContext,
} from "../../../lib/job-operations";
import {
  getAuthenticatedEmail,
  isVerifiedOwnerRequest,
} from "../../../lib/owner-auth";
import {
  evaluateJobScopeFacts,
  jobScopeFactsFromScopeDetails,
  parseJobScopeFacts,
  JOB_SCOPE_FACTS_VERSION,
  type JobScopeFacts,
} from "../../../lib/job-scope-facts";
import { isServiceCode, type ServiceCode } from "../../../lib/provider-policy";
import {
  getStripeClient,
  StripeConfigurationError,
} from "../../../lib/stripe";

const NO_STORE_HEADERS = { "cache-control": "no-store" };
const OPEN_INCIDENT_STATUSES = ["open", "under_review", "insurer_review"];
const OPEN_CANCELLATION_STATUSES = ["submitted", "under_review"];
const MAX_JOB_AMOUNT_CENTS = 10_000_000;
const ACTIVE_CHECKOUT_STATUSES = ["checkout_creating", "checkout_open"];
const SCOPE_CHANGE_BLOCKING_PAYMENT_STATUSES = [
  ...ACTIVE_CHECKOUT_STATUSES,
  "paid_pending_completion",
  "ready_for_release",
  "released",
  "paid_and_transferred",
  "refunded",
  "partially_refunded",
  "disputed",
  "dispute_won_review",
  "dispute_lost",
];

type Actor = {
  role: AccountRole | "owner";
  email: string;
  sessionId: string;
};

function response(data: unknown, status = 200) {
  return Response.json(data, { status, headers: NO_STORE_HEADERS });
}

function clean(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function affirmative(value: unknown) {
  return value === true || value === "yes" || value === "on";
}

function integerCents(value: unknown, allowZero = true) {
  const amount = Number(value);
  if (
    !Number.isInteger(amount)
    || amount < (allowZero ? 0 : 1)
    || amount > MAX_JOB_AMOUNT_CENTS
  ) return null;
  return amount;
}

function requestIp(request: Request) {
  return clean(
    request.headers.get("cf-connecting-ip")
      || request.headers.get("x-forwarded-for")?.split(",")[0]
      || "",
    128,
  );
}

function dateAtOrBeforeNow(value: unknown) {
  const text = clean(value, 40);
  if (!text) return new Date().toISOString();
  const time = Date.parse(text);
  return Number.isFinite(time) && time <= Date.now() + 5 * 60_000
    ? new Date(time).toISOString()
    : "";
}

function parseJsonRecord(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

async function actorFor(request: Request): Promise<Actor | null> {
  if (await isVerifiedOwnerRequest(request)) {
    return {
      role: "owner",
      email: getAuthenticatedEmail(request) || "verified-owner",
      sessionId: "",
    };
  }
  const session = await getAccountSession(request);
  if (!session) return null;
  return {
    role: session.role,
    email: session.email,
    sessionId: session.id,
  };
}

function actorCanAccess(actor: Actor, context: AssignedJobOperationContext) {
  if (actor.role === "owner") return true;
  const email = actor.email.toLowerCase();
  return actor.role === "customer"
    ? email === context.customerEmail.toLowerCase()
    : email === context.providerEmail.toLowerCase();
}

async function authorizedTestContext(
  requestId: string,
  actor: Actor,
) {
  const context = await assignedJobOperationContext(requestId);
  if (!context) {
    return { context: null, error: response({ error: "Accepted job assignment not found." }, 404) };
  }
  if (!actorCanAccess(actor, context)) {
    return { context: null, error: response({ error: "You cannot access this job." }, 403) };
  }
  if (!context.isTestJob || !context.isTestProvider) {
    return {
      context: null,
      error: response({
        error: "Real job operations remain disabled. Only isolated persisted test jobs can use this workflow.",
        code: "REAL_JOB_OPERATIONS_DISABLED",
      }, 503),
    };
  }
  return { context, error: null };
}

function requireRole(actor: Actor, ...roles: Actor["role"][]) {
  return roles.includes(actor.role)
    ? null
    : response({ error: `${roles.join(" or ")} access required.` }, 403);
}

function validatedServiceCodes(value: unknown): ServiceCode[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const result: ServiceCode[] = [];
  for (const item of value) {
    if (!isServiceCode(item) || item === "general_auto_repair") return null;
    if (!result.includes(item)) result.push(item);
  }
  return result;
}

function stringList(value: unknown) {
  const values = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : [];
  return values.map((item) => clean(item, 160)).filter(Boolean);
}

function candidateJobFacts(
  body: Record<string, unknown>,
  serviceCodes: readonly ServiceCode[],
): { facts: JobScopeFacts | null; reasons: ReturnType<typeof evaluateJobScopeFacts>["reasons"] } {
  let candidate: unknown = body.jobFacts;
  if (candidate === undefined) {
    const requestedOperations = Array.isArray(body.requestedOperations)
      ? body.requestedOperations.map((item) => {
          if (item && typeof item === "object" && !Array.isArray(item)) return item;
          const [serviceCode = "", operationCode = ""] = clean(item, 340).split(":", 2);
          return { serviceCode, operationCode };
        })
      : [];
    candidate = {
      version: JOB_SCOPE_FACTS_VERSION,
      requestedOperations,
      prohibitedOperationsAttestedAbsent: stringList(
        body.prohibitedOperationsAttestedAbsent,
      ),
      location: {
        type: clean(body.jobLocationType, 80),
        address: clean(body.serviceAddress, 240),
        propertyPermission: clean(body.propertyPermission, 80),
      },
      vehicle: {
        driveability: clean(body.vehicleDriveability, 80),
        state: clean(body.vehicleState, 80),
        highVoltageStatus: clean(body.highVoltageStatus, 80),
      },
      safetyAttestations: stringList(body.safetyAttestations),
    };
  }
  const facts = parseJobScopeFacts(candidate);
  const evaluation = evaluateJobScopeFacts(serviceCodes, facts);
  return { facts: evaluation.facts, reasons: evaluation.reasons };
}

type InvalidatedCheckout = {
  paymentId: string;
  checkoutSessionId: string;
  priorStatus: string;
};

async function invalidateStaleCheckoutBeforeScopeChange(input: {
  requestId: string;
  quoteId: string;
  providerId: string;
  requestStatus: string;
  changeOrderId: string;
  currentScopeVersion: number;
  currentAuthorizationDecisionId: string;
  changedAt: string;
}) {
  const db = getDb();
  const payments = await db.select({
    id: stripePayments.id,
    status: stripePayments.status,
    checkoutSessionId: stripePayments.checkoutSessionId,
    paymentIntentId: stripePayments.paymentIntentId,
    paidAt: stripePayments.paidAt,
    scopeVersion: stripePayments.scopeVersion,
    scopeAuthorizationDecisionId: stripePayments.scopeAuthorizationDecisionId,
  }).from(stripePayments).where(and(
    eq(stripePayments.requestId, input.requestId),
    eq(stripePayments.quoteId, input.quoteId),
    inArray(stripePayments.status, SCOPE_CHANGE_BLOCKING_PAYMENT_STATUSES),
  ));
  const paidOrFinancial = payments.find((payment) => (
    !ACTIVE_CHECKOUT_STATUSES.includes(payment.status)
    || Boolean(payment.paymentIntentId)
    || Boolean(payment.paidAt)
  ));
  if (paidOrFinancial) {
    return {
      ok: false as const,
      status: 409,
      code: "PAID_SCOPE_CHANGE_REQUIRES_SEPARATE_REVIEW",
      error: "This job already has a paid, refunded, disputed, transferred, or otherwise financial payment record. Its scope and price cannot be replaced by the change-order workflow.",
      invalidated: [] as InvalidatedCheckout[],
    };
  }

  const active = payments.filter((payment) => (
    ACTIVE_CHECKOUT_STATUSES.includes(payment.status)
  ));
  const invalidated: InvalidatedCheckout[] = [];
  for (const payment of active) {
    if (
      payment.scopeVersion !== input.currentScopeVersion
      || payment.scopeAuthorizationDecisionId !== input.currentAuthorizationDecisionId
    ) {
      return {
        ok: false as const,
        status: 409,
        code: "CHECKOUT_SCOPE_SNAPSHOT_INCONSISTENT",
        error: "An open Checkout record is not bound to the current authorized job scope. Owner review is required before changing the job.",
        invalidated,
      };
    }
    if (payment.checkoutSessionId) {
      try {
        const stripeClient = getStripeClient();
        const session = await stripeClient.checkout.sessions.retrieve(
          payment.checkoutSessionId,
        );
        if (
          session.livemode
          || session.metadata?.tuveloz_payment_record_id !== payment.id
          || session.metadata?.tuveloz_request_id !== input.requestId
          || session.metadata?.tuveloz_quote_id !== input.quoteId
          || session.metadata?.tuveloz_scope_version !== String(input.currentScopeVersion)
          || session.metadata?.tuveloz_scope_authorization_id
            !== input.currentAuthorizationDecisionId
        ) {
          return {
            ok: false as const,
            status: 409,
            code: "CHECKOUT_SESSION_BINDING_MISMATCH",
            error: "The existing Checkout Session could not be proven to belong to this exact test-mode scope. It was not changed.",
            invalidated,
          };
        }
        if (session.status === "complete") {
          return {
            ok: false as const,
            status: 409,
            code: "CHECKOUT_ALREADY_COMPLETED",
            error: "The existing Checkout Session has completed and requires payment review before any scope change.",
            invalidated,
          };
        }
        if (session.status === "open") {
          const expired = await stripeClient.checkout.sessions.expire(session.id);
          if (expired.status !== "expired") {
            return {
              ok: false as const,
              status: 502,
              code: "CHECKOUT_EXPIRATION_NOT_CONFIRMED",
              error: "Stripe did not confirm that the old Checkout URL expired. The scope remains unchanged.",
              invalidated,
            };
          }
        }
      } catch (error) {
        const configuration = error instanceof StripeConfigurationError;
        if (!configuration) {
          console.error("Unable to expire a stale test Checkout Session", error);
        }
        return {
          ok: false as const,
          status: configuration ? 503 : 502,
          code: configuration
            ? "TEST_STRIPE_CLIENT_UNAVAILABLE"
            : "CHECKOUT_EXPIRATION_FAILED",
          error: configuration
            ? "The guarded Stripe test client is unavailable, so the old Checkout URL cannot be proven unusable. The scope remains unchanged."
            : "The old Checkout URL could not be expired. The scope remains unchanged.",
          invalidated,
        };
      }
    }

    const [previousEvent] = await db.select({
      eventHash: jobLifecycleEvents.eventHash,
    }).from(jobLifecycleEvents)
      .where(eq(jobLifecycleEvents.requestId, input.requestId))
      .orderBy(desc(jobLifecycleEvents.occurredAt))
      .limit(1);
    const eventId = crypto.randomUUID();
    const previousEventHash = previousEvent?.eventHash || "";
    const eventDetails = JSON.stringify({
      changeOrderId: input.changeOrderId,
      paymentId: payment.id,
      checkoutSessionId: payment.checkoutSessionId || "",
      priorStatus: payment.status,
      liveStripeAllowed: false,
    });
    const eventType = "checkout_invalidated_before_scope_change";
    const reasonCode = "old_checkout_url_expired_before_scope_or_price_change";
    const eventHash = await sha256JobOperationText(JSON.stringify({
      id: eventId,
      requestId: input.requestId,
      quoteId: input.quoteId,
      providerId: input.providerId,
      actorRole: "system",
      actorId: "stripe-checkout-scope-guard",
      eventType,
      fromStatus: input.requestStatus,
      toStatus: input.requestStatus,
      scopeVersion: input.currentScopeVersion,
      reasonCode,
      details: eventDetails,
      occurredAt: input.changedAt,
      previousEventHash,
      rulesVersion: JOB_OPERATIONS_RULES_VERSION,
    }));
    const invalidationUpdate = db.update(stripePayments).set({
      status: "checkout_invalidated_scope_change",
      updatedAt: input.changedAt,
    }).where(and(
      eq(stripePayments.id, payment.id),
      inArray(stripePayments.status, ACTIVE_CHECKOUT_STATUSES),
      eq(stripePayments.scopeVersion, input.currentScopeVersion),
      eq(
        stripePayments.scopeAuthorizationDecisionId,
        input.currentAuthorizationDecisionId,
      ),
    )).returning({ id: stripePayments.id });
    const auditInsert = db.insert(jobLifecycleEvents).select(db.select({
      id: sql<string>`${eventId}`,
      requestId: sql<string>`${input.requestId}`,
      quoteId: sql<string>`${input.quoteId}`,
      providerId: sql<string>`${input.providerId}`,
      actorRole: sql<string>`system`,
      actorId: sql<string>`stripe-checkout-scope-guard`,
      eventType: sql<string>`${eventType}`,
      fromStatus: sql<string>`${input.requestStatus}`,
      toStatus: sql<string>`${input.requestStatus}`,
      scopeVersion: sql<number>`${input.currentScopeVersion}`,
      authorizationSnapshotId: sql<string>``,
      reasonCode: sql<string>`${reasonCode}`,
      details: sql<string>`${eventDetails}`,
      previousEventHash: sql<string>`${previousEventHash}`,
      eventHash: sql<string>`${eventHash}`,
      occurredAt: sql<string>`${input.changedAt}`,
      createdAt: sql<string>`${input.changedAt}`,
    }).from(stripePayments).where(and(
      eq(stripePayments.id, payment.id),
      eq(stripePayments.status, "checkout_invalidated_scope_change"),
      eq(stripePayments.updatedAt, input.changedAt),
    )).limit(1)).returning({ id: jobLifecycleEvents.id });
    const invalidationBatch = await db.batch([
      invalidationUpdate,
      auditInsert,
    ] as const);
    if (!invalidationBatch[0].length || !invalidationBatch[1].length) {
      return {
        ok: false as const,
        status: 409,
        code: "CHECKOUT_STATE_CHANGED_DURING_INVALIDATION",
        error: "The Checkout payment state changed while the old session was being invalidated. The scope remains unchanged for review.",
        invalidated,
      };
    }
    invalidated.push({
      paymentId: payment.id,
      checkoutSessionId: payment.checkoutSessionId || "",
      priorStatus: payment.status,
    });
  }
  return { ok: true as const, invalidated };
}

async function acceptedQuoteAmounts(context: AssignedJobOperationContext) {
  const [quote] = await getDb().select({
    providerAmountCents: providerQuotes.priceCents,
    laborAmountCents: providerQuotes.laborPriceCents,
    partsAmountCents: providerQuotes.partsPriceCents,
    customerFeeRateBps: providerQuotes.customerFeeRateBps,
  }).from(providerQuotes)
    .where(eq(providerQuotes.id, context.quoteId))
    .limit(1);
  return {
    providerAmountCents: Number(quote?.providerAmountCents || 0),
    laborAmountCents: Number(quote?.laborAmountCents || 0),
    partsAmountCents: Number(quote?.partsAmountCents || 0),
    customerFeeRateBps: Number(quote?.customerFeeRateBps || 0),
  };
}

type CompletePriceBreakdown = {
  laborAmountCents: number;
  partsAmountCents: number;
  taxAmountCents: number;
  otherAmountCents: number;
  totalAmountCents: number;
  customerFeeRateBps: number;
  customerFeeCents: number;
  customerTotalCents: number;
};

function completePriceBreakdown(value: string): CompletePriceBreakdown | null {
  const parsed = parseJsonRecord(value);
  const fields = [
    "laborAmountCents",
    "partsAmountCents",
    "taxAmountCents",
    "otherAmountCents",
    "totalAmountCents",
    "customerFeeRateBps",
    "customerFeeCents",
    "customerTotalCents",
  ] as const;
  const numbers = Object.fromEntries(fields.map((field) => [field, Number(parsed[field])])) as Record<(typeof fields)[number], number>;
  if (
    fields.some((field) => !Number.isInteger(numbers[field]) || numbers[field] < 0)
    || numbers.totalAmountCents <= 0
    || numbers.totalAmountCents > MAX_JOB_AMOUNT_CENTS
    || numbers.partsAmountCents !== 0
    || numbers.taxAmountCents !== 0
    || numbers.otherAmountCents !== 0
    || numbers.totalAmountCents !== numbers.laborAmountCents
    || numbers.laborAmountCents + numbers.partsAmountCents
      + numbers.taxAmountCents + numbers.otherAmountCents !== numbers.totalAmountCents
  ) return null;
  const customerPrice = customerPriceFor(
    numbers.totalAmountCents,
    numbers.customerFeeRateBps,
  );
  if (
    customerPrice.customerFeeCents !== numbers.customerFeeCents
    || customerPrice.customerTotalCents !== numbers.customerTotalCents
  ) return null;
  return numbers as CompletePriceBreakdown;
}

function priceTotal(value: string) {
  return completePriceBreakdown(value)?.totalAmountCents ?? null;
}

async function authorizedJobTotal(context: AssignedJobOperationContext) {
  const [latestAuthorized] = await getDb().select({
    priceBreakdown: jobChangeOrders.priceBreakdown,
  }).from(jobChangeOrders)
    .where(and(
      eq(jobChangeOrders.requestId, context.requestId),
      eq(jobChangeOrders.status, "authorized"),
    ))
    .orderBy(desc(jobChangeOrders.proposedScopeVersion))
    .limit(1);
  const changedTotal = latestAuthorized
    ? priceTotal(latestAuthorized.priceBreakdown)
    : null;
  return changedTotal ?? (await acceptedQuoteAmounts(context)).providerAmountCents;
}

async function openOperationalBlocks(requestId: string) {
  const db = getDb();
  const [incidents, cancellations, changes] = await Promise.all([
    db.select().from(jobIncidents).where(eq(jobIncidents.requestId, requestId)),
    db.select().from(jobCancellations).where(eq(jobCancellations.requestId, requestId)),
    db.select().from(jobChangeOrders).where(eq(jobChangeOrders.requestId, requestId)),
  ]);
  return {
    incidents: incidents.filter((item) => (
      OPEN_INCIDENT_STATUSES.includes(item.status) || item.holdPayments === "yes"
    )),
    cancellations: cancellations.filter((item) => OPEN_CANCELLATION_STATUSES.includes(item.status)),
    changes: changes.filter((item) => item.status === "pending_customer"),
  };
}

export async function GET(request: Request) {
  const actor = await actorFor(request);
  if (!actor) return response({ error: "Sign in to open job operations." }, 401);
  const requestId = clean(new URL(request.url).searchParams.get("requestId"), 80);
  if (!requestId) return response({ error: "Choose a job." }, 400);
  const access = await authorizedTestContext(requestId, actor);
  if (access.error || !access.context) return access.error;

  const db = getDb();
  const [cancellations, incidents, changes, invoices, adjustments, lifecycle] = await Promise.all([
    db.select().from(jobCancellations)
      .where(eq(jobCancellations.requestId, requestId))
      .orderBy(desc(jobCancellations.createdAt)),
    db.select().from(jobIncidents)
      .where(eq(jobIncidents.requestId, requestId))
      .orderBy(desc(jobIncidents.createdAt)),
    db.select().from(jobChangeOrders)
      .where(eq(jobChangeOrders.requestId, requestId))
      .orderBy(desc(jobChangeOrders.proposedScopeVersion)),
    db.select().from(providerInvoices)
      .where(eq(providerInvoices.requestId, requestId))
      .orderBy(desc(providerInvoices.scopeVersion)),
    db.select().from(paymentAdjustments)
      .where(eq(paymentAdjustments.requestId, requestId))
      .orderBy(desc(paymentAdjustments.createdAt)),
    db.select({
      id: jobLifecycleEvents.id,
      eventType: jobLifecycleEvents.eventType,
      actorRole: jobLifecycleEvents.actorRole,
      fromStatus: jobLifecycleEvents.fromStatus,
      toStatus: jobLifecycleEvents.toStatus,
      scopeVersion: jobLifecycleEvents.scopeVersion,
      reasonCode: jobLifecycleEvents.reasonCode,
      occurredAt: jobLifecycleEvents.occurredAt,
    }).from(jobLifecycleEvents)
      .where(eq(jobLifecycleEvents.requestId, requestId))
      .orderBy(desc(jobLifecycleEvents.occurredAt)),
  ]);

  return response({
    testOnly: true,
    transferExecutionEnabled: false,
    actorRole: actor.role,
    job: {
      requestId,
      status: access.context.requestStatus,
      scopeVersion: access.context.scopeVersion,
      serviceCodes: access.context.serviceCodes,
      scheduledFor: access.context.scheduledFor,
    },
    cancellations: cancellations.map((item) => ({
      id: item.id,
      cancellationType: item.cancellationType,
      reason: item.reason,
      status: item.status,
      scheduledFor: item.scheduledFor,
      requestedByRole: item.requestedByRole,
      requestedAt: item.requestedAt,
      noticeHours: item.noticeHours,
      providerTravelStarted: item.providerTravelStarted,
      partsCommittedCents: item.partsCommittedCents,
      workPerformedCents: item.workPerformedCents,
      proposedRefundCents: item.proposedRefundCents,
      retainedAmountCents: item.retainedAmountCents,
      decisionAt: item.decisionAt,
      decisionReason: item.decisionReason,
    })),
    incidents: incidents.map((item) => ({
      id: item.id,
      incidentType: item.incidentType,
      severity: item.severity,
      summary: item.summary,
      occurredAt: item.occurredAt,
      locationSummary: item.locationSummary,
      injuryReported: item.injuryReported,
      propertyDamageReported: item.propertyDamageReported,
      emergencyServicesContacted: item.emergencyServicesContacted,
      workStoppedAt: item.workStoppedAt,
      insurerNotifiedAt: item.insurerNotifiedAt,
      status: item.status,
      holdPayments: item.holdPayments,
      resolution: item.resolution,
      resolvedAt: item.resolvedAt,
    })),
    changeOrders: changes.map((item) => ({
      id: item.id,
      priorScopeVersion: item.priorScopeVersion,
      proposedScopeVersion: item.proposedScopeVersion,
      serviceCodes: parseExactServiceCodes(item.serviceCodes),
      scopeDetails: parseJsonRecord(item.scopeDetails),
      priceBreakdown: parseJsonRecord(item.priceBreakdown),
      reason: item.reason,
      status: item.status,
      providerApprovedAt: item.providerApprovedAt,
      customerAuthorizedAt: item.customerAuthorizedAt,
      customerDeclinedAt: item.customerDeclinedAt,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    })),
    invoices: invoices.map((item) => ({
      id: item.id,
      invoiceNumber: item.invoiceNumber,
      scopeVersion: item.scopeVersion,
      serviceCodes: parseExactServiceCodes(item.serviceCodes),
      laborAmountCents: item.laborAmountCents,
      partsAmountCents: item.partsAmountCents,
      taxAmountCents: item.taxAmountCents,
      otherAmountCents: item.otherAmountCents,
      totalAmountCents: item.totalAmountCents,
      partsDescription: item.partsDescription,
      returnedPartsChoice: item.returnedPartsChoice,
      warrantyProvider: item.warrantyProvider,
      warrantyTerms: item.warrantyTerms,
      workSummary: item.workSummary,
      status: item.status,
      issuedAt: item.issuedAt,
      customerViewedAt: item.customerViewedAt,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    })),
    paymentAdjustments: adjustments.map((item) => ({
      id: item.id,
      adjustmentType: item.adjustmentType,
      amountCents: item.amountCents,
      currency: item.currency,
      status: item.status,
      reasonCode: item.reasonCode,
      requestedByRole: item.requestedByRole,
      requestedAt: item.requestedAt,
      decidedAt: item.decidedAt,
      providerImpactCents: item.providerImpactCents,
      customerImpactCents: item.customerImpactCents,
    })),
    lifecycle,
  });
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return response({ error: "Cross-origin job operations are not allowed." }, 403);
  }
  const actor = await actorFor(request);
  if (!actor) return response({ error: "Sign in to manage job operations." }, 401);
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return response({ error: "Enter a valid job operation." }, 400);
  const action = clean(body.action, 60);
  const requestId = clean(body.requestId, 80);
  if (!requestId) return response({ error: "Choose a job." }, 400);
  const access = await authorizedTestContext(requestId, actor);
  if (access.error || !access.context) return access.error;
  const context = access.context;
  const db = getDb();
  const now = new Date().toISOString();

  if (action === "propose-change-order") {
    const roleError = requireRole(actor, "provider");
    if (roleError) return roleError;
    if (["completed", "cancelled"].includes(context.requestStatus)) {
      return response({ error: "Scope cannot change after completion or cancellation." }, 409);
    }
    const serviceCodes = validatedServiceCodes(body.serviceCodes);
    const reason = clean(body.reason, 1000);
    const scopeDescription = clean(body.scopeDescription, 2500);
    const partsResponsibility = "Customer supplies any needed parts separately";
    const requestedSchedule = clean(body.scheduledFor, 80);
    const scheduledFor = requestedSchedule
      ? normalizeScheduledFor(requestedSchedule)
      : context.scheduledFor;
    const laborAmountCents = integerCents(body.laborAmountCents);
    const partsAmountCents = integerCents(body.partsAmountCents ?? 0);
    const taxAmountCents = integerCents(body.taxAmountCents ?? 0);
    const otherAmountCents = integerCents(body.otherAmountCents ?? 0);
    if (
      !serviceCodes
      || reason.length < 5
      || scopeDescription.length < 5
      || !scheduledFor
      || laborAmountCents === null
      || partsAmountCents === null
      || taxAmountCents === null
      || otherAmountCents === null
    ) {
      return response({ error: "Enter exact services, the full changed labor scope, reason, schedule, and a valid labor amount." }, 400);
    }
    if (partsAmountCents !== 0 || taxAmountCents !== 0 || otherAmountCents !== 0) {
      return response({
        error: "A Tuveloz change order may change labor only. Provider-supplied parts, parts reimbursement, parts tax, and other charges cannot be included.",
        code: "LABOR_ONLY_CHANGE_ORDER_REQUIRED",
      }, 400);
    }
    if (
      requestedSchedule
      && scheduledFor !== context.scheduledFor
      && Date.parse(scheduledFor) < Date.now() - 5 * 60_000
    ) {
      return response({ error: "A changed service schedule must identify the current or a future work time for customer approval." }, 400);
    }
    const jobFactsCheck = candidateJobFacts(body, serviceCodes);
    if (!jobFactsCheck.facts || jobFactsCheck.reasons.length) {
      return response({
        error: jobFactsCheck.reasons[0]?.detail
          || "Enter the complete exact operation, location, vehicle, and safety facts for the changed scope.",
        code: jobFactsCheck.reasons[0]?.code || "CHANGE_ORDER_JOB_FACTS_REQUIRED",
        reasons: jobFactsCheck.reasons,
      }, 400);
    }
    const jobFacts = jobFactsCheck.facts;
    const totalAmountCents = laborAmountCents;
    if (totalAmountCents <= 0 || totalAmountCents > MAX_JOB_AMOUNT_CENTS) {
      return response({ error: "The complete changed-scope total is invalid." }, 400);
    }
    const blocks = await openOperationalBlocks(requestId);
    if (blocks.incidents.length || blocks.cancellations.length || blocks.changes.length) {
      return response({ error: "Resolve the existing incident, cancellation, or pending change order before proposing another scope." }, 409);
    }
    const proposedScopeVersion = context.scopeVersion + 1;
    const currentQuote = await acceptedQuoteAmounts(context);
    const customerPrice = customerPriceFor(
      totalAmountCents,
      currentQuote.customerFeeRateBps,
    );
    const stageDecision = await evaluateAssignedJobStage({
      requestId,
      providerEmail: actor.email,
      stage: "scope_change",
      serviceCodes,
      scopeVersion: proposedScopeVersion,
      candidateJobFacts: jobFacts,
      scheduledFor,
      effectiveAt: now,
    });
    if (!stageDecision.allowed || !stageDecision.result?.decisionId) {
      return response({
        error: stageDecision.error,
        code: "SCOPE_CHANGE_NOT_ELIGIBLE",
        reasons: stageDecision.result?.reasons ?? [],
      }, stageDecision.status);
    }
    const changeOrderId = crypto.randomUUID();
    await db.batch([
      db.insert(jobChangeOrders).values({
      id: changeOrderId,
      requestId,
      quoteId: context.quoteId,
      priorScopeVersion: context.scopeVersion,
      proposedScopeVersion,
      serviceCodes: JSON.stringify(serviceCodes),
      scopeDetails: JSON.stringify({
        description: scopeDescription,
        partsResponsibility,
        scheduledFor,
        jobFacts,
      }),
      priceBreakdown: JSON.stringify({
        laborAmountCents,
        partsAmountCents,
        taxAmountCents,
        otherAmountCents,
        totalAmountCents,
        customerFeeRateBps: customerPrice.customerFeeRateBps,
        customerFeeCents: customerPrice.customerFeeCents,
        customerTotalCents: customerPrice.customerTotalCents,
      }),
      reason,
      requestedByProviderId: context.providerId,
      requestedByPersonId: context.personId,
      status: "pending_customer",
      providerApprovedAt: now,
      authorizationSnapshotId: stageDecision.result.decisionId,
      createdAt: now,
      updatedAt: now,
      }),
      db.update(providerJobRecords).set({
        workStatus: "waiting for customer authorization",
        timerStartedAt: "",
        updatedAt: now,
      }).where(and(
        eq(providerJobRecords.requestId, requestId),
        eq(providerJobRecords.providerEmail, context.providerEmail),
      )),
    ] as const);
    await appendJobLifecycleEvent({
      requestId,
      quoteId: context.quoteId,
      providerId: context.providerId,
      actorRole: "provider",
      actorId: actor.email,
      eventType: "change_order_proposed",
      fromStatus: context.requestStatus,
      toStatus: context.requestStatus,
      scopeVersion: proposedScopeVersion,
      authorizationSnapshotId: stageDecision.result.decisionId,
      reasonCode: "additional_work_requires_customer_authorization",
      details: {
        changeOrderId,
        totalAmountCents,
        customerFeeCents: customerPrice.customerFeeCents,
        customerTotalCents: customerPrice.customerTotalCents,
        serviceCodes,
        scheduledFor,
      },
    });
    return response({ ok: true, changeOrderId, status: "pending_customer" }, 201);
  }

  if (action === "authorize-change-order") {
    const roleError = requireRole(actor, "customer");
    if (roleError) return roleError;
    const changeOrderId = clean(body.changeOrderId, 80);
    const decision = clean(body.decision, 20);
    const acceptedByName = clean(body.acceptedByName, 160);
    const [order] = await db.select().from(jobChangeOrders)
      .where(and(
        eq(jobChangeOrders.id, changeOrderId),
        eq(jobChangeOrders.requestId, requestId),
      )).limit(1);
    if (!order) return response({ error: "Change order not found." }, 404);
    if (order.status !== "pending_customer") {
      return response({ error: "This change order was already decided." }, 409);
    }
    if (decision === "decline") {
      const stillPending = db.select({ id: jobChangeOrders.id })
        .from(jobChangeOrders)
        .where(and(
          eq(jobChangeOrders.id, order.id),
          eq(jobChangeOrders.requestId, requestId),
          eq(jobChangeOrders.quoteId, context.quoteId),
          eq(jobChangeOrders.status, "pending_customer"),
        ));
      const declinedBatch = await db.batch([
        db.update(providerJobRecords).set({
          workStatus: "scheduled",
          timerStartedAt: "",
          updatedAt: now,
        }).where(and(
          eq(providerJobRecords.requestId, requestId),
          eq(providerJobRecords.providerEmail, context.providerEmail),
          exists(stillPending),
        )),
        db.update(jobChangeOrders).set({
          status: "declined",
          customerDeclinedAt: now,
          updatedAt: now,
        }).where(and(
          eq(jobChangeOrders.id, order.id),
          eq(jobChangeOrders.requestId, requestId),
          eq(jobChangeOrders.quoteId, context.quoteId),
          eq(jobChangeOrders.status, "pending_customer"),
        )).returning({ id: jobChangeOrders.id }),
      ] as const);
      if (!declinedBatch[1].length) {
        return response({ error: "This change order was already decided." }, 409);
      }
      await appendJobLifecycleEvent({
        requestId,
        quoteId: context.quoteId,
        providerId: context.providerId,
        actorRole: "customer",
        actorId: actor.email,
        eventType: "change_order_declined",
        fromStatus: context.requestStatus,
        toStatus: context.requestStatus,
        scopeVersion: order.proposedScopeVersion,
        reasonCode: "customer_declined_added_work",
        details: { changeOrderId: order.id },
      });
      return response({ ok: true, status: "declined" });
    }
    if (
      decision !== "authorize"
      || !affirmative(body.authorizationAccepted)
      || acceptedByName.length < 2
    ) {
      return response({ error: "Type your name and affirmatively authorize the complete changed scope and price." }, 400);
    }
    const serviceCodes = parseExactServiceCodes(order.serviceCodes);
    const scopeDetails = parseJsonRecord(order.scopeDetails);
    const scheduledFor = normalizeScheduledFor(scopeDetails.scheduledFor);
    const prices = completePriceBreakdown(order.priceBreakdown);
    const jobFacts = jobScopeFactsFromScopeDetails(order.scopeDetails);
    const jobFactsCheck = evaluateJobScopeFacts(serviceCodes, jobFacts);
    const [priorScope] = await db.select({
      id: jobScopeVersions.id,
      authorizationDecisionId: jobScopeVersions.authorizationDecisionId,
    })
      .from(jobScopeVersions)
      .where(and(
        eq(jobScopeVersions.requestId, requestId),
        eq(jobScopeVersions.quoteId, context.quoteId),
        eq(jobScopeVersions.version, order.priorScopeVersion),
      ))
      .limit(1);
    if (
      serviceCodes.length === 0
      || !scheduledFor
      || !prices
      || !jobFactsCheck.allowed
      || !jobFactsCheck.facts
      || !priorScope
      || !priorScope.authorizationDecisionId
      || order.priorScopeVersion !== context.scopeVersion
    ) {
      return response({
        error: "The pending change no longer has a complete authorized prior scope, schedule, exact-service set, or price breakdown.",
        code: "CHANGE_ORDER_FACTS_INCOMPLETE",
      }, 409);
    }
    const stageDecision = await evaluateAssignedJobStage({
      requestId,
      stage: "scope_change",
      serviceCodes,
      scopeVersion: order.proposedScopeVersion,
      candidateJobFacts: jobFactsCheck.facts,
      scheduledFor,
      effectiveAt: now,
    });
    if (!stageDecision.allowed || !stageDecision.result?.decisionId) {
      return response({
        error: stageDecision.error,
        code: "SCOPE_CHANGE_NO_LONGER_ELIGIBLE",
        reasons: stageDecision.result?.reasons ?? [],
      }, stageDecision.status);
    }
    const checkoutInvalidation = await invalidateStaleCheckoutBeforeScopeChange({
      requestId,
      quoteId: context.quoteId,
      providerId: context.providerId,
      requestStatus: context.requestStatus,
      changeOrderId: order.id,
      currentScopeVersion: order.priorScopeVersion,
      currentAuthorizationDecisionId: priorScope.authorizationDecisionId,
      changedAt: now,
    });
    if (!checkoutInvalidation.ok) {
      return response({
        error: checkoutInvalidation.error,
        code: checkoutInvalidation.code,
        invalidatedPaymentIds: checkoutInvalidation.invalidated.map(
          (payment) => payment.paymentId,
        ),
      }, checkoutInvalidation.status);
    }
    const agreementText = [
      `I authorize TUVELOZ test change order ${order.id} for job ${requestId}.`,
      `I approve scope version ${order.proposedScopeVersion}, exact services ${serviceCodes.join(", ")},`,
      `the complete stored scope ${order.scopeDetails}, scheduled for ${scheduledFor},`,
      `and the complete stored price breakdown ${order.priceBreakdown} before added work begins.`,
      "The selected independent provider, not TUVELOZ, performs the service.",
    ].join(" ");
    const agreementHash = await sha256JobOperationText(agreementText);
    const acceptanceId = crypto.randomUUID();
    const scopeVersionId = crypto.randomUUID();
    const scopeSnapshot = JSON.stringify({
      changeOrderId: order.id,
      priorScopeVersionId: priorScope.id,
      serviceCodes,
      scheduledFor,
      scopeDetails,
      priceBreakdown: prices,
      reason: order.reason,
    });
    const deviceContext = JSON.stringify({
      userAgent: clean(request.headers.get("user-agent"), 600),
      language: clean(request.headers.get("accept-language"), 120),
    });
    const authorizationPrerequisite = and(
      eq(jobChangeOrders.id, order.id),
      eq(jobChangeOrders.requestId, requestId),
      eq(jobChangeOrders.quoteId, context.quoteId),
      eq(jobChangeOrders.priorScopeVersion, context.scopeVersion),
      eq(jobChangeOrders.proposedScopeVersion, order.proposedScopeVersion),
      eq(jobChangeOrders.status, "pending_customer"),
      exists(
        db.select({ id: providerQuotes.id }).from(providerQuotes).where(and(
          eq(providerQuotes.id, context.quoteId),
          eq(providerQuotes.requestId, requestId),
          eq(providerQuotes.status, "accepted"),
          eq(providerQuotes.scopeVersion, order.priorScopeVersion),
          eq(providerQuotes.scheduledFor, context.scheduledFor),
        )),
      ),
      exists(
        db.select({ id: customerRequests.id }).from(customerRequests).where(and(
          eq(customerRequests.id, requestId),
          eq(customerRequests.status, context.requestStatus),
          eq(customerRequests.scheduledFor, context.scheduledFor),
        )),
      ),
      notExists(
        db.select({ id: stripePayments.id }).from(stripePayments).where(and(
          eq(stripePayments.requestId, requestId),
          eq(stripePayments.quoteId, context.quoteId),
          inArray(
            stripePayments.status,
            SCOPE_CHANGE_BLOCKING_PAYMENT_STATUSES,
          ),
        )),
      ),
    );
    const acceptanceInsert = db.insert(customerAgreementAcceptances).select(
      db.select({
        id: sql<string>`${acceptanceId}`,
        customerEmail: sql<string>`${actor.email}`,
        requestId: sql<string>`${requestId}`,
        quoteId: sql<string>`${context.quoteId}`,
        scopeVersion: sql<number>`${order.proposedScopeVersion}`,
        scopeSnapshot: sql<string>`${scopeSnapshot}`,
        agreementKey: sql<string>`change_order_authorization`,
        agreementVersion: sql<string>`${JOB_OPERATIONS_RULES_VERSION}`,
        agreementHash: sql<string>`${agreementHash}`,
        agreementText: sql<string>`${agreementText}`,
        acceptedByName: sql<string>`${acceptedByName}`,
        acceptanceAction: sql<string>`affirmative-change-order-authorization-checkbox`,
        acceptedAt: sql<string>`${now}`,
        ipAddress: sql<string>`${requestIp(request)}`,
        sessionId: sql<string>`${actor.sessionId}`,
        deviceContext: sql<string>`${deviceContext}`,
        createdAt: sql<string>`${now}`,
      }).from(jobChangeOrders).where(authorizationPrerequisite).limit(1),
    ).returning({ id: customerAgreementAcceptances.id });
    const scopeInsert = db.insert(jobScopeVersions).select(
      db.select({
        id: sql<string>`${scopeVersionId}`,
        requestId: sql<string>`${requestId}`,
        quoteId: sql<string>`${context.quoteId}`,
        version: sql<number>`${order.proposedScopeVersion}`,
        serviceCodes: sql<string>`${JSON.stringify(serviceCodes)}`,
        jurisdiction: sql<string>`${context.jurisdiction}`,
        scheduledFor: sql<string>`${scheduledFor}`,
        scopeDetails: sql<string>`${order.scopeDetails}`,
        priceBreakdown: sql<string>`${order.priceBreakdown}`,
        partsResponsibility: sql<string>`${clean(scopeDetails.partsResponsibility, 120)}`,
        changeReason: sql<string>`${order.reason}`,
        createdByProviderId: sql<string>`${context.providerId}`,
        createdByPersonId: sql<string>`${context.personId}`,
        providerApprovedAt: sql<string>`${order.providerApprovedAt}`,
        customerAuthorizedAt: sql<string>`${now}`,
        authorizationDecisionId: sql<string>`${stageDecision.result.decisionId}`,
        supersedesScopeVersionId: sql<string>`${priorScope.id}`,
        createdAt: sql<string>`${now}`,
      }).from(jobChangeOrders).where(authorizationPrerequisite).limit(1),
    ).returning({ id: jobScopeVersions.id });
    const authorizationBatch = await db.batch([
      acceptanceInsert,
      scopeInsert,
      db.update(providerQuotes).set({
        serviceCodes: JSON.stringify(serviceCodes),
        priceCents: String(prices.totalAmountCents),
        laborPriceCents: String(prices.laborAmountCents),
        partsPriceCents: "0",
        customerFeeRateBps: prices.customerFeeRateBps,
        customerFeeCents: String(prices.customerFeeCents),
        customerTotalCents: String(prices.customerTotalCents),
        scheduledFor,
        scopeVersion: order.proposedScopeVersion,
        authorizationDecisionId: stageDecision.result.decisionId,
      }).where(and(
        eq(providerQuotes.id, context.quoteId),
        eq(providerQuotes.requestId, requestId),
        eq(providerQuotes.status, "accepted"),
        eq(providerQuotes.scopeVersion, order.priorScopeVersion),
        eq(providerQuotes.scheduledFor, context.scheduledFor),
        exists(
          db.select({ id: jobChangeOrders.id }).from(jobChangeOrders)
            .where(authorizationPrerequisite),
        ),
      )).returning({ id: providerQuotes.id }),
      db.update(customerRequests).set({
        scheduledFor,
      }).where(and(
        eq(customerRequests.id, requestId),
        eq(customerRequests.status, context.requestStatus),
        eq(customerRequests.scheduledFor, context.scheduledFor),
        exists(
          db.select({ id: jobChangeOrders.id }).from(jobChangeOrders).where(and(
            eq(jobChangeOrders.id, order.id),
            eq(jobChangeOrders.requestId, requestId),
            eq(jobChangeOrders.quoteId, context.quoteId),
            eq(jobChangeOrders.status, "pending_customer"),
          )),
        ),
        exists(
          db.select({ id: providerQuotes.id }).from(providerQuotes).where(and(
            eq(providerQuotes.id, context.quoteId),
            eq(providerQuotes.scopeVersion, order.proposedScopeVersion),
            eq(providerQuotes.authorizationDecisionId, stageDecision.result.decisionId),
            eq(providerQuotes.scheduledFor, scheduledFor),
          )),
        ),
      )).returning({ id: customerRequests.id }),
      db.update(providerJobRecords).set({
        jobStartDecisionId: "",
        completionDecisionId: "",
        workStatus: "scheduled",
        timerStartedAt: "",
        updatedAt: now,
      }).where(and(
        eq(providerJobRecords.requestId, requestId),
        eq(providerJobRecords.providerEmail, context.providerEmail),
        exists(
          db.select({ id: jobChangeOrders.id }).from(jobChangeOrders).where(and(
            eq(jobChangeOrders.id, order.id),
            eq(jobChangeOrders.status, "pending_customer"),
          )),
        ),
        exists(
          db.select({ id: providerQuotes.id }).from(providerQuotes).where(and(
            eq(providerQuotes.id, context.quoteId),
            eq(providerQuotes.scopeVersion, order.proposedScopeVersion),
            eq(providerQuotes.authorizationDecisionId, stageDecision.result.decisionId),
          )),
        ),
      )),
      db.update(jobChangeOrders).set({
        status: "authorized",
        customerAuthorizedAt: now,
        authorizationSnapshotId: stageDecision.result.decisionId,
        updatedAt: now,
      }).where(and(
        eq(jobChangeOrders.id, order.id),
        eq(jobChangeOrders.requestId, requestId),
        eq(jobChangeOrders.quoteId, context.quoteId),
        eq(jobChangeOrders.status, "pending_customer"),
        exists(
          db.select({ id: customerAgreementAcceptances.id })
            .from(customerAgreementAcceptances)
            .where(eq(customerAgreementAcceptances.id, acceptanceId)),
        ),
        exists(
          db.select({ id: jobScopeVersions.id }).from(jobScopeVersions)
            .where(eq(jobScopeVersions.id, scopeVersionId)),
        ),
        exists(
          db.select({ id: providerQuotes.id }).from(providerQuotes).where(and(
            eq(providerQuotes.id, context.quoteId),
            eq(providerQuotes.scopeVersion, order.proposedScopeVersion),
            eq(providerQuotes.authorizationDecisionId, stageDecision.result.decisionId),
            eq(providerQuotes.scheduledFor, scheduledFor),
            eq(providerQuotes.priceCents, String(prices.totalAmountCents)),
            eq(providerQuotes.customerTotalCents, String(prices.customerTotalCents)),
          )),
        ),
        exists(
          db.select({ id: customerRequests.id }).from(customerRequests).where(and(
            eq(customerRequests.id, requestId),
            eq(customerRequests.scheduledFor, scheduledFor),
          )),
        ),
      )).returning({ id: jobChangeOrders.id }),
    ] as const);
    if (
      !authorizationBatch[0].length
      || !authorizationBatch[1].length
      || !authorizationBatch[2].length
      || !authorizationBatch[3].length
      || !authorizationBatch[5].length
    ) {
      return response({
        error: "The job scope changed while this authorization was being recorded. Work remains stopped for review.",
      }, 409);
    }
    await appendJobLifecycleEvent({
      requestId,
      quoteId: context.quoteId,
      providerId: context.providerId,
      actorRole: "customer",
      actorId: actor.email,
      eventType: "change_order_authorized",
      fromStatus: context.requestStatus,
      toStatus: context.requestStatus,
      scopeVersion: order.proposedScopeVersion,
      authorizationSnapshotId: stageDecision.result.decisionId,
      reasonCode: "customer_authorized_before_added_work",
      details: { changeOrderId: order.id, acceptanceId },
    });
    return response({ ok: true, status: "authorized", acceptanceId });
  }

  if (action === "report-cancellation") {
    const roleError = requireRole(actor, "customer", "provider");
    if (roleError) return roleError;
    const cancellationType = clean(body.cancellationType, 40);
    const reason = clean(body.reason, 1200);
    const allowedTypes = [
      "customer_cancel",
      "provider_cancel",
      "customer_no_show",
      "provider_no_show",
    ];
    if (!allowedTypes.includes(cancellationType) || reason.length < 5) {
      return response({ error: "Choose a cancellation or no-show type and explain what happened." }, 400);
    }
    const existing = await db.select({ id: jobCancellations.id })
      .from(jobCancellations)
      .where(and(
        eq(jobCancellations.requestId, requestId),
        inArray(jobCancellations.status, OPEN_CANCELLATION_STATUSES),
      )).limit(1);
    if (existing.length) return response({ error: "A cancellation or no-show review is already open." }, 409);
    const submittedPartsCommittedCents = integerCents(body.partsCommittedCents ?? 0);
    if (submittedPartsCommittedCents === null || submittedPartsCommittedCents !== 0) {
      return response({
        error: "A cancellation request cannot claim provider-supplied parts or parts reimbursement through Tuveloz.",
        code: "LABOR_ONLY_CANCELLATION_REQUIRED",
      }, 400);
    }
    const partsCommittedCents = 0;
    const workPerformedCents = actor.role === "provider"
      ? integerCents(body.workPerformedCents) ?? 0
      : 0;
    const scheduleTime = Date.parse(context.scheduledFor);
    const noticeHours = Number.isFinite(scheduleTime)
      ? Math.max(0, Math.floor((scheduleTime - Date.now()) / 3_600_000))
      : 0;
    const cancellationId = crypto.randomUUID();
    await db.insert(jobCancellations).values({
      id: cancellationId,
      requestId,
      quoteId: context.quoteId,
      requestedByRole: actor.role,
      requestedByEmail: actor.email,
      cancellationType,
      reason,
      status: "submitted",
      scheduledFor: context.scheduledFor,
      requestedAt: now,
      noticeHours,
      providerTravelStarted: affirmative(body.providerTravelStarted) ? "yes" : "no",
      partsCommittedCents,
      workPerformedCents,
      createdAt: now,
      updatedAt: now,
    });
    await db.update(providerJobRecords).set({
      workStatus: "stop work",
      timerStartedAt: "",
      updatedAt: now,
    }).where(and(
      eq(providerJobRecords.requestId, requestId),
      eq(providerJobRecords.providerEmail, context.providerEmail),
    ));
    await appendJobLifecycleEvent({
      requestId,
      quoteId: context.quoteId,
      providerId: context.providerId,
      actorRole: actor.role,
      actorId: actor.email,
      eventType: cancellationType.includes("no_show")
        ? "no_show_reported"
        : "cancellation_requested",
      fromStatus: context.requestStatus,
      toStatus: "cancellation review",
      scopeVersion: context.scopeVersion,
      reasonCode: cancellationType,
      details: { cancellationId, noticeHours },
    });
    return response({ ok: true, cancellationId, status: "submitted" }, 201);
  }

  if (action === "report-incident" || action === "stop-work") {
    const roleError = requireRole(actor, "customer", "provider");
    if (roleError) return roleError;
    const incidentType = action === "stop-work"
      ? "safety_stop"
      : clean(body.incidentType, 50);
    const severity = clean(body.severity, 20);
    const summary = clean(body.summary, 2400);
    const occurredAt = dateAtOrBeforeNow(body.occurredAt);
    const allowedTypes = [
      "safety_stop",
      "injury",
      "property_damage",
      "service_quality_claim",
      "fraud",
      "harassment",
      "other",
    ];
    const allowedSeverity = ["low", "moderate", "serious", "emergency"];
    if (
      !allowedTypes.includes(incidentType)
      || !allowedSeverity.includes(severity)
      || summary.length < 10
      || !occurredAt
    ) {
      return response({ error: "Choose an incident type and severity, describe it, and enter a valid occurrence time." }, 400);
    }
    const injuryReported = incidentType === "injury" || affirmative(body.injuryReported);
    const propertyDamageReported = incidentType === "property_damage"
      || affirmative(body.propertyDamageReported);
    const mustStop = action === "stop-work"
      || ["serious", "emergency"].includes(severity)
      || injuryReported
      || propertyDamageReported;
    const incidentId = crypto.randomUUID();
    await db.insert(jobIncidents).values({
      id: incidentId,
      requestId,
      quoteId: context.quoteId,
      providerId: context.providerId,
      reporterRole: actor.role,
      reporterEmail: actor.email,
      incidentType,
      severity,
      summary,
      occurredAt,
      locationSummary: clean(body.locationSummary, 500),
      injuryReported: injuryReported ? "yes" : "no",
      propertyDamageReported: propertyDamageReported ? "yes" : "no",
      emergencyServicesContacted: affirmative(body.emergencyServicesContacted) ? "yes" : "no",
      workStoppedAt: mustStop ? now : "",
      evidenceReferences: "[]",
      status: "open",
      holdPayments: "yes",
      createdAt: now,
      updatedAt: now,
    });
    if (mustStop) {
      await db.update(providerJobRecords).set({
        workStatus: "stop work",
        timerStartedAt: "",
        updatedAt: now,
      }).where(and(
        eq(providerJobRecords.requestId, requestId),
        eq(providerJobRecords.providerEmail, context.providerEmail),
      ));
    }
    await appendJobLifecycleEvent({
      requestId,
      quoteId: context.quoteId,
      providerId: context.providerId,
      actorRole: actor.role,
      actorId: actor.email,
      eventType: mustStop ? "incident_stop_work" : "incident_reported",
      fromStatus: context.requestStatus,
      toStatus: mustStop ? "stop work" : context.requestStatus,
      scopeVersion: context.scopeVersion,
      reasonCode: incidentType,
      details: { incidentId, severity, holdPayments: true },
    });
    return response({ ok: true, incidentId, workStopped: mustStop, paymentHold: true }, 201);
  }

  if (action === "submit-invoice") {
    const roleError = requireRole(actor, "provider");
    if (roleError) return roleError;
    const status = clean(body.status, 20);
    const laborAmountCents = integerCents(body.laborAmountCents);
    const partsAmountCents = integerCents(body.partsAmountCents ?? 0);
    const taxAmountCents = integerCents(body.taxAmountCents ?? 0);
    const otherAmountCents = integerCents(body.otherAmountCents ?? 0);
    const statedTotal = integerCents(body.totalAmountCents ?? laborAmountCents ?? 0);
    const workSummary = clean(body.workSummary, 2400);
    const warrantyProvider = clean(body.warrantyProvider, 60);
    const warrantyTerms = clean(body.warrantyTerms, 1600);
    const returnedPartsChoice = clean(body.returnedPartsChoice, 60);
    if (partsAmountCents !== 0 || taxAmountCents !== 0 || otherAmountCents !== 0) {
      return response({
        error: "A Tuveloz provider invoice may contain labor only. Customer-supplied parts may be described, but no parts, tax, reimbursement, or other charge may be added.",
        code: "LABOR_ONLY_INVOICE_REQUIRED",
      }, 400);
    }
    if (
      !["draft", "final"].includes(status)
      || laborAmountCents === null
      || partsAmountCents === null
      || taxAmountCents === null
      || otherAmountCents === null
      || statedTotal === null
      || statedTotal !== laborAmountCents + partsAmountCents + taxAmountCents + otherAmountCents
      || workSummary.length < 10
      || !["provider_business", "manufacturer", "none_disclosed"].includes(warrantyProvider)
      || warrantyTerms.length < 5
      || !["returned", "customer_declined", "not_applicable"].includes(returnedPartsChoice)
    ) {
      return response({ error: "Enter a labor-only invoice whose total equals the labor amount, a work summary, customer-supplied-parts description when applicable, returned-parts choice, and specific warranty terms." }, 400);
    }
    const blocks = await openOperationalBlocks(requestId);
    if (status === "final" && (blocks.incidents.length || blocks.cancellations.length || blocks.changes.length)) {
      return response({ error: "A final invoice cannot issue while an incident, cancellation, or change order is unresolved." }, 409);
    }
    if (status === "final" && context.requestStatus !== "completed") {
      return response({ error: "Complete the authorized job before issuing the final invoice." }, 409);
    }
    const authorizedTotalCents = await authorizedJobTotal(context);
    if (status === "final" && statedTotal !== authorizedTotalCents) {
      return response({ error: "The final invoice total must exactly match the customer-authorized provider amount." }, 409);
    }
    let completionDecisionId = "";
    if (status === "final") {
      const stageDecision = await evaluateAssignedJobStage({
        requestId,
        providerEmail: actor.email,
        stage: "completion",
        effectiveAt: now,
      });
      if (!stageDecision.allowed || !stageDecision.result?.decisionId) {
        return response({
          error: stageDecision.error,
          code: "FINAL_INVOICE_NOT_AUTHORIZED",
          reasons: stageDecision.result?.reasons ?? [],
        }, stageDecision.status);
      }
      completionDecisionId = stageDecision.result.decisionId;
    }
    const [existingInvoice] = await db.select().from(providerInvoices)
      .where(and(
        eq(providerInvoices.requestId, requestId),
        eq(providerInvoices.scopeVersion, context.scopeVersion),
      )).limit(1);
    if (existingInvoice?.status === "final") {
      return response({ error: "A final invoice is immutable. Use the incident or refund workflow for later issues." }, 409);
    }
    const invoiceId = existingInvoice?.id || crypto.randomUUID();
    const invoiceNumber = existingInvoice?.invoiceNumber
      || `TVZ-${requestId.replace(/[^A-Za-z0-9]/g, "").slice(-10).toUpperCase()}-${context.scopeVersion}`;
    const invoiceValues = {
      quoteId: context.quoteId,
      providerId: context.providerId,
      invoiceNumber,
      serviceCodes: JSON.stringify(context.serviceCodes),
      laborAmountCents,
      partsAmountCents: 0,
      taxAmountCents: 0,
      otherAmountCents: 0,
      totalAmountCents: statedTotal,
      partsDescription: clean(body.partsDescription, 1600),
      returnedPartsChoice,
      warrantyProvider,
      warrantyTerms,
      workSummary,
      status,
      issuedAt: status === "final" ? now : "",
      updatedAt: now,
    };
    if (existingInvoice) {
      await db.update(providerInvoices).set(invoiceValues)
        .where(eq(providerInvoices.id, existingInvoice.id));
    } else {
      await db.insert(providerInvoices).values({
        id: invoiceId,
        requestId,
        scopeVersion: context.scopeVersion,
        ...invoiceValues,
        createdAt: now,
      });
    }
    await appendJobLifecycleEvent({
      requestId,
      quoteId: context.quoteId,
      providerId: context.providerId,
      actorRole: "provider",
      actorId: actor.email,
      eventType: status === "final" ? "final_invoice_issued" : "invoice_draft_saved",
      fromStatus: context.requestStatus,
      toStatus: context.requestStatus,
      scopeVersion: context.scopeVersion,
      authorizationSnapshotId: completionDecisionId,
      details: { invoiceId, totalAmountCents: statedTotal, warrantyProvider },
    });
    return response({ ok: true, invoiceId, invoiceNumber, status });
  }

  if (action === "request-refund") {
    const roleError = requireRole(actor, "customer", "provider");
    if (roleError) return roleError;
    const amountCents = integerCents(body.amountCents, false);
    const reasonCode = clean(body.reasonCode, 60);
    const explanation = clean(body.explanation, 1800);
    const authorizedTotalCents = await authorizedJobTotal(context);
    const allowedReasons = [
      "cancellation",
      "provider_no_show",
      "work_not_performed",
      "unauthorized_charge",
      "service_quality",
      "other",
    ];
    if (
      amountCents === null
      || amountCents > authorizedTotalCents
      || !allowedReasons.includes(reasonCode)
      || explanation.length < 10
    ) {
      return response({ error: "Enter a refund amount no greater than the authorized provider total, a reason, and an explanation." }, 400);
    }
    const idempotencyKey = await sha256JobOperationText(
      `test-refund:${requestId}:${actor.role}:${actor.email}:${amountCents}:${reasonCode}:${explanation}`,
    );
    const [duplicate] = await db.select({ id: paymentAdjustments.id })
      .from(paymentAdjustments)
      .where(eq(paymentAdjustments.idempotencyKey, idempotencyKey))
      .limit(1);
    if (duplicate) return response({ ok: true, adjustmentId: duplicate.id, duplicate: true });
    const adjustmentId = crypto.randomUUID();
    await db.insert(paymentAdjustments).values({
      id: adjustmentId,
      requestId,
      quoteId: context.quoteId,
      adjustmentType: "refund_request",
      amountCents,
      status: "requested",
      reasonCode,
      details: JSON.stringify({ explanation, testOnly: true, stripeExecutionAllowed: false }),
      requestedByRole: actor.role,
      requestedById: actor.email,
      requestedAt: now,
      idempotencyKey,
      createdAt: now,
      updatedAt: now,
    });
    await appendJobLifecycleEvent({
      requestId,
      quoteId: context.quoteId,
      providerId: context.providerId,
      actorRole: actor.role,
      actorId: actor.email,
      eventType: "refund_requested",
      fromStatus: context.requestStatus,
      toStatus: context.requestStatus,
      scopeVersion: context.scopeVersion,
      reasonCode,
      details: { adjustmentId, amountCents, stripeExecutionAllowed: false },
    });
    return response({ ok: true, adjustmentId, status: "requested" }, 201);
  }

  if (action === "acknowledge-invoice") {
    const roleError = requireRole(actor, "customer");
    if (roleError) return roleError;
    const invoiceId = clean(body.invoiceId, 80);
    const [invoice] = await db.select().from(providerInvoices)
      .where(and(
        eq(providerInvoices.id, invoiceId),
        eq(providerInvoices.requestId, requestId),
      )).limit(1);
    if (!invoice || invoice.status !== "final") {
      return response({ error: "Final invoice not found." }, 404);
    }
    await db.update(providerInvoices).set({
      customerViewedAt: invoice.customerViewedAt || now,
      updatedAt: now,
    }).where(eq(providerInvoices.id, invoice.id));
    await appendJobLifecycleEvent({
      requestId,
      quoteId: context.quoteId,
      providerId: context.providerId,
      actorRole: "customer",
      actorId: actor.email,
      eventType: "final_invoice_viewed",
      fromStatus: context.requestStatus,
      toStatus: context.requestStatus,
      scopeVersion: invoice.scopeVersion,
      details: { invoiceId: invoice.id },
    });
    return response({
      ok: true,
      customerViewedAt: invoice.customerViewedAt || now,
      notice: "Viewing records delivery; it does not waive any right or accept disputed work.",
    });
  }

  if (action === "decide-refund") {
    const roleError = requireRole(actor, "owner");
    if (roleError) return roleError;
    const adjustmentId = clean(body.adjustmentId, 80);
    const decision = clean(body.decision, 20);
    const decisionReason = clean(body.decisionReason, 1200);
    const [adjustment] = await db.select().from(paymentAdjustments)
      .where(and(
        eq(paymentAdjustments.id, adjustmentId),
        eq(paymentAdjustments.requestId, requestId),
      )).limit(1);
    if (!adjustment || adjustment.adjustmentType !== "refund_request") {
      return response({ error: "Refund request not found." }, 404);
    }
    if (adjustment.status !== "requested") {
      return response({ error: "This refund request was already decided." }, 409);
    }
    if (!["approve", "deny"].includes(decision) || decisionReason.length < 5) {
      return response({ error: "Choose approve or deny and record a reason." }, 400);
    }
    if (adjustment.paymentId || adjustment.stripeRefundId) {
      return response({ error: "This test-only workflow cannot modify a Stripe payment." }, 409);
    }
    const nextStatus = decision === "approve" ? "approved_test_only" : "denied";
    await db.update(paymentAdjustments).set({
      status: nextStatus,
      details: JSON.stringify({
        priorDetails: adjustment.details,
        decisionReason,
        testOnly: true,
        stripeExecutionAllowed: false,
      }),
      decidedBy: actor.email,
      decidedAt: now,
      providerImpactCents: decision === "approve" ? -adjustment.amountCents : 0,
      customerImpactCents: decision === "approve" ? adjustment.amountCents : 0,
      updatedAt: now,
    }).where(and(
      eq(paymentAdjustments.id, adjustment.id),
      eq(paymentAdjustments.status, "requested"),
    ));
    await appendJobLifecycleEvent({
      requestId,
      quoteId: context.quoteId,
      providerId: context.providerId,
      actorRole: "owner",
      actorId: actor.email,
      eventType: decision === "approve" ? "test_refund_approved_no_execution" : "refund_denied",
      fromStatus: context.requestStatus,
      toStatus: context.requestStatus,
      scopeVersion: context.scopeVersion,
      reasonCode: adjustment.reasonCode,
      details: { adjustmentId, amountCents: adjustment.amountCents, stripeExecutionAllowed: false },
    });
    return response({ ok: true, status: nextStatus, stripeRefundCreated: false });
  }

  if (action === "decide-cancellation") {
    const roleError = requireRole(actor, "owner");
    if (roleError) return roleError;
    const cancellationId = clean(body.cancellationId, 80);
    const decision = clean(body.decision, 20);
    const decisionReason = clean(body.decisionReason, 1200);
    const proposedRefundCents = integerCents(body.proposedRefundCents);
    const retainedAmountCents = integerCents(body.retainedAmountCents);
    const [cancellation] = await db.select().from(jobCancellations)
      .where(and(
        eq(jobCancellations.id, cancellationId),
        eq(jobCancellations.requestId, requestId),
      )).limit(1);
    if (!cancellation) return response({ error: "Cancellation review not found." }, 404);
    if (!OPEN_CANCELLATION_STATUSES.includes(cancellation.status)) {
      return response({ error: "This cancellation was already decided." }, 409);
    }
    const authorizedTotalCents = await authorizedJobTotal(context);
    if (
      !["approve", "deny"].includes(decision)
      || decisionReason.length < 5
      || proposedRefundCents === null
      || retainedAmountCents === null
      || proposedRefundCents + retainedAmountCents > authorizedTotalCents
    ) {
      return response({ error: "Record a decision, reason, and refund/retained amounts within the authorized total." }, 400);
    }
    let adjustmentId = "";
    if (decision === "approve" && proposedRefundCents > 0) {
      adjustmentId = crypto.randomUUID();
      await db.insert(paymentAdjustments).values({
        id: adjustmentId,
        requestId,
        quoteId: context.quoteId,
        adjustmentType: "cancellation_refund",
        amountCents: proposedRefundCents,
        status: "approved_test_only",
        reasonCode: cancellation.cancellationType,
        details: JSON.stringify({ cancellationId, testOnly: true, stripeExecutionAllowed: false }),
        requestedByRole: "owner",
        requestedById: actor.email,
        requestedAt: now,
        decidedBy: actor.email,
        decidedAt: now,
        providerImpactCents: -proposedRefundCents,
        customerImpactCents: proposedRefundCents,
        idempotencyKey: await sha256JobOperationText(`test-cancellation-refund:${cancellationId}`),
        createdAt: now,
        updatedAt: now,
      });
    }
    const nextStatus = decision === "approve" ? "approved_test_only" : "denied";
    await db.update(jobCancellations).set({
      status: nextStatus,
      proposedRefundCents,
      retainedAmountCents,
      decisionBy: actor.email,
      decisionAt: now,
      decisionReason,
      paymentAdjustmentId: adjustmentId,
      updatedAt: now,
    }).where(eq(jobCancellations.id, cancellation.id));
    if (decision === "approve") {
      await db.update(customerRequests).set({ status: "cancelled" })
        .where(eq(customerRequests.id, requestId));
    }
    await appendJobLifecycleEvent({
      requestId,
      quoteId: context.quoteId,
      providerId: context.providerId,
      actorRole: "owner",
      actorId: actor.email,
      eventType: decision === "approve" ? "test_cancellation_approved" : "cancellation_denied",
      fromStatus: context.requestStatus,
      toStatus: decision === "approve" ? "cancelled" : context.requestStatus,
      scopeVersion: context.scopeVersion,
      reasonCode: cancellation.cancellationType,
      details: { cancellationId, proposedRefundCents, retainedAmountCents, stripeExecutionAllowed: false },
    });
    return response({ ok: true, status: nextStatus, stripeRefundCreated: false });
  }

  if (action === "resolve-incident") {
    const roleError = requireRole(actor, "owner");
    if (roleError) return roleError;
    const incidentId = clean(body.incidentId, 80);
    const resolution = clean(body.resolution, 2000);
    const [incident] = await db.select().from(jobIncidents)
      .where(and(
        eq(jobIncidents.id, incidentId),
        eq(jobIncidents.requestId, requestId),
      )).limit(1);
    if (!incident) return response({ error: "Incident not found." }, 404);
    if (!OPEN_INCIDENT_STATUSES.includes(incident.status)) {
      return response({ error: "This incident is already closed." }, 409);
    }
    const requiresInsurerNotice = incident.injuryReported === "yes"
      || incident.propertyDamageReported === "yes";
    const insurerNotifiedAt = affirmative(body.insurerNotified)
      ? now
      : incident.insurerNotifiedAt;
    if (resolution.length < 10 || (requiresInsurerNotice && !insurerNotifiedAt)) {
      return response({ error: "Record a complete resolution and confirm insurer notice for injury or property damage." }, 400);
    }
    await db.update(jobIncidents).set({
      status: "resolved",
      resolution,
      insurerNotifiedAt,
      holdPayments: affirmative(body.releasePaymentHold) ? "no" : "yes",
      resolvedAt: now,
      updatedAt: now,
    }).where(eq(jobIncidents.id, incident.id));
    await appendJobLifecycleEvent({
      requestId,
      quoteId: context.quoteId,
      providerId: context.providerId,
      actorRole: "owner",
      actorId: actor.email,
      eventType: "incident_resolved",
      fromStatus: "stop work",
      toStatus: context.requestStatus,
      scopeVersion: context.scopeVersion,
      reasonCode: incident.incidentType,
      details: { incidentId, paymentHoldReleased: affirmative(body.releasePaymentHold) },
    });
    return response({ ok: true, status: "resolved", paymentHoldReleased: affirmative(body.releasePaymentHold) });
  }

  if (action === "record-payment-hold") {
    const roleError = requireRole(actor, "owner");
    if (roleError) return roleError;
    const adjustmentType = clean(body.adjustmentType, 30);
    const amountCents = integerCents(body.amountCents, false);
    const reasonCode = clean(body.reasonCode, 60);
    const explanation = clean(body.explanation, 1600);
    const authorizedTotalCents = await authorizedJobTotal(context);
    if (
      !["reserve", "dispute"].includes(adjustmentType)
      || amountCents === null
      || amountCents > authorizedTotalCents
      || reasonCode.length < 3
      || explanation.length < 10
    ) {
      return response({ error: "Choose reserve or dispute and enter a valid amount, reason code, and explanation." }, 400);
    }
    const adjustmentId = crypto.randomUUID();
    await db.insert(paymentAdjustments).values({
      id: adjustmentId,
      requestId,
      quoteId: context.quoteId,
      adjustmentType,
      amountCents,
      status: "active",
      reasonCode,
      details: JSON.stringify({ explanation, testOnly: true, stripeExecutionAllowed: false }),
      requestedByRole: "owner",
      requestedById: actor.email,
      requestedAt: now,
      idempotencyKey: await sha256JobOperationText(
        `test-${adjustmentType}:${requestId}:${reasonCode}:${explanation}:${amountCents}`,
      ),
      createdAt: now,
      updatedAt: now,
    });
    await appendJobLifecycleEvent({
      requestId,
      quoteId: context.quoteId,
      providerId: context.providerId,
      actorRole: "owner",
      actorId: actor.email,
      eventType: adjustmentType === "reserve" ? "payment_reserve_placed" : "dispute_hold_recorded",
      fromStatus: context.requestStatus,
      toStatus: context.requestStatus,
      scopeVersion: context.scopeVersion,
      reasonCode,
      details: { adjustmentId, amountCents, stripeExecutionAllowed: false },
    });
    return response({ ok: true, adjustmentId, status: "active" }, 201);
  }

  if (action === "resolve-payment-hold") {
    const roleError = requireRole(actor, "owner");
    if (roleError) return roleError;
    const adjustmentId = clean(body.adjustmentId, 80);
    const resolution = clean(body.resolution, 1200);
    const [adjustment] = await db.select().from(paymentAdjustments)
      .where(and(
        eq(paymentAdjustments.id, adjustmentId),
        eq(paymentAdjustments.requestId, requestId),
      )).limit(1);
    if (!adjustment || !["reserve", "dispute"].includes(adjustment.adjustmentType)) {
      return response({ error: "Payment hold not found." }, 404);
    }
    if (adjustment.status !== "active") return response({ error: "This hold is already resolved." }, 409);
    if (resolution.length < 5) return response({ error: "Record how the hold was resolved." }, 400);
    await db.update(paymentAdjustments).set({
      status: "resolved",
      details: JSON.stringify({ priorDetails: adjustment.details, resolution, testOnly: true }),
      decidedBy: actor.email,
      decidedAt: now,
      updatedAt: now,
    }).where(and(
      eq(paymentAdjustments.id, adjustment.id),
      eq(paymentAdjustments.status, "active"),
    ));
    await appendJobLifecycleEvent({
      requestId,
      quoteId: context.quoteId,
      providerId: context.providerId,
      actorRole: "owner",
      actorId: actor.email,
      eventType: "payment_hold_resolved",
      fromStatus: context.requestStatus,
      toStatus: context.requestStatus,
      scopeVersion: context.scopeVersion,
      reasonCode: adjustment.reasonCode,
      details: { adjustmentId, adjustmentType: adjustment.adjustmentType },
    });
    return response({ ok: true, status: "resolved" });
  }

  if (action === "review-payout") {
    const roleError = requireRole(actor, "owner");
    if (roleError) return roleError;
    const stageDecision = await evaluateAssignedJobStage({
      requestId,
      stage: "payout",
      effectiveAt: now,
    });
    if (!stageDecision.allowed || !stageDecision.result?.decisionId) {
      await appendJobLifecycleEvent({
        requestId,
        quoteId: context.quoteId,
        providerId: context.providerId,
        actorRole: "owner",
        actorId: actor.email,
        eventType: "test_payout_review_denied",
        fromStatus: context.requestStatus,
        toStatus: context.requestStatus,
        scopeVersion: context.scopeVersion,
        reasonCode: stageDecision.result?.reasons[0]?.code || "eligibility_denied",
        details: { reasons: stageDecision.result?.reasons ?? [], transferCreated: false },
      });
      return response({
        payoutAllowed: false,
        transferCreated: false,
        error: stageDecision.error,
        reasons: stageDecision.result?.reasons ?? [],
      }, stageDecision.status);
    }
    const [jobRecord] = await db.select().from(providerJobRecords)
      .where(and(
        eq(providerJobRecords.requestId, requestId),
        eq(providerJobRecords.providerEmail, context.providerEmail),
      )).limit(1);
    const [finalInvoice] = await db.select().from(providerInvoices)
      .where(and(
        eq(providerInvoices.requestId, requestId),
        eq(providerInvoices.scopeVersion, context.scopeVersion),
      )).limit(1);
    const [incidents, cancellations, changes, adjustments] = await Promise.all([
      db.select().from(jobIncidents).where(eq(jobIncidents.requestId, requestId)),
      db.select().from(jobCancellations).where(eq(jobCancellations.requestId, requestId)),
      db.select().from(jobChangeOrders).where(eq(jobChangeOrders.requestId, requestId)),
      db.select().from(paymentAdjustments).where(eq(paymentAdjustments.requestId, requestId)),
    ]);
    const authorizedTotalCents = await authorizedJobTotal(context);
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
      jobCompleted: context.requestStatus === "completed"
        && jobRecord?.workStatus === "completed"
        && actualStartCurrent,
      completionDecisionId: completionCurrent
        ? jobRecord?.completionDecisionId || ""
        : "",
      finalInvoiceStatus: finalInvoice?.status || "",
      finalInvoiceTotalCents: finalInvoice?.totalAmountCents ?? -1,
      authorizedTotalCents,
      openIncidentCount: incidents.filter((item) => (
        OPEN_INCIDENT_STATUSES.includes(item.status) || item.holdPayments === "yes"
      )).length,
      openClaimCount: incidents.filter((item) => (
        ["injury", "property_damage", "service_quality_claim"].includes(item.incidentType)
        && item.status !== "resolved"
      )).length,
      unresolvedCancellationCount: cancellations.filter((item) => (
        OPEN_CANCELLATION_STATUSES.includes(item.status)
      )).length,
      unauthorizedChangeOrderCount: changes.filter((item) => item.status === "pending_customer").length,
      pendingRefundCount: adjustments.filter((item) => (
        ["refund_request", "cancellation_refund"].includes(item.adjustmentType)
        && ["requested", "under_review"].includes(item.status)
      )).length,
      approvedRefundAmountCents: adjustments.filter((item) => (
        ["refund_request", "cancellation_refund"].includes(item.adjustmentType)
        && item.status === "approved_test_only"
      )).reduce((sum, item) => sum + item.amountCents, 0),
      openDisputeCount: adjustments.filter((item) => (
        item.adjustmentType === "dispute" && item.status === "active"
      )).length,
      activeReserveAmountCents: adjustments.filter((item) => (
        item.adjustmentType === "reserve" && item.status === "active"
      )).reduce((sum, item) => sum + item.amountCents, 0),
      providerTimerRunning: Boolean(jobRecord?.timerStartedAt),
    });
    await appendJobLifecycleEvent({
      requestId,
      quoteId: context.quoteId,
      providerId: context.providerId,
      actorRole: "owner",
      actorId: actor.email,
      eventType: readiness.allowed
        ? "test_payout_authorized_no_transfer"
        : "test_payout_review_denied",
      fromStatus: context.requestStatus,
      toStatus: context.requestStatus,
      scopeVersion: context.scopeVersion,
      authorizationSnapshotId: stageDecision.result.decisionId,
      reasonCode: readiness.reasonCodes[0] || "all_release_controls_passed",
      details: {
        reasonCodes: readiness.reasonCodes,
        authorizedTotalCents,
        transferCreated: false,
        stripeExecutionAllowed: false,
      },
    });
    return response({
      payoutAllowed: readiness.allowed,
      transferCreated: false,
      eligibilityDecisionId: stageDecision.result.decisionId,
      ...readiness,
    }, readiness.allowed ? 200 : 409);
  }

  return response({ error: "Unknown job operation." }, 400);
}
