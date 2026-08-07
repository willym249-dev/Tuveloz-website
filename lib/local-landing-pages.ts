/**
 * Service and town landing pages.
 *
 * These exist to be found in local search — "mobile mechanic Silver Spring" —
 * and they follow the same honesty rules as every other public surface: they
 * never imply a customer can book or pay today, never promise a provider
 * income or job volume, and never claim a service is live. Copy describes what
 * Tuveloz is preparing and what someone can do right now, which pre-launch is
 * join the launch list or apply as a provider.
 */

export type LandingFaq = { question: string; answer: string };

export type ServiceLandingPage = {
  slug: string;
  /** Search-facing name, in the words a customer would actually type. */
  name: string;
  title: string;
  description: string;
  intro: string;
  /** Provider-facing service values this page corresponds to. */
  relatedProviderServices: string[];
  whatItCovers: string[];
  faqs: LandingFaq[];
};

export type TownLandingPage = {
  slug: string;
  name: string;
  title: string;
  description: string;
  intro: string;
  /** Neighborhoods and nearby places people search alongside the town. */
  nearby: string[];
  faqs: LandingFaq[];
};

const LAUNCH_STATUS_ANSWER =
  "Not yet. Tuveloz is signing up provider businesses in Montgomery County first. "
  + "Customer requests, quotes, and payments are turned off until every legal, insurance, "
  + "and payment requirement for a service is documented and satisfied. Join the launch "
  + "list and you'll hear when requests open.";

const PRICING_ANSWER =
  "Each provider business sets its own price and sends its own quote — Tuveloz never sets, "
  + "suggests, or marks up a provider's price. Tuveloz adds a 5% customer service fee that is "
  + "shown to you before you accept anything. Providers keep 100% of what they quote.";

export const SERVICE_LANDING_PAGES: readonly ServiceLandingPage[] = [
  {
    slug: "mobile-mechanic",
    name: "Mobile mechanic",
    title: "Mobile Mechanic in Montgomery County, MD",
    description:
      "Tuveloz is building a marketplace of independent mobile mechanics across Montgomery County, MD. Compare real quotes and choose your own provider. Customer requests open as each service clears review.",
    intro:
      "A mobile mechanic comes to your driveway, your office parking lot, or wherever the car is sitting, instead of you arranging a tow and losing a day to a shop visit. Tuveloz is assembling independent mobile providers across Montgomery County so you can describe the job once and compare real quotes from people who set their own prices.",
    relatedProviderServices: [
      "Battery replacement",
      "Jump start",
      "Basic vehicle diagnostics",
      "Tire repair or installation",
    ],
    whatItCovers: [
      "You describe the vehicle and the problem once",
      "Independent providers send their own quotes with their own prices",
      "You compare quotes side by side and pick the one you want",
      "The job, photos, and records stay in a private workspace you control",
    ],
    faqs: [
      { question: "Can I book a mobile mechanic on Tuveloz today?", answer: LAUNCH_STATUS_ANSWER },
      { question: "Who sets the price?", answer: PRICING_ANSWER },
      {
        question: "Is Tuveloz the repair shop?",
        answer:
          "No. Tuveloz is a marketplace. The independent provider business you choose offers and performs the service — they are not Tuveloz employees, and Tuveloz does not train, assign, or supervise them.",
      },
    ],
  },
  {
    slug: "car-battery-replacement",
    name: "Car battery replacement",
    title: "Mobile Car Battery Replacement in Montgomery County, MD",
    description:
      "Dead battery in Montgomery County, MD? Tuveloz is building a marketplace of independent providers who replace batteries where your car is parked. Customer requests open as each service clears review.",
    intro:
      "A dead battery is the most common reason a car will not start, and it is the job best suited to someone coming to you — the car does not have to move. Tuveloz is onboarding independent providers across Montgomery County who handle battery testing, replacement, and jump starts at your location.",
    relatedProviderServices: ["Battery replacement", "Jump start"],
    whatItCovers: [
      "Battery testing and replacement at your location",
      "Jump starts when the battery still holds a charge",
      "Providers quote their own labor price up front",
      "Parts are your own purchase — never marked up by a provider quote",
    ],
    faqs: [
      { question: "Can I request a battery replacement now?", answer: LAUNCH_STATUS_ANSWER },
      { question: "Who sets the price?", answer: PRICING_ANSWER },
      {
        question: "Does the quote include the battery itself?",
        answer:
          "No. Provider quotes on Tuveloz cover labor. Parts are purchased separately by the customer, and a provider quote never includes provider-supplied parts, parts reimbursement, or parts tax.",
      },
    ],
  },
  {
    slug: "mobile-tire-service",
    name: "Mobile tire service",
    title: "Mobile Tire Repair and Installation in Montgomery County, MD",
    description:
      "Flat tire or a spare that needs mounting in Montgomery County, MD? Tuveloz is building a marketplace of independent mobile tire providers. Customer requests open as each service clears review.",
    intro:
      "A flat does not have to mean a tow. Tuveloz is onboarding independent providers across Montgomery County who repair tires, mount replacements, and install temporary spares wherever the vehicle is.",
    relatedProviderServices: ["Tire repair or installation"],
    whatItCovers: [
      "Flat repair and temporary spare installation",
      "Tire mounting at your home or workplace",
      "Independent providers set their own labor prices",
      "Every quote states the scope before you accept",
    ],
    faqs: [
      { question: "Can I request tire service now?", answer: LAUNCH_STATUS_ANSWER },
      { question: "Who sets the price?", answer: PRICING_ANSWER },
    ],
  },
  {
    slug: "car-diagnostics",
    name: "Check engine light diagnostics",
    title: "Check Engine Light Diagnostics in Montgomery County, MD",
    description:
      "Check engine light on in Montgomery County, MD? Tuveloz is building a marketplace of independent providers who read codes and explain what they found. Customer requests open as each service clears review.",
    intro:
      "A check engine light is information, not a diagnosis — the same code can mean a loose gas cap or a failing sensor. Tuveloz is onboarding independent providers across Montgomery County who read the codes, explain what they actually found, and quote any follow-up work separately so you decide what happens next.",
    relatedProviderServices: ["Basic vehicle diagnostics"],
    whatItCovers: [
      "Diagnostic code reading and a plain explanation of the result",
      "A written scope before any repair is quoted",
      "Any additional work needs your approval as a change order",
      "Findings and photos stay in your private job record",
    ],
    faqs: [
      { question: "Can I request diagnostics now?", answer: LAUNCH_STATUS_ANSWER },
      { question: "Who sets the price?", answer: PRICING_ANSWER },
      {
        question: "What if the provider finds more work than expected?",
        answer:
          "Work that differs from the accepted quote has to stop and get your written approval as a change order before it continues. A provider cannot expand the job, send a separate invoice, or redirect payment on their own.",
      },
    ],
  },
  {
    slug: "mobile-car-detailing",
    name: "Mobile car detailing",
    title: "Mobile Car Detailing and Washing in Montgomery County, MD",
    description:
      "Mobile detailing and car washing in Montgomery County, MD. Tuveloz is building a marketplace of independent detailers who come to you. Customer requests open as each service clears review.",
    intro:
      "Detailing is the service people most often want done at home, and it is where independent operators consistently beat a chain. Tuveloz is onboarding independent detailers across Montgomery County, including waterless and low-water methods that fit local environmental rules.",
    relatedProviderServices: [
      "Detailing and ceramic coating",
      "Mobile car wash",
      "Interior detailing",
    ],
    whatItCovers: [
      "Interior and exterior detailing at your location",
      "Ceramic coating from providers who list it",
      "Water and runoff handling reviewed against local rules before the service opens",
      "Before-and-after photos recorded on the job",
    ],
    faqs: [
      { question: "Can I book detailing now?", answer: LAUNCH_STATUS_ANSWER },
      { question: "Who sets the price?", answer: PRICING_ANSWER },
    ],
  },
  {
    slug: "pre-purchase-car-inspection",
    name: "Pre-purchase car inspection",
    title: "Pre-Purchase Car Inspection in Montgomery County, MD",
    description:
      "Buying a used car in Montgomery County, MD? Tuveloz is building a marketplace of independent providers who inspect a vehicle before you buy. Customer requests open as each service clears review.",
    intro:
      "The cheapest hour you can spend on a used car is the one before you buy it. Tuveloz is onboarding independent providers across Montgomery County who will look over a vehicle you are considering and tell you what they see, with photos.",
    relatedProviderServices: ["Pre-purchase inspections"],
    whatItCovers: [
      "An independent look at a vehicle before you buy",
      "Photo documentation of what the provider observed",
      "A provider-written summary, not a sales pitch",
      "Your own private inspection — not an official Maryland state inspection",
    ],
    faqs: [
      { question: "Can I request an inspection now?", answer: LAUNCH_STATUS_ANSWER },
      {
        question: "Is this the same as a Maryland state inspection?",
        answer:
          "No. A pre-purchase inspection through Tuveloz is your own check, arranged by you, for your own decision. It is not an official Maryland State Police vehicle safety inspection and it does not produce a state inspection certificate.",
      },
      { question: "Who sets the price?", answer: PRICING_ANSWER },
    ],
  },
] as const;

export const TOWN_LANDING_PAGES: readonly TownLandingPage[] = [
  {
    slug: "silver-spring",
    name: "Silver Spring",
    title: "Mobile Vehicle Services in Silver Spring, MD",
    description:
      "Tuveloz is onboarding independent vehicle-service providers in Silver Spring, MD. Compare real quotes, choose your own provider. Customer requests open as each service clears review.",
    intro:
      "Silver Spring is where Tuveloz's provider onboarding started, and it is the densest part of Montgomery County for independent mobile operators.",
    nearby: ["Downtown Silver Spring", "Four Corners", "White Oak", "Colesville", "Takoma Park"],
    faqs: [],
  },
  {
    slug: "rockville",
    name: "Rockville",
    title: "Mobile Vehicle Services in Rockville, MD",
    description:
      "Tuveloz is onboarding independent vehicle-service providers in Rockville, MD. Compare real quotes, choose your own provider. Customer requests open as each service clears review.",
    intro:
      "Rockville sits at the center of the county, and providers based here typically cover a wide radius across the mid-county towns.",
    nearby: ["King Farm", "Twinbrook", "North Bethesda", "Derwood", "Potomac"],
    faqs: [],
  },
  {
    slug: "bethesda",
    name: "Bethesda",
    title: "Mobile Vehicle Services in Bethesda, MD",
    description:
      "Tuveloz is onboarding independent vehicle-service providers in Bethesda, MD. Compare real quotes, choose your own provider. Customer requests open as each service clears review.",
    intro:
      "Bethesda has heavy commuter traffic and limited residential parking, which is exactly where a provider coming to the vehicle saves the most time.",
    nearby: ["North Bethesda", "Chevy Chase", "Friendship Heights", "Cabin John", "Potomac"],
    faqs: [],
  },
  {
    slug: "gaithersburg",
    name: "Gaithersburg",
    title: "Mobile Vehicle Services in Gaithersburg, MD",
    description:
      "Tuveloz is onboarding independent vehicle-service providers in Gaithersburg, MD. Compare real quotes, choose your own provider. Customer requests open as each service clears review.",
    intro:
      "Gaithersburg and the surrounding up-county towns are a large service area with a strong base of independent operators.",
    nearby: ["Montgomery Village", "Washington Grove", "Germantown", "Darnestown", "Clarksburg"],
    faqs: [],
  },
  {
    slug: "germantown",
    name: "Germantown",
    title: "Mobile Vehicle Services in Germantown, MD",
    description:
      "Tuveloz is onboarding independent vehicle-service providers in Germantown, MD. Compare real quotes, choose your own provider. Customer requests open as each service clears review.",
    intro:
      "Germantown is one of the county's largest up-county communities, with most residents commuting by car every day.",
    nearby: ["Clarksburg", "Boyds", "Damascus", "Gaithersburg", "Montgomery Village"],
    faqs: [],
  },
  {
    slug: "wheaton",
    name: "Wheaton",
    title: "Mobile Vehicle Services in Wheaton, MD",
    description:
      "Tuveloz is onboarding independent vehicle-service providers in Wheaton, MD. Compare real quotes, choose your own provider. Customer requests open as each service clears review.",
    intro:
      "Wheaton and Glenmont have a deep bench of independent auto trades, including many Spanish-speaking businesses that Tuveloz supports in both languages.",
    nearby: ["Glenmont", "Kensington", "Aspen Hill", "Forest Glen", "Silver Spring"],
    faqs: [],
  },
  {
    slug: "takoma-park",
    name: "Takoma Park",
    title: "Mobile Vehicle Services in Takoma Park, MD",
    description:
      "Tuveloz is onboarding independent vehicle-service providers in Takoma Park, MD. Compare real quotes, choose your own provider. Customer requests open as each service clears review.",
    intro:
      "Takoma Park's tight streets and limited parking make an at-home service call considerably easier than a shop trip.",
    nearby: ["Silver Spring", "Long Branch", "Hillandale", "White Oak"],
    faqs: [],
  },
  {
    slug: "olney",
    name: "Olney",
    title: "Mobile Vehicle Services in Olney, MD",
    description:
      "Tuveloz is onboarding independent vehicle-service providers in Olney, MD. Compare real quotes, choose your own provider. Customer requests open as each service clears review.",
    intro:
      "Olney and the surrounding communities are further from the county's shop clusters, which is where a mobile provider saves the most driving.",
    nearby: ["Sandy Spring", "Brookeville", "Laytonsville", "Ashton", "Norwood"],
    faqs: [],
  },
  {
    slug: "potomac",
    name: "Potomac",
    title: "Mobile Vehicle Services in Potomac, MD",
    description:
      "Tuveloz is onboarding independent vehicle-service providers in Potomac, MD. Compare real quotes, choose your own provider. Customer requests open as each service clears review.",
    intro:
      "Potomac and North Potomac are largely residential with long driveways, which suits at-home service work well.",
    nearby: ["North Potomac", "Travilah", "Darnestown", "Cabin John", "Bethesda"],
    faqs: [],
  },
  {
    slug: "kensington",
    name: "Kensington",
    title: "Mobile Vehicle Services in Kensington, MD",
    description:
      "Tuveloz is onboarding independent vehicle-service providers in Kensington, MD. Compare real quotes, choose your own provider. Customer requests open as each service clears review.",
    intro:
      "Kensington sits between Wheaton, Bethesda, and Silver Spring, so providers based nearby usually serve all three.",
    nearby: ["Garrett Park", "Chevy Chase", "Wheaton", "North Bethesda"],
    faqs: [],
  },
  {
    slug: "montgomery-village",
    name: "Montgomery Village",
    title: "Mobile Vehicle Services in Montgomery Village, MD",
    description:
      "Tuveloz is onboarding independent vehicle-service providers in Montgomery Village, MD. Compare real quotes, choose your own provider. Customer requests open as each service clears review.",
    intro:
      "Montgomery Village's shared lots and townhome parking are a natural fit for a provider who comes to the car.",
    nearby: ["Gaithersburg", "Washington Grove", "Germantown", "Derwood"],
    faqs: [],
  },
  {
    slug: "clarksburg",
    name: "Clarksburg",
    title: "Mobile Vehicle Services in Clarksburg, MD",
    description:
      "Tuveloz is onboarding independent vehicle-service providers in Clarksburg, MD. Compare real quotes, choose your own provider. Customer requests open as each service clears review.",
    intro:
      "Clarksburg is one of the fastest-growing parts of the county and one of the furthest from its established shops.",
    nearby: ["Germantown", "Damascus", "Boyds", "Hyattstown"],
    faqs: [],
  },
] as const;

const TOWN_FAQ_TEMPLATE: readonly LandingFaq[] = [
  { question: "Can I request service today?", answer: LAUNCH_STATUS_ANSWER },
  { question: "Who sets the price?", answer: PRICING_ANSWER },
  {
    question: "Are providers Tuveloz employees?",
    answer:
      "No. Every provider is an independent business that sets its own prices, chooses its own jobs, and can work other platforms. Tuveloz does not employ, train, assign, or supervise providers.",
  },
] as const;

export function serviceLandingPage(slug: string) {
  return SERVICE_LANDING_PAGES.find((page) => page.slug === slug) ?? null;
}

export function townLandingPage(slug: string) {
  return TOWN_LANDING_PAGES.find((page) => page.slug === slug) ?? null;
}

/** Town pages share one FAQ set so the answers cannot drift apart. */
export function townFaqs(town: TownLandingPage): LandingFaq[] {
  return [...town.faqs, ...TOWN_FAQ_TEMPLATE];
}
