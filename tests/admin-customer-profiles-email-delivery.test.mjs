import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("owner user management includes privacy-safe customer profile and activity facts", async () => {
  const [api, component] = await Promise.all([
    source("app/api/admin/control-center/route.ts"),
    source("app/components/owner-control-center.tsx"),
  ]);

  assert.match(api, /account_service_area_settings/);
  assert.match(api, /savedProviders/);
  assert.match(api, /FROM appointments/);
  assert.match(api, /FROM account_notifications/);
  assert.match(api, /FROM email_notification_outbox/);
  assert.match(api, /customerProfile:/);
  assert.match(api, /activeJobCount/);
  assert.match(api, /quotesReceivedCount/);
  assert.doesNotMatch(api, /service_address AS/);

  assert.match(component, /Customer profiles and user management/);
  assert.match(component, /City or municipality/);
  assert.match(component, /Quotes received/);
  assert.match(component, /Customer emails/);
  assert.match(component, /Exact service street addresses are intentionally not shown/);
  assert.match(component, /Quotes submitted as provider/);
});

test("queued job-status emails are flushed after state-changing requests", async () => {
  const [worker, migration] = await Promise.all([
    source("worker/index.ts"),
    source("drizzle/0032_marketplace_tools.sql"),
  ]);

  assert.match(worker, /flushPendingEmailNotifications/);
  assert.match(worker, /request\.method !== "GET" \|\| acceptsHtml/);
  assert.match(worker, /const response = await handler\.fetch/);
  assert.match(worker, /ctx\.waitUntil/);
  assert.match(migration, /Your Tuveloz provider is on the way/);
  assert.match(migration, /Your Tuveloz provider has arrived/);
  assert.match(migration, /Your Tuveloz vehicle service is complete/);
  assert.match(migration, /email_notification_outbox/);
});

test("signup appointment and trip actions include customer email messages", async () => {
  const [emailNotifications, appointments, tracking] = await Promise.all([
    source("lib/email-notifications.ts"),
    source("app/api/appointments/route.ts"),
    source("app/api/tracking/route.ts"),
  ]);

  assert.match(emailNotifications, /Thank you for signing up with Tuveloz/);
  assert.match(emailNotifications, /subject: "Thank you for joining Tuveloz"/);
  assert.match(appointments, /New Tuveloz appointment request/);
  assert.match(appointments, /Tuveloz appointment \$\{responseStatus\}/);
  assert.match(tracking, /Your Tuveloz provider is sharing trip location/);
});
