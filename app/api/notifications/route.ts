import { env } from "cloudflare:workers";
import {
  getAccountSession,
  isSameOriginRequest,
} from "../../../lib/account-auth";
import { flushPendingEmailNotifications } from "../../../lib/email-notifications";
import { notifyMarketplaceAccount } from "../../../lib/marketplace-notifications";

type NotificationRow = {
  id: string;
  title: string;
  body: string;
  href: string;
  read_at: string;
  created_at: string;
};

async function accountSession(request: Request) {
  const session = await getAccountSession(request);
  return session?.role === "customer" || session?.role === "provider" ? session : null;
}

async function ensureWelcomeNotification(
  email: string,
  role: "customer" | "provider",
) {
  const isCustomer = role === "customer";
  await notifyMarketplaceAccount({
    eventKey: `welcome:${role}:${email.toLowerCase()}`,
    email,
    role,
    title: isCustomer ? "Thank you for joining Tuveloz" : "Welcome to your Tuveloz provider workspace",
    body: isCustomer
      ? "Request vehicle work, compare independent providers and quotes, choose appointments, and follow job updates in one account."
      : "Add your approved services and provider-set prices, request appointments, manage availability, and share trip location only when you choose.",
    href: isCustomer ? "/post-job" : "/provider-services",
  });
}

export async function GET(request: Request) {
  const session = await accountSession(request);
  if (!session) {
    return Response.json(
      { error: "Sign in to view your Tuveloz notifications." },
      { status: 401, headers: { "cache-control": "no-store" } },
    );
  }

  await ensureWelcomeNotification(session.email, session.role);
  await flushPendingEmailNotifications(5);

  const notificationResult = await env.DB.prepare(
    `SELECT id, title, body, href, read_at, created_at
       FROM account_notifications
      WHERE lower(email) = lower(?) AND role = ?
      ORDER BY datetime(created_at) DESC
      LIMIT 60`,
  ).bind(session.email, session.role).all<NotificationRow>();

  const notifications = (notificationResult.results ?? []).map((item) => ({
    id: item.id,
    title: item.title,
    body: item.body,
    href: item.href,
    readAt: item.read_at,
    createdAt: item.created_at,
  }));
  return Response.json({
    role: session.role,
    email: session.email,
    notifications,
    unreadCount: notifications.filter((item) => !item.readAt).length,
  }, { headers: { "cache-control": "private, no-store" } });
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "Invalid request origin." }, { status: 403 });
  }
  const session = await accountSession(request);
  if (!session) {
    return Response.json({ error: "Sign in to update notifications." }, { status: 401 });
  }
  const body = await request.json() as { action?: unknown; id?: unknown };
  const action = typeof body.action === "string" ? body.action : "";
  const now = new Date().toISOString();

  if (action === "mark-all-read") {
    await env.DB.prepare(
      `UPDATE account_notifications
          SET read_at = ?
        WHERE lower(email) = lower(?) AND role = ? AND read_at = ''`,
    ).bind(now, session.email, session.role).run();
    return Response.json({ ok: true });
  }

  if (action === "mark-read") {
    const id = typeof body.id === "string" ? body.id.trim().slice(0, 100) : "";
    if (!id) return Response.json({ error: "Choose a notification." }, { status: 400 });
    await env.DB.prepare(
      `UPDATE account_notifications
          SET read_at = ?
        WHERE id = ? AND lower(email) = lower(?) AND role = ?`,
    ).bind(now, id, session.email, session.role).run();
    return Response.json({ ok: true });
  }

  return Response.json({ error: "Unknown notification action." }, { status: 400 });
}
