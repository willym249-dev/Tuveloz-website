import { SERVICES, type ServiceCode } from "./provider-policy";

/**
 * Customers can see the catalog before requests open, but seeing a service is
 * never a promise that it is available. Availability is read from the same
 * policy matrix the server enforces, so a service appears as requestable only
 * once it is actually enabled and customer-visible — enabling it in the matrix
 * is the only thing that changes this list.
 */

/**
 * The policy catalog names services the way the rules do ("Provisional 12-volt
 * jump start"). Customers get plain language for the same exact service; the
 * policy label travels with it so nothing is renamed away from its rule.
 */
const CUSTOMER_LABELS: Partial<Record<ServiceCode, { label: string; summary: string }>> = {
  provisional_12v_jump_start: {
    label: "Jump start",
    summary: "Someone comes out to jump a dead 12-volt battery.",
  },
  provisional_12v_battery_replacement: {
    label: "Battery replacement (roadside)",
    summary: "A dead 12-volt battery swapped out where your car sits.",
  },
  battery_replacement: {
    label: "Battery replacement",
    summary: "A standard vehicle battery replaced, with proper disposal of the old one.",
  },
  provisional_temporary_spare_install: {
    label: "Spare tire put on",
    summary: "Your temporary spare fitted so you can get moving again.",
  },
  tire_repair_or_installation: {
    label: "Tire repair or new tires",
    summary: "A tire repaired or replaced.",
  },
  provisional_wiper_blade_replacement: {
    label: "Wiper blades",
    summary: "New wiper blades fitted for your vehicle.",
  },
  provisional_conventional_bulb_replacement: {
    label: "Bulb replacement",
    summary: "A burned-out conventional bulb replaced.",
  },
  provisional_engine_or_cabin_air_filter: {
    label: "Air filter change",
    summary: "A simple engine or cabin air filter replaced.",
  },
  provisional_fluid_topoff_limited: {
    label: "Fluid top-off",
    summary: "An approved, limited top-off to keep you going.",
  },
  sponsored_oil_filter_service: {
    label: "Oil and filter change",
    summary: "An oil-and-filter service performed under direct supervision.",
  },
  provisional_obd_read_only: {
    label: "Check-engine light read",
    summary: "Your OBD-II codes read and reported to you. Not a diagnosis.",
  },
  basic_vehicle_diagnostics: {
    label: "Find out what's wrong",
    summary: "Limited diagnostics to narrow down an issue.",
  },
  provisional_visual_observation_report: {
    label: "Visual condition report",
    summary: "What a provider can see, written down. Not an official inspection.",
  },
  photo_documentation_only: {
    label: "Photo documentation",
    summary: "Photos of your vehicle's condition, with no diagnosis or advice.",
  },
  provisional_basic_detailing: {
    label: "Basic detailing",
    summary: "Interior and exterior cleaning under approved water controls.",
  },
  mobile_car_wash: {
    label: "Mobile car wash",
    summary: "A wash that comes to you, with proper water capture.",
  },
  motor_vehicle_ac_service: {
    label: "Air-conditioning service",
    summary: "Refrigerant service by a certified technician.",
  },
  window_tint_installation: {
    label: "Window tint",
    summary: "Tint installed within Maryland's legal limits.",
  },
  body_paint_refinishing: {
    label: "Body and paint",
    summary: "Body and paint work at a permitted facility.",
  },
  vehicle_lockout: {
    label: "Locked out",
    summary: "Help getting back into your vehicle.",
  },
  fuel_delivery: {
    label: "Out of fuel",
    summary: "Fuel brought to you.",
  },
  towing_or_storage: {
    label: "Towing",
    summary: "Your vehicle moved by a licensed tower.",
  },
  official_vehicle_inspection: {
    label: "Official inspection",
    summary: "A state inspection at an authorized station.",
  },
  ev_high_voltage_service: {
    label: "Electric-vehicle service",
    summary: "High-voltage work by a qualified specialist.",
  },
};

export type CustomerServicePreviewEntry = {
  code: ServiceCode;
  label: string;
  summary: string;
  policyLabel: string;
  available: boolean;
};

/**
 * Every service a customer might one day request, each marked with whether it
 * can be requested right now. A service the rules prohibit outright is not a
 * plan and never appears.
 */
export function customerServicePreview(): readonly CustomerServicePreviewEntry[] {
  return SERVICES
    .filter((service) => service.launchState !== "prohibited_broad_category")
    .filter((service) => CUSTOMER_LABELS[service.code])
    .map((service) => {
      const copy = CUSTOMER_LABELS[service.code]!;
      return {
        code: service.code,
        label: copy.label,
        summary: copy.summary,
        policyLabel: service.label,
        available: service.launchState === "enabled" && service.customerVisible,
      };
    });
}

export function customerServicePreviewCounts() {
  const all = customerServicePreview();
  const available = all.filter((service) => service.available).length;
  return { total: all.length, available, planned: all.length - available };
}
