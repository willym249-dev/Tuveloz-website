/**
 * Share-code shape, with no database or server dependency so the signup form
 * can validate a ?ref= value in the browser using the same rules the server
 * applies. A referral is attribution only: it never pays anything, never
 * changes search ranking or job routing, and never reveals who signed up.
 */

/** No vowels and no look-alike characters, so a spoken or written code survives. */
export const REFERRAL_CODE_ALPHABET = "ABCDFGHJKLMNPQRSTVWXYZ23456789";
export const REFERRAL_CODE_LENGTH = 8;

const CODE_PATTERN = new RegExp(
  `^[${REFERRAL_CODE_ALPHABET}]{${REFERRAL_CODE_LENGTH}}$`,
);

export function generateReferralCode() {
  const bytes = new Uint8Array(REFERRAL_CODE_LENGTH);
  crypto.getRandomValues(bytes);
  return [...bytes]
    .map((byte) => REFERRAL_CODE_ALPHABET[byte % REFERRAL_CODE_ALPHABET.length])
    .join("");
}

/**
 * Returns "" for anything that is not a well-formed code.
 *
 * Case, surrounding space, and separators someone types are forgiven, but a
 * value of the wrong length is rejected rather than truncated: trimming an
 * over-long code to its first characters would silently credit whichever
 * different account happens to own that prefix.
 */
export function normalizeReferralCode(value: unknown) {
  if (typeof value !== "string" || value.length > 100) return "";
  const normalized = value.trim().toUpperCase().replace(/[\s-]/g, "");
  return CODE_PATTERN.test(normalized) ? normalized : "";
}
