import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("provider pages are server-rendered for search with public-only data", async () => {
  const [page, client, access] = await Promise.all([
    read("app/providers/[slug]/page.tsx"),
    read("app/providers/[slug]/provider-storefront-client.tsx"),
    read("lib/public-provider-page.ts"),
  ]);

  assert.ok(page.includes("export async function generateMetadata"));
  assert.ok(page.includes("publicProviderSummary"));
  assert.match(page, /alternates: \{ canonical \}/);
  // A page the marketplace would not serve must never be indexed.
  assert.match(page, /if \(!summary\) \{[\s\S]*robots: \{ index: false, follow: false \}/);

  assert.ok(page.includes('"@type": "AutomotiveBusiness"'));
  assert.ok(page.includes('"@type": "AggregateRating"'));
  assert.ok(page.includes('"@type": "BreadcrumbList"'));
  // Ratings are published only when real completed-job reviews exist.
  assert.match(page, /if \(summary\.reviewSummary\.count > 0\) \{[\s\S]*aggregateRating/);
  // Structured data must not invent a verification or endorsement claim.
  for (const overclaim of ["Verified", "certified", "licensed provider", "endorsed"]) {
    assert.ok(!page.includes(overclaim), `provider structured data must not claim ${overclaim}`);
  }

  assert.ok(client.startsWith('"use client"'));
  assert.ok(client.includes("ProviderStorefrontClient"));

  // Metadata and the sitemap reuse the API's access rule rather than a copy.
  assert.ok(access.includes("export async function evaluateProviderPublicAccess"));
  assert.match(access, /publicProviderSummary[\s\S]*runtimeMarketplaceActionAllowed\("discovery"\)/);
  assert.match(access, /publicProviderSitemapEntries[\s\S]*runtimeMarketplaceActionAllowed\("discovery"\)/);
  // Metadata rendering and crawlers must not inflate the profile view counter.
  assert.ok(!access.includes("profileViewCount"));
});

test("sitemap advertises only pages that are actually public", async () => {
  const sitemap = await read("app/sitemap.ts");

  assert.ok(sitemap.includes("export default async function sitemap"));
  assert.ok(sitemap.includes("publicProviderSitemapEntries"));
  assert.ok(sitemap.includes("SERVICE_LANDING_PAGES"));
  assert.ok(sitemap.includes("TOWN_LANDING_PAGES"));
  // A database failure must not take down the whole sitemap.
  assert.match(sitemap, /try \{[\s\S]*publicProviderSitemapEntries\(\)[\s\S]*\} catch/);
});

test("landing pages rank locally without promising a launch that has not happened", async () => {
  const [landing, servicePage, areaPage, shell] = await Promise.all([
    read("lib/local-landing-pages.ts"),
    read("app/services/[slug]/page.tsx"),
    read("app/areas/[slug]/page.tsx"),
    read("app/components/local-landing-page.tsx"),
  ]);

  assert.ok(servicePage.includes("export function generateStaticParams"));
  assert.ok(areaPage.includes("export function generateStaticParams"));
  assert.ok(servicePage.includes('"@type": "FAQPage"'));
  assert.ok(areaPage.includes('"@type": "FAQPage"'));
  assert.ok(servicePage.includes('"@type": "Service"'));
  assert.match(servicePage, /alternates: \{ canonical \}/);
  assert.match(areaPage, /alternates: \{ canonical \}/);

  // Every landing page states the real launch position and offers the two
  // things a visitor can actually do today.
  assert.ok(shell.includes("Customer service requests, quotes, and\n            payments are not available yet"));
  assert.ok(shell.includes("LaunchUpdatesForm"));
  assert.ok(shell.includes('href="/join"'));

  // Honesty rules carried over from the outreach kit.
  for (const banned of [
    "book now",
    "Book now",
    "guaranteed income",
    "earn up to",
    "same-day guaranteed",
  ]) {
    assert.ok(!landing.includes(banned), `landing copy must not say "${banned}"`);
  }
  assert.ok(landing.includes("suggests, or marks up a provider's price"));
  assert.ok(landing.includes("Providers keep 100% of what they quote."));
  assert.match(landing, /LAUNCH_STATUS_ANSWER[\s\S]*Customer requests, quotes, and payments are turned off/);
  // Pre-purchase inspection must never read as a state safety inspection.
  assert.ok(landing.includes("not an official Maryland State Police vehicle safety inspection"));
});

test("public FAQ publishes structured answers", async () => {
  const faq = await read("app/faq/page.tsx");

  assert.ok(faq.includes('"@type": "FAQPage"'));
  assert.ok(faq.includes("FAQ_SECTIONS.map"));
  // The schema is generated from the rendered sections, so the two cannot drift.
  assert.match(faq, /sections=\{FAQ_SECTIONS\}/);
});
