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
        title="Services we're preparing to offer."
        intro={`We're preparing ${LOCAL_SERVICES.length} service categories for Montgomery County. Providers apply for the work they offer, and each service opens after the required reviews are complete. Customer requests are not open yet.`}
        sections={[
          {
            title: "Starting with everyday vehicle needs",
            text: "We're starting with a few common services. More work, such as tire repair, air conditioning and towing, can be added once the required documents, insurance and providers are in place.",
            points: [
              "A service opens only after it passes launch review.",
              "Providers are approved for the specific services they offer.",
              "Each listing will explain which documents were checked.",
            ],
          },
          {
            title: "How quotes will work",
            text: "Describe your vehicle and what you need. Providers approved for that service in your area decide whether to send a quote. Compare the work and prices before choosing. Accepting a quote creates a written authorization for that work; any extra work needs your approval before it starts.",
            points: [
              "Providers set their own prices and receive them in full.",
              "You can decline every quote at no cost.",
              "Customers buy parts separately. Provider quotes cover labor only.",
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
