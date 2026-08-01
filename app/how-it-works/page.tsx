import { PublicInfoPage } from "../components/public-info-page";

export default function HowItWorksPage() {
  return (
    <PublicInfoPage
      kicker="How it works"
      title="The planned marketplace flow."
      intro="Provider onboarding and evidence review are open. The customer workflow below remains disabled until exact services and launch controls receive the required written approvals."
      sections={[
        {
          title: "1. Request an enabled exact service",
          text: "After launch, the customer will choose only an exact service code enabled for the location and describe the vehicle, timing, and parts preference.",
        },
        {
          title: "2. The server checks eligibility",
          text: "The system will share a request only with providers whose exact service, performing person, evidence, agreements, work area, date, and any supervision requirements pass.",
        },
        {
          title: "3. Providers remain separate businesses",
          text: "TUVELOZ does not employ, train, sponsor, assign, or supervise providers or provider personnel. Any employee or trainee works for a separate provider business that handles hiring, payroll, training, supervision, and job assignment.",
        },
        {
          title: "4. Compare quotes",
          text: "Eligible providers will choose whether to respond and set their own price. Customers will compare available quotes and precise evidence labels.",
        },
        {
          title: "5. Choose and track",
          text: "The customer will choose a quote and accept the disclosed provider and performing person. Every later job and payment stage must pass the server gate again.",
        },
      ]}
    />
  );
}
