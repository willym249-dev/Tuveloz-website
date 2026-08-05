/**
 * The customer waitlist is the smallest honest ask we can make before service
 * requests open: an email, a ZIP, and the service someone is waiting for.
 * It intentionally does not create an account, collect a password, or accept
 * vehicle or job details — none of that can be used until the marketplace
 * opens, and asking for it costs conversions for no benefit.
 */
export const CUSTOMER_WAITLIST_SERVICE_OPTIONS = [
  "Mobile mechanic that comes to me",
  "Dead battery or jump start",
  "Tires",
  "Brakes",
  "Car cleaning or detailing",
  "Find out what's wrong (diagnostics)",
  "Something else",
] as const;

export type CustomerWaitlistService =
  (typeof CUSTOMER_WAITLIST_SERVICE_OPTIONS)[number];

export const CUSTOMER_WAITLIST_SERVICE_VALUES: ReadonlySet<string> = new Set(
  CUSTOMER_WAITLIST_SERVICE_OPTIONS,
);

/** Montgomery County, Maryland ZIP codes all begin 208 or 209. */
export function zipIsInsideCurrentLaunchArea(zip: string) {
  return /^20[89]\d{2}$/.test(zip.trim());
}
