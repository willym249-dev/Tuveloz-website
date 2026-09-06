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
        intro={`${service.summary} We're preparing this service for ${LOCAL_AREA_COUNTY}, ${LOCAL_AREA_STATE}. Availability will depend on reviewed providers in your area. Customer bookings are not open yet.`}
        sections={[
          {
            title: "What this covers",
            text: "Check what is included and excluded, then confirm the details in your provider's quote before agreeing to any work.",
            points: [...service.covered],
          },
          {
            title: "What to have ready",
            text: "When requests open, these details will help a provider understand what you need. It's fine if you don't know the technical terms.",
            points: [...service.describeForQuote],
          },
          {
            title: "Who will do the work",
            text: "The independent provider you choose will do the work. Tuveloz does not employ, train, assign, or supervise providers. We review each provider for the services they apply to offer, and their listing will explain which documents were checked.",
          },
        ]}
      >
        <LocalPricingNote />
        <LocalAreaLinks
          areas={areasWithPage.length > 0 ? areasWithPage : PUBLISHED_SERVICE_AREAS}
          service={service}
          publishedForService={areasWithPage}
          heading={`${service.name} by area`}
          note={`Our planned launch area includes ${SERVICE_AREA_COVERAGE.length} communities in ${LOCAL_AREA_COUNTY}. Available services will depend on the providers who complete review.`}
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
