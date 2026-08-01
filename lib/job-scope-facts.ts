import {
  isServiceCode,
  POLICY_JURISDICTION,
  PROVIDER_POLICY_MATRIX,
  type ServiceCode,
} from "./provider-policy";
import { areaForZip } from "./service-matching";

export const JOB_SCOPE_FACTS_VERSION = 2 as const;
export const JOB_SCOPE_COUNTY = "Montgomery County" as const;
export const JOB_SCOPE_STATE = "Maryland" as const;
export const JOB_SCOPE_JURISDICTION = POLICY_JURISDICTION;

export const JOB_LOCATION_TYPES = [
  "customer_private_property",
  "provider_private_property",
  "provider_fixed_facility",
  "public_roadside",
  "licensed_inspection_station",
  "permitted_fixed_facility",
  "approved_specialty_facility",
  "towing_or_storage_site",
] as const;

export type JobLocationType = (typeof JOB_LOCATION_TYPES)[number];

export const JOB_LOCATION_TYPE_OPTIONS = [
  { value: "customer_private_property", label: "Customer-controlled private driveway, garage, or lot" },
  { value: "provider_private_property", label: "Provider-controlled private property" },
  { value: "provider_fixed_facility", label: "Provider fixed business facility" },
  { value: "public_roadside", label: "Lawful roadside location outside an active traffic lane" },
  { value: "licensed_inspection_station", label: "Licensed Maryland inspection station" },
  { value: "permitted_fixed_facility", label: "Permitted fixed specialty facility" },
  { value: "approved_specialty_facility", label: "Other specifically approved specialty facility" },
  { value: "towing_or_storage_site", label: "Approved towing pickup, destination, or storage site" },
] as const satisfies readonly { value: JobLocationType; label: string }[];

export const JOB_PROPERTY_PERMISSION_VALUES = [
  "customer_confirmed_authority",
  "provider_confirmed_authority",
  "not_applicable_public_roadside",
] as const;

export type JobPropertyPermission =
  (typeof JOB_PROPERTY_PERMISSION_VALUES)[number];

export const JOB_VEHICLE_DRIVEABILITY_VALUES = [
  "driveable",
  "not_driveable",
  "unknown",
] as const;

export type JobVehicleDriveability =
  (typeof JOB_VEHICLE_DRIVEABILITY_VALUES)[number];

export const JOB_VEHICLE_STATE_VALUES = [
  "normal_stationary",
  "disabled_no_collision",
  "collision_damaged",
  "fire_or_flood_damaged",
  "battery_damaged",
] as const;

export type JobVehicleState = (typeof JOB_VEHICLE_STATE_VALUES)[number];

export const JOB_HIGH_VOLTAGE_STATUS_VALUES = [
  "not_applicable_or_not_involved",
  "present_not_involved",
  "damage_or_work_suspected",
  "unknown",
] as const;

export type JobHighVoltageStatus =
  (typeof JOB_HIGH_VOLTAGE_STATUS_VALUES)[number];

export const JOB_SAFETY_ATTESTATION_CODES = [
  "exact_address_confirmed",
  "property_permission_confirmed",
  "vehicle_secured",
  "outside_active_traffic_lane",
  "no_fire_smoke_or_fuel_leak",
  "no_high_voltage_damage",
  "provider_arrival_safety_recheck_required",
  "roadside_location_lawful_and_accessible",
  "roadside_safety_check_passed",
  "wash_water_controls_confirmed",
  "fixed_private_property_confirmed",
  "tire_location_controls_confirmed",
  "mvac_location_controls_confirmed",
  "permitted_facility_confirmed",
  "towing_storage_workflow_confirmed",
  "lockout_identity_location_workflow_confirmed",
  "licensed_inspection_station_confirmed",
  "fuel_delivery_route_stop_work_confirmed",
  "ev_high_voltage_facility_confirmed",
] as const;

export type JobSafetyAttestationCode =
  (typeof JOB_SAFETY_ATTESTATION_CODES)[number];

export const JOB_SAFETY_ATTESTATION_OPTIONS = [
  { value: "exact_address_confirmed", label: "The exact service address or roadside position is complete and accurate." },
  { value: "property_permission_confirmed", label: "The person controlling this private property authorizes the vehicle and provider to be there." },
  { value: "vehicle_secured", label: "The vehicle can remain stationary and secured for the requested work." },
  { value: "outside_active_traffic_lane", label: "The vehicle is outside every active traffic lane." },
  { value: "no_fire_smoke_or_fuel_leak", label: "There is no known fire, smoke, active fuel leak, or similar immediate hazard." },
  { value: "no_high_voltage_damage", label: "There is no known damaged orange/high-voltage component or traction-battery hazard." },
  { value: "provider_arrival_safety_recheck_required", label: "The provider must recheck the vehicle and location and stop before work if facts changed or conditions are unsafe." },
  { value: "roadside_location_lawful_and_accessible", label: "The roadside position is lawful and can be reached without entering an active lane." },
  { value: "roadside_safety_check_passed", label: "The complete emergency-roadside safety checklist has passed." },
  { value: "wash_water_controls_confirmed", label: "The approved wash-water capture or waterless controls are available at this exact location." },
  { value: "fixed_private_property_confirmed", label: "This is the exact approved fixed private facility for the service." },
  { value: "tire_location_controls_confirmed", label: "The required tire, lifting, removed-tire, and waste controls are available at this location." },
  { value: "mvac_location_controls_confirmed", label: "The approved MVAC recovery and refrigerant controls are available at this location." },
  { value: "permitted_facility_confirmed", label: "This is the exact permitted fixed facility required for the specialty work." },
  { value: "towing_storage_workflow_confirmed", label: "The approved pickup, destination, custody, and storage workflow is identified." },
  { value: "lockout_identity_location_workflow_confirmed", label: "The approved vehicle-identity, customer-authority, and lockout-location workflow can be completed." },
  { value: "licensed_inspection_station_confirmed", label: "This is the exact licensed inspection station for the vehicle class." },
  { value: "fuel_delivery_route_stop_work_confirmed", label: "The approved fuel route, dispensing, spill, fire, and stop-work controls can be completed." },
  { value: "ev_high_voltage_facility_confirmed", label: "This is the exact approved EV high-voltage facility with its required emergency controls." },
] as const satisfies readonly { value: JobSafetyAttestationCode; label: string }[];

export type JobScopeFacts = {
  version: typeof JOB_SCOPE_FACTS_VERSION;
  requestedOperations: {
    serviceCode: ServiceCode;
    operationCode: string;
  }[];
  prohibitedOperationsAttestedAbsent: string[];
  location: {
    type: JobLocationType;
    address: string;
    municipality: string;
    county: typeof JOB_SCOPE_COUNTY;
    state: typeof JOB_SCOPE_STATE;
    postalCode: string;
    jurisdiction: typeof JOB_SCOPE_JURISDICTION;
    propertyPermission: JobPropertyPermission;
  };
  vehicle: {
    driveability: JobVehicleDriveability;
    state: JobVehicleState;
    highVoltageStatus: JobHighVoltageStatus;
  };
  safetyAttestations: JobSafetyAttestationCode[];
};

export type JobScopeFactReason = {
  code: string;
  detail: string;
  serviceCode?: ServiceCode;
};

export type JobScopeFactsEvaluation = {
  allowed: boolean;
  facts: JobScopeFacts | null;
  reasons: JobScopeFactReason[];
  locationRuleResults: Record<string, string>;
  scopeCheckResult: string;
};

type JobScopeFactsInput = {
  serviceCode: unknown;
  operationCode: unknown;
  prohibitedOperationsAttestedAbsent: readonly unknown[];
  locationType: unknown;
  address: unknown;
  municipality: unknown;
  county: unknown;
  state: unknown;
  postalCode: unknown;
  jurisdiction: unknown;
  propertyPermission: unknown;
  vehicleDriveability: unknown;
  vehicleState: unknown;
  highVoltageStatus: unknown;
  safetyAttestations: readonly unknown[];
};

const LOCATION_TYPE_SET: ReadonlySet<string> = new Set(JOB_LOCATION_TYPES);
const PROPERTY_PERMISSION_SET: ReadonlySet<string> = new Set(
  JOB_PROPERTY_PERMISSION_VALUES,
);
const DRIVEABILITY_SET: ReadonlySet<string> = new Set(
  JOB_VEHICLE_DRIVEABILITY_VALUES,
);
const VEHICLE_STATE_SET: ReadonlySet<string> = new Set(JOB_VEHICLE_STATE_VALUES);
const HIGH_VOLTAGE_SET: ReadonlySet<string> = new Set(
  JOB_HIGH_VOLTAGE_STATUS_VALUES,
);
const SAFETY_ATTESTATION_SET: ReadonlySet<string> = new Set(
  JOB_SAFETY_ATTESTATION_CODES,
);

const COMMON_SAFETY_ATTESTATIONS: readonly JobSafetyAttestationCode[] = [
  "exact_address_confirmed",
  "vehicle_secured",
  "outside_active_traffic_lane",
  "no_fire_smoke_or_fuel_leak",
  "no_high_voltage_damage",
  "provider_arrival_safety_recheck_required",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cleanCode(value: unknown) {
  if (typeof value !== "string") return "";
  const normalized = value.trim();
  return /^[a-z0-9_]{1,160}$/.test(normalized) ? normalized : "";
}

function cleanAddress(value: unknown) {
  return typeof value === "string" ? value.trim().slice(0, 240) : "";
}

function cleanLocationText(value: unknown, max = 100) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function comparableLocationText(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US");
}

function escapedPattern(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function structuredAddressIsConsistent(location: JobScopeFacts["location"]) {
  const normalizedAddress = comparableLocationText(location.address);
  const normalizedMunicipality = comparableLocationText(location.municipality);
  const basePostalCode = location.postalCode.slice(0, 5);
  return location.county === JOB_SCOPE_COUNTY
    && location.state === JOB_SCOPE_STATE
    && location.jurisdiction === JOB_SCOPE_JURISDICTION
    && /^\d{5}(?:-\d{4})?$/.test(location.postalCode)
    && areaForZip(location.postalCode) === JOB_SCOPE_COUNTY
    && normalizedMunicipality.length >= 2
    && new RegExp(`(^|[^a-z0-9])${escapedPattern(normalizedMunicipality)}([^a-z0-9]|$)`, "i")
      .test(normalizedAddress)
    && new RegExp(`(^|\\D)${escapedPattern(basePostalCode)}(?:-\\d{4})?(\\D|$)`)
      .test(normalizedAddress)
    && /(^|[^a-z])(?:maryland|md)([^a-z]|$)/i.test(normalizedAddress);
}

function uniqueSortedStrings(
  values: readonly unknown[],
  allowed?: ReadonlySet<string>,
) {
  const result: string[] = [];
  for (const value of values) {
    const code = cleanCode(value);
    if (!code || (allowed && !allowed.has(code))) return null;
    if (!result.includes(code)) result.push(code);
  }
  return result.sort((first, second) => first.localeCompare(second));
}

function parseJson(value: unknown) {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

export function jobScopeFactsFromInput(input: JobScopeFactsInput) {
  const serviceCode = typeof input.serviceCode === "string"
    ? input.serviceCode.trim()
    : "";
  const operationCode = cleanCode(input.operationCode);
  const locationType = typeof input.locationType === "string"
    ? input.locationType.trim()
    : "";
  const propertyPermission = typeof input.propertyPermission === "string"
    ? input.propertyPermission.trim()
    : "";
  const vehicleDriveability = typeof input.vehicleDriveability === "string"
    ? input.vehicleDriveability.trim()
    : "";
  const vehicleState = typeof input.vehicleState === "string"
    ? input.vehicleState.trim()
    : "";
  const highVoltageStatus = typeof input.highVoltageStatus === "string"
    ? input.highVoltageStatus.trim()
    : "";
  const prohibitedAbsent = uniqueSortedStrings(
    input.prohibitedOperationsAttestedAbsent,
  );
  const safetyAttestations = uniqueSortedStrings(
    input.safetyAttestations,
    SAFETY_ATTESTATION_SET,
  );
  const address = cleanAddress(input.address);
  const municipality = cleanLocationText(input.municipality);
  const county = cleanLocationText(input.county);
  const state = cleanLocationText(input.state);
  const postalCode = cleanLocationText(input.postalCode, 10);
  const jurisdiction = cleanLocationText(input.jurisdiction);

  if (
    !isServiceCode(serviceCode)
    || serviceCode === "general_auto_repair"
    || !operationCode
    || !LOCATION_TYPE_SET.has(locationType)
    || !PROPERTY_PERMISSION_SET.has(propertyPermission)
    || !DRIVEABILITY_SET.has(vehicleDriveability)
    || !VEHICLE_STATE_SET.has(vehicleState)
    || !HIGH_VOLTAGE_SET.has(highVoltageStatus)
    || !address
    || !municipality
    || county !== JOB_SCOPE_COUNTY
    || state !== JOB_SCOPE_STATE
    || !postalCode
    || jurisdiction !== JOB_SCOPE_JURISDICTION
    || !prohibitedAbsent
    || !safetyAttestations
  ) return null;

  return {
    version: JOB_SCOPE_FACTS_VERSION,
    requestedOperations: [{ serviceCode, operationCode }],
    prohibitedOperationsAttestedAbsent: prohibitedAbsent,
    location: {
      type: locationType as JobLocationType,
      address,
      municipality,
      county: JOB_SCOPE_COUNTY,
      state: JOB_SCOPE_STATE,
      postalCode,
      jurisdiction: JOB_SCOPE_JURISDICTION,
      propertyPermission: propertyPermission as JobPropertyPermission,
    },
    vehicle: {
      driveability: vehicleDriveability as JobVehicleDriveability,
      state: vehicleState as JobVehicleState,
      highVoltageStatus: highVoltageStatus as JobHighVoltageStatus,
    },
    safetyAttestations: safetyAttestations as JobSafetyAttestationCode[],
  } satisfies JobScopeFacts;
}

export function parseJobScopeFacts(value: unknown): JobScopeFacts | null {
  const parsed = parseJson(value);
  if (!isRecord(parsed) || parsed.version !== JOB_SCOPE_FACTS_VERSION) return null;
  if (
    !Array.isArray(parsed.requestedOperations)
    || parsed.requestedOperations.length === 0
    || parsed.requestedOperations.length > 25
    || !Array.isArray(parsed.prohibitedOperationsAttestedAbsent)
    || !Array.isArray(parsed.safetyAttestations)
    || !isRecord(parsed.location)
    || !isRecord(parsed.vehicle)
  ) return null;

  const requestedOperations: JobScopeFacts["requestedOperations"] = [];
  for (const value of parsed.requestedOperations) {
    if (!isRecord(value)) return null;
    const serviceCode = typeof value.serviceCode === "string"
      ? value.serviceCode.trim()
      : "";
    const operationCode = cleanCode(value.operationCode);
    if (
      !isServiceCode(serviceCode)
      || serviceCode === "general_auto_repair"
      || !operationCode
    ) return null;
    if (!requestedOperations.some((item) => (
      item.serviceCode === serviceCode && item.operationCode === operationCode
    ))) {
      requestedOperations.push({ serviceCode, operationCode });
    }
  }

  const prohibitedAbsent = uniqueSortedStrings(
    parsed.prohibitedOperationsAttestedAbsent,
  );
  const safetyAttestations = uniqueSortedStrings(
    parsed.safetyAttestations,
    SAFETY_ATTESTATION_SET,
  );
  const locationType = typeof parsed.location.type === "string"
    ? parsed.location.type.trim()
    : "";
  const propertyPermission = typeof parsed.location.propertyPermission === "string"
    ? parsed.location.propertyPermission.trim()
    : "";
  const vehicleDriveability = typeof parsed.vehicle.driveability === "string"
    ? parsed.vehicle.driveability.trim()
    : "";
  const vehicleState = typeof parsed.vehicle.state === "string"
    ? parsed.vehicle.state.trim()
    : "";
  const highVoltageStatus = typeof parsed.vehicle.highVoltageStatus === "string"
    ? parsed.vehicle.highVoltageStatus.trim()
    : "";
  const address = cleanAddress(parsed.location.address);
  const municipality = cleanLocationText(parsed.location.municipality);
  const county = cleanLocationText(parsed.location.county);
  const state = cleanLocationText(parsed.location.state);
  const postalCode = cleanLocationText(parsed.location.postalCode, 10);
  const jurisdiction = cleanLocationText(parsed.location.jurisdiction);
  if (
    !prohibitedAbsent
    || !safetyAttestations
    || !LOCATION_TYPE_SET.has(locationType)
    || !PROPERTY_PERMISSION_SET.has(propertyPermission)
    || !DRIVEABILITY_SET.has(vehicleDriveability)
    || !VEHICLE_STATE_SET.has(vehicleState)
    || !HIGH_VOLTAGE_SET.has(highVoltageStatus)
    || !address
    || !municipality
    || county !== JOB_SCOPE_COUNTY
    || state !== JOB_SCOPE_STATE
    || !postalCode
    || jurisdiction !== JOB_SCOPE_JURISDICTION
  ) return null;

  return {
    version: JOB_SCOPE_FACTS_VERSION,
    requestedOperations: requestedOperations.sort((first, second) => (
      first.serviceCode.localeCompare(second.serviceCode)
      || first.operationCode.localeCompare(second.operationCode)
    )),
    prohibitedOperationsAttestedAbsent: prohibitedAbsent,
    location: {
      type: locationType as JobLocationType,
      address,
      municipality,
      county: JOB_SCOPE_COUNTY,
      state: JOB_SCOPE_STATE,
      postalCode,
      jurisdiction: JOB_SCOPE_JURISDICTION,
      propertyPermission: propertyPermission as JobPropertyPermission,
    },
    vehicle: {
      driveability: vehicleDriveability as JobVehicleDriveability,
      state: vehicleState as JobVehicleState,
      highVoltageStatus: highVoltageStatus as JobHighVoltageStatus,
    },
    safetyAttestations: safetyAttestations as JobSafetyAttestationCode[],
  };
}

export function jobScopeFactsSnapshot(value: unknown) {
  const facts = parseJobScopeFacts(value);
  return facts ? JSON.stringify(facts) : "";
}

export function jobScopeFactsFromScopeDetails(scopeDetails: unknown) {
  const parsed = parseJson(scopeDetails);
  return isRecord(parsed) ? parseJobScopeFacts(parsed.jobFacts) : null;
}

export function compareArrivalJobScopeFacts(
  authorizedValue: unknown,
  arrivalValue: unknown,
) {
  const authorized = parseJobScopeFacts(authorizedValue);
  const arrival = parseJobScopeFacts(arrivalValue);
  const reasons: JobScopeFactReason[] = [];
  if (!authorized) {
    reason(reasons, "authorized_job_facts_missing_or_invalid", "The accepted job scope does not contain valid structured facts.");
  }
  if (!arrival) {
    reason(reasons, "fresh_arrival_job_facts_required", "The provider must submit a complete fresh arrival-safety snapshot before work starts.");
  }
  if (!authorized || !arrival) return { allowed: false, authorized, arrival, reasons };

  const immutableAuthorized = JSON.stringify({
    requestedOperations: authorized.requestedOperations,
    prohibitedOperationsAttestedAbsent:
      authorized.prohibitedOperationsAttestedAbsent,
    location: authorized.location,
  });
  const immutableArrival = JSON.stringify({
    requestedOperations: arrival.requestedOperations,
    prohibitedOperationsAttestedAbsent: arrival.prohibitedOperationsAttestedAbsent,
    location: arrival.location,
  });
  if (immutableAuthorized !== immutableArrival) {
    reason(
      reasons,
      "arrival_scope_binding_mismatch",
      "Arrival operation, excluded operations, location, address, jurisdiction, or property authority does not exactly match the customer-authorized scope.",
    );
  }
  return { allowed: reasons.length === 0, authorized, arrival, reasons };
}

function policyCodes(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map(cleanCode).filter(Boolean);
}

export function jobScopeRequirementsForService(serviceCode: ServiceCode) {
  const policy = PROVIDER_POLICY_MATRIX.services[serviceCode];
  return {
    allowedOperations: policyCodes(policy.allowed_scope),
    prohibitedOperations: policyCodes(policy.prohibited_scope),
    locationRule: typeof policy.location_rule === "string"
      ? policy.location_rule.trim()
      : "",
  };
}

function requiredLocationFacts(locationRule: string): {
  allowedTypes: readonly JobLocationType[];
  requiredAttestations: readonly JobSafetyAttestationCode[];
} | null {
  const privateTypes: readonly JobLocationType[] = [
    "customer_private_property",
    "provider_private_property",
    "provider_fixed_facility",
  ];
  switch (locationRule) {
    case "approved_private_property_only":
      return { allowedTypes: privateTypes, requiredAttestations: [] };
    case "approved_private_property_or_passed_emergency_roadside_check":
      return {
        allowedTypes: [...privateTypes, "public_roadside"],
        requiredAttestations: [],
      };
    case "approved_private_property_with_approved_wash_water_controls":
      return {
        allowedTypes: privateTypes,
        requiredAttestations: ["wash_water_controls_confirmed"],
      };
    case "approved_fixed_private_property_only":
      return {
        allowedTypes: ["provider_fixed_facility"],
        requiredAttestations: ["fixed_private_property_confirmed"],
      };
    case "approved_fixed_or_private_property_with_tire_controls":
      return {
        allowedTypes: privateTypes,
        requiredAttestations: ["tire_location_controls_confirmed"],
      };
    case "approved_location_for_mvac_service":
      return {
        allowedTypes: ["provider_fixed_facility", "approved_specialty_facility"],
        requiredAttestations: ["mvac_location_controls_confirmed"],
      };
    case "approved_permitted_fixed_facility_only":
      return {
        allowedTypes: ["permitted_fixed_facility"],
        requiredAttestations: ["permitted_facility_confirmed"],
      };
    case "approved_private_or_fixed_location_only":
      return { allowedTypes: privateTypes, requiredAttestations: [] };
    case "approved_towing_and_storage_workflow_only":
      return {
        allowedTypes: [
          ...privateTypes,
          "public_roadside",
          "towing_or_storage_site",
        ],
        requiredAttestations: ["towing_storage_workflow_confirmed"],
      };
    case "approved_lockout_identity_and_location_workflow_only":
      return {
        allowedTypes: [...privateTypes, "public_roadside"],
        requiredAttestations: ["lockout_identity_location_workflow_confirmed"],
      };
    case "licensed_fixed_inspection_station_only":
      return {
        allowedTypes: ["licensed_inspection_station"],
        requiredAttestations: ["licensed_inspection_station_confirmed"],
      };
    case "approved_fuel_delivery_route_and_stop_work_workflow_only":
      return {
        allowedTypes: [...privateTypes, "public_roadside"],
        requiredAttestations: ["fuel_delivery_route_stop_work_confirmed"],
      };
    case "approved_ev_high_voltage_facility_only":
      return {
        allowedTypes: ["approved_specialty_facility"],
        requiredAttestations: ["ev_high_voltage_facility_confirmed"],
      };
    default:
      return null;
  }
}

export function jobScopeLocationRequirementsForService(
  serviceCode: ServiceCode,
) {
  const requirements = jobScopeRequirementsForService(serviceCode);
  const location = requiredLocationFacts(requirements.locationRule);
  if (!location) return null;
  return {
    locationRule: requirements.locationRule,
    allowedTypes: [...location.allowedTypes],
    requiredAttestations: [...new Set([
      ...COMMON_SAFETY_ATTESTATIONS,
      ...location.requiredAttestations,
    ])],
  };
}

export function jobScopeRequiredAttestations(
  serviceCode: ServiceCode,
  locationType: JobLocationType,
) {
  const requirements = jobScopeLocationRequirementsForService(serviceCode);
  if (!requirements || !requirements.allowedTypes.includes(locationType)) {
    return [];
  }
  return [...new Set([
    ...requirements.requiredAttestations,
    ...(locationType === "public_roadside"
      ? [
          "roadside_location_lawful_and_accessible",
          "roadside_safety_check_passed",
        ] as const
      : ["property_permission_confirmed"] as const),
  ])];
}

function reason(
  reasons: JobScopeFactReason[],
  code: string,
  detail: string,
  serviceCode?: ServiceCode,
) {
  reasons.push({ code, detail, ...(serviceCode ? { serviceCode } : {}) });
}

export function evaluateJobScopeFacts(
  rawServiceCodes: readonly unknown[],
  value: unknown,
): JobScopeFactsEvaluation {
  const facts = parseJobScopeFacts(value);
  const reasons: JobScopeFactReason[] = [];
  const locationRuleResults: Record<string, string> = {};
  const serviceCodes: ServiceCode[] = [];
  for (const value of rawServiceCodes) {
    if (!isServiceCode(value) || value === "general_auto_repair") {
      reason(reasons, "job_facts_exact_service_required", "Structured job facts require recognized exact service codes.");
    } else if (!serviceCodes.includes(value)) {
      serviceCodes.push(value);
    }
  }
  if (!serviceCodes.length) {
    reason(reasons, "job_facts_exact_service_required", "No exact service was supplied for the structured job-fact check.");
  }
  if (!facts) {
    reason(reasons, "job_facts_missing_or_invalid", "Complete structured operation, location, vehicle, and safety facts are required.");
    return {
      allowed: false,
      facts: null,
      reasons,
      locationRuleResults,
      scopeCheckResult: "denied_missing_or_invalid_job_facts",
    };
  }
  if (!structuredAddressIsConsistent(facts.location)) {
    reason(
      reasons,
      "structured_address_binding_failed",
      "Review-mode address fields must consistently identify one Montgomery County, Maryland location: the street address must contain the exact municipality, Maryland or MD, and ZIP; county, state, ZIP service area, and jurisdiction must also match. This is a conservative consistency check, not geocoding.",
    );
  }

  const factServiceCodes = [...new Set(
    facts.requestedOperations.map((item) => item.serviceCode),
  )].sort();
  const expectedServiceCodes = [...serviceCodes].sort();
  if (
    factServiceCodes.length !== expectedServiceCodes.length
    || factServiceCodes.some((value, index) => value !== expectedServiceCodes[index])
  ) {
    reason(reasons, "job_facts_service_binding_mismatch", "The requested operation facts do not exactly match the authorized service codes.");
  }

  const requiredProhibitedAbsences = new Set<string>();
  for (const serviceCode of serviceCodes) {
    const requirements = jobScopeRequirementsForService(serviceCode);
    const requested = facts.requestedOperations.filter(
      (operation) => operation.serviceCode === serviceCode,
    );
    if (!requirements.allowedOperations.length) {
      reason(
        reasons,
        "allowed_operation_scope_not_configured",
        "This service has no mandatory-compliance-approved nonempty operation scope.",
        serviceCode,
      );
    }
    if (!requested.length) {
      reason(reasons, "requested_operation_required", "Choose an exact allowed operation for this service.", serviceCode);
    }
    for (const operation of requested) {
      if (!requirements.allowedOperations.includes(operation.operationCode)) {
        reason(reasons, "requested_operation_not_allowed", "The requested operation is outside this service's allowed scope.", serviceCode);
      }
      if (requirements.prohibitedOperations.includes(operation.operationCode)) {
        reason(reasons, "prohibited_operation_requested", "A prohibited operation cannot be requested under this service code.", serviceCode);
      }
    }
    for (const prohibited of requirements.prohibitedOperations) {
      requiredProhibitedAbsences.add(prohibited);
      if (!facts.prohibitedOperationsAttestedAbsent.includes(prohibited)) {
        reason(
          reasons,
          "prohibited_operation_absence_not_attested",
          `The request does not affirm that prohibited operation or condition ${prohibited} is absent.`,
          serviceCode,
        );
      }
    }

    const locationRequirements = requiredLocationFacts(requirements.locationRule);
    if (!locationRequirements) {
      locationRuleResults[serviceCode] = "denied_unknown_location_rule";
      reason(reasons, "location_rule_missing_or_unknown", "This service has no enforceable recognized location rule.", serviceCode);
      continue;
    }
    const locationReasonsBefore = reasons.length;
    if (!locationRequirements.allowedTypes.includes(facts.location.type)) {
      reason(reasons, "job_location_type_not_allowed", "This exact location type is not allowed for the selected service.", serviceCode);
    }
    for (const attestation of [
      ...COMMON_SAFETY_ATTESTATIONS,
      ...locationRequirements.requiredAttestations,
    ]) {
      if (!facts.safetyAttestations.includes(attestation)) {
        reason(reasons, "required_safety_attestation_missing", `Required location or safety attestation ${attestation} is missing.`, serviceCode);
      }
    }
    if (facts.location.type === "public_roadside") {
      for (const attestation of [
        "roadside_location_lawful_and_accessible",
        "roadside_safety_check_passed",
      ] as const) {
        if (!facts.safetyAttestations.includes(attestation)) {
          reason(reasons, "roadside_safety_check_missing", `Required roadside attestation ${attestation} is missing.`, serviceCode);
        }
      }
      if (facts.location.propertyPermission !== "not_applicable_public_roadside") {
        reason(reasons, "roadside_permission_value_invalid", "A roadside job must use the public-roadside permission value.", serviceCode);
      }
    } else {
      if (facts.location.propertyPermission === "not_applicable_public_roadside") {
        reason(reasons, "property_permission_missing", "Private or facility work requires confirmed property authority.", serviceCode);
      }
      if (!facts.safetyAttestations.includes("property_permission_confirmed")) {
        reason(reasons, "property_permission_attestation_missing", "Private or facility work requires an affirmative property-permission attestation.", serviceCode);
      }
    }
    locationRuleResults[serviceCode] = reasons.length === locationReasonsBefore
      ? `passed:${requirements.locationRule}`
      : `denied:${requirements.locationRule}`;
  }

  const unexpectedProhibitedAbsences = facts.prohibitedOperationsAttestedAbsent
    .filter((value) => !requiredProhibitedAbsences.has(value));
  if (unexpectedProhibitedAbsences.length) {
    reason(reasons, "prohibited_operation_attestation_mismatch", "Prohibited-operation attestations must exactly match the selected service policy.");
  }
  if (facts.vehicle.state === "fire_or_flood_damaged") {
    reason(reasons, "unsafe_vehicle_state", "Fire- or flood-damaged vehicles require a separately approved emergency workflow.");
  }
  if (facts.vehicle.state === "battery_damaged") {
    const damagedBatteryProhibited = serviceCodes.some((serviceCode) => (
      jobScopeRequirementsForService(serviceCode).prohibitedOperations
        .includes("damaged_battery")
    ));
    if (damagedBatteryProhibited) {
      reason(reasons, "declared_prohibited_vehicle_condition", "A damaged battery cannot be hidden under this service code.");
    }
  }
  if (
    facts.vehicle.highVoltageStatus === "damage_or_work_suspected"
    || facts.vehicle.highVoltageStatus === "unknown"
  ) {
    reason(reasons, "high_voltage_status_not_cleared", "Unknown or suspected high-voltage work or damage requires a separately approved exact workflow.");
  }

  return {
    allowed: reasons.length === 0,
    facts,
    reasons,
    locationRuleResults,
    scopeCheckResult: reasons.length === 0
      ? "requested_operations_allowed_and_prohibited_scope_cleared"
      : "denied_operation_location_vehicle_or_safety_facts",
  };
}
