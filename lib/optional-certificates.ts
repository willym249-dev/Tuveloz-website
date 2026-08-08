/**
 * Optional, provider-declared certificates (for example ASE) captured during
 * signup. This module only defines the small category catalog and normalizes
 * the untrusted signup field. The records themselves flow into the existing
 * `provider_submitted_credentials` pipeline (provider adds → owner verifies in
 * marketplace tools → public badge), so they are never required, never gate a
 * service, and are never shown to a customer until the owner verifies them.
 */

export const OPTIONAL_CERTIFICATE_CATEGORIES = [
  { key: "ase", en: "ASE certification", es: "Certificación ASE" },
  { key: "manufacturer", en: "Manufacturer or brand training", es: "Capacitación del fabricante o marca" },
  { key: "icar", en: "I-CAR collision training", es: "Capacitación de colisión I-CAR" },
  { key: "ev_hybrid", en: "EV or hybrid training", es: "Capacitación de vehículos eléctricos o híbridos" },
  { key: "other", en: "Another certificate", es: "Otro certificado" },
] as const;

export type OptionalCertificateCategory =
  (typeof OPTIONAL_CERTIFICATE_CATEGORIES)[number]["key"];

/**
 * Readable name for a stored category. Credentials a provider added by hand in
 * marketplace tools carry no category, so an empty or unknown value returns "".
 */
export function optionalCertificateCategoryLabel(value: unknown, isSpanish = false) {
  const entry = OPTIONAL_CERTIFICATE_CATEGORIES.find((option) => option.key === value);
  if (!entry) return "";
  return isSpanish ? entry.es : entry.en;
}

export const MAX_OPTIONAL_CERTIFICATES = 12;
const MAX_TITLE_LENGTH = 120;
const MAX_IDENTIFIER_LENGTH = 80;
const MAX_ISSUER_LENGTH = 120;

export type DeclaredOptionalCertificate = {
  category: OptionalCertificateCategory;
  title: string;
  credentialIdentifier: string;
  issuingAuthority: string;
};

function isOptionalCertificateCategory(
  value: unknown,
): value is OptionalCertificateCategory {
  return (
    typeof value === "string"
    && OPTIONAL_CERTIFICATE_CATEGORIES.some((entry) => entry.key === value)
  );
}

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

/**
 * Normalize the untrusted `optionalCertificates` field from a provider
 * application. A row only survives if it names a known category AND a title;
 * everything else is dropped, the list is capped, and free-text is trimmed and
 * length-limited. Returns [] for any non-array input.
 */
export function cleanOptionalCertificates(
  raw: unknown,
): DeclaredOptionalCertificate[] {
  if (!Array.isArray(raw)) return [];
  const cleaned: DeclaredOptionalCertificate[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    if (!isOptionalCertificateCategory(record.category)) continue;
    const title = cleanText(record.title, MAX_TITLE_LENGTH);
    if (!title) continue;
    cleaned.push({
      category: record.category,
      title,
      credentialIdentifier: cleanText(record.credentialIdentifier, MAX_IDENTIFIER_LENGTH),
      issuingAuthority: cleanText(record.issuingAuthority, MAX_ISSUER_LENGTH),
    });
    if (cleaned.length >= MAX_OPTIONAL_CERTIFICATES) break;
  }
  return cleaned;
}
