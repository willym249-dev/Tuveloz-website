import { requestPageMetadata } from "../../lib/request-page-metadata";
import type { Metadata } from "next";

const englishMetadata: Metadata = {
  title: "Marketplace Conduct Policy",
  description:
    "Draft conduct rules for provider businesses, owner-operators, sponsored trainee employees, and regular provider-business employees on Tuveloz.",
  alternates: {
    canonical: "/marketplace-conduct",
  },
};

/**
 * Metadata lives here rather than in page.tsx because that file is pinned to a
 * reviewed content hash in config/policy-releases.json — editing it, even to
 * add metadata, would invalidate the release. Same arrangement as
 * app/privacy and app/terms.
 */
export async function generateMetadata(): Promise<Metadata> {
  return requestPageMetadata(englishMetadata);
}

export default function MarketplaceConductLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
