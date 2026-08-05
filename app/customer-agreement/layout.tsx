import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Customer Agreement",
  description:
    "Your choices as a Tuveloz customer and the direct agreement you form with the independent provider business you select.",
};

export default function CustomerAgreementLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
