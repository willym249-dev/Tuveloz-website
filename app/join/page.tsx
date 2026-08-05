import type { Metadata } from "next";
import { ProviderLanding } from "./provider-landing";

export const metadata: Metadata = {
  title: "Join as a Vehicle-Service Provider in Montgomery County, MD",
  description:
    "Get local vehicle-service opportunities. Join Tuveloz free, keep 100% of your quoted price, no exclusivity. Apply in about 5 minutes.",
  alternates: { canonical: "/join" },
  openGraph: {
    title: "Join Tuveloz as a vehicle-service provider",
    description:
      "Free to join, keep 100% of your quoted price, no exclusivity. Now onboarding independent providers in Montgomery County, MD.",
    url: "https://tuveloz.com/join",
    type: "website",
  },
};

export default function JoinPage() {
  return <ProviderLanding />;
}
