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
  assert.match(source, /Electronic transaction consent/);
  assert.match(source, /agree to conduct this specific repair authorization or invoice transaction electronically/);
  assert.match(source, /You may refuse to conduct this or a future transaction electronically/);
  assert.match(source, /secure Tuveloz account/);
  assert.match(source, /All labor performed and parts replaced were necessary/);
  assert.match(source, /mechanic's work was performed satisfactorily/);
  assert.match(source, /lineAmountCents !== quantity \* unitAmountCents/);
  assert.match(source, /lineType === "part" && \(!partNumber/);
  assert.match(source, /used/);
  assert.match(source, /rebuilt/);
  assert.match(source, /reconditioned/);
});

test("migrations create immutable authorization, itemized invoice, signature, delivery, and retention records", async () => {
  const [migration, gates, finalFields] = await Promise.all([
    read("drizzle/0042_maryland_repair_records.sql"),
    read("drizzle/0043_signed_repair_record_gates.sql"),
    read("drizzle/0044_final_provider_invoice_legal_fields_immutable.sql"),
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

  assert.match(finalFields, /provider_invoice_final_legal_fields_immutable/);
  for (const protectedField of [
    "authorization_record_id",
    "provider_business_name",
    "county_registration_number",
    "customer_name",
    "vehicle_make_model",
    "customer_instructions",
    "provider_diagnosis",
    "labor_billing_method",
    "mechanic_identifiers",
    "provider_signed_at",
    "warranty_work_statement",
    "manufacturer_notice",
    "responsibility_notice",
  ]) {
    assert.match(finalFields, new RegExp(protectedField));
  }
  assert.match(finalFields, /Final provider invoice legal fields are immutable/);
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

test("customer sees conspicuous rights immediately before the exact repair authorization signature", async () => {
  const [page, layout, styles] = await Promise.all([
    read("app/repair-records/page.tsx"),
    read("app/repair-records/layout.tsx"),
    read("app/repair-records/repair-records.css"),
  ]);

  const rights = page.indexOf("repair-customer-rights");
  const signature = page.indexOf("Sign and authorize this exact record");
  assert.ok(rights >= 0, "Customer's Rights block is missing");
  assert.ok(signature > rights, "Customer signature must follow the Customer's Rights block");
  assert.match(page, /selectedSubmitValue/);
  assert.match(page, /SubmitEvent/);
  assert.match(page, /values\.status = selectedSubmitValue\(event\)/);
  assert.match(page, /Itemized estimate lines/);
  assert.match(page, /Montgomery County registration number/);
  assert.match(page, /Customer instructions or description of symptoms/);
  assert.match(page, /Provider diagnosis/);
  assert.match(page, /Mechanic names, initials, or numbers/);
  assert.match(page, /separately agree to conduct this authorization electronically/);
  assert.match(page, /invoice-signature and copy-delivery transaction electronically/);
  assert.match(page, /mechanic&apos;s work was performed satisfactorily/);
  assert.match(page, /Sign invoice and receive secure copy/);
  assert.match(page, /Payment was not automatically released/);
  assert.match(layout, /repair-records\.css/);
  assert.match(styles, /\.repair-customer-rights/);
  assert.match(styles, /border: 4px solid currentColor/);
  assert.match(styles, /\.repair-signature-form/);
  assert.match(styles, /border-top: 0/);
});

test("production health and Worker verify the repair-document schema and private controls", async () => {
  const [health, operations, worker] = await Promise.all([
    read("app/api/health/route.ts"),
    read("app/job-operations/page.tsx"),
    read("worker/index.ts"),
  ]);

  assert.match(health, /repair_authorization_records/);
  assert.match(health, /repair_authorization_items/);
  assert.match(health, /provider_invoice_items/);
  assert.match(health, /customer_copy_delivered_at/);
  assert.match(health, /repair_authorization_signed_immutable/);
  assert.match(health, /provider_invoice_final_legal_fields_immutable/);
  assert.match(health, /provider_job_insert_requires_signed_repair_authorization/);
  assert.match(health, /provider_invoice_final_requires_complete_repair_record/);
  assert.match(health, /stripe_payment_release_requires_signed_delivered_provider_invoice/);
  assert.match(operations, /href="\/repair-records"/);
  assert.match(operations, /Open Maryland repair-document test workflow/);
  assert.match(worker, /"\/repair-records"/);
  assert.match(worker, /Cache-Control", "private, no-store/);
});
