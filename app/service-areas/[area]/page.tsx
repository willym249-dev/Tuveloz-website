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
  LocalZipCodes,
} from "../../components/local-page-sections";
import {
  areaLabel,
  areaMetaDescription,
  areaPath,
  findPublishedServiceArea,
  LOCAL_AREA_COUNTY,
  LOCAL_SERVICES,
  PUBLISHED_SERVICE_AREAS,
  publishedServicesForArea,
} from "../../../lib/local-service-areas";

type AreaParams = { params: Promise<{ area: string }> };

export function generateStaticParams() {
  return PUBLISHED_SERVICE_AREAS.map((area) => ({ area: area.slug }));
}

export async function generateMetadata({ params }: AreaParams): Promise<Metadata> {
  const { area: slug } = await params;
  const area = findPublishedServiceArea(slug);
  if (!area) return { title: "Service area not found" };
  return {
    title: `Vehicle services in ${areaLabel(area)}`,
    description: areaMetaDescription(area),
    alternates: { canonical: areaPath(area) },
  };
}

export default async function ServiceAreaPage({ params }: AreaParams) {
  const { area: slug } = await params;
  // Only areas with copy written for them have a page. Everything else in the
  // coverage map 404s rather than existing as a reworded duplicate.
  const area = findPublishedServiceArea(slug);
  if (!area) notFound();

  const label = areaLabel(area);
  const inArea = publishedServicesForArea(area.slug);
  const otherAreas = PUBLISHED_SERVICE_AREAS.filter((entry) => entry.slug !== area.slug);

  return (
    <>
      <LocalStructuredData
        breadcrumbs={[
          { name: "Tuveloz", path: "/" },
          { name: "Service areas", path: "/service-areas" },
          { name: label, path: areaPath(area) },
        ]}
        areaName={label}
      />
      <PublicInfoPage
        breadcrumbs={[
          { label: "Tuveloz", href: "/" },
          { label: "Service areas", href: "/service-areas" },
          { label: area.name },
        ]}
        kicker={`${label} · ${LOCAL_AREA_COUNTY}`}
        title={`Vehicle services in ${area.name}.`}
        intro={`Tuveloz connects car owners with independent vehicle-service businesses. ${area.name} is part of our planned ${LOCAL_AREA_COUNTY} launch area. Provider applications are open; customer bookings are not open yet.`}
        sections={[
          {
            title: "Help your provider find the vehicle",
            text: area.localCopy ?? "",
          },
          {
            title: "You choose who to work with",
            text: "When bookings open, you'll be able to compare quotes from independent providers serving your area. Providers set their own prices and decide which requests to answer. Tuveloz does not employ or assign them.",
            points: [
              "Providers receive their full quoted price.",
              "You can ask questions or decline a quote before agreeing to work.",
              "Customer reviews will be linked to completed Tuveloz jobs.",
            ],
          },
        ]}
      >
        <LocalServiceLinks
          services={LOCAL_SERVICES}
          area={area}
          publishedInArea={inArea}
          heading={`Launch services for ${area.name}`}
        />
        <LocalZipCodes area={area} />
        <LocalPricingNote />
        <LocalAreaLinks
          areas={otherAreas}
          heading="Explore other communities"
          note="These communities are also in the planned launch area. Service availability will depend on the providers who complete review."
        />
        <LocalLaunchPanel source={`service-area-${area.slug}`} areaName={area.name} />
        <LocalProviderPanel areaName={area.name} />
      </PublicInfoPage>
    </>
  );
}
