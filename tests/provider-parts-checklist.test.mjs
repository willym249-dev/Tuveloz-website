import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("provider parts checklist is provider-gated and preparation-only", async () => {
  const page = await read("app/provider-jobs/parts/page.tsx");
  // Only a signed-in provider can use it; others are redirected out.
  assert.match(page, /\/account\?role=provider/);
  assert.match(page, /account\.role !== "provider"/);
  // Preparation tool only — creates no real job, quote, or payment.
  assert.match(page, /does not activate a service/);
  // Stays on-device like the quote toolkit.
  assert.match(page, /tuveloz-provider-parts-checklist-v1/);
});

test("provider parts checklist keeps the labor-only, no-sourcing promise", async () => {
  const page = await read("app/provider-jobs/parts/page.tsx");
  assert.match(page, /labor only/);
  assert.match(page, /doesn&apos;t sell, source,\s*[\s\S]*?parts/);
  // The customer buys and brings the part; Tuveloz never sources it.
  assert.match(page, /customer buys the part\s*[\s\S]*?separately/);
});

test("provider parts checklist never becomes a parts store", async () => {
  const page = await read("app/provider-jobs/parts/page.tsx");
  // No reintroduced parts-shopping component or buy-links.
  assert.doesNotMatch(page, /MarketPriceLinks/);
  assert.doesNotMatch(page, /rockauto|amazon|autozone|oreilly|advanceauto/i);
  assert.doesNotMatch(page, /https?:\/\/[^"']*(part|shop|buy|store)/i);
  // No prices anywhere — parts pricing never runs through Tuveloz.
  assert.doesNotMatch(page, /\$\d/);
});

test("provider quote toolkit links to the parts checklist", async () => {
  const toolkit = await read("app/provider-jobs/toolkit/page.tsx");
  assert.match(toolkit, /\/provider-jobs\/parts/);
});
