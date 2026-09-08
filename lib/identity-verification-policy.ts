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

export const IDENTITY_EXPIRED_REPLACEMENT_CONSENT_TEXT =
  "I understand my prior external identity and adult-status verification has expired. I authorize TUVELOZ to revoke that expired record and start a new Stripe government-ID, selfie, and biometric-comparison review.";

export function identityConsentCopy(language: "en" | "es") {
  return language === "es" ? {
    version: "stripe-identity-owner-operator-consent-2026-09-08-es-v1",
    document: "Elijo el proceso de Stripe de identificación oficial, selfie y comparación biométrica después de revisar la información de privacidad enlazada y la alternativa manual.",
    adult: "Entiendo que la fecha de nacimiento verificada por Stripe se usará solo en memoria para confirmar que tengo al menos 18 años, y que TUVELOZ guarda la decisión y las fechas.",
    samePerson: "Certifico que soy la persona propietaria que trabaja por cuenta propia, que ha iniciado sesión y que figura como la persona que realizará el trabajo en esta solicitud, y que estoy verificando mi propia identidad.",
    replacement: "Entiendo que mi verificación externa anterior de identidad y mayoría de edad ha vencido. Autorizo a TUVELOZ a revocar ese registro vencido e iniciar una nueva revisión de identificación oficial, selfie y comparación biométrica con Stripe.",
  } : {
    version: IDENTITY_VERIFICATION_CONSENT_VERSION,
    document: IDENTITY_DOCUMENT_SELFIE_CONSENT_TEXT,
    adult: IDENTITY_ADULT_STATUS_CONSENT_TEXT,
    samePerson: IDENTITY_SAME_PERSON_CERTIFICATION_TEXT,
    replacement: IDENTITY_EXPIRED_REPLACEMENT_CONSENT_TEXT,
  };
}

export function identityConsentPresentation(language: "en" | "es") {
  return JSON.stringify({ language, ...identityConsentCopy(language) });
}

/** Missing presentation is only for the previously deployed English form. */
export function identityConsentPresentationLanguage(value: unknown): "en" | "es" | null {
  if (value === undefined) return "en";
  for (const language of ["en", "es"] as const) {
    if (value === identityConsentPresentation(language)) return language;
  }
  return null;
}

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
