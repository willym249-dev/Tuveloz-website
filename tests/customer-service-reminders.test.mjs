import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import {
  MAX_SERVICE_REMINDERS,
  isReminderStatus,
  validateServiceReminder,
} from "../lib/customer-service-reminders.ts";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("reminder validation requires a customer-chosen schedule and never invents one", () => {
  // A date alone, a mileage alone, or both are all valid schedules.
  assert.equal(validateServiceReminder({
    vehicle: " 2019 Ford  Transit ",
    service: "Oil change",
    dueDate: "2026-11-01",
  }).ok, true);
  assert.equal(validateServiceReminder({
    vehicle: "Van 3",
    service: "Brake check",
    dueMileage: "60000",
    currentMileage: "52000",
  }).ok, true);

  const cleaned = validateServiceReminder({
    vehicle: " 2019 Ford  Transit ",
    service: "Oil change",
    dueDate: "2026-11-01",
  });
  assert.equal(cleaned.reminder.vehicle, "2019 Ford Transit");

  // No schedule means no reminder — Tuveloz does not fill an interval in.
  assert.equal(validateServiceReminder({ vehicle: "a", service: "b" }).ok, false);
  // Vehicle and service are both required.
  assert.equal(validateServiceReminder({ service: "b", dueDate: "2026-11-01" }).ok, false);
  assert.equal(validateServiceReminder({ vehicle: "a", dueDate: "2026-11-01" }).ok, false);
  // A stated date has to be a real calendar date.
  assert.equal(validateServiceReminder({ vehicle: "a", service: "b", dueDate: "2026-02-30" }).ok, false);
  assert.equal(validateServiceReminder({ vehicle: "a", service: "b", dueDate: "soon" }).ok, false);
  // Mileage must be a sane non-negative number, and due cannot trail current.
  assert.equal(validateServiceReminder({ vehicle: "a", service: "b", dueMileage: "-1" }).ok, false);
  assert.equal(validateServiceReminder({ vehicle: "a", service: "b", dueMileage: "9999999999" }).ok, false);
  assert.equal(validateServiceReminder({
    vehicle: "a",
    service: "b",
    dueMileage: "50000",
    currentMileage: "60000",
  }).ok, false);

  assert.ok(MAX_SERVICE_REMINDERS > 0);
  assert.equal(isReminderStatus("active"), true);
  assert.equal(isReminderStatus("completed"), true);
  assert.equal(isReminderStatus("dismissed"), true);
  assert.equal(isReminderStatus("archived"), false);
});

test("service reminders are owner-scoped, capped, and isolated from test records", async () => {
  const route = await read("app/api/service-reminders/route.ts");

  assert.ok(route.includes("getAccountSession"));
  assert.ok(route.includes('session.role === "customer"'));
  assert.ok(route.includes("isSameOriginRequest"));
  assert.ok(route.includes(">= MAX_SERVICE_REMINDERS"));

  // Every read and write is scoped by the signed-in owner, so an id alone can
  // never reach another account's reminder.
  const ownerScopedWrites = route.match(
    /lower\(\$\{customerServiceReminders\.customerEmail\}\) = \$\{session\.email\.toLowerCase\(\)\}/g,
  );
  assert.ok(ownerScopedWrites && ownerScopedWrites.length >= 4);
  assert.match(route, /listReminders\(email: string\)[\s\S]*customerEmail\}\) = \$\{email\.toLowerCase\(\)\}/);

  // The completed-job picker and the source-job check both exclude test
  // records, keeping test data isolated from real accounts.
  const testJobExclusions = route.match(/eq\(customerRequests\.isTestJob, "no"\)/g);
  assert.ok(testJobExclusions && testJobExclusions.length >= 2);
  // And a cited source job must belong to the signed-in account.
  assert.match(route, /sourceJobBelongsToAccount\(session\.email/);
});

test("the reminders table ships as migration 0066 with its journal entry", async () => {
  const migration = await read("drizzle/0066_customer_service_reminders.sql");
  assert.match(migration, /CREATE TABLE `customer_service_reminders`/);
  assert.match(migration, /`due_date` text DEFAULT '' NOT NULL/);
  assert.match(migration, /`status` text DEFAULT 'active' NOT NULL/);

  const journal = JSON.parse(await read("drizzle/meta/_journal.json"));
  const entry = journal.entries.find((item) => item.tag === "0066_customer_service_reminders");
  assert.ok(entry, "journal entry for 0066_customer_service_reminders is missing");
  assert.equal(entry.idx, 66);

  const schema = await read("db/schema.ts");
  assert.match(schema, /customerServiceReminders = sqliteTable\(\s*"customer_service_reminders"/);
});

test("reminders appear in the customer workspace and the privacy export", async () => {
  const page = await read("app/customer/page.tsx");
  assert.ok(page.includes("CustomerServiceRemindersTools"));
  assert.ok(page.includes('["reminders", "Service reminders"]'));

  const exportRoute = await read("app/api/privacy-center/export/route.ts");
  assert.match(exportRoute, /FROM customer_service_reminders[\s\S]*?lower\(customer_email\) = lower\(\?\)/);
  assert.ok(exportRoute.includes("serviceReminders,"));
});

test("a reminder never books service or touches providers, prices, or routing", async () => {
  const route = await read("app/api/service-reminders/route.ts");
  const component = await read("app/components/customer-service-reminders-tools.tsx");
  const validation = await read("lib/customer-service-reminders.ts");

  // The reminder surfaces read and write only the customer's own reminder rows
  // and read completed requests; they never write requests, quotes, or jobs.
  assert.ok(!route.includes("insert(customerRequests"));
  assert.ok(!route.includes("update(customerRequests"));
  assert.ok(!/providerQuotes|providerJobRecords|stripe/i.test(route));

  // The customer supplies the schedule; no code path fabricates one.
  assert.match(validation, /Enter a due date, a due mileage, or both/);
  assert.ok(!/manufacturerInterval|recommendedInterval|defaultInterval/.test(route + component + validation));
});
