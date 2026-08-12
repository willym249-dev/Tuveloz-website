export const CUSTOMER_SERVICE_FEE_RATE_BPS = 500;
export const CUSTOMER_SERVICE_FEE_PERCENT = 5;

/**
 * One name for the fee, everywhere it is shown to anyone: "Customer Service Fee".
 *
 * The fee had five labels across the site, the agreements, and the Stripe line
 * item that lands on a customer's receipt — "customer service fee", "platform
 * fee", "marketplace service fee", "Tuveloz fee", and "Tuveloz service fee".
 * Nothing about the money differed, only the label, but a provider or a
 * regulator comparing two surfaces had no way to know that.
 *
 * Not to be confused with the provider membership fee (lib/founding-cohort.ts),
 * which does not exist yet and which founding providers are permanently exempt
 * from. That is a different fee and keeps its own name.
 */
export const CUSTOMER_SERVICE_FEE_NAME = "Customer Service Fee";

export const CUSTOMER_SERVICE_FEE_LABEL =
  `${CUSTOMER_SERVICE_FEE_NAME} (${CUSTOMER_SERVICE_FEE_PERCENT}%)`;

/**
 * The reviewed and locked fee model. Stated as numbers because a worked example
 * cannot be misread the way a sentence can, and because this is the exact case
 * tests/customer-fee-consistency.test.mjs enforces:
 *
 *   provider quote   $100.00   <- the provider sets this and receives all of it
 *   Customer Service Fee  $5.00   <- 5% calculated from the provider quote
 *   customer total   $105.00   <- what the customer pays
 *   provider payout  $100.00   <- unchanged by the fee
 *
 * The fee is calculated FROM the provider amount and charged ON TOP of it to
 * the customer. It is never deducted from the provider's payout. Do not restate
 * this model in prose anywhere else — import the disclosures below instead.
 */
export const CUSTOMER_FEE_WORKED_EXAMPLE =
  "On a $100 provider quote the Customer Service Fee is $5, the customer pays $105, and the provider receives the full $100.";

export const CUSTOMER_FEE_DISCLOSURE =
  `A ${CUSTOMER_SERVICE_FEE_PERCENT}% ${CUSTOMER_SERVICE_FEE_NAME} is calculated from the provider's price and added to your total. You see the provider's price, the fee, and the total before you accept anything.`;

export const PROVIDER_PAYOUT_DISCLOSURE =
  `You receive your full quoted price. The ${CUSTOMER_SERVICE_FEE_PERCENT}% ${CUSTOMER_SERVICE_FEE_NAME} is calculated from your price and charged to the customer on top of it — it is never deducted from your payout.`;

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
