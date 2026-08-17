import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  areaServiceIsPublished,
  findLocalService,
  findPublishedServiceArea,
  findServiceArea,
  localPagePaths,
  LOCAL_PAGE_LAUNCH_NOTICE,
  LOCAL_SERVICES,
  publishedAreaServices,
  publishedAreasForService,
  publishedServicesForArea,
  PUBLISHED_SERVICE_AREAS,
  SERVICE_AREA_COVERAGE,
} from "../lib/local-service-areas.ts";
import {
  MONTGOMERY_COUNTY_MD_MUNICIPALITIES,
  MONTGOMERY_COUNTY_MD_ZIP_CODES,
} from "../lib/service-matching.ts";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const LOCAL_PAGE_FILES = [
  "app/service-areas/page.tsx",
  "app/service-areas/[area]/page.tsx",
  "app/service-areas/[area]/[service]/page.tsx",
  "app/services/page.tsx",
  "app/services/[service]/page.tsx",
];

// lib/provider-policy.ts loads a JSON config that the Node test runner cannot
// import without an import attribute, so the catalog is read out of the module
// source instead of through the module.
const serviceCodes = async () => {
  const policy = await source("lib/provider-policy.ts");
  const declaration = policy.match(/export const SERVICE_CODES = \[([\s\S]*?)\] as const;/);
  assert.ok(declaration, "could not read SERVICE_CODES from lib/provider-policy.ts");
  return [...declaration[1].matchAll(/"([a-z0-9_]+)"/g)].map((match) => match[1]);
};

test("the coverage map is real municipalities with covered ZIP codes", () => {
  assert.ok(SERVICE_AREA_COVERAGE.length > 0);
  for (const area of SERVICE_AREA_COVERAGE) {
    assert.ok(
      MONTGOMERY_COUNTY_MD_MUNICIPALITIES.includes(area.name),
      `${area.name} is not a known Montgomery County municipality`,
    );
    assert.ok(area.zipCodes.length > 0, `${area.name} lists no ZIP codes`);
    for (const zip of area.zipCodes) {
      assert.ok(
        MONTGOMERY_COUNTY_MD_ZIP_CODES.includes(zip),
        `${area.name} lists ZIP ${zip}, which Tuveloz does not cover`,
      );
    }
    assert.match(area.slug, /^[a-z0-9-]+$/);
  }
});

test("every local service maps to real routable service codes", async () => {
  const codes = await serviceCodes();
  assert.ok(LOCAL_SERVICES.length > 0);
  for (const service of LOCAL_SERVICES) {
    assert.ok(service.serviceCodes.length > 0);
    for (const code of service.serviceCodes) {
      assert.ok(codes.includes(code), `${service.name} references unknown code ${code}`);
    }
    assert.match(service.slug, /^[a-z0-9-]+$/);
    assert.ok(service.covered.length > 0);
    assert.ok(service.describeForQuote.length > 0);
  }
  const sections = await source("app/components/local-page-sections.tsx");
  assert.match(sections, /references unknown service code/);
});

/**
 * The doorway guard. An earlier revision multiplied 36 areas by 5 services and
 * published all 96 pages. These assertions exist so that shape cannot return by
 * accident: publication is an allowlist, and it is small.
 */
test("published pages are an allowlist, not a cross product", () => {
  const pairs = publishedAreaServices();
  assert.ok(
    pairs.length < PUBLISHED_SERVICE_AREAS.length * LOCAL_SERVICES.length,
    "every area × service combination is published — that is the doorway pattern",
  );

  const leafPages = LOCAL_SERVICES.length
    + PUBLISHED_SERVICE_AREAS.length
    + pairs.length;
  assert.ok(leafPages <= 20, `${leafPages} leaf pages exceeds the agreed ceiling`);

  // A published area must be part of the coverage map and carry its own copy.
  for (const area of PUBLISHED_SERVICE_AREAS) {
    assert.ok(SERVICE_AREA_COVERAGE.some((entry) => entry.slug === area.slug));
    assert.ok(area.localCopy?.trim(), `${area.name} has no copy written for it`);
    assert.ok(area.localCopy.length > 200, `${area.name} copy is too thin to justify a page`);
  }

  // Local copy must actually differ between areas, not be a template fill.
  const copies = PUBLISHED_SERVICE_AREAS.map((area) => area.localCopy);
  assert.equal(new Set(copies).size, copies.length, "two areas share identical copy");

  // Most of the coverage map deliberately has no page.
  assert.ok(
    PUBLISHED_SERVICE_AREAS.length < SERVICE_AREA_COVERAGE.length / 2,
    "most of the coverage map should not have its own page",
  );
});

test("publication lookups agree with each other and reject the unpublished", () => {
  for (const { area, service } of publishedAreaServices()) {
    assert.ok(areaServiceIsPublished(area.slug, service.slug));
    assert.equal(findPublishedServiceArea(area.slug)?.slug, area.slug);
    assert.equal(findLocalService(service.slug)?.slug, service.slug);
    assert.ok(publishedServicesForArea(area.slug).some((s) => s.slug === service.slug));
    assert.ok(publishedAreasForService(service.slug).some((a) => a.slug === area.slug));
  }

  // In the coverage map but not published: has no page of any kind.
  const unpublished = SERVICE_AREA_COVERAGE.find(
    (area) => !PUBLISHED_SERVICE_AREAS.some((entry) => entry.slug === area.slug),
  );
  assert.ok(unpublished, "expected at least one covered area without a page");
  assert.ok(findServiceArea(unpublished.slug), "should still be in the coverage map");
  assert.equal(findPublishedServiceArea(unpublished.slug), undefined);
  for (const service of LOCAL_SERVICES) {
    assert.equal(areaServiceIsPublished(unpublished.slug, service.slug), false);
  }

  assert.equal(findServiceArea("not-a-real-area"), undefined);
  assert.equal(findLocalService("not-a-real-service"), undefined);
});

test("the sitemap lists every published local page exactly once", async () => {
  const paths = localPagePaths();
  assert.equal(new Set(paths).size, paths.length, "duplicate local page path");
  assert.equal(
    paths.length,
    2 + LOCAL_SERVICES.length + PUBLISHED_SERVICE_AREAS.length + publishedAreaServices().length,
  );
  for (const path of paths) {
    assert.match(path, /^\/(service-areas|services)(\/[a-z0-9-]+){0,2}$/);
  }

  const sitemap = await source("app/sitemap.ts");
  assert.match(sitemap, /localPagePaths\(\)/);
  // SPANISH_PAGES sits between them now: the crawlable /es twins, derived from
  // SPANISH_READY_PATHS. What this line is really asserting is that the local
  // pages are still spread in rather than listed by hand.
  assert.match(sitemap, /\.\.\.PUBLIC_PAGES,\s*\.\.\.SPANISH_PAGES,\s*\.\.\.LOCAL_PAGES/);
});

test("local pages never imply customers can request or pay for work today", async () => {
  assert.match(LOCAL_PAGE_LAUNCH_NOTICE, /not open to customers yet/);
  assert.match(LOCAL_PAGE_LAUNCH_NOTICE, /cannot request work or pay for it here today/);

  const files = await Promise.all([
    source("lib/local-service-areas.ts"),
    source("app/components/local-page-sections.tsx"),
    ...LOCAL_PAGE_FILES.map(source),
  ]);

  for (const file of files) {
    assert.doesNotMatch(file, /\bbook now\b/i);
    assert.doesNotMatch(file, /\bavailable 24\/7\b/i);
    assert.doesNotMatch(file, /\btop[- ]rated\b/i);
    assert.doesNotMatch(file, /\btrusted local\b/i);
    assert.doesNotMatch(file, /\bnear you today\b/i);
    assert.doesNotMatch(file, /\bsame[- ]day\b/i);
  }
});

test("structured data claims nothing the marketplace cannot back", async () => {
  const sections = await source("app/components/local-page-sections.tsx");
  assert.match(sections, /"@type": "BreadcrumbList"/);
  assert.match(sections, /"@type": "Service"/);
  assert.doesNotMatch(sections, /aggregateRating/);
  assert.doesNotMatch(sections, /"@type": "Offer"/);
  assert.doesNotMatch(sections, /"@type": "LocalBusiness"/);
  assert.doesNotMatch(sections, /priceRange/);
});

test("every local page carries a canonical, breadcrumbs, the list and the application", async () => {
  const sections = await source("app/components/local-page-sections.tsx");
  assert.match(sections, /LaunchUpdatesForm/);
  assert.match(sections, /href="\/join"/);

  for (const path of LOCAL_PAGE_FILES) {
    const file = await source(path);
    assert.match(file, /<LocalLaunchPanel/, `${path} omits the notification form`);
    assert.match(file, /<LocalProviderPanel/, `${path} omits the provider call to action`);
    assert.match(file, /<LocalStructuredData/, `${path} omits breadcrumb structured data`);
    assert.match(file, /breadcrumbs=\{\[/, `${path} omits visible breadcrumbs`);
    assert.match(file, /alternates: \{ canonical:/, `${path} omits a canonical URL`);
  }
});

test("the notification form records which service and area was asked about", async () => {
  const sections = await source("app/components/local-page-sections.tsx");
  // The source string is the demand signal that decides what gets published next.
  assert.match(sections, /source=\{source\}|source=\{`/);

  const areaService = await source("app/service-areas/[area]/[service]/page.tsx");
  assert.match(areaService, /source=\{`service-area-\$\{area\.slug\}-\$\{service\.slug\}`\}/);
  const servicePage = await source("app/services/[service]/page.tsx");
  assert.match(servicePage, /source=\{`service-\$\{service\.slug\}`\}/);
});

test("the public site links to the hubs so they are crawlable", async () => {
  // The footer moved into the shared public chrome, so that is where the hub
  // links live for every public page rather than in the info-page shell alone.
  const [home, chrome] = await Promise.all([
    source("app/page.tsx"),
    source("app/components/public-chrome.tsx"),
  ]);
  for (const file of [home, chrome]) {
    assert.match(file, /href="\/service-areas"/);
    assert.match(file, /href="\/services"/);
  }
});

test("dynamic local routes reject unpublished slugs instead of rendering filler", async () => {
  const [areaPage, areaServicePage, servicePage] = await Promise.all([
    source("app/service-areas/[area]/page.tsx"),
    source("app/service-areas/[area]/[service]/page.tsx"),
    source("app/services/[service]/page.tsx"),
  ]);

  assert.match(areaPage, /if \(!area\) notFound\(\);/);
  assert.match(areaPage, /findPublishedServiceArea/);
  assert.match(areaServicePage, /areaServiceIsPublished\(areaSlug, serviceSlug\)\) notFound\(\);/);
  assert.match(servicePage, /if \(!service\) notFound\(\);/);

  for (const file of [areaPage, areaServicePage, servicePage]) {
    assert.match(file, /export function generateStaticParams/);
  }
});
