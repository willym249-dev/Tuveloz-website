import { CHECKOUT_POLICY_BUNDLE_VERSION } from "./policies";
import { customerPolicyReleaseEvidence } from "./customer-policy-acceptance";
import { sha256Text } from "./provider-policy-acceptance";

export const CUSTOMER_CHECKOUT_AGREEMENT_KEY = "customer_checkout_authorization";
export const CUSTOMER_CHECKOUT_AGREEMENT_VERSION =
  `${CHECKOUT_POLICY_BUNDLE_VERSION}|checkout:2`;

export const CUSTOMER_CHECKOUT_CANCELLATION_REFUND_SUMMARY =
  "Payment does not authorize added work or a price increase. Cancellation, refund, dispute, and payout handling follows the displayed Payment, Cancellation and Refund Policy and applicable law. TUVELOZ does not certify the repair merely because payment or payout records are reviewed.";

export type CustomerCheckoutAcceptanceScope = {
  requestId: string;
  quoteId: string;
  scopeVersion: number;
  scopeAuthorizationDecisionId: string;
  providerApplicationId: string;
  providerLegalName: string;
  providerLegalIdentitySourceEvidenceId: string;
  providerLegalIdentityReviewDecisionId: string;
  providerLegalIdentityVerifiedAt: string;
  performingPersonId: string;
  supervisorPersonId: string;
  serviceCodes: readonly string[];
  scheduledFor: string;
  laborAmountCents: number;
  partsAmountCents: number;
  taxAmountCents: number;
  otherAmountCents: number;
  providerAmountCents: number;
  customerFeeRateBps: number;
  customerFeeCents: number;
  customerTotalCents: number;
};

function dollars(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export function customerCheckoutScopeSnapshot(
  scope: CustomerCheckoutAcceptanceScope,
) {
  return JSON.stringify({
    ...scope,
    serviceCodes: [...scope.serviceCodes],
    cancellationRefundSummary: CUSTOMER_CHECKOUT_CANCELLATION_REFUND_SUMMARY,
  });
}

export function customerCheckoutAcceptanceText(
  scope: CustomerCheckoutAcceptanceScope,
) {
  return [
    `I agree to the Terms of Use, Customer Agreement, and Payment, Cancellation and Refund Policy shown for quote ${scope.quoteId}, scope version ${scope.scopeVersion}.`,
    `Provider legal identity: ${scope.providerLegalName}.`,
    `Exact service codes: ${scope.serviceCodes.join(", ")}.`,
    `Scheduled time: ${scope.scheduledFor}. Performing person ID: ${scope.performingPersonId}. Supervisor person ID: ${scope.supervisorPersonId || "none"}.`,
    `Itemized price: labor ${dollars(scope.laborAmountCents)}; parts ${dollars(scope.partsAmountCents)}; tax ${dollars(scope.taxAmountCents)}; other charges ${dollars(scope.otherAmountCents)}; complete provider amount ${dollars(scope.providerAmountCents)}; TUVELOZ fee ${dollars(scope.customerFeeCents)}; customer total ${dollars(scope.customerTotalCents)}.`,
    `The selected provider business, ${scope.providerLegalName}, not TUVELOZ, performs only those exact listed vehicle services.`,
    CUSTOMER_CHECKOUT_CANCELLATION_REFUND_SUMMARY,
    "I can save or download this exact acceptance record.",
  ].join(" ");
}

export function customerCheckoutAgreementEvidenceText(
  scope: CustomerCheckoutAcceptanceScope,
) {
  return JSON.stringify({
    agreementKey: CUSTOMER_CHECKOUT_AGREEMENT_KEY,
    agreementVersion: CUSTOMER_CHECKOUT_AGREEMENT_VERSION,
    acceptanceControl: "affirmative-exact-checkout-authorization-checkbox",
    presentedText: customerCheckoutAcceptanceText(scope),
    policyRelease: customerPolicyReleaseEvidence("checkout"),
    scopeSnapshot: JSON.parse(customerCheckoutScopeSnapshot(scope)) as unknown,
  });
}

export async function customerCheckoutAgreementHash(
  scope: CustomerCheckoutAcceptanceScope,
) {
  return sha256Text(customerCheckoutAgreementEvidenceText(scope));
}
