import { env } from "cloudflare:workers";
import { sendMarketplaceUpdateEmail } from "./email-notifications";

export type MarketplaceNotificationRole = "customer" | "provider";

type MarketplaceNotificationInput = {
  eventKey: string;
  email: string;
  role: MarketplaceNotificationRole;
  title: string;
  body: string;
  href?: string;
  emailSubject?: string;
  emailLines?: string[];
};

function clean(value: string, maximum: number) {
  return value.trim().slice(0, maximum);
}

export async function ensureMarketplaceWelcome(email: string, role: MarketplaceNotificationRole) {
  const normalizedEmail = clean(email, 180).toLowerCase();
  const isCustomer = role === "customer";
  // Update the existing welcome in place: do not create another unread notice,
  // reset its date/read state, or send an email when correcting old wording.
  await env.DB.prepare(
    `INSERT INTO account_notifications
       (id, event_key, email, role, title, body, href, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(event_key) DO UPDATE SET
       title = excluded.title, body = excluded.body, href = excluded.href
     WHERE lower(account_notifications.email) = lower(excluded.email)
       AND account_notifications.role = excluded.role
       AND (account_notifications.title <> excluded.title
         OR account_notifications.body <> excluded.body
         OR account_notifications.href <> excluded.href)`,
  ).bind(
    crypto.randomUUID(), `welcome:${role}:${normalizedEmail}`, normalizedEmail, role,
    "Thank you for joining Tuveloz",
    isCustomer
      ? "Your customer account is ready. Open your workspace to review your details and see what is available."
      : "Your provider account is ready. Open your workspace to review your application and any next steps.",
    isCustomer ? "/customer" : "/provider-jobs",
  ).run();
}

export async function notifyMarketplaceAccount(input: MarketplaceNotificationInput) {
  const email = clean(input.email, 180).toLowerCase();
  const eventKey = clean(input.eventKey, 240);
  const title = clean(input.title, 160);
  const body = clean(input.body, 1200);
  const href = clean(input.href ?? "", 300);
  if (!email || !eventKey || !title || !body) return;

  await env.DB.prepare(
    `INSERT OR IGNORE INTO account_notifications
       (id, event_key, email, role, title, body, href, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
  ).bind(
    crypto.randomUUID(),
    eventKey,
    email,
    input.role,
    title,
    body,
    href,
  ).run();

  if (input.emailSubject && input.emailLines?.length) {
    await sendMarketplaceUpdateEmail({
      eventKey,
      recipientEmail: email,
      subject: clean(input.emailSubject, 180),
      lines: input.emailLines.map((line) => clean(line, 1400)),
    });
  }
}
