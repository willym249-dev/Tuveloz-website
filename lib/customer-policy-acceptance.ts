import {
  CUSTOMER_AGREEMENT_VERSION,
  PAYMENT_POLICY_VERSION,
  PRIVACY_VERSION,
  TERMS_VERSION,
} from "./policies";
import { policyDocumentRelease } from "./policy-release-manifest";

export const CUSTOMER_POLICY_RELEASE_SCHEMA_VERSION = "1";

export const CUSTOMER_ACCEPTANCE_PURPOSES = [
  "request_scope",
  "provider_selection",
  "checkout",
] as const;

export type CustomerAcceptancePurpose =
  (typeof CUSTOMER_ACCEPTANCE_PURPOSES)[number];

// Customer-facing policies remain fail-closed until an authorized release
// records the exact normalized policy-page source hash, an effective timestamp,
// and a unique release identifier. CI recomputes the hash before deployment.
// Version labels by themselves are not proof that a draft was approved or that
// the customer saw an effective contract.
export const CUSTOMER_ACCEPTANCE_DOCUMENTS = [
  {
    key: "terms",
    version: TERMS_VERSION,
    title: "Terms of Use",
    href: "/terms",
    purposes: CUSTOMER_ACCEPTANCE_PURPOSES,
    ...policyDocumentRelease("terms"),
  },
  {
    key: "customer_agreement",
    version: CUSTOMER_AGREEMENT_VERSION,
    title: "Customer Agreement",
    href: "/customer-agreement",
    purposes: CUSTOMER_ACCEPTANCE_PURPOSES,
    ...policyDocumentRelease("customer_agreement"),
  },
  {
    key: "privacy",
    version: PRIVACY_VERSION,
    title: "Privacy Policy",
    href: "/privacy",
    purposes: ["request_scope"] as const,
    ...policyDocumentRelease("privacy"),
  },
  {
    key: "payment_policy",
    version: PAYMENT_POLICY_VERSION,
    title: "Payment, Cancellation and Refund Policy",
    href: "/payments",
    purposes: ["provider_selection", "checkout"] as const,
    ...policyDocumentRelease("payment_policy"),
  },
] as const;

type CustomerAcceptanceDocument =
  (typeof CUSTOMER_ACCEPTANCE_DOCUMENTS)[number];

const SHA256_HEX = /^[a-f0-9]{64}$/i;

export function customerAcceptanceDocumentIsReleased(
  document: CustomerAcceptanceDocument,
  asOf = new Date(),
) {
  const effectiveAt = Date.parse(document.effectiveAt);
  return document.releaseStatus === "active"
    && Boolean(document.releaseId.trim())
    && SHA256_HEX.test(document.canonicalBodyHash)
    && Number.isFinite(effectiveAt)
    && effectiveAt <= asOf.getTime();
}

export function customerAcceptanceDocumentsForPurpose(
  purpose: CustomerAcceptancePurpose,
) {
  return CUSTOMER_ACCEPTANCE_DOCUMENTS.filter((document) => (
    (document.purposes as readonly CustomerAcceptancePurpose[]).includes(purpose)
  ));
}

export function customerAcceptanceBundleIsReleasedForPurpose(
  purpose: CustomerAcceptancePurpose,
  asOf = new Date(),
) {
  const documents = customerAcceptanceDocumentsForPurpose(purpose);
  return documents.length > 0
    && documents.every((document) => (
      customerAcceptanceDocumentIsReleased(document, asOf)
    ));
}

export function customerPolicyReleaseEvidence(
  purpose: CustomerAcceptancePurpose,
) {
  return {
    schemaVersion: CUSTOMER_POLICY_RELEASE_SCHEMA_VERSION,
    purpose,
    documents: customerAcceptanceDocumentsForPurpose(purpose).map((document) => ({
      key: document.key,
      version: document.version,
      title: document.title,
      href: document.href,
      releaseStatus: document.releaseStatus,
      effectiveAt: document.effectiveAt,
      releaseId: document.releaseId,
      canonicalBodyHash: document.canonicalBodyHash,
    })),
  };
}
