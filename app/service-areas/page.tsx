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
  title: "Service areas in Montgomery County, MD",
  description:
    `Explore Tuveloz's planned launch area in ${LOCAL_AREA_COUNTY}, ${LOCAL_AREA_STATE}. Provider applications are open; customer bookings are not open yet.`,
  alternates: { canonical: "/service-areas" },
};

export default function ServiceAreasHubPage() {
  return (
    <>
      <LocalStructuredData
        breadcrumbs={[
          { name: "Tuveloz", path: "/" },
          { name: "Service areas", path: "/service-areas" },
        ]}
      />
      <PublicInfoPage
        breadcrumbs={[
          { label: "Tuveloz", href: "/" },
          { label: "Service areas" },
        ]}
        kicker="Service areas"
        title={`Starting in ${LOCAL_AREA_COUNTY}.`}
        intro={`We're welcoming provider applications from ${LOCAL_AREA_COUNTY}, ${LOCAL_AREA_STATE}. The ${SERVICE_AREA_COVERAGE.length} communities below are part of our planned launch area. Customer bookings are not open yet.`}
        sections={[
          {
            title: "Finding a provider in your area",
            text: "When bookings open, available services will depend on which providers serve your location and have completed review. Being in the launch area does not guarantee that a provider is available for every service or time.",
            points: [
              "Providers choose their own service areas and schedules.",
              "Each provider is reviewed for the services they offer.",
              "You choose whether to accept any quote you receive.",
            ],
          },
        ]}
      >
        <LocalCoverageStatement
          areas={SERVICE_AREA_COVERAGE}
          published={PUBLISHED_SERVICE_AREAS}
        />
        <LocalServiceLinks services={LOCAL_SERVICES} heading="Services at launch" />
        <LocalPricingNote />
        <LocalLaunchPanel source="service-areas-hub" />
        <LocalProviderPanel areaName={LOCAL_AREA_COUNTY} />
      </PublicInfoPage>
    </>
  );
}
