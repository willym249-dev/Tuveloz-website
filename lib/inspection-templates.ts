import type { ServiceCode } from "./provider-policy";
import { SERVICES, isServiceCode } from "./provider-policy";

/**
 * Service-aware default checklist items. The inspection a provider fills in
 * should reflect the job the customer actually asked for, so each service code
 * seeds its own starter items. Items are only suggestions — the provider edits,
 * adds, and removes freely before saving.
 */
const INSPECTION_TEMPLATES: Partial<Record<ServiceCode, string[]>> = {
  general_auto_repair: [
    "Reported problem confirmed",
    "Repair completed as described",
    "Test drive / function check",
    "Work area left clean",
  ],
  battery_replacement: [
    "Old battery tested / condition noted",
    "Terminals & cables cleaned",
    "New battery secured and connected",
    "Charging system voltage checked",
  ],
  provisional_12v_battery_replacement: [
    "Old battery condition noted",
    "Terminals & cables cleaned",
    "New battery secured and connected",
    "Vehicle starts and holds charge",
  ],
  provisional_12v_jump_start: [
    "Battery voltage before jump",
    "Vehicle started successfully",
    "Charging system checked",
    "Advised on battery health",
  ],
  tire_repair_or_installation: [
    "Tire tread depth checked",
    "Tire pressure set to spec",
    "Wheel torque to spec",
    "Spare & tools returned to vehicle",
  ],
  provisional_temporary_spare_install: [
    "Flat tire removed safely",
    "Spare mounted and torqued",
    "Spare pressure checked",
    "Speed / distance limits explained",
  ],
  basic_vehicle_diagnostics: [
    "Trouble codes scanned",
    "Warning lights reviewed",
    "Test drive observations noted",
    "Findings explained to customer",
  ],
  provisional_obd_read_only: [
    "Codes read and recorded",
    "No repairs performed",
    "Results shared with customer",
  ],
  mobile_car_wash: [
    "Exterior washed",
    "Interior vacuumed",
    "Windows & mirrors cleaned",
    "No new damage observed",
  ],
  provisional_basic_detailing: [
    "Interior cleaned",
    "Surfaces wiped down",
    "Windows cleaned",
  ],
  motor_vehicle_ac_service: [
    "System pressures checked",
    "Cooling performance verified",
    "Leak inspection performed",
    "Findings explained to customer",
  ],
  provisional_wiper_blade_replacement: [
    "Correct blade size fitted",
    "Wipers tested on glass",
    "No streaking or chatter",
  ],
  provisional_engine_or_cabin_air_filter: [
    "Old filter condition noted",
    "New filter fitted correctly",
    "Housing resealed",
  ],
  provisional_fluid_topoff_limited: [
    "Fluid level checked",
    "Correct fluid added",
    "No leaks observed",
  ],
  window_tint_installation: [
    "Glass cleaned and prepped",
    "Film applied without bubbles",
    "Edges sealed cleanly",
    "Cure / rolldown time explained",
  ],
  body_paint_refinishing: [
    "Area prepped and masked",
    "Finish matched and applied",
    "Cure time explained",
    "No overspray on trim/glass",
  ],
  towing_or_storage: [
    "Vehicle condition noted before load",
    "Secured for transport",
    "Delivered / stored safely",
    "Keys & belongings accounted for",
  ],
  vehicle_lockout: [
    "Identity / ownership confirmed",
    "Entry made without damage",
    "Vehicle secured after entry",
  ],
  fuel_delivery: [
    "Correct fuel type confirmed",
    "Fuel delivered safely",
    "Vehicle starts and runs",
  ],
  official_vehicle_inspection: [
    "Required inspection points checked",
    "Result recorded",
    "Documentation provided",
  ],
  ev_high_voltage_service: [
    "High-voltage system safed",
    "Service completed to spec",
    "System re-energized and verified",
    "No fault codes remaining",
  ],
};

const GENERIC_ITEMS = [
  "Work completed as described",
  "Vehicle function checked",
  "Work area left clean",
];

/**
 * Builds a de-duplicated starter checklist from a job's service codes. Codes
 * without a specific template contribute the generic items so every job gets a
 * usable starting point.
 */
export function inspectionSuggestionsForCodes(codes: readonly string[]): string[] {
  const seen = new Set<string>();
  const items: string[] = [];
  const push = (label: string) => {
    const key = label.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    items.push(label);
  };
  let matchedAny = false;
  for (const raw of codes) {
    if (!isServiceCode(raw)) continue;
    const template = INSPECTION_TEMPLATES[raw];
    if (template) {
      matchedAny = true;
      template.forEach(push);
    }
  }
  if (!matchedAny) GENERIC_ITEMS.forEach(push);
  return items.slice(0, 20);
}

/** Human labels for a job's service codes, for the inspection heading. */
export function serviceLabelsForCodes(codes: readonly string[]): string[] {
  return codes
    .filter(isServiceCode)
    .map((code) => SERVICES.find((service) => service.code === code)?.label ?? code);
}
