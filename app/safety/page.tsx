import { requestPageMetadata } from "../../lib/request-page-metadata";
import type { Metadata } from "next";
import { PublicInfoPage } from "../components/public-info-page";

const englishMetadata: Metadata = {
  title: "Safety & Trust",
  description:
    "Learn what Tuveloz checks for each service, how your information is shared and what you will see before accepting a quote.",
  alternates: {
    canonical: "/safety",
  },
};

export async function generateMetadata(): Promise<Metadata> {
  return requestPageMetadata(englishMetadata);
}

export default function SafetyPage() {
  return (
    <PublicInfoPage
      kicker="Safety & trust"
      title="Know who's working on your car."
      intro="Here's what Tuveloz checks, what providers can see and how you'll review a quote. Provider applications are open; customer bookings are not open yet."
      sections={[
        {
          title: "Checks for the work you need",
          text: "Before a job can go ahead, Tuveloz checks the service, the person doing the work, the location and date, current documents and agreements, and any required supervision. Each label says what was checked. These checks do not guarantee safety, quality or results.",
          points: [
            "Checks for the specific service",
            "Checks for the person and location",
            "Expired documents block access to jobs"
          ]
        },
        {
          title: "Background checks",
          text: "Tuveloz checks the license, registration or insurance required for a particular service. It does not run criminal background checks on providers or their staff. A listing is not a character endorsement. If a screening step is added, we will explain what it covers."
        },
        {
          title: "Customer privacy",
          text: "Providers receive only the information needed to decide whether to quote. Private contact and service-address details are limited to the selected provider."
        },
        {
          title: "See the full price before you agree",
          text: "When bookings open, you'll see the provider's labor price, the separate Customer Service Fee, taxes or other charges, refund terms and the total before confirming. You buy any needed parts separately; parts are not paid for through Tuveloz."
        },
        {
          title: "You choose your provider",
          text: "You decide which provider to hire. Providers choose their jobs, prices, schedule, tools and methods within the law and the work you agree to. Tuveloz does not employ, train, assign or supervise providers or their staff."
        }
      ]}
    />
  );
}
