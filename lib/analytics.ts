/**
 * Minimal first-party funnel-event tracker. No third-party analytics tool is
 * wired in yet (none exists in this codebase) — events are persisted to the
 * analytics_events D1 table via /api/analytics so drop-off is measurable
 * from day one without sending real user behavior to a third party before
 * you've chosen and set one up (Plausible, PostHog, GA4, etc.). Swap the
 * POST target in `track` for a real SDK call later; call sites don't need
 * to change.
 */

export type AnalyticsEvent =
  | "provider_signup_started"
  | "provider_step1_completed"
  | "provider_step2_completed"
  | "provider_step2_abandoned"
  | "provider_signup_completed"
  | "provider_first_quote_sent"
  // Account creation is role-neutral: both customers and provider applicants
  // create sign-in credentials here. The role travels in props rather than in
  // the event name, so a count of one event can never silently mix the two.
  | "account_create_started"
  | "account_create_code_sent"
  | "account_created"
  // Sitewide launch banner. Impression is per page load, not per render, so
  // clicks divided by impressions is a real click-through rate.
  | "launch_banner_impression"
  | "launch_banner_cta_clicked"
  | "customer_request_started"
  | "customer_request_posted"
  | "quote_received"
  | "quote_accepted"
  | "job_completed";

/**
 * Attribution, kept separate from the event names on purpose.
 *
 * Counting banner clicks tells you people clicked. It does not tell you whether
 * the banner produced finished accounts, because `account_created` fires on a
 * different page, after a code round trip, with nothing linking it back. So the
 * surface that sent someone is remembered for the tab session and merged into
 * every later event, which makes `account_created` attributable rather than
 * merely counted.
 *
 * sessionStorage, not a cookie or localStorage: it dies with the tab, carries no
 * identifier, and cannot follow anyone between visits. An explicit prop at the
 * call site always wins, so this can never overwrite what a caller stated.
 */
const ATTRIBUTION_KEY = "tuveloz-attribution-v1";

export function rememberAttribution(props: Record<string, string>) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(props));
  } catch {
    // Private browsing and full quotas both throw. Attribution is a nicety;
    // losing it must never break the flow the person is actually in.
  }
}

function storedAttribution(): Record<string, unknown> {
  if (typeof window === "undefined") return {};
  try {
    const raw = sessionStorage.getItem(ATTRIBUTION_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function track(event: AnalyticsEvent, props: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  const payload = JSON.stringify({
    event,
    props: { ...storedAttribution(), ...props },
    at: new Date().toISOString(),
  });
  const sent = typeof navigator.sendBeacon === "function"
    && navigator.sendBeacon("/api/analytics", new Blob([payload], { type: "application/json" }));
  if (!sent) {
    fetch("/api/analytics", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: payload,
      keepalive: true,
    }).catch(() => {
      // Analytics is supporting data; a failed beacon must not block the user.
    });
  }
}
