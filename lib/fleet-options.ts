/**
 * Shared between the public fleet form and the API that stores its answers, so
 * the choices a business sees are exactly the ones the server accepts.
 */
export const FLEET_SIZE_OPTIONS = [
  "2–5 vehicles",
  "6–15 vehicles",
  "16–50 vehicles",
  "More than 50 vehicles",
] as const;

export type FleetSize = (typeof FLEET_SIZE_OPTIONS)[number];

export function isFleetSize(value: string): value is FleetSize {
  return (FLEET_SIZE_OPTIONS as readonly string[]).includes(value);
}
