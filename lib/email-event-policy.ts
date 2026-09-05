import type { MarketplaceAction } from "./launch-status";

export type EmailEventClassification =
  | { kind: "protective"; category: string }
  | { kind: "isolated_test"; category: "isolated_test" }
  | { kind: "transaction"; category: string; action: MarketplaceAction }
  // Consented marketing. Unlike protective mail it is never sent because the
  // system needs to reach someone, and unlike transaction mail it is not gated
  // on marketplace release state — it is gated on the recipient still being
  // subscribed, which is re-checked at delivery rather than trusted from queue
  // time. See lib/launch-updates.ts.
  | { kind: "marketing"; category: "launch_updates" }
  | { kind: "quarantine"; category: "unknown" };

export const MARKETING_EMAIL_EVENT_SQL_PATTERNS = [
  "launch-updates:%",
] as const;

export const PROTECTIVE_EMAIL_EVENT_SQL_PATTERNS = [
  "security:%",
  "auth:%",
  "privacy:%",
  "owner:privacy:%",
  "owner:support:%",
  "owner:safety:%",
  "owner:incident:%",
  "owner:provider-onboarding:%",
  "owner:provider-compliance:%",
  "provider-onboarding:%",
  "provider-compliance:%",
  "provider-evidence:%",
  "compliance:%",
  "safety:%",
  "incident:%",
  "claim:%",
  "cancellation:%",
  "refund:%",
  "dispute:%",
  "chargeback:%",
  "marketplace:privacy%",
  "marketplace:provider-onboarding:%",
  "marketplace:provider-compliance:%",
  "marketplace:provider-evidence:%",
  "marketplace:compliance:%",
  "marketplace:safety:%",
  "marketplace:safety-%",
  "marketplace:incident:%",
  "marketplace:incident-%",
  "marketplace:job-incident:%",
  "marketplace:job-evidence:%",
  "marketplace:claim:%",
  "marketplace:claim-%",
  "marketplace:job-cancellation:%",
  "marketplace:cancellation:%",
  "marketplace:cancellation-%",
  "marketplace:refund:%",
  "marketplace:refund-%",
  "marketplace:dispute:%",
  "marketplace:dispute-%",
  "marketplace:chargeback:%",
  "marketplace:chargeback-%",
  "marketplace:job-authorization-response:%:declined:%",
  "marketplace:job-authorization-withdrawn:%",
  "marketplace:appointment-response:%:declined:%",
  "marketplace:appointment-response:%:cancelled:%",
  "marketplace:tracking-stopped:%",
] as const;

export const TRANSACTION_EMAIL_EVENT_SQL_PATTERNS = [
  "owner:new-request:%",
  "email:job-status:%",
  "marketplace:automatic-request:%",
  "marketplace:appointment-request:%",
  "marketplace:appointment-response:%",
  "marketplace:job-authorization-created:%",
  "marketplace:job-authorization-response:%",
  "marketplace:tracking-started:%",
  "marketplace:request:%",
  "marketplace:request-%",
  "marketplace:quote:%",
  "marketplace:quote-%",
  "marketplace:booking:%",
  "marketplace:booking-%",
  "marketplace:checkout:%",
  "marketplace:checkout-%",
  "marketplace:payment:%",
  "marketplace:payment-%",
  "marketplace:payout:%",
  "marketplace:payout-%",
  "marketplace:transfer:%",
  "marketplace:transfer-%",
  "marketplace:job-start:%",
  "marketplace:job-start-%",
  "marketplace:on-my-way:%",
  "marketplace:arrived:%",
  "marketplace:completion:%",
  "marketplace:completed:%",
  "marketplace:scope-change:%",
  "marketplace:change-order:%",
  "marketplace:work-order:%",
  "email:request:%",
  "email:quote:%",
  "email:booking:%",
  "email:appointment:%",
  "email:checkout:%",
  "email:payment:%",
  "email:payout:%",
  "email:transfer:%",
  "email:job-start:%",
  "email:completion:%",
  "email:scope-change:%",
] as const;

function startsWithAny(eventKey: string, prefixes: readonly string[]) {
  return prefixes.some((prefix) => eventKey.startsWith(prefix));
}

const DIRECT_PROTECTIVE_PREFIXES = [
  "security:",
  "auth:",
  "privacy:",
  "owner:privacy:",
  "owner:support:",
  "owner:safety:",
  "owner:incident:",
  "owner:provider-onboarding:",
  "owner:provider-compliance:",
  "provider-onboarding:",
  "provider-compliance:",
  "provider-evidence:",
  "compliance:",
  "safety:",
  "incident:",
  "claim:",
  "cancellation:",
  "refund:",
  "dispute:",
  "chargeback:",
] as const;

const MARKETPLACE_PROTECTIVE_PREFIXES = [
  "marketplace:privacy",
  "marketplace:provider-onboarding:",
  "marketplace:provider-compliance:",
  "marketplace:provider-evidence:",
  "marketplace:compliance:",
  "marketplace:safety:",
  "marketplace:safety-",
  "marketplace:incident:",
  "marketplace:incident-",
  "marketplace:job-incident:",
  "marketplace:job-evidence:",
  "marketplace:claim:",
  "marketplace:claim-",
  "marketplace:job-cancellation:",
  "marketplace:cancellation:",
  "marketplace:cancellation-",
  "marketplace:refund:",
  "marketplace:refund-",
  "marketplace:dispute:",
  "marketplace:dispute-",
  "marketplace:chargeback:",
  "marketplace:chargeback-",
] as const;

const TRANSACTION_RULES: ReadonlyArray<readonly [RegExp, MarketplaceAction, string]> = [
  [/^owner:new-request:/, "request", "customer_request"],
  [/^marketplace:automatic-request:/, "discovery", "provider_job_alert"],
  [/^email:job-status:.*:completed$/, "completion", "job_completion"],
  [/^email:job-status:/, "job_start", "job_status"],
  [/^marketplace:tracking-started:/, "job_start", "trip_tracking"],
  [/^marketplace:appointment-request:/, "appointment", "appointment"],
  [/^marketplace:appointment-response:/, "appointment", "appointment"],
  [/^marketplace:job-authorization-created:/, "scope_change", "scope_authorization"],
  [/^marketplace:job-authorization-response:/, "scope_change", "scope_authorization"],
  [/^(?:marketplace|email):request(?:-|:)/, "request", "customer_request"],
  [/^(?:marketplace|email):quote(?:-|:)/, "quote", "quote"],
  [/^(?:marketplace|email):booking(?:-|:)/, "booking", "booking"],
  [/^(?:marketplace|email):appointment(?:-|:)/, "appointment", "appointment"],
  [/^(?:marketplace|email):(?:checkout|payment)(?:-|:)/, "checkout", "payment"],
  [/^(?:marketplace|email):(?:payout|transfer)(?:-|:)/, "payout", "payout"],
  [/^(?:marketplace|email):(?:job-start|on-my-way|arrived)(?:-|:)/, "job_start", "job_status"],
  [/^(?:marketplace|email):(?:completion|completed)(?:-|:)/, "completion", "job_completion"],
  [/^(?:marketplace|email):(?:scope-change|change-order|work-order)(?:-|:)/, "scope_change", "scope_authorization"],
];

export function classifyEmailEvent(rawEventKey: string): EmailEventClassification {
  const eventKey = rawEventKey.trim().toLowerCase();
  if (!eventKey) return { kind: "quarantine", category: "unknown" };
  if (eventKey.startsWith("test:") || eventKey.startsWith("marketplace:test:")) {
    return { kind: "isolated_test", category: "isolated_test" };
  }
  if (eventKey.startsWith("launch-updates:")) {
    return { kind: "marketing", category: "launch_updates" };
  }
  if (startsWithAny(eventKey, DIRECT_PROTECTIVE_PREFIXES)) {
    return { kind: "protective", category: "account_or_protective" };
  }
  if (startsWithAny(eventKey, MARKETPLACE_PROTECTIVE_PREFIXES)) {
    return { kind: "protective", category: "marketplace_protective" };
  }
  if (
    /^marketplace:job-authorization-response:.*:declined:[^:]+$/.test(eventKey)
    || eventKey.startsWith("marketplace:job-authorization-withdrawn:")
    || /^marketplace:appointment-response:.*:(?:declined|cancelled):[^:]+$/.test(eventKey)
    || eventKey.startsWith("marketplace:tracking-stopped:")
  ) {
    return { kind: "protective", category: "transaction_cleanup" };
  }
  for (const [pattern, action, category] of TRANSACTION_RULES) {
    if (pattern.test(eventKey)) return { kind: "transaction", action, category };
  }
  return { kind: "quarantine", category: "unknown" };
}

export function emailEventAllowedByReleaseState(
  eventKey: string,
  realMarketplaceTransactionsAllowed: boolean,
) {
  const classification = classifyEmailEvent(eventKey);
  return classification.kind === "protective"
    || (
      classification.kind === "transaction"
      && realMarketplaceTransactionsAllowed
    );
}
