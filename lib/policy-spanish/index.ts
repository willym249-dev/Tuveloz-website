import terms from "./terms";
import provider from "./provider-agreement";
import payments from "./payments";
import conduct from "./marketplace-conduct";
import privacy from "./privacy";
import provisional from "./provisional-provider-policy";

export const spanishPolicies = {
  terms, provider_agreement: provider, payment_policy: payments,
  marketplace_conduct: conduct, privacy, provisional_provider_policy: provisional,
};

const keysByTitle: Record<string, keyof typeof spanishPolicies> = {
  "Terms of Use": "terms",
  "Provider Agreement": "provider_agreement",
  "Payment, Cancellation, and Refund Policy": "payment_policy",
  "Marketplace Conduct Policy": "marketplace_conduct",
  "Privacy Policy": "privacy",
  "Provisional Provider and Trainee Policy": "provisional_provider_policy",
};

export function spanishPolicyForTitle(title: string) {
  const key = keysByTitle[title];
  return key ? spanishPolicies[key] : undefined;
}
