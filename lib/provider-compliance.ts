import {
  parseProviderAreas,
  parseProviderServices,
  providerLegalAreas,
} from "./service-matching";

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
  virginiaCustomerPaperwork: boolean;
  tintCompliance: boolean;
  washWaterCompliance: boolean;
  officialInspectionRestriction: boolean;
  removedTireRule: boolean;
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
const FAIRFAX_COUNTY = "Fairfax County, Virginia";
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

const MONTGOMERY_REPAIR_SERVICES = new Set([
  "Battery jump-starts",
  TIRE_SERVICE,
  DIAGNOSTICS_SERVICE,
  "Body repair and paint estimates",
  TINT_SERVICE,
  RAIN_GUARD_SERVICE,
  SUNSHADE_SERVICE,
]);

// These launch services involve repair work, rather than diagnosis or estimates
// alone, under the Virginia Automobile Repair Facilities Act.
const VIRGINIA_REPAIR_PAPERWORK_SERVICES = new Set([
  "Battery jump-starts",
  TIRE_SERVICE,
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
  const servesFairfaxCounty = areas.includes(FAIRFAX_COUNTY);

  return {
    // Montgomery County Code Chapter 31A broadly covers repair, maintenance,
    // diagnosis, tires, windows, paint, and other installation work.
    montgomeryRegistration: servesMontgomeryCounty
      && services.some((service) => MONTGOMERY_REPAIR_SERVICES.has(service)),
    marylandCustomerPaperwork: servesMontgomeryCounty
      && services.some((service) => MONTGOMERY_REPAIR_SERVICES.has(service)),
    virginiaCustomerPaperwork: servesFairfaxCounty
      && services.some((service) => VIRGINIA_REPAIR_PAPERWORK_SERVICES.has(service)),
    tintCompliance: areas.length > 0 && services.includes(TINT_SERVICE),
    washWaterCompliance: areas.length > 0
      && (services.includes(CAR_WASH_SERVICE) || services.includes(LEGACY_CAR_WASH_SERVICE)),
    officialInspectionRestriction: areas.length > 0 && services.includes(DIAGNOSTICS_SERVICE),
    removedTireRule: areas.length > 0 && services.includes(TIRE_SERVICE),
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
  const servesFairfaxCounty = areas.includes(FAIRFAX_COUNTY);
  const isMontgomeryRepairService = MONTGOMERY_REPAIR_SERVICES.has(service);
  const requiresCustomerPaperwork = (servesMontgomeryCounty && isMontgomeryRepairService)
    || (servesFairfaxCounty && VIRGINIA_REPAIR_PAPERWORK_SERVICES.has(service));

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

  if (service === TINT_SERVICE) {
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

  if (service === CAR_WASH_SERVICE || service === LEGACY_CAR_WASH_SERVICE) {
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
