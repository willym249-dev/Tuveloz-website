import { PublicInfoPage } from "../components/public-info-page";

export default function SafetyPage() {
  return (
    <PublicInfoPage
      kicker="Safety & trust"
      title="Exact checks before any future job begins."
      intro="Provider onboarding is open, but all real services and job stages are currently blocked. TUVELOZ is implementing exact-service evidence checks, limited information sharing, clear quotes, and role-specific access."
      sections={[
        {
          title: "Account review is not blanket job approval",
          text: "TUVELOZ reviews each exact service, performing person, location, date, evidence set, current agreement, and any supervision requirement. A label identifies the specific evidence checked; it is not a guarantee of safety, quality, or outcome.",
          points: ["Exact services only", "Person- and location-specific checks", "Expired evidence blocks dependent work"],
        },
        {
          title: "Customer privacy",
          text: "Providers receive only the information needed to decide whether to quote. Private contact and service-address details are limited to the selected provider.",
        },
        {
          title: "Transparent quotes",
          text: "After launch approval, customers must see the provider subtotal, parts and labor, any separate TUVELOZ fee, taxes or other charges, refund terms, and total before confirming.",
        },
        {
          title: "Independent choice",
          text: "Customers choose their provider. Providers choose their jobs, prices, schedule, tools, and methods, subject to applicable law and the agreed job scope. TUVELOZ does not employ, train, assign, or supervise providers or provider personnel.",
        },
      ]}
    />
  );
}
