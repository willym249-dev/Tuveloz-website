// Accounting rehearsal only: these values never authorize or execute a refund.
export type TestRefundPrice = {
  providerAmountCents: number;
  customerFeeCents: number;
  customerTotalCents: number;
  customerFeeRateBps: number;
  scopeVersion: number;
  quoteId: string;
};

export function testRefundCents(value: unknown) {
  if ((typeof value !== "number" && typeof value !== "string")
    || String(value).trim() === "") return null;
  const amount = Number(value);
  return Number.isSafeInteger(amount) && amount >= 0 ? amount : null;
}

export function testRefundAllocation(
  price: TestRefundPrice,
  amountCents: number,
  selectedFeeCents: unknown,
) {
  if (!Number.isSafeInteger(amountCents) || amountCents < 0
    || amountCents > price.customerTotalCents) return null;
  const hasSelection = selectedFeeCents !== undefined && selectedFeeCents !== null && selectedFeeCents !== "";
  // A full customer refund includes the entire saved Customer Service Fee.
  // A partial allocation must be an explicit owner decision, not a new rule.
  const automaticFee = amountCents === price.customerTotalCents
    ? price.customerFeeCents : amountCents === 0 ? 0 : null;
  const feeCents = hasSelection ? testRefundCents(selectedFeeCents) : automaticFee;
  if (feeCents === null || !Number.isSafeInteger(feeCents)
    || feeCents < 0 || feeCents > price.customerFeeCents || feeCents > amountCents
    || (automaticFee !== null && feeCents !== automaticFee)
    || amountCents - feeCents > price.providerAmountCents) return null;
  return {
    customerRefundCents: amountCents,
    providerRefundCents: amountCents - feeCents,
    customerFeeRefundCents: feeCents,
    platformImpactCents: -feeCents,
  };
}
