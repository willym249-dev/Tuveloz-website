import { parseJobServices } from "./service-matching";

export type ServiceAvailability = "standard" | "gated" | "paused";
export type ServiceRiskTier = "routine" | "regulated" | "specialty" | "high-risk";

export type ServiceSafetyPolicy = {
  key: string;
  title: string;
  availability: ServiceAvailability;
  riskTier: ServiceRiskTier;
  providerServices: readonly string[];
  customerServices: readonly string[];
  activationSummary: string;
  requiredChecks: readonly string[];
  customerDisclosures: readonly string[];
};

export const PROVIDER_FREEDOM_PRINCIPLES = [
  "Providers choose which approved services they offer.",
  "Providers set their own prices, availability, service areas, and appointment options.",
  "Providers may accept or decline each request without a required acceptance rate.",
  "Providers decide the lawful method, tools, staffing, and sequence used to perform the work.",
  "Providers may work for customers directly, use other platforms, and operate other businesses.",
  "Tuveloz may enforce marketplace safety, credential, documentation, privacy, and customer-authorization rules without directing the repair method.",
] as const;

export const CUSTOMER_AUTHORIZATION_PRINCIPLES = [
  "Accepting a provider quote authorizes only the work and price stated in that quote.",
  "Additional work or additional charges require a separate written change order and customer approval.",
  "A diagnostic request does not automatically authorize a repair.",
  "The independent provider, not Tuveloz, performs the service and states any parts or workmanship warranty.",
  "Tuveloz records marketplace actions and communications but does not guarantee a diagnosis, repair result, arrival time, or provider workmanship.",
] as const;

export const SERVICE_SAFETY_POLICIES: readonly ServiceSafetyPolicy[] = [
  {
    key: "routine-mobile-and-light-service",
    title: "Routine mobile and light vehicle services",
    availability: "standard",
    riskTier: "routine",
    providerServices: [
      "Battery replacement",
      "Battery jump-starts",
      "Windshield chip repair",
      "Headlight restoration",
      "Rain guard / vent visor installation",
      "Vehicle sunshade installation",
      "Waterless exterior washing",
      "Interior detailing",
      "Mobile detailing",
      "Detailing and ceramic coating",
    ],
    customerServices: [
      "Battery replacement or jump start",
      "Battery or jump start",
      "Windshield chip repair",
      "Headlight restoration",
      "Rain guard / vent visor installation",
      "Vehicle sunshade installation",
      "Mobile detailing",
      "Waterless exterior wash",
      "Interior detailing",
      "Detailing or ceramic coating",
    ],
    activationSummary: "Available after ordinary identity, service, insurance, local-registration, and customer-document review when applicable.",
    requiredChecks: [
      "Provider identity and business details",
      "Applicable repair registration and customer authorization process",
      "Appropriate commercial insurance for the selected service",
    ],
    customerDisclosures: [
      "The provider sets the price and performs the work as an independent business.",
      "The customer should review the provider's stated parts and workmanship warranty before authorizing work.",
    ],
  },
  {
    key: "repair-and-shop-service",
    title: "Repair, maintenance, and shop services",
    availability: "standard",
    riskTier: "regulated",
    providerServices: [
      "Mobile mechanical service",
      "General auto repair",
      "Brake service",
      "Transmission service",
      "Suspension and alignment",
      "Muffler and exhaust",
      "Body repair and paint",
      "Body repair and paint estimates",
      "Dent repair",
      "Auto glass replacement",
      "Wheel and rim repair",
      "Vehicle wraps and graphics",
      "Car audio and electronics",
      "Fleet maintenance",
      "Classic car restoration",
    ],
    customerServices: [
      "Mobile mechanic help",
      "General auto repair quote",
      "Brake service quote",
      "Transmission service quote",
      "Suspension or alignment quote",
      "Muffler or exhaust quote",
      "Body repair or paint quote",
      "Dent repair quote",
      "Minor dent repair quote",
      "Scratch or paintwork quote",
      "Auto glass replacement quote",
      "Wheel or rim repair quote",
      "Vehicle wrap or graphics quote",
      "Car audio or electronics quote",
      "Fleet maintenance",
      "Classic car restoration quote",
    ],
    activationSummary: "Available only for the exact services approved for that provider and service area.",
    requiredChecks: [
      "Applicable repair-facility or mobile-repair registration",
      "Written estimate, customer authorization, change-order, and itemized-invoice process",
      "Service-appropriate insurance and experience review",
    ],
    customerDisclosures: [
      "The accepted quote is the initial work authorization.",
      "Any additional work or charge must be presented in a separate change order.",
      "Safety-critical work should be completed only by a provider approved for that exact service.",
    ],
  },
  {
    key: "tire-service",
    title: "Tire service and spare installation",
    availability: "gated",
    riskTier: "regulated",
    providerServices: [
      "Spare-tire installation",
      "Mobile tire service",
      "Tire repair and replacement",
    ],
    customerServices: [
      "Flat tire or spare installation",
      "Tire help",
      "Mobile tire service",
      "Tire repair or replacement quote",
    ],
    activationSummary: "Requires tire-service approval plus a lawful removed-tire return or disposal process.",
    requiredChecks: [
      "Applicable repair registration",
      "Tire-service experience and insurance review",
      "Removed tire stays with the customer or follows an approved disposal process",
    ],
    customerDisclosures: [
      "The removed tire stays with the customer unless a lawful disposal arrangement is stated.",
      "A temporary spare has vehicle-specific speed and distance limits that remain the customer's responsibility to follow.",
    ],
  },
  {
    key: "lockout",
    title: "Vehicle lockout assistance",
    availability: "gated",
    riskTier: "high-risk",
    providerServices: ["Lockout assistance"],
    customerServices: ["Lockout assistance"],
    activationSummary: "Disabled until Tuveloz verifies the legally required Maryland locksmith business and technician records.",
    requiredChecks: [
      "Active Maryland locksmith business license",
      "Active locksmith technician or employee registration for the person performing the work",
      "Required liability insurance",
      "Customer identity and vehicle-access authorization for every job",
    ],
    customerDisclosures: [
      "The provider must verify that the customer is authorized to access the vehicle.",
      "Tuveloz does not permit ignition bypasses, immobilizer bypasses, alarm bypasses, or questionable-entry requests.",
    ],
  },
  {
    key: "wash-water",
    title: "Water-based mobile vehicle washing",
    availability: "gated",
    riskTier: "regulated",
    providerServices: [
      "Mobile car washing",
      "Car washing with water",
      "Car washing",
    ],
    customerServices: [
      "Mobile car wash",
      "Car wash — water only",
      "Exterior and interior — water only",
      "Exterior car wash with water",
      "Car washing",
    ],
    activationSummary: "Requires a documented wash-water capture and lawful disposal process.",
    requiredChecks: [
      "No discharge into roads, storm drains, soil, or waterways",
      "Wash-water capture or approved sanitary-sewer process",
      "Appropriate commercial insurance",
    ],
    customerDisclosures: [
      "The provider is responsible for lawful wash-water containment and disposal.",
      "Waterless service may be offered separately where suitable.",
    ],
  },
  {
    key: "tint",
    title: "Window tint installation",
    availability: "gated",
    riskTier: "regulated",
    providerServices: ["Window tint installation"],
    customerServices: ["Window tint installation quote"],
    activationSummary: "Requires vehicle-specific legal tint review before installation.",
    requiredChecks: [
      "Vehicle type and windows being tinted",
      "Proposed visible-light transmission",
      "Applicable medical-exemption documentation when relevant",
      "Provider confirmation that the installation follows current law",
    ],
    customerDisclosures: [
      "The provider must confirm the legal limits for the specific vehicle and windows.",
      "Tuveloz does not advertise or authorize unlawful tint levels.",
    ],
  },
  {
    key: "diagnostics-and-inspections",
    title: "Diagnostics and pre-purchase assessments",
    availability: "gated",
    riskTier: "regulated",
    providerServices: [
      "Basic vehicle diagnostics",
      "Pre-purchase inspections",
    ],
    customerServices: [
      "Basic vehicle diagnostics",
      "Pre-purchase inspection",
    ],
    activationSummary: "Available as an independent diagnostic or assessment; an official state inspection requires separately verified station and mechanic credentials.",
    requiredChecks: [
      "The scope must state whether it is scan-only, visual, diagnostic, or official inspection work",
      "Official Maryland inspection claims require verified station and mechanic records",
      "Repair work requires a separate authorization after diagnosis unless already itemized and accepted",
    ],
    customerDisclosures: [
      "A code scan or visual assessment may not identify every vehicle problem.",
      "The service is not an official Maryland safety or emissions inspection unless the provider's official credentials are shown for that service.",
      "A diagnostic request does not automatically authorize a repair.",
    ],
  },
  {
    key: "performance",
    title: "Performance and tuning",
    availability: "gated",
    riskTier: "high-risk",
    providerServices: ["Performance and tuning"],
    customerServices: ["Performance or tuning quote"],
    activationSummary: "Requires emissions, road-use, safety, and insurance review before activation.",
    requiredChecks: [
      "No emissions defeat device or unlawful emissions delete",
      "No safety-system, airbag, odometer, or theft-prevention bypass",
      "Written disclosure when work is intended only for lawful off-road or competition use",
    ],
    customerDisclosures: [
      "Tuveloz does not permit unlawful emissions deletes or safety-system bypasses.",
      "The provider is responsible for confirming that proposed work is lawful for the vehicle's intended use.",
    ],
  },
  {
    key: "high-voltage-and-specialty",
    title: "High-voltage and specialty vehicle work",
    availability: "gated",
    riskTier: "specialty",
    providerServices: [
      "Hybrid and EV service",
      "Diesel service",
      "Motorcycle service",
      "RV service",
      "Trailer service",
    ],
    customerServices: [
      "Hybrid or EV service",
      "Diesel service",
      "Motorcycle service",
      "RV service",
      "Trailer service",
    ],
    activationSummary: "Requires service-specific experience, tools, safety process, and insurance review.",
    requiredChecks: [
      "Service-specific experience and tools",
      "Appropriate commercial insurance",
      "High-voltage safety process for hybrid and electric-vehicle work",
    ],
    customerDisclosures: [
      "Only providers approved for the exact specialty service may quote the request.",
      "Tuveloz does not direct the repair method or certify the provider's technical result.",
    ],
  },
  {
    key: "fuel-delivery",
    title: "Fuel delivery",
    availability: "paused",
    riskTier: "high-risk",
    providerServices: ["Fuel delivery"],
    customerServices: ["Fuel delivery"],
    activationSummary: "Not available during the launch pilot pending separate fire-code, transportation, spill-response, insurance, and payment review.",
    requiredChecks: [
      "Separate legal and fire-code review",
      "Fuel transportation and dispensing approval",
      "Spill-response process and specialized insurance",
    ],
    customerDisclosures: [
      "Fuel delivery is not currently available through Tuveloz.",
    ],
  },
];

const FALLBACK_POLICY: ServiceSafetyPolicy = {
  key: "manual-review",
  title: "Service requiring manual review",
  availability: "gated",
  riskTier: "specialty",
  providerServices: [],
  customerServices: [],
  activationSummary: "This service requires service-area, legal, insurance, safety, and customer-document review before activation.",
  requiredChecks: [
    "Service-specific legal and insurance review",
    "Provider experience and customer-document review",
  ],
  customerDisclosures: [
    "Only a provider approved for the exact service may quote the request.",
  ],
};

export function serviceSafetyPolicyFor(service: string) {
  const normalized = service.trim();
  return SERVICE_SAFETY_POLICIES.find((policy) => (
    policy.providerServices.includes(normalized)
    || policy.customerServices.includes(normalized)
  )) ?? FALLBACK_POLICY;
}

export function serviceSafetyPoliciesForJob(jobServices: string | string[]) {
  const services = Array.isArray(jobServices) ? jobServices : parseJobServices(jobServices);
  return services.map((service) => ({
    service,
    policy: serviceSafetyPolicyFor(service),
  }));
}

export function pausedCustomerServices(services: string[]) {
  return services.filter((service) => serviceSafetyPolicyFor(service).availability === "paused");
}

export function providerServiceIsPaused(service: string) {
  return serviceSafetyPolicyFor(service).availability === "paused";
}

export function providerServiceRequiresSpecialRules(service: string) {
  const policy = serviceSafetyPolicyFor(service);
  return policy.availability === "gated" || policy.riskTier === "high-risk";
}

export function authorizationDisclosuresForJob(jobServices: string | string[]) {
  const policies = serviceSafetyPoliciesForJob(jobServices);
  return [...new Set([
    ...CUSTOMER_AUTHORIZATION_PRINCIPLES,
    ...policies.flatMap(({ policy }) => policy.customerDisclosures),
  ])];
}
