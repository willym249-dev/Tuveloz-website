export const PROVIDER_APPLICATION_PAYLOAD_HASH_ACCEPTANCE_MARKER =
  "provider-application-payload-hash-binding-v1";

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, canonicalize(nested)]),
    );
  }
  return value;
}

export function canonicalJson(value: unknown) {
  return JSON.stringify(canonicalize(value));
}

async function hmacHexWithSecret(value: string, secretValue: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secretValue),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(value),
  );
  return [...new Uint8Array(signature)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Produces the opaque fingerprint bound to a provider-application challenge.
 * Every caller supplies already-normalized application data plus deterministic
 * document fingerprints; recursively sorted keys make equivalent objects hash
 * identically even when their property insertion order differs.
 */
export async function providerApplicationPayloadHashWithSecret(
  application: unknown,
  acceptedDocuments: unknown,
  secretValue: string,
) {
  if (secretValue.length < 32) {
    throw new Error("Provider application payload hashing requires a strong secret.");
  }
  const canonicalPayload = canonicalJson({
    application,
    acceptedDocuments,
  });
  return hmacHexWithSecret(
    `provider-application-payload:v1:${canonicalPayload}`,
    secretValue,
  );
}
