import { PublicInfoPage } from "../components/public-info-page";

export default function FaqPage() {
  return (
    <PublicInfoPage
      kicker="Frequently asked questions"
      title="The important answers, without the clutter."
      intro="These are the basics customers and independent providers should understand before using Tuveloz."
      sections={[
        {
          title: "Is Tuveloz the vehicle-service provider?",
          text: "No. Tuveloz is a marketplace that helps customers and independent providers find one another. The selected provider performs the service.",
        },
        {
          title: "Does posting a request cost money?",
          text: "Posting a request is free. Any customer service fee is shown separately before a paid quote is confirmed.",
        },
        {
          title: "Who sets the provider price?",
          text: "Each provider sets their own quote. Tuveloz does not require a provider to accept a job or use a specific schedule.",
        },
        {
          title: "Are all providers licensed?",
          text: "Tuveloz requires proof only when a service and location legally require a license or registration. Other approved services may not legally require one.",
        },
        {
          title: "Where is Tuveloz operating?",
          text: "The current launch area is Montgomery County, Maryland. Customers and providers can request future areas from the Learn page.",
        },
        {
          title: "How do I access my tools?",
          text: "Sign in and choose the correct workspace. Customers see customer requests and quotes; verified providers see matched jobs and business tools.",
        },
      ]}
    />
  );
}
