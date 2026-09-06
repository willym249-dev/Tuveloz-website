import { CUSTOMER_FEE_DISCLOSURE } from "../../lib/customer-fee";
import { requestPageMetadata } from "../../lib/request-page-metadata";
import type { Metadata } from "next";
import { PublicInfoPage } from "../components/public-info-page";

const englishMetadata: Metadata = {
  title: "FAQ",
  description:
    "Answers about Tuveloz, fees, provider applications and the upcoming customer launch in Montgomery County, Maryland.",
  alternates: {
    canonical: "/faq",
  },
};

export async function generateMetadata(): Promise<Metadata> {
  return requestPageMetadata(englishMetadata);
}

export default function FaqPage() {
  return (
    <PublicInfoPage
      kicker="Frequently asked questions"
      title="Get to know Tuveloz."
      intro="Learn how joining works, who does the work and what to expect. Provider applications are open; customer bookings are not open yet."
      sections={[
        {
          title: "Who will work on my vehicle?",
          text: "Tuveloz is an online marketplace connecting customers with independent vehicle-service businesses. The provider you choose does the work. Tuveloz does not meet customers or repair vehicles. This does not change Tuveloz's own responsibilities under applicable law."
        },
        {
          title: "Do providers work for Tuveloz?",
          text: "Providers run their own businesses and are responsible for their employees, training, supervision, insurance and job assignments. Tuveloz does not employ, train, sponsor, assign or supervise providers or their staff. An applicant account does not include training or jobs."
        },
        {
          title: "What will it cost to use Tuveloz?",
          text: "Creating an account and applying as a provider are free. Customer requests and payments are not open yet. The planned booking fee is explained below; final launch pricing and tax treatment remain under review. You'll see every charge and the refund terms before paying.",
          points: [
            CUSTOMER_FEE_DISCLOSURE
          ]
        },
        {
          title: "Who sets the provider price?",
          text: "Each provider sets their own price and decides which requests to answer. You can compare the quotes you receive before choosing. Quotes will become available when customer bookings open."
        },
        {
          title: "What checks does a provider need?",
          text: "Requirements depend on the service and where the work happens. Insurance, registration, a license or other documents may be needed. Tuveloz checks what is required for the work a provider applies to offer. Approval for one service does not cover every service."
        },
        {
          title: "Where is Tuveloz launching?",
          text: "We're starting in Montgomery County, Maryland. Provider applications are open there; customer bookings and payments are not open yet. You can request another area on our About page."
        },
        {
          title: "How do I continue my application?",
          text: "Sign in with the email you used to apply and choose your provider account. Your checklist shows which documents to add and what still needs review. You'll be able to see the status of your application there."
        }
      ]}
    />
  );
}
