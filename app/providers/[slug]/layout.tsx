import type { Metadata } from "next";

// The storefront page is a client component and cannot export metadata itself.
// This exists for one reason: /q/<slug> redirects here with ?source=qr attached
// for scan attribution, so the same storefront is reachable at two URLs. The
// canonical points both at the clean one.
export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> },
): Promise<Metadata> {
  const { slug } = await params;
  return {
    alternates: {
      canonical: `/providers/${encodeURIComponent(slug)}`,
    },
  };
}

export default function ProviderStorefrontLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
