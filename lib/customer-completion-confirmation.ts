import { sha256Text } from "./provider-policy-acceptance";

export const CUSTOMER_COMPLETION_AGREEMENT_KEY = "customer_completion_confirmation";
export const CUSTOMER_COMPLETION_AGREEMENT_VERSION = "completion-confirmation:1";

// The confirmation records what the customer could reasonably observe at
// completion. It deliberately is NOT a waiver: statutory warranty rights and
// claims for defects a customer could not reasonably discover survive it, so
// the recorded text must never read as a release of those rights.
export type CustomerCompletionScope = {
  requestId: string;
  quoteId: string;
  scopeVersion: number;
  providerName: string;
  invoiceNumber: string;
  invoiceTotalCents: number;
  workSummary: string;
  workmanshipWarranty: string;
};

function dollars(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export function customerCompletionConfirmationText(
  scope: CustomerCompletionScope,
) {
  return [
    `I confirm that ${scope.providerName} completed the work described in final invoice ${scope.invoiceNumber} (total ${dollars(scope.invoiceTotalCents)}) for job ${scope.requestId}, scope version ${scope.scopeVersion}.`,
    `The provider's work summary I reviewed: ${scope.workSummary}`,
    scope.workmanshipWarranty.trim()
      ? `The provider business's workmanship warranty for this job remains: ${scope.workmanshipWarranty}.`
      : "I previously acknowledged that this provider business offers no workmanship warranty for this job.",
    "My confirmation lets TUVELOZ finish processing payment to the provider business under the Payment, Cancellation and Refund Policy.",
    "This confirmation reflects what I could reasonably see and know today. It is not a waiver of any warranty right, of any claim about a defect I could not reasonably have discovered, or of any right the law does not allow me to waive.",
  ].join(" ");
}

export function customerCompletionScopeSnapshot(scope: CustomerCompletionScope) {
  return JSON.stringify(scope);
}

export function customerCompletionAgreementEvidenceText(
  scope: CustomerCompletionScope,
) {
  return JSON.stringify({
    agreementKey: CUSTOMER_COMPLETION_AGREEMENT_KEY,
    agreementVersion: CUSTOMER_COMPLETION_AGREEMENT_VERSION,
    acceptanceControl: "affirmative-customer-completion-confirmation-checkbox",
    presentedText: customerCompletionConfirmationText(scope),
    scopeSnapshot: JSON.parse(customerCompletionScopeSnapshot(scope)) as unknown,
  });
}

export async function customerCompletionAgreementHash(
  scope: CustomerCompletionScope,
) {
  return sha256Text(customerCompletionAgreementEvidenceText(scope));
}
