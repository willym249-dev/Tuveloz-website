import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LocalLandingPage } from "../../components/local-landing-page";
import {
  SERVICE_LANDING_PAGES,
  TOWN_LANDING_PAGES,
  townFaqs,
  townLandingPage,
} from "../../../lib/local-landing-pages";

const BASE_URL = "https://tuveloz.com";

type PageProps = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return TOWN_LANDING_PAGES.map((page) => ({ slug: page.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = townLandingPage(slug);
  if (!page) return { title: "Service area", robots: { index: false, follow: false } };
  const canonical = `${BASE_URL}/areas/${page.slug}`;
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

export default async function TownLandingRoute({ params }: PageProps) {
  const { slug } = await params;
  const page = townLandingPage(slug);
  if (!page) notFound();

  const canonical = `${BASE_URL}/areas/${page.slug}`;
  const faqs = townFaqs(page);
  const areaSchema = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: page.title,
    description: page.description,
    url: canonical,
    about: {
      "@type": "Service",
      name: `Mobile vehicle services in ${page.name}, MD`,
      areaServed: { "@type": "City", name: page.name, addressRegion: "MD", addressCountry: "US" },
      provider: { "@type": "Organization", name: "Tuveloz", url: BASE_URL },
    },
  };
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
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
        dangerouslySetInnerHTML={{ __html: JSON.stringify(areaSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <LocalLandingPage
        kicker={`${page.name}, Maryland`}
        title={page.title}
        intro={`${page.intro} Tuveloz covers ${page.nearby.slice(0, 3).join(", ")}, and the rest of ${page.name}.`}
        bullets={[
          "Independent providers set their own prices and send their own quotes",
          "You compare quotes side by side and choose who does the work",
          "Providers keep 100% of their quoted price",
          `Nearby: ${page.nearby.join(", ")}`,
        ]}
        bulletsHeading={`Vehicle services in ${page.name}`}
        faqs={faqs}
        relatedHeading="Services we're preparing"
        relatedLinks={SERVICE_LANDING_PAGES.map((service) => ({
          href: `/services/${service.slug}`,
          label: service.name,
        }))}
        launchListSource={`area-landing-${page.slug}`}
      />
    </>
  );
}
