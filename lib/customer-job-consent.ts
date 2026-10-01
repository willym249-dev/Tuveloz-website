import {
  CUSTOMER_REQUEST_AGREEMENT_KEY,
  CUSTOMER_REQUEST_PRIVACY_AGREEMENT_KEY,
  customerRequestAgreementEvidenceText,
  customerRequestPrivacyAgreementEvidenceText,
  customerProviderSelectionAgreementEvidenceText,
  type CustomerQuoteSelectionScope,
} from "./customer-job-scope";
import {
  customerPolicyPresentationEvidence,
  type CustomerPolicyLanguage,
} from "./customer-policy-acceptance";
import { sha256Text } from "./provider-policy-acceptance";

// Keep the legacy helpers unchanged: historical English records must never be
// relabeled as a new language or regenerated with different acceptance text.
const REQUEST_TEXT_ES = "Tengo al menos 18 años y autorización para solicitar servicio para este vehículo y en este lugar. Acepto los Términos de uso y el Acuerdo del cliente enlazados. Certifico que son correctos la operación exacta, las operaciones excluidas, la dirección, la autorización para usar la propiedad, el estado del vehículo, su capacidad para circular, el estado del sistema de alto voltaje y las confirmaciones de seguridad indicados arriba. Entiendo que todas las cotizaciones y los pagos de Tuveloz cubren solo mano de obra; las preferencias de piezas originales o de otras marcas sirven para comunicar qué piezas compraré por separado, y no se pueden incluir piezas suministradas por el proveedor, reembolsos de piezas ni cargos por piezas. Esta aceptación autoriza a TUVELOZ a guardar y enviar únicamente el alcance exacto de esta solicitud; no autoriza una reparación, un pago, trabajo adicional, una pieza sustituta, un aumento de precio ni la selección de un proveedor. TUVELOZ opera el mercado y no realiza el servicio del vehículo.";
const PRIVACY_TEXT_ES = "Por separado, reconozco que revisé la Política de privacidad y entiendo cómo TUVELOZ maneja los datos del cliente, el vehículo y la ubicación, así como la solicitud, las fotos, las comunicaciones y los registros de servicio enviados para esta solicitud.";

export type CustomerConsentPresentation = {
  language: CustomerPolicyLanguage;
  agreementKey: string;
  agreementVersion: string;
  agreementHash: string;
  agreementText: string;
  presentedText: string;
  documents: ReturnType<typeof customerPolicyPresentationEvidence>["documents"];
};

export function customerRequestConsentEvidence(
  language: CustomerPolicyLanguage,
  scopeSnapshot = "",
  privacy = false,
) {
  const legacy = JSON.parse(privacy
    ? customerRequestPrivacyAgreementEvidenceText(scopeSnapshot)
    : customerRequestAgreementEvidenceText(scopeSnapshot));
  return JSON.stringify({
    ...legacy,
    agreementVersion: `${legacy.agreementVersion.replace(
      privacy ? "request-privacy:2" : "request-scope:3",
      privacy ? "request-privacy:3" : "request-scope:4",
    )}|lang:${language}`,
    language,
    presentedText: language === "es"
      ? privacy ? PRIVACY_TEXT_ES : REQUEST_TEXT_ES
      : legacy.presentedText,
    policyRelease: customerPolicyPresentationEvidence("request_scope", language),
  });
}

function selectionTextEs(scope: CustomerQuoteSelectionScope) {
  const { quote, request } = scope;
  const credentials = quote.confirmedCredentialLabels.length
    ? `Este proveedor tiene confirmados los siguientes requisitos para este servicio: ${quote.confirmedCredentialLabels.join(", ")}.`
    : "Esta cotización no muestra ninguna licencia, registro ni seguro confirmado.";
  const experience = quote.yearsExperience
    ? `El proveedor declara tener ${quote.yearsExperience} de experiencia. Este dato lo proporciona el proveedor y no es un requisito legal.`
    : "El proveedor no ha indicado sus años de experiencia; este dato no es un requisito legal.";
  const warranty = quote.workmanshipWarranty.trim()
    ? `Este negocio proveedor ofrece una garantía escrita de mano de obra para este trabajo: ${quote.workmanshipWarranty.trim()}. Esa garantía es un compromiso del negocio proveedor conmigo; TUVELOZ no la ofrece, respalda ni administra.`
    : "Este negocio proveedor no ofrece una garantía de mano de obra para este trabajo. Ofrecerla es decisión de cada proveedor independiente y no es un requisito de Tuveloz. Reconozco y acepto contratar a este proveedor sin esa garantía.";
  return [
    `Selecciono a ${quote.providerName} y a la persona indicada para realizar el trabajo (${quote.performingPersonDisplay}) únicamente para el código de servicio ${quote.serviceCodes.join(", ")} y la operación ${request.jobFacts.requestedOperations.map(operation => operation.operationCode).join(", ")}.`,
    `El lugar autorizado es ${request.jobFacts.location.address} (${request.jobFacts.location.type}). No cambian las confirmaciones guardadas sobre la propiedad, el estado del vehículo, las operaciones excluidas y la seguridad.`,
    credentials, experience,
    "Compare el precio, las reseñas y los trabajos completados para decidir si el proveedor es adecuado para usted.",
    warranty,
    `Acepto la cotización ${quote.quoteId}, con un total mostrado de $${(Number(quote.customerTotalCents) / 100).toFixed(2)}, programada para ${quote.scheduledFor}.`,
    "Confirmo que el importe aceptado del proveedor cubre solo mano de obra. Cualquier preferencia de piezas originales o de otras marcas se refiere a una pieza que compraré por separado; no se incluyen piezas suministradas por el proveedor, reembolsos, impuestos ni otros cargos por piezas.",
    "Acepto los Términos de uso, el Acuerdo del cliente y la Política de pagos, cancelaciones y reembolsos enlazados.",
    "Al aceptar esta cotización, celebro un acuerdo de servicio directamente con el negocio proveedor seleccionado. TUVELOZ opera el mercado y no realiza el servicio del vehículo.",
    "Esta aceptación no autoriza trabajo adicional, una pieza sustituta, un aumento de precio, otra persona para realizar el trabajo ni un cambio de horario. Cada cambio sustancial requiere una nueva aprobación registrada.",
  ].join(" ");
}

export function customerSelectionConsentEvidence(
  scope: CustomerQuoteSelectionScope,
  language: CustomerPolicyLanguage,
) {
  const legacy = JSON.parse(customerProviderSelectionAgreementEvidenceText(scope));
  return JSON.stringify({
    ...legacy,
    agreementVersion: `${legacy.agreementVersion.replace("provider-quote-selection:4", "provider-quote-selection:5")}|lang:${language}`,
    language,
    presentedText: language === "es" ? selectionTextEs(scope) : legacy.presentedText.replace(
      "No license, registration, or insurance is legally required for this provider's selected service, so nothing is confirmed here.",
      "No confirmed license, registration, or insurance is shown in this quote.",
    ),
    policyRelease: customerPolicyPresentationEvidence("provider_selection", language),
  });
}

export async function customerConsentPresentation(agreementText: string): Promise<CustomerConsentPresentation> {
  const evidence = JSON.parse(agreementText);
  return {
    language: evidence.language,
    agreementKey: evidence.agreementKey,
    agreementVersion: evidence.agreementVersion,
    agreementHash: await sha256Text(agreementText),
    agreementText,
    presentedText: evidence.presentedText,
    documents: evidence.policyRelease.documents,
  };
}

export async function customerRequestConsentPresentation(language: CustomerPolicyLanguage, scopeSnapshot = "") {
  const [request, privacy] = await Promise.all([
    customerConsentPresentation(customerRequestConsentEvidence(language, scopeSnapshot)),
    customerConsentPresentation(customerRequestConsentEvidence(language, scopeSnapshot, true)),
  ]);
  return { request, privacy };
}

export type CustomerRequestConsent = Awaited<ReturnType<typeof customerRequestConsentPresentation>>;

type AcceptedRecord = {
  agreementKey: string; agreementVersion: string; agreementText: string;
  agreementHash: string; scopeSnapshot: string; customerEmail: string;
  acceptedAt: string;
};

/** Verify a matching pair; never mix languages, scopes, or customer identities. */
export async function acceptedCustomerRequestConsent(
  records: readonly AcceptedRecord[], scopeSnapshot: string, customerEmail = "",
) {
  for (const record of records) {
    if (record.agreementKey !== CUSTOMER_REQUEST_AGREEMENT_KEY || !record.acceptedAt
      || record.scopeSnapshot !== scopeSnapshot
      || (customerEmail && record.customerEmail !== customerEmail)) continue;
    try {
      const evidence = JSON.parse(record.agreementText);
      const language = evidence.language;
      const legacy = language === undefined;
      if (!legacy && language !== "en" && language !== "es") continue;
      const requestText = legacy ? customerRequestAgreementEvidenceText(scopeSnapshot)
        : customerRequestConsentEvidence(language, scopeSnapshot);
      const privacyText = legacy ? customerRequestPrivacyAgreementEvidenceText(scopeSnapshot)
        : customerRequestConsentEvidence(language, scopeSnapshot, true);
      if (record.agreementVersion !== JSON.parse(requestText).agreementVersion
        || record.agreementText !== requestText
        || record.agreementHash !== await sha256Text(requestText)) continue;
      const privacyHash = await sha256Text(privacyText);
      if (records.some(value => value.agreementKey === CUSTOMER_REQUEST_PRIVACY_AGREEMENT_KEY
        && value.customerEmail === record.customerEmail && Boolean(value.acceptedAt)
        && value.scopeSnapshot === scopeSnapshot
        && value.agreementVersion === JSON.parse(privacyText).agreementVersion
        && value.agreementText === privacyText && value.agreementHash === privacyHash)) return true;
    } catch { /* Corrupt, stale, or unreleased evidence cannot authorize a job. */ }
  }
  return false;
}
