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