import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Marketplace Conduct Policy",
  description:
    "The conduct rules for customers and independent providers on Tuveloz, including prohibited behavior, off-platform solicitation, and how violations are handled.",
  alternates: {
    canonical: "/marketplace-conduct",
  },
};

/**
 * Metadata lives in this layout because marketplace-conduct/page.tsx is pinned to a reviewed
 * content hash in config/policy-releases.json. Editing that file — even to add
 * metadata — would invalidate the release.
 */
export default function MarketplaceConductLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
