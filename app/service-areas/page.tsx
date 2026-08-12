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
    `The ${LOCAL_AREA_COUNTY}, ${LOCAL_AREA_STATE} areas Tuveloz covers at launch, and the ZIP codes behind them. Provider applications are open; customer requests are not yet.`,
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
        title={`One county, covered properly.`}
        intro={`Tuveloz is being built for ${LOCAL_AREA_COUNTY}, ${LOCAL_AREA_STATE} first — all ${SERVICE_AREA_COVERAGE.length} areas, not a shortlist of the profitable ones. Customer requests are not open yet. Provider applications are.`}
        sections={[
          {
            title: "Why one county",
            text: `A marketplace is only useful when enough providers cover the area you are actually in. Launching thin across a whole state gets a customer a page with nobody on it, so the launch area stays at ${LOCAL_AREA_COUNTY} until it is genuinely covered here.`,
            points: [
              `All ${SERVICE_AREA_COVERAGE.length} areas of the county, including the small and rural ones.`,
              "Providers set their own service areas — Tuveloz does not assign anyone a territory.",
              "Somewhere else? You can request a future launch area from the About page.",
            ],
          },
          {
            title: "Why only some areas have a page",
            text: "A page exists where there is something specific worth saying about working in that area — access, parking, how far apart the addresses sit. Publishing the same page 36 times with the name swapped would help nobody and would be treated as spam, correctly. The rest are covered identically; they get a page when there is a reason for one.",
            points: [
              "Which areas get a page next is decided by what people actually ask for below.",
              "Coverage is not affected either way — the ZIP list is the same.",
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
