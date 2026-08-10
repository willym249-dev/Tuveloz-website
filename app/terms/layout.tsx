import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Use",
  description:
    "The terms that govern use of Tuveloz, the vehicle-service marketplace for Montgomery County, Maryland, while the platform remains in provider-onboarding mode.",
  alternates: {
    canonical: "/terms",
  },
};

/**
 * Metadata lives in this layout because terms/page.tsx is pinned to a reviewed
 * content hash in config/policy-releases.json. Editing that file — even to add
 * metadata — would invalidate the release.
 */
export default function TermsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
