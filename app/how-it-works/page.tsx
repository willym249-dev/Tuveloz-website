import { PublicInfoPage } from "../components/public-info-page";

export default function HowItWorksPage() {
  return (
    <PublicInfoPage
      kicker="How it works"
      title="One request. Clear choices."
      intro="Tuveloz gives customers a simple way to request vehicle service and gives independent providers the freedom to respond only when the work fits."
      sections={[
        {
          title: "1. Post the job",
          text: "The customer describes the vehicle, service needed, location, timing, and parts preference.",
        },
        {
          title: "2. Eligible providers review it",
          text: "Tuveloz shares approved requests only with providers whose verified services, work area, and meeting options match.",
        },
        {
          title: "3. Compare quotes",
          text: "Providers choose whether to respond and set their own price. Customers compare available quotes and provider information.",
        },
        {
          title: "4. Choose and track",
          text: "The customer decides whether to accept a quote. The selected provider and customer can then follow the job status in their separate workspaces.",
        },
      ]}
    />
  );
}
