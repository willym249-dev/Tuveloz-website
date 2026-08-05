import { env } from "cloudflare:workers";
import { and, asc, eq, lt } from "drizzle-orm";
import { getDb } from "../db";
import { launchUpdateSubscribers } from "../db/schema";
import { sendLaunchUpdateEmail } from "./email-notifications";
import {
  LAUNCH_UPDATE_SEQUENCE,
  marketingFooter,
  nextDueStep,
} from "./launch-updates";

type RuntimeEnv = Record<string, string | undefined>;

function runtimeEnv() {
  return env as unknown as RuntimeEnv;
}

function siteUrl() {
  return (runtimeEnv().SITE_URL ?? "https://tuveloz.com").replace(/\/+$/, "");
}

export function unsubscribeUrl(token: string) {
  return `${siteUrl()}/api/launch-updates/unsubscribe?token=${encodeURIComponent(token)}`;
}

const LAST_STEP = LAUNCH_UPDATE_SEQUENCE.reduce(
  (highest, entry) => Math.max(highest, entry.step),
  -1,
);

/**
 * Queue every sequence step that has come due. Called from the scheduled
 * worker alongside the other periodic tasks.
 *
 * One step per subscriber per run: if someone has been waiting on two steps,
 * they get the earlier one now and the later one on the next tick rather than
 * two emails landing together.
 *
 * The postal address required on commercial email is read from configuration.
 * When it is unset nothing is sent at all — an email that cannot identify its
 * sender should not go out, and failing loudly here is better than quietly
 * mailing without it.
 */
export async function processDueLaunchUpdates(limit = 50) {
  const postalAddress = (runtimeEnv().LAUNCH_UPDATES_POSTAL_ADDRESS ?? "").trim();
  if (!postalAddress) {
    console.error(
      "Launch update emails are not configured: LAUNCH_UPDATES_POSTAL_ADDRESS is unset. "
      + "Commercial email must carry a physical mailing address, so nothing was sent.",
    );
    return { sent: 0, skipped: 0, blocked: "missing_postal_address" as const };
  }
  const safeLimit = Math.max(1, Math.min(200, Math.floor(limit)));
  const now = new Date();
  const candidates = await getDb().select().from(launchUpdateSubscribers)
    .where(and(
      eq(launchUpdateSubscribers.unsubscribedAt, ""),
      lt(launchUpdateSubscribers.lastStepSent, LAST_STEP),
    ))
    .orderBy(asc(launchUpdateSubscribers.consentedAt))
    .limit(safeLimit);

  let sent = 0;
  let skipped = 0;
  for (const subscriber of candidates) {
    const step = nextDueStep({
      lastStepSent: subscriber.lastStepSent,
      consentedAt: subscriber.consentedAt,
      now,
    });
    if (!step) {
      skipped += 1;
      continue;
    }
    const spanish = subscriber.language === "es";
    const lines = [
      ...(spanish ? step.bodyEs : step.body),
      "",
      ...marketingFooter({
        unsubscribeUrl: unsubscribeUrl(subscriber.unsubscribeToken),
        postalAddress,
        spanish,
      }),
    ];
    // Advance the cursor BEFORE queueing. If the queue call throws, the worst
    // case is a step that never sends; the other order risks re-sending the
    // same step on every subsequent run.
    await getDb().update(launchUpdateSubscribers).set({
      lastStepSent: step.step,
      lastStepSentAt: now.toISOString(),
    }).where(eq(launchUpdateSubscribers.email, subscriber.email));
    await sendLaunchUpdateEmail({
      recipientEmail: subscriber.email,
      step: step.step,
      subject: spanish ? step.subjectEs : step.subject,
      lines,
    });
    sent += 1;
  }
  return { sent, skipped, blocked: null };
}
