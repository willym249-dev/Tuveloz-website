import {
  PROVIDER_POLICY_MATRIX,
  SERVICES,
  getEvidenceRequirements,
  type EvidenceRequirementCode,
  type ProviderPathway,
  type ServiceCode,
  type ServicePolicyCatalogEntry,
} from "./provider-policy";

/**
 * UI-facing projection of the real eligibility matrix into a two-tier shape:
 * "open" (no document needed for this pathway) vs "proof_required" (one or
 * more named documents needed). This never hardcodes its own service list —
 * everything is derived from `lib/provider-policy.ts` so the real matrix
 * stays the single source of truth.
 */
export type ServiceTier = "open" | "proof_required";

export interface RequiredDocument {
  code: EvidenceRequirementCode;
  label: string;
  requiresExpiration: boolean | string;
  private: boolean;
}

export function getRequiredDocuments(
  serviceCode: ServiceCode,
  pathway: ProviderPathway,
): readonly RequiredDocument[] {
  return getEvidenceRequirements(serviceCode, pathway).map((code) => {
    const definition = PROVIDER_POLICY_MATRIX.evidence_types[code];
    return {
      code,
      label: definition.label,
      requiresExpiration: definition.requires_expiration,
      private: definition.private,
    };
  });
}

export function getServiceTier(
  serviceCode: ServiceCode,
  pathway: ProviderPathway,
): ServiceTier {
  return getRequiredDocuments(serviceCode, pathway).length === 0
    ? "open"
    : "proof_required";
}

export function needsProofStep(
  serviceCodes: readonly ServiceCode[],
  pathway: ProviderPathway,
): boolean {
  return serviceCodes.some(
    (code) => getServiceTier(code, pathway) === "proof_required",
  );
}

export function getRequiredDocumentsForSelection(
  serviceCodes: readonly ServiceCode[],
  pathway: ProviderPathway,
): readonly { code: ServiceCode; label: string; documents: readonly RequiredDocument[] }[] {
  return serviceCodes
    .map((code) => {
      const documents = getRequiredDocuments(code, pathway);
      const entry = SERVICES.find((service) => service.code === code);
      return {
        code,
        label: entry?.label ?? code,
        documents,
      };
    })
    .filter((entry) => entry.documents.length > 0);
}

/** Services a customer can actually pick from today — launched and customer-visible. */
export function servicesForCustomerSelection(): readonly ServicePolicyCatalogEntry[] {
  return SERVICES.filter(
    (service) => service.launchState === "enabled" && service.customerVisible,
  );
}
