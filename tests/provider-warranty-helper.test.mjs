import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  INSPECTION_DISCLOSURE,
  MAX_CUSTOM_WARRANTY_LENGTH,
  NO_WARRANTY_DISCLOSURE,
  STANDARD_WARRANTY_TIERS,
  standardWarrantyTier,
  warrantyDisclosure,
} from "../lib/provider-warranty.ts";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("standard warranty tiers match the released Provider Agreement periods", async () => {
  assert.equal(standardWarrantyTier("repair").periodStatement, "12 months or 12,000 miles, whichever comes first");
  assert.equal(standardWarrantyTier("maintenance").periodStatement, "90 days or 3,000 miles, whichever comes first");
  assert.equal(standardWarrantyTier("cosmetic").periodStatement, "7 days after completion");
  assert.equal(standardWarrantyTier("inspection").periodStatement, null);
  assert.equal(STANDARD_WARRANTY_TIERS.length, 4);

  const agreement = await source("app/provider-agreement/page.tsx");
  assert.ok(agreement.includes("12 months or 12,000"));
  assert.ok(agreement.includes("90"));
  assert.ok(agreement.includes("3,000 miles"));
  assert.ok(agreement.includes("7 days for cosmetic work"));
});

test("standard disclosure states period, workmanship scope, exclusions, and provider responsibility", () => {
  const repair = warrantyDisclosure({ workType: "repair", choice: "standard" });
  assert.ok(repair.ok);
  assert.match(repair.disclosure, /12 months or 12,000 miles/);
  assert.match(repair.disclosure, /re-performing the covered labor at no additional labor charge/);
  assert.match(repair.disclosure, /does not[\s\S]*cover failure of a customer-supplied part/);
  assert.match(repair.disclosure, /provided and honored by our business, not by Tuveloz/);
  assert.match(repair.disclosure, /Implied or statutory warranty rights/);
  assert.doesNotMatch(repair.disclosure, /Tuveloz (guarantees|warrants|backs)/);

  const maintenance = warrantyDisclosure({ workType: "maintenance", choice: "standard" });
  assert.ok(maintenance.ok);
  assert.match(maintenance.disclosure, /90 days or 3,000 miles/);
});

test("inspections never produce a workmanship warranty, even when standard is selected", () => {
  const inspection = warrantyDisclosure({ workType: "inspection", choice: "standard" });
  assert.ok(inspection.ok);
  assert.equal(inspection.disclosure, INSPECTION_DISCLOSURE);
  assert.match(inspection.disclosure, /No workmanship warranty applies/);
  assert.match(inspection.disclosure, /Marketplace Conduct Policy/);
});

test("declining a warranty still yields an explicit written disclosure", () => {
  const none = warrantyDisclosure({ workType: "repair", choice: "none" });
  assert.ok(none.ok);
  assert.equal(none.disclosure, NO_WARRANTY_DISCLOSURE);
  assert.match(none.disclosure, /No written warranty is offered/);
  assert.match(none.disclosure, /Implied or statutory warranty rights/);
});

test("custom warranties require real terms and stay provider-owned", () => {
  const empty = warrantyDisclosure({ workType: "repair", choice: "custom", customTerms: "   " });
  assert.ok(!empty.ok);
  assert.match(empty.error, /covered/);

  const oversized = warrantyDisclosure({
    workType: "repair",
    choice: "custom",
    customTerms: "x".repeat(MAX_CUSTOM_WARRANTY_LENGTH + 1),
  });
  assert.ok(!oversized.ok);

  const custom = warrantyDisclosure({
    workType: "repair",
    choice: "custom",
    customTerms: "24 months on labor for this repair, re-performed free of labor charges; excludes customer-supplied parts and later damage.",
  });
  assert.ok(custom.ok);
  assert.match(custom.disclosure, /own written warranty/);
  assert.match(custom.disclosure, /24 months on labor/);
  assert.match(custom.disclosure, /not by Tuveloz/);
});

test("the warranty helper page stays a provider-choice preparation tool", async () => {
  const page = await source("app/provider-jobs/warranty/page.tsx");
  assert.ok(page.includes("Offering a warranty is optional"));
  assert.ok(page.includes("does not provide, back, administer, or"));
  assert.ok(page.includes("does not activate a service, record a warranty"));
  assert.ok(page.includes("account.role !== \"provider\""));
  assert.ok(page.includes("immediate termination"));
  const toolkit = await source("app/provider-jobs/toolkit/page.tsx");
  assert.ok(toolkit.includes("href=\"/provider-jobs/warranty\""));
});
