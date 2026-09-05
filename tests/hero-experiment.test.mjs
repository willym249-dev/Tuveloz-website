import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("experiments assign stable first-party variants", async () => {
  const lib = await read("lib/experiments.ts");
  assert.match(lib, /provider_hero:\s*\["A",\s*"B"\]/);
  assert.match(lib, /provider_pitch:\s*\["A",\s*"B"\]/);
  assert.match(lib, /founding_cta:\s*\["A",\s*"B"\]/);
  assert.match(lib, /export function getVariant/);
  assert.match(lib, /export function activeVariants/);
  // Persisted per browser so a visitor always sees the same copy.
  assert.match(lib, /localStorage/);
  // Storage-blocked visitors fall back to control, never an error.
  assert.match(lib, /return control/);
});

test("hero and pitch each render both variants and tag the start event", async () => {
  const page = await read("app/page.tsx");
  assert.match(page, /activeVariants\(\)/);
  // Hero variants.
  assert.match(page, /Your wrench\. Your rules\./);
  assert.match(page, /Be first in line for car jobs in Montgomery County\./);
  // Pitch variants.
  assert.match(page, /You’ve got the skills/);
  assert.match(page, /Your customers\. Your prices\. Your call\./);
  // Founding-banner CTA variants. Control matches the site-wide "Apply free"
  // wording; the variant tests a different phrasing against it.
  assert.match(page, /Claim my spot/);
  assert.match(page, /"Apply free"/);
  // Start event carries the per-visitor variant map.
  assert.match(page, /track\("provider_signup_started",\s*\{\s*variants: activeVariants\(\)/);
});

test("submitted applications are attributed to the active variants", async () => {
  const form = await read("app/components/provider-signup-form.tsx");
  assert.match(form, /activeVariants/);
  assert.match(form, /analyticsAttribution: \{ \.\.\.campaignAttribution\(\), variants: activeVariants\(\)/);
  assert.doesNotMatch(form, /track\("provider_signup_completed"/);
});

test("owner funnel reports conversion per variant for every experiment", async () => {
  const api = await read("app/api/admin/analytics-funnel/route.ts");
  assert.match(api, /const EXPERIMENTS = \["provider_hero", "provider_pitch", "founding_cta"\]/);
  assert.match(api, /experimentsSince/);
  assert.match(api, /conversion: pct\(value\.submitted, value\.started\)/);
  // Only real A/B rows are counted; legacy/malformed props are ignored.
  assert.match(api, /variant !== "A" && variant !== "B"/);
  // Older single-field props shape is still honored so no data is lost.
  assert.match(api, /parsed\.experiment === name/);

  const adminPage = await read("app/admin/analytics-funnel/page.tsx");
  assert.match(adminPage, /Copy experiments/);
  assert.match(adminPage, /provider_pitch/);
  assert.match(adminPage, /Pitch headline/);
  assert.match(adminPage, /founding_cta/);
  assert.match(adminPage, /Founding-banner button/);
});
