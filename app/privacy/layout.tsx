import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "What personal information Tuveloz collects, how it is used and shared, how long it is kept, and the privacy choices available to customers and provider applicants.",
  alternates: {
    canonical: "/privacy",
  },
};

/**
 * Metadata lives in this layout because privacy/page.tsx is pinned to a reviewed
 * content hash in config/policy-releases.json. Editing that file — even to add
 * metadata — would invalidate the release.
 */
export default function PrivacyLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
