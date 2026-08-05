import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  providerProfileJsonLd,
  providerProfileUrl,
  providerQualifiesAsLocalBusiness,
  providerStructuredData,
} from "../lib/provider-structured-data.ts";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const MOBILE = {
  slug: "roadside-rob",
  businessName: "Roadside Rob",
  headline: "Mobile battery and diagnostics",
  workLocations: "I travel to customers",
  businessMunicipality: "Silver Spring",
  areas: ["Montgomery County, Maryland"],
  services: ["12V battery replacement"],
};

const SHOP = {
  ...MOBILE,
  slug: "kensington-auto",
  businessName: "Kensington Auto",
  workLocations: "Customers come to my business",
};

/**
 * The rule the whole module exists for. Google lists a physical address as
 * required for its LocalBusiness feature, and most providers here are mobile —
 * marking them up as a local business would mean omitting a required field or
 * publishing an address that was never meant to be public.
 */
test("only a shop with a visible address is marked up as a local business", () => {
  assert.equal(providerQualifiesAsLocalBusiness(MOBILE), false);
  assert.equal(providerStructuredData(MOBILE)["@type"], "Organization");
  assert.equal("address" in providerStructuredData(MOBILE), false);

  // A shop is still not a LocalBusiness while no address is rendered.
  assert.equal(providerQualifiesAsLocalBusiness(SHOP), false);
  assert.equal(providerStructuredData(SHOP)["@type"], "Organization");
  assert.equal("address" in providerStructuredData(SHOP), false);

  // Supplying an address the page actually shows flips it, and only then.
  const withAddress = { ...SHOP, publicAddress: "1 Example Ave" };
  assert.equal(providerQualifiesAsLocalBusiness(withAddress), true);
  const data = providerStructuredData(withAddress);
  assert.equal(data["@type"], "AutoRepair");
  assert.deepEqual(data.address, {
    "@type": "PostalAddress",
    streetAddress: "1 Example Ave",
    addressLocality: "Silver Spring",
    addressRegion: "MD",
    addressCountry: "US",
  });

  // A mobile provider never becomes a local business, address or not.
  assert.equal(
    providerQualifiesAsLocalBusiness({ ...MOBILE, publicAddress: "1 Example Ave" }),
    false,
  );

  // An empty or whitespace address is not an address.
  assert.equal(providerQualifiesAsLocalBusiness({ ...SHOP, publicAddress: "   " }), false);
});

test("no rating is claimed until published reviews exist", () => {
  assert.equal("aggregateRating" in providerStructuredData(MOBILE), false);
  assert.equal(
    "aggregateRating" in providerStructuredData({
      ...MOBILE,
      reviewSummary: { average: 0, count: 0 },
    }),
    false,
  );

  const rated = providerStructuredData({
    ...MOBILE,
    reviewSummary: { average: 4.6667, count: 3 },
  });
  assert.deepEqual(rated.aggregateRating, {
    "@type": "AggregateRating",
    ratingValue: 4.67,
    reviewCount: 3,
    bestRating: 5,
    worstRating: 1,
  });
});

test("the profile graph carries a breadcrumb back through the directory", () => {
  const graph = providerProfileJsonLd(MOBILE);
  assert.equal(graph["@context"], "https://schema.org");
  const [breadcrumb, business] = graph["@graph"];
  assert.equal(breadcrumb["@type"], "BreadcrumbList");
  assert.deepEqual(
    breadcrumb.itemListElement.map((item) => item.item),
    ["https://tuveloz.com", "https://tuveloz.com/providers", providerProfileUrl(MOBILE.slug)],
  );
  assert.equal(business["@type"], "Organization");
  assert.equal(business.url, "https://tuveloz.com/providers/roadside-rob");
  // Services are offered without a price: the provider sets it per job.
  assert.equal(business.makesOffer[0].itemOffered.name, "12V battery replacement");
  assert.equal("price" in business.makesOffer[0], false);
});

/**
 * The directory must not become a way around the discovery control that closes
 * individual provider profiles pre-launch.
 */
test("the directory is gated on the same discovery action as a single profile", async () => {
  const [directory, profile] = await Promise.all([
    source("app/api/public-provider-directory/route.ts"),
    source("app/api/public-provider/route.ts"),
  ]);

  for (const file of [directory, profile]) {
    assert.match(file, /runtimeMarketplaceActionAllowed\("discovery"\)/);
  }

  // The gate runs before any provider row is read, and returns no data with it.
  assert.ok(
    directory.indexOf('runtimeMarketplaceActionAllowed("discovery")')
      < directory.indexOf("db.select("),
    "the directory queries providers before checking the discovery gate",
  );
  assert.match(directory, /providers: \[\]/);
  assert.match(directory, /status: 503/);
});

test("the directory applies every condition the single-profile gate applies", async () => {
  const directory = await source("app/api/public-provider-directory/route.ts");
  for (const condition of [
    /providerProfiles\.publicStatus, "published"/,
    /providerApplications\.status, "approved"/,
    /providerApplications\.verificationStatus, "verified"/,
    /providerApplications\.isTestProvider, "no"/,
    /providerProfileHasCurrentContentApproval/,
    /providerCredentialRequirementsAreSatisfied/,
    /currentPlatformActiveServiceCodes/,
    /providerAccountFor/,
  ]) {
    assert.match(directory, condition, `directory is missing gate condition ${condition}`);
  }
});

test("profile markup is withheld from drafts and test providers", async () => {
  const page = await source("app/providers/[slug]/page.tsx");
  assert.match(page, /data\.privatePreview \|\| data\.testProvider/);
  assert.match(page, /providerProfileJsonLd\(/);
  // No address is passed, because none is rendered on the page.
  assert.doesNotMatch(page, /publicAddress:/);
});

test("the directory is linked and listed, and profile URLs are not listed", async () => {
  const [home, infoPage, sitemap, robots] = await Promise.all([
    source("app/page.tsx"),
    source("app/components/public-info-page.tsx"),
    source("app/sitemap.ts"),
    source("app/robots.ts"),
  ]);

  // Linked from every public footer — a sitemap entry is not internal linking.
  for (const file of [home, infoPage]) {
    assert.match(file, /href="\/providers"/);
  }
  assert.match(sitemap, /path: "\/providers"/);
  // Individual profiles return 503 while discovery is closed, so they stay out.
  assert.doesNotMatch(sitemap, /\/providers\/\$\{/);
  // The directory must not be blocked from crawling.
  assert.doesNotMatch(robots, /"\/providers"/);
});

test("the directory page explains the closed state instead of showing an empty list", async () => {
  const page = await source("app/providers/page.tsx");
  assert.match(page, /response\.status === 503/);
  assert.match(page, /not public yet/i);
  // Listing order must not read as a ranking.
  assert.match(page, /alphabetically/i);
  assert.doesNotMatch(page, /\btop[- ]rated\b/i);
  assert.doesNotMatch(page, /\bbest\b/i);
});
