import { env } from "cloudflare:workers";
import { and, eq, lt, ne } from "drizzle-orm";
import { getDb } from "../db";
import { emailNotificationOutbox } from "../db/schema";

type RuntimeEnv = Record<string, string | undefined>;

export type AccountSecurityAction =
  | "account_created"
  | "password_reset"
  | "passkey_added";

type QueuedNotification = {
  eventKey: string;
  recipientEmail: string;
  subject: string;
  textBody: string;
};

const MAX_DELIVERY_ATTEMPTS = 5;
const RETRY_BATCH_SIZE = 3;

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

async function markFailed(id: string, attempts: number, error: unknown) {
  await getDb().update(emailNotificationOutbox).set({
    status: "failed",
    attempts,
    lastError: errorSummary(error),
    updatedAt: new Date().toISOString(),
  }).where(eq(emailNotificationOutbox.id, id));
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

  const attempts = notification.attempts + 1;
  const apiKey = runtimeEnv().RESEND_API_KEY ?? "";
  const from = runtimeEnv().RESEND_FROM_EMAIL ?? "";
  if (!apiKey || !from) {
    await markFailed(
      notification.id,
      attempts,
      new Error("Resend email delivery is not configured."),
    );
    return;
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
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
    await markFailed(notification.id, attempts, error);
  }
}

async function retryOlderEvents(currentEventKey: string) {
  const rows = await getDb().select({
    eventKey: emailNotificationOutbox.eventKey,
  }).from(emailNotificationOutbox)
    .where(and(
      ne(emailNotificationOutbox.status, "sent"),
      lt(emailNotificationOutbox.attempts, MAX_DELIVERY_ATTEMPTS),
    ))
    .orderBy(emailNotificationOutbox.createdAt)
    .limit(RETRY_BATCH_SIZE);
  for (const row of rows) {
    if (row.eventKey !== currentEventKey) await deliverEvent(row.eventKey);
  }
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
    await retryOlderEvents(notification.eventKey);
  } catch (error) {
    console.error("Unable to queue or deliver Tuveloz email notification", error);
  }
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
  const labels: Record<AccountSecurityAction, string> = {
    account_created: "Your Tuveloz password account was created",
    password_reset: "Your Tuveloz password was reset",
    passkey_added: "A passkey (Face ID, Touch ID, or device lock) was added",
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
