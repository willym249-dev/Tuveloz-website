import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Marketplace Conduct Policy",
  description:
    "Conduct rules for provider businesses, owner-operators, sponsored trainees, and employees using the Tuveloz marketplace.",
};

export default function MarketplaceConductLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
