import { and, eq, exists, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { getDb } from "../db";
import { emailNotificationOutbox, launchUpdateSubscribers } from "../db/schema";
import { LAUNCH_UPDATE_SEQUENCE, launchUpdateEventPrefix, type LaunchUpdateStep } from "./launch-updates";

const previousMail = alias(emailNotificationOutbox, "launch_previous_mail");

/**
 * Preserve the nominal 0/7/30-day schedule, but never compress its gaps after
 * activation or a delivery outage. The queue cursor is not a delivery receipt.
 * Only service-accepted mail from this same opt-in can start the next wait.
 * Reuse this condition before batch limits and immediately before transport.
 */
export function launchUpdateStepDueSql(step: LaunchUpdateStep, now: Date) {
  const index = LAUNCH_UPDATE_SEQUENCE.findIndex(entry => entry.step === step.step);
  if (index < 0) return sql`0`;
  const nominallyDue = sql`julianday(${launchUpdateSubscribers.consentedAt}) <= julianday(${now.toISOString()}) - ${step.afterDays}`;
  if (index === 0) return nominallyDue;

  const previous = LAUNCH_UPDATE_SEQUENCE[index - 1];
  const gapDays = step.afterDays - previous.afterDays;
  return and(nominallyDue, exists(getDb().select({ id: previousMail.id })
    .from(previousMail).where(and(
      eq(previousMail.recipientEmail, launchUpdateSubscribers.email),
      eq(previousMail.eventKey,
        sql`${launchUpdateEventPrefix(previous.step)} || ${launchUpdateSubscribers.consentedAt} || ':' || ${launchUpdateSubscribers.email}`),
      eq(previousMail.status, "sent"),
      sql`julianday(${previousMail.sentAt}) >= julianday(${launchUpdateSubscribers.consentedAt})`,
      sql`julianday(${previousMail.sentAt}) <= julianday(${now.toISOString()}) - ${gapDays}`,
    ))));
}
