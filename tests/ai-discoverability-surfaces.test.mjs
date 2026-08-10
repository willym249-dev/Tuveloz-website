import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

function sitemapPaths(sitemapSource) {
  return [...sitemapSource.matchAll(/\{ path: "([^"]+)"/g)].map((match) => match[1]);
}

test("llms.txt states the launch state and fee from the same source the app uses", async () => {
  const route = await source("app/llms.txt/route.ts");

  assert.match(route, /from "\.\.\/\.\.\/lib\/customer-fee"/);
  assert.match(route, /CUSTOMER_SERVICE_FEE_PERCENT/);
  assert.match(route, /CUSTOMER_JOB_POSTING_PAUSED/);
  assert.match(route, /MARKETPLACE_MODE/);

  // The fee is added to the customer's total and never taken out of the quote.
  // tests/customer-fee-consistency.test.mjs scans all of app/ for the legacy
  // claim; this only asserts the positive contract is actually stated here.
  assert.match(route, /Providers keep 100% of what they quote/);
  assert.match(route, /added to the customer's total/);
  assert.match(route, /never\n\s*deducted from provider earnings/);

  // A paused marketplace must not be described as bookable.
  assert.match(route, /customerRequestsOpen/);
  assert.match(route, /are NOT open/);

  assert.match(route, /"content-type": "text\/plain; charset=utf-8"/);
});

test("every indexable page declares its own canonical URL", async () => {
  const sitemap = await source("app/sitemap.ts");
  const paths = sitemapPaths(sitemap);
  assert.ok(paths.length > 10, "the sitemap should still list the public pages");

  for (const path of paths) {
    if (path === "/") {
      // The homepage is a client component; its canonical comes from the root
      // layout, which is also the inherited default for anything unlisted.
      const rootLayout = await source("app/layout.tsx");
      assert.match(rootLayout, /canonical: "\/"/);
      continue;
    }
    const directory = path.slice(1);
    const [page, layout] = await Promise.all([
      source(`app/${directory}/page.tsx`).catch(() => ""),
      source(`app/${directory}/layout.tsx`).catch(() => ""),
    ]);
    const declared = `${page}\n${layout}`;
    assert.match(
      declared,
      new RegExp(`canonical: "${path}"`),
      `${path} inherits the homepage canonical instead of declaring its own`,
    );
    assert.match(
      declared,
      /description:/,
      `${path} has no description of its own`,
    );
  }
});

test("released policy pages take their metadata from a layout, not the pinned file", async () => {
  const manifest = JSON.parse(await source("config/policy-releases.json"));

  for (const [key, release] of Object.entries(manifest)) {
    if (release.releaseStatus !== "active") continue;
    const page = await source(release.sourceFile);
    assert.doesNotMatch(
      page,
      /export const metadata/,
      `${key} puts metadata in ${release.sourceFile}, which is pinned to a reviewed hash`,
    );
    const layout = release.sourceFile.replace(/page\.tsx$/, "layout.tsx");
    assert.match(
      await source(layout),
      /export const metadata: Metadata = \{/,
      `${key} has no metadata layout beside its pinned page`,
    );
  }
});

test("crawlers are told about provider profiles only while discovery is allowed", async () => {
  const directory = await source("lib/public-provider-directory.ts");

  for (const exported of ["publicProviderDirectory", "publicProviderDirectoryEntry"]) {
    const start = directory.indexOf(`export async function ${exported}`);
    assert.notEqual(start, -1, `${exported} was not found`);
    const block = directory.slice(start, start + 900);
    const gate = block.indexOf('runtimeMarketplaceActionAllowed("discovery")');
    assert.notEqual(gate, -1, `${exported} does not check the discovery gate`);
    const firstQuery = block.indexOf("publishedRows(");
    assert.ok(
      firstQuery === -1 || gate < firstQuery,
      `${exported} queries provider rows before checking the discovery gate`,
    );
  }

  // The same conditions the public API applies before serving a profile.
  assert.match(directory, /publicStatus !== "published"/);
  assert.match(directory, /status !== "approved"/);
  assert.match(directory, /verificationStatus !== "verified"/);
  assert.match(directory, /isTestProvider !== "no"/);
  assert.match(directory, /providerProfileHasCurrentContentApproval/);
  assert.match(directory, /providerCredentialRequirementsAreSatisfied/);
  assert.match(directory, /currentPlatformActiveServiceCodes/);
});

test("the sitemap and provider profile pages read from that one directory", async () => {
  const [sitemap, layout] = await Promise.all([
    source("app/sitemap.ts"),
    source("app/providers/[slug]/layout.tsx"),
  ]);

  assert.match(sitemap, /publicProviderDirectory\(\)/);
  assert.match(sitemap, /export const dynamic = "force-dynamic"/);

  assert.match(layout, /publicProviderDirectoryEntry\(slug\)/);
  assert.match(layout, /"@type": "AutomotiveBusiness"/);
  // A profile that is not public yet is never described to a crawler.
  assert.match(layout, /robots: \{ index: false, follow: false \}/);
  assert.match(layout, /\{entry && \(/);
  // Review scores and credential records carry dated limits on the page that
  // structured data cannot express, so they stay out of it.
  assert.doesNotMatch(layout, /aggregateRating/);
});
