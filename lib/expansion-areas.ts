/**
 * Areas someone can register interest in.
 *
 * Registering interest is not an application and never becomes one. Tuveloz
 * serves exactly one jurisdiction today — `US-MD-MontgomeryCounty` — and a
 * provider outside it cannot be reviewed, approved, or made eligible for work
 * by any path in this codebase. What an out-of-area signup does is record
 * demand so the owner can see where to open next.
 *
 * Nothing here may state or imply a launch date. "We will email you if Tuveloz
 * opens there" is true; "opening soon" is a promise about timing that nobody
 * can keep, and the outreach honesty rules ban it.
 */

export const EXPANSION_STATES = [
  "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado",
  "Connecticut", "Delaware", "Washington, DC", "Florida", "Georgia", "Hawaii",
  "Idaho", "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky", "Louisiana",
  "Maine", "Maryland", "Massachusetts", "Michigan", "Minnesota", "Mississippi",
  "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire", "New Jersey",
  "New Mexico", "New York", "North Carolina", "North Dakota", "Ohio",
  "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island", "South Carolina",
  "South Dakota", "Tennessee", "Texas", "Utah", "Vermont", "Virginia",
  "Washington", "West Virginia", "Wisconsin", "Wyoming",
] as const;

export type ExpansionState = (typeof EXPANSION_STATES)[number];

export function isExpansionState(value: string): value is ExpansionState {
  return (EXPANSION_STATES as readonly string[]).includes(value);
}

/**
 * True when the locality names Montgomery County, Maryland — the one area
 * already served, where the real provider application applies instead.
 */
export function isCurrentLaunchArea(state: string, locality: string) {
  return state === "Maryland" && locality.toLowerCase().includes("montgomery");
}

export const EXPANSION_ALREADY_SERVED_MESSAGE =
  "Tuveloz already serves Montgomery County. Use the customer or provider form to get started.";

/** What an out-of-area registrant is told. States the limit, promises no date. */
export const EXPANSION_RECORDED_MESSAGE =
  "Your area is recorded. Tuveloz serves only Montgomery County, Maryland today, "
  + "so there is no work available where you are yet and this is not an "
  + "application. We will email you if Tuveloz opens in your area.";
