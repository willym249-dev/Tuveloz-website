import { env } from "cloudflare:workers";
import { officialSourceReferenceIsValid } from "./legal-compliance-evidence";

export const EVIDENCE_AUTHENTICITY_METHODS = [
  "official_online_lookup",
  "issuer_direct_confirmation",
  "insurer_or_broker_confirmation",
  "approved_verification_vendor",
] as const;

export type EvidenceAuthenticityMethod = (
  typeof EVIDENCE_AUTHENTICITY_METHODS
)[number];

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function dateValue(value: string, endOfDate = false) {
  const normalized = endOfDate && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? `${value}T23:59:59.999Z`
    : value;
  const parsed = Date.parse(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function secureHttpsReferenceIsValid(value: string) {
  if (!value || value.length > 500) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:"
      && Boolean(url.hostname)
      && !url.username
      && !url.password;
  } catch {
    return false;
  }
}

export type EvidenceAuthenticityRecord = {
  authenticityVerificationMethod?: unknown;
  authenticityVerifiedBy?: unknown;
  authenticityVerificationReference?: unknown;
  authenticitySourceUrl?: unknown;
  authenticityVerifiedAt?: unknown;
  authenticityValidThrough?: unknown;
};

export function evidenceAuthenticityIsCurrent(
  record: EvidenceAuthenticityRecord,
  through: Date,
  now = Date.now(),
) {
  const method = text(record.authenticityVerificationMethod);
  const verifiedBy = text(record.authenticityVerifiedBy);
  const reference = text(record.authenticityVerificationReference);
  const sourceUrl = text(record.authenticitySourceUrl);
  const verifiedAt = dateValue(text(record.authenticityVerifiedAt));
  const validThrough = dateValue(text(record.authenticityValidThrough), true);
  const sourceIsValid = method === "official_online_lookup"
    ? secureHttpsReferenceIsValid(sourceUrl)
      && officialSourceReferenceIsValid(sourceUrl)
    : secureHttpsReferenceIsValid(sourceUrl);
  return EVIDENCE_AUTHENTICITY_METHODS.includes(
    method as EvidenceAuthenticityMethod,
  )
    && verifiedBy.length >= 2
    && reference.length >= 8
    && sourceIsValid
    && verifiedAt !== null
    && verifiedAt <= now
    && validThrough !== null
    && validThrough >= through.getTime();
}

export type ExternalIdentityAgeRecord = {
  identityVerificationProvider?: unknown;
  identityVerificationReference?: unknown;
  identityVerificationCheckedAt?: unknown;
  identityVerificationValidThrough?: unknown;
  ageVerificationProvider?: unknown;
  ageVerificationReference?: unknown;
  ageVerificationCheckedAt?: unknown;
  ageVerificationValidThrough?: unknown;
};

const PROHIBITED_EXTERNAL_PROVIDER_NAMES = new Set([
  "me",
  "us",
  "we",
  "self",
  "owner",
  "internal",
  "manual",
  "applicant",
  "provider",
  "test",
  "unknown",
  "none",
  "n/a",
]);

function providerNameIsProhibited(value: string) {
  return PROHIBITED_EXTERNAL_PROVIDER_NAMES.has(value)
    || value.includes("tuveloz")
    || value.includes("owner")
    || value.includes("self");
}

export function configuredExternalIdentityVerificationProviders() {
  const runtime = env as unknown as Record<string, unknown>;
  const configured = typeof runtime.IDENTITY_VERIFICATION_PROVIDERS === "string"
    ? runtime.IDENTITY_VERIFICATION_PROVIDERS
    : "";
  return [...new Set(configured
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value.length >= 3 && !providerNameIsProhibited(value)))];
}

function externalProviderNameIsValid(
  value: string,
  approvedProviders = configuredExternalIdentityVerificationProviders(),
) {
  const normalized = value.toLowerCase();
  return value.length >= 3
    && !providerNameIsProhibited(normalized)
    && approvedProviders.includes(normalized);
}

export function externalIdentityAgeVerificationIsCurrent(
  record: ExternalIdentityAgeRecord,
  through: Date,
  now = Date.now(),
) {
  const identityProvider = text(record.identityVerificationProvider);
  const ageProvider = text(record.ageVerificationProvider);
  const identityReference = text(record.identityVerificationReference);
  const ageReference = text(record.ageVerificationReference);
  const identityCheckedAt = dateValue(text(record.identityVerificationCheckedAt));
  const ageCheckedAt = dateValue(text(record.ageVerificationCheckedAt));
  const identityValidThrough = dateValue(
    text(record.identityVerificationValidThrough),
    true,
  );
  const ageValidThrough = dateValue(text(record.ageVerificationValidThrough), true);
  return externalProviderNameIsValid(identityProvider)
    && externalProviderNameIsValid(ageProvider)
    && identityReference.length >= 8
    && ageReference.length >= 8
    && identityCheckedAt !== null
    && ageCheckedAt !== null
    && identityCheckedAt <= now
    && ageCheckedAt <= now
    && identityValidThrough !== null
    && ageValidThrough !== null
    && identityValidThrough >= through.getTime()
    && ageValidThrough >= through.getTime();
}
