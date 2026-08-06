import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { fleetInquiries } from "../../../db/schema";
import { isStrictSameOriginWriteRequest } from "../../../lib/request-security";
import { consumeFixedWindow, rateLimitKeyHash } from "../../../lib/public-write-rate-limit";
import { isFleetSize } from "../../../lib/fleet-options";
import { resolvePhoneContactConsent } from "../../../lib/phone-contact-consent";

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

/**
 * Records that a business wants multi-vehicle service when the marketplace
 * opens. This is interest only: it creates no account, no booking, no
 * commitment, and no promise that any service will be available.
 */
export async function POST(request: Request) {
  if (!isStrictSameOriginWriteRequest(request)) {
    return Response.json(
      { error: "This request could not be verified. Reload the page and try again." },
      { status: 403, headers: { "cache-control": "no-store" } },
    );
  }
  try {
    const now = new Date().toISOString();
    const body = await request.json() as Record<string, unknown>;
    const companyName = clean(body.companyName, 120);
    const contactName = clean(body.contactName, 120);
    const email = clean(body.email, 180).toLowerCase();
    // A number is stored for contact about this request. A promotional text
    // needs the separate opt-in, and its absence is a refusal.
    const phoneContact = resolvePhoneContactConsent({
      phone: body.contactPhone,
      smsMarketingConsent: body.smsMarketingConsent,
      now,
    });
    const fleetSize = clean(body.fleetSize, 40);
    const vehicleTypes = clean(body.vehicleTypes, 200);
    const municipality = clean(body.municipality, 120);
    const servicesNeeded = clean(body.servicesNeeded, 300);
    const notes = clean(body.notes, 800);

    if (!companyName) {
      return Response.json({ error: "Enter your business name." }, { status: 400 });
    }
    if (!contactName) {
      return Response.json({ error: "Enter a contact name." }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return Response.json({ error: "Enter a valid email address." }, { status: 400 });
    }
    if (!isFleetSize(fleetSize)) {
      return Response.json({ error: "Choose how many vehicles you run." }, { status: 400 });
    }

    const emailAllowed = await consumeFixedWindow(
      "fleet-inquiry:email",
      await rateLimitKeyHash(email),
      3,
      60 * 60 * 1000,
    );
    const addressAllowed = await consumeFixedWindow(
      "fleet-inquiry:ip",
      await rateLimitKeyHash(request.headers.get("cf-connecting-ip") ?? "unknown"),
      20,
      60 * 60 * 1000,
    );
    if (!emailAllowed || !addressAllowed) {
      return Response.json(
        { error: "Too many submissions from here just now. Please try again later." },
        { status: 429 },
      );
    }

    const requestKey = await makeRequestKey(`${email}|${companyName.toLowerCase()}`);
    const db = getDb();
    const [existing] = await db.select({ id: fleetInquiries.id })
      .from(fleetInquiries)
      .where(eq(fleetInquiries.requestKey, requestKey))
      .limit(1);

    if (existing) {
      // A resubmission refreshes the details but never resets owner triage.
      await db.update(fleetInquiries).set({
        contactName,
        contactPhone: phoneContact.phone,
        smsMarketingConsentText: phoneContact.smsMarketingConsentText,
        smsMarketingConsentVersion: phoneContact.smsMarketingConsentVersion,
        smsMarketingConsentedAt: phoneContact.smsMarketingConsentedAt,
        fleetSize,
        vehicleTypes,
        municipality,
        servicesNeeded,
        notes,
        updatedAt: now,
      }).where(eq(fleetInquiries.requestKey, requestKey));
    } else {
      await db.insert(fleetInquiries).values({
        id: crypto.randomUUID(),
        companyName,
        contactName,
        email,
        contactPhone: phoneContact.phone,
        smsMarketingConsentText: phoneContact.smsMarketingConsentText,
        smsMarketingConsentVersion: phoneContact.smsMarketingConsentVersion,
        smsMarketingConsentedAt: phoneContact.smsMarketingConsentedAt,
        smsMarketingRevokedAt: "",
        fleetSize,
        vehicleTypes,
        municipality,
        servicesNeeded,
        notes,
        status: "new",
        requestKey,
        createdAt: now,
        updatedAt: now,
      });
    }

    return Response.json({
      ok: true,
      alreadyRecorded: Boolean(existing),
    }, { status: existing ? 200 : 201, headers: { "cache-control": "no-store" } });
  } catch (error) {
    console.error("Unable to save fleet inquiry", error);
    return Response.json(
      { error: "We could not save your fleet request. Please try again." },
      { status: 500 },
    );
  }
}
