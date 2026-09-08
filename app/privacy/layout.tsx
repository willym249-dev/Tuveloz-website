import { requestPageMetadata } from "../../lib/request-page-metadata";
import type { Metadata } from "next";

const englishMetadata: Metadata = {
  title: "Privacy Policy",
  description: "How Tuveloz collects, uses, and protects personal information.",
  alternates: {
    canonical: "/privacy",
  },
};

export async function generateMetadata(): Promise<Metadata> {
  return requestPageMetadata(englishMetadata);
}

export default function PrivacyLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
