import { PublicInfoPage } from "../components/public-info-page";

export default function FaqPage() {
  return (
    <PublicInfoPage
      kicker="Frequently asked questions"
      title="The important answers, without the clutter."
      intro="These are the basics customers and provider applicants should understand while TUVELOZ remains in provider-onboarding mode."
      sections={[
        {
          title: "Is Tuveloz the vehicle-service provider?",
          text: "TUVELOZ is designed as a marketplace. The selected provider business—not TUVELOZ—will offer and perform the vehicle service. This description does not waive any responsibility TUVELOZ has under applicable law.",
        },
        {
          title: "Does TUVELOZ employ or train providers?",
          text: "No. TUVELOZ does not employ, train, sponsor, assign, or supervise providers, mechanics, trainees, or provider-business employees. A separate provider business must handle its own hiring, payroll, training, supervision, insurance, and job assignment. Applicant-only accounts receive no training or jobs.",
        },
        {
          title: "Will submitting a request cost money?",
          text: "Customer service requests and payments are not yet available. Before launch, Tuveloz must approve the final fee and tax treatment and show every charge and refund term before payment.",
        },
        {
          title: "Who sets the provider price?",
          text: "In the planned workflow, each provider business sets or approves its quote and chooses whether to pursue a request. Real quoting is currently disabled.",
        },
        {
          title: "Are all providers licensed?",
          text: "Do not assume an umbrella license or 'fully verified' status. TUVELOZ will show the exact evidence checked for a specific service, person, location, and date. Insurance, registration, competency, supervision, or other evidence may apply even where there is no universal mechanic license.",
        },
        {
          title: "Where is Tuveloz launching?",
          text: "Provider onboarding is focused on Montgomery County, Maryland. Customer service requests and payments are not yet available in any area. Customers and providers can request future launch areas on the About page.",
        },
        {
          title: "How do I access my tools?",
          text: "Sign in and choose the correct workspace. Provider applicants use the onboarding checklist to submit private evidence; matched real jobs remain unavailable during launch review.",
        },
      ]}
    />
  );
}
