import type { Metadata } from "next";
import {
  publicProviderSummary,
  type PublicProviderSummary,
} from "../../../lib/public-provider-page";
import ProviderStorefrontClient from "./provider-storefront-client";

const BASE_URL = "https://tuveloz.com";
const MAX_STRUCTURED_REVIEWS = 20;

type PageProps = { params: Promise<{ slug: string }> };

function metaDescription(summary: PublicProviderSummary) {
  const services = summary.services.slice(0, 4).join(", ");
  const where = summary.businessMunicipality
    ? ` in ${summary.businessMunicipality}, MD`
    : " in Montgomery County, MD";
  const headline = summary.headline.trim();
  const base = headline
    || (services ? `Independent vehicle services${where}.` : `Independent vehicle service provider${where}.`);
  const scope = services ? ` Services: ${services}.` : "";
  const rating = summary.reviewSummary.count
    ? ` Rated ${summary.reviewSummary.average} from ${summary.reviewSummary.count} completed-job review${summary.reviewSummary.count === 1 ? "" : "s"} on Tuveloz.`
    : "";
  return `${base}${scope}${rating}`.trim().slice(0, 300);
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const summary = await publicProviderSummary(slug);
  // A draft, unapproved, or paused profile stays unindexed and gets no title
  // that could leak a business name the marketplace will not serve.
  if (!summary) {
    return {
      title: "Provider page",
      robots: { index: false, follow: false },
    };
  }
  const canonical = `${BASE_URL}/providers/${summary.slug}`;
  const description = metaDescription(summary);
  const image = summary.hasLogo
    ? `${BASE_URL}/api/provider-media?profileId=${encodeURIComponent(summary.profileId)}`
    : `${BASE_URL}/og-image.png?v=5`;
  return {
    title: summary.businessName,
    description,
    alternates: { canonical },
    openGraph: {
      title: `${summary.businessName} | Tuveloz`,
      description,
      url: canonical,
      type: "profile",
      images: [{ url: image, alt: `${summary.businessName} on Tuveloz` }],
    },
    twitter: { card: "summary_large_image", images: [image] },
  };
}

/**
 * Structured data describes only facts the page itself already shows: the
 * provider-supplied business details and reviews tied to completed Tuveloz
 * jobs. It never asserts licensing, verification, or endorsement.
 */
function providerStructuredData(summary: PublicProviderSummary) {
  const canonical = `${BASE_URL}/providers/${summary.slug}`;
  const business: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "AutomotiveBusiness",
    "@id": canonical,
    name: summary.businessName,
    url: canonical,
    description: summary.headline || summary.about || undefined,
    areaServed: summary.areas.length
      ? summary.areas.map((area) => ({ "@type": "AdministrativeArea", name: area }))
      : [{ "@type": "AdministrativeArea", name: "Montgomery County, Maryland" }],
    parentOrganization: { "@type": "Organization", name: "Tuveloz", url: BASE_URL },
  };
  if (summary.hasLogo) {
    business.image = `${BASE_URL}/api/provider-media?profileId=${encodeURIComponent(summary.profileId)}`;
  }
  if (summary.businessMunicipality) {
    business.address = {
      "@type": "PostalAddress",
      addressLocality: summary.businessMunicipality,
      addressRegion: "MD",
      addressCountry: "US",
    };
  }
  if (summary.services.length) {
    business.hasOfferCatalog = {
      "@type": "OfferCatalog",
      name: `${summary.businessName} services on Tuveloz`,
      itemListElement: summary.services.map((service) => ({
        "@type": "Offer",
        itemOffered: { "@type": "Service", name: service },
      })),
    };
  }
  if (summary.reviewSummary.count > 0) {
    business.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: summary.reviewSummary.average,
      reviewCount: summary.reviewSummary.count,
      bestRating: 5,
      worstRating: 1,
    };
    business.review = summary.reviews.slice(0, MAX_STRUCTURED_REVIEWS).map((review) => ({
      "@type": "Review",
      reviewRating: {
        "@type": "Rating",
        ratingValue: review.rating,
        bestRating: 5,
        worstRating: 1,
      },
      author: { "@type": "Person", name: review.customerDisplayName },
      reviewBody: review.comment || undefined,
      itemReviewed: { "@id": canonical },
    }));
  }
  return business;
}

function breadcrumbStructuredData(summary: PublicProviderSummary) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Tuveloz", item: BASE_URL },
      {
        "@type": "ListItem",
        position: 2,
        name: summary.businessName,
        item: `${BASE_URL}/providers/${summary.slug}`,
      },
    ],
  };
}

export default async function ProviderStorefrontPage({ params }: PageProps) {
  const { slug } = await params;
  const summary = await publicProviderSummary(slug);
  return (
    <>
      {summary && (
        <>
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify(providerStructuredData(summary)),
            }}
          />
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify(breadcrumbStructuredData(summary)),
            }}
          />
        </>
      )}
      <ProviderStorefrontClient />
    </>
  );
}
