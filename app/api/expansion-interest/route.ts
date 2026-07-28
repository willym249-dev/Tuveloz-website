import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { expansionInterests } from "../../../db/schema";

const EXPANSION_AREAS = new Set([
  "Maryland",
  "Washington, DC",
]);

const PROVIDER_TYPES = new Set([
  "Mobile mechanic or service truck",
  "Shop-based mechanic",
  "Mobile detailer",
  "Window tint provider",
  "Other vehicle-service provider",
]);

function clean(value: unknown, max: number) {
  return typeof value === "string"
    ? value.trim().replace(/\s+/g, " ").slice(0, max)
    : "";
}

async function makeRequestKey(value: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const audience = clean(body.audience, 30);
    const providerType = clean(body.providerType, 80);
    const locality = clean(body.locality, 120);
    const state = clean(body.state, 40);
    const email = clean(body.email, 180).toLowerCase();

    if (!["Customer", "Provider", "Both"].includes(audience)) {
      return Response.json({
        error: "Choose whether you are a customer, provider, or both.",
      }, { status: 400 });
    }
    if (
      (audience === "Provider" || audience === "Both")
      && !PROVIDER_TYPES.has(providerType)
    ) {
      return Response.json({ error: "Choose the type of provider you are." }, { status: 400 });
    }
    if (!locality || !EXPANSION_AREAS.has(state)) {
      return Response.json({
        error: "Enter your county or city and choose Maryland or Washington, DC.",
      }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return Response.json({ error: "Enter a valid email address." }, { status: 400 });
    }
    if (state === "Maryland" && locality.toLowerCase().includes("montgomery")) {
      return Response.json({
        error: "Tuveloz already serves Montgomery County. Use the customer or provider form to get started.",
      }, { status: 400 });
    }

    const requestKey = await makeRequestKey(
      `${email}|${state.toLowerCase()}|${locality.toLowerCase()}`,
    );
    const db = getDb();
    const [existing] = await db
      .select({ id: expansionInterests.id })
      .from(expansionInterests)
      .where(eq(expansionInterests.requestKey, requestKey))
      .limit(1);

    if (existing) {
      await db.update(expansionInterests).set({
        audience,
        providerType: audience === "Customer" ? "" : providerType,
        locality,
        state,
      }).where(eq(expansionInterests.requestKey, requestKey));
    } else {
      await db.insert(expansionInterests).values({
        id: crypto.randomUUID(),
        audience,
        providerType: audience === "Customer" ? "" : providerType,
        locality,
        state,
        email,
        requestKey,
      });
    }

    return Response.json({
      ok: true,
      alreadyRecorded: Boolean(existing),
    }, { status: existing ? 200 : 201 });
  } catch (error) {
    console.error("Unable to save expansion interest", error);
    return Response.json(
      { error: "We could not save your area request. Please try again." },
      { status: 500 },
    );
  }
}
