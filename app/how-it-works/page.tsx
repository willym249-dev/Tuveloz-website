import { requestPageMetadata } from "../../lib/request-page-metadata";
import type { Metadata } from "next";
import { PublicInfoPage } from "../components/public-info-page";

const englishMetadata: Metadata = {
  title: "How It Works",
  description:
    "See how Tuveloz will connect you with local providers, help you compare quotes and let you choose. Customer bookings are not open yet.",
  alternates: {
    canonical: "/how-it-works",
  },
};

export async function generateMetadata(): Promise<Metadata> {
  return requestPageMetadata(englishMetadata);
}

export default function HowItWorksPage() {
  return (
    <PublicInfoPage
      kicker="How it works"
      title="Find help for your car, one step at a time."
      intro="Provider applications are open in Montgomery County. Customer requests, quotes and payments are not open yet. Here's how booking will work when we launch."
      sections={[
        {
          title: "1. Tell us what you need",
          text: "Describe your vehicle, what you've noticed and when you'd like help. Choose where the work could happen and how you'll get any needed parts. You don't need to diagnose the problem yourself."
        },
        {
          title: "2. Hear from local providers",
          text: "Your request goes to providers who cover your area and are approved for that service. Each business decides whether to send a quote and sets its own price. Your private contact details stay with the provider you select."
        },
        {
          title: "3. Compare and choose",
          text: "Review the work, price and timing in each quote. Ask questions before deciding. You can turn down every quote at no cost. Checks and documents help you make a choice; they do not guarantee safety, quality or results."
        },
        {
          title: "4. Agree on the work and appointment",
          text: "Before accepting, you'll see the business and person doing the work, all charges and the refund terms. Confirm the appointment with your provider. Any extra work needs your approval, and the provider must remain cleared through payment."
        },
        {
          title: "Who does the work?",
          text: "Your selected provider business performs the service. Tuveloz connects you online; it does not meet customers or work on vehicles. Tuveloz does not employ, train, sponsor, assign or supervise providers or their staff. Each provider business handles its own hiring, payroll, training and supervision."
        }
      ]}
    />
  );
}
