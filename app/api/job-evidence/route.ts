import { env } from "cloudflare:workers";
import { getAccountSession, providerAccountFor } from "../../../lib/account-auth";
import {
  deleteJobEvidenceImage,
  storeJobEvidenceImage,
} from "../../../lib/job-evidence-images";
import { ImageValidationError, validateJobImage } from "../../../lib/job-images";
import { notifyMarketplaceAccount } from "../../../lib/marketplace-notifications";
import { isSameOriginRequest } from "../../../lib/request-security";

type AccountRole = "customer" | "provider";
type EvidenceType =
  | "customer-condition"
  | "provider-before-work"
  | "progress"
  | "receipt-note"
  | "completion-note";

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
};

type EvidenceRow = {
  id: string;
  requestId: string;
  uploadedByRole: AccountRole;
  evidenceType: EvidenceType;
  imageKey: string;
  note: string;
  odometerMiles: number;
  technicianName: string;
  createdAt: string;
};

const CUSTOMER_EVIDENCE_TYPES = new Set<EvidenceType>(["customer-condition"]);
const PROVIDER_EVIDENCE_TYPES = new Set<EvidenceType>([
  "provider-before-work",
  "progress",
  "receipt-note",
  "completion-note",
]);
const MAX_EVIDENCE_ITEMS_PER_JOB = 30;

function text(value: unknown, maximum: number) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

function cleanEmail(value: string) {
  return value.trim().toLowerCase();
}

function odometer(value: unknown) {
  const raw = text(value, 20);
  if (!raw) return 0;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 9_999_999) {
    throw new Error("Enter a valid whole-number odometer reading, or leave it blank.");
  }
  return parsed;
}

async function signedInAccount(request: Request) {
  const session = await getAccountSession(request);
  if (!session || (session.role !== "customer" && session.role !== "provider")) return null;
  if (session.role === "provider" && !(await providerAccountFor(session.email))) return null;
  return { email: cleanEmail(session.email), role: session.role as AccountRole };
}

async function acceptedJobs(role: AccountRole, email: string) {
  const condition = role === "provider"
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
            request.is_test_job AS isTestJob
       FROM customer_requests request
       INNER JOIN provider_quotes quote
         ON quote.request_id = request.id
        AND quote.status = 'accepted'
      WHERE ${condition}
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

async function evidenceRows(role: AccountRole, email: string) {
  const field = role === "provider" ? "provider_email" : "customer_email";
  const result = await env.DB.prepare(
    `SELECT id,
            request_id AS requestId,
            uploaded_by_role AS uploadedByRole,
            evidence_type AS evidenceType,
            image_key AS imageKey,
            note,
            odometer_miles AS odometerMiles,
            technician_name AS technicianName,
            created_at AS createdAt
       FROM job_evidence_items
      WHERE lower(${field}) = lower(?)
      ORDER BY datetime(created_at) ASC
      LIMIT 2000`,
  ).bind(email).all<EvidenceRow>();
  return result.results ?? [];
}

function publicEvidence(row: EvidenceRow) {
  return {
    id: row.id,
    requestId: row.requestId,
    uploadedByRole: row.uploadedByRole,
    evidenceType: row.evidenceType,
    imageAvailable: Boolean(row.imageKey),
    imageUrl: row.imageKey ? `/api/job-evidence/image?id=${encodeURIComponent(row.id)}` : "",
    note: row.note,
    odometerMiles: row.odometerMiles,
    technicianName: row.technicianName,
    createdAt: row.createdAt,
  };
}

async function responseData(email: string, role: AccountRole) {
  const [jobs, evidence] = await Promise.all([
    acceptedJobs(role, email),
    evidenceRows(role, email),
  ]);
  const byRequest = evidence.reduce<Map<string, EvidenceRow[]>>((groups, item) => {
    const current = groups.get(item.requestId) ?? [];
    current.push(item);
    groups.set(item.requestId, current);
    return groups;
  }, new Map());
  return {
    role,
    email,
    jobs: jobs.map((job) => ({
      ...job,
      evidence: (byRequest.get(job.requestId) ?? []).map(publicEvidence),
    })),
    principles: [
      "Condition records are private to the customer, the selected provider, and authorized Tuveloz support when reasonably needed.",
      "A photo or note records only what was visible or stated at that time. It is not a complete inspection, a guarantee, an admission, or a waiver of legal rights.",
      "The record does not authorize additional work or charges. Added work still requires a separate written authorization.",
      "Uploaded evidence is retained as an immutable marketplace record; corrections should be added as a new note rather than silently replacing the earlier record.",
    ],
  };
}

async function participantJob(role: AccountRole, email: string, requestId: string) {
  const condition = role === "provider"
    ? "lower(quote.provider_email) = lower(?)"
    : "lower(request.email) = lower(?)";
  return env.DB.prepare(
    `SELECT request.id AS requestId,
            request.vehicle,
            request.service,
            request.status AS requestStatus,
            request.name AS customerName,
            lower(request.email) AS customerEmail,
            quote.provider_name AS providerName,
            lower(quote.provider_email) AS providerEmail,
            request.is_test_job AS isTestJob
       FROM customer_requests request
       INNER JOIN provider_quotes quote
         ON quote.request_id = request.id
        AND quote.status = 'accepted'
      WHERE request.id = ?
        AND ${condition}
        AND EXISTS (
          SELECT 1
            FROM provider_applications provider
           WHERE lower(provider.email) = lower(quote.provider_email)
             AND provider.is_test_provider = request.is_test_job
        )
        AND request.status NOT IN ('cancelled','canceled')
      LIMIT 1`,
  ).bind(requestId, email).first<AcceptedJobRow>();
}

function evidenceStatusAllowed(type: EvidenceType, jobStatus: string) {
  const status = jobStatus.trim().toLowerCase();
  if (type === "provider-before-work") {
    return new Set(["quote accepted", "on my way", "arrived"]).has(status);
  }
  if (type === "progress") {
    return new Set(["on my way", "arrived"]).has(status);
  }
  if (type === "receipt-note" || type === "completion-note") {
    return new Set(["arrived", "completed"]).has(status);
  }
  return new Set(["quote accepted", "on my way", "arrived", "completed"]).has(status);
}

export async function GET(request: Request) {
  const account = await signedInAccount(request);
  if (!account) {
    return Response.json(
      { error: "Sign in to view private job condition records." },
      { status: 401, headers: { "cache-control": "private, no-store" } },
    );
  }
  return Response.json(
    await responseData(account.email, account.role),
    { headers: { "cache-control": "private, no-store" } },
  );
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "This job-record action must come from Tuveloz." }, { status: 403 });
  }
  const account = await signedInAccount(request);
  if (!account) return Response.json({ error: "Sign in to add a job record." }, { status: 401 });

  let storedImageKey = "";
  try {
    const contentType = request.headers.get("content-type") ?? "";
    let body: Record<string, unknown>;
    let imageInput: unknown;
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      body = Object.fromEntries(form.entries());
      imageInput = form.get("image");
    } else {
      body = await request.json() as Record<string, unknown>;
    }

    const action = text(body.action, 20);
    if (action !== "add") {
      return Response.json({ error: "Unknown job-record action." }, { status: 400 });
    }
    const requestId = text(body.requestId, 100);
    const evidenceType = text(body.evidenceType, 40) as EvidenceType;
    const note = text(body.note, 1600);
    const technicianName = account.role === "provider"
      ? text(body.technicianName, 100)
      : "";
    const odometerMiles = odometer(body.odometerMiles);
    const allowed = account.role === "provider"
      ? PROVIDER_EVIDENCE_TYPES
      : CUSTOMER_EVIDENCE_TYPES;
    if (!requestId || !allowed.has(evidenceType)) {
      return Response.json({ error: "Choose a valid accepted job and record type." }, { status: 400 });
    }

    const job = await participantJob(account.role, account.email, requestId);
    if (!job) {
      return Response.json(
        { error: "Only the customer and selected provider can add records to this accepted job." },
        { status: 403 },
      );
    }
    if (!evidenceStatusAllowed(evidenceType, job.requestStatus)) {
      return Response.json(
        { error: "That record type is not available at the job's current status." },
        { status: 409 },
      );
    }

    const count = await env.DB.prepare(
      `SELECT count(*) AS total FROM job_evidence_items WHERE request_id = ?`,
    ).bind(requestId).first<{ total: number }>();
    if ((count?.total ?? 0) >= MAX_EVIDENCE_ITEMS_PER_JOB) {
      return Response.json(
        { error: "This job has reached the private evidence-record limit. Contact Tuveloz support if another record is necessary." },
        { status: 409 },
      );
    }

    const image = await validateJobImage(imageInput, false);
    if (!image && note.length < 3) {
      return Response.json({ error: "Add a photo or a short factual note." }, { status: 400 });
    }
    const id = crypto.randomUUID();
    if (image) {
      storedImageKey = await storeJobEvidenceImage(requestId, id, image);
    }

    await env.DB.prepare(
      `INSERT INTO job_evidence_items
         (id, request_id, provider_email, customer_email,
          uploaded_by_email, uploaded_by_role, evidence_type,
          image_key, image_type, note, odometer_miles, technician_name,
          record_version, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
               'job-evidence-2026-07-31', CURRENT_TIMESTAMP)`,
    ).bind(
      id,
      requestId,
      job.providerEmail,
      job.customerEmail,
      account.email,
      account.role,
      evidenceType,
      storedImageKey,
      image?.contentType ?? "",
      note,
      odometerMiles,
      technicianName,
    ).run();

    const recipientRole: AccountRole = account.role === "customer" ? "provider" : "customer";
    const recipientEmail = account.role === "customer" ? job.providerEmail : job.customerEmail;
    if (job.isTestJob !== "yes") {
      await notifyMarketplaceAccount({
        eventKey: `job-evidence:${id}:${recipientRole}`,
      email: recipientEmail,
      role: recipientRole,
      title: "New private job condition record",
      body: `${account.role === "provider" ? job.providerName : job.customerName} added a private ${evidenceType.replaceAll("-", " ")} record for ${job.service}.`,
      href: "/job-evidence",
      });
    }

    return Response.json({
      ok: true,
      evidenceId: id,
      ...(await responseData(account.email, account.role)),
    }, { status: 201 });
  } catch (error) {
    if (storedImageKey) {
      await deleteJobEvidenceImage(storedImageKey).catch(() => undefined);
    }
    if (error instanceof ImageValidationError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    console.error("Unable to add private job evidence", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to add the private job record." },
      { status: 400 },
    );
  }
}
