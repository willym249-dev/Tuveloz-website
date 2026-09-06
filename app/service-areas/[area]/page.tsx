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
        intro={`Tuveloz is a local marketplace being built for ${LOCAL_AREA_COUNTY}: you describe what your vehicle needs, independent providers send real quotes, and you choose — or choose nothing at all. ${area.name} is inside the launch area. Customer requests are not open yet.`}
        sections={[
          {
            title: `Getting to a vehicle in ${area.name}`,
            text: area.localCopy ?? "",
          },
          {
            title: "What you would be choosing between",
            text: "Every provider on Tuveloz is an independent business, not an employee. Tuveloz does not assign one to you, does not set their price, and does not mark up their labor.",
            points: [
              "Each provider sets and approves their own quote, and receives it in full.",
              "You compare what comes back and accept one, or none.",
              "Reviews are tied to completed jobs, so a track record has to be earned.",
            ],
          },
          {
            title: `Why ${area.name} is not open to customers yet`,
            text: "Opening customer requests before enough local providers have cleared review would mean posting a job that nobody answers. Provider applications and evidence review run first, and each service opens only after it passes launch review — so the first request made here has somewhere to land.",
            points: [
              "Provider applications and evidence review: open now.",
              "Customer requests, quotes, and payments: not available in any area.",
              "Approval covers specific services for a specific provider, never a blanket sign-off.",
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
          heading="Other areas with a page"
          note="Every area of the county is covered. These are the ones with something specific written about them."
        />
        <LocalLaunchPanel source={`service-area-${area.slug}`} areaName={area.name} />
        <LocalProviderPanel areaName={area.name} />
      </PublicInfoPage>
    </>
  );
}
