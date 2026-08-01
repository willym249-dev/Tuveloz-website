export const JOB_START_AUTHORIZATION_KEY = "job_start_authorization";
export const JOB_START_AUTHORIZATION_VERSION = "job-start-authorization-2026-08-01";

export const MARYLAND_CUSTOMER_RIGHTS = [
  "You may request a written estimate for repairs expected to cost more than $50.",
  "You may not be charged more than 10% above a written estimate without your consent.",
  "You are entitled to the return of replaced parts except when the parts must be returned to a manufacturer under a warranty agreement.",
  "Repairs not originally authorized by you may not be charged to you without your consent.",
] as const;

export const MARYLAND_SPECIAL_POLICY_NOTICE = [
  "Manufacturer Special Policy Adjustment Programs",
  "Federal law requires manufacturers to furnish the National Highway Traffic Safety Administration (N.H.T.S.A.) with bulletins describing defects in their vehicles. You may obtain copies of these bulletins from the manufacturer or N.H.T.S.A. Certain consumer publications or organizations may also publish this information for a fee or for free.",
].join("\n\n");

export type LaborOnlyPrice = {
  laborAmountCents: number;
  partsAmountCents: 0;
  taxAmountCents: 0;
  otherAmountCents: 0;
  totalAmountCents: number;
  customerFeeRateBps: number;
  customerFeeCents: number;
  customerTotalCents: number;
};

function wholeNumber(value: unknown) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : null;
}

export function parseLaborOnlyPrice(value: string): LaborOnlyPrice | null {
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    const laborAmountCents = wholeNumber(parsed.laborAmountCents);
    const partsAmountCents = wholeNumber(parsed.partsAmountCents);
    const taxAmountCents = wholeNumber(parsed.taxAmountCents);
    const otherAmountCents = wholeNumber(parsed.otherAmountCents);
    const totalAmountCents = wholeNumber(parsed.totalAmountCents);
    const customerFeeRateBps = wholeNumber(parsed.customerFeeRateBps);
    const customerFeeCents = wholeNumber(parsed.customerFeeCents);
    const customerTotalCents = wholeNumber(parsed.customerTotalCents);
    if (
      laborAmountCents === null
      || partsAmountCents !== 0
      || taxAmountCents !== 0
      || otherAmountCents !== 0
      || totalAmountCents !== laborAmountCents
      || customerFeeRateBps === null
      || customerFeeCents === null
      || customerTotalCents !== totalAmountCents + customerFeeCents
    ) return null;
    return {
      laborAmountCents,
      partsAmountCents: 0,
      taxAmountCents: 0,
      otherAmountCents: 0,
      totalAmountCents,
      customerFeeRateBps,
      customerFeeCents,
      customerTotalCents,
    };
  } catch {
    return null;
  }
}

export function customerStartAgreementText(input: {
  acceptedByName: string;
  requestId: string;
  quoteId: string;
  scopeVersion: number;
  providerName: string;
  service: string;
  vehicle: string;
  scheduledFor: string;
  laborAmountCents: number;
}) {
  const labor = (input.laborAmountCents / 100).toFixed(2);
  return [
    "CUSTOMER'S RIGHTS",
    ...MARYLAND_CUSTOMER_RIGHTS.map((right, index) => `${index + 1}. ${right}`),
    "",
    `I, ${input.acceptedByName}, authorize the selected independent provider, ${input.providerName}, to begin only the currently approved repair scope for Tuveloz job ${input.requestId}.`,
    `This authorization is limited to quote ${input.quoteId}, scope version ${input.scopeVersion}, service ${input.service}, vehicle ${input.vehicle}, scheduled for ${input.scheduledFor}, and provider labor of $${labor}.`,
    "No additional repair, service, labor amount, part, fee, tax, or other charge is authorized. Any change requires a separate written change order and my affirmative approval before the changed work begins.",
    "Parts are not sold through Tuveloz during this launch phase. I will purchase any needed parts independently. Tuveloz does not own, stock, purchase, select, mark up, ship, or warranty parts.",
    "The independent provider—not Tuveloz—performs the service and must provide a compliant itemized final invoice and any provider or manufacturer warranty terms.",
    "Tuveloz records this authorization as a marketplace communication and evidence record; Tuveloz is not the automotive repairer.",
    "",
    MARYLAND_SPECIAL_POLICY_NOTICE,
  ].join("\n");
}
