import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicInfoPage } from "../../../components/public-info-page";
import {
  LocalAreaLinks,
  LocalLaunchPanel,
  LocalPricingNote,
  LocalProviderPanel,
  LocalServiceLinks,
  LocalStructuredData,
} from "../../../components/local-page-sections";
import {
  areaLabel,
  areaPath,
  areaServiceIsPublished,
  areaServiceMetaDescription,
  areaServicePath,
  findLocalService,
  findServiceArea,
  LOCAL_SERVICES,
  publishedAreaServices,
  publishedAreasForService,
  publishedServicesForArea,
  servicePath,
} from "../../../../lib/local-service-areas";

type AreaServiceParams = { params: Promise<{ area: string; service: string }> };

export function generateStaticParams() {
  return publishedAreaServices().map(({ area, service }) => ({
    area: area.slug,
    service: service.slug,
  }));
}

export async function generateMetadata({ params }: AreaServiceParams): Promise<Metadata> {
  const { area: areaSlug, service: serviceSlug } = await params;
  const area = findServiceArea(areaSlug);
  const service = findLocalService(serviceSlug);
  if (!area || !service || !areaServiceIsPublished(areaSlug, serviceSlug)) {
    return { title: "Page not found" };
  }
  return {
    title: `${service.searchName} in ${areaLabel(area)}`,
    description: areaServiceMetaDescription(area, service),
    alternates: { canonical: areaServicePath(area, service) },
  };
}

export default async function AreaServicePage({ params }: AreaServiceParams) {
  const { area: areaSlug, service: serviceSlug } = await params;
  const area = findServiceArea(areaSlug);
  const service = findLocalService(serviceSlug);

  // Publication is an allowlist, not a cross product — see lib/local-service-areas.ts.
  // A pair that has not been deliberately published does not exist.
  if (!area || !service || !areaServiceIsPublished(areaSlug, serviceSlug)) notFound();

  const label = areaLabel(area);
  const otherServices = LOCAL_SERVICES.filter((entry) => entry.slug !== service.slug);
  const otherAreas = publishedAreasForService(service.slug)
    .filter((entry) => entry.slug !== area.slug);

  return (
    <>
      <LocalStructuredData
        breadcrumbs={[
          { name: "Tuveloz", path: "/" },
          { name: "Service areas", path: "/service-areas" },
          { name: label, path: areaPath(area) },
          { name: service.searchName, path: areaServicePath(area, service) },
        ]}
        service={service}
        areaName={label}
      />
      <PublicInfoPage
        breadcrumbs={[
          { label: "Tuveloz", href: "/" },
          { label: "Service areas", href: "/service-areas" },
          { label: area.name, href: areaPath(area) },
          { label: service.name },
        ]}
        kicker={`${service.name} · ${label}`}
        title={`${service.searchName} in ${area.name}.`}
        intro={`${service.summary} We're preparing to connect customers in ${area.name} with independent providers reviewed for this work. Customer bookings are not open yet.`}
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
            title: "Help your provider find the vehicle",
            text: area.localCopy ?? "",
          },
        ]}
      >
        <LocalPricingNote />
        <LocalServiceLinks
          services={otherServices}
          area={area}
          publishedInArea={publishedServicesForArea(area.slug)}
          heading={`Other services in ${area.name}`}
        />
        <LocalAreaLinks
          areas={otherAreas}
          service={service}
          publishedForService={otherAreas}
          heading={`${service.name} in other areas`}
        />
        <LocalLaunchPanel
          source={`service-area-${area.slug}-${service.slug}`}
          serviceName={service.searchName.toLowerCase()}
          areaName={area.name}
        />
        <LocalProviderPanel areaName={area.name} serviceNote={service.providerNote} />
        <section className="local-link-section">
          <h2>Elsewhere in the county</h2>
          <p className="local-link-note">
            <a href={servicePath(service)}>
              {service.searchName} across Montgomery County
            </a>
          </p>
        </section>
      </PublicInfoPage>
    </>
  );
}
