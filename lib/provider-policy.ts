import rawPolicyMatrix from "../config/provider-eligibility-matrix.json";

export const PROVIDER_PATHWAY_CODES = [
  "independent_startup",
  "sponsored_trainee_employee",
  "provider_business_employee",
] as const;

export type ProviderPathway = (typeof PROVIDER_PATHWAY_CODES)[number];

export const PROVIDER_LEVEL_CODES = [
  "learning_account",
  "sponsored_trainee",
  "provisional_independent",
  "standard_provider",
  "specialty_provider",
] as const;

export type ProviderLevel = (typeof PROVIDER_LEVEL_CODES)[number];

export const SERVICE_CODES = [
  "general_auto_repair",
  "photo_documentation_only",
  "provisional_visual_observation_report",
  "provisional_obd_read_only",
  "provisional_wiper_blade_replacement",
  "provisional_engine_or_cabin_air_filter",
  "provisional_conventional_bulb_replacement",
  "provisional_fluid_topoff_limited",
  "provisional_12v_jump_start",
  "provisional_12v_battery_replacement",
  "provisional_temporary_spare_install",
  "provisional_basic_detailing",
  "sponsored_oil_filter_service",
  "battery_replacement",
  "tire_repair_or_installation",
  "basic_vehicle_diagnostics",
  "mobile_car_wash",
  "motor_vehicle_ac_service",
  "body_paint_refinishing",
  "window_tint_installation",
  "towing_or_storage",
  "vehicle_lockout",
  "official_vehicle_inspection",
  "fuel_delivery",
  "ev_high_voltage_service",
] as const;

export type ServiceCode = (typeof SERVICE_CODES)[number];
export type EvidenceRequirementCode = keyof typeof rawPolicyMatrix.evidence_types;

export type PolicyVersion = "0.11";
export type PolicyStatus = "draft_pending_mandatory_compliance_insurance_tax";
export type PolicyJurisdiction = "US-MD-MontgomeryCounty";
export type DefaultPolicy = "deny";

export type ServiceLaunchState =
  | "enabled"
  | "prohibited_broad_category"
  | "disabled_pending_written_ocp_mandatory_requirements"
  | "disabled_pending_mandatory_requirements_insurer"
  | "disabled_pending_environmental_ocp_mandatory_requirements"
  | "disabled_pending_mandatory_requirements"
  | "disabled_pending_environmental_review"
  | "disabled_pending_agency_mandatory_requirements_insurer";

export interface ProviderPathwayDefinition {
  description: string;
  [key: string]: unknown;
}

export interface ProviderLevelDefinition {
  customer_job_access: false | string;
  allowed_service_codes: readonly ServiceCode[];
  [key: string]: unknown;
}

export interface EvidenceRequirementDefinition {
  label: string;
  requires_expiration: boolean | string;
  private: boolean;
  [key: string]: unknown;
}

export interface ServicePolicyDefinition {
  launch_state: ServiceLaunchState;
  customer_visible: boolean;
  allowed_pathways: readonly ProviderPathway[];
  allowed_provider_levels: readonly ProviderLevel[];
  jurisdictions: readonly string[];
  requirements?: readonly EvidenceRequirementCode[];
  path_requirements?: Partial<
    Record<ProviderPathway, readonly EvidenceRequirementCode[]>
  >;
  [key: string]: unknown;
}

export interface ProviderPolicyMatrix {
  schema_version: PolicyVersion;
  status: PolicyStatus;
  jurisdiction: PolicyJurisdiction;
  default_policy: DefaultPolicy;
  provider_pathways: Record<ProviderPathway, ProviderPathwayDefinition>;
  provider_levels: Record<ProviderLevel, ProviderLevelDefinition>;
  pathway_level_compatibility: Record<
    ProviderPathway,
    readonly ProviderLevel[]
  >;
  evidence_types: Record<
    EvidenceRequirementCode,
    EvidenceRequirementDefinition
  >;
  services: Record<ServiceCode, ServicePolicyDefinition>;
  [key: string]: unknown;
}

const PATHWAY_SET: ReadonlySet<string> = new Set(PROVIDER_PATHWAY_CODES);
const LEVEL_SET: ReadonlySet<string> = new Set(PROVIDER_LEVEL_CODES);
const SERVICE_CODE_SET: ReadonlySet<string> = new Set(SERVICE_CODES);
const LAUNCH_STATE_SET: ReadonlySet<string> = new Set<ServiceLaunchState>([
  "enabled",
  "prohibited_broad_category",
  "disabled_pending_written_ocp_mandatory_requirements",
  "disabled_pending_mandatory_requirements_insurer",
  "disabled_pending_environmental_ocp_mandatory_requirements",
  "disabled_pending_mandatory_requirements",
  "disabled_pending_environmental_review",
  "disabled_pending_agency_mandatory_requirements_insurer",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertExactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
  label: string,
) {
  const actual = Object.keys(value);
  const unexpected = actual.filter((code) => !expected.includes(code));
  const missing = expected.filter((code) => !Object.hasOwn(value, code));
  if (unexpected.length || missing.length) {
    throw new Error(
      `${label} does not match the catalog (missing: ${missing.join(", ") || "none"}; unexpected: ${unexpected.join(", ") || "none"}).`,
    );
  }
}

function assertCodeArray(
  value: unknown,
  allowed: ReadonlySet<string>,
  label: string,
) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !allowed.has(item))) {
    throw new Error(`${label} contains an unknown code.`);
  }
}

function assertProviderPolicyMatrix(
  value: unknown,
): asserts value is ProviderPolicyMatrix {
  if (!isRecord(value)) throw new Error("Provider policy matrix must be an object.");
  if (value.schema_version !== "0.11") throw new Error("Unexpected provider policy version.");
  if (value.status !== "draft_pending_mandatory_compliance_insurance_tax") throw new Error("Unexpected provider policy status.");
  if (value.jurisdiction !== "US-MD-MontgomeryCounty") throw new Error("Unexpected provider policy jurisdiction.");
  if (value.default_policy !== "deny") throw new Error("Provider policy must default to deny.");

  if (!isRecord(value.provider_pathways)) throw new Error("Provider pathways are missing.");
  assertExactKeys(value.provider_pathways, PROVIDER_PATHWAY_CODES, "Provider pathways");
  for (const code of PROVIDER_PATHWAY_CODES) {
    const pathway = value.provider_pathways[code];
    if (!isRecord(pathway) || typeof pathway.description !== "string") {
      throw new Error(`Provider pathway ${code} is invalid.`);
    }
  }

  if (!isRecord(value.provider_levels)) throw new Error("Provider levels are missing.");
  assertExactKeys(value.provider_levels, PROVIDER_LEVEL_CODES, "Provider levels");
  for (const code of PROVIDER_LEVEL_CODES) {
    const level = value.provider_levels[code];
    if (!isRecord(level)) throw new Error(`Provider level ${code} is invalid.`);
    assertCodeArray(level.allowed_service_codes, SERVICE_CODE_SET, `${code}.allowed_service_codes`);
  }

  if (!isRecord(value.pathway_level_compatibility)) {
    throw new Error("Pathway-level compatibility is missing.");
  }
  assertExactKeys(
    value.pathway_level_compatibility,
    PROVIDER_PATHWAY_CODES,
    "Pathway-level compatibility",
  );
  for (const code of PROVIDER_PATHWAY_CODES) {
    assertCodeArray(
      value.pathway_level_compatibility[code],
      LEVEL_SET,
      `${code}.compatible_levels`,
    );
  }

  if (!isRecord(value.evidence_types)) throw new Error("Evidence types are missing.");
  const evidenceCodeSet: ReadonlySet<string> = new Set(Object.keys(value.evidence_types));

  if (!isRecord(value.services)) throw new Error("Service policies are missing.");
  assertExactKeys(value.services, SERVICE_CODES, "Service policies");
  for (const code of SERVICE_CODES) {
    const service = value.services[code];
    if (!isRecord(service)) throw new Error(`Service policy ${code} is invalid.`);
    if (typeof service.launch_state !== "string" || !LAUNCH_STATE_SET.has(service.launch_state)) {
      throw new Error(`Service ${code} has an unknown launch state.`);
    }
    if (typeof service.customer_visible !== "boolean") {
      throw new Error(`Service ${code} has an invalid customer visibility value.`);
    }
    assertCodeArray(service.allowed_pathways, PATHWAY_SET, `${code}.allowed_pathways`);
    assertCodeArray(service.allowed_provider_levels, LEVEL_SET, `${code}.allowed_provider_levels`);
    if (!Array.isArray(service.jurisdictions) || service.jurisdictions.some((item) => typeof item !== "string")) {
      throw new Error(`Service ${code} has invalid jurisdictions.`);
    }
    if (service.requirements !== undefined) {
      assertCodeArray(service.requirements, evidenceCodeSet, `${code}.requirements`);
    }
    if (service.path_requirements !== undefined) {
      if (!isRecord(service.path_requirements)) {
        throw new Error(`Service ${code} has invalid pathway requirements.`);
      }
      for (const [pathway, requirements] of Object.entries(service.path_requirements)) {
        if (!PATHWAY_SET.has(pathway)) {
          throw new Error(`Service ${code} has requirements for unknown pathway ${pathway}.`);
        }
        assertCodeArray(requirements, evidenceCodeSet, `${code}.${pathway}.requirements`);
      }
    }
  }
}

assertProviderPolicyMatrix(rawPolicyMatrix);

export const PROVIDER_POLICY_MATRIX: ProviderPolicyMatrix = rawPolicyMatrix;
export const POLICY_VERSION = PROVIDER_POLICY_MATRIX.schema_version;
export const POLICY_STATUS = PROVIDER_POLICY_MATRIX.status;
export const POLICY_JURISDICTION = PROVIDER_POLICY_MATRIX.jurisdiction;
export const POLICY_DEFAULT = PROVIDER_POLICY_MATRIX.default_policy;

export const PROVIDER_PATHWAY_LABELS = {
  independent_startup: "Independent startup",
  sponsored_trainee_employee: "Sponsored trainee employee",
  provider_business_employee: "Provider business employee",
} as const satisfies Record<ProviderPathway, string>;

export interface ProviderPathwayCatalogEntry {
  code: ProviderPathway;
  label: string;
  description: string;
  allowedLevels: readonly ProviderLevel[];
}

export const PROVIDER_PATHWAYS: readonly ProviderPathwayCatalogEntry[] =
  Object.freeze(PROVIDER_PATHWAY_CODES.map((code) => Object.freeze({
    code,
    label: PROVIDER_PATHWAY_LABELS[code],
    description: PROVIDER_POLICY_MATRIX.provider_pathways[code].description,
    allowedLevels: PROVIDER_POLICY_MATRIX.pathway_level_compatibility[code],
  })));

export const PROVIDER_LEVEL_LABELS = {
  learning_account: "Applicant-only account",
  sponsored_trainee: "Sponsored trainee",
  provisional_independent: "Provisional independent",
  standard_provider: "Standard provider",
  specialty_provider: "Specialty provider",
} as const satisfies Record<ProviderLevel, string>;

const PROVIDER_LEVEL_DESCRIPTIONS = {
  learning_account: "Applicant-interest account with no TUVELOZ training, employment, customer jobs, or payouts.",
  sponsored_trainee: "Paid trainee employed, trained, assigned, and supervised by a separate approved provider business.",
  provisional_independent: "Independent owner-operator limited to approved provisional service codes.",
  standard_provider: "Registered provider approved for standard service codes.",
  specialty_provider: "Registered provider approved for specialty service codes and controls.",
} as const satisfies Record<ProviderLevel, string>;

export interface ProviderLevelCatalogEntry {
  code: ProviderLevel;
  label: string;
  description: string;
  customerJobAccess: false | string;
  allowedServiceCodes: readonly ServiceCode[];
}

export const PROVIDER_LEVELS: readonly ProviderLevelCatalogEntry[] =
  Object.freeze(PROVIDER_LEVEL_CODES.map((code) => Object.freeze({
    code,
    label: PROVIDER_LEVEL_LABELS[code],
    description: PROVIDER_LEVEL_DESCRIPTIONS[code],
    customerJobAccess: PROVIDER_POLICY_MATRIX.provider_levels[code].customer_job_access,
    allowedServiceCodes: PROVIDER_POLICY_MATRIX.provider_levels[code].allowed_service_codes,
  })));

const SERVICE_METADATA = {
  general_auto_repair: {
    label: "General auto repair",
    description: "A prohibited broad umbrella category; every job must use a specifically approved service code.",
  },
  photo_documentation_only: {
    label: "Photo documentation only",
    description: "Captures customer-requested vehicle photos and customer-provided facts without diagnosis, inspection, or repair advice.",
  },
  provisional_visual_observation_report: {
    label: "Provisional visual observation report",
    description: "Provides a nonofficial visual observation and factual condition report without a pass/fail or safety determination.",
  },
  provisional_obd_read_only: {
    label: "Provisional OBD-II read-only service",
    description: "Reads and reports raw OBD-II codes without clearing codes, programming, or claiming a proven repair.",
  },
  provisional_wiper_blade_replacement: {
    label: "Provisional wiper-blade replacement",
    description: "Replaces a vehicle-specific wiper blade within the limited provisional workflow.",
  },
  provisional_engine_or_cabin_air_filter: {
    label: "Provisional engine or cabin air-filter replacement",
    description: "Replaces a simple engine or cabin air filter without complex trim, sensor, airbag-area, or high-voltage work.",
  },
  provisional_conventional_bulb_replacement: {
    label: "Provisional conventional-bulb replacement",
    description: "Replaces an approved conventional vehicle bulb without advanced lighting, programming, or high-voltage work.",
  },
  provisional_fluid_topoff_limited: {
    label: "Provisional limited fluid top-off",
    description: "Performs only an approved, limited fluid top-off under the provisional service controls.",
  },
  provisional_12v_jump_start: {
    label: "Provisional 12-volt jump start",
    description: "Provides a 12-volt jump start under approved roadside and stop-work controls.",
  },
  provisional_12v_battery_replacement: {
    label: "Provisional 12-volt battery replacement",
    description: "Replaces an approved 12-volt battery under provisional roadside, competency, and spent-battery controls.",
  },
  provisional_temporary_spare_install: {
    label: "Provisional temporary-spare installation",
    description: "Installs a vehicle-compatible temporary spare under limited roadside and safety controls.",
  },
  provisional_basic_detailing: {
    label: "Provisional basic detailing",
    description: "Performs approved basic detailing under the required wash-water and environmental controls.",
  },
  sponsored_oil_filter_service: {
    label: "Sponsored oil and filter service",
    description: "Performs an approved oil-and-filter service only through the sponsored trainee pathway with direct supervision.",
  },
  battery_replacement: {
    label: "Battery replacement",
    description: "Replaces a standard vehicle battery with required registration, insurance, and spent-battery handling evidence.",
  },
  tire_repair_or_installation: {
    label: "Tire repair or installation",
    description: "Performs approved tire repair or installation under the standard-provider workflow.",
  },
  basic_vehicle_diagnostics: {
    label: "Basic vehicle diagnostics",
    description: "Performs limited non-SRS, non-ADAS, non-high-voltage diagnostics without an official inspection representation.",
  },
  mobile_car_wash: {
    label: "Mobile car wash",
    description: "Performs an approved vehicle-wash process with required wash-water capture and disposal controls.",
  },
  motor_vehicle_ac_service: {
    label: "Motor-vehicle air-conditioning service",
    description: "Performs approved refrigerant service under the EPA Section 609 and specialty-service workflow.",
  },
  body_paint_refinishing: {
    label: "Body and paint refinishing",
    description: "Performs body and paint refinishing only at an approved permitted facility.",
  },
  window_tint_installation: {
    label: "Window-tint installation",
    description: "Installs window tint only under approved legal-compliance and meter controls.",
  },
  towing_or_storage: {
    label: "Towing or storage",
    description: "Provides approved towing or storage with the required registrations and custody coverage.",
  },
  vehicle_lockout: {
    label: "Vehicle lockout",
    description: "Provides lockout assistance only through the approved licensed-locksmith identity and location workflow.",
  },
  official_vehicle_inspection: {
    label: "Official vehicle inspection",
    description: "Performs an official inspection only at a licensed fixed station with a licensed inspection mechanic.",
  },
  fuel_delivery: {
    label: "Emergency fuel delivery",
    description: "Provides approved emergency fuel delivery under the required fuel, hazmat, spill, environmental, and fire controls.",
  },
  ev_high_voltage_service: {
    label: "EV high-voltage service",
    description: "Reserved for a future nonempty EV high-voltage scope that satisfies mandatory legal, agency, insurance, training, PPE, tool, facility, and emergency requirements.",
  },
} as const satisfies Record<ServiceCode, { label: string; description: string }>;

export interface ServicePolicyCatalogEntry {
  code: ServiceCode;
  label: string;
  description: string;
  launchState: ServiceLaunchState;
  customerVisible: boolean;
  allowedPathways: readonly ProviderPathway[];
  allowedProviderLevels: readonly ProviderLevel[];
  evidenceRequirementsByPathway: Readonly<
    Partial<Record<ProviderPathway, readonly EvidenceRequirementCode[]>>
  >;
}

function buildServicePolicyCatalog() {
  const catalog = {} as Record<ServiceCode, ServicePolicyCatalogEntry>;

  for (const code of SERVICE_CODES) {
    const definition = PROVIDER_POLICY_MATRIX.services[code];
    const evidenceRequirementsByPathway: Partial<
      Record<ProviderPathway, readonly EvidenceRequirementCode[]>
    > = {};

    for (const pathway of definition.allowed_pathways) {
      evidenceRequirementsByPathway[pathway] = Object.freeze([
        ...(definition.path_requirements?.[pathway] ?? definition.requirements ?? []),
      ]);
    }

    catalog[code] = Object.freeze({
      code,
      label: SERVICE_METADATA[code].label,
      description: SERVICE_METADATA[code].description,
      launchState: definition.launch_state,
      customerVisible: definition.customer_visible,
      allowedPathways: definition.allowed_pathways,
      allowedProviderLevels: definition.allowed_provider_levels,
      evidenceRequirementsByPathway: Object.freeze(evidenceRequirementsByPathway),
    });
  }

  return Object.freeze(catalog);
}

export const SERVICE_POLICY_CATALOG = buildServicePolicyCatalog();
export const SERVICES: readonly ServicePolicyCatalogEntry[] = Object.freeze(
  SERVICE_CODES.map((code) => SERVICE_POLICY_CATALOG[code]),
);

/**
 * Legacy/current UI values can be broader than one policy service. An alias is
 * never authorization: callers must choose one exact service code and run the
 * validation helpers below.
 */
export const UI_SERVICE_VALUE_ALIASES = {
  "General auto repair": ["general_auto_repair"],
  "General auto repair quote": ["general_auto_repair"],
  "Mobile mechanical service": ["general_auto_repair"],
  "Mobile mechanic help": ["general_auto_repair"],
  "Battery jump-starts": ["provisional_12v_jump_start"],
  "Battery replacement": ["provisional_12v_battery_replacement", "battery_replacement"],
  "Battery replacement or jump start": ["provisional_12v_jump_start", "provisional_12v_battery_replacement", "battery_replacement"],
  "Battery or jump start": ["provisional_12v_jump_start", "provisional_12v_battery_replacement", "battery_replacement"],
  "Spare-tire installation": ["provisional_temporary_spare_install"],
  "Mobile tire service": ["provisional_temporary_spare_install", "tire_repair_or_installation"],
  "Tire repair and replacement": ["tire_repair_or_installation"],
  "Tire repair or replacement quote": ["tire_repair_or_installation"],
  "Tire help": ["provisional_temporary_spare_install", "tire_repair_or_installation"],
  "Flat tire or spare installation": ["provisional_temporary_spare_install", "tire_repair_or_installation"],
  "Basic vehicle diagnostics": ["provisional_obd_read_only", "basic_vehicle_diagnostics"],
  "Mobile detailing": ["provisional_basic_detailing"],
  "Interior detailing": ["provisional_basic_detailing"],
  "Mobile car washing": ["provisional_basic_detailing", "mobile_car_wash"],
  "Mobile car wash": ["provisional_basic_detailing", "mobile_car_wash"],
  "Waterless exterior washing": ["provisional_basic_detailing", "mobile_car_wash"],
  "Car washing with water": ["mobile_car_wash"],
  "Car washing": ["mobile_car_wash"],
  "Window tint installation": ["window_tint_installation"],
  "Window tint installation quote": ["window_tint_installation"],
  "Body repair and paint": ["body_paint_refinishing"],
  "Body repair or paint quote": ["body_paint_refinishing"],
  "Lockout assistance": ["vehicle_lockout"],
  "Fuel delivery": ["fuel_delivery"],
  "Hybrid and EV service": ["ev_high_voltage_service"],
  "Hybrid or EV service": ["ev_high_voltage_service"],
} as const satisfies Record<string, readonly ServiceCode[]>;

export type UiServiceValueAlias = keyof typeof UI_SERVICE_VALUE_ALIASES;

export function isProviderPathway(value: unknown): value is ProviderPathway {
  return typeof value === "string" && PATHWAY_SET.has(value);
}

export function isProviderLevel(value: unknown): value is ProviderLevel {
  return typeof value === "string" && LEVEL_SET.has(value);
}

export function isServiceCode(value: unknown): value is ServiceCode {
  return typeof value === "string" && SERVICE_CODE_SET.has(value);
}

export function getServiceCodeCandidates(value: unknown): readonly ServiceCode[] {
  if (typeof value !== "string") return [];
  const normalized = value.trim();
  if (isServiceCode(normalized)) return [normalized];
  return UI_SERVICE_VALUE_ALIASES[
    normalized as UiServiceValueAlias
  ] ?? [];
}

export function resolveUnambiguousServiceCode(value: unknown): ServiceCode | null {
  const candidates = getServiceCodeCandidates(value);
  return candidates.length === 1 ? candidates[0] : null;
}

export function isPathwayLevelCompatible(
  pathway: ProviderPathway,
  level: ProviderLevel,
) {
  return PROVIDER_POLICY_MATRIX.pathway_level_compatibility[pathway].includes(level);
}

/**
 * Relationship controls in the matrix sit above each service's own evidence
 * list. Compile them into every allowed service so no caller can accidentally
 * authorize a person by checking only the service-level array.
 *
 * The current independent-startup lane is the no-employee owner-operator lane.
 * A provider with employees must use the provider-business pathway and present
 * workers' compensation plus current personnel/employment records.
 */
export const RELATIONSHIP_EVIDENCE_REQUIREMENTS: Readonly<
  Record<ProviderPathway, readonly EvidenceRequirementCode[]>
> = Object.freeze({
  independent_startup: Object.freeze([
    "no_employee_attestation",
  ] as const),
  sponsored_trainee_employee: Object.freeze([
    "workers_comp_coverage",
    "sponsored_personnel_roster",
    "sponsored_employment_attestation",
  ] as const),
  provider_business_employee: Object.freeze([
    "workers_comp_coverage",
    "provider_personnel_roster",
    "provider_employee_record",
  ] as const),
});

export function getEvidenceRequirements(
  serviceCode: ServiceCode,
  pathway: ProviderPathway,
): readonly EvidenceRequirementCode[] {
  const serviceRequirements = SERVICE_POLICY_CATALOG[serviceCode]
    .evidenceRequirementsByPathway[pathway];
  if (!serviceRequirements) return [];
  return [...new Set([
    ...serviceRequirements,
    ...RELATIONSHIP_EVIDENCE_REQUIREMENTS[pathway],
  ])];
}

export interface ServiceDefaultDenyStatus {
  known: boolean;
  enabled: boolean;
  customerVisible: boolean;
  defaultDenied: boolean;
  launchState: ServiceLaunchState | null;
  reason: "unknown_service_code" | ServiceLaunchState;
}

export function getServiceDefaultDenyStatus(
  value: unknown,
): ServiceDefaultDenyStatus {
  if (!isServiceCode(value)) {
    return {
      known: false,
      enabled: false,
      customerVisible: false,
      defaultDenied: true,
      launchState: null,
      reason: "unknown_service_code",
    };
  }

  const service = SERVICE_POLICY_CATALOG[value];
  const enabled = service.launchState === "enabled";
  return {
    known: true,
    enabled,
    customerVisible: service.customerVisible,
    defaultDenied: !enabled,
    launchState: service.launchState,
    reason: service.launchState,
  };
}

export function isServiceDefaultDenied(value: unknown) {
  return getServiceDefaultDenyStatus(value).defaultDenied;
}

export type PolicyValidationReason =
  | "unknown_service_code"
  | "unknown_pathway"
  | "unknown_provider_level"
  | "pathway_level_incompatible"
  | "service_not_enabled"
  | "service_not_customer_visible"
  | "pathway_not_allowed"
  | "provider_level_not_allowed"
  | "provider_level_service_not_allowed";

export interface PolicyValidationInput {
  serviceCode: unknown;
  pathway: unknown;
  providerLevel: unknown;
  requireCustomerVisible?: boolean;
}

export interface PolicyValidationResult {
  allowed: boolean;
  serviceCode: ServiceCode | null;
  pathway: ProviderPathway | null;
  providerLevel: ProviderLevel | null;
  launchState: ServiceLaunchState | null;
  customerVisible: boolean;
  reasons: readonly PolicyValidationReason[];
}

export function validatePolicySelection(
  input: PolicyValidationInput,
): PolicyValidationResult {
  const serviceCode = isServiceCode(input.serviceCode) ? input.serviceCode : null;
  const pathway = isProviderPathway(input.pathway) ? input.pathway : null;
  const providerLevel = isProviderLevel(input.providerLevel) ? input.providerLevel : null;
  const reasons: PolicyValidationReason[] = [];

  if (!serviceCode) reasons.push("unknown_service_code");
  if (!pathway) reasons.push("unknown_pathway");
  if (!providerLevel) reasons.push("unknown_provider_level");

  const service = serviceCode ? SERVICE_POLICY_CATALOG[serviceCode] : null;
  if (service && service.launchState !== "enabled") reasons.push("service_not_enabled");
  if (service && input.requireCustomerVisible && !service.customerVisible) {
    reasons.push("service_not_customer_visible");
  }

  if (service && pathway && !service.allowedPathways.includes(pathway)) {
    reasons.push("pathway_not_allowed");
  }
  if (service && providerLevel && !service.allowedProviderLevels.includes(providerLevel)) {
    reasons.push("provider_level_not_allowed");
  }
  if (pathway && providerLevel && !isPathwayLevelCompatible(pathway, providerLevel)) {
    reasons.push("pathway_level_incompatible");
  }
  if (
    serviceCode
    && providerLevel
    && !PROVIDER_POLICY_MATRIX.provider_levels[providerLevel].allowed_service_codes.includes(serviceCode)
  ) {
    reasons.push("provider_level_service_not_allowed");
  }

  return {
    allowed: reasons.length === 0,
    serviceCode,
    pathway,
    providerLevel,
    launchState: service?.launchState ?? null,
    customerVisible: service?.customerVisible ?? false,
    reasons: Object.freeze(reasons),
  };
}
