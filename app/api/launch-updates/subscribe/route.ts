import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { launchUpdateSubscribers } from "../../../../db/schema";
import {
  LAUNCH_UPDATE_CONSENT_TEXT_EN,
  LAUNCH_UPDATE_CONSENT_TEXT_ES,
  LAUNCH_UPDATE_CONSENT_VERSION,
} from "../../../../lib/launch-updates";
import { consumeFixedWindow, rateLimitKeyHash } from "../../../../lib/public-write-rate-limit";

const VALID_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function newToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const source = typeof body.source === "string" ? body.source.slice(0, 60) : "";
    const spanish = body.language === "es";
    // Consent must be an affirmative act. A missing or false value is a
    // refusal, never a default — this is the whole basis for sending at all.
    const consented = body.consent === true;

    if (!VALID_EMAIL.test(email) || email.length > 320) {
      return Response.json({ error: "Enter a valid email address." }, { status: 400 });
    }
    if (!consented) {
      return Response.json(
        { error: "Please check the box to confirm you want launch updates." },
        { status: 400 },
      );
    }

    const emailAllowed = await consumeFixedWindow(
      "launch-updates:subscribe:email",
      await rateLimitKeyHash(email),
      3,
      60 * 60 * 1000,
    );
    const sourceAllowed = await consumeFixedWindow(
      "launch-updates:subscribe:ip",
      await rateLimitKeyHash(request.headers.get("cf-connecting-ip") ?? "unknown"),
      20,
      60 * 60 * 1000,
    );
    if (!emailAllowed || !sourceAllowed) {
      return Response.json(
        { error: "Too many signups from here just now. Please try again later." },
        { status: 429 },
      );
    }

    const now = new Date().toISOString();
    const consentText = spanish ? LAUNCH_UPDATE_CONSENT_TEXT_ES : LAUNCH_UPDATE_CONSENT_TEXT_EN;
    const db = getDb();
    const [existing] = await db.select({
      email: launchUpdateSubscribers.email,
      unsubscribedAt: launchUpdateSubscribers.unsubscribedAt,
    }).from(launchUpdateSubscribers)
      .where(eq(launchUpdateSubscribers.email, email))
      .limit(1);

    if (!existing) {
      await db.insert(launchUpdateSubscribers).values({
        email,
        source,
        language: spanish ? "es" : "en",
        consentText,
        consentVersion: LAUNCH_UPDATE_CONSENT_VERSION,
        consentedAt: now,
        unsubscribedAt: "",
        unsubscribeToken: newToken(),
        lastStepSent: -1,
        lastStepSentAt: "",
        createdAt: now,
      }).onConflictDoNothing({ target: launchUpdateSubscribers.email });
    } else if (existing.unsubscribedAt) {
      // Re-subscribing after an unsubscribe is a fresh consent, and restarts
      // the sequence — someone returning months later should get the welcome
      // again rather than resuming mid-sequence.
      await db.update(launchUpdateSubscribers).set({
        unsubscribedAt: "",
        consentText,
        consentVersion: LAUNCH_UPDATE_CONSENT_VERSION,
        consentedAt: now,
        language: spanish ? "es" : "en",
        lastStepSent: -1,
        lastStepSentAt: "",
      }).where(eq(launchUpdateSubscribers.email, email));
    }

    // Always the same response, whether or not the address was already on the
    // list — otherwise this endpoint reports who has subscribed to anyone who
    // asks.
    return Response.json({ ok: true }, { status: 202 });
  } catch (error) {
    console.error("Unable to record a launch update signup", error);
    return Response.json({ error: "Could not sign you up. Please try again." }, { status: 400 });
  }
}
