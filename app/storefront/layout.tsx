import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Storefront",
  description:
    "The Tuveloz platform storefront and connected-provider offerings. Customer payments are not open yet — checkout activates after launch review.",
};

export default function StorefrontLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
