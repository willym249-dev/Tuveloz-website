import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Payment, Cancellation, and Refund Policy",
  description:
    "An operational review draft for proposed pricing, payments, transfers, cancellations, and customer protections. Live payments are not yet enabled.",
  alternates: {
    canonical: "/payments",
  },
};

/**
 * Metadata lives here rather than in page.tsx because that file is pinned to a
 * reviewed content hash in config/policy-releases.json — editing it, even to
 * add metadata, would invalidate the release. Same arrangement as
 * app/privacy and app/terms.
 */
export default function PaymentsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
