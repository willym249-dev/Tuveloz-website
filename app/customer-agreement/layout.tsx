import type { Metadata } from "next";
import { requestPageMetadata } from "../../lib/request-page-metadata";

const englishMetadata: Metadata = {
  title: "Customer Agreement",
  description:
    "Your choices as a Tuveloz customer and your direct agreement with the provider business you select. An operational review draft; customer requests are not yet open.",
  alternates: {
    canonical: "/customer-agreement",
  },
};

export async function generateMetadata(): Promise<Metadata> {
  return requestPageMetadata(englishMetadata);
}

/**
 * Metadata lives here rather than in page.tsx because that file is pinned to a
 * reviewed content hash in config/policy-releases.json — editing it, even to
 * add metadata, would invalidate the release. Same arrangement as
 * app/privacy and app/terms.
 */
export default function CustomerAgreementLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
