import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Provider Agreement",
  description:
    "The agreement for independent provider businesses on Tuveloz, covering independent-contractor status, quoting, insurance and registration, and payout terms.",
  alternates: {
    canonical: "/provider-agreement",
  },
};

/**
 * Metadata lives in this layout because provider-agreement/page.tsx is pinned to a reviewed
 * content hash in config/policy-releases.json. Editing that file — even to add
 * metadata — would invalidate the release.
 */
export default function ProviderAgreementLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
