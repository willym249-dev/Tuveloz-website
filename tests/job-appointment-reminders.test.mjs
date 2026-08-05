import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("appointment API enforces provider ownership; customers read by token only", async () => {
  const source = await read("app/api/job-appointment/route.ts");
  assert.match(source, /quote\.status = 'accepted'/);
  assert.match(source, /lower\(quote\.provider_email\) = lower\(\?\)/);
  assert.match(source, /isSameOriginRequest\(request\)/);
  assert.match(source, /session\.role !== "provider"/);
  // Setting a time is a booking action, gated by the marketplace switch.
  assert.match(source, /runtimeMarketplaceActionAllowed\("booking"/);
  // Customer path is token-only and never editable.
  assert.match(source, /request\.access_token = \?/);
  assert.match(source, /role: "customer", canEdit: false/);
  // Changing the time re-arms the reminder (delete + fresh insert with empty reminder).
  assert.match(source, /reminderSentAt: ""/);
});

test("reminder sweep fires once, only inside the window, and is marketplace-gated", async () => {
  const source = await read("lib/appointment-reminders.ts");
  // Onboarding-only is a no-op.
  assert.match(source, /runtimeMarketplaceActionAllowed\("discovery"\)/);
  // Never test jobs, never cancelled/completed.
  assert.match(source, /request\.is_test_job = 'no'/);
  assert.match(source, /request\.status NOT IN \('cancelled','canceled','completed'\)/);
  // Only within the window before the instant, never after it started.
  assert.match(source, /at - nowMs > REMINDER_WINDOW_MS \|\| at <= nowMs/);
  // Atomic claim so a reminder is queued at most once.
  assert.match(source, /reminder_sent_at = ''\s*\r?\n?\s*RETURNING id/);
  // Reminder rides the existing marketplace notification + email outbox.
  assert.match(source, /notifyMarketplaceAccount/);
  assert.match(source, /emailSubject:/);
});

test("appointment reminder sweep runs on the scheduled cron", async () => {
  const worker = await read("worker/index.ts");
  assert.match(worker, /import \{ processDueAppointmentReminders \} from "\.\.\/lib\/appointment-reminders"/);
  assert.match(worker, /scheduledTask\("appointment reminders", \(\) => processDueAppointmentReminders\(\)\)/);
});

test("appointment surfaces to provider (editable) and customer (read-only)", async () => {
  const provider = await read("app/provider-jobs/page.tsx");
  assert.match(provider, /JobAppointmentPanel requestId=\{job\.id\} \/>/);
  const customer = await read("app/my-request/page.tsx");
  assert.match(customer, /JobAppointmentPanel requestId=\{job\.id\} token=\{accessToken\}/);
});

test("job_appointments migration is additive (new table only)", async () => {
  const migration = await read("drizzle/0053_job_appointments.sql");
  assert.match(migration, /CREATE TABLE `job_appointments`/);
  assert.doesNotMatch(migration, /DROP TABLE|__new_/);
});
