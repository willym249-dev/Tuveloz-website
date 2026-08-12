import { and, asc, eq, sql } from "drizzle-orm";
import { getDb } from "../../../db";
import { customerVehicles } from "../../../db/schema";
import { getAccountSession } from "../../../lib/account-auth";
import {
  MAX_SAVED_VEHICLES,
  validateSavedVehicle,
  vehicleDescription,
  vehicleDisplayName,
} from "../../../lib/customer-vehicles";
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
      { error: "Sign in to manage your saved vehicles." },
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

async function listVehicles(email: string) {
  const rows = await getDb().select().from(customerVehicles)
    .where(and(
      sql`lower(${customerVehicles.customerEmail}) = ${email.toLowerCase()}`,
      eq(customerVehicles.archived, "no"),
    ))
    .orderBy(asc(customerVehicles.createdAt));
  return rows.map((row) => ({
    id: row.id,
    label: row.label,
    year: row.year,
    make: row.make,
    model: row.model,
    trim: row.trim,
    color: row.color,
    plate: row.plate,
    vin: row.vin,
    notes: row.notes,
    displayName: vehicleDisplayName(row),
    description: vehicleDescription(row),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }));
}

export async function GET(request: Request) {
  const session = await customerSession(request);
  if (!session) return unauthorized(session);
  try {
    return Response.json(
      { vehicles: await listVehicles(session.email), maxVehicles: MAX_SAVED_VEHICLES },
      { headers: NO_STORE },
    );
  } catch (error) {
    console.error("Unable to load saved vehicles", error);
    return Response.json(
      { error: "We could not load your saved vehicles." },
      { status: 500, headers: NO_STORE },
    );
  }
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return crossOriginBlocked();
  const session = await customerSession(request);
  if (!session) return unauthorized(session);
  try {
    const validation = validateSavedVehicle(await request.json());
    if (!validation.ok) {
      return Response.json({ error: validation.error }, { status: 400, headers: NO_STORE });
    }
    const db = getDb();
    const [existing] = await db.select({ count: sql<number>`count(*)` })
      .from(customerVehicles)
      .where(and(
        sql`lower(${customerVehicles.customerEmail}) = ${session.email.toLowerCase()}`,
        eq(customerVehicles.archived, "no"),
      ));
    if (Number(existing?.count ?? 0) >= MAX_SAVED_VEHICLES) {
      return Response.json({
        error: `You can save up to ${MAX_SAVED_VEHICLES} vehicles. Remove one before adding another.`,
      }, { status: 400, headers: NO_STORE });
    }
    const now = new Date().toISOString();
    await db.insert(customerVehicles).values({
      id: crypto.randomUUID(),
      customerEmail: session.email,
      ...validation.vehicle,
      archived: "no",
      createdAt: now,
      updatedAt: now,
    });
    return Response.json(
      { ok: true, vehicles: await listVehicles(session.email) },
      { status: 201, headers: NO_STORE },
    );
  } catch (error) {
    console.error("Unable to save a vehicle", error);
    return Response.json(
      { error: "We could not save that vehicle." },
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
      return Response.json({ error: "Choose a vehicle to update." }, { status: 400, headers: NO_STORE });
    }
    const validation = validateSavedVehicle(body);
    if (!validation.ok) {
      return Response.json({ error: validation.error }, { status: 400, headers: NO_STORE });
    }
    const db = getDb();
    // Scoped by owner email so an id alone can never reach another account.
    const result = await db.update(customerVehicles).set({
      ...validation.vehicle,
      updatedAt: new Date().toISOString(),
    }).where(and(
      eq(customerVehicles.id, id),
      sql`lower(${customerVehicles.customerEmail}) = ${session.email.toLowerCase()}`,
      eq(customerVehicles.archived, "no"),
    ));
    if ((result.meta.changes ?? 0) === 0) {
      return Response.json({ error: "That vehicle was not found." }, { status: 404, headers: NO_STORE });
    }
    return Response.json(
      { ok: true, vehicles: await listVehicles(session.email) },
      { headers: NO_STORE },
    );
  } catch (error) {
    console.error("Unable to update a saved vehicle", error);
    return Response.json(
      { error: "We could not update that vehicle." },
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
      return Response.json({ error: "Choose a vehicle to remove." }, { status: 400, headers: NO_STORE });
    }
    // Archived, never deleted: a past job still references the vehicle text it
    // was booked with, and the privacy export has to keep telling the truth.
    const result = await getDb().update(customerVehicles).set({
      archived: "yes",
      updatedAt: new Date().toISOString(),
    }).where(and(
      eq(customerVehicles.id, id),
      sql`lower(${customerVehicles.customerEmail}) = ${session.email.toLowerCase()}`,
      eq(customerVehicles.archived, "no"),
    ));
    if ((result.meta.changes ?? 0) === 0) {
      return Response.json({ error: "That vehicle was not found." }, { status: 404, headers: NO_STORE });
    }
    return Response.json(
      { ok: true, vehicles: await listVehicles(session.email) },
      { headers: NO_STORE },
    );
  } catch (error) {
    console.error("Unable to remove a saved vehicle", error);
    return Response.json(
      { error: "We could not remove that vehicle." },
      { status: 500, headers: NO_STORE },
    );
  }
}
