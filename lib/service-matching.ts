const providerServiceRequirementsForJob: Record<string, string[][]> = {
  "Battery or jump start": [[
    "Battery replacement",
    "Battery jump-starts",
  ]],
  "Battery replacement or jump start": [[
    "Battery replacement",
    "Battery jump-starts",
  ]],
  "Flat tire or spare installation": [[
    "Mobile tire service",
    "Spare-tire installation",
    "Tire repair and replacement",
  ]],
  "Tire help": [[
    "Mobile tire service",
    "Spare-tire installation",
    "Tire repair and replacement",
  ]],
  "Mobile mechanic help": [[
    "Mobile mechanical service",
    "General auto repair",
  ]],
  "Mobile detailing": [[
    "Mobile detailing",
    "Interior detailing",
    "Detailing and ceramic coating",
  ]],
  "Mobile tire service": [[
    "Mobile tire service",
    "Spare-tire installation",
    "Tire repair and replacement",
  ]],
  "Lockout assistance": [["Lockout assistance"]],
  "Fuel delivery": [["Fuel delivery"]],
  "Windshield chip repair": [["Windshield chip repair"]],
  "Headlight restoration": [["Headlight restoration"]],
  "Mobile car wash": [[
    "Mobile car washing",
    "Waterless exterior washing",
    "Car washing with water",
    "Car washing",
  ]],
  "Basic vehicle diagnostics": [[
    "Basic vehicle diagnostics",
    "Mobile mechanical service",
    "General auto repair",
  ]],
  "General auto repair quote": [["General auto repair"]],
  "Tire repair or replacement quote": [[
    "Tire repair and replacement",
    "Mobile tire service",
  ]],
  "Brake service quote": [["Brake service"]],
  "Transmission service quote": [["Transmission service"]],
  "Suspension or alignment quote": [["Suspension and alignment"]],
  "Muffler or exhaust quote": [["Muffler and exhaust"]],
  "Body repair or paint quote": [[
    "Body repair and paint",
    "Body repair and paint estimates",
  ]],
  "Dent repair quote": [[
    "Dent repair",
    "Body repair and paint",
    "Body repair and paint estimates",
  ]],
  "Auto glass replacement quote": [["Auto glass replacement"]],
  "Wheel or rim repair quote": [["Wheel and rim repair"]],
  "Performance or tuning quote": [["Performance and tuning"]],
  "Vehicle wrap or graphics quote": [["Vehicle wraps and graphics"]],
  "Car audio or electronics quote": [["Car audio and electronics"]],
  "Pre-purchase inspection": [["Pre-purchase inspections"]],
  "Fleet maintenance": [["Fleet maintenance"]],
  "Trailer service": [["Trailer service"]],
  "Motorcycle service": [["Motorcycle service"]],
  "RV service": [["RV service"]],
  "Diesel service": [["Diesel service"]],
  "Hybrid or EV service": [["Hybrid and EV service"]],
  "Classic car restoration quote": [["Classic car restoration"]],
  "Detailing or ceramic coating": [[
    "Detailing and ceramic coating",
    "Mobile detailing",
  ]],
  "Minor dent repair quote": [[
    "Dent repair",
    "Body repair and paint",
    "Body repair and paint estimates",
  ]],
  "Scratch or paintwork quote": [[
    "Body repair and paint",
    "Body repair and paint estimates",
  ]],
  "Window tint installation quote": [["Window tint installation"]],
  "Rain guard / vent visor installation": [["Rain guard / vent visor installation"]],
  "Vehicle sunshade installation": [["Vehicle sunshade installation"]],
  "Car wash — waterless is okay": [[
    "Mobile car washing",
    "Mobile detailing",
    "Waterless exterior washing",
    "Car washing with water",
    "Car washing",
  ]],
  "Car wash — water only": [[
    "Mobile car washing",
    "Car washing with water",
    "Car washing",
  ]],
  "Interior detailing": [["Interior detailing"]],
  "Exterior and interior — waterless is okay": [
    [
      "Mobile car washing",
      "Mobile detailing",
      "Waterless exterior washing",
      "Car washing with water",
      "Car washing",
    ],
    ["Mobile detailing", "Interior detailing", "Detailing and ceramic coating"],
  ],
  "Exterior and interior — water only": [
    ["Mobile car washing", "Car washing with water", "Car washing"],
    ["Mobile detailing", "Interior detailing", "Detailing and ceramic coating"],
  ],
  "Waterless exterior wash": [[
    "Mobile car washing",
    "Mobile detailing",
    "Waterless exterior washing",
    "Car washing",
  ]],
  "Exterior car wash with water": [[
    "Mobile car washing",
    "Car washing with water",
    "Car washing",
  ]],
  "Car washing": [[
    "Mobile car washing",
    "Mobile detailing",
    "Waterless exterior washing",
    "Car washing with water",
    "Car washing",
  ]],
};

type ProviderServiceOption = {
  value: string;
  label: string;
  labelEs: string;
  note?: string;
  noteEs?: string;
};

type ProviderServiceGroup = {
  id: "mobile" | "shop" | "specialty";
  label: string;
  labelEs: string;
  description: string;
  descriptionEs: string;
  options: readonly ProviderServiceOption[];
};

export const PROVIDER_SERVICE_GROUPS: readonly ProviderServiceGroup[] = [
  {
    id: "mobile",
    label: "Mobile services",
    labelEs: "Servicios móviles",
    description: "Work performed at the customer’s location.",
    descriptionEs: "Trabajo realizado en la ubicación del cliente.",
    options: [
      { value: "Mobile mechanical service", label: "Mobile mechanics", labelEs: "Mecánica móvil" },
      { value: "Mobile detailing", label: "Mobile detailing", labelEs: "Detallado móvil" },
      { value: "Mobile tire service", label: "Mobile tire service", labelEs: "Servicio móvil de llantas" },
      { value: "Battery replacement", label: "Battery replacement", labelEs: "Reemplazo de batería" },
      { value: "Battery jump-starts", label: "Jump starts", labelEs: "Arranque de batería" },
      {
        value: "Spare-tire installation",
        label: "Flat-tire help and spare installation",
        labelEs: "Ayuda con llantas e instalación del repuesto",
        note: "The removed tire stays with the customer.",
        noteEs: "La llanta retirada permanece con el cliente.",
      },
      {
        value: "Lockout assistance",
        label: "Lockout assistance",
        labelEs: "Asistencia por cierre del vehículo",
        note: "Customer and vehicle authorization must be verified.",
        noteEs: "Se debe verificar la autorización del cliente y del vehículo.",
      },
      { value: "Fuel delivery", label: "Fuel delivery", labelEs: "Entrega de combustible" },
      { value: "Windshield chip repair", label: "Windshield chip repair", labelEs: "Reparación de astillas del parabrisas" },
      { value: "Headlight restoration", label: "Headlight restoration", labelEs: "Restauración de faros" },
      {
        value: "Mobile car washing",
        label: "Mobile car wash",
        labelEs: "Lavado móvil de autos",
        note: "Wash water must follow local discharge rules.",
        noteEs: "El agua de lavado debe cumplir las reglas locales de descarga.",
      },
      {
        value: "Basic vehicle diagnostics",
        label: "Basic vehicle diagnostics",
        labelEs: "Diagnóstico básico del vehículo",
        note: "Not an official state safety or emissions inspection.",
        noteEs: "No es una inspección oficial estatal de seguridad o emisiones.",
      },
    ],
  },
  {
    id: "shop",
    label: "Shop services",
    labelEs: "Servicios de taller",
    description: "Work normally performed at a provider’s business location.",
    descriptionEs: "Trabajo que normalmente se realiza en el negocio del proveedor.",
    options: [
      { value: "General auto repair", label: "Auto repair", labelEs: "Reparación de autos" },
      { value: "Tire repair and replacement", label: "Tire shop", labelEs: "Taller de llantas" },
      { value: "Brake service", label: "Brake service", labelEs: "Servicio de frenos" },
      { value: "Transmission service", label: "Transmission service", labelEs: "Servicio de transmisión" },
      { value: "Suspension and alignment", label: "Suspension and alignment", labelEs: "Suspensión y alineación" },
      { value: "Muffler and exhaust", label: "Muffler and exhaust", labelEs: "Silenciador y escape" },
      {
        value: "Window tint installation",
        label: "Window tint",
        labelEs: "Polarizado de ventanas",
        note: "Every installation must follow the applicable legal limits.",
        noteEs: "Cada instalación debe cumplir los límites legales aplicables.",
      },
      { value: "Body repair and paint", label: "Paint and body", labelEs: "Pintura y carrocería" },
      { value: "Dent repair", label: "Dent repair", labelEs: "Reparación de abolladuras" },
      { value: "Auto glass replacement", label: "Auto glass replacement", labelEs: "Reemplazo de vidrio automotriz" },
      { value: "Wheel and rim repair", label: "Wheel and rim repair", labelEs: "Reparación de ruedas y rines" },
      {
        value: "Performance and tuning",
        label: "Performance and tuning",
        labelEs: "Rendimiento y ajustes",
        note: "Activation requires emissions and road-use compliance review.",
        noteEs: "La activación requiere revisar el cumplimiento de emisiones y uso vial.",
      },
      { value: "Vehicle wraps and graphics", label: "Vehicle wraps and graphics", labelEs: "Rotulación y gráficos para vehículos" },
      { value: "Car audio and electronics", label: "Car audio and electronics", labelEs: "Audio y electrónica del automóvil" },
      { value: "Rain guard / vent visor installation", label: "Rain guards and vent visors", labelEs: "Deflectores de lluvia y viseras de ventana" },
      { value: "Vehicle sunshade installation", label: "Vehicle sunshades", labelEs: "Parasoles para vehículos" },
    ],
  },
  {
    id: "specialty",
    label: "Specialty services",
    labelEs: "Servicios especializados",
    description: "Specialized work that receives extra approval review before activation.",
    descriptionEs: "Trabajo especializado que recibe una revisión adicional antes de activarse.",
    options: [
      {
        value: "Pre-purchase inspections",
        label: "Pre-purchase inspections",
        labelEs: "Inspecciones antes de comprar",
        note: "An independent evaluation, not an official state inspection.",
        noteEs: "Una evaluación independiente, no una inspección oficial estatal.",
      },
      { value: "Fleet maintenance", label: "Fleet maintenance", labelEs: "Mantenimiento de flotas" },
      { value: "Trailer service", label: "Trailer service", labelEs: "Servicio de remolques" },
      { value: "Motorcycle service", label: "Motorcycle service", labelEs: "Servicio de motocicletas" },
      { value: "RV service", label: "RV service", labelEs: "Servicio de vehículos recreativos" },
      { value: "Diesel service", label: "Diesel service", labelEs: "Servicio diésel" },
      { value: "Hybrid and EV service", label: "Hybrid and EV service", labelEs: "Servicio de vehículos híbridos y eléctricos" },
      { value: "Classic car restoration", label: "Classic car restoration", labelEs: "Restauración de autos clásicos" },
      { value: "Detailing and ceramic coating", label: "Detailing and ceramic coating", labelEs: "Detallado y recubrimiento cerámico" },
    ],
  },
];

const LEGACY_PROVIDER_SERVICE_OPTIONS = [
  "Body repair and paint estimates",
  "Waterless exterior washing",
  "Car washing with water",
  "Car washing",
  "Interior detailing",
] as const;

export const PROVIDER_SERVICE_OPTIONS: readonly string[] = [
  ...PROVIDER_SERVICE_GROUPS.flatMap((group) => (
    group.options.map((option) => option.value)
  )),
  ...LEGACY_PROVIDER_SERVICE_OPTIONS,
];

type CustomerServiceGroup = {
  id: "mobile" | "repairs" | "extras" | "specialty";
  label: string;
  description: string;
  options: readonly { value: string; label: string }[];
};

// Everyday, plain-language names for the customer job picker. The `value`
// strings are the matching keys (see providerServiceRequirementsForJob and
// CUSTOMER_JOB_SERVICE_OPTIONS) and must never change; only the display
// `label` is customer-facing. Grouping is visual only — it does not affect
// matching — so the long repair list is split into two smaller buckets.
export const CUSTOMER_SERVICE_GROUPS: readonly CustomerServiceGroup[] = [
  {
    id: "mobile",
    label: "Comes to you",
    description: "Help that comes to wherever your car is.",
    options: [
      { value: "Mobile mechanic help", label: "Mobile mechanic" },
      { value: "Mobile detailing", label: "Car cleaning (detailing)" },
      { value: "Mobile tire service", label: "Tire help" },
      { value: "Battery replacement or jump start", label: "Dead battery or jump start" },
      { value: "Lockout assistance", label: "Locked out of the car" },
      { value: "Fuel delivery", label: "Out of gas" },
      { value: "Windshield chip repair", label: "Windshield chip repair" },
      { value: "Headlight restoration", label: "Foggy headlight cleanup" },
      { value: "Mobile car wash", label: "Car wash" },
      { value: "Basic vehicle diagnostics", label: "Find out what's wrong" },
    ],
  },
  {
    id: "repairs",
    label: "Repairs",
    description: "Fixing something that isn't working right.",
    options: [
      { value: "General auto repair quote", label: "Auto repair" },
      { value: "Tire repair or replacement quote", label: "Tire repair or new tires" },
      { value: "Brake service quote", label: "Brakes" },
      { value: "Transmission service quote", label: "Transmission" },
      { value: "Suspension or alignment quote", label: "Suspension or alignment" },
      { value: "Muffler or exhaust quote", label: "Muffler or exhaust" },
      { value: "Auto glass replacement quote", label: "Auto glass replacement" },
      { value: "Wheel or rim repair quote", label: "Wheel or rim repair" },
    ],
  },
  {
    id: "extras",
    label: "Looks & extras",
    description: "Making your car look better or adding features.",
    options: [
      { value: "Window tint installation quote", label: "Window tint" },
      { value: "Body repair or paint quote", label: "Paint or body repair" },
      { value: "Dent repair quote", label: "Dent repair" },
      { value: "Performance or tuning quote", label: "Performance or tuning" },
      { value: "Vehicle wrap or graphics quote", label: "Wraps or graphics" },
      { value: "Car audio or electronics quote", label: "Car audio or electronics" },
      { value: "Rain guard / vent visor installation", label: "Rain guards or vent visors" },
      { value: "Vehicle sunshade installation", label: "Sunshade" },
    ],
  },
  {
    id: "specialty",
    label: "Special requests",
    description: "Special vehicles and less-common jobs.",
    options: [
      { value: "Pre-purchase inspection", label: "Check a car before buying" },
      { value: "Fleet maintenance", label: "Fleet maintenance" },
      { value: "Trailer service", label: "Trailer service" },
      { value: "Motorcycle service", label: "Motorcycle service" },
      { value: "RV service", label: "RV service" },
      { value: "Diesel service", label: "Diesel service" },
      { value: "Hybrid or EV service", label: "Hybrid or electric car" },
      { value: "Classic car restoration quote", label: "Classic car restoration" },
      { value: "Detailing or ceramic coating", label: "Detailing or ceramic coating" },
    ],
  },
];

export const CUSTOMER_JOB_SERVICE_OPTIONS: readonly string[] = (
  CUSTOMER_SERVICE_GROUPS.flatMap((group) => (
    group.options.map((option) => option.value)
  ))
);

export const CUSTOMER_SUPPLIED_PARTS_SOURCE =
  "Customer supplies any needed parts — labor only";
export const LEGACY_CUSTOMER_SUPPLIED_PARTS_SOURCE =
  "I have the parts — labor only";
export const NO_PARTS_NEEDED_SOURCE = "No parts needed — labor only";
export const PARTS_DISCUSSION_SOURCE =
  "Not sure whether parts are needed — discuss with provider";

export const PARTS_SOURCE_OPTIONS = [
  CUSTOMER_SUPPLIED_PARTS_SOURCE,
  NO_PARTS_NEEDED_SOURCE,
  PARTS_DISCUSSION_SOURCE,
] as const;

export const PARTS_PREFERENCE_OPTIONS = [
  "OEM",
  "Aftermarket",
  "No preference",
  "Discuss with provider",
] as const;

export const CUSTOMER_SUPPLIED_PARTS_POLICY_OPTIONS = [
  "OEM",
  "Aftermarket",
  "Either",
  "Discuss before accepting",
] as const;

export const PARTS_COMMUNICATION_NOTICE =
  "Parts preferences are provided only to help customers and providers communicate. Tuveloz does not sell, source, list, verify, or process payment for vehicle parts. Any required parts must be purchased separately by the customer and cannot be included in a Tuveloz quote or payment.";

export const QUOTE_PART_TYPE_OPTIONS = [
  "Customer supplied",
  "No parts needed",
] as const;

export function normalizeLaborOnlyPartsSource(value: string) {
  const normalized = value.trim();
  if (
    normalized === CUSTOMER_SUPPLIED_PARTS_SOURCE
    || normalized === LEGACY_CUSTOMER_SUPPLIED_PARTS_SOURCE
  ) {
    return CUSTOMER_SUPPLIED_PARTS_SOURCE;
  }
  if (normalized === NO_PARTS_NEEDED_SOURCE) return NO_PARTS_NEEDED_SOURCE;
  if (normalized === PARTS_DISCUSSION_SOURCE) return PARTS_DISCUSSION_SOURCE;
  return "";
}

export function isLaborOnlyPartsSource(value: string) {
  return Boolean(normalizeLaborOnlyPartsSource(value));
}

export function customerSuppliedPartsPreferenceApplies(value: string) {
  const normalized = normalizeLaborOnlyPartsSource(value);
  return (
    normalized === CUSTOMER_SUPPLIED_PARTS_SOURCE
    || normalized === PARTS_DISCUSSION_SOURCE
  );
}

export function quotePartTypeForLaborOnlySource(value: string) {
  return normalizeLaborOnlyPartsSource(value) === NO_PARTS_NEEDED_SOURCE
    ? "No parts needed"
    : "Customer supplied";
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
  // A real provider's application choices are interests, not authorization.
  // An empty approved list must stay empty so no route can fail open.
  return approvedServices.trim();
}

export function areaForZip(zipValue: string) {
  const zip = zipValue.trim().slice(0, 5);
  if (/^20[89]/.test(zip)) return "Montgomery County";
  if (/^20[67]/.test(zip)) return "Prince George's County";
  if (/^200/.test(zip)) return "Washington, DC";
  return "";
}

// Suggestion lists only, surfaced through <datalist> so a form field shows
// matching options as the customer types. areaForZip above stays the
// authoritative server-side check -- typing a value outside these lists is
// still allowed client-side and is still rejected server-side if invalid.
export const MONTGOMERY_COUNTY_MD_MUNICIPALITIES = [
  "Aspen Hill",
  "Barnesville",
  "Bethesda",
  "Boyds",
  "Brookeville",
  "Burtonsville",
  "Cabin John",
  "Chevy Chase",
  "Clarksburg",
  "Colesville",
  "Damascus",
  "Darnestown",
  "Derwood",
  "Four Corners",
  "Friendship Heights",
  "Gaithersburg",
  "Garrett Park",
  "Germantown",
  "Glenmont",
  "Hillandale",
  "Kensington",
  "Laytonsville",
  "Montgomery Village",
  "North Bethesda",
  "North Potomac",
  "Olney",
  "Poolesville",
  "Potomac",
  "Rockville",
  "Sandy Spring",
  "Silver Spring",
  "Takoma Park",
  "Travilah",
  "Washington Grove",
  "Wheaton",
  "White Oak",
] as const;

export const MONTGOMERY_COUNTY_MD_ZIP_CODES = [
  "20812",
  "20814",
  "20815",
  "20816",
  "20817",
  "20818",
  "20832",
  "20833",
  "20837",
  "20838",
  "20839",
  "20841",
  "20842",
  "20850",
  "20851",
  "20852",
  "20853",
  "20854",
  "20855",
  "20860",
  "20861",
  "20862",
  "20866",
  "20868",
  "20871",
  "20872",
  "20874",
  "20876",
  "20877",
  "20878",
  "20879",
  "20880",
  "20882",
  "20883",
  "20886",
  "20895",
  "20896",
  "20901",
  "20902",
  "20903",
  "20904",
  "20905",
  "20906",
  "20910",
  "20912",
] as const;

export const CURRENT_LAUNCH_AREA = "Montgomery County, Maryland";

export const SUPPORTED_LAUNCH_AREAS = [
  CURRENT_LAUNCH_AREA,
] as const;

const KNOWN_MARKET_AREAS = [
  CURRENT_LAUNCH_AREA,
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

export type ProviderMode = "Mobile" | "Shop" | "Both";

export function providerModeForWorkLocations(
  value: string | readonly string[],
): ProviderMode {
  const options = typeof value === "string"
    ? parseProviderWorkLocations(value)
    : value.filter((item) => (
      PROVIDER_WORK_LOCATION_OPTIONS.some((option) => option === item)
    ));
  const mobile = options.includes(PROVIDER_WORK_LOCATION_OPTIONS[0]);
  const shop = options.includes(PROVIDER_WORK_LOCATION_OPTIONS[1]);
  if (mobile && shop) return "Both";
  return shop ? "Shop" : "Mobile";
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
