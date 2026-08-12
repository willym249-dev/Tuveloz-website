import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Provider Directory",
  description:
    "Independent vehicle-service provider businesses on Tuveloz in Montgomery County, MD. Listings open when the marketplace does; provider applications are open now.",
  alternates: {
    canonical: "/providers",
  },
};

/**
 * Metadata lives here because page.tsx is a client component and cannot export
 * it. This layout covers the directory page only — app/providers/[slug] has
 * its own layout, so a profile URL keeps its own canonical rather than
 * inheriting the directory's.
 */
export default function ProvidersDirectoryLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
