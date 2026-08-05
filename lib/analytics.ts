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
  | "customer_request_started"
  | "customer_request_posted"
  | "quote_received"
  | "quote_accepted"
  | "job_completed"
  // Props: { platform, source }. Measures whether the post-commit follow
  // prompts actually convert, so audience growth is judged on data rather
  // than on follower count alone.
  | "social_follow_clicked";

export function track(event: AnalyticsEvent, props: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  const payload = JSON.stringify({ event, props, at: new Date().toISOString() });
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
