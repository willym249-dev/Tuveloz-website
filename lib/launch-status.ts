/**
 * TUVELOZ is in provider-first onboarding. Customer and provider accounts and
 * provider applications are open; customer service requests, quotes, bookings,
 * payments, and job operations stay closed until launch.
 *
 * This switch governs marketplace transactions only. It must never be read as
 * a gate on account creation or on a provider submitting an application.
 */
export const CUSTOMER_JOB_POSTING_PAUSED = true;

export const CUSTOMER_JOB_POSTING_PAUSED_MESSAGE =
  "Tuveloz is not accepting customer service requests or payments yet. We are onboarding and reviewing local provider businesses first so customers will have meaningful choices when the marketplace opens.";

export const CUSTOMER_JOB_POSTING_PAUSED_DETAIL =
  "Customer and provider accounts are available now. Creating an account does not submit a service request or charge you.";

/**
 * One server-enforced marketplace mode covers every route that can create or
 * advance a real transaction. Individual pages must not invent their own
 * launch switches.
 */
export const MARKETPLACE_MODE = "onboarding_only" as const;

export type MarketplaceAction =
  | "request"
  | "discovery"
  | "quote"
  | "booking"
  | "appointment"
  | "checkout"
  | "job_start"
  | "scope_change"
  | "completion"
  | "payout";

const CUSTOMER_JOB_POSTING_PAUSE_ACTIONS: ReadonlySet<MarketplaceAction> = new Set([
  "request",
  "discovery",
  "quote",
  "booking",
  "appointment",
  "checkout",
  "job_start",
  "scope_change",
  "completion",
  "payout",
]);

export function customerJobPostingPauseBlocks(action: MarketplaceAction) {
  return CUSTOMER_JOB_POSTING_PAUSED
    && CUSTOMER_JOB_POSTING_PAUSE_ACTIONS.has(action);
}

export function marketplaceActionAllowed(
  action: MarketplaceAction,
  options: {
    testOnly?: boolean;
    runtimeReleaseApproved?: boolean;
  } = {},
) {
  // Test records remain isolated from real providers, customers, alerts,
  // payments, and public profiles. A future live-mode code change is not
  // sufficient by itself: real actions must also receive a fresh, database-
  // backed launch-readiness decision from the server-side caller.
  return options.testOnly === true || (
    !customerJobPostingPauseBlocks(action)
    && String(MARKETPLACE_MODE) === "live"
    && options.runtimeReleaseApproved === true
  );
}

export function marketplacePausedMessage(action: MarketplaceAction) {
  const labels: Record<MarketplaceAction, string> = {
    request: "new customer requests",
    discovery: "real job discovery",
    quote: "real provider quotes",
    booking: "real bookings",
    appointment: "real appointments",
    checkout: "customer payments",
    job_start: "real job starts",
    scope_change: "added real work",
    completion: "real job completion",
    payout: "provider payout release",
  };
  return `TUVELOZ is currently in provider-onboarding mode. ${labels[action]} remain disabled until the applicable service and launch controls are approved.`;
}
