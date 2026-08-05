import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { customerWaitlistSignups } from "../../../db/schema";
import {
  CUSTOMER_WAITLIST_SERVICE_VALUES,
  zipIsInsideCurrentLaunchArea,
} from "../../../lib/customer-waitlist";
import { CURRENT_LAUNCH_AREA } from "../../../lib/service-matching";

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
 * Joining the waitlist records interest only. It creates no account, no
 * service request, no provider contact, and no payment — every one of those
 * remains server-blocked while the marketplace is in onboarding mode.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const email = clean(body.email, 180).toLowerCase();
    const zip = clean(body.zip, 10);
    const service = clean(body.service, 80);
    const marketingConsent = body.marketingConsent === true;

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return Response.json({ error: "Enter a valid email address." }, { status: 400 });
    }
    if (!zipIsInsideCurrentLaunchArea(zip)) {
      return Response.json({
        error:
          "Enter a Montgomery County, Maryland ZIP code. Outside the county? Request your area instead.",
      }, { status: 400 });
    }
    if (!CUSTOMER_WAITLIST_SERVICE_VALUES.has(service)) {
      return Response.json({ error: "Choose the service you're waiting for." }, { status: 400 });
    }

    const requestKey = await makeRequestKey(`${email}|${zip}`);
    const db = getDb();
    const [existing] = await db
      .select({ id: customerWaitlistSignups.id })
      .from(customerWaitlistSignups)
      .where(eq(customerWaitlistSignups.requestKey, requestKey))
      .limit(1);

    if (existing) {
      await db.update(customerWaitlistSignups).set({
        service,
        marketingConsent,
        updatedAt: new Date().toISOString(),
      }).where(eq(customerWaitlistSignups.requestKey, requestKey));
    } else {
      await db.insert(customerWaitlistSignups).values({
        id: crypto.randomUUID(),
        email,
        zip,
        service,
        launchArea: CURRENT_LAUNCH_AREA,
        marketingConsent,
        requestKey,
      });
    }

    return Response.json({
      ok: true,
      alreadyOnList: Boolean(existing),
    }, { status: existing ? 200 : 201 });
  } catch (error) {
    console.error("Unable to save a customer waitlist signup", error);
    return Response.json(
      { error: "We could not save your spot. Please try again." },
      { status: 500 },
    );
  }
}
