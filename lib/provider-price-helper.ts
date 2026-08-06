import { customerPriceFor } from "./customer-fee.ts";

/**
 * Provider price helper logic.
 *
 * Providers set their own prices — that independence is a core commitment of
 * the Provider Agreement. This module therefore only does arithmetic with
 * numbers the provider types in: their own hourly rate, their own time
 * estimate, their own minimum. It defines no default, suggested, recommended,
 * or benchmark rate, and it must never be given one. The only market numbers
 * Tuveloz ever publishes are ranges from real completed jobs, shown to
 * customers and providers alike by the price-guidance endpoint.
 */

export const MAX_HOURLY_RATE_CENTS = 100_000; // $1,000/hour
export const MAX_JOB_MINUTES = 24 * 60;
export const MAX_TRAVEL_MINUTES = 8 * 60;
export const MAX_MINIMUM_PRICE_CENTS = 500_000; // $5,000

export type LaborQuoteInput = {
  hourlyRateCents: number;
  jobMinutes: number;
  travelMinutes?: number;
  minimumPriceCents?: number;
};

export type LaborQuoteBreakdown = {
  billableMinutes: number;
  timeBasedPriceCents: number;
  minimumApplied: boolean;
  laborPriceCents: number;
  customerFeeCents: number;
  customerTotalCents: number;
};

export type LaborQuoteResult =
  | { ok: true; breakdown: LaborQuoteBreakdown }
  | { ok: false; error: string };

function isCount(value: number, max: number) {
  return Number.isSafeInteger(value) && value >= 0 && value <= max;
}

export function computeLaborQuote(input: LaborQuoteInput): LaborQuoteResult {
  const travelMinutes = input.travelMinutes ?? 0;
  const minimumPriceCents = input.minimumPriceCents ?? 0;

  if (!Number.isSafeInteger(input.hourlyRateCents) || input.hourlyRateCents <= 0) {
    return { ok: false, error: "Enter your own hourly labor rate to calculate a price." };
  }
  if (input.hourlyRateCents > MAX_HOURLY_RATE_CENTS) {
    return { ok: false, error: "Enter an hourly rate of $1,000 or less." };
  }
  if (!Number.isSafeInteger(input.jobMinutes) || input.jobMinutes <= 0 || input.jobMinutes > MAX_JOB_MINUTES) {
    return { ok: false, error: "Estimate the time on the job, up to 24 hours." };
  }
  if (!isCount(travelMinutes, MAX_TRAVEL_MINUTES)) {
    return { ok: false, error: "Travel time can be between 0 minutes and 8 hours." };
  }
  if (!isCount(minimumPriceCents, MAX_MINIMUM_PRICE_CENTS)) {
    return { ok: false, error: "A minimum job price can be between $0 and $5,000." };
  }

  const billableMinutes = input.jobMinutes + travelMinutes;
  const timeBasedPriceCents = Math.round((input.hourlyRateCents * billableMinutes) / 60);
  const minimumApplied = minimumPriceCents > timeBasedPriceCents;
  const laborPriceCents = minimumApplied ? minimumPriceCents : timeBasedPriceCents;
  const { customerFeeCents, customerTotalCents } = customerPriceFor(laborPriceCents);

  return {
    ok: true,
    breakdown: {
      billableMinutes,
      timeBasedPriceCents,
      minimumApplied,
      laborPriceCents,
      customerFeeCents,
      customerTotalCents,
    },
  };
}

export function formatCentsAsDollars(cents: number) {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}
