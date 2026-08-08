import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { jobAppointments } from "../../../db/schema";
import { getAccountSession, providerAccountFor } from "../../../lib/account-auth";
import { marketplacePausedMessage } from "../../../lib/launch-status";
import { notifyMarketplaceAccount } from "../../../lib/marketplace-notifications";
import { isSameOriginRequest } from "../../../lib/request-security";
import { runtimeMarketplaceActionAllowed } from "../../../lib/runtime-marketplace-action";

const NO_STORE = { "cache-control": "no-store" } as const;

type JobRow = {
  requestId: string;
  service: string;
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

const JOB_COLUMNS = `request.id AS requestId,
        request.service AS service,
        lower(request.email) AS customerEmail,
        quote.provider_name AS providerName,
        lower(quote.provider_email) AS providerEmail,
        request.is_test_job AS isTestJob`;

async function providerJob(email: string, requestId: string) {
  return env.DB.prepare(
    `SELECT ${JOB_COLUMNS}
       FROM customer_requests request
       INNER JOIN provider_quotes quote
         ON quote.request_id = request.id AND quote.status = 'accepted'
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

async function customerTokenJob(token: string) {
  return env.DB.prepare(
    `SELECT ${JOB_COLUMNS}
       FROM customer_requests request
       INNER JOIN provider_quotes quote
         ON quote.request_id = request.id AND quote.status = 'accepted'
      WHERE request.access_token = ?
        AND request.status NOT IN ('cancelled','canceled')
      LIMIT 1`,
  ).bind(token).first<JobRow>();
}

async function appointmentFor(requestId: string) {
  const [row] = await getDb().select({
    appointmentAt: jobAppointments.appointmentAt,
    note: jobAppointments.note,
  }).from(jobAppointments).where(eq(jobAppointments.requestId, requestId)).limit(1);
  return row ?? null;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = text(url.searchParams.get("token"), 120);
  const requestId = text(url.searchParams.get("requestId"), 80);

  if (token) {
    const job = await customerTokenJob(token);
    if (!job) return json({ error: "We could not find that job." }, 404);
    return json({ role: "customer", canEdit: false, appointment: await appointmentFor(job.requestId) });
  }

  const session = await getAccountSession(request);
  if (!session || session.role !== "provider" || !(await providerAccountFor(session.email))) {
    return json({ error: "Sign in to your provider workspace." }, 401);
  }
  if (!requestId) return json({ error: "Missing job." }, 400);
  const job = await providerJob(session.email, requestId);
  if (!job) return json({ error: "That job is not on your account." }, 404);
  return json({ role: "provider", canEdit: true, appointment: await appointmentFor(job.requestId) });
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return json({ error: "This scheduling action must come from Tuveloz." }, 403);
  }
  const session = await getAccountSession(request);
  if (!session || session.role !== "provider" || !(await providerAccountFor(session.email))) {
    return json({ error: "Sign in to your provider workspace." }, 401);
  }
  const body = (await request.json().catch(() => ({}))) as {
    requestId?: unknown;
    appointmentAt?: unknown;
    note?: unknown;
  };
  const requestId = text(body.requestId, 80);
  const job = await providerJob(session.email, requestId);
  if (!job) return json({ error: "That job is not on your account." }, 404);
  if (!(await runtimeMarketplaceActionAllowed("appointment", { testOnly: job.isTestJob === "yes" }))) {
    return json(
      { error: marketplacePausedMessage("booking"), code: "MARKETPLACE_ONBOARDING_ONLY" },
      503,
    );
  }

  const appointmentAt = text(body.appointmentAt, 40);
  const note = text(body.note, 200);
  const db = getDb();
  const now = new Date().toISOString();

  // Empty time clears the appointment entirely.
  if (!appointmentAt) {
    await db.delete(jobAppointments).where(eq(jobAppointments.requestId, job.requestId));
    return json({ ok: true, role: "provider", canEdit: true, appointment: null });
  }

  const parsed = Date.parse(appointmentAt);
  if (!Number.isFinite(parsed)) {
    return json({ error: "Pick a valid date and time." }, 400);
  }
  if (parsed <= Date.now()) {
    return json({ error: "Pick a future date and time." }, 400);
  }

  // Replace-then-insert resets reminder_sent_at so a changed time re-reminds.
  // The D1 batch is atomic, so an insert failure cannot erase the old appointment.
  const deleteExisting = db.delete(jobAppointments).where(eq(jobAppointments.requestId, job.requestId));
  const insertAppointment = db.insert(jobAppointments).values({
    id: crypto.randomUUID(),
    requestId: job.requestId,
    providerEmail: job.providerEmail,
    appointmentAt,
    note,
    reminderSentAt: "",
    createdAt: now,
    updatedAt: now,
  });
  await db.batch([deleteExisting, insertAppointment] as const);

  if (job.isTestJob !== "yes") {
    try {
      await notifyMarketplaceAccount({
        eventKey: `job-appointment-set:${job.requestId}:${appointmentAt}`,
        email: job.customerEmail,
        role: "customer",
        title: "Your provider scheduled a time",
        body: `${job.providerName} scheduled a time for your ${job.service}. See your request for details.`,
        href: "/my-request",
        emailSubject: "Your Tuveloz provider scheduled a time",
        emailLines: [
          `${job.providerName} set an appointment for your ${job.service}.`,
          "Open your private request page: https://tuveloz.com/my-request",
        ],
      });
    } catch (error) {
      console.error("Unable to notify customer of appointment", error);
    }
  }

  return json({ ok: true, role: "provider", canEdit: true, appointment: { appointmentAt, note } });
}
