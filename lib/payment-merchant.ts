export type PaymentLanguage = "en" | "es";

// Payment identity only. This does not replace the released customer policies
// or change who performs the vehicle service.
export const PAYMENT_MERCHANT_DISCLOSURE = {
  en: "Your payment is to TUVELOZ LLC. Your selected independent provider performs the vehicle service.",
  es: "El pago se realiza a TUVELOZ LLC. El proveedor independiente que usted elija realiza el servicio de su vehículo.",
} as const;

// A record can be pending, refunded or disputed; do not claim it was paid.
export const PAYMENT_MERCHANT_RECORD_LABEL = {
  en: "Payment merchant: TUVELOZ LLC. Vehicle services are performed by the independent provider.",
  es: "Comercio responsable del pago: TUVELOZ LLC. El proveedor independiente realiza los servicios del vehículo.",
} as const;

export function paymentRecordStatusLabel(status: string, language: PaymentLanguage) {
  const labels: Record<string, readonly [string, string]> = {
    paid_pending_completion: ["Paid; service completion pending", "Pagado; servicio pendiente de completar"],
    ready_for_release: ["Paid; provider payment under review", "Pagado; pago al proveedor en revisión"],
    released: ["Paid; provider payment released", "Pagado; pago al proveedor enviado"],
    paid_and_transferred: ["Paid; provider payment transferred", "Pagado; pago al proveedor transferido"],
    checkout_open: ["Checkout open; payment not confirmed", "Pago abierto; aún no confirmado"],
    payment_failed: ["Payment failed", "El pago falló"],
    checkout_expired: ["Checkout expired", "La sesión de pago venció"],
    refunded: ["Refunded", "Reembolsado"],
    partially_refunded: ["Partially refunded", "Reembolsado parcialmente"],
    refund_pending: ["Refund pending", "Reembolso pendiente"],
    disputed: ["Payment disputed", "Pago en disputa"],
  };
  const label = Object.prototype.hasOwnProperty.call(labels, status)
    ? labels[status]
    : ["Payment status under review", "Estado del pago en revisión"];
  return label[language === "es" ? 1 : 0];
}

export function hostedPaymentDisclosure(language: unknown) {
  const locale: PaymentLanguage = language === "es" ? "es" : "en";
  return {
    locale,
    custom_text: { submit: { message: PAYMENT_MERCHANT_DISCLOSURE[locale] } },
  };
}
