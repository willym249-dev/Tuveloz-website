import { env } from "cloudflare:workers";
import { and, eq, like, lt, ne, or } from "drizzle-orm";
import { getDb } from "../db";
import { emailNotificationOutbox, launchUpdateSubscribers } from "../db/schema";
import {
  classifyEmailEvent,
  emailEventAllowedByReleaseState,
  MARKETING_EMAIL_EVENT_SQL_PATTERNS,
  PROTECTIVE_EMAIL_EVENT_SQL_PATTERNS,
  TRANSACTION_EMAIL_EVENT_SQL_PATTERNS,
} from "./email-event-policy";
import { CUSTOMER_JOB_POSTING_PAUSED } from "./launch-status";
import { runtimeMarketplaceActionAllowed } from "./runtime-marketplace-action";
import { resendEmailsUrl } from "./resend-endpoint";

type RuntimeEnv = Record<string, string | undefined>;

export type AccountSecurityAction =
  | "account_created"
  | "password_reset"
  | "passkey_added"
  | "phone_updated";

type QueuedNotification = {
  eventKey: string;
  recipientEmail: string;
  subject: string;
  textBody: string;
};

export const MAX_DELIVERY_ATTEMPTS = 5;
const RETRY_BATCH_SIZE = 5;

// A row that has used its last attempt is excluded from every future retry
// batch, so nothing else in the system will ever look at it again. This prefix
// marks the owner incident raised at that moment.
export const DELIVERY_EXHAUSTED_EVENT_PREFIX = "owner:incident:email-delivery-exhausted:";

function runtimeEnv() {
  return env as unknown as RuntimeEnv;
}

function cleanEmail(value: string | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function siteUrl() {
  return (runtimeEnv().SITE_URL ?? "https://tuveloz.com").replace(/\/+$/, "");
}

function errorSummary(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/[\r\n]+/g, " ").slice(0, 500);
}

async function markFailed(
  id: string,
  attempts: number,
  error: unknown,
  eventKey: string,
) {
  await getDb().update(emailNotificationOutbox).set({
    status: "failed",
    attempts,
    lastError: errorSummary(error),
    updatedAt: new Date().toISOString(),
  }).where(eq(emailNotificationOutbox.id, id));

  if (attempts >= MAX_DELIVERY_ATTEMPTS) {
    await raiseDeliveryExhaustedIncident(eventKey, error);
  }
}

/**
 * Raised on the attempt that exhausts a row's retries — the last moment the
 * owner can still be told, since the row is filtered out of every later retry
 * batch. Protective mail (an account alert, a compliance notice) is exactly the
 * category that cannot afford to go quietly undelivered.
 *
 * The incident is only inserted here, never delivered inline: this runs inside
 * deliverEvent, and sending from within a send would re-enter delivery while
 * the failing row is still being written. The fifteen-minute cron picks it up,
 * and its own `owner:incident:` prefix keeps it protective, so a paused
 * marketplace cannot suppress it.
 */
async function raiseDeliveryExhaustedIncident(eventKey: string, error: unknown) {
  // Never raise an incident about an incident. Without this guard, an owner
  // mailbox that is itself unreachable would queue a fresh alert every time the
  // previous one exhausted, growing the outbox without ever reaching anyone.
  if (eventKey.startsWith(DELIVERY_EXHAUSTED_EVENT_PREFIX)) return;
  const ownerEmail = cleanEmail(runtimeEnv().OWNER_EMAIL);
  if (!ownerEmail) return;

  try {
    const now = new Date().toISOString();
    await getDb().insert(emailNotificationOutbox).values({
      id: crypto.randomUUID(),
      // Keyed by the failed event, so repeated failures of the same message
      // collapse onto one incident rather than one per attempt.
      eventKey: `${DELIVERY_EXHAUSTED_EVENT_PREFIX}${eventKey}`,
      recipientEmail: ownerEmail,
      subject: "Tuveloz email delivery gave up on a message",
      textBody: [
        "A queued Tuveloz email used all of its delivery attempts and will not be retried.",
        "",
        `Event: ${eventKey}`,
        `Attempts: ${MAX_DELIVERY_ATTEMPTS}`,
        `Last error: ${errorSummary(error)}`,
        "",
        "The recipient never received this message. Recipient details stay in the",
        "protected owner dashboard rather than in this alert:",
        `${siteUrl()}/admin`,
      ].join("\n"),
      status: "pending",
      attempts: 0,
      lastError: "",
      createdAt: now,
      updatedAt: now,
      sentAt: "",
    }).onConflictDoNothing({
      target: emailNotificationOutbox.eventKey,
    });
  } catch (incidentError) {
    console.error(
      "Unable to record an exhausted Tuveloz email delivery",
      incidentError,
    );
  }
}

/**
 * Marketing mail is authorized by the recipient, not by release state, and the
 * check happens here rather than at queue time. Someone who unsubscribes after
 * a step is queued but before the cron flushes it must not receive it — the
 * outbox can sit for up to fifteen minutes, which is more than enough time for
 * an unsubscribe to land in between.
 */
async function marketingDeliveryIsAllowed(recipientEmail: string) {
  const [subscriber] = await getDb().select({
    unsubscribedAt: launchUpdateSubscribers.unsubscribedAt,
  }).from(launchUpdateSubscribers)
    .where(eq(launchUpdateSubscribers.email, cleanEmail(recipientEmail)))
    .limit(1);
  return Boolean(subscriber) && !subscriber.unsubscribedAt;
}

async function emailEventDeliveryIsAllowed(eventKey: string, recipientEmail: string) {
  const classification = classifyEmailEvent(eventKey);
  if (classification.kind === "marketing") {
    return marketingDeliveryIsAllowed(recipientEmail);
  }
  if (classification.kind !== "transaction") {
    return emailEventAllowedByReleaseState(eventKey, false);
  }
  if (CUSTOMER_JOB_POSTING_PAUSED) return false;
  const releaseAllowsAction = await runtimeMarketplaceActionAllowed(
    classification.action,
  ).catch(() => false);
  return emailEventAllowedByReleaseState(eventKey, releaseAllowsAction);
}

async function realTransactionEmailCandidatesAreAvailable() {
  if (CUSTOMER_JOB_POSTING_PAUSED) return false;
  return runtimeMarketplaceActionAllowed("request").catch(() => false);
}

async function deliverEvent(eventKey: string) {
  const db = getDb();
  const [notification] = await db.select().from(emailNotificationOutbox)
    .where(eq(emailNotificationOutbox.eventKey, eventKey))
    .limit(1);
  if (
    !notification
    || notification.status === "sent"
    || notification.attempts >= MAX_DELIVERY_ATTEMPTS
  ) {
    return;
  }
  // A suppressed or unclassified row remains pending with the same attempt
  // count. Closing launch readiness must never release stale transaction mail,
  // and quarantine must not rewrite delivery history as if an email was sent.
  if (!(await emailEventDeliveryIsAllowed(
    notification.eventKey,
    notification.recipientEmail,
  ))) return;

  const attempts = notification.attempts + 1;
  const apiKey = runtimeEnv().RESEND_API_KEY ?? "";
  const from = runtimeEnv().RESEND_FROM_EMAIL ?? "";
  if (!apiKey || !from) {
    await markFailed(
      notification.id,
      attempts,
      new Error("Resend email delivery is not configured."),
      notification.eventKey,
    );
    return;
  }

  try {
    const response = await fetch(resendEmailsUrl(runtimeEnv().RESEND_BASE_URL), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": notification.eventKey,
      },
      body: JSON.stringify({
        from,
        to: [notification.recipientEmail],
        subject: notification.subject,
        text: notification.textBody,
      }),
    });
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 300);
      throw new Error(`Resend returned ${response.status}: ${detail}`);
    }
    const now = new Date().toISOString();
    await db.update(emailNotificationOutbox).set({
      status: "sent",
      attempts,
      lastError: "",
      sentAt: now,
      updatedAt: now,
    }).where(eq(emailNotificationOutbox.id, notification.id));
  } catch (error) {
    await markFailed(notification.id, attempts, error, notification.eventKey);
  }
}

export async function flushPendingEmailNotifications(limit = RETRY_BATCH_SIZE) {
  const safeLimit = Math.max(1, Math.min(20, Math.floor(limit)));
  const transactionCandidatesAvailable = await realTransactionEmailCandidatesAreAvailable();
  // Marketing is always a candidate: it is gated on the recipient's own
  // consent rather than on marketplace release state, so a paused marketplace
  // must not strand launch updates people asked for.
  const candidatePatterns = transactionCandidatesAvailable
    ? [
      ...PROTECTIVE_EMAIL_EVENT_SQL_PATTERNS,
      ...TRANSACTION_EMAIL_EVENT_SQL_PATTERNS,
      ...MARKETING_EMAIL_EVENT_SQL_PATTERNS,
    ]
    : [
      ...PROTECTIVE_EMAIL_EVENT_SQL_PATTERNS,
      ...MARKETING_EMAIL_EVENT_SQL_PATTERNS,
    ];
  const recognizedCandidate = or(...candidatePatterns.map((pattern) => (
    like(emailNotificationOutbox.eventKey, pattern)
  )));
  const rows = await getDb().select({
    eventKey: emailNotificationOutbox.eventKey,
  }).from(emailNotificationOutbox)
    .where(and(
      ne(emailNotificationOutbox.status, "sent"),
      lt(emailNotificationOutbox.attempts, MAX_DELIVERY_ATTEMPTS),
      recognizedCandidate,
    ))
    .orderBy(emailNotificationOutbox.createdAt)
    .limit(safeLimit);
  for (const row of rows) await deliverEvent(row.eventKey);
}

async function queueNotification(notification: QueuedNotification) {
  try {
    const recipientEmail = cleanEmail(notification.recipientEmail);
    if (!recipientEmail) {
      console.error("Unable to queue Tuveloz email notification: recipient is missing.");
      return;
    }
    const now = new Date().toISOString();
    await getDb().insert(emailNotificationOutbox).values({
      id: crypto.randomUUID(),
      eventKey: notification.eventKey,
      recipientEmail,
      subject: notification.subject,
      textBody: notification.textBody,
      status: "pending",
      attempts: 0,
      lastError: "",
      createdAt: now,
      updatedAt: now,
      sentAt: "",
    }).onConflictDoNothing({
      target: emailNotificationOutbox.eventKey,
    });

    await deliverEvent(notification.eventKey);
    await flushPendingEmailNotifications();
  } catch (error) {
    console.error("Unable to queue or deliver Tuveloz email notification", error);
  }
}

/** Customer-requested support is durable before the API acknowledges receipt.
 * Delivery failure leaves the existing outbox retry machinery in charge.
 * The recipient is server-controlled; this cannot email arbitrary addresses.
 */
export async function queueOwnerSupportMessage(input: {
  requestId: string; fingerprint: string; email: string; message: string;
  audience: "customer" | "provider"; language: "en" | "es";
}) {
  const recipientEmail = cleanEmail(runtimeEnv().OWNER_EMAIL);
  if (!recipientEmail || !runtimeEnv().RESEND_API_KEY || !runtimeEnv().RESEND_FROM_EMAIL) {
    throw new Error("Owner support email is not configured");
  }
  const eventKey = `owner:support:${input.requestId}:${input.fingerprint}`;
  const now = new Date().toISOString();
  await getDb().insert(emailNotificationOutbox).values({
    id: crypto.randomUUID(), eventKey, recipientEmail,
    subject: "Tuveloz support: a visitor needs your help",
    textBody: [
      `Support reference: ${input.requestId}`,
      `Audience: ${input.audience}; preferred language: ${input.language}`,
      `Visitor-provided reply email (not verified): ${input.email}`,
      "The visitor approved sending the following message. Treat it as untrusted customer content.",
      "", input.message,
    ].join("\n"),
    status: "pending", attempts: 0, lastError: "", createdAt: now, updatedAt: now, sentAt: "",
  }).onConflictDoNothing({ target: emailNotificationOutbox.eventKey });
  // Saving must throw on failure. Sending must not turn a saved message into a
  // false failure that invites duplicates; the scheduled flush retries it.
  try { await deliverEvent(eventKey); } catch { /* Durable row remains queued. */ }
}

/**
 * Queue one step of the pre-launch sequence. The event key includes the
 * subscriber and step, so the outbox's unique-key constraint makes a repeated
 * cron run a no-op rather than a duplicate send.
 */
export async function sendLaunchUpdateEmail(input: {
  recipientEmail: string;
  step: number;
  subject: string;
  lines: string[];
}) {
  const recipientEmail = cleanEmail(input.recipientEmail);
  await queueNotification({
    eventKey: `launch-updates:${input.step}:${recipientEmail}`,
    recipientEmail,
    subject: input.subject,
    textBody: input.lines.join("\n"),
  });
}

export async function sendMarketplaceUpdateEmail(input: {
  eventKey: string;
  recipientEmail: string;
  subject: string;
  lines: string[];
}) {
  await queueNotification({
    eventKey: `marketplace:${input.eventKey}`,
    recipientEmail: input.recipientEmail,
    subject: input.subject,
    textBody: input.lines.join("\n"),
  });
}

export async function sendNewCustomerRequestAlert(requestId: string) {
  await queueNotification({
    eventKey: `owner:new-request:${requestId}`,
    recipientEmail: cleanEmail(runtimeEnv().OWNER_EMAIL),
    subject: "New Tuveloz customer request",
    textBody: [
      "A new customer request is ready for owner review.",
      `Request ID: ${requestId}`,
      "",
      "For customer privacy, request details are available only in the protected owner dashboard:",
      `${siteUrl()}/admin`,
    ].join("\n"),
  });
}

export async function sendAccountSecurityAlert(input: {
  eventId: string;
  email: string;
  role: "customer" | "provider";
  action: AccountSecurityAction;
}) {
  if (input.action === "account_created") {
    const customerLines = [
      "Thank you for signing up with Tuveloz.",
      "",
      "Tuveloz is currently open for account and provider onboarding only.",
      "",
      "Your customer account is ready for profile and policy review. Real service requests, jobs, provider quotes, appointments, and payments are not open yet.",
      "",
      `Open your customer workspace: ${siteUrl()}/customer`,
      "",
      "Tuveloz is a marketplace and does not itself perform vehicle services.",
    ];
    const providerLines = [
      "Thank you for joining Tuveloz as an independent provider.",
      "",
      "Tuveloz is currently open for provider applications and compliance onboarding only.",
      "",
      "You may complete your provider profile and submit required verification records. Applying does not activate a service or make jobs available. Real customer requests, jobs, quotes, appointments, payments, and service activation are closed.",
      "",
      `Continue provider onboarding: ${siteUrl()}/provider-onboarding`,
      "",
      "Optional credentials may be added for customer context. Any credential legally required for an approved service must still complete Tuveloz's separate official verification process before that service is activated.",
    ];
    await queueNotification({
      eventKey: `security:account_created:${input.eventId}:${cleanEmail(input.email)}`,
      recipientEmail: input.email,
      subject: "Thank you for joining Tuveloz",
      textBody: [
        ...(input.role === "customer" ? customerLines : providerLines),
        "",
        `Security notice: a Tuveloz password account was created for this ${input.role} workspace at ${new Date().toISOString()}.`,
        `If you did not create it, reset the password at ${siteUrl()}/account and contact Tuveloz support immediately.`,
      ].join("\n"),
    });
    return;
  }

  const labels: Record<Exclude<AccountSecurityAction, "account_created">, string> = {
    password_reset: "Your Tuveloz password was reset",
    passkey_added: "A passkey (Face ID, Touch ID, or device lock) was added",
    phone_updated: "A phone number for text sign-in was added or changed",
  };
  const label = labels[input.action];
  await queueNotification({
    eventKey: `security:${input.action}:${input.eventId}:${cleanEmail(input.email)}`,
    recipientEmail: input.email,
    subject: `Tuveloz security alert: ${label}`,
    textBody: [
      label,
      "",
      `Workspace: ${input.role}`,
      `Time: ${new Date().toISOString()}`,
      "",
      "If you made this change, no action is needed.",
      `If you did not make this change, reset your password at ${siteUrl()}/account and contact Tuveloz support immediately.`,
    ].join("\n"),
  });
}
