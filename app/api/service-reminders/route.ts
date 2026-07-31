import { env } from "cloudflare:workers";
import { getAccountSession } from "../../../lib/account-auth";
import { isSameOriginRequest } from "../../../lib/request-security";

type ServiceReminderRow = {
  id: string;
  vehicle: string;
  service: string;
  dueDate: string;
  dueMileage: number;
  currentMileage: number;
  note: string;
  sourceRequestId: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

type CompletedJobRow = {
  id: string;
  vehicle: string;
  service: string;
  completedAt: string;
};

const REMINDER_STATUSES = new Set(["active", "completed", "dismissed"]);

function text(value: unknown, maximum: number) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

function mileage(value: unknown) {
  const parsed = Math.round(Number(String(value ?? "").trim() || "0"));
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 10_000_000) {
    throw new Error("Enter a valid non-negative mileage.");
  }
  return parsed;
}

async function customerSession(request: Request) {
  const session = await getAccountSession(request);
  return session?.role === "customer" ? session : null;
}

async function responseData(email: string) {
  const [reminderResult, completedResult] = await Promise.all([
    env.DB.prepare(
      `SELECT id,
              vehicle,
              service,
              due_date AS dueDate,
              due_mileage AS dueMileage,
              current_mileage AS currentMileage,
              note,
              source_request_id AS sourceRequestId,
              status,
              created_at AS createdAt,
              updated_at AS updatedAt
         FROM customer_service_reminders
        WHERE lower(customer_email) = lower(?)
        ORDER BY CASE status WHEN 'active' THEN 0 WHEN 'completed' THEN 1 ELSE 2 END,
                 CASE WHEN due_date = '' THEN 1 ELSE 0 END,
                 due_date ASC,
                 datetime(updated_at) DESC`,
    ).bind(email).all<ServiceReminderRow>(),
    env.DB.prepare(
      `SELECT request.id,
              request.vehicle,
              request.service,
              COALESCE(
                (SELECT record.updated_at
                   FROM provider_job_records record
                  WHERE record.request_id = request.id
                  ORDER BY datetime(record.updated_at) DESC
                  LIMIT 1),
                request.created_at
              ) AS completedAt
         FROM customer_requests request
        WHERE lower(request.email) = lower(?)
          AND lower(request.status) = 'completed'
        ORDER BY datetime(completedAt) DESC
        LIMIT 30`,
    ).bind(email).all<CompletedJobRow>(),
  ]);

  return {
    accountEmail: email,
    reminders: reminderResult.results ?? [],
    completedJobs: completedResult.results ?? [],
  };
}

export async function GET(request: Request) {
  const session = await customerSession(request);
  if (!session) {
    return Response.json(
      { error: "Sign in to your customer workspace." },
      { status: 401, headers: { "cache-control": "no-store" } },
    );
  }

  return Response.json(await responseData(session.email), {
    headers: { "cache-control": "no-store" },
  });
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return Response.json(
      { error: "This reminder update must come from Tuveloz." },
      { status: 403 },
    );
  }

  const session = await customerSession(request);
  if (!session) {
    return Response.json({ error: "Sign in to your customer workspace." }, { status: 401 });
  }

  try {
    const payload = await request.json() as Record<string, unknown>;
    const action = text(payload.action, 40);

    if (action === "save-reminder") {
      const id = text(payload.id, 80);
      const vehicle = text(payload.vehicle, 140);
      const service = text(payload.service, 160);
      const dueDate = text(payload.dueDate, 20);
      const note = text(payload.note, 800);
      const sourceRequestId = text(payload.sourceRequestId, 80);
      let dueMileage: number;
      let currentMileage: number;

      try {
        dueMileage = mileage(payload.dueMileage);
        currentMileage = mileage(payload.currentMileage);
      } catch (error) {
        return Response.json(
          { error: error instanceof Error ? error.message : "Check the reminder mileage." },
          { status: 400 },
        );
      }

      if (!vehicle || !service) {
        return Response.json(
          { error: "Enter the vehicle and service for this reminder." },
          { status: 400 },
        );
      }
      if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
        return Response.json(
          { error: "Choose a valid due date or leave it blank." },
          { status: 400 },
        );
      }
      if (!dueDate && dueMileage === 0) {
        return Response.json(
          { error: "Enter a due date, due mileage, or both." },
          { status: 400 },
        );
      }
      if (dueMileage > 0 && currentMileage > dueMileage) {
        return Response.json(
          { error: "Due mileage should not be below the current mileage." },
          { status: 400 },
        );
      }

      if (sourceRequestId) {
        const source = await env.DB.prepare(
          `SELECT id
             FROM customer_requests
            WHERE id = ?
              AND lower(email) = lower(?)
              AND lower(status) = 'completed'
            LIMIT 1`,
        ).bind(sourceRequestId, session.email).first<{ id: string }>();
        if (!source) {
          return Response.json(
            { error: "The selected completed job is not available for this account." },
            { status: 403 },
          );
        }
      }

      if (id) {
        const existing = await env.DB.prepare(
          `SELECT id
             FROM customer_service_reminders
            WHERE id = ? AND lower(customer_email) = lower(?)
            LIMIT 1`,
        ).bind(id, session.email).first<{ id: string }>();
        if (!existing) {
          return Response.json({ error: "Service reminder not found." }, { status: 404 });
        }
        await env.DB.prepare(
          `UPDATE customer_service_reminders
              SET vehicle = ?,
                  service = ?,
                  due_date = ?,
                  due_mileage = ?,
                  current_mileage = ?,
                  note = ?,
                  source_request_id = ?,
                  status = 'active',
                  updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND lower(customer_email) = lower(?)`,
        ).bind(
          vehicle,
          service,
          dueDate,
          dueMileage,
          currentMileage,
          note,
          sourceRequestId,
          id,
          session.email,
        ).run();
      } else {
        await env.DB.prepare(
          `INSERT INTO customer_service_reminders (
             id, customer_email, vehicle, service,
             due_date, due_mileage, current_mileage,
             note, source_request_id, status, created_at, updated_at
           ) VALUES (?, lower(?), ?, ?, ?, ?, ?, ?, ?, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        ).bind(
          crypto.randomUUID(),
          session.email,
          vehicle,
          service,
          dueDate,
          dueMileage,
          currentMileage,
          note,
          sourceRequestId,
        ).run();
      }

      return Response.json({ ok: true, ...(await responseData(session.email)) });
    }

    if (action === "set-status") {
      const id = text(payload.id, 80);
      const status = text(payload.status, 20);
      if (!id || !REMINDER_STATUSES.has(status)) {
        return Response.json({ error: "Choose a valid reminder status." }, { status: 400 });
      }
      await env.DB.prepare(
        `UPDATE customer_service_reminders
            SET status = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND lower(customer_email) = lower(?)`,
      ).bind(status, id, session.email).run();
      return Response.json({ ok: true, ...(await responseData(session.email)) });
    }

    if (action === "delete-reminder") {
      const id = text(payload.id, 80);
      if (!id) {
        return Response.json({ error: "Service reminder not found." }, { status: 400 });
      }
      await env.DB.prepare(
        "DELETE FROM customer_service_reminders WHERE id = ? AND lower(customer_email) = lower(?)",
      ).bind(id, session.email).run();
      return Response.json({ ok: true, ...(await responseData(session.email)) });
    }

    return Response.json({ error: "Unknown service-reminder action." }, { status: 400 });
  } catch (error) {
    console.error("Unable to update customer service reminders", error);
    return Response.json(
      { error: "The service reminder could not be saved." },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}
