import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const analytics = await readFile(new URL("../lib/analytics.ts", import.meta.url), "utf8");
const policy = await readFile(new URL("../lib/analytics-policy.ts", import.meta.url), "utf8");
const dashboardApi = await readFile(
  new URL("../app/api/admin/analytics-funnel/route.ts", import.meta.url),
  "utf8",
);
const dashboard = await readFile(
  new URL("../app/admin/analytics-funnel/page.tsx", import.meta.url),
  "utf8",
);

test("campaign attribution is allowlisted, tab-scoped, and attached to funnel events", () => {
  for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"]) {
    assert.match(policy, new RegExp(`"${key}"`));
  }
  assert.match(analytics, /sessionStorage\.setItem\(ATTRIBUTION_STORAGE_KEY/);
  assert.match(analytics, /cleanAnalyticsProps\(\{ \.\.\.campaignAttribution\(\), \.\.\.props \}\)/);
  assert.doesNotMatch(analytics, /localStorage/);
});

test("owner funnel reports starts and completed applications by campaign", () => {
  assert.match(dashboardApi, /function campaignsSince/);
  assert.match(dashboardApi, /provider_signup_started/);
  assert.match(dashboardApi, /PROVIDER_APPLICATION_SUBMITTED/);
  assert.match(dashboardApi, /campaigns:\s*CampaignRow\[\]/);
  assert.match(dashboard, /Provider campaign results/);
  assert.match(dashboard, /<CampaignAttribution rows=\{active\.campaigns\} \/>/);
});
