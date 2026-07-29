import type { ProviderSelfAssessment } from "./provider-compliance";
import { getProviderLegalRequirementFlags } from "./provider-compliance";

export const PROVIDER_CREDENTIAL_STATUSES = [
  "pending",
  "verified",
  "not-found",
  "expired",
  "rejected",
  "manual-confirmation-required",
] as const;

export const PROVIDER_CREDENTIAL_METHODS = [
  "official-online-record",
  "issuing-authority-confirmation",
  "document-and-authority-confirmation",
] as const;

export type ProviderCredentialStatus = (typeof PROVIDER_CREDENTIAL_STATUSES)[number];
export type ProviderCredentialMethod = (typeof PROVIDER_CREDENTIAL_METHODS)[number];

export type ProviderCredentialRequirement = {
  key: string;
  label: string;
  publicLabel: string;
  jurisdiction: string;
  issuingAuthority: string;
  legalBasisUrl: string;
  officialLookupUrl: string;
  verificationGuidance: string;
};

export type ProviderCredentialVerificationRecord = {
  requirementKey: string;
  requirementLabel: string;
  jurisdiction: string;
  credentialIdentifier: string;
  issuingAuthority: string;
  legalBasisUrl: string;
  officialLookupUrl: string;
  status: string;
  verificationMethod: string;
  checkedAt: string;
  expiresAt: string;
  verifiedBy: string;
};

const MONTGOMERY_REPAIR_REGISTRATION: ProviderCredentialRequirement = {
  key: "montgomery-motor-vehicle-repair-registration",
  label: "Montgomery County motor-vehicle repair registration",
  publicLabel: "Montgomery County repair registration checked",
  jurisdiction: "Montgomery County, Maryland",
  issuingAuthority: "Montgomery County Office of Consumer Protection",
  legalBasisUrl: "https://www.montgomerycountymd.gov/OCP/licensing/mvr_tow_main.html",
  officialLookupUrl: "https://data.montgomerycountymd.gov/stories/s/OCP-Perspective/kzze-c2zt/",
  verificationGuidance: "Match the provider's exact business name to the County's official repair-and-towing records. If the public record is unclear, confirm with the issuing authority before marking verified.",
};

const MARYLAND_INSPECTION_STATION: ProviderCredentialRequirement = {
  key: "maryland-safety-inspection-station-license",
  label: "Maryland safety-inspection station license",
  publicLabel: "Maryland safety-inspection station license checked",
  jurisdiction: "Maryland",
  issuingAuthority: "Maryland State Police Automotive Safety Enforcement Division",
  legalBasisUrl: "https://mdsp.maryland.gov/safety-prevention/vehicle-safety-inspections/inspection-stations-and-mechanics",
  officialLookupUrl: "https://egov.maryland.gov/msp/msis/Lookup",
  verificationGuidance: "Use the Maryland State Police lookup to confirm the station is licensed for the vehicle type. Do not treat an ordinary diagnostic or pre-purchase check as an official Maryland safety inspection.",
};

const MARYLAND_INSPECTION_MECHANIC: ProviderCredentialRequirement = {
  key: "maryland-safety-inspection-mechanic-registration",
  label: "Maryland safety-inspection mechanic registration",
  publicLabel: "Maryland safety-inspection mechanic registration checked",
  jurisdiction: "Maryland",
  issuingAuthority: "Maryland State Police Automotive Safety Enforcement Division",
  legalBasisUrl: "https://mdsp.maryland.gov/safety-prevention/vehicle-safety-inspections/inspection-stations-and-mechanics",
  officialLookupUrl: "https://egov.maryland.gov/msp/msis/Lookup",
  verificationGuidance: "Confirm the mechanic is currently registered at the licensed inspection station for the applicable vehicle type. Use issuing-authority confirmation when the public lookup does not expose the mechanic record.",
};

export function requiredProviderCredentialRequirements(
  providerServices: string | string[],
  providerAreas: string | string[],
  assessment: ProviderSelfAssessment,
) {
  const flags = getProviderLegalRequirementFlags(providerServices, providerAreas);
  const requirements: ProviderCredentialRequirement[] = [];

  if (flags.montgomeryRegistration) {
    requirements.push(MONTGOMERY_REPAIR_REGISTRATION);
  }

  if (
    flags.officialInspectionRestriction
    && assessment.diagnosticsScope === "official-authorized"
  ) {
    requirements.push(
      MARYLAND_INSPECTION_STATION,
      MARYLAND_INSPECTION_MECHANIC,
    );
  }

  return requirements;
}

export function providerCredentialRecordIsCurrent(
  record: ProviderCredentialVerificationRecord,
  now = new Date(),
) {
  if (
    record.status !== "verified"
    || !PROVIDER_CREDENTIAL_METHODS.includes(
      record.verificationMethod as ProviderCredentialMethod,
    )
    || !record.credentialIdentifier.trim()
    || !record.checkedAt
    || !record.verifiedBy
  ) {
    return false;
  }

  if (!record.expiresAt) return true;
  const expiresAt = Date.parse(record.expiresAt + "T23:59:59.999Z");
  return Number.isFinite(expiresAt) && expiresAt >= now.getTime();
}

export function unmetProviderCredentialRequirements(
  requirements: ProviderCredentialRequirement[],
  records: ProviderCredentialVerificationRecord[],
) {
  return requirements.filter((requirement) => !records.some((record) => (
    record.requirementKey === requirement.key
    && providerCredentialRecordIsCurrent(record)
  )));
}

export function providerCredentialRequirementsAreSatisfied(
  requirements: ProviderCredentialRequirement[],
  records: ProviderCredentialVerificationRecord[],
) {
  return unmetProviderCredentialRequirements(requirements, records).length === 0;
}
