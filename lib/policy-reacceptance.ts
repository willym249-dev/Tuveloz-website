import {
  CUSTOMER_POLICY_BUNDLE_VERSION,
  PROVIDER_POLICY_BUNDLE_VERSION,
} from "./policies.ts";

export type ReacceptanceRole = "customer" | "provider";

// Shown next to the checkbox and stored verbatim with each re-acceptance row,
// so the record proves exactly what the person agreed to.
export const POLICY_REACCEPTANCE_TEXT =
  "I have reviewed and agree to the updated Terms of Use and the other "
  + "linked policies that apply to my account.";

const DOCUMENT_DETAILS: Record<string, { title: string; href: string }> = {
  terms: { title: "Terms of Use", href: "/terms" },
  customer: { title: "Customer Agreement", href: "/customer-agreement" },
  provider: { title: "Provider Agreement", href: "/provider-agreement" },
  payments: {
    title: "Payment, Cancellation, and Refund Policy",
    href: "/payments",
  },
  conduct: { title: "Marketplace Conduct Policy", href: "/marketplace-conduct" },
  provisional: {
    title: "Provisional Provider and Trainee Policy",
    href: "/provisional-provider-policy",
  },
  privacy: { title: "Privacy Policy", href: "/privacy" },
};

export function policyBundleForRole(role: ReacceptanceRole) {
  return role === "provider"
    ? PROVIDER_POLICY_BUNDLE_VERSION
    : CUSTOMER_POLICY_BUNDLE_VERSION;
}

function bundleTokens(bundle: string) {
  return bundle.split("|").map((token) => token.trim()).filter(Boolean);
}

/**
 * A document requirement is satisfied only when some recorded acceptance
 * contains the exact `key:version` token from the current bundle. Comparing
 * tokens instead of whole bundle strings lets an acceptance recorded for one
 * role (or an older mixed record) still count for the documents it covered.
 */
export function policyAcceptanceIsCurrent(
  acceptedBundles: readonly string[],
  role: ReacceptanceRole,
) {
  const accepted = new Set(acceptedBundles.flatMap(bundleTokens));
  return bundleTokens(policyBundleForRole(role))
    .every((token) => accepted.has(token));
}

export function outstandingPolicyDocuments(
  acceptedBundles: readonly string[],
  role: ReacceptanceRole,
) {
  const accepted = new Set(acceptedBundles.flatMap(bundleTokens));
  return bundleTokens(policyBundleForRole(role))
    .filter((token) => !accepted.has(token))
    .map((token) => {
      const [key = "", version = ""] = token.split(":", 2);
      const details = DOCUMENT_DETAILS[key] ?? { title: key, href: "/terms" };
      return { key, version, ...details };
    });
}

export type PolicyAcceptanceStatus = {
  current: boolean;
  requiredVersion: string;
  documents: ReturnType<typeof outstandingPolicyDocuments>;
};

export function policyAcceptanceStatus(
  acceptedBundles: readonly string[],
  role: ReacceptanceRole,
): PolicyAcceptanceStatus {
  return {
    current: policyAcceptanceIsCurrent(acceptedBundles, role),
    requiredVersion: policyBundleForRole(role),
    documents: outstandingPolicyDocuments(acceptedBundles, role),
  };
}
