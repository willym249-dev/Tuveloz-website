import type { CustomerConsentPresentation } from "./customer-job-consent";
import type { CustomerPolicyLanguage } from "./customer-policy-acceptance";

const policyPaths: Record<string, string> = {
  terms: "/terms", customer_agreement: "/customer-agreement",
  privacy: "/privacy", payment_policy: "/payments",
};

export function validCustomerConsent(value: unknown, language: CustomerPolicyLanguage, agreementKey?: string): value is CustomerConsentPresentation {
  if (!value || typeof value !== "object") return false;
  const record = value as CustomerConsentPresentation;
  const requestConsent = ["customer_request_scope", "customer_request_privacy_acknowledgment"].includes(record.agreementKey);
  const selectionConsent = record.agreementKey === "customer_provider_quote_selection";
  if ((!requestConsent && !selectionConsent) || (agreementKey && record.agreementKey !== agreementKey)) return false;
  if (record.language !== language || typeof record.agreementKey !== "string"
    || typeof record.agreementVersion !== "string" || !record.agreementVersion.endsWith(`|lang:${language}`)
    || typeof record.agreementHash !== "string" || !/^[a-f0-9]{64}$/i.test(record.agreementHash)
    || typeof record.presentedText !== "string" || !record.presentedText.trim()
    || typeof record.agreementText !== "string"
    || !Array.isArray(record.documents) || !record.documents.length) return false;
  try {
    const evidence = JSON.parse(record.agreementText);
    return evidence.language === language
      && evidence.policyRelease?.purpose === (requestConsent ? "request_scope" : "provider_selection")
      && evidence.policyRelease?.schemaVersion === "2"
      && evidence.agreementKey === record.agreementKey
      && evidence.agreementVersion === record.agreementVersion
      && evidence.presentedText === record.presentedText
      && evidence.policyRelease?.language === language
      && JSON.stringify(evidence.policyRelease.documents) === JSON.stringify(record.documents)
      && JSON.stringify(record.documents.map(document => document?.key).sort())
        === JSON.stringify(requestConsent ? ["customer_agreement", "privacy", "terms"] : ["customer_agreement", "payment_policy", "terms"])
      && record.documents.every(document => document && typeof document.title === "string"
        && Boolean(document.title.trim()) && Boolean(policyPaths[document.key])
        && document.href === `${language === "es" ? "/es" : ""}${policyPaths[document.key]}`);
  } catch { return false; }
}

export function downloadCustomerConsent(value: unknown, filename: string) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
