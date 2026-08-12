import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicInfoPage } from "../../components/public-info-page";
import {
  LocalAreaLinks,
  LocalLaunchPanel,
  LocalPricingNote,
  LocalProviderPanel,
  LocalServiceLinks,
  LocalStructuredData,
} from "../../components/local-page-sections";
import {
  findLocalService,
  LOCAL_AREA_COUNTY,
  LOCAL_AREA_STATE,
  LOCAL_SERVICES,
  PUBLISHED_SERVICE_AREAS,
  publishedAreasForService,
  SERVICE_AREA_COVERAGE,
  serviceMetaDescription,
  servicePath,
} from "../../../lib/local-service-areas";

type ServiceParams = { params: Promise<{ service: string }> };

export function generateStaticParams() {
  return LOCAL_SERVICES.map((service) => ({ service: service.slug }));
}

export async function generateMetadata({ params }: ServiceParams): Promise<Metadata> {
  const { service: slug } = await params;
  const service = findLocalService(slug);
  if (!service) return { title: "Service not found" };
  return {
    title: `${service.searchName} in ${LOCAL_AREA_COUNTY}, ${LOCAL_AREA_STATE}`,
    description: serviceMetaDescription(service),
    alternates: { canonical: servicePath(service) },
  };
}

export default async function ServicePage({ params }: ServiceParams) {
  const { service: slug } = await params;
  const service = findLocalService(slug);
  if (!service) notFound();

  const otherServices = LOCAL_SERVICES.filter((entry) => entry.slug !== service.slug);
  const areasWithPage = publishedAreasForService(service.slug);

  return (
    <>
      <LocalStructuredData
        breadcrumbs={[
          { name: "Tuveloz", path: "/" },
          { name: "Services", path: "/services" },
          { name: service.searchName, path: servicePath(service) },
        ]}
        service={service}
      />
      <PublicInfoPage
        breadcrumbs={[
          { label: "Tuveloz", href: "/" },
          { label: "Services", href: "/services" },
          { label: service.name },
        ]}
        kicker={`${service.name} · ${LOCAL_AREA_COUNTY}`}
        title={`${service.searchName}.`}
        intro={`${service.summary} Available across ${LOCAL_AREA_COUNTY}, ${LOCAL_AREA_STATE} when Tuveloz opens to customers — which it has not yet.`}
        sections={[
          {
            title: "What this covers",
            text: "What is and is not included at launch. Anything outside this list is a different job and should be quoted as one.",
            points: [...service.covered],
          },
          {
            title: "What to have ready",
            text: "The difference between a quote and a phone call is detail. When requests open, having these ready means a provider can price the job without a back-and-forth first.",
            points: [...service.describeForQuote],
          },
          {
            title: "Who would be doing the work",
            text: "An independent provider business, not Tuveloz and not an employee of it. Tuveloz does not employ, train, assign, or supervise providers. Approval is granted for specific services after evidence review, and Tuveloz shows the exact evidence checked rather than claiming a blanket verification.",
          },
        ]}
      >
        <LocalPricingNote />
        <LocalAreaLinks
          areas={areasWithPage.length > 0 ? areasWithPage : PUBLISHED_SERVICE_AREAS}
          service={service}
          publishedForService={areasWithPage}
          heading={`${service.name} by area`}
          note={`All ${SERVICE_AREA_COVERAGE.length} areas of ${LOCAL_AREA_COUNTY} are covered. These are the ones with a page of their own.`}
        />
        <LocalServiceLinks services={otherServices} heading="Other launch services" />
        <LocalLaunchPanel
          source={`service-${service.slug}`}
          serviceName={service.searchName.toLowerCase()}
        />
        <LocalProviderPanel
          areaName={LOCAL_AREA_COUNTY}
          serviceNote={service.providerNote}
        />
      </PublicInfoPage>
    </>
  );
}
