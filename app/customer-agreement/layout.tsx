import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Customer Agreement",
  description:
    "The agreement between Tuveloz and customers covering requests, quotes, provider selection, payment terms, and the limits of what a marketplace can guarantee.",
  alternates: {
    canonical: "/customer-agreement",
  },
};

/**
 * Metadata lives in this layout because customer-agreement/page.tsx is pinned to a reviewed
 * content hash in config/policy-releases.json. Editing that file — even to add
 * metadata — would invalidate the release.
 */
export default function CustomerAgreementLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
