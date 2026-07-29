export const TERMS_VERSION = "2026-07-28";
export const CUSTOMER_AGREEMENT_VERSION = "2026-07-28";
export const PROVIDER_AGREEMENT_VERSION = "2026-07-28";
export const PRIVACY_VERSION = "2026-07-28";
export const PAYMENT_POLICY_VERSION = "2026-07-28";

export const CUSTOMER_POLICY_BUNDLE_VERSION = [
  `terms:${TERMS_VERSION}`,
  `customer:${CUSTOMER_AGREEMENT_VERSION}`,
  `privacy:${PRIVACY_VERSION}`,
].join("|");

export const PROVIDER_POLICY_BUNDLE_VERSION = [
  `terms:${TERMS_VERSION}`,
  `provider:${PROVIDER_AGREEMENT_VERSION}`,
  `privacy:${PRIVACY_VERSION}`,
].join("|");

export const CHECKOUT_POLICY_BUNDLE_VERSION = [
  `terms:${TERMS_VERSION}`,
  `customer:${CUSTOMER_AGREEMENT_VERSION}`,
  `payments:${PAYMENT_POLICY_VERSION}`,
].join("|");

export function policyAccepted(value: unknown) {
  return value === true || value === "yes" || value === "on";
}
