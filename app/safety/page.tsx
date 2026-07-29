import { PublicInfoPage } from "../components/public-info-page";

export default function SafetyPage() {
  return (
    <PublicInfoPage
      kicker="Safety & trust"
      title="Clear rules before a job begins."
      intro="Tuveloz uses approval checks, limited information sharing, clear quotes, and role-specific access to reduce confusion and protect both sides of the marketplace."
      sections={[
        {
          title: "Provider approval",
          text: "Provider access begins only after Tuveloz reviews the application. A license or registration is requested only when the selected service and location legally require it.",
          points: ["Approved services only", "Location-specific compliance", "Provider access can be removed"],
        },
        {
          title: "Customer privacy",
          text: "Providers receive only the information needed to decide whether to quote. Private contact and service-address details are limited to the selected provider.",
        },
        {
          title: "Transparent quotes",
          text: "Customers review the provider subtotal, any separate Tuveloz service fee, parts information, and the total before confirming.",
        },
        {
          title: "Independent choice",
          text: "Customers choose their provider. Providers choose their jobs, prices, schedule, tools, and methods, subject to applicable law and the agreed job scope.",
        },
      ]}
    />
  );
}
