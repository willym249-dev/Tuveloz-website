import { requestPageMetadata } from "../../lib/request-page-metadata";
import type { Metadata } from "next";
import { TuvelozPublic } from "../page";

const providerDescription =
  "Apply free to offer vehicle services in Montgomery County, MD. Set your prices and schedule, with no lead fees or exclusivity. Customer bookings are not open yet.";

const englishMetadata: Metadata = {
  title: "Join as a Provider — Free Signup",
  description: providerDescription,
  alternates: {
    canonical: "/join",
  },
  openGraph: {
    title: "Join as a Provider — Free Signup | Tuveloz",
    description: providerDescription,
    url: "https://tuveloz.com/join",
    type: "website",
    locale: "en_US",
    images: [{
      url: "/og-image.png?v=6",
      width: 1200,
      height: 630,
      alt: "Tuveloz — Vehicle Services. Customer Choice. Provider Freedom.",
    }],
  },
};

export async function generateMetadata(): Promise<Metadata> {
  return requestPageMetadata(englishMetadata);
}

export default function JoinPage() {
  return <TuvelozPublic view="provider" />;
}
