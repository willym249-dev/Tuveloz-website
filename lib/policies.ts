export const TERMS_VERSION = "2026-08-07";
export const CUSTOMER_AGREEMENT_VERSION = "2026-08-07";
export const PROVIDER_AGREEMENT_VERSION = "2026-08-07";
export const PRIVACY_VERSION = "2026-07-28";
export const PAYMENT_POLICY_VERSION = "2026-08-01";
export const MARKETPLACE_CONDUCT_VERSION = "0.11";
export const PROVISIONAL_PROVIDER_POLICY_VERSION = "0.11";
export const VEHICLE_SERVICE_RISK_VERSION = "2026-08-07";
export const PROVIDER_SAFETY_POLICY_VERSION = "2026-08-07";

export const CUSTOMER_POLICY_BUNDLE_VERSION = [
  `terms:${TERMS_VERSION}`,
  `customer:${CUSTOMER_AGREEMENT_VERSION}`,
  `risk:${VEHICLE_SERVICE_RISK_VERSION}`,
  `privacy:${PRIVACY_VERSION}`,
].join("|");

export const PROVIDER_POLICY_BUNDLE_VERSION = [
  `terms:${TERMS_VERSION}`,
  `provider:${PROVIDER_AGREEMENT_VERSION}`,
  `payments:${PAYMENT_POLICY_VERSION}`,
  `conduct:${MARKETPLACE_CONDUCT_VERSION}`,
  `provisional:${PROVISIONAL_PROVIDER_POLICY_VERSION}`,
  `safety:${PROVIDER_SAFETY_POLICY_VERSION}`,
  `privacy:${PRIVACY_VERSION}`,
].join("|");

export const CHECKOUT_POLICY_BUNDLE_VERSION = [
  `terms:${TERMS_VERSION}`,
  `customer:${CUSTOMER_AGREEMENT_VERSION}`,
  `risk:${VEHICLE_SERVICE_RISK_VERSION}`,
  `payments:${PAYMENT_POLICY_VERSION}`,
].join("|");

export function policyAccepted(value: unknown) {
  return value === true || value === "yes" || value === "on";
}
