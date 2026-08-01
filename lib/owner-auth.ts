import { env } from "cloudflare:workers";
import { createRemoteJWKSet, jwtVerify } from "jose";

const DEFAULT_AUTH_EMAIL_HEADER = "cf-access-authenticated-user-email";
const ACCESS_COOKIE_NAME = "CF_Authorization";
const OWNER_BRIDGE_COOKIE_NAME = "__Host-tuveloz_owner_access";
const OWNER_BRIDGE_MAX_AGE_SECONDS = 15 * 60;

function runtimeVariables() {
  return env as unknown as Record<string, string | undefined>;
}

function cookieValue(request: Request, name: string) {
  const cookieHeader = request.headers.get("cookie") ?? "";
  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    const key = part.slice(0, separator).trim();
    if (key !== name) continue;
    const raw = part.slice(separator + 1).trim();
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }
  return "";
}

export function getAuthenticatedEmail(request: Request): string {
  const headerName =
    runtimeVariables().AUTH_EMAIL_HEADER?.trim() || DEFAULT_AUTH_EMAIL_HEADER;
  return request.headers.get(headerName)?.trim().toLowerCase() ?? "";
}

export function isOwnerRequest(request: Request): boolean {
  const ownerEmail = runtimeVariables().OWNER_EMAIL?.trim().toLowerCase() ?? "";
  return Boolean(ownerEmail) && getAuthenticatedEmail(request) === ownerEmail;
}

const accessKeySets = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function configuredTeamDomain() {
  const value = runtimeVariables().TEAM_DOMAIN?.trim().replace(/\/+$/, "") ?? "";
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:"
      || !url.hostname.endsWith(".cloudflareaccess.com")
      || url.pathname !== "/"
    ) {
      return "";
    }
    return url.origin;
  } catch {
    return "";
  }
}

function accessKeySet(teamDomain: string) {
  const existing = accessKeySets.get(teamDomain);
  if (existing) return existing;
  const keySet = createRemoteJWKSet(
    new URL(`${teamDomain}/cdn-cgi/access/certs`),
  );
  accessKeySets.set(teamDomain, keySet);
  return keySet;
}

export type OwnerAccessTokenSource = "access-header" | "access-cookie" | "owner-bridge";

function accessTokenFrom(request: Request): {
  token: string;
  source: OwnerAccessTokenSource | "";
} {
  const headerToken = request.headers.get("cf-access-jwt-assertion")?.trim() ?? "";
  if (headerToken) return { token: headerToken, source: "access-header" };

  const bridgeToken = cookieValue(request, OWNER_BRIDGE_COOKIE_NAME).trim();
  if (bridgeToken) return { token: bridgeToken, source: "owner-bridge" };

  const accessCookie = cookieValue(request, ACCESS_COOKIE_NAME).trim();
  if (accessCookie) return { token: accessCookie, source: "access-cookie" };

  return { token: "", source: "" };
}

export function ownerBridgeCookie(token: string) {
  return [
    `${OWNER_BRIDGE_COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/",
    `Max-Age=${OWNER_BRIDGE_MAX_AGE_SECONDS}`,
    "HttpOnly",
    "Secure",
    "SameSite=Strict",
  ].join("; ");
}

export function clearOwnerBridgeCookie() {
  return [
    `${OWNER_BRIDGE_COOKIE_NAME}=`,
    "Path=/",
    "Max-Age=0",
    "HttpOnly",
    "Secure",
    "SameSite=Strict",
  ].join("; ");
}

/**
 * Verifies Cloudflare Access' signed application token before allowing an
 * owner-only route to expose account, session, or payment-linked data.
 *
 * The Access assertion header remains the preferred source. Browser requests
 * may also carry the signed CF_Authorization cookie. A short-lived Tuveloz
 * bridge cookie can carry the same already-verified Access JWT from the
 * protected /admin path to same-origin /api/admin requests when an Access
 * application's cookie path or route coverage does not include the API path.
 * Every source is verified against Cloudflare's rotating signing keys,
 * configured issuer, audience, expiration, and the exact owner email.
 *
 * TEAM_DOMAIN and OWNER_ACCESS_AUD must match the Cloudflare Access application.
 * POLICY_AUD remains a legacy fallback. Missing or invalid configuration fails closed.
 */
export type OwnerVerificationFailure =
  | "owner-config-missing"
  | "access-token-missing"
  | "access-token-invalid"
  | "owner-email-mismatch";

export type OwnerVerificationResult =
  | {
      ok: true;
      email: string;
      token: string;
      source: OwnerAccessTokenSource;
    }
  | { ok: false; reason: OwnerVerificationFailure };

export async function verifyOwnerRequest(
  request: Request,
): Promise<OwnerVerificationResult> {
  const variables = runtimeVariables();
  const ownerEmail = variables.OWNER_EMAIL?.trim().toLowerCase() ?? "";
  const teamDomain = configuredTeamDomain();
  const audience =
    variables.OWNER_ACCESS_AUD?.trim()
    || variables.POLICY_AUD?.trim()
    || "";
  const access = accessTokenFrom(request);

  if (!ownerEmail || !teamDomain || !audience) {
    return { ok: false, reason: "owner-config-missing" };
  }
  if (!access.token || !access.source) {
    return { ok: false, reason: "access-token-missing" };
  }

  try {
    const { payload } = await jwtVerify(access.token, accessKeySet(teamDomain), {
      algorithms: ["RS256"],
      issuer: teamDomain,
      audience,
    });
    const tokenEmail = typeof payload.email === "string"
      ? payload.email.trim().toLowerCase()
      : "";
    const assertedEmail = getAuthenticatedEmail(request);
    if (
      tokenEmail !== ownerEmail
      || (assertedEmail && assertedEmail !== tokenEmail)
    ) {
      return { ok: false, reason: "owner-email-mismatch" };
    }
    return {
      ok: true,
      email: tokenEmail,
      token: access.token,
      source: access.source,
    };
  } catch {
    console.error("Cloudflare Access owner-token verification failed");
    return { ok: false, reason: "access-token-invalid" };
  }
}

export async function isVerifiedOwnerRequest(request: Request) {
  return (await verifyOwnerRequest(request)).ok;
}
