import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("the typical price range ships as migration 0067 on the manual catalog table", async () => {
  const migration = await read("drizzle/0067_provider_price_ranges.sql");
  assert.match(migration, /ALTER TABLE `provider_catalog_items` ADD COLUMN `maximum_price_cents`/);
  assert.match(migration, /`maximum_price_cents` >= 0/);

  const journal = JSON.parse(await read("drizzle/meta/_journal.json"));
  const entry = journal.entries.find((item) => item.tag === "0067_provider_price_ranges");
  assert.ok(entry, "journal entry for 0067_provider_price_ranges is missing");
  assert.equal(entry.idx, 67);
});

test("a range is provider-published end to end and never platform-set", async () => {
  const route = await read("app/api/provider-marketplace-tools/route.ts");

  assert.match(route, /"starting_at", "fixed", "range", "hourly", "quote"/);
  // Both ends come from the provider's own payload; the platform contributes
  // no number. Never-build rule 1: guidance from the provider's own data is
  // fine, a platform-set price is not.
  assert.match(route, /Number\(payload\.startingPrice\)/);
  assert.match(route, /Number\(payload\.maximumPrice\)/);
  assert.doesNotMatch(route, /suggestedPrice|recommendedPrice|platformPrice|defaultPrice|marketPrice/i);

  // The only range rule is that it reads as a range the provider wrote.
  assert.match(route, /maximumAmount < amount/);
  assert.match(route, /Enter a range maximum that is at least the minimum price\./);

  // The maximum is stored and updated with the rest of the provider's item.
  assert.match(route, /maximum_price_cents = excluded\.maximum_price_cents/);
  assert.match(route, /maximum_price_cents AS maximumPriceCents/);
  // A non-range item stores no maximum at all.
  assert.match(route, /priceType === "range" \? Math\.round\(maximumAmount \* 100\) : 0/);
});

test("the range is displayed as the provider's numbers on both surfaces", async () => {
  const publicRoute = await read("app/api/public-provider/route.ts");
  assert.match(publicRoute, /maximum_price_cents AS maximumPriceCents/);

  for (const path of [
    "app/components/provider-public-actions.tsx",
    "app/provider-services/page.tsx",
  ]) {
    const surface = await read(path);
    assert.match(surface, /maximumPriceCents: number/);
    assert.match(surface, /item\.priceType === "range"/);
    // A stored maximum below the minimum never renders as a backwards range.
    assert.match(surface, /Math\.max\(item\.maximumPriceCents, item\.startingPriceCents\)/);
    assert.match(surface, /Typically \$\{amount\}–/);
  }

  const editor = await read("app/provider-services/page.tsx");
  assert.match(editor, /name="maximumPrice"/);
  assert.match(editor, /maximumPrice: values\.maximumPrice/);
  assert.match(editor, /You set both ends yourself/);
});
