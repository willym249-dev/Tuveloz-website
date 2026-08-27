import { and, asc, desc, eq, sql } from "drizzle-orm";
import { getDb } from "../../../db";
import { customerRequests, customerServiceReminders } from "../../../db/schema";
import { getAccountSession } from "../../../lib/account-auth";
import {
  MAX_SERVICE_REMINDERS,
  isReminderStatus,
  validateServiceReminder,
} from "../../../lib/customer-service-reminders";
import { isSameOriginRequest } from "../../../lib/request-security";

const NO_STORE = { "cache-control": "no-store" } as const;

async function customerSession(request: Request) {
  const session = await getAccountSession(request);
  if (!session) return null;
  return session.role === "customer" ? session : false;
}

function unauthorized(session: null | false) {
  return session === null
    ? Response.json(
      { error: "Sign in to manage your service reminders." },
      { status: 401, headers: NO_STORE },
    )
    : Response.json(
      { error: "Customer access required." },
      { status: 403, headers: NO_STORE },
    );
}

function crossOriginBlocked() {
  return Response.json(
    { error: "This request could not be verified. Reload the page and try again." },
    { status: 403, headers: NO_STORE },
  );
}

async function listReminders(email: string) {
  const rows = await getDb().select().from(customerServiceReminders)
    .where(sql`lower(${customerServiceReminders.customerEmail}) = ${email.toLowerCase()}`)
    .orderBy(
      sql`CASE ${customerServiceReminders.status} WHEN 'active' THEN 0 WHEN 'completed' THEN 1 ELSE 2 END`,
      sql`CASE WHEN ${customerServiceReminders.dueDate} = '' THEN 1 ELSE 0 END`,
      asc(customerServiceReminders.dueDate),
      desc(customerServiceReminders.updatedAt),
    );
  return rows.map((row) => ({
    id: row.id,
    vehicle: row.vehicle,
    service: row.service,
    dueDate: row.dueDate,
    dueMileage: row.dueMileage,
    currentMileage: row.currentMileage,
    note: row.note,
    sourceRequestId: row.sourceRequestId,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }));
}

/**
 * Completed, real jobs on this account, offered as starting points so a
 * reminder can begin from work Tuveloz actually saw. Test records stay
 * isolated from real accounts, so they are excluded here like everywhere else.
 */
async function listCompletedJobs(email: string) {
  return await getDb().select({
    id: customerRequests.id,
    vehicle: customerRequests.vehicle,
    service: customerRequests.service,
    createdAt: customerRequests.createdAt,
  }).from(customerRequests)
    .where(and(
      sql`lower(${customerRequests.email}) = ${email.toLowerCase()}`,
      eq(customerRequests.status, "completed"),
      eq(customerRequests.isTestJob, "no"),
    ))
    .orderBy(desc(customerRequests.createdAt))
    .limit(30);
}

/** A cited source job must be this account's own completed, real request. */
async function sourceJobBelongsToAccount(email: string, sourceRequestId: string) {
  const [row] = await getDb().select({ id: customerRequests.id })
    .from(customerRequests)
    .where(and(
      eq(customerRequests.id, sourceRequestId),
      sql`lower(${customerRequests.email}) = ${email.toLowerCase()}`,
      eq(customerRequests.status, "completed"),
      eq(customerRequests.isTestJob, "no"),
    ))
    .limit(1);
  return Boolean(row);
}

async function payload(email: string) {
  const [reminders, completedJobs] = await Promise.all([
    listReminders(email),
    listCompletedJobs(email),
  ]);
  return { reminders, completedJobs, maxReminders: MAX_SERVICE_REMINDERS };
}

export async function GET(request: Request) {
  const session = await customerSession(request);
  if (!session) return unauthorized(session);
  try {
    return Response.json(await payload(session.email), { headers: NO_STORE });
  } catch (error) {
    console.error("Unable to load service reminders", error);
    return Response.json(
      { error: "We could not load your service reminders." },
      { status: 500, headers: NO_STORE },
    );
  }
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return crossOriginBlocked();
  const session = await customerSession(request);
  if (!session) return unauthorized(session);
  try {
    const validation = validateServiceReminder(await request.json());
    if (!validation.ok) {
      return Response.json({ error: validation.error }, { status: 400, headers: NO_STORE });
    }
    const db = getDb();
    const [existing] = await db.select({ count: sql<number>`count(*)` })
      .from(customerServiceReminders)
      .where(sql`lower(${customerServiceReminders.customerEmail}) = ${session.email.toLowerCase()}`);
    if (Number(existing?.count ?? 0) >= MAX_SERVICE_REMINDERS) {
      return Response.json({
        error: `You can keep up to ${MAX_SERVICE_REMINDERS} reminders. Delete one before adding another.`,
      }, { status: 400, headers: NO_STORE });
    }
    if (validation.reminder.sourceRequestId
      && !(await sourceJobBelongsToAccount(session.email, validation.reminder.sourceRequestId))) {
      return Response.json(
        { error: "That completed job is not available on this account." },
        { status: 403, headers: NO_STORE },
      );
    }
    const now = new Date().toISOString();
    await db.insert(customerServiceReminders).values({
      id: crypto.randomUUID(),
      customerEmail: session.email,
      ...validation.reminder,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
    return Response.json(
      { ok: true, ...(await payload(session.email)) },
      { status: 201, headers: NO_STORE },
    );
  } catch (error) {
    console.error("Unable to save a service reminder", error);
    return Response.json(
      { error: "We could not save that reminder." },
      { status: 500, headers: NO_STORE },
    );
  }
}

export async function PATCH(request: Request) {
  if (!isSameOriginRequest(request)) return crossOriginBlocked();
  const session = await customerSession(request);
  if (!session) return unauthorized(session);
  try {
    const body = await request.json() as Record<string, unknown>;
    const id = typeof body.id === "string" ? body.id.trim() : "";
    if (!id) {
      return Response.json({ error: "Choose a reminder to update." }, { status: 400, headers: NO_STORE });
    }
    const db = getDb();

    // A bare status change (mark done, dismiss, reactivate) carries no fields.
    if (body.vehicle === undefined && body.service === undefined) {
      if (!isReminderStatus(body.status)) {
        return Response.json({ error: "Choose a valid reminder status." }, { status: 400, headers: NO_STORE });
      }
      // Scoped by owner email so an id alone can never reach another account.
      const result = await db.update(customerServiceReminders).set({
        status: body.status,
        updatedAt: new Date().toISOString(),
      }).where(and(
        eq(customerServiceReminders.id, id),
        sql`lower(${customerServiceReminders.customerEmail}) = ${session.email.toLowerCase()}`,
      ));
      if ((result.meta.changes ?? 0) === 0) {
        return Response.json({ error: "That reminder was not found." }, { status: 404, headers: NO_STORE });
      }
      return Response.json({ ok: true, ...(await payload(session.email)) }, { headers: NO_STORE });
    }

    const validation = validateServiceReminder(body);
    if (!validation.ok) {
      return Response.json({ error: validation.error }, { status: 400, headers: NO_STORE });
    }
    if (validation.reminder.sourceRequestId
      && !(await sourceJobBelongsToAccount(session.email, validation.reminder.sourceRequestId))) {
      return Response.json(
        { error: "That completed job is not available on this account." },
        { status: 403, headers: NO_STORE },
      );
    }
    // An edited reminder is live again by definition.
    const result = await db.update(customerServiceReminders).set({
      ...validation.reminder,
      status: "active",
      updatedAt: new Date().toISOString(),
    }).where(and(
      eq(customerServiceReminders.id, id),
      sql`lower(${customerServiceReminders.customerEmail}) = ${session.email.toLowerCase()}`,
    ));
    if ((result.meta.changes ?? 0) === 0) {
      return Response.json({ error: "That reminder was not found." }, { status: 404, headers: NO_STORE });
    }
    return Response.json({ ok: true, ...(await payload(session.email)) }, { headers: NO_STORE });
  } catch (error) {
    console.error("Unable to update a service reminder", error);
    return Response.json(
      { error: "We could not update that reminder." },
      { status: 500, headers: NO_STORE },
    );
  }
}

export async function DELETE(request: Request) {
  if (!isSameOriginRequest(request)) return crossOriginBlocked();
  const session = await customerSession(request);
  if (!session) return unauthorized(session);
  try {
    const id = new URL(request.url).searchParams.get("id")?.trim() ?? "";
    if (!id) {
      return Response.json({ error: "Choose a reminder to delete." }, { status: 400, headers: NO_STORE });
    }
    // A reminder is private convenience data that nothing else references, so
    // deleting really deletes — unlike vehicles, which past jobs still cite.
    const result = await getDb().delete(customerServiceReminders).where(and(
      eq(customerServiceReminders.id, id),
      sql`lower(${customerServiceReminders.customerEmail}) = ${session.email.toLowerCase()}`,
    ));
    if ((result.meta.changes ?? 0) === 0) {
      return Response.json({ error: "That reminder was not found." }, { status: 404, headers: NO_STORE });
    }
    return Response.json({ ok: true, ...(await payload(session.email)) }, { headers: NO_STORE });
  } catch (error) {
    console.error("Unable to delete a service reminder", error);
    return Response.json(
      { error: "We could not delete that reminder." },
      { status: 500, headers: NO_STORE },
    );
  }
}
