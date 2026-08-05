/**
 * Structured data for a public provider profile.
 *
 * The rule that matters here is which type to emit. Google's LocalBusiness
 * search feature lists a physical address as required, and most Tuveloz
 * providers are mobile — they travel to the customer and have no public
 * premises. Forcing LocalBusiness onto them would mean either omitting a
 * required field or publishing an address that was never meant to be public,
 * so mobile providers get Organization plus areaServed instead. That describes
 * them accurately and claims no search feature they do not qualify for.
 *
 * A shop-based provider gets AutoRepair (a LocalBusiness subtype) — but only
 * when an address is actually rendered on the profile page. `publicAddress` is
 * therefore passed in by the page, not read from the database here: markup must
 * describe what a visitor can see, and the provider's stored service address is
 * not currently displayed to anyone. When that changes, and with whatever
 * consent that requires, the type follows automatically.
 *
 * Nothing here invents a rating. aggregateRating is emitted only when published
 * reviews exist and are visible on the page — reviews on Tuveloz are tied to
 * completed jobs, so a count of zero means zero, not "unknown".
 */

import { providerModeForWorkLocations } from "./service-matching.ts";

export const PROVIDER_PROFILE_BASE_URL = "https://tuveloz.com/providers";

export type ProviderStructuredDataInput = {
  slug: string;
  businessName: string;
  headline?: string;
  about?: string;
  /** Serialized provider work locations, as stored on the application. */
  workLocations: string | readonly string[];
  /** Municipality the provider works from. Used for areaServed, not as an address. */
  businessMunicipality?: string;
  /** Service areas the provider covers. */
  areas?: readonly string[];
  /** Publicly listed services, already filtered to platform-active ones. */
  services?: readonly string[];
  /**
   * Only supply this when the profile page actually renders the address. Absent
   * means "no public premises to describe", which is the correct reading for a
   * mobile provider and the safe reading for everyone else.
   */
  publicAddress?: string;
  /** Published, completed-job reviews. Omitted from markup when count is 0. */
  reviewSummary?: { average: number; count: number };
};

export type ProviderStructuredData = Record<string, unknown>;

export function providerProfileUrl(slug: string) {
  return `${PROVIDER_PROFILE_BASE_URL}/${slug}`;
}

/**
 * True only for a provider that both takes customers at its own premises and
 * has an address on the page for a visitor to read.
 */
export function providerQualifiesAsLocalBusiness(input: ProviderStructuredDataInput) {
  const mode = providerModeForWorkLocations(input.workLocations);
  return (mode === "Shop" || mode === "Both") && Boolean(input.publicAddress?.trim());
}

export function providerStructuredData(
  input: ProviderStructuredDataInput,
): ProviderStructuredData {
  const url = providerProfileUrl(input.slug);
  const localBusiness = providerQualifiesAsLocalBusiness(input);
  const description = [input.headline, input.about]
    .map((value) => value?.trim())
    .filter(Boolean)
    .join(" — ");

  const areaServed = [
    ...(input.areas ?? []),
    ...(input.businessMunicipality ? [input.businessMunicipality] : []),
  ]
    .map((value) => value.trim())
    .filter(Boolean);

  const data: ProviderStructuredData = {
    // AutoRepair is a LocalBusiness subtype and the more specific description of
    // a shop. Organization carries no address requirement, which is why a mobile
    // provider gets it.
    "@type": localBusiness ? "AutoRepair" : "Organization",
    name: input.businessName,
    url,
  };

  if (description) data.description = description;

  if (localBusiness) {
    data.address = {
      "@type": "PostalAddress",
      streetAddress: input.publicAddress!.trim(),
      ...(input.businessMunicipality
        ? { addressLocality: input.businessMunicipality }
        : {}),
      addressRegion: "MD",
      addressCountry: "US",
    };
  }

  if (areaServed.length > 0) {
    data.areaServed = [...new Set(areaServed)].map((name) => ({
      "@type": "AdministrativeArea",
      name,
    }));
  }

  const services = (input.services ?? []).map((value) => value.trim()).filter(Boolean);
  if (services.length > 0) {
    data.makesOffer = services.map((service) => ({
      // An Offer with no price: the provider offers to quote this service, and
      // no amount is claimed because the provider sets it per job.
      "@type": "Offer",
      itemOffered: { "@type": "Service", name: service },
    }));
  }

  const reviews = input.reviewSummary;
  if (reviews && reviews.count > 0 && reviews.average > 0) {
    data.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: Number(reviews.average.toFixed(2)),
      reviewCount: reviews.count,
      bestRating: 5,
      worstRating: 1,
    };
  }

  return data;
}

/** The full JSON-LD document for a profile page, including the breadcrumb. */
export function providerProfileJsonLd(input: ProviderStructuredDataInput) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Tuveloz", item: "https://tuveloz.com" },
          { "@type": "ListItem", position: 2, name: "Providers", item: PROVIDER_PROFILE_BASE_URL },
          {
            "@type": "ListItem",
            position: 3,
            name: input.businessName,
            item: providerProfileUrl(input.slug),
          },
        ],
      },
      providerStructuredData(input),
    ],
  };
}
