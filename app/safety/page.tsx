import type { Metadata } from "next";
import { PublicInfoPage } from "../components/public-info-page";

export const metadata: Metadata = {
  title: "Safety & Trust",
  description:
    "How Tuveloz verifies providers: law-based checks, service-specific evidence review, limited information sharing, and clear quotes.",
};

export default function SafetyPage() {
  return (
    <PublicInfoPage
      kicker="Safety & trust"
      title="Service-specific checks before any future job begins."
      intro="Provider onboarding is open, but customer service requests and jobs are not yet available. Tuveloz is implementing service-specific evidence checks, limited information sharing, clear quotes, and role-specific access."
      sections={[
        {
          title: "Every job requires its own checks",
          text: "Tuveloz reviews the requested service, assigned worker, location, date, evidence, current agreements, and any supervision requirement. Each label identifies the evidence checked; it does not guarantee safety, quality, or results.",
          points: ["Service-specific review", "Person- and location-specific checks", "Expired evidence prevents job access"],
        },
        {
          title: "Customer privacy",
          text: "Providers receive only the information needed to decide whether to quote. Private contact and service-address details are limited to the selected provider.",
        },
        {
          title: "Transparent quotes",
          text: "After launch approval, customers must see the provider subtotal, parts and labor, any separate Customer Service Fee, taxes or other charges, refund terms, and total before confirming.",
        },
        {
          title: "Independent choice",
          text: "Customers choose their provider. Providers choose their jobs, prices, schedule, tools, and methods, subject to applicable law and the agreed job scope. TUVELOZ does not employ, train, assign, or supervise providers or provider personnel.",
        },
      ]}
    />
  );
}
