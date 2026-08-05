import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Provider Agreement",
  description:
    "Plain-language terms for independent provider businesses working through the Tuveloz vehicle-service marketplace.",
};

export default function ProviderAgreementLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
