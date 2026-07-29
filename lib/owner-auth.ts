import { env } from "cloudflare:workers";
import { createRemoteJWKSet, jwtVerify } from "jose";

const DEFAULT_AUTH_EMAIL_HEADER = "cf-access-authenticated-user-email";

function runtimeVariables() {
  return env as unknown as Record<string, string | undefined>;
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

/**
 * Verifies Cloudflare Access' signed application token before allowing an
 * owner-only route to expose account, session, or payment-linked data.
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
  | { ok: true }
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
  const token = request.headers.get("cf-access-jwt-assertion")?.trim() ?? "";

  if (!ownerEmail || !teamDomain || !audience) {
    return { ok: false, reason: "owner-config-missing" };
  }
  if (!token) {
    return { ok: false, reason: "access-token-missing" };
  }

  try {
    const { payload } = await jwtVerify(token, accessKeySet(teamDomain), {
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
    return { ok: true };
  } catch {
    console.error("Cloudflare Access owner-token verification failed");
    return { ok: false, reason: "access-token-invalid" };
  }
}

export async function isVerifiedOwnerRequest(request: Request) {
  return (await verifyOwnerRequest(request)).ok;
}
