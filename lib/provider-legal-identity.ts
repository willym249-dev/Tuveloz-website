import { evidenceAuthenticityIsCurrent } from "./provider-verification-evidence";

const BUSINESS_IDENTITY_EVIDENCE_REQUIREMENTS = new Set([
  "ocp_vehicle_service_registration",
  "general_liability_coi",
  "business_auto_coverage",
  "broker_coverage_determination",
  "workers_comp_coverage",
  "md_locksmith_business_license",
  "mva_inspection_station_license",
  "mde_vehicle_refinishing_permit",
  "mde_scrap_tire_authorization",
  "tire_fee_tax_accounts",
  "ocp_towing_registration",
  "towing_custody_coverage",
  "motor_fuel_registration",
  "fuel_hazmat_fire_package",
]);

export type ProviderLegalIdentityEvidenceRow = {
  id: string;
  providerId: string;
  requirementKey: string;
  evidenceScope: string;
  status: string;
  effectiveAt: string;
  expiresAt: string;
  reviewedAt: string;
  reviewedBy: string;
  reviewDecisionId: string;
  reasonCodes: string;
  authenticityVerificationMethod: string;
  authenticityVerifiedBy: string;
  authenticityVerificationReference: string;
  authenticitySourceUrl: string;
  authenticityVerifiedAt: string;
  authenticityValidThrough: string;
};

export type VerifiedProviderLegalIdentity = {
  legalBusinessName: string;
  sourceEvidenceId: string;
  reviewDecisionId: string;
  verifiedAt: string;
};

type LegalIdentityScope = {
  legalBusinessIdentity?: {
    legalBusinessName?: unknown;
    verificationSource?: unknown;
    evidenceSubmissionId?: unknown;
    reviewDecisionId?: unknown;
    verifiedAt?: unknown;
    verifiedBy?: unknown;
  };
};

export type AdminVerifiedLegalBusinessIdentityInput = {
  legalBusinessName: string;
  evidenceSubmissionId: string;
  reviewDecisionId: string;
  verifiedAt: string;
  verifiedBy: string;
};

function text(value: unknown, max = 500) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function dateValue(value: string, endOfDate = false) {
  const normalized = endOfDate && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? `${value}T23:59:59.999Z`
    : value;
  const parsed = Date.parse(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function reasonCodes(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function parsedEvidenceScope(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

function legalIdentityScope(value: string) {
  const parsed = parsedEvidenceScope(value) as LegalIdentityScope;
  return parsed.legalBusinessIdentity ?? null;
}

export function isBusinessIdentityEvidenceRequirement(requirementKey: string) {
  return BUSINESS_IDENTITY_EVIDENCE_REQUIREMENTS.has(requirementKey);
}

export function evidenceScopeWithoutLegalBusinessIdentity(value: string) {
  const parsed = parsedEvidenceScope(value);
  delete parsed.legalBusinessIdentity;
  return JSON.stringify(parsed);
}

export function evidenceScopeWithLegalBusinessIdentity(
  value: string,
  input: AdminVerifiedLegalBusinessIdentityInput,
) {
  const parsed = parsedEvidenceScope(value);
  parsed.legalBusinessIdentity = {
    legalBusinessName: text(input.legalBusinessName, 180),
    verificationSource: "admin_reviewed_provider_evidence",
    evidenceSubmissionId: text(input.evidenceSubmissionId, 120),
    reviewDecisionId: text(input.reviewDecisionId, 120),
    verifiedAt: text(input.verifiedAt, 80),
    verifiedBy: text(input.verifiedBy, 180),
  };
  return JSON.stringify(parsed);
}

export function boundLegalBusinessIdentityReview(
  row: ProviderLegalIdentityEvidenceRow,
): VerifiedProviderLegalIdentity | null {
  const identity = legalIdentityScope(row.evidenceScope);
  const legalBusinessName = text(identity?.legalBusinessName, 180);
  const verifiedAt = text(identity?.verifiedAt, 80);
  const verifiedBy = text(identity?.verifiedBy, 180);
  if (
    row.status !== "accepted"
    || !isBusinessIdentityEvidenceRequirement(row.requirementKey)
    || !identity
    || legalBusinessName.length < 2
    || identity.verificationSource !== "admin_reviewed_provider_evidence"
    || text(identity.evidenceSubmissionId, 120) !== row.id
    || text(identity.reviewDecisionId, 120) !== row.reviewDecisionId
    || !row.reviewDecisionId
    || verifiedAt !== row.reviewedAt
    || verifiedBy !== row.reviewedBy
    || !verifiedBy
    || !reasonCodes(row.reasonCodes).includes("owner_evidence_accepted")
  ) return null;
  return {
    legalBusinessName,
    sourceEvidenceId: row.id,
    reviewDecisionId: row.reviewDecisionId,
    verifiedAt,
  };
}

function currentEvidenceWindow(
  row: ProviderLegalIdentityEvidenceRow,
  through: Date,
  now: number,
) {
  const effectiveAt = dateValue(row.effectiveAt);
  const expiresAt = row.expiresAt ? dateValue(row.expiresAt, true) : null;
  return effectiveAt !== null
    && effectiveAt <= now
    && (!row.expiresAt || (expiresAt !== null && expiresAt >= through.getTime()));
}

/**
 * Returns an exact legal identity only when an owner-reviewed, externally
 * authenticated business record contains a structured name decision bound to
 * that same evidence row. Applicant-entered names and display names never
 * satisfy this contract gate.
 */
export function verifiedProviderLegalIdentity(
  rows: readonly ProviderLegalIdentityEvidenceRow[],
  providerId: string,
  through: Date,
  now = Date.now(),
): VerifiedProviderLegalIdentity | null {
  if (!providerId || !Number.isFinite(through.getTime())) return null;

  const matches = rows.flatMap((row) => {
    const identity = boundLegalBusinessIdentityReview(row);
    const reviewedAt = dateValue(row.reviewedAt);
    if (
      row.providerId !== providerId
      || !identity
      || reviewedAt === null
      || reviewedAt > now
      || !currentEvidenceWindow(row, through, now)
      || !evidenceAuthenticityIsCurrent(row, through, now)
    ) return [];
    return [identity];
  });

  if (!matches.length) return null;
  const normalizedNames = new Set(matches.map((item) => item.legalBusinessName.toLowerCase()));
  if (normalizedNames.size !== 1) return null;
  return matches.sort((left, right) => (
    Date.parse(right.verifiedAt) - Date.parse(left.verifiedAt)
  ))[0] ?? null;
}
