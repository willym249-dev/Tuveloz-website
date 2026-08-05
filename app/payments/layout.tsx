import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Payment, Cancellation & Refund Policy",
  description:
    "How Tuveloz's proposed pricing, payments, provider transfers, cancellations, refunds, and customer protections are planned to work.",
};

export default function PaymentsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
