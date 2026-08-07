import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LocalLandingPage } from "../../components/local-landing-page";
import {
  SERVICE_LANDING_PAGES,
  TOWN_LANDING_PAGES,
  serviceLandingPage,
} from "../../../lib/local-landing-pages";

const BASE_URL = "https://tuveloz.com";

type PageProps = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return SERVICE_LANDING_PAGES.map((page) => ({ slug: page.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = serviceLandingPage(slug);
  if (!page) return { title: "Service", robots: { index: false, follow: false } };
  const canonical = `${BASE_URL}/services/${page.slug}`;
  return {
    title: page.title,
    description: page.description,
    alternates: { canonical },
    openGraph: {
      title: `${page.title} | Tuveloz`,
      description: page.description,
      url: canonical,
      type: "website",
    },
  };
}

export default async function ServiceLandingRoute({ params }: PageProps) {
  const { slug } = await params;
  const page = serviceLandingPage(slug);
  if (!page) notFound();

  const canonical = `${BASE_URL}/services/${page.slug}`;
  const serviceSchema = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: page.name,
    serviceType: page.name,
    description: page.description,
    url: canonical,
    areaServed: { "@type": "AdministrativeArea", name: "Montgomery County, Maryland" },
    provider: { "@type": "Organization", name: "Tuveloz", url: BASE_URL },
  };
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: page.faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: { "@type": "Answer", text: faq.answer },
    })),
  };
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Tuveloz", item: BASE_URL },
      { "@type": "ListItem", position: 2, name: page.name, item: canonical },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceSchema) }}
      />
      {page.faqs.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
        />
      )}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <LocalLandingPage
        kicker="Montgomery County, Maryland"
        title={page.title}
        intro={page.intro}
        bullets={page.whatItCovers}
        bulletsHeading="How this will work"
        faqs={page.faqs}
        relatedHeading="Towns we're onboarding providers in"
        relatedLinks={TOWN_LANDING_PAGES.map((town) => ({
          href: `/areas/${town.slug}`,
          label: town.name,
        }))}
        launchListSource={`service-landing-${page.slug}`}
      />
    </>
  );
}
