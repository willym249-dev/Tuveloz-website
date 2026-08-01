import { and, asc, eq, lt, lte } from "drizzle-orm";
import { getDb } from "../db";
import {
  complianceReminders,
  emailNotificationOutbox,
  providerEvidenceSubmissions,
} from "../db/schema";
import { sendMarketplaceUpdateEmail } from "./email-notifications";
import { recordProviderAuditEvent } from "./provider-audit";

const DELIVERY_BATCH_SIZE = 20;
const MAX_DELIVERY_ATTEMPTS = 5;
const STALE_CLAIM_MS = 60 * 60 * 1000;

type ReminderMetadata = {
  expiresAt?: unknown;
  requirementKey?: unknown;
  reminderDays?: unknown;
  [key: string]: unknown;
};

function metadata(value: string): ReminderMetadata {
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as ReminderMetadata
      : {};
  } catch {
    return {};
  }
}

function text(value: unknown, maximum: number) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

function reminderMessage(expiresAt: string, serviceCode: string) {
  const expired = Number.isFinite(Date.parse(`${expiresAt}T23:59:59.999Z`))
    && Date.parse(`${expiresAt}T23:59:59.999Z`) < Date.now();
  return [
    expired
      ? "A record used for provider eligibility has expired."
      : `A record used for provider eligibility expires on ${expiresAt}.`,
    `Exact service: ${serviceCode || "See the protected onboarding checklist"}`,
    "An uploaded replacement does not extend eligibility until its malware scan is clean and its exact evidence scope is accepted.",
    "Affected services remain or become blocked when a mandatory record is not current.",
    "",
    "Review the protected checklist: https://tuveloz.com/provider-onboarding",
  ];
}

export type ComplianceReminderSweepResult = {
  claimed: number;
  sent: number;
  retried: number;
  failed: number;
  cancelled: number;
};

export async function processDueComplianceReminders(
  now = new Date(),
): Promise<ComplianceReminderSweepResult> {
  const db = getDb();
  const nowIso = now.toISOString();
  const staleBefore = new Date(now.getTime() - STALE_CLAIM_MS).toISOString();
  await db.update(complianceReminders).set({
    status: "scheduled",
    updatedAt: nowIso,
  }).where(and(
    eq(complianceReminders.status, "processing"),
    lt(complianceReminders.lastAttemptAt, staleBefore),
  ));

  const due = await db.select().from(complianceReminders)
    .where(and(
      eq(complianceReminders.status, "scheduled"),
      lte(complianceReminders.dueAt, nowIso),
    ))
    .orderBy(asc(complianceReminders.dueAt))
    .limit(DELIVERY_BATCH_SIZE);

  const result: ComplianceReminderSweepResult = {
    claimed: 0,
    sent: 0,
    retried: 0,
    failed: 0,
    cancelled: 0,
  };
  for (const item of due) {
    const attempts = item.attempts + 1;
    const claimed = await db.update(complianceReminders).set({
      status: "processing",
      attempts,
      lastAttemptAt: nowIso,
      updatedAt: nowIso,
    }).where(and(
      eq(complianceReminders.id, item.id),
      eq(complianceReminders.status, "scheduled"),
      eq(complianceReminders.updatedAt, item.updatedAt),
    )).returning({ id: complianceReminders.id });
    if (!claimed.length) continue;
    result.claimed += 1;

    const [evidence] = item.evidenceSubmissionId
      ? await db.select({
          id: providerEvidenceSubmissions.id,
          status: providerEvidenceSubmissions.status,
          expiresAt: providerEvidenceSubmissions.expiresAt,
        }).from(providerEvidenceSubmissions)
          .where(eq(providerEvidenceSubmissions.id, item.evidenceSubmissionId))
          .limit(1)
      : [];
    if (!evidence || evidence.status !== "accepted") {
      await db.update(complianceReminders).set({
        status: "cancelled",
        updatedAt: nowIso,
        metadata: JSON.stringify({
          ...metadata(item.metadata),
          deliveryResult: "cancelled_evidence_not_currently_accepted",
          deliveryRecordedAt: nowIso,
        }),
      }).where(eq(complianceReminders.id, item.id));
      result.cancelled += 1;
      await recordProviderAuditEvent({
        providerId: item.providerId,
        serviceCode: item.serviceCode,
        eventType: "compliance_reminder_cancelled",
        entityType: "compliance_reminder",
        entityId: item.id,
        actorType: "system",
        actorId: "scheduled-worker",
        outcome: "cancelled",
        reasonCodes: ["evidence_not_currently_accepted"],
      });
      continue;
    }

    const itemMetadata = metadata(item.metadata);
    const expiresAt = text(evidence.expiresAt || itemMetadata.expiresAt, 10);
    await sendMarketplaceUpdateEmail({
      eventKey: item.eventKey,
      recipientEmail: item.recipientEmail,
      subject: expiresAt
        ? `TUVELOZ provider record expires ${expiresAt}`
        : "TUVELOZ provider record needs attention",
      lines: reminderMessage(expiresAt, item.serviceCode),
    });
    const [outbox] = await db.select({
      status: emailNotificationOutbox.status,
      lastError: emailNotificationOutbox.lastError,
    }).from(emailNotificationOutbox)
      .where(eq(emailNotificationOutbox.eventKey, `marketplace:${item.eventKey}`))
      .limit(1);
    const delivered = outbox?.status === "sent";
    const exhausted = attempts >= MAX_DELIVERY_ATTEMPTS;
    const status = delivered ? "sent" : exhausted ? "failed" : "scheduled";
    await db.update(complianceReminders).set({
      status,
      sentAt: delivered ? nowIso : "",
      updatedAt: nowIso,
      metadata: JSON.stringify({
        ...itemMetadata,
        deliveryResult: delivered
          ? "email_provider_accepted"
          : exhausted
            ? "delivery_attempts_exhausted"
            : "retry_scheduled",
        deliveryError: text(outbox?.lastError, 300),
        deliveryRecordedAt: nowIso,
      }),
    }).where(eq(complianceReminders.id, item.id));
    if (delivered) result.sent += 1;
    else if (exhausted) result.failed += 1;
    else result.retried += 1;
    await recordProviderAuditEvent({
      providerId: item.providerId,
      serviceCode: item.serviceCode,
      eventType: delivered
        ? "compliance_reminder_sent"
        : exhausted
          ? "compliance_reminder_failed"
          : "compliance_reminder_retry_scheduled",
      entityType: "compliance_reminder",
      entityId: item.id,
      actorType: "system",
      actorId: "scheduled-worker",
      outcome: status,
      reasonCodes: [item.reminderType],
      metadata: { attempts, outboxStatus: outbox?.status ?? "missing" },
    });
  }
  return result;
}
