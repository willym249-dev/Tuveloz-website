import { env } from "cloudflare:workers";
import { and, asc, eq, or, sql } from "drizzle-orm";
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
    return { queued: 0, skipped: 0, failed: 0, blocked: "missing_postal_address" as const };
  }
  const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(200, Math.floor(limit))) : 50;
  const now = new Date();
  // Apply due-date eligibility before limiting the batch. Otherwise older
  // subscribers waiting for their next step can strand newer welcome emails.
  const candidates = await getDb().select().from(launchUpdateSubscribers)
    .where(and(
      eq(launchUpdateSubscribers.unsubscribedAt, ""),
      sql`length(trim(${launchUpdateSubscribers.consentText})) > 0`,
      sql`length(trim(${launchUpdateSubscribers.consentVersion})) > 0`,
      or(...LAUNCH_UPDATE_SEQUENCE.map((step, index) => and(
        eq(launchUpdateSubscribers.lastStepSent, index ? LAUNCH_UPDATE_SEQUENCE[index - 1].step : -1),
        sql`julianday(${launchUpdateSubscribers.consentedAt}) <= julianday(${now.toISOString()}) - ${step.afterDays}`,
      ))),
    ))
    .orderBy(asc(launchUpdateSubscribers.consentedAt), asc(launchUpdateSubscribers.email))
    .limit(safeLimit);

  let queued = 0;
  let skipped = 0;
  let failed = 0;
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
    try {
      // Save first. An interruption before advancing is safe: the outbox's
      // unique consent/step key retains one original message on the next run.
      await sendLaunchUpdateEmail({
        recipientEmail: subscriber.email,
        step: step.step,
        consentedAt: subscriber.consentedAt,
        subject: spanish ? step.subjectEs : step.subject,
        lines,
      });
      // A concurrent sweep, unsubscribe or new opt-in must not be overwritten
      // by this earlier snapshot. Delivery also rechecks the saved consent.
      const advanced = await getDb().update(launchUpdateSubscribers).set({
        lastStepSent: step.step,
        lastStepSentAt: now.toISOString(),
      }).where(and(
        eq(launchUpdateSubscribers.email, subscriber.email),
        eq(launchUpdateSubscribers.consentedAt, subscriber.consentedAt),
        eq(launchUpdateSubscribers.unsubscribeToken, subscriber.unsubscribeToken),
        eq(launchUpdateSubscribers.lastStepSent, subscriber.lastStepSent),
        eq(launchUpdateSubscribers.unsubscribedAt, ""),
      )).returning({ email: launchUpdateSubscribers.email });
      if (advanced.length) queued += 1;
      else skipped += 1;
    } catch {
      failed += 1;
      // Database errors can contain bound email text and opt-out tokens.
      console.error("Unable to save a launch update; its cursor remains retryable.");
    }
  }
  return { queued, skipped, failed, blocked: null };
}
