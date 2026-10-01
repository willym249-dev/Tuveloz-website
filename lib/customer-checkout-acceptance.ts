import { CHECKOUT_POLICY_BUNDLE_VERSION } from "./policies";
import { customerPolicyPresentationEvidence, type CustomerPolicyLanguage } from "./customer-policy-acceptance";
import { sha256Text } from "./provider-policy-acceptance";

export const CUSTOMER_CHECKOUT_AGREEMENT_KEY = "customer_checkout_authorization";
// Advance this revision whenever authorization wording or presentation metadata
// changes. Language is part of the immutable database key, never an overwrite.
export function customerCheckoutAgreementVersion(language: CustomerPolicyLanguage) {
  return `${CHECKOUT_POLICY_BUNDLE_VERSION}|checkout:6|lang:${language}`;
}

export const CUSTOMER_CHECKOUT_CANCELLATION_REFUND_SUMMARY =
  "Payment does not authorize added work or a price increase. Cancellation, refund, dispute, and payout handling follows the displayed Payment, Cancellation and Refund Policy and applicable law. TUVELOZ does not certify the repair merely because payment or payout records are reviewed.";

export function customerCheckoutCancellationRefundSummary(language: CustomerPolicyLanguage) {
  return language === "es"
    ? "El pago no autoriza trabajo adicional ni un aumento de precio. Las cancelaciones, los reembolsos, las disputas y los pagos al proveedor se gestionan conforme a la Política de pagos, cancelaciones y reembolsos mostrada y a la ley aplicable. Revisar los registros de pago o de transferencia no significa que TUVELOZ certifique la reparación."
    : CUSTOMER_CHECKOUT_CANCELLATION_REFUND_SUMMARY;
}

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
  workmanshipWarranty: string;
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
  language: CustomerPolicyLanguage,
) {
  return JSON.stringify({
    ...scope,
    serviceCodes: [...scope.serviceCodes],
    cancellationRefundSummary: customerCheckoutCancellationRefundSummary(language),
  });
}

export function customerCheckoutAcceptanceText(
  scope: CustomerCheckoutAcceptanceScope,
  language: CustomerPolicyLanguage,
) {
  if (language === "es") return [
    "Confirmo que este pago incluye únicamente mano de obra para el servicio del vehículo. No incluye piezas suministradas por el proveedor, reembolsos por piezas, impuestos sobre piezas ni cargos por piezas.",
    `Acepto los Términos de uso, el Acuerdo del cliente y la Política de pagos, cancelaciones y reembolsos que se muestran para la cotización ${scope.quoteId}, versión ${scope.scopeVersion} del alcance del trabajo.`,
    `Nombre legal del proveedor: ${scope.providerLegalName}.`,
    `Códigos de los servicios específicos: ${scope.serviceCodes.join(", ")}.`,
    `Fecha y hora programadas: ${scope.scheduledFor}. Identificador de la persona que realizará el trabajo: ${scope.performingPersonId}. Identificador del supervisor: ${!scope.supervisorPersonId || scope.supervisorPersonId === "none" ? "ninguno" : scope.supervisorPersonId}.`,
    `Desglose del precio: mano de obra ${dollars(scope.laborAmountCents)}; piezas ${dollars(scope.partsAmountCents)}; impuestos ${dollars(scope.taxAmountCents)}; otros cargos ${dollars(scope.otherAmountCents)}; importe total del proveedor ${dollars(scope.providerAmountCents)}; Tarifa de Servicio al Cliente ${dollars(scope.customerFeeCents)}; total a pagar ${dollars(scope.customerTotalCents)}.`,
    `Autorizo el pago del total mostrado a TUVELOZ LLC a través de Stripe al finalizar el pago. El negocio proveedor que elegí, ${scope.providerLegalName}, realiza únicamente los servicios del vehículo indicados; TUVELOZ no los realiza.`,
    scope.workmanshipWarranty.trim()
      ? `Garantía de mano de obra ofrecida por el negocio proveedor: ${scope.workmanshipWarranty}. Esa garantía es entre el negocio proveedor y yo. TUVELOZ no la ofrece, respalda ni administra.`
      : "El negocio proveedor no ofrece garantía de mano de obra para este trabajo. Cada proveedor independiente decide si ofrece una; Tuveloz no la exige. Confirmé que comprendía esta condición al seleccionar al proveedor.",
    customerCheckoutCancellationRefundSummary(language),
    "Puedo guardar o descargar este registro exacto de aceptación.",
  ].join(" ");
  return [
    "I confirm this payment includes vehicle-service labor only and no provider-supplied parts, parts reimbursement, parts tax, or parts charge.",
    `I agree to the Terms of Use, Customer Agreement, and Payment, Cancellation and Refund Policy shown for quote ${scope.quoteId}, scope version ${scope.scopeVersion}.`,
    `Provider legal identity: ${scope.providerLegalName}.`,
    `Exact service codes: ${scope.serviceCodes.join(", ")}.`,
    `Scheduled time: ${scope.scheduledFor}. Performing person ID: ${scope.performingPersonId}. Supervisor person ID: ${scope.supervisorPersonId || "none"}.`,
    `Itemized price: labor ${dollars(scope.laborAmountCents)}; parts ${dollars(scope.partsAmountCents)}; tax ${dollars(scope.taxAmountCents)}; other charges ${dollars(scope.otherAmountCents)}; complete provider amount ${dollars(scope.providerAmountCents)}; Customer Service Fee ${dollars(scope.customerFeeCents)}; customer total ${dollars(scope.customerTotalCents)}.`,
    `I authorize payment of the displayed total to TUVELOZ LLC through Stripe at checkout. The selected provider business, ${scope.providerLegalName}, not TUVELOZ, performs only those exact listed vehicle services.`,
    scope.workmanshipWarranty.trim()
      ? `Workmanship warranty offered by the provider business: ${scope.workmanshipWarranty}. That warranty is between me and the provider business — TUVELOZ does not offer, back, or administer it.`
      : "The provider business offers no workmanship warranty for this job. Offering one is each independent provider's own choice, not a Tuveloz requirement, and I acknowledged that when I selected this provider.",
    CUSTOMER_CHECKOUT_CANCELLATION_REFUND_SUMMARY,
    "I can save or download this exact acceptance record.",
  ].join(" ");
}

export function customerCheckoutAgreementEvidenceText(
  scope: CustomerCheckoutAcceptanceScope,
  language: CustomerPolicyLanguage,
) {
  return JSON.stringify({
    agreementKey: CUSTOMER_CHECKOUT_AGREEMENT_KEY,
    agreementVersion: customerCheckoutAgreementVersion(language),
    language,
    acceptanceControl: "affirmative-exact-checkout-authorization-checkbox",
    presentedText: customerCheckoutAcceptanceText(scope, language),
    policyRelease: customerPolicyPresentationEvidence("checkout", language),
    scopeSnapshot: JSON.parse(customerCheckoutScopeSnapshot(scope, language)) as unknown,
  });
}

export async function customerCheckoutAgreementHash(
  scope: CustomerCheckoutAcceptanceScope,
  language: CustomerPolicyLanguage,
) {
  return sha256Text(customerCheckoutAgreementEvidenceText(scope, language));
}
