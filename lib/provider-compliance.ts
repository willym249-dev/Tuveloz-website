import {
  parseProviderAreas,
  parseProviderServices,
  PROVIDER_SERVICE_GROUPS,
  providerLegalAreas,
} from "./service-matching";
import {
  providerServiceIsPaused,
  providerServiceRequiresSpecialRules,
  serviceSafetyPolicyFor,
} from "./service-safety-policy";

export type ProviderAssessmentAnswer = "yes" | "no" | "unsure" | "not-required";

export type ProviderSelfAssessment = {
  businessRegistered: ProviderAssessmentAnswer;
  localRequirementsChecked: ProviderAssessmentAnswer;
  consumerDocumentsReady: ProviderAssessmentAnswer;
  safeRoadsideProcedure: ProviderAssessmentAnswer;
  diagnosticsScope: "basic-only" | "official-authorized" | "official-not-authorized" | "unsure";
  tintRequirementsReady: ProviderAssessmentAnswer;
  washWaterReady: ProviderAssessmentAnswer;
};

export type ProviderServiceStatus = {
  status: "ready" | "needs-review" | "blocked";
  reasons: string[];
};

export type ProviderLegalRequirementFlags = {
  montgomeryRegistration: boolean;
  marylandCustomerPaperwork: boolean;
  tintCompliance: boolean;
  washWaterCompliance: boolean;
  officialInspectionRestriction: boolean;
  removedTireRule: boolean;
  locksmithCredential: boolean;
  serviceSpecificRules: boolean;
  pausedService: boolean;
};

export const emptyProviderSelfAssessment: ProviderSelfAssessment = {
  businessRegistered: "unsure",
  localRequirementsChecked: "unsure",
  consumerDocumentsReady: "unsure",
  safeRoadsideProcedure: "unsure",
  diagnosticsScope: "basic-only",
  tintRequirementsReady: "unsure",
  washWaterReady: "unsure",
};

const MONTGOMERY_COUNTY = "Montgomery County, Maryland";
const REVIEWED_PROVIDER_AREAS = new Set([
  MONTGOMERY_COUNTY,
]);
const TINT_SERVICE = "Window tint installation";
const RAIN_GUARD_SERVICE = "Rain guard / vent visor installation";
const SUNSHADE_SERVICE = "Vehicle sunshade installation";
const DIAGNOSTICS_SERVICE = "Basic vehicle diagnostics";
const TIRE_SERVICE = "Spare-tire installation";
const CAR_WASH_SERVICE = "Car washing with water";
const LEGACY_CAR_WASH_SERVICE = "Car washing";
const MOBILE_CAR_WASH_SERVICE = "Mobile car washing";
const LOCKOUT_SERVICE = "Lockout assistance";

const ESTABLISHED_REVIEWED_SERVICES = new Set([
  "Battery jump-starts",
  TIRE_SERVICE,
  DIAGNOSTICS_SERVICE,
  "Body repair and paint estimates",
  TINT_SERVICE,
  RAIN_GUARD_SERVICE,
  SUNSHADE_SERVICE,
  "Waterless exterior washing",
  CAR_WASH_SERVICE,
  "Interior detailing",
]);

const EXPANDED_SERVICE_REVIEW = new Set(
  PROVIDER_SERVICE_GROUPS.flatMap((group) => (
    group.options
      .map((option) => option.value)
      .filter((service) => !ESTABLISHED_REVIEWED_SERVICES.has(service))
  )),
);

const MONTGOMERY_REPAIR_SERVICES = new Set([
  "Battery jump-starts",
  "Battery replacement",
  "Mobile mechanical service",
  "Mobile tire service",
  "Windshield chip repair",
  "Headlight restoration",
  TIRE_SERVICE,
  DIAGNOSTICS_SERVICE,
  "Body repair and paint estimates",
  "General auto repair",
  "Tire repair and replacement",
  "Brake service",
  "Transmission service",
  "Suspension and alignment",
  "Muffler and exhaust",
  TINT_SERVICE,
  "Body repair and paint",
  "Dent repair",
  "Auto glass replacement",
  "Wheel and rim repair",
  "Performance and tuning",
  "Vehicle wraps and graphics",
  "Car audio and electronics",
  RAIN_GUARD_SERVICE,
  SUNSHADE_SERVICE,
  "Pre-purchase inspections",
  "Fleet maintenance",
  "Trailer service",
  "Motorcycle service",
  "RV service",
  "Diesel service",
  "Hybrid and EV service",
  "Classic car restoration",
]);

/**
 * The statutory-category sets below are keyed by legacy display names, but the
 * public signup form submits catalog ServiceCodes from lib/provider-policy.ts.
 * This map places each catalog code into the already-reviewed legal categories
 * so requirement questions appear exactly when the underlying law applies —
 * e.g. Chapter 31A repair/maintenance coverage for jump starts and wiper
 * blades. Codes with no entry (photo documentation, visual observation,
 * towing, fuel delivery, official inspection) trigger no category here; their
 * gating lives in the evidence matrix instead.
 */
const SERVICE_CODE_LEGAL_EQUIVALENTS: Record<string, readonly string[]> = {
  general_auto_repair: ["General auto repair"],
  provisional_obd_read_only: [DIAGNOSTICS_SERVICE],
  provisional_wiper_blade_replacement: ["Mobile mechanical service"],
  provisional_engine_or_cabin_air_filter: ["Mobile mechanical service"],
  provisional_conventional_bulb_replacement: ["Mobile mechanical service"],
  provisional_fluid_topoff_limited: ["Mobile mechanical service"],
  provisional_12v_jump_start: ["Battery jump-starts"],
  provisional_12v_battery_replacement: ["Battery replacement"],
  provisional_temporary_spare_install: [TIRE_SERVICE],
  provisional_basic_detailing: [CAR_WASH_SERVICE, "Interior detailing"],
  sponsored_oil_filter_service: ["Mobile mechanical service"],
  battery_replacement: ["Battery replacement"],
  tire_repair_or_installation: ["Tire repair and replacement"],
  basic_vehicle_diagnostics: [DIAGNOSTICS_SERVICE],
  mobile_car_wash: [MOBILE_CAR_WASH_SERVICE],
  motor_vehicle_ac_service: ["Mobile mechanical service"],
  body_paint_refinishing: ["Body repair and paint"],
  window_tint_installation: [TINT_SERVICE],
  vehicle_lockout: [LOCKOUT_SERVICE],
  ev_high_voltage_service: ["Hybrid and EV service"],
};

/** A service plus the legal-category names it maps onto (identity included). */
function legalMatchNames(service: string): readonly string[] {
  const equivalents = SERVICE_CODE_LEGAL_EQUIVALENTS[service];
  return equivalents ? [service, ...equivalents] : [service];
}

function matchesCategory(service: string, category: ReadonlySet<string>) {
  return legalMatchNames(service).some((name) => category.has(name));
}

function matchesService(service: string, target: string) {
  return legalMatchNames(service).includes(target);
}

const TIRE_SERVICES = new Set([
  TIRE_SERVICE,
  "Mobile tire service",
  "Tire repair and replacement",
]);

const INDEPENDENT_INSPECTION_SERVICES = new Set([
  DIAGNOSTICS_SERVICE,
  "Pre-purchase inspections",
]);

const WASH_WATER_SERVICES = new Set([
  CAR_WASH_SERVICE,
  LEGACY_CAR_WASH_SERVICE,
  MOBILE_CAR_WASH_SERVICE,
]);

function cleanAnswer(value: unknown): ProviderAssessmentAnswer {
  return value === "yes" || value === "no" || value === "not-required"
    ? value
    : "unsure";
}

export function cleanProviderSelfAssessment(value: unknown): ProviderSelfAssessment {
  const input = value && typeof value === "object"
    ? value as Partial<Record<keyof ProviderSelfAssessment, unknown>>
    : {};
  const diagnosticsScope = input.diagnosticsScope === "basic-only"
    || input.diagnosticsScope === "official-authorized"
    || input.diagnosticsScope === "official-not-authorized"
    ? input.diagnosticsScope
    : "basic-only";
  return {
    businessRegistered: cleanAnswer(input.businessRegistered),
    localRequirementsChecked: cleanAnswer(input.localRequirementsChecked),
    consumerDocumentsReady: cleanAnswer(input.consumerDocumentsReady),
    safeRoadsideProcedure: cleanAnswer(input.safeRoadsideProcedure),
    diagnosticsScope,
    tintRequirementsReady: cleanAnswer(input.tintRequirementsReady),
    washWaterReady: cleanAnswer(input.washWaterReady),
  };
}

export function parseProviderSelfAssessment(value: string) {
  try {
    return cleanProviderSelfAssessment(JSON.parse(value));
  } catch {
    return { ...emptyProviderSelfAssessment };
  }
}

function normalizeServices(providerServices: string | string[]) {
  return Array.isArray(providerServices)
    ? providerServices
    : parseProviderServices(providerServices);
}

function normalizeAreas(providerAreas: string | string[]) {
  const areas = Array.isArray(providerAreas)
    ? providerAreas
    : parseProviderAreas(providerAreas);
  return providerLegalAreas(areas);
}

export function providerAreasHaveReviewedCompliance(
  providerAreas: string | string[],
) {
  const areas = normalizeAreas(providerAreas);
  return areas.length > 0 && areas.every((area) => REVIEWED_PROVIDER_AREAS.has(area));
}

function buildStatus(blockers: string[], reviews: string[]): ProviderServiceStatus {
  return {
    status: blockers.length > 0
      ? "blocked"
      : reviews.length > 0
        ? "needs-review"
        : "ready",
    reasons: [...new Set([...blockers, ...reviews])],
  };
}

export function getProviderLegalRequirementFlags(
  providerServices: string | string[],
  providerAreas: string | string[],
): ProviderLegalRequirementFlags {
  const services = normalizeServices(providerServices);
  const areas = normalizeAreas(providerAreas);
  const servesMontgomeryCounty = areas.includes(MONTGOMERY_COUNTY);

  return {
    // Montgomery County Code Chapter 31A broadly covers repair, maintenance,
    // diagnosis, tires, windows, paint, and other installation work.
    montgomeryRegistration: servesMontgomeryCounty
      && services.some((service) => matchesCategory(service, MONTGOMERY_REPAIR_SERVICES)),
    marylandCustomerPaperwork: servesMontgomeryCounty
      && services.some((service) => matchesCategory(service, MONTGOMERY_REPAIR_SERVICES)),
    tintCompliance: areas.length > 0
      && services.some((service) => matchesService(service, TINT_SERVICE)),
    washWaterCompliance: areas.length > 0
      && services.some((service) => matchesCategory(service, WASH_WATER_SERVICES)),
    officialInspectionRestriction: areas.length > 0
      && services.some((service) => matchesCategory(service, INDEPENDENT_INSPECTION_SERVICES)),
    removedTireRule: areas.length > 0
      && services.some((service) => matchesCategory(service, TIRE_SERVICES)),
    locksmithCredential: areas.length > 0
      && services.some((service) => matchesService(service, LOCKOUT_SERVICE)),
    serviceSpecificRules: areas.length > 0
      && services.some((service) => providerServiceRequiresSpecialRules(service)),
    pausedService: services.some((service) => providerServiceIsPaused(service)),
  };
}

function evaluateService(
  service: string,
  areas: string[],
  assessment: ProviderSelfAssessment,
) {
  const blockers: string[] = [];
  const reviews: string[] = [];
  const servesMontgomeryCounty = areas.includes(MONTGOMERY_COUNTY);
  const isMontgomeryRepairService = matchesCategory(service, MONTGOMERY_REPAIR_SERVICES);
  const requiresCustomerPaperwork = servesMontgomeryCounty && isMontgomeryRepairService;
  const safetyPolicy = serviceSafetyPolicyFor(service);

  if (providerServiceIsPaused(service)) {
    blockers.push(safetyPolicy.activationSummary);
  }

  if (servesMontgomeryCounty && isMontgomeryRepairService) {
    if (assessment.businessRegistered === "no") {
      blockers.push(
        "Montgomery County repair registration is legally required for this service.",
      );
    } else if (assessment.businessRegistered !== "yes") {
      reviews.push(
        "Confirm the legally required Montgomery County repair registration.",
      );
    }
  }

  if (requiresCustomerPaperwork) {
    if (assessment.consumerDocumentsReady === "no") {
      blockers.push(
        "The legally required customer authorization and invoice process is not ready.",
      );
    } else if (assessment.consumerDocumentsReady !== "yes") {
      reviews.push(
        "Confirm the legally required customer authorization and invoice process.",
      );
    }
  }

  if (matchesService(service, TINT_SERVICE)) {
    if (assessment.tintRequirementsReady === "no") {
      blockers.push(
        "Window tint installation must follow the legal limits for the vehicle and state.",
      );
    } else if (assessment.tintRequirementsReady !== "yes") {
      reviews.push(
        "Confirm compliance with the legal tint limits for the vehicle and state.",
      );
    }
  }

  if (matchesCategory(service, WASH_WATER_SERVICES)) {
    if (assessment.washWaterReady === "no") {
      blockers.push(
        "Commercial car-wash water must be kept out of storm drains and waterways.",
      );
    } else if (assessment.washWaterReady !== "yes") {
      reviews.push(
        "Confirm the legally required commercial wash-water disposal process.",
      );
    }
  }

  if (matchesService(service, LOCKOUT_SERVICE)) {
    reviews.push(
      "Verify the active Maryland locksmith business license, the registration of the person performing the work, required insurance, and the per-job customer/vehicle authorization process.",
    );
  }

  if (matchesCategory(service, TIRE_SERVICES)) {
    reviews.push(
      "Confirm that a removed tire remains with the customer or follows a lawful approved disposal process.",
    );
  }

  if (matchesCategory(service, INDEPENDENT_INSPECTION_SERVICES)) {
    reviews.push(
      "Keep independent diagnostics separate from an official Maryland safety inspection unless the station and mechanic credentials are verified for that exact service.",
    );
  }

  if (providerServiceRequiresSpecialRules(service)) {
    reviews.push(safetyPolicy.activationSummary);
  }

  if (EXPANDED_SERVICE_REVIEW.has(service)) {
    reviews.push(
      "Confirm the service-specific legal, insurance, training, safety, and local rules before activation. Require a credential only if an applicable law requires it.",
    );
  }

  return buildStatus(blockers, reviews);
}

export function evaluateProviderServices(
  providerServices: string | string[],
  providerAreas: string | string[],
  assessment: ProviderSelfAssessment,
) {
  const services = normalizeServices(providerServices);
  const areas = normalizeAreas(providerAreas);

  return Object.fromEntries(services.map((service) => [
    service,
    evaluateService(service, areas, assessment),
  ])) as Record<string, ProviderServiceStatus>;
}

export function evaluateProviderGeneralRequirements(
  providerServices: string | string[],
  providerAreas: string | string[],
  assessment: ProviderSelfAssessment,
) {
  const statuses = Object.values(
    evaluateProviderServices(providerServices, providerAreas, assessment),
  );
  const blockers = statuses
    .filter((result) => result.status === "blocked")
    .flatMap((result) => result.reasons);
  const reviews = statuses
    .filter((result) => result.status === "needs-review")
    .flatMap((result) => result.reasons);
  return buildStatus(blockers, reviews);
}

export function parseServiceStatuses(value: string) {
  try {
    return JSON.parse(value) as Record<string, ProviderServiceStatus>;
  } catch {
    return {};
  }
}
