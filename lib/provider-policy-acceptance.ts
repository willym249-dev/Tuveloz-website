import {
  MARKETPLACE_CONDUCT_VERSION,
  PAYMENT_POLICY_VERSION,
  PRIVACY_VERSION,
  PROVISIONAL_PROVIDER_POLICY_VERSION,
  PROVIDER_AGREEMENT_VERSION,
  TERMS_VERSION,
} from "./policies";
import { POLICY_VERSION } from "./provider-policy";
import { policyDocumentRelease } from "./policy-release-manifest";

export const PROVIDER_TERMS_ACCEPTANCE_TEXT =
  "I am at least 18 years old and authorized to act for the applicant or provider business. I agree to the Terms of Use, Provider Agreement, Payment, Cancellation and Refund Policy, Marketplace Conduct and Review Policy, and Provisional Provider and Trainee Policy shown for this application. I certify that the application information is complete and current, and I understand that no service or customer-job access is granted until each required approval is recorded.";

export const PROVIDER_PRIVACY_ACKNOWLEDGMENT_TEXT =
  "I separately acknowledge that I reviewed the Privacy Policy and understand how TUVELOZ handles provider-application, identity, credential, insurance, personnel, and service-eligibility information.";

/**
 * Courtesy translations of the two acceptance texts above.
 *
 * These are shown beside the English, never instead of it. The English strings
 * are the `presentedText` written into the immutable acceptance record, so the
 * English has to stay on screen for that record to be a true statement of what
 * the person was shown. Swapping the display to Spanish while still recording
 * the English would make every Spanish acceptance record false.
 *
 * Deliberately not referenced by PROVIDER_ACCEPTANCE_DOCUMENTS: changing a
 * translation must never change an evidence hash.
 */
export const PROVIDER_TERMS_ACCEPTANCE_TEXT_ES =
  "Tengo al menos 18 años y autorización para actuar en nombre del solicitante o del negocio proveedor. Acepto los Términos de Uso, el Acuerdo de Proveedor, la Política de Pago, Cancelación y Reembolso, la Política de Conducta y Reseñas del Mercado, y la Política de Proveedor Provisional y Aprendiz que se muestran para esta solicitud. Certifico que la información de la solicitud está completa y vigente, y entiendo que no se otorga acceso a ningún servicio ni trabajo de cliente hasta que se registre cada aprobación requerida.";

export const PROVIDER_PRIVACY_ACKNOWLEDGMENT_TEXT_ES =
  "Reconozco por separado que revisé la Política de Privacidad y entiendo cómo TUVELOZ maneja la información de solicitud de proveedor, identidad, credenciales, seguros, personal y elegibilidad de servicios.";

export const PROVIDER_ACCEPTANCE_EVIDENCE_SCHEMA_VERSION = "2";

export const PROVIDER_ACCEPTANCE_PURPOSES = [
  "application_review_only",
  "provider_eligibility",
] as const;

export type ProviderAcceptancePurpose = (typeof PROVIDER_ACCEPTANCE_PURPOSES)[number];

// These policy pages are still operational-review drafts. A document must be
// deliberately released in the shared manifest, with the SHA-256 of its exact
// normalized policy-page source and an effective release identifier, before a
// clickwrap record can satisfy provider eligibility. CI recomputes that hash.
// Changing a draft to active also requires a new document version so the
// immutable acceptance table records a fresh affirmative acceptance.
export const PROVIDER_ACCEPTANCE_DOCUMENTS = [
  {
    key: "terms",
    version: TERMS_VERSION,
    title: "Terms of Use",
    href: "/terms",
    control: "terms-bundle",
    presentedText: PROVIDER_TERMS_ACCEPTANCE_TEXT,
    ...policyDocumentRelease("terms"),
  },
  {
    key: "provider_agreement",
    version: PROVIDER_AGREEMENT_VERSION,
    title: "Provider Agreement",
    href: "/provider-agreement",
    control: "terms-bundle",
    presentedText: PROVIDER_TERMS_ACCEPTANCE_TEXT,
    ...policyDocumentRelease("provider_agreement"),
  },
  {
    key: "payment_policy",
    version: PAYMENT_POLICY_VERSION,
    title: "Payment, Cancellation and Refund Policy",
    href: "/payments",
    control: "terms-bundle",
    presentedText: PROVIDER_TERMS_ACCEPTANCE_TEXT,
    ...policyDocumentRelease("payment_policy"),
  },
  {
    key: "marketplace_conduct",
    version: MARKETPLACE_CONDUCT_VERSION,
    title: "Marketplace Conduct and Review Policy",
    href: "/marketplace-conduct",
    control: "terms-bundle",
    presentedText: PROVIDER_TERMS_ACCEPTANCE_TEXT,
    ...policyDocumentRelease("marketplace_conduct"),
  },
  {
    key: "provisional_provider_policy",
    version: PROVISIONAL_PROVIDER_POLICY_VERSION,
    title: "Provisional Provider and Trainee Policy",
    href: "/provisional-provider-policy",
    control: "terms-bundle",
    presentedText: PROVIDER_TERMS_ACCEPTANCE_TEXT,
    ...policyDocumentRelease("provisional_provider_policy"),
  },
  {
    key: "privacy",
    version: PRIVACY_VERSION,
    title: "Privacy Policy",
    href: "/privacy",
    control: "privacy-acknowledgment",
    presentedText: PROVIDER_PRIVACY_ACKNOWLEDGMENT_TEXT,
    ...policyDocumentRelease("privacy"),
  },
] as const;

export type ProviderAgreementKey = (typeof PROVIDER_ACCEPTANCE_DOCUMENTS)[number]["key"];

type ProviderAcceptanceDocument = (typeof PROVIDER_ACCEPTANCE_DOCUMENTS)[number];

type ProviderAgreementEvidenceOptions = {
  purpose?: ProviderAcceptancePurpose;
  acceptanceEvidenceId?: string;
  asOf?: Date;
};

const SHA256_HEX = /^[a-f0-9]{64}$/i;

export function providerAcceptanceDocumentIsReleasedForEligibility(
  document: ProviderAcceptanceDocument,
  asOf = new Date(),
) {
  const effectiveAt = Date.parse(document.effectiveAt);
  return document.releaseStatus === "active"
    && Boolean(document.releaseId.trim())
    && SHA256_HEX.test(document.canonicalBodyHash)
    && Number.isFinite(effectiveAt)
    && effectiveAt <= asOf.getTime();
}

export function providerAcceptanceBundleIsReleasedForEligibility(asOf = new Date()) {
  return PROVIDER_ACCEPTANCE_DOCUMENTS.every((document) => (
    providerAcceptanceDocumentIsReleasedForEligibility(document, asOf)
  ));
}

export function providerAgreementEvidenceText(
  document: ProviderAcceptanceDocument,
  options: ProviderAgreementEvidenceOptions = {},
) {
  const requestedPurpose = options.purpose ?? "provider_eligibility";
  const releasedForEligibility = providerAcceptanceDocumentIsReleasedForEligibility(
    document,
    options.asOf,
  );
  const acceptancePurpose: ProviderAcceptancePurpose = (
    requestedPurpose === "provider_eligibility" && releasedForEligibility
  ) ? "provider_eligibility" : "application_review_only";

  // A draft acknowledgment is immutable application-review evidence, not a
  // deterministic eligibility token. The per-acceptance identifier means a
  // later eligibility calculation cannot mistake a draft acknowledgment for a
  // released clickwrap record, even if the draft version label is unchanged.
  const acceptanceEvidenceId = acceptancePurpose === "application_review_only"
    ? options.acceptanceEvidenceId?.trim() || crypto.randomUUID()
    : "";

  return JSON.stringify({
    schemaVersion: PROVIDER_ACCEPTANCE_EVIDENCE_SCHEMA_VERSION,
    title: document.title,
    version: document.version,
    href: document.href,
    providerPolicyVersion: POLICY_VERSION,
    acceptanceControl: document.control,
    presentedText: document.presentedText,
    acceptancePurpose,
    acceptanceEvidenceId,
    release: {
      status: document.releaseStatus,
      effectiveAt: document.effectiveAt,
      releaseId: document.releaseId,
      reviewBodyHash: document.reviewBodyHash,
      canonicalBodyHash: document.canonicalBodyHash,
    },
  });
}

export async function sha256Text(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
