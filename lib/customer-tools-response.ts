import { CUSTOMER_SERVICE_LOCATION_OPTIONS } from "./service-matching";

export type CustomerProfile = {
  email: string;
  displayName: string;
  municipality: string;
  zip: string;
  serviceLocations: string[];
  serviceAddress: string;
};
export type CustomerProvider = {
  id: string;
  name: string;
  service: string;
  serviceArea: string;
  publicSlug: string;
};
export type CustomerTools = {
  profile: CustomerProfile;
  providerChoices: CustomerProvider[];
  savedProviders: CustomerProvider[];
};

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function readCustomerProfile(value: unknown): CustomerProfile | null {
  if (!record(value) || !["email", "displayName", "municipality", "zip", "serviceAddress"].every(key => typeof value[key] === "string")
    || !value.email || !Array.isArray(value.serviceLocations)
    || !value.serviceLocations.every(option => typeof option === "string"
      && CUSTOMER_SERVICE_LOCATION_OPTIONS.includes(option as typeof CUSTOMER_SERVICE_LOCATION_OPTIONS[number]))) return null;
  return value as CustomerProfile;
}

export function readCustomerTools(value: unknown): CustomerTools | null {
  if (!record(value) || ("error" in value && value.error !== "") || !readCustomerProfile(value.profile)) return null;
  for (const key of ["providerChoices", "savedProviders"]) {
    const providers = value[key];
    if (!Array.isArray(providers) || !providers.every(provider => record(provider)
      && ["id", "name", "service", "serviceArea", "publicSlug"].every(field => typeof provider[field] === "string")
      && provider.id && provider.name)) return null;
  }
  return value as CustomerTools;
}

export function readSavedCustomerProfile(value: unknown, expected: CustomerProfile): CustomerProfile | null {
  if (!record(value) || ("error" in value && value.error !== "")) return null;
  const profile = readCustomerProfile(value.profile);
  if (!profile || profile.email.toLowerCase() !== expected.email.toLowerCase()
    || !["displayName", "municipality", "zip", "serviceAddress"].every(key =>
      profile[key as keyof CustomerProfile] === expected[key as keyof CustomerProfile])
    || profile.serviceLocations.length !== expected.serviceLocations.length
    || !profile.serviceLocations.every(option => expected.serviceLocations.includes(option))) return null;
  return profile;
}

export function hasCustomerProviderReceipt(value: unknown): boolean {
  return record(value) && value.ok === true && !("error" in value && value.error !== "");
}

export class CustomerToolsError extends Error {
  readonly signIn: boolean;
  constructor(message: string, signIn = false) {
    super(message);
    this.name = "CustomerToolsError";
    this.signIn = signIn;
  }
}

const validationMessages = new Set([
  "Enter the name you want Tuveloz to use.",
  "Enter your city, town, or municipality.",
  "Enter the address where a provider may come to you.",
  "Enter a valid ZIP code.",
  "Service-area settings currently support Montgomery County ZIP codes.",
  "Choose only the listed customer service-location options.",
  "Choose at least one service-location option.",
  "Choose a provider.",
]);

export async function requestCustomerTools(signal: AbortSignal, fallback: string, payload?: Record<string, unknown>): Promise<unknown> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal.aborted) abort();
  else signal.addEventListener("abort", abort, { once: true });
  const timer = globalThis.setTimeout(abort, 45000);
  try {
    const response = await fetch("/api/customer-tools", {
      cache: "no-store", signal: controller.signal,
      ...(payload ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) } : {}),
    });
    const value: unknown = await response.json().catch(() => null);
    if (controller.signal.aborted) throw new CustomerToolsError(fallback);
    if (response.status === 401) throw new CustomerToolsError("Please sign in again to continue. Your unsaved changes are still on this page.", true);
    if (response.status === 403) throw new CustomerToolsError("This action isn't available for this account. If you need help, contact hello@tuveloz.com.");
    if (!response.ok) {
      if (response.status === 400 && record(value) && typeof value.error === "string" && validationMessages.has(value.error)) {
        throw new CustomerToolsError(value.error);
      }
      throw new CustomerToolsError(fallback);
    }
    return value;
  } catch (error) {
    if (error instanceof CustomerToolsError) throw error;
    throw new CustomerToolsError(fallback);
  } finally {
    globalThis.clearTimeout(timer);
    signal.removeEventListener("abort", abort);
  }
}
