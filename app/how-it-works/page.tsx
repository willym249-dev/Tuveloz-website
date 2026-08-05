import type { Metadata } from "next";
import { PublicInfoPage } from "../components/public-info-page";

export const metadata: Metadata = {
  title: "How It Works",
  description:
    "How the Tuveloz marketplace will work: request a service, compare quotes from local independent providers, and choose what works for you.",
  alternates: { canonical: "/how-it-works" },
};

export default function HowItWorksPage() {
  return (
    <PublicInfoPage
      kicker="How it works"
      title="The planned marketplace flow."
      intro="Provider onboarding and evidence review are open. The customer experience below will remain unavailable until each service and every launch requirement receive written approval."
      sections={[
        {
          title: "1. After launch: request an available service",
          text: "After launch, the customer will choose a service available in their location and describe the vehicle, preferred timing, and parts preference.",
        },
        {
          title: "2. Tuveloz checks eligibility",
          text: "Tuveloz intends to share a request only with providers whose service, assigned worker, evidence, agreements, work area, date, and any supervision requirements meet the applicable standards. Meeting these standards does not guarantee safety, quality, or results.",
        },
        {
          title: "3. Providers remain separate businesses",
          text: "TUVELOZ does not employ, train, sponsor, assign, or supervise providers or provider personnel. Any employee or trainee works for a separate provider business that handles hiring, payroll, training, supervision, and job assignment.",
        },
        {
          title: "4. After launch: compare quotes",
          text: "Eligible providers will choose whether to respond and set their own price. Customers will compare available quotes and precise evidence labels.",
        },
        {
          title: "5. After launch: choose and track",
          text: "After launch, the customer will choose a quote and accept the disclosed provider and assigned worker. Tuveloz will check eligibility again at each later job and payment stage.",
        },
      ]}
    />
  );
}
