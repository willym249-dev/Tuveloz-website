import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "../db";
import { customerRequests, providerQuotes } from "../db/schema";
import { sendMatchingProviderReminder } from "./provider-alerts";
import { runtimeMarketplaceActionAllowed } from "./runtime-marketplace-action";

const REMINDER_DELAY_MS = 30 * 60 * 1000;
const RETRY_DELAY_MS = 15 * 60 * 1000;

export type ReminderSweepResult = {
  due: number;
  attempted: number;
  sent: number;
};

function timestamp(value: string) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function processDueProviderReminders(
  now = new Date(),
): Promise<ReminderSweepResult> {
  if (!(await runtimeMarketplaceActionAllowed("discovery"))) {
    return { due: 0, attempted: 0, sent: 0 };
  }
  const db = getDb();
  const jobs = await db.select().from(customerRequests).where(and(
    eq(customerRequests.status, "approved"),
    eq(customerRequests.isTestJob, "no"),
    eq(customerRequests.reminderSentAt, ""),
  ));
  if (jobs.length === 0) return { due: 0, attempted: 0, sent: 0 };

  const quoteRows = await db.select({ requestId: providerQuotes.requestId })
    .from(providerQuotes)
    .where(inArray(providerQuotes.requestId, jobs.map((job) => job.id)));
  const quotedRequestIds = new Set(quoteRows.map((quote) => quote.requestId));
  const nowMs = now.getTime();
  const nowIso = now.toISOString();
  let due = 0;
  let attempted = 0;
  let sent = 0;

  for (const job of jobs) {
    if (quotedRequestIds.has(job.id)) continue;

    const approvedAt = timestamp(job.approvedAt);
    if (!approvedAt || nowMs - approvedAt < REMINDER_DELAY_MS) continue;

    const previousAttemptAt = timestamp(job.reminderLastAttemptAt);
    if (previousAttemptAt && nowMs - previousAttemptAt < RETRY_DELAY_MS) continue;
    due += 1;

    const claimed = await db.update(customerRequests)
      .set({ reminderLastAttemptAt: nowIso })
      .where(and(
        eq(customerRequests.id, job.id),
        eq(customerRequests.status, "approved"),
        eq(customerRequests.reminderSentAt, ""),
        eq(customerRequests.reminderLastAttemptAt, job.reminderLastAttemptAt),
      ))
      .returning({ id: customerRequests.id });
    if (claimed.length === 0) continue;

    attempted += 1;
    const result = await sendMatchingProviderReminder(job.id);
    sent += result.sent;
    if (result.sent > 0) {
      await db.update(customerRequests)
        .set({ reminderSentAt: nowIso })
        .where(and(
          eq(customerRequests.id, job.id),
          eq(customerRequests.reminderSentAt, ""),
        ));
    }
  }

  return { due, attempted, sent };
}
