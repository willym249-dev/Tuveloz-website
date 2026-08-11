import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Use",
  description: "The Tuveloz Terms of Use for customers and providers.",
  alternates: {
    canonical: "/terms",
  },
};

export default function TermsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
