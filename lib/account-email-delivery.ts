type EmailEnvironment = Record<string, string | undefined>;

/** Staging can temporarily deliver authentication codes to its owner only.
 * Other mailers never read these dedicated settings or credentials. */
export function accountEmailDelivery(
  recipient: string,
  environment: EmailEnvironment,
  now = Date.now(),
) {
  const configuredStaging = environment.APP_ENVIRONMENT?.trim().toLowerCase() === "staging";
  let hostname = "";
  try { hostname = new URL(environment.SITE_URL ?? "").hostname.toLowerCase(); } catch { /* No configured site. */ }
  const stagingHost = hostname === "staging.tuveloz.com"
    || (hostname.endsWith(".workers.dev") && hostname.includes("tuveloz-staging"));
  if (!configuredStaging && !stagingHost) {
    return {
      apiKey: environment.RESEND_API_KEY,
      from: environment.RESEND_FROM_EMAIL,
      subjectPrefix: "",
      notice: "",
    };
  }

  const owner = environment.OWNER_EMAIL?.trim().toLowerCase() ?? "";
  const expiresAt = Date.parse(environment.STAGING_AUTH_EMAIL_EXPIRES_AT ?? "");
  if (
    !configuredStaging
    || environment.SITE_URL?.replace(/\/+$/, "") !== "https://staging.tuveloz.com"
    || environment.STAGING_AUTH_EMAIL_ENABLED !== "true"
    || !Number.isFinite(expiresAt)
    || expiresAt <= now
    || expiresAt > now + 24 * 60 * 60 * 1000
    || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(owner)
    || recipient.trim().toLowerCase() !== owner
    || environment.RESEND_API_KEY?.trim()
    || environment.RESEND_FROM_EMAIL?.trim()
    || !environment.STAGING_AUTH_RESEND_API_KEY?.trim()
    || !environment.STAGING_AUTH_FROM_EMAIL?.trim()
  ) {
    throw new Error("Private staging authentication email is disabled or outside its approved scope.");
  }

  return {
    apiKey: environment.STAGING_AUTH_RESEND_API_KEY,
    from: environment.STAGING_AUTH_FROM_EMAIL,
    subjectPrefix: "[Tuveloz private test] ",
    notice: "This code is only for staging.tuveloz.com. It does not sign you in to the live website.",
  };
}
