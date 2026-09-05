import type { ServiceCode } from "./provider-policy";
import type { RequiredDocument } from "./service-tiers";
import type { ProviderLegalRequirementFlags } from "./provider-compliance";

/** Only show the question section when it contains an applicable question. */
export function hasProviderSignupQuestions(flags: ProviderLegalRequirementFlags): boolean {
  return flags.montgomeryRegistration
    || flags.marylandCustomerPaperwork
    || flags.tintCompliance
    || flags.washWaterCompliance
    || flags.officialInspectionRestriction
    || flags.removedTireRule;
}

type SelectionDocuments = {
  code: ServiceCode;
  documents: readonly RequiredDocument[];
};

export type SignupDocumentGroup = {
  serviceCodes: ServiceCode[];
  documents: RequiredDocument[];
};

/**
 * Show each required document once, alongside exactly the selected services
 * that need it. The caller supplies the policy-derived requirements; this
 * presentation helper neither adds requirements nor decides eligibility.
 */
export function groupProviderSignupDocuments(
  entries: readonly SelectionDocuments[],
): SignupDocumentGroup[] {
  const documents = new Map<RequiredDocument["code"], {
    document: RequiredDocument;
    serviceCodes: ServiceCode[];
  }>();

  for (const entry of entries) {
    for (const document of entry.documents) {
      const existing = documents.get(document.code);
      if (existing) {
        if (!existing.serviceCodes.includes(entry.code)) existing.serviceCodes.push(entry.code);
      } else {
        documents.set(document.code, { document, serviceCodes: [entry.code] });
      }
    }
  }

  const groups = new Map<string, SignupDocumentGroup>();
  for (const { document, serviceCodes } of documents.values()) {
    const signature = [...serviceCodes].sort().join("|");
    const existing = groups.get(signature);
    if (existing) existing.documents.push(document);
    else groups.set(signature, { serviceCodes, documents: [document] });
  }

  // Shared items come first; service-specific items follow in selection order.
  return [...groups.values()].sort((left, right) => (
    right.serviceCodes.length - left.serviceCodes.length
  ));
}
