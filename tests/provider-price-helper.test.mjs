import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { customerPriceFor } from "../lib/customer-fee.ts";
import {
  computeLaborQuote,
  MAX_HOURLY_RATE_CENTS,
  MAX_JOB_MINUTES,
} from "../lib/provider-price-helper.ts";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("labor quote math uses only provider inputs and the shared customer-fee formula", () => {
  const result = computeLaborQuote({
    hourlyRateCents: 9_000, // $90/hour, the provider's own number
    jobMinutes: 90,
    travelMinutes: 30,
  });
  assert.ok(result.ok);
  assert.equal(result.breakdown.billableMinutes, 120);
  assert.equal(result.breakdown.timeBasedPriceCents, 18_000);
  assert.equal(result.breakdown.minimumApplied, false);
  assert.equal(result.breakdown.laborPriceCents, 18_000);

  const fee = customerPriceFor(18_000);
  assert.equal(result.breakdown.customerFeeCents, fee.customerFeeCents);
  assert.equal(result.breakdown.customerTotalCents, fee.customerTotalCents);
});

test("a provider-set minimum job price floors the time-based amount", () => {
  const result = computeLaborQuote({
    hourlyRateCents: 6_000,
    jobMinutes: 20,
    minimumPriceCents: 7_500,
  });
  assert.ok(result.ok);
  assert.equal(result.breakdown.timeBasedPriceCents, 2_000);
  assert.equal(result.breakdown.minimumApplied, true);
  assert.equal(result.breakdown.laborPriceCents, 7_500);
});

test("invalid inputs produce errors instead of invented numbers", () => {
  assert.ok(!computeLaborQuote({ hourlyRateCents: 0, jobMinutes: 60 }).ok);
  assert.ok(!computeLaborQuote({ hourlyRateCents: -100, jobMinutes: 60 }).ok);
  assert.ok(!computeLaborQuote({ hourlyRateCents: MAX_HOURLY_RATE_CENTS + 1, jobMinutes: 60 }).ok);
  assert.ok(!computeLaborQuote({ hourlyRateCents: 9_000, jobMinutes: 0 }).ok);
  assert.ok(!computeLaborQuote({ hourlyRateCents: 9_000, jobMinutes: MAX_JOB_MINUTES + 1 }).ok);
  assert.ok(!computeLaborQuote({ hourlyRateCents: 9_000, jobMinutes: 60, travelMinutes: -5 }).ok);
});

test("the price helper never defines a suggested or default rate", async () => {
  const lib = await source("lib/provider-price-helper.ts");
  for (const forbidden of [/DEFAULT_RATE/i, /SUGGESTED/i, /RECOMMENDED_RATE/i, /BENCHMARK/i]) {
    assert.doesNotMatch(lib.replace(/\/\*[\s\S]*?\*\//g, ""), forbidden);
  }

  const page = await source("app/provider-jobs/pricing/page.tsx");
  assert.ok(page.includes("Tuveloz never sets, suggests, or recommends your rate"));
  assert.ok(page.includes('useState("")')); // inputs start empty, no prefilled rate
  assert.ok(page.includes("this arithmetic is not a"));
  assert.ok(page.includes("labor-only"));
  assert.ok(page.includes("account.role !== \"provider\""));
  assert.ok(page.includes("does not create a quote, activate a service"));
});

test("the price helper is linked from the provider toolkit", async () => {
  const toolkit = await source("app/provider-jobs/toolkit/page.tsx");
  assert.ok(toolkit.includes("href=\"/provider-jobs/pricing\""));
});
