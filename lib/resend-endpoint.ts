/**
 * Where transactional email is posted.
 *
 * Production always talks to Resend. Local development may redirect delivery to
 * a mail catcher so an end-to-end test can read the verification code it just
 * triggered, instead of a real inbox receiving it.
 *
 * The override is deliberately narrow. `RESEND_BASE_URL` is honoured only when
 * it points at loopback: a deployed Worker that somehow inherited the variable
 * cannot be steered into posting customer verification codes to an attacker's
 * host. Anything else falls back to Resend and is reported, rather than failing
 * closed — a misconfigured override must not silently stop real mail.
 */

const RESEND_PRODUCTION_BASE_URL = "https://api.resend.com";

const LOOPBACK_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

export function resolveResendBaseUrl(rawOverride: string | undefined) {
  const override = (rawOverride ?? "").trim();
  if (!override) {
    return RESEND_PRODUCTION_BASE_URL;
  }

  let parsed: URL;
  try {
    parsed = new URL(override);
  } catch {
    console.error("Ignoring unparseable RESEND_BASE_URL", { override });
    return RESEND_PRODUCTION_BASE_URL;
  }

  if (!LOOPBACK_HOSTNAMES.has(parsed.hostname)) {
    console.error(
      "Ignoring non-loopback RESEND_BASE_URL; transactional email stays on Resend",
      { hostname: parsed.hostname },
    );
    return RESEND_PRODUCTION_BASE_URL;
  }

  return parsed.origin;
}

export function resendEmailsUrl(rawOverride: string | undefined) {
  return `${resolveResendBaseUrl(rawOverride)}/emails`;
}
