import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Provider Agreement",
  description:
    "Plain-language terms for provider businesses working through Tuveloz, covering independent-contractor status, quoting, required coverage, and payouts.",
  alternates: {
    canonical: "/provider-agreement",
  },
};

/**
 * Metadata lives here rather than in page.tsx because that file is pinned to a
 * reviewed content hash in config/policy-releases.json — editing it, even to
 * add metadata, would invalidate the release. Same arrangement as
 * app/privacy and app/terms.
 */
export default function ProviderAgreementLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
