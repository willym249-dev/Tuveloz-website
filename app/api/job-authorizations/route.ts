import { env } from "cloudflare:workers";
import {
  getAccountSession,
  providerAccountFor,
  testProviderAccountFor,
} from "../../../lib/account-auth";
import {
  assignedJobOperationContext,
  evaluateAssignedJobStage,
} from "../../../lib/job-operations";
import {
  CUSTOMER_JOB_POSTING_PAUSED,
  CUSTOMER_JOB_POSTING_PAUSED_MESSAGE,
  marketplacePausedMessage,
} from "../../../lib/launch-status";
import { notifyMarketplaceAccount } from "../../../lib/marketplace-notifications";
import { isSameOriginRequest } from "../../../lib/request-security";
import { runtimeMarketplaceActionAllowed } from "../../../lib/runtime-marketplace-action";
import {
  authorizationDisclosuresForJob,
  CUSTOMER_AUTHORIZATION_PRINCIPLES,
  PROVIDER_FREEDOM_PRINCIPLES,
} from "../../../lib/service-safety-policy";

type AccountRole = "customer" | "provider";
type AuthorizationStatus = "pending" | "accepted" | "declined" | "withdrawn" | "superseded";
type AuthorizationType = "accepted-quote" | "work-order" | "change-order" | "diagnostic-follow-up" | "scope-update";

type AcceptedJobRow = {
  requestId: string;
  vehicle: string;
  service: string;
  requestStatus: string;
  customerName: string;
  customerEmail: string;
  providerName: string;
  providerEmail: string;
  isTestJob: string;
  quoteId: string;
  priceCents: string;
  laborPriceCents: string;
  partsPriceCents: string;
  availability: string;
  quoteMessage: string;
};

type AuthorizationRow = {
  id: string;
  requestId: string;
  sourceQuoteId: string;
  providerEmail: string;
  providerName: string;
  customerEmail: string;
  authorizationType: AuthorizationType;
  title: string;
  description: string;
  laborCents: number;
  partsCents: number;
  otherFeesCents: number;
  totalCents: number;
  estimatedCompletionAt: string;
  diagnosticOnly: string;
  workmanshipWarranty: string;
  partsWarranty: string;
  replacedPartsReturn: string;
  status: AuthorizationStatus;
  providerTermsVersion: string;
  customerTermsVersion: string;
  supersedesAuthorizationId: string;
  responseNote: string;
  createdAt: string;
  respondedAt: string;
  withdrawnAt: string;
  updatedAt: string;
};

const PROVIDER_WORK_ORDER_VERSION = "provider-work-order-2026-07-31";
const CUSTOMER_WORK_ORDER_VERSION = "customer-work-order-2026-07-31";
const CREATE_TYPES = new Set<AuthorizationType>([
  "work-order",
  "change-order",
  "diagnostic-follow-up",
  "scope-update",
]);
const ACTIVE_JOB_STATUSES = new Set(["quote accepted", "on my way", "arrived"]);
const MAX_AMOUNT_CENTS = 100_000_000;

function marketplacePausedResponse() {
  return Response.json(
    {
      error: CUSTOMER_JOB_POSTING_PAUSED
        ? CUSTOMER_JOB_POSTING_PAUSED_MESSAGE
        : marketplacePausedMessage("scope_change"),
      code: "MARKETPLACE_ONBOARDING_ONLY",
    },
    {
      status: 503,
      headers: { "cache-control": "no-store", "retry-after": "86400" },
    },
  );
}

function isIsolatedTestJob(context: {
  isTestJob: boolean;
  isTestProvider: boolean;
}) {
  return context.isTestJob && context.isTestProvider;
}

async function currentProviderMatchesContext(context: NonNullable<Awaited<
  ReturnType<typeof assignedJobOperationContext>
>>) {
  const provider = context.isTestJob && context.isTestProvider
    ? await testProviderAccountFor(context.providerEmail)
    : await providerAccountFor(context.providerEmail);
  return provider?.id === context.providerId;
}

async function authorizeScopeMutation(requestId: string, providerEmail: string) {
  const initialContext = await assignedJobOperationContext(requestId, providerEmail);
  if (!initialContext) {
    return {
      response: Response.json(
        { error: "The current accepted provider assignment was not found." },
        { status: 409, headers: { "cache-control": "no-store" } },
      ),
      context: null,
    };
  }
  if (initialContext.isTestJob !== initialContext.isTestProvider) {
    return {
      response: Response.json(
        { error: "The provider and job test classifications do not match." },
        { status: 409, headers: { "cache-control": "no-store" } },
      ),
      context: null,
    };
  }
  if (CUSTOMER_JOB_POSTING_PAUSED && !isIsolatedTestJob(initialContext)) {
    return { response: marketplacePausedResponse(), context: null };
  }

  const decision = await evaluateAssignedJobStage({
    requestId,
    providerEmail,
    stage: "scope_change",
    persist: true,
  });
  if (!decision.allowed || !decision.context || !decision.result?.decisionId) {
    return {
      response: Response.json(
        {
          error: decision.error || "Current provider and service eligibility is required.",
          code: "SCOPE_CHANGE_ELIGIBILITY_DENIED",
          reasons: decision.result?.reasons ?? [],
        },
        { status: decision.status || 409, headers: { "cache-control": "no-store" } },
      ),
      context: null,
    };
  }
  if (
    decision.context.isTestJob !== decision.context.isTestProvider
    || (CUSTOMER_JOB_POSTING_PAUSED && !isIsolatedTestJob(decision.context))
    || !await currentProviderMatchesContext(decision.context)
  ) {
    return {
      response: Response.json(
        {
          error: "The current provider assignment changed or is no longer eligible.",
          code: "SCOPE_CHANGE_ELIGIBILITY_CHANGED",
        },
        { status: 409, headers: { "cache-control": "no-store" } },
      ),
      context: null,
    };
  }
  return { response: null, context: decision.context };
}

function text(value: unknown, maximum: number) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

function cleanEmail(value: string) {
  return value.trim().toLowerCase();
}

function amountCents(value: unknown) {
  const amount = typeof value === "number" ? value : Number(String(value ?? "").trim());
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error("Enter a valid non-negative labor amount.");
  }
  const cents = Math.round(amount * 100);
  if (cents > MAX_AMOUNT_CENTS) {
    throw new Error("That amount is above the supported marketplace record limit.");
  }
  return cents;
}

function optionalFutureDate(value: unknown) {
  const raw = text(value, 50);
  if (!raw) return "";
  const parsed = Date.parse(raw);
  if (!Number.isFinite(parsed)) throw new Error("Choose a valid estimated completion date and time.");
  if (parsed < Date.now() - 15 * 60 * 1000) {
    throw new Error("The estimated completion time cannot be in the past.");
  }
  if (parsed > Date.now() + 2 * 366 * 24 * 60 * 60 * 1000) {
    throw new Error("Choose an estimated completion time within the next two years.");
  }
  return new Date(parsed).toISOString();
}

function authorizationLabel(type: AuthorizationType) {
  const labels: Record<AuthorizationType, string> = {
    "accepted-quote": "Accepted quote",
    "work-order": "Detailed work order",
    "change-order": "Change order",
    "diagnostic-follow-up": "Diagnostic follow-up",
    "scope-update": "Scope update",
  };
  return labels[type];
}

function publicAuthorization(row: AuthorizationRow) {
  return {
    ...row,
    diagnosticOnly: row.diagnosticOnly === "yes",
  };
}

async function acceptedJobs(role: AccountRole, email: string) {
  const roleClause = role === "provider"
    ? "lower(quote.provider_email) = lower(?)"
    : "lower(request.email) = lower(?)";
  const result = await env.DB.prepare(
    `SELECT request.id AS requestId,
            request.vehicle,
            request.service,
            request.status AS requestStatus,
            request.name AS customerName,
            lower(request.email) AS customerEmail,
            quote.provider_name AS providerName,
            lower(quote.provider_email) AS providerEmail,
            request.is_test_job AS isTestJob,
            quote.id AS quoteId,
            quote.price_cents AS priceCents,
            quote.labor_price_cents AS laborPriceCents,
            quote.parts_price_cents AS partsPriceCents,
            quote.availability,
            quote.message AS quoteMessage
       FROM customer_requests request
       INNER JOIN provider_quotes quote
         ON quote.request_id = request.id
        AND quote.status = 'accepted'
      WHERE ${roleClause}
        AND EXISTS (
          SELECT 1
            FROM provider_applications provider
           WHERE lower(provider.email) = lower(quote.provider_email)
             AND provider.is_test_provider = request.is_test_job
        )
        AND request.status NOT IN ('cancelled','canceled')
      ORDER BY datetime(request.created_at) DESC
      LIMIT 100`,
  ).bind(email).all<AcceptedJobRow>();
  return result.results ?? [];
}

async function authorizationRows(role: AccountRole, email: string) {
  const field = role === "provider" ? "provider_email" : "customer_email";
  const result = await env.DB.prepare(
    `SELECT id,
            request_id AS requestId,
            source_quote_id AS sourceQuoteId,
            provider_email AS providerEmail,
            provider_name AS providerName,
            customer_email AS customerEmail,
            authorization_type AS authorizationType,
            title,
            description,
            labor_cents AS laborCents,
            parts_cents AS partsCents,
            other_fees_cents AS otherFeesCents,
            total_cents AS totalCents,
            estimated_completion_at AS estimatedCompletionAt,
            diagnostic_only AS diagnosticOnly,
            workmanship_warranty AS workmanshipWarranty,
            parts_warranty AS partsWarranty,
            replaced_parts_return AS replacedPartsReturn,
            status,
            provider_terms_version AS providerTermsVersion,
            customer_terms_version AS customerTermsVersion,
            supersedes_authorization_id AS supersedesAuthorizationId,
            response_note AS responseNote,
            created_at AS createdAt,
            responded_at AS respondedAt,
            withdrawn_at AS withdrawnAt,
            updated_at AS updatedAt
       FROM job_authorizations
      WHERE lower(${field}) = lower(?)
      ORDER BY datetime(created_at) DESC
      LIMIT 500`,
  ).bind(email).all<AuthorizationRow>();
  return result.results ?? [];
}

async function responseData(request: Request) {
  const session = await getAccountSession(request);
  if (!session || (session.role !== "customer" && session.role !== "provider")) return null;

  if (session.role === "provider") {
    const provider = await providerAccountFor(session.email);
    if (!provider) return null;
  }

  const role = session.role as AccountRole;
  const email = cleanEmail(session.email);
  const [jobs, authorizations, realScopeChangesAvailable] = await Promise.all([
    acceptedJobs(role, email),
    authorizationRows(role, email),
    CUSTOMER_JOB_POSTING_PAUSED
      ? Promise.resolve(false)
      : runtimeMarketplaceActionAllowed("scope_change").catch(() => false),
  ]);
  const byRequest = authorizations.reduce<Map<string, AuthorizationRow[]>>((map, item) => {
    const items = map.get(item.requestId) ?? [];
    items.push(item);
    map.set(item.requestId, items);
    return map;
  }, new Map());

  return {
    role,
    email,
    providerFreedomPrinciples: PROVIDER_FREEDOM_PRINCIPLES,
    customerAuthorizationPrinciples: CUSTOMER_AUTHORIZATION_PRINCIPLES,
    jobs: jobs.map((job) => ({
      ...job,
      transactionActionsAvailable: job.isTestJob === "yes"
        || realScopeChangesAvailable,
      disclosures: authorizationDisclosuresForJob(job.service),
      authorizations: (byRequest.get(job.requestId) ?? []).map(publicAuthorization),
    })),
  };
}

async function providerAssignedJob(providerEmail: string, requestId: string) {
  return env.DB.prepare(
    `SELECT request.id AS requestId,
            request.vehicle,
            request.service,
            request.status AS requestStatus,
            request.name AS customerName,
            lower(request.email) AS customerEmail,
            quote.provider_name AS providerName,
            lower(quote.provider_email) AS providerEmail,
            request.is_test_job AS isTestJob,
            quote.id AS quoteId,
            quote.price_cents AS priceCents,
            quote.labor_price_cents AS laborPriceCents,
            quote.parts_price_cents AS partsPriceCents,
            quote.availability,
            quote.message AS quoteMessage
       FROM customer_requests request
       INNER JOIN provider_quotes quote
         ON quote.request_id = request.id
        AND lower(quote.provider_email) = lower(?)
        AND quote.status = 'accepted'
      WHERE request.id = ?
        AND EXISTS (
          SELECT 1
            FROM provider_applications provider
           WHERE lower(provider.email) = lower(quote.provider_email)
             AND provider.is_test_provider = request.is_test_job
        )
      LIMIT 1`,
  ).bind(providerEmail, requestId).first<AcceptedJobRow>();
}

async function createAuthorization(request: Request, payload: Record<string, unknown>) {
  const session = await getAccountSession(request);
  if (!session || session.role !== "provider") {
    return Response.json({ error: "Only the selected provider can create a work order or change order." }, { status: 401 });
  }
  const provider = await providerAccountFor(session.email);
  if (!provider) {
    return Response.json({ error: "Verified provider access is required." }, { status: 403 });
  }

  const requestId = text(payload.requestId, 80);
  const authorizationType = text(payload.authorizationType, 40) as AuthorizationType;
  const title = text(payload.title, 160);
  const description = text(payload.description, 2400);
  if (!requestId || !CREATE_TYPES.has(authorizationType) || !title || !description) {
    return Response.json({
      error: "Choose a job and enter the authorization type, title, and complete work description.",
    }, { status: 400 });
  }

  const job = await providerAssignedJob(provider.email, requestId);
  if (!job) {
    return Response.json({ error: "Only the provider selected for this accepted quote can create an authorization." }, { status: 403 });
  }
  if (!ACTIVE_JOB_STATUSES.has(job.requestStatus.toLowerCase())) {
    return Response.json({ error: "New work orders and change orders are available only while the job is active." }, { status: 409 });
  }
  const scopeAuthorization = await authorizeScopeMutation(requestId, provider.email);
  if (scopeAuthorization.response) return scopeAuthorization.response;
  if (scopeAuthorization.context?.providerId !== provider.id) {
    return Response.json(
      {
        error: "The selected provider assignment changed before the authorization could be created.",
        code: "SCOPE_CHANGE_ASSIGNMENT_CHANGED",
      },
      { status: 409, headers: { "cache-control": "no-store" } },
    );
  }

  const pending = await env.DB.prepare(
    `SELECT count(*) AS total
       FROM job_authorizations
      WHERE request_id = ?
        AND lower(provider_email) = lower(?)
        AND status = 'pending'`,
  ).bind(requestId, provider.email).first<{ total: number }>();
  if ((pending?.total ?? 0) >= 10) {
    return Response.json({ error: "Resolve an existing pending authorization before creating more changes." }, { status: 409 });
  }

  let laborCents: number;
  let partsCents: number;
  let otherFeesCents: number;
  let estimatedCompletionAt: string;
  try {
    laborCents = amountCents(payload.laborAmount);
    partsCents = amountCents(payload.partsAmount);
    otherFeesCents = amountCents(payload.otherFeesAmount);
    estimatedCompletionAt = optionalFutureDate(payload.estimatedCompletionAt);
  } catch (error) {
    return Response.json({
      error: error instanceof Error ? error.message : "Check the authorization amounts and date.",
    }, { status: 400 });
  }
  if (partsCents !== 0 || otherFeesCents !== 0) {
    return Response.json({
      error: "Tuveloz work orders and change orders are labor only. Remove parts and other-fee amounts.",
      code: "LABOR_ONLY_AUTHORIZATION_REQUIRED",
    }, { status: 400 });
  }
  const totalCents = laborCents;
  if (totalCents > MAX_AMOUNT_CENTS) {
    return Response.json({ error: "The combined amount is above the supported marketplace record limit." }, { status: 400 });
  }

  const diagnosticOnly = payload.diagnosticOnly === true ? "yes" : "no";
  const workmanshipWarranty = text(payload.workmanshipWarranty, 1000)
    || "No additional written workmanship warranty was stated in this authorization.";
  const partsWarranty = text(payload.partsWarranty, 1000)
    || (partsCents > 0
      ? "No additional written parts warranty was stated in this authorization. Any manufacturer warranty remains subject to its own terms."
      : "No new parts are itemized in this authorization.");
  const supersedesAuthorizationId = text(payload.supersedesAuthorizationId, 100);

  if (supersedesAuthorizationId) {
    const superseded = await env.DB.prepare(
      `SELECT id
         FROM job_authorizations
        WHERE id = ?
          AND request_id = ?
          AND lower(provider_email) = lower(?)
          AND authorization_type <> 'accepted-quote'
        LIMIT 1`,
    ).bind(supersedesAuthorizationId, requestId, provider.email).first<{ id: string }>();
    if (!superseded) {
      return Response.json({ error: "The selected authorization cannot be superseded for this job." }, { status: 409 });
    }
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO job_authorizations (
       id, request_id, source_quote_id, provider_email, provider_name,
       customer_email, authorization_type, title, description,
       labor_cents, parts_cents, other_fees_cents, total_cents,
       estimated_completion_at, diagnostic_only, workmanship_warranty,
       parts_warranty, replaced_parts_return, status,
       provider_terms_version, customer_terms_version,
       supersedes_authorization_id, response_note,
       created_at, responded_at, withdrawn_at, updated_at
     ) VALUES (?, ?, '', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
               'not-requested', 'pending', ?, '', ?, '', ?, '', '', ?)`,
  ).bind(
    id,
    requestId,
    cleanEmail(provider.email),
    job.providerName,
    cleanEmail(job.customerEmail),
    authorizationType,
    title,
    description,
    laborCents,
    partsCents,
    otherFeesCents,
    totalCents,
    estimatedCompletionAt,
    diagnosticOnly,
    workmanshipWarranty,
    partsWarranty,
    PROVIDER_WORK_ORDER_VERSION,
    supersedesAuthorizationId,
    now,
    now,
  ).run();

  await env.DB.prepare(
    `INSERT INTO job_authorization_events
       (id, authorization_id, request_id, actor_email, actor_role, action, note, created_at)
     VALUES (?, ?, ?, ?, 'provider', 'created', ?, ?)`,
  ).bind(
    crypto.randomUUID(),
    id,
    requestId,
    cleanEmail(provider.email),
    `${authorizationLabel(authorizationType)} created for ${totalCents} cents.`,
    now,
  ).run();

  if (scopeAuthorization.context && !isIsolatedTestJob(scopeAuthorization.context)) {
    await notifyMarketplaceAccount({
    eventKey: `job-authorization-created:${id}:customer`,
    email: job.customerEmail,
    role: "customer",
    title: `${authorizationLabel(authorizationType)} requires your decision`,
    body: `${job.providerName} proposed “${title}” for $${(totalCents / 100).toFixed(2)}. No additional work or charge is authorized unless you accept it.`,
    href: "/job-authorizations",
    emailSubject: `Tuveloz ${authorizationLabel(authorizationType).toLowerCase()} requires your decision`,
    emailLines: [
      `${job.providerName} proposed: ${title}`,
      `Amount: $${(totalCents / 100).toFixed(2)}`,
      diagnosticOnly === "yes" ? "Scope: diagnostic only; repair work is not authorized by this record." : "Scope: review the complete written description before deciding.",
      "No additional work or additional charge is authorized until you accept this record.",
      "Tuveloz is the marketplace; the independent provider performs the work and states the warranty.",
      "Open Job agreements: https://tuveloz.com/job-authorizations",
    ],
    });
  }

  return Response.json({ ok: true, id, ...(await responseData(request)) }, { status: 201 });
}

async function respondToAuthorization(request: Request, payload: Record<string, unknown>) {
  const session = await getAccountSession(request);
  if (!session || session.role !== "customer") {
    return Response.json({ error: "Only the customer for this job can accept or decline the authorization." }, { status: 401 });
  }
  const id = text(payload.id, 100);
  const decision = text(payload.decision, 20);
  const responseNote = text(payload.responseNote, 800);
  const replacedPartsReturn = text(payload.replacedPartsReturn, 30) || "not-requested";
  if (!id || (decision !== "accepted" && decision !== "declined")) {
    return Response.json({ error: "Choose whether to accept or decline this authorization." }, { status: 400 });
  }
  if (!new Set(["requested", "not-requested", "not-applicable"]).has(replacedPartsReturn)) {
    return Response.json({ error: "Choose a valid replaced-parts preference." }, { status: 400 });
  }
  if (decision === "accepted" && payload.consentAccepted !== true) {
    return Response.json({
      error: "Confirm that you reviewed and authorize only the written scope and amount before accepting.",
    }, { status: 400 });
  }

  const authorization = await env.DB.prepare(
    `SELECT id,
            request_id AS requestId,
            provider_email AS providerEmail,
            provider_name AS providerName,
            customer_email AS customerEmail,
            authorization_type AS authorizationType,
            title,
            total_cents AS totalCents,
            supersedes_authorization_id AS supersedesAuthorizationId,
            status
       FROM job_authorizations
      WHERE id = ?
        AND lower(customer_email) = lower(?)
      LIMIT 1`,
  ).bind(id, session.email).first<{
    id: string;
    requestId: string;
    providerEmail: string;
    providerName: string;
    customerEmail: string;
    authorizationType: AuthorizationType;
    title: string;
    totalCents: number;
    supersedesAuthorizationId: string;
    status: AuthorizationStatus;
  }>();
  if (!authorization) {
    return Response.json({ error: "That authorization does not belong to this customer account." }, { status: 404 });
  }
  if (authorization.status !== "pending") {
    return Response.json({ error: "This authorization was already answered or withdrawn." }, { status: 409 });
  }

  let actionContext: Awaited<ReturnType<typeof assignedJobOperationContext>> = null;
  if (decision === "accepted") {
    const scopeAuthorization = await authorizeScopeMutation(
      authorization.requestId,
      authorization.providerEmail,
    );
    if (scopeAuthorization.response) return scopeAuthorization.response;
    if (
      !scopeAuthorization.context
      || !ACTIVE_JOB_STATUSES.has(scopeAuthorization.context.requestStatus.toLowerCase())
    ) {
      return Response.json(
        { error: "Additional work cannot be accepted after this job stops being active." },
        { status: 409, headers: { "cache-control": "no-store" } },
      );
    }
    actionContext = scopeAuthorization.context;
  } else {
    const declineContext = await assignedJobOperationContext(
      authorization.requestId,
      authorization.providerEmail,
    );
    if (declineContext?.isTestJob === declineContext?.isTestProvider) {
      actionContext = declineContext;
    }
  }

  const now = new Date().toISOString();
  const updated = await env.DB.prepare(
    `UPDATE job_authorizations
        SET status = ?,
            replaced_parts_return = ?,
            customer_terms_version = ?,
            response_note = ?,
            responded_at = ?,
            updated_at = ?
      WHERE id = ? AND status = 'pending'`,
  ).bind(
    decision,
    replacedPartsReturn,
    decision === "accepted" ? CUSTOMER_WORK_ORDER_VERSION : "",
    responseNote,
    now,
    now,
    id,
  ).run();
  if ((updated.meta.changes ?? 0) === 0) {
    return Response.json({ error: "This authorization changed before your response was saved." }, { status: 409 });
  }

  if (decision === "accepted" && authorization.supersedesAuthorizationId) {
    await env.DB.prepare(
      `UPDATE job_authorizations
          SET status = 'superseded', updated_at = ?
        WHERE id = ?
          AND request_id = ?
          AND authorization_type <> 'accepted-quote'
          AND status IN ('accepted','pending')`,
    ).bind(now, authorization.supersedesAuthorizationId, authorization.requestId).run();
  }

  await env.DB.prepare(
    `INSERT INTO job_authorization_events
       (id, authorization_id, request_id, actor_email, actor_role, action, note, created_at)
     VALUES (?, ?, ?, ?, 'customer', ?, ?, ?)`,
  ).bind(
    crypto.randomUUID(),
    id,
    authorization.requestId,
    cleanEmail(session.email),
    decision,
    responseNote || `${authorizationLabel(authorization.authorizationType)} ${decision}.`,
    now,
  ).run();

  if (actionContext && !isIsolatedTestJob(actionContext)) {
    await notifyMarketplaceAccount({
      eventKey: `job-authorization-response:${id}:${decision}:provider`,
    email: authorization.providerEmail,
    role: "provider",
    title: `${authorizationLabel(authorization.authorizationType)} ${decision}`,
    body: `The customer ${decision} “${authorization.title}” for $${(authorization.totalCents / 100).toFixed(2)}. Open Job agreements for the recorded decision.`,
    href: "/job-authorizations",
    emailSubject: `Tuveloz ${authorizationLabel(authorization.authorizationType).toLowerCase()} ${decision}`,
    emailLines: [
      `The customer ${decision}: ${authorization.title}`,
      `Amount: $${(authorization.totalCents / 100).toFixed(2)}`,
      decision === "accepted"
        ? "Only the written scope and amount in this authorization were approved. A later change requires another customer decision."
        : "The declined work or charge is not authorized.",
      "Open Job agreements: https://tuveloz.com/job-authorizations",
    ],
    });
  }

  return Response.json({ ok: true, ...(await responseData(request)) });
}

async function withdrawAuthorization(request: Request, payload: Record<string, unknown>) {
  const session = await getAccountSession(request);
  if (!session || session.role !== "provider") {
    return Response.json({ error: "Only the provider who created this authorization can withdraw it." }, { status: 401 });
  }
  const provider = await providerAccountFor(session.email);
  if (!provider) return Response.json({ error: "Verified provider access is required." }, { status: 403 });
  const id = text(payload.id, 100);
  if (!id) return Response.json({ error: "Choose a pending authorization." }, { status: 400 });

  const authorization = await env.DB.prepare(
    `SELECT id,
            request_id AS requestId,
            customer_email AS customerEmail,
            authorization_type AS authorizationType,
            title,
            status
       FROM job_authorizations
      WHERE id = ?
        AND lower(provider_email) = lower(?)
      LIMIT 1`,
  ).bind(id, provider.email).first<{
    id: string;
    requestId: string;
    customerEmail: string;
    authorizationType: AuthorizationType;
    title: string;
    status: AuthorizationStatus;
  }>();
  if (!authorization) return Response.json({ error: "Authorization not found." }, { status: 404 });
  if (authorization.status !== "pending") {
    return Response.json({ error: "Only a pending authorization can be withdrawn." }, { status: 409 });
  }

  const now = new Date().toISOString();
  await env.DB.prepare(
    `UPDATE job_authorizations
        SET status = 'withdrawn', withdrawn_at = ?, updated_at = ?
      WHERE id = ? AND status = 'pending'`,
  ).bind(now, now, id).run();
  await env.DB.prepare(
    `INSERT INTO job_authorization_events
       (id, authorization_id, request_id, actor_email, actor_role, action, note, created_at)
     VALUES (?, ?, ?, ?, 'provider', 'withdrawn', ?, ?)`,
  ).bind(
    crypto.randomUUID(),
    id,
    authorization.requestId,
    cleanEmail(provider.email),
    `${authorizationLabel(authorization.authorizationType)} withdrawn before customer acceptance.`,
    now,
  ).run();

  const withdrawalContext = await assignedJobOperationContext(
    authorization.requestId,
    provider.email,
  );
  if (
    withdrawalContext
    && withdrawalContext.providerId === provider.id
    && !withdrawalContext.isTestJob
    && !withdrawalContext.isTestProvider
  ) {
    await notifyMarketplaceAccount({
      eventKey: `job-authorization-withdrawn:${id}:customer`,
    email: authorization.customerEmail,
    role: "customer",
    title: `${authorizationLabel(authorization.authorizationType)} withdrawn`,
    body: `The provider withdrew “${authorization.title}” before you accepted it. It is not authorized.`,
    href: "/job-authorizations",
    emailSubject: `Tuveloz ${authorizationLabel(authorization.authorizationType).toLowerCase()} withdrawn`,
    emailLines: [
      `The provider withdrew: ${authorization.title}`,
      "The withdrawn work or charge is not authorized.",
      "Open Job agreements: https://tuveloz.com/job-authorizations",
    ],
    });
  }

  return Response.json({ ok: true, ...(await responseData(request)) });
}

export async function GET(request: Request) {
  const data = await responseData(request);
  if (!data) {
    return Response.json({ error: "Sign in to view Job agreements." }, { status: 401, headers: { "cache-control": "no-store" } });
  }
  return Response.json(data, { headers: { "cache-control": "private, no-store" } });
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "This authorization action must come from Tuveloz." }, { status: 403 });
  }
  let payload: Record<string, unknown>;
  try {
    payload = await request.json() as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Submit a valid authorization action." }, { status: 400 });
  }
  const action = text(payload.action, 30);
  try {
    if (action === "create") return await createAuthorization(request, payload);
    if (action === "respond") return await respondToAuthorization(request, payload);
    if (action === "withdraw") return await withdrawAuthorization(request, payload);
    return Response.json({ error: "Unknown authorization action." }, { status: 400 });
  } catch (error) {
    console.error("Unable to update a Tuveloz job authorization", error);
    return Response.json({ error: "Unable to save this job authorization." }, { status: 503 });
  }
}
