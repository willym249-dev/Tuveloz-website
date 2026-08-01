import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Maryland repair notices and line-item validation are source-bound", async () => {
  const source = await read("lib/maryland-repair-records.ts");

  assert.match(source, /MARYLAND_CUSTOMER_RIGHTS_HEADING = "Customer's Rights"/);
  assert.match(source, /written estimate for repairs which cost in excess of \$50/);
  assert.match(source, /ten percent in excess of the written estimate without your consent/);
  assert.match(source, /return of any replaced parts/);
  assert.match(source, /Repairs not originally authorized/);
  assert.match(source, /Manufacturer Special Policy Adjustment Programs/);
  assert.match(source, /National Highway Traffic Safety Administration/);
  assert.match(source, /repair facility may not be responsible for damage/);
  assert.match(source, /written estimate for every Montgomery County repair or maintenance job/);
  assert.match(source, /lineAmountCents !== quantity \* unitAmountCents/);
  assert.match(source, /lineType === "part" && \(!partNumber/);
  assert.match(source, /used/);
  assert.match(source, /rebuilt/);
  assert.match(source, /reconditioned/);
});

test("migration creates immutable authorization, itemized invoice, signature, delivery, and retention records", async () => {
  const [migration, gates] = await Promise.all([
    read("drizzle/0042_maryland_repair_records.sql"),
    read("drizzle/0043_signed_repair_record_gates.sql"),
  ]);

  assert.match(migration, /CREATE TABLE `repair_authorization_records`/);
  assert.match(migration, /CREATE TABLE `repair_authorization_items`/);
  assert.match(migration, /CREATE TABLE `provider_invoice_items`/);
  for (const column of [
    "county_registration_number",
    "customer_rights_heading",
    "customer_rights_text",
    "manufacturer_notice",
    "responsibility_notice",
    "customer_signature_at",
    "customer_copy_delivered_at",
    "provider_copy_retained_at",
    "document_snapshot",
    "document_hash",
  ]) {
    assert.match(migration, new RegExp(column));
  }
  assert.match(migration, /repair_authorization_signed_immutable/);
  assert.match(migration, /provider_invoice_final_core_immutable/);
  assert.match(migration, /provider_invoice_signed_immutable/);
  assert.match(migration, /Final provider invoice items are immutable/);

  assert.match(gates, /provider_job_insert_requires_signed_repair_authorization/);
  assert.match(gates, /provider_job_update_requires_signed_repair_authorization/);
  assert.match(gates, /authorization\.`status` = 'signed'/);
  assert.match(gates, /provider_invoice_cannot_insert_final_directly/);
  assert.match(gates, /provider_invoice_final_requires_complete_repair_record/);
  assert.match(gates, /provider_invoice_items/);
  assert.match(gates, /stripe_payment_release_requires_signed_delivered_provider_invoice/);
  assert.match(gates, /customer_copy_delivered_at/);
  assert.match(gates, /provider_copy_retained_at/);
});

test("repair-record API is participant-only, test-only, same-origin, and cannot move money", async () => {
  const source = await read("app/api/repair-records/route.ts");

  assert.match(source, /getAccountSession\(request\)/);
  assert.match(source, /isSameOriginRequest\(request\)/);
  assert.match(source, /request\.is_test_job = 'yes'/);
  assert.match(source, /provider\.is_test_provider = 'yes'/);
  assert.match(source, /Only the selected provider can prepare the repair authorization/);
  assert.match(source, /Only the customer can sign the repair authorization/);
  assert.match(source, /signed repair authorization is required before a final invoice/);
  assert.match(source, /final provider invoice total must exactly match the customer-signed authorized provider amount/);
  assert.match(source, /secure-account-copy/);
  assert.match(source, /paymentReleased: false/);
  assert.doesNotMatch(source, /stripeClient|checkout\.sessions|paymentIntents|transfers\.create/);
  assert.doesNotMatch(source, /UPDATE stripe_payments|INSERT INTO stripe_payments/);
});

test("customer sees the required rights immediately before the repair authorization signature", async () => {
  const page = await read("app/repair-records/page.tsx");

  const rights = page.indexOf("repair-customer-rights");
  const signature = page.indexOf("Sign and authorize this exact record");
  assert.ok(rights >= 0, "Customer's Rights block is missing");
  assert.ok(signature > rights, "Customer signature must follow the Customer's Rights block");
  assert.match(page, /Itemized estimate lines/);
  assert.match(page, /Montgomery County registration number/);
  assert.match(page, /Customer instructions or description of symptoms/);
  assert.match(page, /Provider diagnosis/);
  assert.match(page, /Mechanic names, initials, or numbers/);
  assert.match(page, /Sign invoice and receive secure copy/);
  assert.match(page, /Payment was not automatically released/);
});

test("production health verifies the new repair-document schema and controls", async () => {
  const health = await read("app/api/health/route.ts");
  const operations = await read("app/job-operations/page.tsx");

  assert.match(health, /repair_authorization_records/);
  assert.match(health, /repair_authorization_items/);
  assert.match(health, /provider_invoice_items/);
  assert.match(health, /customer_copy_delivered_at/);
  assert.match(health, /repair_authorization_signed_immutable/);
  assert.match(health, /provider_job_insert_requires_signed_repair_authorization/);
  assert.match(health, /provider_invoice_final_requires_complete_repair_record/);
  assert.match(health, /stripe_payment_release_requires_signed_delivered_provider_invoice/);
  assert.match(operations, /href="\/repair-records"/);
  assert.match(operations, /Open Maryland repair-document test workflow/);
});
