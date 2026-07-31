import {
  areaForZip,
  CURRENT_LAUNCH_AREA,
  CUSTOMER_SERVICE_LOCATION_OPTIONS,
  PROVIDER_WORK_LOCATION_OPTIONS,
  serializeLocationOptions,
} from "./service-matching";

export const PROVIDER_TRAVEL_RADIUS_OPTIONS = [5, 10, 15, 25, 50] as const;

export function cleanServiceAreaText(value: unknown, maximum: number) {
  return String(value ?? "").trim().slice(0, maximum);
}

export function normalizeMontgomeryCountyZip(value: unknown) {
  const zip = cleanServiceAreaText(value, 10);
  if (!/^\d{5}(?:-\d{4})?$/.test(zip)) {
    throw new Error("Enter a valid ZIP code.");
  }
  if (areaForZip(zip) !== "Montgomery County") {
    throw new Error("Service-area settings currently support Montgomery County ZIP codes.");
  }
  return zip;
}

export function normalizeCustomerServiceLocations(value: unknown) {
  const choices = Array.isArray(value) ? value.map(String) : [String(value ?? "")];
  if (choices.some((choice) => !CUSTOMER_SERVICE_LOCATION_OPTIONS.includes(
    choice as (typeof CUSTOMER_SERVICE_LOCATION_OPTIONS)[number],
  ))) {
    throw new Error("Choose only the listed customer service-location options.");
  }
  const serialized = serializeLocationOptions(choices, CUSTOMER_SERVICE_LOCATION_OPTIONS);
  if (!serialized) throw new Error("Choose at least one service-location option.");
  return serialized;
}

export function normalizeProviderWorkLocations(value: unknown) {
  const choices = Array.isArray(value) ? value.map(String) : [String(value ?? "")];
  if (choices.some((choice) => !PROVIDER_WORK_LOCATION_OPTIONS.includes(
    choice as (typeof PROVIDER_WORK_LOCATION_OPTIONS)[number],
  ))) {
    throw new Error("Choose only the listed provider work-location options.");
  }
  const serialized = serializeLocationOptions(choices, PROVIDER_WORK_LOCATION_OPTIONS);
  if (!serialized) throw new Error("Choose at least one way to serve customers.");
  return serialized;
}

export function normalizeTravelRadius(value: unknown) {
  const radius = Number(value);
  if (!PROVIDER_TRAVEL_RADIUS_OPTIONS.includes(
    radius as (typeof PROVIDER_TRAVEL_RADIUS_OPTIONS)[number],
  )) {
    throw new Error("Choose a listed travel distance.");
  }
  return radius;
}

export function currentProviderLaunchArea(value: unknown) {
  const serviceArea = cleanServiceAreaText(value, 80);
  if (serviceArea !== CURRENT_LAUNCH_AREA) {
    throw new Error("Tuveloz provider settings currently support Montgomery County, Maryland.");
  }
  return serviceArea;
}
