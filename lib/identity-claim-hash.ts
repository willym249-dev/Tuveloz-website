import { env } from "cloudflare:workers";

function secret() {
  const value = String((env as unknown as Record<string, unknown>).AUTH_CODE_SECRET ?? "");
  if (value.length < 32) throw new Error("Identity session hashing is not configured.");
  return value;
}

/**
 * Auditable account-session binding. This digest is not used as the source of
 * a person's name or as evidence of identity; the immutable v2 application
 * evidence and Stripe's signed verified output provide those bindings.
 */
export async function identityClaimSessionHash(sessionId: string) {
  if (!sessionId) throw new Error("Identity account session is missing.");
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`provider-identity-account-session:v1:${sessionId}`),
  );
  return [...new Uint8Array(signature)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
