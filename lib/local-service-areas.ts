/**
 * Local service-area pages.
 *
 * Search for vehicle help is local and specific — "battery replacement Silver
 * Spring", not "vehicle services marketplace". Ranking takes months to accrue,
 * so the pages have to exist before the marketplace opens or launch day starts
 * at zero organic traffic.
 *
 * Three rules govern everything here.
 *
 * 1. Publication is an allowlist, never a cross product. An earlier revision
 *    generated every area × service combination — 96 pages, template-varied,
 *    all funnelling to the same two calls to action. That is the shape Google
 *    describes as doorway abuse, and it is a shape a data file produces by
 *    accident the moment two lists get multiplied together. PUBLISHED_AREA_SERVICES
 *    below is therefore an explicit list of pairs. Adding one is a deliberate
 *    act, taken when the launch-list signal shows real demand and real provider
 *    coverage for that pair — not something that happens because an area was
 *    added to the coverage map.
 *
 * 2. Nothing may imply a customer can request or pay for work today. Customer
 *    requests are closed (lib/launch-status.ts) and these pages are indexed, so
 *    they are the easiest place in the codebase to publish a promise the
 *    marketplace cannot keep. Every page restates the real status.
 *
 * 3. No invented local facts and no invented provider counts. A page says only
 *    what is verifiable: the ZIP codes Tuveloz covers for an area, what a
 *    service actually includes, and how the marketplace is designed to work.
 *    The usual local-SEO boilerplate about vetted mechanics and guaranteed
 *    turnaround is exactly what this file must never generate — there are no
 *    completed jobs to back any of it, and tests/local-service-areas.test.mjs
 *    fails the build if it appears.
 *
 * The coverage map keeps all 36 municipalities because that is true and useful
 * on the hub. Only the areas in PUBLISHED_SERVICE_AREAS get their own page.
 */

// Imported with an explicit extension so this module can be loaded directly by
// the Node test runner as well as by the bundler. It deliberately depends on
// nothing else: lib/provider-policy.ts pulls in a JSON config that Node cannot
// load without an import attribute, so the service-code cross-check lives in
// app/components/local-page-sections.tsx instead — where every local page
// imports it and a drifted code fails the build, exactly as on the homepage.
import {
  MONTGOMERY_COUNTY_MD_MUNICIPALITIES,
  MONTGOMERY_COUNTY_MD_ZIP_CODES,
  CURRENT_LAUNCH_AREA,
} from "./service-matching.ts";

export const LOCAL_AREA_STATE = "Maryland";
export const LOCAL_AREA_STATE_ABBREVIATION = "MD";
export const LOCAL_AREA_COUNTY = "Montgomery County";

export type ServiceAreaDefinition = {
  slug: string;
  /** Must match an entry in MONTGOMERY_COUNTY_MD_MUNICIPALITIES. */
  name: string;
  /**
   * ZIP codes Tuveloz treats as part of this area. Checked against
   * MONTGOMERY_COUNTY_MD_ZIP_CODES below so it cannot drift from the ZIPs the
   * request form already accepts. Postal boundaries and place names overlap
   * here — several areas legitimately share a ZIP — so pages describe these as
   * Tuveloz's coverage for the area, never as an official boundary.
   */
  zipCodes: readonly string[];
  /**
   * Written per area rather than generated from a template. With a short
   * published list this is affordable, and it is the difference between a page
   * that earns its place and one that is the previous page with a name
   * swapped. Anything here must be verifiable — access and parking reality,
   * and how the area sits in the county. No claims about providers.
   */
  localCopy?: string;
};

/**
 * The full coverage map: every municipality the launch area includes. Listed on
 * the hub as a coverage statement. Having an entry here does NOT create a page.
 */
const AREAS: readonly ServiceAreaDefinition[] = [
  { slug: "aspen-hill", name: "Aspen Hill", zipCodes: ["20853", "20906"] },
  { slug: "barnesville", name: "Barnesville", zipCodes: ["20838"] },
  {
    slug: "bethesda",
    name: "Bethesda",
    zipCodes: ["20814", "20816", "20817"],
    localCopy:
      "Bethesda is dense and close-in, and the parking reflects it: condominium and apartment garages, permit blocks, and a good deal of underground parking with height limits that a service van cannot always clear. When customer requests open, the detail worth putting in a request is not just the address but where the vehicle actually sits — a level and space number, a visitor bay, or a surface lot — because on this side of the county that is usually what decides whether a provider can reach the vehicle at all.",
  },
  { slug: "boyds", name: "Boyds", zipCodes: ["20841"] },
  { slug: "brookeville", name: "Brookeville", zipCodes: ["20833"] },
  { slug: "burtonsville", name: "Burtonsville", zipCodes: ["20866"] },
  { slug: "cabin-john", name: "Cabin John", zipCodes: ["20818"] },
  { slug: "chevy-chase", name: "Chevy Chase", zipCodes: ["20815"] },
  { slug: "clarksburg", name: "Clarksburg", zipCodes: ["20871"] },
  { slug: "colesville", name: "Colesville", zipCodes: ["20904", "20905"] },
  { slug: "damascus", name: "Damascus", zipCodes: ["20872"] },
  { slug: "darnestown", name: "Darnestown", zipCodes: ["20874", "20878"] },
  { slug: "derwood", name: "Derwood", zipCodes: ["20855"] },
  { slug: "four-corners", name: "Four Corners", zipCodes: ["20901", "20903"] },
  { slug: "friendship-heights", name: "Friendship Heights", zipCodes: ["20815"] },
  {
    slug: "gaithersburg",
    name: "Gaithersburg",
    zipCodes: ["20877", "20878", "20879", "20882"],
    localCopy:
      "Gaithersburg is one of the county's largest incorporated cities and spreads across four ZIP codes, which is the practical thing to know here: two addresses both described as Gaithersburg can sit a long way apart, and a provider covering one end is not automatically covering the other. When customer requests open, the ZIP and cross street matter more here than in the compact areas — they are what tells a provider whether the stop actually fits their day.",
  },
  { slug: "garrett-park", name: "Garrett Park", zipCodes: ["20896"] },
  {
    slug: "germantown",
    name: "Germantown",
    zipCodes: ["20874", "20876"],
    localCopy:
      "Germantown is largely planned development, which means a lot of townhouse clusters, shared surface lots, and assigned spaces rather than individual driveways. The useful detail in a request is the cluster or building and the space, since numbered addresses in these developments are often not visible from where a provider parks. Its two ZIP codes also reach well out toward the up-county, so travel distance varies more than the single place name suggests.",
  },
  { slug: "glenmont", name: "Glenmont", zipCodes: ["20902", "20906"] },
  { slug: "hillandale", name: "Hillandale", zipCodes: ["20903", "20904"] },
  { slug: "kensington", name: "Kensington", zipCodes: ["20895"] },
  { slug: "laytonsville", name: "Laytonsville", zipCodes: ["20882"] },
  { slug: "montgomery-village", name: "Montgomery Village", zipCodes: ["20886"] },
  { slug: "north-bethesda", name: "North Bethesda", zipCodes: ["20852", "20817"] },
  { slug: "north-potomac", name: "North Potomac", zipCodes: ["20878"] },
  { slug: "olney", name: "Olney", zipCodes: ["20832"] },
  { slug: "poolesville", name: "Poolesville", zipCodes: ["20837"] },
  { slug: "potomac", name: "Potomac", zipCodes: ["20854"] },
  {
    slug: "rockville",
    name: "Rockville",
    zipCodes: ["20850", "20851", "20852", "20853"],
    localCopy:
      "Rockville is the county seat and mixes a dense centre with older residential streets, so the access situation changes considerably across its four ZIP codes: structured garages and permit parking toward the middle, private driveways further out. When customer requests open, saying which of those a vehicle is in saves a round of questions — it is the difference between a provider planning a stop and a provider guessing at one.",
  },
  { slug: "sandy-spring", name: "Sandy Spring", zipCodes: ["20860", "20861", "20862"] },
  {
    slug: "silver-spring",
    name: "Silver Spring",
    zipCodes: ["20901", "20902", "20903", "20904", "20905", "20906", "20910"],
    localCopy:
      "Silver Spring covers seven ZIP codes and is the least uniform area in the county — a dense, built-up centre near the District line, and quieter residential streets further out. A great deal of the parking is apartment and condominium lots, permit blocks, and shared garages. When customer requests open, the space, level, or visitor bay is the detail that matters most, because here it usually decides whether a provider can physically get to the vehicle.",
  },
  { slug: "takoma-park", name: "Takoma Park", zipCodes: ["20912"] },
  { slug: "travilah", name: "Travilah", zipCodes: ["20850", "20854"] },
  { slug: "washington-grove", name: "Washington Grove", zipCodes: ["20880"] },
  { slug: "wheaton", name: "Wheaton", zipCodes: ["20902", "20906"] },
  { slug: "white-oak", name: "White Oak", zipCodes: ["20903", "20904"] },
] as const;

/**
 * Areas with their own page. Deliberately short. An area qualifies by having
 * written local copy that stands on its own — not by being large, and not by
 * being present in the coverage map.
 */
const PUBLISHED_AREA_SLUGS: readonly string[] = [
  "silver-spring",
  "rockville",
  "bethesda",
  "gaithersburg",
  "germantown",
];

export type LocalServiceDefinition = {
  slug: string;
  /** Short label for navigation and cards. */
  name: string;
  /** How someone actually searches for this, used in titles. */
  searchName: string;
  summary: string;
  /** What the service does and does not cover, in plain language. */
  covered: readonly string[];
  /** What to have ready so a future request is quotable without phone tag. */
  describeForQuote: readonly string[];
  /** Why a provider would want this work — these pages recruit too. */
  providerNote: string;
  /**
   * Real entries from lib/provider-policy.ts's catalog, cross-checked at the
   * app layer so a public page can never advertise unroutable work.
   */
  serviceCodes: readonly string[];
};

/**
 * The launch services only — the same easy-entry, no-license set the homepage
 * shows. Specialised work (tyres, A/C, towing) stays off these pages until it
 * clears launch review, for the same reason it stays off the homepage.
 */
const SERVICES: readonly LocalServiceDefinition[] = [
  {
    slug: "battery-replacement",
    name: "Battery & jump start",
    searchName: "Car battery replacement and jump start",
    summary:
      "A dead battery is the most common reason a vehicle will not start. This covers a jump start to get moving again, and replacing a 12-volt battery that will no longer hold a charge.",
    covered: [
      "Jump starting a vehicle with a discharged 12-volt battery.",
      "Testing whether the battery still holds a charge, or whether it is the charging system at fault.",
      "Replacing a standard 12-volt battery and cleaning up corroded terminals.",
      "Not covered at launch: hybrid and electric-vehicle traction batteries, which are high-voltage work.",
    ],
    describeForQuote: [
      "Whether the vehicle turns over slowly, clicks, or does nothing at all.",
      "Whether the lights and dashboard come on.",
      "Whether it has been jump started recently, and how long it ran afterwards.",
      "The year, make, and model — battery size and location vary by vehicle.",
    ],
    providerNote:
      "Short, self-contained jobs that fit between longer appointments, with a part that is straightforward to source once the vehicle is known.",
    serviceCodes: ["provisional_12v_jump_start", "provisional_12v_battery_replacement"],
  },
  {
    slug: "wiper-and-bulb-replacement",
    name: "Wipers & bulbs",
    searchName: "Wiper blade and bulb replacement",
    summary:
      "Worn wiper blades and burnt-out exterior bulbs are small jobs that fail an inspection and make driving in rain or at night worse than it needs to be.",
    covered: [
      "Replacing front and rear wiper blades.",
      "Replacing burnt-out headlight, tail light, brake light, turn signal, and marker bulbs.",
      "Checking that the replacement actually works before the job is finished.",
      "Not covered at launch: sealed LED assemblies and headlight units that require removing body panels.",
    ],
    describeForQuote: [
      "Which bulb or blade is out — front, rear, left, right.",
      "Whether more than one is out at the same time, which can point at a fuse instead of a bulb.",
      "The year, make, and model, so the right blade length and bulb type can be lined up.",
      "Whether you are supplying the part or want the provider to.",
    ],
    providerNote:
      "Quick work that pairs well with another job at the same stop, and an easy first completed job on a new profile.",
    serviceCodes: [
      "provisional_wiper_blade_replacement",
      "provisional_conventional_bulb_replacement",
    ],
  },
  {
    slug: "fluid-top-off",
    name: "Top off fluids",
    searchName: "Vehicle fluid top-off",
    summary:
      "A limited top-up of the fluids that are safe to add without opening a sealed system — the routine check that keeps a low-fluid warning from turning into a repair.",
    covered: [
      "Topping up washer fluid, coolant reservoir, and engine oil to the correct level.",
      "Reporting what was low, and by how much.",
      "Not covered at launch: flushes, drain-and-fill services, brake fluid, and anything requiring a sealed system to be opened.",
      "A fluid that is repeatedly low is a leak, not a top-up. Providers are expected to say so rather than keep refilling it.",
    ],
    describeForQuote: [
      "Which fluid is low, and which warning light came on.",
      "Whether you have seen anything on the ground where the vehicle parks.",
      "When it was last topped up or serviced.",
      "The year, make, and model, so the correct specification is used.",
    ],
    providerNote:
      "Straightforward on-site work, and often the visit where a provider spots the job the customer did not know they needed.",
    serviceCodes: ["provisional_fluid_topoff_limited"],
  },
  {
    slug: "car-cleaning",
    name: "Car cleaning",
    searchName: "Car cleaning and detailing",
    summary:
      "An exterior wash, an interior clean, or both — done where the vehicle already is rather than by waiting in line at a bay.",
    covered: [
      "Exterior hand washing and drying.",
      "Interior vacuuming, wiping down surfaces, and cleaning glass.",
      "Combined inside-and-out cleaning as one appointment.",
      "Not covered at launch: paint correction, ceramic coating, and engine-bay cleaning.",
    ],
    describeForQuote: [
      "Inside, outside, or both.",
      "The size of the vehicle — a compact car and a three-row SUV are not the same job.",
      "Anything specific to deal with, such as pet hair, spills, or heavy road salt.",
      "Whether water and power are available where the vehicle is parked.",
    ],
    providerNote:
      "Longer bookings with pricing set by scope rather than by parts, and the work most likely to bring the same customer back.",
    serviceCodes: ["provisional_basic_detailing"],
  },
  {
    slug: "vehicle-diagnostics",
    name: "Find out what's wrong",
    searchName: "On-site vehicle diagnostics",
    summary:
      "A warning light or a new noise, checked on-site so you find out what is actually going on before committing to a repair.",
    covered: [
      "Reading and reporting stored diagnostic trouble codes.",
      "A visual, on-site check of what the vehicle is doing.",
      "A written description of what was found, so you can decide what to do next.",
      "A code is a starting point, not a diagnosis. A provider reporting a code has not promised a repair price.",
    ],
    describeForQuote: [
      "Which warning light is on, and whether it is steady or flashing.",
      "What changed, and when you first noticed it.",
      "Whether it happens cold, warm, at speed, or when braking or turning.",
      "The year, make, and model.",
    ],
    providerNote:
      "The job that most often leads to the next one, and the clearest place for a provider to show judgement rather than just price.",
    serviceCodes: ["provisional_obd_read_only", "basic_vehicle_diagnostics"],
  },
] as const;

/**
 * The area × service pages that exist. An explicit allowlist, not a product of
 * the two lists above — see rule 1 at the top of this file.
 *
 * Starting set: battery work in the five published areas. It is the launch
 * service with the clearest, most urgent search intent, which makes it the
 * honest first test of whether these pages earn anything. Everything else waits
 * for the launch-list signal to show demand and provider coverage for a
 * specific pair.
 */
const PUBLISHED_AREA_SERVICES: readonly { area: string; service: string }[] = [
  { area: "silver-spring", service: "battery-replacement" },
  { area: "rockville", service: "battery-replacement" },
  { area: "bethesda", service: "battery-replacement" },
  { area: "gaithersburg", service: "battery-replacement" },
  { area: "germantown", service: "battery-replacement" },
] as const;

/**
 * Fail the build rather than publish a page that has drifted from the data it
 * claims to describe, or quietly grow past the size that keeps these pages
 * defensible.
 */
const MAX_PUBLISHED_LEAF_PAGES = 20;

function assertDataIntegrity() {
  const municipalities: readonly string[] = MONTGOMERY_COUNTY_MD_MUNICIPALITIES;
  const zipCodes: readonly string[] = MONTGOMERY_COUNTY_MD_ZIP_CODES;
  const areaSlugs = new Set(AREAS.map((area) => area.slug));

  if (areaSlugs.size !== AREAS.length) {
    throw new Error("Service areas contain a duplicate slug.");
  }
  for (const area of AREAS) {
    if (!municipalities.includes(area.name)) {
      throw new Error(`Service area "${area.name}" is not a known Montgomery County municipality.`);
    }
    if (area.zipCodes.length === 0) {
      throw new Error(`Service area "${area.name}" lists no ZIP codes.`);
    }
    for (const zip of area.zipCodes) {
      if (!zipCodes.includes(zip)) {
        throw new Error(`Service area "${area.name}" lists ZIP ${zip}, which Tuveloz does not cover.`);
      }
    }
  }

  const serviceSlugs = new Set(SERVICES.map((service) => service.slug));
  if (serviceSlugs.size !== SERVICES.length) {
    throw new Error("Local services contain a duplicate slug.");
  }
  for (const service of SERVICES) {
    if (service.serviceCodes.length === 0) {
      throw new Error(`Local service "${service.name}" lists no service codes.`);
    }
  }

  // A published area must carry copy written for it. Without that it is the
  // previous page with the name swapped, which is the thing to avoid.
  for (const slug of PUBLISHED_AREA_SLUGS) {
    const area = AREAS.find((entry) => entry.slug === slug);
    if (!area) throw new Error(`Published area "${slug}" is not in the coverage map.`);
    if (!area.localCopy?.trim()) {
      throw new Error(`Published area "${area.name}" has no local copy written for it.`);
    }
  }

  const seen = new Set<string>();
  for (const pair of PUBLISHED_AREA_SERVICES) {
    const key = `${pair.area}/${pair.service}`;
    if (seen.has(key)) throw new Error(`Duplicate published pair ${key}.`);
    seen.add(key);
    if (!PUBLISHED_AREA_SLUGS.includes(pair.area)) {
      throw new Error(`Published pair ${key} names an area that has no page of its own.`);
    }
    if (!serviceSlugs.has(pair.service)) {
      throw new Error(`Published pair ${key} names an unknown service.`);
    }
  }

  const leafPages = SERVICES.length + PUBLISHED_AREA_SLUGS.length + PUBLISHED_AREA_SERVICES.length;
  if (leafPages > MAX_PUBLISHED_LEAF_PAGES) {
    throw new Error(
      `${leafPages} local leaf pages exceeds the ${MAX_PUBLISHED_LEAF_PAGES}-page ceiling. `
      + "Expanding past this is a deliberate decision that needs demand and coverage evidence, "
      + "not a data edit — raise the ceiling on purpose or publish fewer pages.",
    );
  }
}

assertDataIntegrity();

/** Every municipality in the launch area. Coverage statement, not pages. */
export const SERVICE_AREA_COVERAGE = AREAS;
export const LOCAL_SERVICES = SERVICES;

/** The areas that have a page. */
export const PUBLISHED_SERVICE_AREAS = AREAS.filter(
  (area) => PUBLISHED_AREA_SLUGS.includes(area.slug),
);

export function findServiceArea(slug: string) {
  return AREAS.find((area) => area.slug === slug);
}

export function findPublishedServiceArea(slug: string) {
  return PUBLISHED_SERVICE_AREAS.find((area) => area.slug === slug);
}

export function findLocalService(slug: string) {
  return SERVICES.find((service) => service.slug === slug);
}

/** Whether an area × service page exists. Consulted by routing and the sitemap. */
export function areaServiceIsPublished(areaSlug: string, serviceSlug: string) {
  return PUBLISHED_AREA_SERVICES.some(
    (pair) => pair.area === areaSlug && pair.service === serviceSlug,
  );
}

/** The published pairs, resolved. Single source for routing, params, sitemap. */
export function publishedAreaServices() {
  return PUBLISHED_AREA_SERVICES.map((pair) => ({
    area: findServiceArea(pair.area)!,
    service: findLocalService(pair.service)!,
  }));
}

/** Services with a page for a given area. */
export function publishedServicesForArea(areaSlug: string) {
  return PUBLISHED_AREA_SERVICES
    .filter((pair) => pair.area === areaSlug)
    .map((pair) => findLocalService(pair.service)!);
}

/** Areas with a page for a given service. */
export function publishedAreasForService(serviceSlug: string) {
  return PUBLISHED_AREA_SERVICES
    .filter((pair) => pair.service === serviceSlug)
    .map((pair) => findServiceArea(pair.area)!);
}

export function areaPath(area: Pick<ServiceAreaDefinition, "slug">) {
  return `/service-areas/${area.slug}`;
}

export function servicePath(service: Pick<LocalServiceDefinition, "slug">) {
  return `/services/${service.slug}`;
}

export function areaServicePath(
  area: Pick<ServiceAreaDefinition, "slug">,
  service: Pick<LocalServiceDefinition, "slug">,
) {
  return `/service-areas/${area.slug}/${service.slug}`;
}

/** "Rockville, MD" — the form a person recognises in a title. */
export function areaLabel(area: Pick<ServiceAreaDefinition, "name">) {
  return `${area.name}, ${LOCAL_AREA_STATE_ABBREVIATION}`;
}

/** Every public URL these pages add, for the sitemap. */
export function localPagePaths() {
  return [
    "/service-areas",
    "/services",
    ...SERVICES.map((service) => servicePath(service)),
    ...PUBLISHED_SERVICE_AREAS.map((area) => areaPath(area)),
    ...publishedAreaServices().map(({ area, service }) => areaServicePath(area, service)),
  ];
}

/**
 * The launch status, restated in full on every generated page. Repeated rather
 * than linked because a visitor arriving from a search result has not seen the
 * homepage and has no reason to assume the marketplace is closed.
 */
export const LOCAL_PAGE_LAUNCH_NOTICE =
  `Tuveloz is not open to customers yet. You cannot request work or pay for it here today — provider applications in ${CURRENT_LAUNCH_AREA} are open, and customer requests follow once enough local providers have completed review. Tell us what you need below and you will hear when that changes.`;

export function areaMetaDescription(area: ServiceAreaDefinition) {
  return `Vehicle services in ${areaLabel(area)} — the ZIP codes covered, what launches first, and what to have ready for a quote. Tuveloz is a marketplace being built for ${LOCAL_AREA_COUNTY}. Customer requests are not open yet.`;
}

export function serviceMetaDescription(service: LocalServiceDefinition) {
  return `${service.searchName} across ${LOCAL_AREA_COUNTY}, ${LOCAL_AREA_STATE_ABBREVIATION} — what it covers, what it does not, and what to have ready for a quote. Tuveloz is pre-launch: customer requests are not open yet.`;
}

export function areaServiceMetaDescription(
  area: ServiceAreaDefinition,
  service: LocalServiceDefinition,
) {
  return `${service.searchName} in ${areaLabel(area)} — what the service covers, what to describe for an accurate quote, and where Tuveloz's ${LOCAL_AREA_COUNTY} launch stands. Customer requests are not open yet.`;
}
