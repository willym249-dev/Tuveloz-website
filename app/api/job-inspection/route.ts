import { env } from "cloudflare:workers";
import { asc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { jobInspectionItems } from "../../../db/schema";
import { getAccountSession, providerAccountFor } from "../../../lib/account-auth";
import {
  inspectionSuggestionsForCodes,
  serviceLabelsForCodes,
} from "../../../lib/inspection-templates";
import { marketplacePausedMessage } from "../../../lib/launch-status";
import { notifyMarketplaceAccount } from "../../../lib/marketplace-notifications";
import { isSameOriginRequest } from "../../../lib/request-security";
import { runtimeMarketplaceActionAllowed } from "../../../lib/runtime-marketplace-action";

const NO_STORE = { "cache-control": "no-store" } as const;
const MAX_ITEMS = 25;
const INSPECTION_STATUSES = new Set(["pending", "good", "attention"]);

type JobRow = {
  requestId: string;
  service: string;
  serviceCodes: string;
  requestStatus: string;
  customerName: string;
  customerEmail: string;
  providerName: string;
  providerEmail: string;
  isTestJob: string;
};

function text(value: unknown, maximum: number) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: NO_STORE });
}

function parseCodes(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : [];
  } catch {
    return [];
  }
}

const JOB_COLUMNS = `request.id AS requestId,
        request.service AS service,
        request.service_codes AS serviceCodes,
        request.status AS requestStatus,
        request.name AS customerName,
        lower(request.email) AS customerEmail,
        quote.provider_name AS providerName,
        lower(quote.provider_email) AS providerEmail,
        request.is_test_job AS isTestJob`;

// The provider may only touch the inspection on a job whose accepted quote is
// theirs, and only when their test flag matches the job's — the same
// participant rule the job-evidence route enforces.
async function providerJob(email: string, requestId: string) {
  return env.DB.prepare(
    `SELECT ${JOB_COLUMNS}
       FROM customer_requests request
       INNER JOIN provider_quotes quote
         ON quote.request_id = request.id
        AND quote.status = 'accepted'
      WHERE request.id = ?
        AND lower(quote.provider_email) = lower(?)
        AND EXISTS (
          SELECT 1 FROM provider_applications provider
           WHERE lower(provider.email) = lower(quote.provider_email)
             AND provider.is_test_provider = request.is_test_job
        )
        AND request.status NOT IN ('cancelled','canceled')
      LIMIT 1`,
  ).bind(requestId, email).first<JobRow>();
}

// The customer reads their own job's inspection with the private request token —
// no sign-in required, matching how /api/job-images gates customer image reads.
async function customerTokenJob(token: string) {
  return env.DB.prepare(
    `SELECT ${JOB_COLUMNS}
       FROM customer_requests request
       INNER JOIN provider_quotes quote
         ON quote.request_id = request.id
        AND quote.status = 'accepted'
      WHERE request.access_token = ?
        AND request.status NOT IN ('cancelled','canceled')
      LIMIT 1`,
  ).bind(token).first<JobRow>();
}

async function itemsFor(requestId: string) {
  return getDb().select({
    id: jobInspectionItems.id,
    label: jobInspectionItems.label,
    status: jobInspectionItems.status,
    note: jobInspectionItems.note,
    position: jobInspectionItems.position,
  }).from(jobInspectionItems)
    .where(eq(jobInspectionItems.requestId, requestId))
    .orderBy(asc(jobInspectionItems.position));
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = text(url.searchParams.get("token"), 120);
  const requestId = text(url.searchParams.get("requestId"), 80);

  if (token) {
    const job = await customerTokenJob(token);
    if (!job) return json({ error: "We could not find that job." }, 404);
    return json({
      role: "customer",
      canEdit: false,
      items: await itemsFor(job.requestId),
      serviceLabels: serviceLabelsForCodes(parseCodes(job.serviceCodes)),
    });
  }

  const session = await getAccountSession(request);
  if (!session || session.role !== "provider" || !(await providerAccountFor(session.email))) {
    return json({ error: "Sign in to your provider workspace." }, 401);
  }
  if (!requestId) return json({ error: "Missing job." }, 400);
  const job = await providerJob(session.email, requestId);
  if (!job) return json({ error: "That job is not on your account." }, 404);
  const codes = parseCodes(job.serviceCodes);
  return json({
    role: "provider",
    canEdit: true,
    items: await itemsFor(job.requestId),
    suggestions: inspectionSuggestionsForCodes(codes),
    serviceLabels: serviceLabelsForCodes(codes),
  });
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return json({ error: "This inspection action must come from Tuveloz." }, 403);
  }
  const session = await getAccountSession(request);
  if (!session || session.role !== "provider" || !(await providerAccountFor(session.email))) {
    return json({ error: "Sign in to your provider workspace." }, 401);
  }
  const body = (await request.json().catch(() => ({}))) as { requestId?: unknown; items?: unknown };
  const requestId = text(body.requestId, 80);
  const job = await providerJob(session.email, requestId);
  if (!job) return json({ error: "That job is not on your account." }, 404);
  if (!(await runtimeMarketplaceActionAllowed("job_start", { testOnly: job.isTestJob === "yes" }))) {
    return json(
      { error: marketplacePausedMessage("job_start"), code: "MARKETPLACE_ONBOARDING_ONLY" },
      503,
    );
  }

  const rawItems = Array.isArray(body.items) ? body.items : [];
  const cleaned = rawItems.slice(0, MAX_ITEMS).map((raw, index) => {
    const item = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    const status = text(item.status, 20);
    return {
      label: text(item.label, 80),
      status: INSPECTION_STATUSES.has(status) ? status : "pending",
      note: text(item.note, 300),
      position: index,
    };
  }).filter((item) => item.label);

  const db = getDb();
  const now = new Date().toISOString();
  const rows = cleaned.map((item) => ({
    id: crypto.randomUUID(),
    requestId: job.requestId,
    providerEmail: job.providerEmail,
    label: item.label,
    status: item.status,
    note: item.note,
    position: item.position,
    createdAt: now,
    updatedAt: now,
  }));
  // Replace-all: the provider always sends the full current checklist. D1 batches
  // commit atomically, so a failed insert cannot erase the previous checklist.
  const deleteExisting = db.delete(jobInspectionItems).where(eq(jobInspectionItems.requestId, job.requestId));
  if (rows.length) {
    await db.batch([deleteExisting, db.insert(jobInspectionItems).values(rows)] as const);
  } else {
    await db.batch([deleteExisting] as const);
  }

  if (job.isTestJob !== "yes") {
    try {
      await notifyMarketplaceAccount({
        eventKey: `job-inspection:${job.requestId}:${now}`,
        email: job.customerEmail,
        role: "customer",
        title: "Your provider updated the job inspection",
        body: `${job.providerName} updated the inspection checklist for ${job.service}.`,
        href: "/my-request",
      });
    } catch (error) {
      console.error("Unable to notify customer of inspection update", error);
    }
  }

  const codes = parseCodes(job.serviceCodes);
  return json({
    ok: true,
    role: "provider",
    canEdit: true,
    items: await itemsFor(job.requestId),
    suggestions: inspectionSuggestionsForCodes(codes),
    serviceLabels: serviceLabelsForCodes(codes),
  });
}
