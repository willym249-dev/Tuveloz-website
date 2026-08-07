import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { launchUpdateSubscribers } from "../db/schema";

/**
 * Enrolling someone in the launch-update sequence from a form that is not the
 * subscribe form.
 *
 * The customer request form has always carried an optional "email me
 * promotions" box and stored the answer, but nothing ever read it, so the
 * consent sat unused. This is the path that makes it mean something.
 *
 * Two rules differ from the dedicated subscribe endpoint, both deliberately:
 *
 * 1. **The stored consent is the wording the person actually saw.** The
 *    request form's sentence and version are recorded, not the subscribe
 *    form's. What someone agreed to has to be provable from their own record.
 * 2. **An unsubscribe is never reversed here.** Someone who opted out and
 *    later posts a job stays opted out. Ticking a box on an unrelated form is
 *    a weaker signal than deliberately returning to the subscribe form, and
 *    the subscribe form still resurrects. Getting this wrong pulls someone
 *    back onto a list they left, which is the failure people actually
 *    complain about.
 */

function newUnsubscribeToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export type LaunchUpdateEnrollment = {
  email: string;
  source: string;
  language?: "en" | "es";
  /** The exact sentence shown on the form the person ticked. */
  consentText: string;
  /** The consent version of that form, not the subscribe form's. */
  consentVersion: string;
};

export type LaunchUpdateEnrollmentResult =
  | "enrolled"
  | "already_subscribed"
  | "previously_unsubscribed"
  | "skipped";

/**
 * Best effort by design: a failure here must never fail the request, job, or
 * application it came from. Returns what happened so a caller can log it.
 */
export async function enrollLaunchUpdateSubscriber(
  input: LaunchUpdateEnrollment,
): Promise<LaunchUpdateEnrollmentResult> {
  const email = input.email.trim().toLowerCase();
  if (!email || !input.consentText.trim() || !input.consentVersion.trim()) {
    return "skipped";
  }

  try {
    const db = getDb();
    const [existing] = await db.select({
      email: launchUpdateSubscribers.email,
      unsubscribedAt: launchUpdateSubscribers.unsubscribedAt,
    }).from(launchUpdateSubscribers)
      .where(eq(launchUpdateSubscribers.email, email))
      .limit(1);

    if (existing) {
      // Already on the list, or off it on purpose. Either way, leave the
      // record alone — re-recording consent would overwrite the wording they
      // originally agreed to.
      return existing.unsubscribedAt ? "previously_unsubscribed" : "already_subscribed";
    }

    const now = new Date().toISOString();
    await db.insert(launchUpdateSubscribers).values({
      email,
      source: input.source.slice(0, 60),
      language: input.language ?? "en",
      consentText: input.consentText,
      consentVersion: input.consentVersion,
      consentedAt: now,
      unsubscribedAt: "",
      unsubscribeToken: newUnsubscribeToken(),
      lastStepSent: -1,
      lastStepSentAt: "",
      createdAt: now,
    }).onConflictDoNothing({ target: launchUpdateSubscribers.email });
    return "enrolled";
  } catch (error) {
    console.error("Unable to enroll a launch-update subscriber", error);
    return "skipped";
  }
}
