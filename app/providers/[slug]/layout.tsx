import { cache } from "react";
import type { Metadata } from "next";
import {
  publicProviderDirectoryEntry,
  type PublicProviderDirectoryEntry,
} from "../../../lib/public-provider-directory";

const BASE_URL = "https://tuveloz.com";

/**
 * The profile itself renders on the client, so without this server layout a
 * crawler sees a loading shell and nothing else. Everything here is limited to
 * profiles the public API would actually serve; anything else is marked
 * noindex rather than described, because a page that is not public yet should
 * not be summarized in a search result either.
 */
export const dynamic = "force-dynamic";

/** Cached so generateMetadata and the layout share one lookup per request. */
const visibleEntry = cache(async (slug: string) => {
  try {
    return await publicProviderDirectoryEntry(slug);
  } catch (error) {
    console.error("Unable to resolve a provider profile for metadata", error);
    return null;
  }
});

async function entryFor(params: Promise<{ slug: string }>) {
  const { slug } = await params;
  return visibleEntry(slug);
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> },
): Promise<Metadata> {
  const entry = await entryFor(params);
  if (!entry) {
    return {
      title: "Provider page",
      robots: { index: false, follow: false },
    };
  }

  const where = entry.businessMunicipality
    ? `${entry.businessMunicipality}, MD`
    : "Montgomery County, MD";
  const description = entry.headline
    ? `${entry.headline} — ${entry.businessName}, an independent vehicle-service provider in ${where} on Tuveloz. Listed services: ${entry.services.join(", ")}.`
    : `${entry.businessName}, an independent vehicle-service provider in ${where} on Tuveloz. Listed services: ${entry.services.join(", ")}.`;

  return {
    title: entry.businessName,
    description: description.slice(0, 300),
    alternates: {
      canonical: `/providers/${encodeURIComponent(entry.slug)}`,
    },
    openGraph: {
      title: `${entry.businessName} | Tuveloz`,
      description: description.slice(0, 300),
      url: `${BASE_URL}/providers/${encodeURIComponent(entry.slug)}`,
      type: "profile",
    },
  };
}

/**
 * Provider-supplied identity and scope only. Reviews, credential records, and
 * completed-job counts are deliberately left out: the page presents those with
 * dated limits and disclaimers that structured data strips away.
 */
function localBusinessSchema(entry: PublicProviderDirectoryEntry) {
  return {
    "@context": "https://schema.org",
    "@type": "AutomotiveBusiness",
    name: entry.businessName,
    url: `${BASE_URL}/providers/${encodeURIComponent(entry.slug)}`,
    ...(entry.headline ? { slogan: entry.headline } : {}),
    ...(entry.about ? { description: entry.about.slice(0, 500) } : {}),
    ...(entry.businessMunicipality
      ? {
        address: {
          "@type": "PostalAddress",
          addressLocality: entry.businessMunicipality,
          addressRegion: "MD",
          addressCountry: "US",
        },
      }
      : {}),
    areaServed: entry.areas.length
      ? entry.areas.map((area) => ({
        "@type": "AdministrativeArea",
        name: area,
      }))
      : [{ "@type": "AdministrativeArea", name: "Montgomery County, Maryland" }],
    makesOffer: entry.services.map((service) => ({
      "@type": "Offer",
      itemOffered: { "@type": "Service", name: service },
    })),
    parentOrganization: {
      "@type": "Organization",
      name: "Tuveloz",
      url: BASE_URL,
    },
  };
}

export default async function ProviderProfileLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}>) {
  const entry = await entryFor(params);
  return (
    <>
      {entry && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(localBusinessSchema(entry)),
          }}
        />
      )}
      {children}
    </>
  );
}
