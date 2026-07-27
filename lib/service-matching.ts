const providerServiceRequirementsForJob: Record<string, string[][]> = {
  "Battery or jump start": [["Battery jump-starts"]],
  "Flat tire or spare installation": [["Spare-tire installation"]],
  "Tire help": [["Spare-tire installation"]],
  "Basic vehicle diagnostics": [["Basic vehicle diagnostics"]],
  "Minor dent repair quote": [["Body repair and paint estimates"]],
  "Scratch or paintwork quote": [["Body repair and paint estimates"]],
  "Window tint installation quote": [["Window tint installation"]],
  "Rain guard / vent visor installation": [["Rain guard / vent visor installation"]],
  "Vehicle sunshade installation": [["Vehicle sunshade installation"]],
  "Car wash — waterless is okay": [[
    "Waterless exterior washing",
    "Car washing with water",
    "Car washing",
  ]],
  "Car wash — water only": [["Car washing with water", "Car washing"]],
  "Interior detailing": [["Interior detailing"]],
  "Exterior and interior — waterless is okay": [
    ["Waterless exterior washing", "Car washing with water", "Car washing"],
    ["Interior detailing"],
  ],
  "Exterior and interior — water only": [
    ["Car washing with water", "Car washing"],
    ["Interior detailing"],
  ],
  "Waterless exterior wash": [["Waterless exterior washing", "Car washing"]],
  "Exterior car wash with water": [["Car washing with water", "Car washing"]],
  "Car washing": [[
    "Waterless exterior washing",
    "Car washing with water",
    "Car washing",
  ]],
};

export const PROVIDER_SERVICE_OPTIONS = [
  "Battery jump-starts",
  "Spare-tire installation",
  "Basic vehicle diagnostics",
  "Body repair and paint estimates",
  "Window tint installation",
  "Rain guard / vent visor installation",
  "Vehicle sunshade installation",
  "Waterless exterior washing",
  "Car washing with water",
  "Interior detailing",
] as const;

export const CUSTOMER_JOB_SERVICE_OPTIONS = [
  "Battery or jump start",
  "Tire help",
  "Basic vehicle diagnostics",
  "Minor dent repair quote",
  "Scratch or paintwork quote",
  "Window tint installation quote",
  "Rain guard / vent visor installation",
  "Vehicle sunshade installation",
  "Waterless exterior wash",
  "Exterior car wash with water",
  "Interior detailing",
] as const;

export const PARTS_SOURCE_OPTIONS = [
  "I have the parts — labor only",
  "Provider supplies parts",
  "Either is okay",
] as const;

export const PARTS_PREFERENCE_OPTIONS = [
  "Best value",
  "OEM",
  "Aftermarket",
  "No preference",
] as const;

export const QUOTE_PART_TYPE_OPTIONS = [
  "OEM",
  "Aftermarket",
  "No parts needed",
] as const;

const marketplacePartTerms: Record<string, string> = {
  "Battery or jump start": "replacement battery",
  "Tire help": "replacement tire spare tire",
  "Flat tire or spare installation": "replacement tire spare tire",
  "Basic vehicle diagnostics": "replacement auto part",
  "Minor dent repair quote": "body repair part",
  "Scratch or paintwork quote": "body repair part",
  "Window tint installation quote": "window tint kit",
  "Rain guard / vent visor installation": "vehicle fit rain guard vent visor window deflector",
  "Vehicle sunshade installation": "vehicle fit removable retractable sunshade",
  "Waterless exterior wash": "waterless car wash supplies",
  "Exterior car wash with water": "car wash supplies",
  "Interior detailing": "interior detailing supplies",
};

export function marketplacePartsSearchUrl(
  vehicle: string,
  jobServices: string,
  partType: "OEM" | "Aftermarket",
) {
  const partTerms = parseJobServices(jobServices)
    .map((service) => marketplacePartTerms[service] ?? "replacement auto part")
    .join(" ");
  const query = `${vehicle} ${partType} ${partTerms}`.trim();
  return `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(query)}`;
}

export function parseProviderServices(providerServices: string) {
  return providerServices
    .split(" | ")
    .map((service) => service.trim())
    .filter(Boolean);
}

export function serializeProviderServices(providerServices: string[]) {
  return [...new Set(providerServices.map((service) => service.trim()).filter(Boolean))].join(" | ");
}

export function parseJobServices(jobServices: string) {
  return jobServices
    .split(" | ")
    .map((service) => service.trim())
    .filter(Boolean);
}

export function serializeJobServices(jobServices: string[]) {
  return [...new Set(jobServices.map((service) => service.trim()).filter(Boolean))].join(" | ");
}

export function providerMatchesJob(providerService: string, jobService: string) {
  const selectedServices = parseProviderServices(providerService);
  const requestedServices = parseJobServices(jobService);
  return requestedServices.length > 0 && requestedServices.every(
    (requestedService) => {
      const requirementGroups = providerServiceRequirementsForJob[requestedService] ?? [];
      return requirementGroups.length > 0 && requirementGroups.every(
        (acceptedServices) => selectedServices.some(
          (service) => acceptedServices.includes(service),
        ),
      );
    },
  );
}

export function effectiveProviderServices(
  requestedServices: string,
  approvedServices: string,
  isTestProvider: string,
) {
  if (isTestProvider === "yes") return requestedServices;
  return approvedServices.trim() || requestedServices;
}

export function areaForZip(zipValue: string) {
  const zip = zipValue.trim().slice(0, 5);
  if (/^20[89]/.test(zip)) return "Montgomery County";
  if (/^20[67]/.test(zip)) return "Prince George's County";
  if (/^200/.test(zip)) return "Washington, DC";
  if (/^(201|220|221|222|223)/.test(zip)) return "Northern Virginia";
  return "";
}

export const CURRENT_LAUNCH_AREA = "Montgomery County, Maryland";

export const SUPPORTED_LAUNCH_AREAS = [
  CURRENT_LAUNCH_AREA,
] as const;

const KNOWN_MARKET_AREAS = [
  CURRENT_LAUNCH_AREA,
  "Fairfax County, Virginia",
] as const;

export const ANYWHERE_PROVIDER_AREA = "Anywhere Tuveloz has jobs";

export const PROVIDER_AREA_OPTIONS = [
  ANYWHERE_PROVIDER_AREA,
  ...SUPPORTED_LAUNCH_AREAS,
] as const;

export const CUSTOMER_SERVICE_LOCATION_OPTIONS = [
  "Provider comes to me",
  "I can go to the provider",
] as const;

export const PROVIDER_WORK_LOCATION_OPTIONS = [
  "I travel to customers",
  "Customers come to my business",
] as const;

function normalizeArea(area: string) {
  const normalized = area.trim().toLowerCase();
  if ([
    "md",
    "maryland",
    "montgomery county",
    "montgomery county md",
    "montgomery county, md",
  ].includes(normalized)) {
    return "Montgomery County, Maryland";
  }
  if ([
    "va",
    "virginia",
    "northern virginia",
    "fairfax county",
    "fairfax county va",
    "fairfax county, va",
  ].includes(normalized)) {
    return "Fairfax County, Virginia";
  }
  return area.trim();
}

export function parseProviderAreas(providerAreas: string) {
  const trimmedAreas = providerAreas.trim();
  if (trimmedAreas === ANYWHERE_PROVIDER_AREA) {
    return [ANYWHERE_PROVIDER_AREA];
  }
  if (KNOWN_MARKET_AREAS.includes(
    trimmedAreas as (typeof KNOWN_MARKET_AREAS)[number],
  )) {
    return [trimmedAreas];
  }
  const separator = trimmedAreas.includes(" | ") ? " | " : ", ";
  return trimmedAreas
    .split(separator)
    .map((area) => normalizeArea(area.trim()))
    .filter(Boolean);
}

export function serializeProviderAreas(providerAreas: string[]) {
  const normalizedAreas = [...new Set(
    providerAreas.map((area) => normalizeArea(area.trim())).filter(Boolean),
  )];
  if (normalizedAreas.includes(ANYWHERE_PROVIDER_AREA)) {
    return ANYWHERE_PROVIDER_AREA;
  }
  return normalizedAreas.join(" | ");
}

export function providerLegalAreas(providerAreas: string | string[]) {
  const areas = Array.isArray(providerAreas)
    ? providerAreas
    : parseProviderAreas(providerAreas);
  if (areas.includes(ANYWHERE_PROVIDER_AREA)) {
    return [...SUPPORTED_LAUNCH_AREAS];
  }
  return areas;
}

export function providerMatchesArea(providerAreas: string, jobAreaOrZip: string) {
  const explicitArea = SUPPORTED_LAUNCH_AREAS.includes(
    jobAreaOrZip as (typeof SUPPORTED_LAUNCH_AREAS)[number],
  ) ? jobAreaOrZip : "";
  const legacyArea = areaForZip(jobAreaOrZip);
  const jobArea = normalizeArea(explicitArea || legacyArea);
  if (!jobArea) return false;
  const selectedAreas = parseProviderAreas(providerAreas);
  return selectedAreas.includes(ANYWHERE_PROVIDER_AREA) || selectedAreas.includes(jobArea);
}

function parseOptions(
  value: string,
  allowed: readonly string[],
  legacyDefault: string,
) {
  const parsed = value
    .split(" | ")
    .map((item) => item.trim())
    .filter((item) => allowed.includes(item));
  return parsed.length > 0 ? [...new Set(parsed)] : [legacyDefault];
}

export function parseCustomerServiceLocations(value: string) {
  return parseOptions(
    value,
    CUSTOMER_SERVICE_LOCATION_OPTIONS,
    CUSTOMER_SERVICE_LOCATION_OPTIONS[0],
  );
}

export function parseProviderWorkLocations(value: string) {
  return parseOptions(
    value,
    PROVIDER_WORK_LOCATION_OPTIONS,
    PROVIDER_WORK_LOCATION_OPTIONS[0],
  );
}

export function serializeLocationOptions(value: string[], allowed: readonly string[]) {
  return [...new Set(value.map((item) => item.trim()).filter((item) => allowed.includes(item)))]
    .join(" | ");
}

export function providerMatchesServiceLocation(
  providerWorkLocations: string,
  customerServiceLocations: string,
) {
  const providerOptions = parseProviderWorkLocations(providerWorkLocations);
  const customerOptions = parseCustomerServiceLocations(customerServiceLocations);
  return (
    customerOptions.includes(CUSTOMER_SERVICE_LOCATION_OPTIONS[0])
      && providerOptions.includes(PROVIDER_WORK_LOCATION_OPTIONS[0])
  ) || (
    customerOptions.includes(CUSTOMER_SERVICE_LOCATION_OPTIONS[1])
      && providerOptions.includes(PROVIDER_WORK_LOCATION_OPTIONS[1])
  );
}
