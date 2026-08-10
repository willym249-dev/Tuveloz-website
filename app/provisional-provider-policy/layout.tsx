import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Provisional Provider and Trainee Policy",
  description:
    "How Tuveloz treats provisional providers and trainees, including what evidence is required before a provider business may list a service.",
  alternates: {
    canonical: "/provisional-provider-policy",
  },
};

/**
 * Metadata lives in this layout because provisional-provider-policy/page.tsx is pinned to a reviewed
 * content hash in config/policy-releases.json. Editing that file — even to add
 * metadata — would invalidate the release.
 */
export default function ProvisionalProviderPolicyLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
