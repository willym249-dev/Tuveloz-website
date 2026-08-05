import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("checklist templates are service-aware with a safe generic fallback", async () => {
  const source = await read("lib/inspection-templates.ts");
  // Distinct services have distinct starter items.
  assert.match(source, /battery_replacement:\s*\[/);
  assert.match(source, /tire_repair_or_installation:\s*\[/);
  // De-duplication by lower-cased label, and a generic fallback when nothing matched.
  assert.match(source, /seen\.has\(key\)/);
  assert.match(source, /if \(!matchedAny\) GENERIC_ITEMS\.forEach\(push\)/);
  // Only real service codes ever contribute labels — no raw code leaks through.
  assert.match(source, /codes\s*\r?\n?\s*\.filter\(isServiceCode\)/);
});

test("inspection API enforces provider ownership and customer-token read", async () => {
  const source = await read("app/api/job-inspection/route.ts");
  // Provider writes require the accepted-quote-owner rule, same as job-evidence.
  assert.match(source, /quote\.status = 'accepted'/);
  assert.match(source, /lower\(quote\.provider_email\) = lower\(\?\)/);
  // POST is same-origin + provider-session gated, and marketplace-gated.
  assert.match(source, /isSameOriginRequest\(request\)/);
  assert.match(source, /session\.role !== "provider"/);
  assert.match(source, /runtimeMarketplaceActionAllowed\("job_start"/);
  // Customers read by private token only — never write.
  assert.match(source, /request\.access_token = \?/);
  assert.match(source, /canEdit: false/);
});

test("customers see the inspection read-only; providers get the editor", async () => {
  const panel = await read("app/components/job-inspection-panel.tsx");
  assert.match(panel, /const readOnly = Boolean\(token\)/);
  assert.match(panel, /job-inspection-readonly/);

  const customer = await read("app/my-request/page.tsx");
  assert.match(customer, /JobInspectionPanel requestId=\{job\.id\} token=\{accessToken\}/);

  const provider = await read("app/provider-jobs/page.tsx");
  assert.match(provider, /JobInspectionPanel requestId=\{job\.id\} \/>/);
});

test("job_inspection_items migration is additive (new table only)", async () => {
  const migration = await read("drizzle/0052_job_inspection_items.sql");
  assert.match(migration, /CREATE TABLE `job_inspection_items`/);
  assert.doesNotMatch(migration, /DROP TABLE|__new_/);
});
