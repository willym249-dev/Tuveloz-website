export const CUSTOMER_SERVICE_FEE_RATE_BPS = 1000;
export const CUSTOMER_SERVICE_FEE_PERCENT = 10;

export function customerPriceFor(
  providerQuoteCents: number,
  feeRateBps = CUSTOMER_SERVICE_FEE_RATE_BPS,
) {
  const safeQuoteCents = Number.isFinite(providerQuoteCents)
    ? Math.max(0, Math.round(providerQuoteCents))
    : 0;
  const safeRateBps = Number.isFinite(feeRateBps)
    ? Math.max(0, Math.round(feeRateBps))
    : CUSTOMER_SERVICE_FEE_RATE_BPS;
  const customerFeeCents = Math.round((safeQuoteCents * safeRateBps) / 10_000);

  return {
    providerQuoteCents: safeQuoteCents,
    customerFeeRateBps: safeRateBps,
    customerFeeCents,
    customerTotalCents: safeQuoteCents + customerFeeCents,
  };
}
