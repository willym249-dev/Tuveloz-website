import type { TuvelozIconName } from "../app/components/tuveloz-icons";
import { SERVICE_CODES } from "./provider-policy";

/** One introduction for both customer entry pages; name the provider explicitly. */
export const CUSTOMER_INTRO = "We're building Tuveloz to help neighbors in Montgomery County find local vehicle services, compare quotes, and ask questions before choosing an independent service provider. You can create a free account today. Customer bookings are not open yet.";

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
    title: "Help understanding a warning light",
    text: "Ask about a code reading or eligible diagnostic service. A code reading alone does not confirm the cause or the repair.",
    serviceCodes: ["provisional_obd_read_only", "basic_vehicle_diagnostics"],
  },
];

const KNOWN_SERVICE_CODES: readonly string[] = SERVICE_CODES;
if (LAUNCH_SERVICES.some((service) => (
  service.serviceCodes.some((code) => !KNOWN_SERVICE_CODES.includes(code))
))) {
  throw new Error("The launch services list references an unknown service code.");
}

/** The provider view describes the same planned flow from the pro's side. */
export const PROVIDER_STEPS = [
  { number: "01", title: "Choose work that fits", text: "After launch, review requests in your area for services you are cleared to offer. You decide whether to quote." },
  { number: "02", title: "Send your own quote", text: "Set your labor price and describe the work you can do. You control your rates and availability." },
  { number: "03", title: "The customer chooses", text: "If a customer accepts, confirm the scope and appointment together. Applying today does not book work or guarantee jobs." },
] as const;

/** The customer story in three beats, used on the homepage and the lander. */
export const CUSTOMER_STEPS: ReadonlyArray<{
  number: string;
  title: string;
  text: string;
}> = [
  {
    number: "01",
    title: "Tell us what's going on",
    text: "Your car, what it's doing, and when you'd like it looked at. A sentence or two is plenty — you don't need to know what's wrong.",
  },
  {
    number: "02",
    title: "Prices come to you",
    text: "Local pros who are cleared for that exact job send you their own price. No calling around.",
  },
  {
    number: "03",
    title: "Choose your provider",
    text: "Compare the quotes you receive and ask questions. You can decline them all at no cost. If you book a service, review the work, fees, and total before accepting.",
  },
];
