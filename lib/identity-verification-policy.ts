type VerifiedDob = {
  day: number | null;
  month: number | null;
  year: number | null;
};

export const IDENTITY_VERIFICATION_CONSENT_VERSION =
  "stripe-identity-owner-operator-consent-2026-08-01-v1";

export const IDENTITY_DOCUMENT_SELFIE_CONSENT_TEXT =
  "I choose Stripe's government-ID, selfie, and biometric-comparison flow after reviewing the linked privacy information and manual alternative.";

export const IDENTITY_ADULT_STATUS_CONSENT_TEXT =
  "I understand Stripe's verified date of birth will be used only in memory to confirm I am at least 18, and TUVELOZ stores the decision and dates.";

export const IDENTITY_SAME_PERSON_CERTIFICATION_TEXT =
  "I certify that I am the signed-in independent owner-operator named as the performing person in this application and that I am verifying myself.";

function text(value: unknown, maximum = 300) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

export function immutablePerformingPersonName(snapshot: unknown) {
  try {
    const parsed = typeof snapshot === "string"
      ? JSON.parse(snapshot) as Record<string, unknown>
      : snapshot as Record<string, unknown>;
    const acknowledgements = parsed?.acknowledgements as Record<string, unknown> | undefined;
    const firstName = text(parsed?.performingPersonFirstName, 80);
    const lastName = text(parsed?.performingPersonLastName, 80);
    return parsed?.format === "tuveloz_provider_application_payload_v2"
      && acknowledgements?.performingPersonIdentityAcknowledged === true
      && firstName.length >= 1
      && lastName.length >= 1
      ? { firstName, lastName, source: "application_snapshot" as const }
      : null;
  } catch {
    return null;
  }
}

export function normalizeIdentityName(value: unknown) {
  return text(value, 240)
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("en-US")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/** Exact comparison is intentional: an ambiguity must stay blocked. */
export function verifiedIdentityNameMatches(
  claimedFirstName: unknown,
  claimedLastName: unknown,
  firstName: unknown,
  lastName: unknown,
) {
  const claimedFirst = normalizeIdentityName(claimedFirstName);
  const claimedLast = normalizeIdentityName(claimedLastName);
  const verifiedFirst = normalizeIdentityName(firstName);
  const verifiedLast = normalizeIdentityName(lastName);
  return claimedFirst.length >= 1
    && claimedLast.length >= 1
    && claimedFirst === verifiedFirst
    && claimedLast === verifiedLast;
}

export function verifiedDobIsAdult(dob: VerifiedDob | null | undefined, asOf = new Date()) {
  if (
    !dob
    || !Number.isInteger(dob.year)
    || !Number.isInteger(dob.month)
    || !Number.isInteger(dob.day)
    || (dob.year ?? 0) < 1900
    || (dob.month ?? 0) < 1
    || (dob.month ?? 0) > 12
    || (dob.day ?? 0) < 1
    || (dob.day ?? 0) > 31
  ) return false;
  const year = dob.year as number;
  const month = dob.month as number;
  const day = dob.day as number;
  const birth = new Date(Date.UTC(year, month - 1, day));
  if (
    birth.getUTCFullYear() !== year
    || birth.getUTCMonth() !== month - 1
    || birth.getUTCDate() !== day
  ) return false;
  const cutoff = new Date(Date.UTC(
    asOf.getUTCFullYear() - 18,
    asOf.getUTCMonth(),
    asOf.getUTCDate(),
  ));
  return birth.getTime() <= cutoff.getTime();
}
