export const LEGAL_PROFESSIONAL_REVIEW_STATUSES = [
  "not_obtained_owner_proceeding",
  "obtained_optional",
] as const;

export type LegalProfessionalReviewStatus = (
  typeof LEGAL_PROFESSIONAL_REVIEW_STATUSES
)[number];

export type MandatoryLegalComplianceEvidence = {
  serviceCode: string;
  jurisdiction: string;
  reviewedAt: string;
  validThrough: string;
  reviewedBy: string;
  reference: string;
  applicableRequirementsSummary: string;
  officialSourceReferences: string[];
  ownerAcknowledged: boolean;
  professionalReviewStatus: LegalProfessionalReviewStatus | "";
  proceedingWithoutCounselAcknowledged: boolean;
};

export type MandatoryLegalComplianceScope = {
  serviceCode: string;
  jurisdiction: string;
};

const CONSUMER_PROTECTION_SOURCE =
  "https://mgaleg.maryland.gov/mgawebsite/Laws/StatuteText?article=gcl&section=13-301";
const MONTGOMERY_REPAIR_REGISTRATION_SOURCE =
  "https://www.montgomerycountymd.gov/OCP/licensing/mvr_tow_main.html";
const MARYLAND_REPAIR_INVOICE_SOURCE =
  "https://mgaleg.maryland.gov/mgawebsite/Laws/StatuteText?article=gcl&section=14-1003";
const MARYLAND_REPAIR_AUTHORIZATION_SOURCE =
  "https://mgaleg.maryland.gov/mgawebsite/Laws/StatuteText?article=gcl&section=14-1008";

const REPAIR_BASELINE_SOURCES = [
  CONSUMER_PROTECTION_SOURCE,
  MONTGOMERY_REPAIR_REGISTRATION_SOURCE,
  MARYLAND_REPAIR_INVOICE_SOURCE,
  MARYLAND_REPAIR_AUTHORIZATION_SOURCE,
] as const;

const SERVICE_SPECIFIC_OFFICIAL_SOURCES: Record<string, readonly string[]> = {
  general_auto_repair: REPAIR_BASELINE_SOURCES,
  photo_documentation_only: [CONSUMER_PROTECTION_SOURCE],
  provisional_visual_observation_report: [CONSUMER_PROTECTION_SOURCE],
  provisional_obd_read_only: [CONSUMER_PROTECTION_SOURCE],
  provisional_wiper_blade_replacement: REPAIR_BASELINE_SOURCES,
  provisional_engine_or_cabin_air_filter: REPAIR_BASELINE_SOURCES,
  provisional_conventional_bulb_replacement: REPAIR_BASELINE_SOURCES,
  provisional_fluid_topoff_limited: REPAIR_BASELINE_SOURCES,
  provisional_12v_jump_start: REPAIR_BASELINE_SOURCES,
  provisional_12v_battery_replacement: [
    ...REPAIR_BASELINE_SOURCES,
    "https://regs.maryland.gov/us/md/exec/comar/26.13.10.04",
  ],
  provisional_temporary_spare_install: REPAIR_BASELINE_SOURCES,
  provisional_basic_detailing: [
    CONSUMER_PROTECTION_SOURCE,
    MONTGOMERY_REPAIR_REGISTRATION_SOURCE,
  ],
  sponsored_oil_filter_service: REPAIR_BASELINE_SOURCES,
  battery_replacement: [
    ...REPAIR_BASELINE_SOURCES,
    "https://regs.maryland.gov/us/md/exec/comar/26.13.10.04",
  ],
  tire_repair_or_installation: [
    ...REPAIR_BASELINE_SOURCES,
    "https://mde.maryland.gov/programs/land/WasteManagement/Pages/ScrapTires.aspx",
  ],
  basic_vehicle_diagnostics: REPAIR_BASELINE_SOURCES,
  mobile_car_wash: [
    CONSUMER_PROTECTION_SOURCE,
    MONTGOMERY_REPAIR_REGISTRATION_SOURCE,
  ],
  motor_vehicle_ac_service: [
    ...REPAIR_BASELINE_SOURCES,
    "https://www.epa.gov/mvac/regulatory-requirements-mvac-system-servicing",
  ],
  body_paint_refinishing: [
    ...REPAIR_BASELINE_SOURCES,
    "https://mde.maryland.gov/programs/Permits/AirManagementPermits/Pages/AirQualityGeneralPermit.aspx",
  ],
  window_tint_installation: [
    ...REPAIR_BASELINE_SOURCES,
    "https://mgaleg.maryland.gov/mgawebsite/laws/StatuteText?article=gtr&section=22-406",
  ],
  vehicle_lockout: [
    ...REPAIR_BASELINE_SOURCES,
    "https://www.labor.maryland.gov/license/locksmiths/lockadvisory.shtml",
  ],
  official_vehicle_inspection: [
    ...REPAIR_BASELINE_SOURCES,
    "https://mdsp.maryland.gov/safety-prevention/vehicle-safety-inspections/inspection-stations-and-mechanics",
  ],
  fuel_delivery: [
    CONSUMER_PROTECTION_SOURCE,
    "https://www.marylandcomptroller.gov/content/dam/mdcomp/tax/forms/motor-fuel/MFT023.pdf",
    "https://mde.maryland.gov/programs/land/OilControl/Pages/asthome.aspx",
  ],
  ev_high_voltage_service: [
    ...REPAIR_BASELINE_SOURCES,
    "https://www.nhtsa.gov/vehicle-safety/electric-and-hybrid-vehicles",
  ],
};

export function requiredOfficialLegalSourceReferences(
  serviceCode: string,
  jurisdiction: string,
) {
  if (jurisdiction !== "US-MD-MontgomeryCounty") return [] as string[];
  return [...(SERVICE_SPECIFIC_OFFICIAL_SOURCES[serviceCode] ?? [])];
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function nonblank(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeOfficialSourceReferences(value: unknown) {
  const values = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/\r?\n/)
      : [];
  return [...new Set(values
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean))]
    .slice(0, 25);
}

export function officialSourceReferenceIsValid(value: string) {
  if (value.length > 500) return false;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    return url.protocol === "https:"
      && host.endsWith(".gov")
      && host.length > ".gov".length;
  } catch {
    return false;
  }
}

function dateValue(value: string, endOfDay = false) {
  const normalized = endOfDay && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? `${value}T23:59:59.999Z`
    : /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? `${value}T00:00:00.000Z`
      : value;
  const parsed = Date.parse(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Compliance evidence is deliberately short-lived. The reviewer/approver
 * date cannot be in the future, the evidence must cover the requested time,
 * and an owner cannot create a review window longer than one calendar year.
 */
export function annualComplianceReviewWindowIsValid(
  reviewedAt: string,
  validThrough: string,
  through: number | Date = Date.now(),
  now = Date.now(),
) {
  const reviewed = dateValue(reviewedAt);
  const validUntil = dateValue(validThrough, true);
  const requiredThrough = through instanceof Date ? through.getTime() : through;
  if (
    reviewed === null
    || validUntil === null
    || !Number.isFinite(requiredThrough)
    || reviewed > now
    || validUntil < requiredThrough
  ) return false;
  const maximum = new Date(reviewed);
  maximum.setUTCFullYear(maximum.getUTCFullYear() + 1);
  maximum.setUTCHours(23, 59, 59, 999);
  return validUntil <= maximum.getTime();
}

export function mandatoryLegalComplianceEvidenceFromContext(
  context: Record<string, unknown>,
): MandatoryLegalComplianceEvidence {
  const nested = asRecord(context.mandatoryLegalRequirements);
  const status = nonblank(
    context.legalProfessionalReviewStatus ?? nested.professionalReviewStatus,
  );
  return {
    serviceCode: nonblank(
      context.legalRequirementsServiceCode ?? nested.serviceCode,
    ),
    jurisdiction: nonblank(
      context.legalRequirementsJurisdiction ?? nested.jurisdiction,
    ),
    reviewedAt: nonblank(
      context.legalRequirementsReviewedAt ?? nested.reviewedAt,
    ),
    validThrough: nonblank(
      context.legalRequirementsValidThrough ?? nested.validThrough,
    ),
    reviewedBy: nonblank(
      context.legalRequirementsReviewedBy ?? nested.reviewedBy,
    ),
    reference: nonblank(
      context.legalRequirementsReference ?? nested.reference,
    ),
    applicableRequirementsSummary: nonblank(
      context.applicableRequirementsSummary ?? nested.applicableRequirementsSummary,
    ),
    officialSourceReferences: normalizeOfficialSourceReferences(
      context.officialSourceReferences ?? nested.officialSourceReferences,
    ),
    ownerAcknowledged: (
      context.ownerLegalComplianceAcknowledged === true
      || nested.ownerAcknowledged === true
    ),
    professionalReviewStatus: LEGAL_PROFESSIONAL_REVIEW_STATUSES.includes(
      status as LegalProfessionalReviewStatus,
    )
      ? status as LegalProfessionalReviewStatus
      : "",
    proceedingWithoutCounselAcknowledged: (
      context.explicitProceedingWithoutCounsel === true
      || nested.explicitProceedingWithoutCounsel === true
    ),
  };
}

export function hasCompleteMandatoryLegalComplianceEvidence(
  context: Record<string, unknown>,
  expectedScope: MandatoryLegalComplianceScope,
  through: number | Date = Date.now(),
) {
  const evidence = mandatoryLegalComplianceEvidenceFromContext(context);
  const requiredOfficialSources = requiredOfficialLegalSourceReferences(
    expectedScope.serviceCode.trim(),
    expectedScope.jurisdiction.trim(),
  );
  const scopeIsComplete = Boolean(evidence.serviceCode && evidence.jurisdiction);
  const scopeMatches = (
    evidence.serviceCode === expectedScope.serviceCode.trim()
    && evidence.jurisdiction === expectedScope.jurisdiction.trim()
  );
  const professionalReviewChoiceIsComplete = Boolean(evidence.professionalReviewStatus)
    && (
      evidence.professionalReviewStatus !== "not_obtained_owner_proceeding"
      || evidence.proceedingWithoutCounselAcknowledged
    );
  return scopeIsComplete
    && scopeMatches
    && annualComplianceReviewWindowIsValid(
      evidence.reviewedAt,
      evidence.validThrough,
      through,
    )
    && evidence.reviewedBy.length >= 2
    && evidence.reference.length >= 8
    && evidence.applicableRequirementsSummary.length >= 40
    && evidence.officialSourceReferences.length > 0
    && evidence.officialSourceReferences.every(officialSourceReferenceIsValid)
    && requiredOfficialSources.length > 0
    && requiredOfficialSources.every((requiredSource) => (
      evidence.officialSourceReferences.includes(requiredSource)
    ))
    && evidence.ownerAcknowledged
    && professionalReviewChoiceIsComplete;
}
