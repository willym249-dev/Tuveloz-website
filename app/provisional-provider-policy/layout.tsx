import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Provisional Provider and Trainee Policy",
  description:
    "A deny-by-default draft covering independent startup owner-operators, sponsored trainee employees, and regular provider-business employees.",
  alternates: {
    canonical: "/provisional-provider-policy",
  },
};

/**
 * Metadata lives here rather than in page.tsx because that file is pinned to a
 * reviewed content hash in config/policy-releases.json — editing it, even to
 * add metadata, would invalidate the release. Same arrangement as
 * app/privacy and app/terms.
 */
export default function ProvisionalProviderPolicyLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
