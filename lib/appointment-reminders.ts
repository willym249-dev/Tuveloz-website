import { env } from "cloudflare:workers";
import { notifyMarketplaceAccount } from "./marketplace-notifications";
import { runtimeMarketplaceActionAllowed } from "./runtime-marketplace-action";

// Remind the customer once, within this window before the appointment instant.
const REMINDER_WINDOW_MS = 24 * 60 * 60 * 1000;

export type AppointmentReminderSweep = { due: number; sent: number };

type DueRow = {
  id: string;
  requestId: string;
  appointmentAt: string;
  customerEmail: string;
  providerName: string;
  service: string;
};

function formatEastern(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  try {
    return `${date.toLocaleString("en-US", {
      timeZone: "America/New_York",
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    })} (Eastern)`;
  } catch {
    return iso;
  }
}

export async function processDueAppointmentReminders(
  now = new Date(),
): Promise<AppointmentReminderSweep> {
  // Real reminders only flow while the marketplace is live; onboarding-only is a no-op.
  if (!(await runtimeMarketplaceActionAllowed("appointment"))) {
    return { due: 0, sent: 0 };
  }
  const rows = await env.DB.prepare(
    `SELECT appointment.id AS id,
            appointment.request_id AS requestId,
            appointment.appointment_at AS appointmentAt,
            lower(request.email) AS customerEmail,
            quote.provider_name AS providerName,
            request.service AS service
       FROM job_appointments appointment
       INNER JOIN customer_requests request ON request.id = appointment.request_id
       INNER JOIN provider_quotes quote
         ON quote.request_id = appointment.request_id AND quote.status = 'accepted'
      WHERE appointment.reminder_sent_at = ''
        AND appointment.appointment_at <> ''
        AND request.is_test_job = 'no'
        AND request.status NOT IN ('cancelled','canceled','completed')`,
  ).all<DueRow>();

  const items = rows.results ?? [];
  const nowMs = now.getTime();
  const nowIso = now.toISOString();
  let due = 0;
  let sent = 0;

  for (const item of items) {
    const at = Date.parse(item.appointmentAt);
    if (!Number.isFinite(at)) continue;
    // Only within the window before the appointment, and never after it started.
    if (at - nowMs > REMINDER_WINDOW_MS || at <= nowMs) continue;
    due += 1;

    const whenText = formatEastern(item.appointmentAt);
    await notifyMarketplaceAccount({
      eventKey: `job-appointment-reminder:${item.id}`,
      email: item.customerEmail,
      role: "customer",
      title: "Appointment reminder",
      body: `${item.providerName} has your ${item.service} appointment coming up${whenText ? ` — ${whenText}` : ""}.`,
      href: "/my-request",
      emailSubject: "Your Tuveloz appointment is coming up",
      emailLines: [
        `${item.providerName} has your ${item.service} appointment coming up.`,
        whenText ? `When: ${whenText}` : "",
        "Open your private request page: https://tuveloz.com/my-request",
      ].filter(Boolean),
    });

    // The notification and email outbox use the appointment ID as an idempotent
    // event key. Mark the reminder only after that durable call succeeds; if it
    // fails, a later cron run can safely retry without losing the reminder.
    const marked = await env.DB.prepare(
      `UPDATE job_appointments
          SET reminder_sent_at = ?, updated_at = ?
        WHERE id = ? AND reminder_sent_at = ''
        RETURNING id`,
    ).bind(nowIso, nowIso, item.id).first<{ id: string }>();
    if (marked) sent += 1;
  }

  return { due, sent };
}
