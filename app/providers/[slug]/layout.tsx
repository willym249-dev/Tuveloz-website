import type { Metadata } from "next";
import { MARKETPLACE_MODE } from "../../../lib/launch-status";

/**
 * Without this, a profile URL would inherit the directory's canonical from
 * app/providers/layout.tsx and every profile would declare itself a duplicate
 * of /providers.
 *
 * The noindex is a code-level read of MARKETPLACE_MODE only — no database call
 * on a metadata render. It errs closed: while the mode is anything other than
 * live, discovery is definitely shut and the page a crawler would receive is
 * the "not public yet" shell, so there is nothing worth indexing. When the mode
 * does go live the page becomes indexable, and the API remains the authority on
 * whether any individual profile is served at all.
 */
const DISCOVERY_DEFINITELY_CLOSED = String(MARKETPLACE_MODE) !== "live";

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> },
): Promise<Metadata> {
  const { slug } = await params;
  const canonical = `/providers/${encodeURIComponent(slug.trim().slice(0, 100))}`;

  return {
    alternates: { canonical },
    ...(DISCOVERY_DEFINITELY_CLOSED
      ? { robots: { index: false, follow: false } }
      : {}),
  };
}

export default function ProviderProfileLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
