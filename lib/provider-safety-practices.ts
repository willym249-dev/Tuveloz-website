// Type-only so this module stays free of the eligibility-matrix JSON import,
// and can be loaded by tests and edge runtimes without a JSON import attribute.
import type { ServiceCode } from "./provider-policy";

/**
 * The written safe-work standard a provider agrees to at onboarding. This is
 * the source for app/provider-safety-policy/page.tsx so the document and the
 * rule set cannot drift apart.
 *
 * This is NOT a per-job checklist and must not become one. Per-job site safety
 * is already gated by JOB_SAFETY_ATTESTATION_CODES in job-scope-facts.ts, which
 * is service-aware, location-aware, validated server-side, and bound into the
 * job_start eligibility decision. Those attestations answer "is this place safe
 * to work"; the rules below are the conduct standard for how the work is done.
 * Adding a second per-job confirmation flow here would duplicate an enforced
 * control for no legal or safety gain.
 *
 * These are marketplace conduct rules about protecting the customer, the
 * vehicle, bystanders, and the person doing the work. They are deliberately not
 * repair instructions: PROVIDER_FREEDOM_PRINCIPLES in service-safety-policy.ts
 * keeps the lawful method, tools, and sequence with the provider. Nothing here
 * makes Tuveloz the employer or supervisor of anyone.
 */
export type SafetyRuleSeverity = "stop_work" | "required" | "recommended";

export type SafetyRule = {
  code: string;
  text: string;
  severity: SafetyRuleSeverity;
};

/** Applies to every approved service, every job, every pathway. */
export const UNIVERSAL_SAFETY_RULES: readonly SafetyRule[] = Object.freeze([
  {
    code: "site_survey",
    text: "Look over the work area before touching the vehicle. Check the ground, the slope, the lighting, the weather, and how close traffic is.",
    severity: "required",
  },
  {
    code: "refuse_unsafe_site",
    text: "Do not start work on a travel lane, a highway shoulder, soft or sloped ground, ice, or anywhere you cannot work clear of moving traffic. Move the vehicle to a safe spot or decline the job.",
    severity: "stop_work",
  },
  {
    code: "secure_vehicle",
    text: "Engine off, parking brake set, transmission in park or in gear, key under your control, and wheels chocked before any work begins.",
    severity: "stop_work",
  },
  {
    code: "never_under_a_jack",
    text: "Never put any part of your body under a vehicle held only by a jack. Use rated stands or ramps on a hard level surface.",
    severity: "stop_work",
  },
  {
    code: "visibility",
    text: "Make yourself visible. Hazard lights on, a high-visibility vest in any roadside or parking-area work, and cones or triangles where the law requires them.",
    severity: "required",
  },
  {
    code: "ppe",
    text: "Wear eye protection and gloves suited to the job. Add hearing, face, or respiratory protection when the work calls for it.",
    severity: "required",
  },
  {
    code: "bystanders",
    text: "Keep the customer, children, pets, and passers-by clear of the work area. Ask people to step back rather than working around them.",
    severity: "required",
  },
  {
    code: "hot_and_charged",
    text: "Treat hot, pressurized, spring-loaded, and electrically live components as dangerous. Let them cool, depressurize, or de-energize first.",
    severity: "required",
  },
  {
    code: "photo_before_after",
    text: "Photograph the vehicle and the immediate area before work starts and after it finishes, and attach both to the job record.",
    severity: "required",
  },
  {
    code: "protect_property",
    text: "Protect the customer property you work on and around: fender covers, seat and floor protection, drip containment, and no fluid or debris left behind.",
    severity: "required",
  },
  {
    code: "authorized_scope_only",
    text: "Do only the work in the accepted quote. Anything more needs a written change order the customer approves first.",
    severity: "stop_work",
  },
  {
    code: "stop_and_report",
    text: "If you find a condition that makes the job unsafe or beyond your approved scope, stop, leave the vehicle in a safe state, and report it in the job record before doing anything else.",
    severity: "stop_work",
  },
  {
    code: "report_incident",
    text: "Report any injury, property damage, spill, fire, or police or fire response through the job record the same day it happens.",
    severity: "stop_work",
  },
  {
    code: "fit_for_work",
    text: "Do not work impaired by alcohol, drugs, medication, or exhaustion.",
    severity: "stop_work",
  },
]);

/**
 * Hazard rules layered on top of the universal set. Keys are exact service
 * codes so a job can compile its checklist from the same catalog the
 * eligibility matrix uses; an unlisted code simply gets the universal rules.
 */
const SERVICE_SAFETY_RULES: Partial<Record<ServiceCode, readonly SafetyRule[]>> = {
  provisional_12v_jump_start: Object.freeze([
    {
      code: "battery_condition",
      text: "Inspect the battery first. Do not jump a battery that is cracked, leaking, swollen, or frozen.",
      severity: "stop_work",
    },
    {
      code: "battery_ventilation",
      text: "Keep sparks and flame away from the battery, and make the final connection away from the battery itself.",
      severity: "stop_work",
    },
    {
      code: "no_traction_battery",
      text: "Never touch orange high-voltage cabling or a traction battery. That work is outside this service.",
      severity: "stop_work",
    },
  ]),
  provisional_12v_battery_replacement: Object.freeze([
    {
      code: "disconnect_order",
      text: "Disconnect negative first and reconnect negative last. Keep tools off both posts at once.",
      severity: "required",
    },
    {
      code: "spent_battery",
      text: "Carry the spent battery upright in containment and route it through the approved recycling path. Never leave it with the customer unless they ask for it.",
      severity: "required",
    },
    {
      code: "acid_exposure",
      text: "Treat any leaking battery as an acid hazard. Stop, contain it, and report it.",
      severity: "stop_work",
    },
  ]),
  provisional_temporary_spare_install: Object.freeze([
    {
      code: "lift_points",
      text: "Use the vehicle manufacturer lift points only, on hard level ground, with the opposite wheels chocked.",
      severity: "stop_work",
    },
    {
      code: "torque_spec",
      text: "Torque the fasteners to the vehicle specification in the correct pattern. Do not guess by feel.",
      severity: "required",
    },
    {
      code: "spare_limits",
      text: "Tell the customer the speed and distance limits of the temporary spare and record that you told them.",
      severity: "required",
    },
  ]),
  tire_repair_or_installation: Object.freeze([
    {
      code: "lift_points",
      text: "Use the vehicle manufacturer lift points only, on hard level ground, with the opposite wheels chocked.",
      severity: "stop_work",
    },
    {
      code: "torque_spec",
      text: "Torque the fasteners to the vehicle specification in the correct pattern, and tell the customer to have them re-checked.",
      severity: "required",
    },
    {
      code: "inflation_cage",
      text: "Stand clear of the sidewall arc while inflating, and stop if a bead will not seat at normal pressure.",
      severity: "stop_work",
    },
    {
      code: "damage_limits",
      text: "Do not repair a sidewall, a shoulder, an overlapping injury, or a tire with visible belt or cord damage. Replace it or decline.",
      severity: "stop_work",
    },
  ]),
  provisional_fluid_topoff_limited: Object.freeze([
    {
      code: "cooling_system_pressure",
      text: "Never open a cooling system that is hot or under pressure. Let it cool first.",
      severity: "stop_work",
    },
    {
      code: "correct_fluid",
      text: "Confirm the exact fluid specification for that vehicle before adding anything. If you cannot confirm it, stop.",
      severity: "stop_work",
    },
    {
      code: "spill_containment",
      text: "Work over containment and clean any spill completely before you leave.",
      severity: "required",
    },
  ]),
  sponsored_oil_filter_service: Object.freeze([
    {
      code: "hot_oil",
      text: "Let the exhaust and oil cool enough to handle safely before draining.",
      severity: "required",
    },
    {
      code: "used_oil_capture",
      text: "Capture all used oil and the filter in sealed containment and route them through the approved used-oil path. Nothing goes in a household bin or a drain.",
      severity: "stop_work",
    },
    {
      code: "supervision_present",
      text: "Do not begin without your assigned supervisor present and the supervision checkpoint recorded.",
      severity: "stop_work",
    },
  ]),
  provisional_basic_detailing: Object.freeze([
    {
      code: "wash_water_capture",
      text: "Capture wash water. Nothing may reach a street, storm drain, soil, or waterway.",
      severity: "stop_work",
    },
    {
      code: "chemical_handling",
      text: "Follow the product label for dilution, ventilation, and protective equipment, and keep chemicals off customer surfaces they are not rated for.",
      severity: "required",
    },
  ]),
  mobile_car_wash: Object.freeze([
    {
      code: "wash_water_capture",
      text: "Capture wash water and dispose of it through the approved sanitary path. Nothing may reach a street, storm drain, soil, or waterway.",
      severity: "stop_work",
    },
    {
      code: "slip_hazard",
      text: "Manage runoff and slick surfaces around the work area while you work and before you leave.",
      severity: "required",
    },
  ]),
  provisional_conventional_bulb_replacement: Object.freeze([
    {
      code: "circuit_off",
      text: "Switch the circuit off and let the bulb cool before handling it.",
      severity: "required",
    },
    {
      code: "no_hid_or_airbag_area",
      text: "Stop if the job needs work in an airbag area, a high-intensity discharge circuit, or module programming. That is outside this service.",
      severity: "stop_work",
    },
  ]),
  provisional_engine_or_cabin_air_filter: Object.freeze([
    {
      code: "no_airbag_area",
      text: "Stop if access requires disturbing an airbag, a sensor, or structural trim. That is outside this service.",
      severity: "stop_work",
    },
  ]),
  provisional_obd_read_only: Object.freeze([
    {
      code: "read_only",
      text: "Read and report codes only. Do not clear codes, program modules, or state that a repair is proven.",
      severity: "stop_work",
    },
  ]),
  basic_vehicle_diagnostics: Object.freeze([
    {
      code: "scope_boundary",
      text: "Stop before any supplemental-restraint, driver-assistance, or high-voltage system. Those are outside this service.",
      severity: "stop_work",
    },
    {
      code: "no_official_claim",
      text: "Never describe the result as an official Maryland safety or emissions inspection.",
      severity: "stop_work",
    },
    {
      code: "diagnosis_not_authorization",
      text: "A diagnosis does not authorize a repair. Any repair needs its own accepted quote.",
      severity: "required",
    },
  ]),
  battery_replacement: Object.freeze([
    {
      code: "disconnect_order",
      text: "Disconnect negative first and reconnect negative last. Keep tools off both posts at once.",
      severity: "required",
    },
    {
      code: "spent_battery",
      text: "Carry the spent battery upright in containment and route it through the approved recycling path.",
      severity: "required",
    },
  ]),
  motor_vehicle_ac_service: Object.freeze([
    {
      code: "no_venting",
      text: "Never vent refrigerant. Recover it with approved equipment by a Section 609 certified person.",
      severity: "stop_work",
    },
    {
      code: "refrigerant_ppe",
      text: "Wear eye and skin protection rated for refrigerant, and treat every line as pressurized.",
      severity: "required",
    },
  ]),
  window_tint_installation: Object.freeze([
    {
      code: "legal_vlt_check",
      text: "Confirm and record the lawful visible-light transmission for that exact vehicle and window before you start. Decline anything unlawful.",
      severity: "stop_work",
    },
  ]),
  towing_or_storage: Object.freeze([
    {
      code: "traffic_control",
      text: "Set up traffic control and high-visibility protection before you leave your cab on any roadway.",
      severity: "stop_work",
    },
    {
      code: "secure_load",
      text: "Verify the attachment, the securement, and the safety chains before moving, and re-check after the first short pull.",
      severity: "stop_work",
    },
    {
      code: "custody_condition",
      text: "Photograph the vehicle condition from all sides before hookup and at drop-off. You hold custody the whole time.",
      severity: "required",
    },
  ]),
  vehicle_lockout: Object.freeze([
    {
      code: "verify_authority",
      text: "Verify and record that the person requesting entry is authorized for that vehicle before you touch it. If anything is off, decline.",
      severity: "stop_work",
    },
    {
      code: "no_bypass",
      text: "No ignition, immobilizer, or alarm bypass. Entry assistance only.",
      severity: "stop_work",
    },
    {
      code: "airbag_awareness",
      text: "Keep tools clear of airbag paths, side curtains, and wiring in the door and pillar.",
      severity: "required",
    },
  ]),
  fuel_delivery: Object.freeze([
    {
      code: "ignition_sources",
      text: "No ignition sources within the transfer area. Engine off, no smoking, no phone use during transfer.",
      severity: "stop_work",
    },
    {
      code: "bonding_and_containment",
      text: "Use approved containers, bond the container before transfer, and keep spill containment and an extinguisher within reach.",
      severity: "stop_work",
    },
    {
      code: "spill_response",
      text: "Any spill stops the job. Contain it, report it, and follow the spill-response plan.",
      severity: "stop_work",
    },
  ]),
  body_paint_refinishing: Object.freeze([
    {
      code: "permitted_facility_only",
      text: "Refinishing happens only at the approved permitted facility, never at a customer location.",
      severity: "stop_work",
    },
    {
      code: "respiratory_protection",
      text: "Use the required respiratory protection and booth ventilation for every coating operation.",
      severity: "stop_work",
    },
  ]),
  official_vehicle_inspection: Object.freeze([
    {
      code: "station_only",
      text: "Perform an official inspection only at the licensed station, by the licensed inspection mechanic, under the state process.",
      severity: "stop_work",
    },
  ]),
  ev_high_voltage_service: Object.freeze([
    {
      code: "no_scope",
      text: "There is no approved high-voltage scope. Do not begin any high-voltage work through Tuveloz.",
      severity: "stop_work",
    },
  ]),
};

export function safetyRulesForService(service: unknown): readonly SafetyRule[] {
  const specific = typeof service === "string"
    ? SERVICE_SAFETY_RULES[service as ServiceCode] ?? []
    : [];
  return Object.freeze([...UNIVERSAL_SAFETY_RULES, ...specific]);
}

/** Split for presentation only -- absolute rules first, then standard of care. */
export function safetyRulesBySeverityFor(service: unknown) {
  const rules = safetyRulesForService(service);
  return {
    stopWork: rules.filter((rule) => rule.severity === "stop_work"),
    standardOfCare: rules.filter((rule) => rule.severity !== "stop_work"),
  };
}

export function serviceCodesWithSpecificSafetyRules(): readonly ServiceCode[] {
  return Object.freeze(Object.keys(SERVICE_SAFETY_RULES) as ServiceCode[]);
}

export const SAFETY_RULE_CODES: readonly string[] = Object.freeze([
  ...new Set([
    ...UNIVERSAL_SAFETY_RULES.map((rule) => rule.code),
    ...Object.values(SERVICE_SAFETY_RULES).flatMap(
      (rules) => (rules ?? []).map((rule) => rule.code),
    ),
  ]),
]);
