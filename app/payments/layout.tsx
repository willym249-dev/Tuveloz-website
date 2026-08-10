import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Payment, Cancellation, and Refund Policy",
  description:
    "How Tuveloz plans to handle payment, cancellation, and refunds, including the 5% customer service fee added to the provider's quoted subtotal. Live payments are not yet enabled.",
  alternates: {
    canonical: "/payments",
  },
};

/**
 * Metadata lives in this layout because payments/page.tsx is pinned to a reviewed
 * content hash in config/policy-releases.json. Editing that file — even to add
 * metadata — would invalidate the release.
 */
export default function PaymentsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
