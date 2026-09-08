import { requestPageMetadata } from "../../lib/request-page-metadata";
import type { Metadata } from "next";

const englishMetadata: Metadata = {
  title: "Terms of Use",
  description: "The Tuveloz Terms of Use for customers and providers.",
  alternates: {
    canonical: "/terms",
  },
};

export async function generateMetadata(): Promise<Metadata> {
  return requestPageMetadata(englishMetadata);
}

export default function TermsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
