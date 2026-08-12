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
  | "customer_request_started"
  | "customer_request_posted"
  | "quote_received"
  | "quote_accepted"
  | "job_completed"
  // Props: { platform, source }. Measures whether the post-commit follow
  // prompts actually convert, so audience growth is judged on data rather
  // than on follower count alone.
  | "social_follow_clicked";

const ATTRIBUTION_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
] as const;

type AttributionKey = (typeof ATTRIBUTION_KEYS)[number];
type Attribution = Partial<Record<AttributionKey, string>>;

const ATTRIBUTION_STORAGE_KEY = "tuveloz_campaign_attribution_v1";
const ATTRIBUTION_VALUE_LIMIT = 120;

function cleanAttributionValue(value: string | null) {
  if (!value) return "";
  return value.trim().slice(0, ATTRIBUTION_VALUE_LIMIT);
}

/**
 * Keep only explicit UTM fields, and only for this browser tab. A visitor may
 * move through several signup steps before completion; sessionStorage carries
 * the landing attribution across those navigations without creating a durable
 * cross-session profile.
 */
function campaignAttribution(): Attribution {
  const fromUrl: Attribution = {};
  const search = new URLSearchParams(window.location.search);
  for (const key of ATTRIBUTION_KEYS) {
    const value = cleanAttributionValue(search.get(key));
    if (value) fromUrl[key] = value;
  }

  try {
    if (Object.keys(fromUrl).length > 0) {
      window.sessionStorage.setItem(ATTRIBUTION_STORAGE_KEY, JSON.stringify(fromUrl));
      return fromUrl;
    }
    const stored = JSON.parse(
      window.sessionStorage.getItem(ATTRIBUTION_STORAGE_KEY) ?? "{}",
    ) as Record<string, unknown>;
    const safe: Attribution = {};
    for (const key of ATTRIBUTION_KEYS) {
      if (typeof stored[key] !== "string") continue;
      const value = cleanAttributionValue(stored[key]);
      if (value) safe[key] = value;
    }
    return safe;
  } catch {
    // Storage can be disabled. The event still records without attribution.
    return fromUrl;
  }
}

export function track(event: AnalyticsEvent, props: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  const payload = JSON.stringify({
    event,
    props: { ...campaignAttribution(), ...props },
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
