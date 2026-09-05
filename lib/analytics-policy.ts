/** Public telemetry accepts categories, never form fields or arbitrary objects. */
export const CLIENT_ANALYTICS_EVENTS = new Set([
  "provider_signup_started", "provider_step1_completed", "provider_step2_completed",
  "provider_verification_requested", "provider_first_quote_sent",
  "account_create_started", "account_create_code_sent", "account_created",
  "customer_request_started", "customer_request_posted", "quote_received",
  "quote_accepted", "job_completed", "social_follow_clicked",
]);

// Only the application handler writes this, after committing a new application.
// Historical browser-reported completions retain their separate event name.
export const PROVIDER_APPLICATION_SUBMITTED = "provider_application_submitted";
export const ATTRIBUTION_KEYS = [
  "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term",
] as const;

export function cleanAnalyticsProps(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const raw = input as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  // Campaigns are short labels, not URLs, email addresses, or free-form text.
  for (const key of [...ATTRIBUTION_KEYS, "source"]) {
    const value = typeof raw[key] === "string" ? raw[key].trim() : "";
    if (/^[a-z0-9][a-z0-9_-]{0,119}$/i.test(value)) result[key] = value;
  }
  for (const [key, allowed] of Object.entries({
    role: ["provider", "customer"], entry: ["url", "tab"],
    platform: ["facebook", "instagram", "x", "tiktok", "google"],
  })) {
    if (typeof raw[key] === "string" && allowed.includes(raw[key])) result[key] = raw[key];
  }
  const variants = raw.variants;
  if (variants && typeof variants === "object" && !Array.isArray(variants)) {
    const safe: Record<string, string> = {};
    for (const name of ["provider_hero", "provider_pitch", "founding_cta"]) {
      const value = (variants as Record<string, unknown>)[name];
      if (value === "A" || value === "B") safe[name] = value;
    }
    if (Object.keys(safe).length) result.variants = safe;
  }
  return result;
}
