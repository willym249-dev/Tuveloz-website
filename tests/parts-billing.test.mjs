import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  PARTS_BILLING_TERMS_VERSION,
  allInclusivePartsAllowedForServiceCodes,
  composeQuoteMessage,
  partQualityFromStoredPartType,
  partsBillingLabel,
  partsBillingModelFromStoredPartType,
  storedPartTypeFor,
} from "../lib/parts-billing.ts";

test("current parts models store zero separate parts price classifications", () => {
  assert.equal(storedPartTypeFor("customer_supplied"), "Customer supplied");
  assert.equal(storedPartTypeFor("no_parts_needed"), "No parts needed");
  assert.equal(
    storedPartTypeFor("provider_all_inclusive", "OEM"),
    "All-inclusive provider parts: OEM",
  );
  assert.equal(
    partsBillingModelFromStoredPartType("All-inclusive provider parts: OEM", "0"),
    "provider_all_inclusive",
  );
  assert.equal(
    partQualityFromStoredPartType("All-inclusive provider parts: Aftermarket"),
    "Aftermarket",
  );
});

test("any positive separately itemized parts amount is classified as legacy", () => {
  assert.equal(
    partsBillingModelFromStoredPartType("OEM", "1"),
    "legacy_itemized",
  );
  assert.equal(
    partsBillingModelFromStoredPartType("All-inclusive provider parts: OEM", "100"),
    "legacy_itemized",
  );
});

test("customer disclosure and stored message describe one all-inclusive service price", () => {
  const message = composeQuoteMessage({
    model: "provider_all_inclusive",
    quality: "Aftermarket",
    partsDescription: "front brake pads and hardware kit",
    providerMessage: "Includes a 12-month provider warranty.",
  });
  assert.match(message, /one all-inclusive repair-service price/i);
  assert.match(message, /No separate parts/i);
  assert.match(message, /front brake pads and hardware kit/i);
  assert.match(message, /sales or use tax/i);
  assert.equal(
    partsBillingLabel("provider_all_inclusive", "Aftermarket"),
    "Provider-supplied Aftermarket parts included in one service price",
  );
  assert.equal(PARTS_BILLING_TERMS_VERSION, "2026-08-01");
});

test("special item flows remain blocked from the general all-inclusive repair method", () => {
  assert.equal(allInclusivePartsAllowedForServiceCodes(["battery_replacement"]), true);
  assert.equal(allInclusivePartsAllowedForServiceCodes(["tire_repair_or_installation"]), false);
  assert.equal(allInclusivePartsAllowedForServiceCodes(["fuel_delivery"]), false);
});

test("D1 migration rejects separate parts prices and unapproved classifications", async () => {
  const migration = await readFile(
    new URL("../drizzle/0042_all_inclusive_parts_guard.sql", import.meta.url),
    "utf8",
  );
  assert.match(migration, /parts_price_cents/);
  assert.match(migration, /provider_quotes_all_inclusive_parts_insert_guard/);
  assert.match(migration, /provider_quotes_all_inclusive_parts_update_guard/);
  assert.match(migration, /Separate provider parts charges are disabled/);
});

test("quote API and policy pages contain the operational safeguards", async () => {
  const [quoteApi, providerAgreement, payments] = await Promise.all([
    readFile(new URL("../app/api/jobs/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/provider-agreement/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/payments/page.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(quoteApi, /Separate parts or materials amounts are disabled/);
  assert.match(quoteApi, /providerPartsTaxConfirmed/);
  assert.match(providerAgreement, /retail or wholesale supplier/);
  assert.match(providerAgreement, /must not use a resale certificate/);
  assert.match(payments, /one all-inclusive lump-sum repair-service price/);
  assert.match(payments, /Separately itemized parts sales remain disabled/);
});
