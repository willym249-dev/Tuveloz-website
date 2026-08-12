import type { Metadata } from "next";
import { PublicInfoPage } from "../components/public-info-page";
import {
  LocalCoverageStatement,
  LocalLaunchPanel,
  LocalPricingNote,
  LocalProviderPanel,
  LocalServiceLinks,
  LocalStructuredData,
} from "../components/local-page-sections";
import {
  LOCAL_AREA_COUNTY,
  LOCAL_AREA_STATE,
  LOCAL_SERVICES,
  PUBLISHED_SERVICE_AREAS,
  SERVICE_AREA_COVERAGE,
} from "../../lib/local-service-areas";

export const metadata: Metadata = {
  title: "Vehicle services at launch",
  description:
    `The vehicle services Tuveloz opens with in ${LOCAL_AREA_COUNTY}, ${LOCAL_AREA_STATE} — battery and jump start, wipers and bulbs, fluid top-off, car cleaning, and on-site diagnostics. Customer requests are not open yet.`,
  alternates: { canonical: "/services" },
};

export default function ServicesHubPage() {
  return (
    <>
      <LocalStructuredData
        breadcrumbs={[
          { name: "Tuveloz", path: "/" },
          { name: "Services", path: "/services" },
        ]}
      />
      <PublicInfoPage
        breadcrumbs={[
          { label: "Tuveloz", href: "/" },
          { label: "Services" },
        ]}
        kicker="Services at launch"
        title="A short list, opened properly."
        intro={`Tuveloz opens with ${LOCAL_SERVICES.length} services rather than a catalogue it cannot stand behind. Each one has to clear launch review before it opens to customers, and each provider is approved for specific services rather than waved through.`}
        sections={[
          {
            title: "Why the list is short",
            text: "These are the services that can be done well on-site without specialised licensing, so providers can be onboarded honestly and customers are not sold work nobody has been checked for. Specialised services — tyres, air conditioning, towing — are added as separate categories once the evidence and insurance requirements for each are documented and met.",
            points: [
              "A service opens only after it passes launch review.",
              "Approval is per service, per provider — never a blanket sign-off.",
              "Do not assume an umbrella licence. Tuveloz shows the exact evidence checked.",
            ],
          },
          {
            title: "How a quote is meant to work",
            text: "You describe the vehicle and the problem once. Providers who are approved for that exact service and cover your area decide whether to quote. You compare what comes back and accept one, or none — accepting is what creates a written authorisation, and added work needs your approval as a change order.",
            points: [
              "Providers set their own prices and receive them in full.",
              "Nothing is charged for asking, and no quote obliges you to anything.",
              "Parts are bought separately by the customer; provider amounts are labour only.",
            ],
          },
        ]}
      >
        <LocalServiceLinks services={LOCAL_SERVICES} heading="Every launch service" />
        <LocalPricingNote />
        <LocalCoverageStatement
          areas={SERVICE_AREA_COVERAGE}
          published={PUBLISHED_SERVICE_AREAS}
        />
        <LocalLaunchPanel source="services-hub" />
        <LocalProviderPanel areaName={LOCAL_AREA_COUNTY} />
      </PublicInfoPage>
    </>
  );
}
