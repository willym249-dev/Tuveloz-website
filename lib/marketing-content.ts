import type { TuvelozIconName } from "../app/components/tuveloz-icons";
import { SERVICE_CODES } from "./provider-policy";

/**
 * Marketing copy shared by the homepage and the customer lander so the two
 * never drift apart. Each entry's serviceCodes must be real entries from
 * lib/provider-policy.ts's catalog, checked below.
 *
 * Tuveloz opens with the easy-entry, no-license services — the simplest
 * onboarding path. Specialized/proof-required services (tire repair, A/C
 * service, towing, etc.) become their own categories once the marketplace is
 * ready to expand, and are not shown here yet.
 */
export const LAUNCH_SERVICES: ReadonlyArray<{
  icon: TuvelozIconName;
  title: string;
  text: string;
  serviceCodes: readonly string[];
}> = [
  {
    icon: "battery",
    title: "Battery & jump start",
    text: "Back on the road when your battery quits.",
    serviceCodes: ["provisional_12v_jump_start", "provisional_12v_battery_replacement"],
  },
  {
    icon: "services",
    title: "Wipers & bulbs",
    text: "New wiper blades and burnt-out bulbs, swapped fast.",
    serviceCodes: ["provisional_wiper_blade_replacement", "provisional_conventional_bulb_replacement"],
  },
  {
    icon: "services",
    title: "Top off fluids",
    text: "A quick top-up to keep your car running right.",
    serviceCodes: ["provisional_fluid_topoff_limited"],
  },
  {
    icon: "detailing",
    title: "Car cleaning",
    text: "An outside wash, inside cleaning, or both.",
    serviceCodes: ["provisional_basic_detailing"],
  },
  {
    icon: "diagnostics",
    title: "Find out what's wrong",
    text: "A local provider checks your car on-site to see what's going on.",
    serviceCodes: ["provisional_obd_read_only", "basic_vehicle_diagnostics"],
  },
];

const KNOWN_SERVICE_CODES: readonly string[] = SERVICE_CODES;
if (LAUNCH_SERVICES.some((service) => (
  service.serviceCodes.some((code) => !KNOWN_SERVICE_CODES.includes(code))
))) {
  throw new Error("The launch services list references an unknown service code.");
}

/** The customer story in three beats, used on the homepage and the lander. */
export const CUSTOMER_STEPS: ReadonlyArray<{
  number: string;
  title: string;
  text: string;
}> = [
  {
    number: "01",
    title: "Say what your car needs",
    text: "Your vehicle, the problem, and when you'd like it handled. A short description is plenty.",
  },
  {
    number: "02",
    title: "Real quotes come to you",
    text: "Local independent providers who are approved for that exact service send their own price.",
  },
  {
    number: "03",
    title: "Choose what works",
    text: "Compare the quotes side by side and pick one — or don't accept any. It's your call either way.",
  },
];
