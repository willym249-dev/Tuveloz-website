import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

function methodBlock(route, method, nextMethod = "") {
  const start = route.indexOf(`export async function ${method}`);
  assert.notEqual(start, -1, `${method} route was not found`);
  const end = nextMethod
    ? route.indexOf(`export async function ${nextMethod}`, start)
    : route.length;
  return route.slice(start, end === -1 ? route.length : end);
}

test("issue-photo discovery is live, exact-service, and platform-activation gated", async () => {
  const route = await source("app/api/job-images/route.ts");
  const get = methodBlock(route, "GET");
  const discoveryHelper = route.slice(
    route.indexOf("async function providerCanDiscoverIssue"),
    route.indexOf("export async function GET"),
  );

  assert.match(discoveryHelper, /runtimeMarketplaceActionAllowed\("discovery"\)/);
  assert.match(discoveryHelper, /parseExactServiceCodes\(job\.serviceCodes\)/);
  assert.match(discoveryHelper, /job\.jurisdiction !== POLICY_JURISDICTION/);
  assert.match(discoveryHelper, /currentPlatformActiveServiceCodes/);
  assert.match(discoveryHelper, /parseProviderServices\(provider\.approvedServices\)/);
  assert.match(discoveryHelper, /catch \{\s*return false;/);
  assert.ok(get.indexOf("allowed = Boolean(acceptedQuote)") < get.indexOf("providerCanDiscoverIssue(provider, job)"));
  assert.match(get, /kind === "issue"[\s\S]*job\.status === "approved"/);
  assert.match(route, /"cache-control": "private, no-store"/);
});

test("public reviews stop before review, request, or token data is queried", async () => {
  const route = await source("app/api/reviews/route.ts");
  const get = methodBlock(route, "GET", "POST");
  const post = methodBlock(route, "POST");

  assert.ok(get.indexOf("publicReviewsAreAvailable()") < get.indexOf("getDb().select"));
  assert.ok(post.indexOf("publicReviewsAreAvailable()") < post.indexOf("request.json()"));
  assert.ok(post.indexOf("publicReviewsAreAvailable()") < post.indexOf("const db = getDb()"));
  assert.match(route, /runtimeMarketplaceActionAllowed\("discovery"\)/);
  assert.match(route, /code: "MARKETPLACE_ONBOARDING_ONLY"/);
  assert.match(route, /reviews: \[\]/);
  assert.match(route, /summary: \{ average: 0, count: 0 \}/);
  assert.match(route, /"cache-control": "no-store"/);
});

test("provider media keeps owner preview private and gates every public response", async () => {
  const route = await source("app/api/provider-media/route.ts");
  const get = methodBlock(route, "GET");
  const publicHelper = route.slice(
    route.indexOf("async function providerIsPublic"),
    route.indexOf("export async function GET"),
  );

  assert.match(publicHelper, /runtimeMarketplaceActionAllowed\("discovery"\)/);
  assert.match(publicHelper, /currentPlatformActiveServiceCodes\([\s\S]*POLICY_JURISDICTION/);
  assert.match(publicHelper, /providerAccountFor\(result\.email\)/);
  assert.match(publicHelper, /parseProviderServices\(currentProvider\.approvedServices\)/);
  assert.match(publicHelper, /catch \{\s*return false;/);
  assert.ok(get.indexOf("providerCanReadPrivateMedia") < get.indexOf("providerIsPublic"));
  assert.match(get, /publicAccess \? "public, max-age=300" : "private, no-store"/);
});

test("profile edits remain private but publication requires live active services", async () => {
  const route = await source("app/api/provider-profile/route.ts");
  const helper = route.slice(
    route.indexOf("async function providerPublicDiscoveryAllowed"),
    route.indexOf("async function profileFor"),
  );
  const post = methodBlock(route, "POST");

  assert.match(helper, /runtimeMarketplaceActionAllowed\("discovery"\)/);
  assert.match(helper, /currentPlatformActiveServiceCodes\([\s\S]*POLICY_JURISDICTION/);
  assert.match(helper, /parseProviderServices\(provider\.approvedServices\)/);
  assert.match(route, /const canPublish =[\s\S]*await providerPublicDiscoveryAllowed\(provider\)/);
  assert.match(post, /publicStatus === "published"[\s\S]*await providerPublicDiscoveryAllowed\(provider\)/);
  assert.ok(post.indexOf("providerPublicDiscoveryAllowed(provider)") < post.indexOf("db.insert(providerProfiles)"));
  assert.match(post, /code: "MARKETPLACE_ONBOARDING_ONLY"/);
  assert.match(post, /"retry-after": "86400"/);
});

test("price guidance stops before historical-job queries and filters exact active scopes", async () => {
  const route = await source("app/api/price-guidance/route.ts");
  const get = methodBlock(route, "GET");

  assert.ok(get.indexOf('runtimeMarketplaceActionAllowed("discovery")') < get.indexOf("new URL(request.url)"));
  assert.ok(get.indexOf('runtimeMarketplaceActionAllowed("discovery")') < get.indexOf("getDb().select"));
  assert.ok(get.indexOf("activeServiceCodes.size === 0") < get.indexOf("getDb().select"));
  assert.match(get, /parseExactServiceCodes\(row\.serviceCodes\)/);
  assert.match(get, /row\.jurisdiction !== POLICY_JURISDICTION/);
  assert.match(get, /activeServiceCodes\.has\(serviceCodes\[0\]\)/);
  assert.match(route, /guidance: \[\]/);
  assert.match(route, /code: "MARKETPLACE_ONBOARDING_ONLY"/);
  assert.match(route, /"cache-control": "no-store"/);
});
