import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("hero experiment assigns a stable first-party variant", async () => {
  const lib = await read("lib/experiments.ts");
  assert.match(lib, /provider_hero:\s*\["A",\s*"B"\]/);
  assert.match(lib, /export function getVariant/);
  // Persisted per browser so a visitor always sees the same copy.
  assert.match(lib, /localStorage/);
  // Storage-blocked visitors fall back to control, never an error.
  assert.match(lib, /return control/);
});

test("provider hero renders both variants and tags the start event", async () => {
  const page = await read("app/page.tsx");
  assert.match(page, /getVariant\("provider_hero"\)/);
  assert.match(page, /Your wrench\. Your rules\./);
  assert.match(page, /Do great work\. Get paid\./);
  assert.match(page, /track\("provider_signup_started",\s*\{\s*experiment: "provider_hero"/);
});

test("submitted applications are attributed to the hero variant", async () => {
  const form = await read("app/components/provider-signup-form.tsx");
  assert.match(form, /getVariant/);
  assert.match(form, /track\("provider_signup_completed",[\s\S]*?experiment: "provider_hero"/);
});

test("owner funnel reports conversion per hero variant", async () => {
  const api = await read("app/api/admin/analytics-funnel/route.ts");
  // Aggregates start/submit by the variant prop and reports a conversion rate.
  assert.match(api, /heroExperimentSince/);
  assert.match(api, /conversion: pct\(value\.submitted, value\.started\)/);
  // Only real A/B rows are counted; legacy/malformed props are ignored.
  assert.match(api, /variant !== "A" && variant !== "B"/);

  const adminPage = await read("app/admin/analytics-funnel/page.tsx");
  assert.match(adminPage, /Hero copy experiment/);
  assert.match(adminPage, /HeroExperiment/);
});
