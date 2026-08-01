import { PublicInfoPage } from "../components/public-info-page";

export default function HowItWorksPage() {
  return (
    <PublicInfoPage
      kicker="How it works"
      title="The planned marketplace flow."
      intro="Provider onboarding and evidence review are open. The customer experience below will remain unavailable until each service and every launch requirement receive written approval."
      sections={[
        {
          title: "1. Request an available service",
          text: "After launch, the customer will choose a service available in their location and describe the vehicle, preferred timing, and parts preference.",
        },
        {
          title: "2. Tuveloz checks eligibility",
          text: "Tuveloz will share a request only with providers whose service, assigned worker, evidence, agreements, work area, date, and any supervision requirements meet the applicable standards.",
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
          text: "The customer will choose a quote and accept the disclosed provider and assigned worker. Tuveloz will check eligibility again at each later job and payment stage.",
        },
      ]}
    />
  );
}
