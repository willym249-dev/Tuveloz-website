import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("parts choices are communication-only", async () => {
  const matching = await read("lib/service-matching.ts");
  assert.match(matching, /Customer supplies any needed parts — labor only/);
  assert.match(matching, /No parts needed — labor only/);
  assert.match(matching, /CUSTOMER_SUPPLIED_PARTS_POLICY_OPTIONS/);
  assert.match(matching, /does not sell, source, list, verify, or process payment/);
  assert.doesNotMatch(matching, /"Provider supplies parts"/);
  assert.doesNotMatch(matching, /"Either is okay"/);
  assert.doesNotMatch(matching, /"Best value"/);
});

test("request, quote, authorization, and checkout APIs block parts charges", async () => {
  const [requests, jobs, authorizations, quotes, checkout, operations, repairRecords] = await Promise.all([
    read("app/api/requests/route.ts"),
    read("app/api/jobs/route.ts"),
    read("app/api/job-authorizations/route.ts"),
    read("app/api/customer-quotes/route.ts"),
    read("app/api/stripe/checkout/route.ts"),
    read("app/api/job-operations/route.ts"),
    read("app/api/repair-records/route.ts"),
  ]);
  assert.match(requests, /LABOR_ONLY_PARTS_SOURCE_REQUIRED/);
  assert.match(requests, /LABOR_ONLY_PARTS_ACKNOWLEDGMENT_REQUIRED/);
  assert.match(jobs, /submittedPartsPrice !== 0/);
  assert.match(jobs, /LABOR_ONLY_QUOTE_REQUIRED/);
  assert.match(authorizations, /LABOR_ONLY_AUTHORIZATION_REQUIRED/);
  assert.match(quotes, /partsPriceCents !== 0/);
  assert.match(checkout, /scopePrice\.partsAmountCents !== 0/);
  assert.match(checkout, /scopePrice\.laborAmountCents !== scopePrice\.totalAmountCents/);
  assert.match(operations, /LABOR_ONLY_CHANGE_ORDER_REQUIRED/);
  assert.match(operations, /LABOR_ONLY_CANCELLATION_REQUIRED/);
  assert.match(operations, /LABOR_ONLY_INVOICE_REQUIRED/);
  assert.match(repairRecords, /LABOR_ONLY_REPAIR_RECORD_REQUIRED/);
});

test("database migration independently enforces labor-only transactions", async () => {
  const migration = await read("drizzle/0048_customer_supplied_parts_preferences.sql");
  for (const trigger of [
    "customer_requests_labor_only_parts_insert",
    "customer_requests_labor_only_parts_update",
    "provider_quotes_labor_only_insert",
    "provider_quotes_labor_only_update",
    "provider_profiles_customer_supplied_parts_policy_insert",
    "provider_profiles_customer_supplied_parts_policy_update",
    "job_authorizations_labor_only_insert",
    "job_authorizations_labor_only_update",
    "job_change_orders_labor_only_insert",
    "job_change_orders_labor_only_update",
    "provider_invoices_labor_only_insert",
    "provider_invoices_labor_only_update",
    "job_cancellations_labor_only_insert",
    "job_cancellations_labor_only_update",
    "repair_authorizations_labor_only_insert",
    "repair_authorizations_labor_only_update",
    "repair_authorization_items_labor_only_insert",
    "repair_authorization_items_labor_only_update",
    "provider_invoice_items_labor_only_insert",
    "provider_invoice_items_labor_only_update",
  ]) {
    assert.match(migration, new RegExp("CREATE TRIGGER `" + trigger + "`"));
  }
  assert.match(migration, /labor_only_parts_acknowledged_at/);
  assert.match(migration, /labor_only_parts_confirmed_at/);
  assert.match(migration, /parts_price_cents` AS integer\) <> 0/);
  assert.match(migration, /NEW\.`parts_cents` <> 0/);
  assert.match(migration, /NEW\.`other_fees_cents` <> 0/);
  assert.match(migration, /NEW\.`parts_committed_cents` <> 0/);
  assert.match(migration, /Customer-supplied repair parts may be recorded only at a zero Tuveloz amount/);

  const statements = migration
    .split("--> statement-breakpoint")
    .map((statement) => statement.trim())
    .filter(Boolean);
  assert.equal(statements.length, 43);
  for (const statement of statements) {
    assert.match(statement, /^(ALTER TABLE|DROP TRIGGER|CREATE TRIGGER)/);
    if (statement.startsWith("CREATE TRIGGER")) {
      assert.match(statement, /END;$/);
      assert.equal(statement.match(/CREATE TRIGGER/g)?.length, 1);
    }
  }
});
