import { and, desc, eq, sql } from "drizzle-orm";
import { getDb } from "../db";
import {
  customerRequests,
  jobReviews,
  providerApplications,
  providerCredentialVerifications,
  providerProfiles,
  providerQuotes,
} from "../db/schema";
import { providerAccountFor } from "./account-auth";
import { isFoundingMember } from "./founding-cohort";
import { currentPlatformActiveServiceCodes } from "./platform-service-activation";
import { parseProviderSelfAssessment } from "./provider-compliance";
import {
  providerCredentialRecordIsCurrent,
  providerCredentialRequirementsAreSatisfied,
  requiredProviderCredentialRequirements,
} from "./provider-credentials";
import { providerProfileHasCurrentContentApproval } from "./provider-profile-claims";
import { POLICY_JURISDICTION } from "./provider-policy";
import { runtimeMarketplaceActionAllowed } from "./runtime-marketplace-action";
import { parseProviderAreas, parseProviderServices } from "./service-matching";

export type PublicProviderCredential = {
  requirementKey: string;
  label: string;
  jurisdiction: string;
  issuingAuthority: string;
  legalBasisUrl: string;
  officialLookupUrl: string;
  checkedAt: string;
  expiresAt: string;
};

export type ProviderPublicAccess = {
  publicAccess: boolean;
  currentPublicServices: string[];
  credentialRequirementsSatisfied: boolean;
  credentialRequirementCount: number;
  currentCredentials: PublicProviderCredential[];
};

/**
 * The single definition of "this provider page may be shown to the public".
 * Both the storefront API and the server-rendered page metadata read it, so a
 * profile can never be indexable while the API would refuse to serve it.
 */
export async function evaluateProviderPublicAccess(
  profile: typeof providerProfiles.$inferSelect,
  provider: typeof providerApplications.$inferSelect,
): Promise<ProviderPublicAccess> {
  const db = getDb();
  const credentialRequirements = requiredProviderCredentialRequirements(
    provider.approvedServices,
    provider.serviceArea,
    parseProviderSelfAssessment(provider.providerSelfAssessment),
  );
  const credentialRecords = credentialRequirements.length > 0
    ? await db.select().from(providerCredentialVerifications)
      .where(eq(providerCredentialVerifications.providerId, provider.id))
    : [];
  const credentialRequirementsSatisfied = providerCredentialRequirementsAreSatisfied(
    credentialRequirements,
    credentialRecords,
  );
  const currentCredentials = credentialRequirements.flatMap((requirement) => {
    const record = credentialRecords.find((candidate) => (
      candidate.requirementKey === requirement.key
      && providerCredentialRecordIsCurrent(candidate)
    ));
    return record ? [{
      requirementKey: requirement.key,
      label: requirement.publicLabel,
      jurisdiction: requirement.jurisdiction,
      issuingAuthority: requirement.issuingAuthority,
      legalBasisUrl: requirement.legalBasisUrl,
      officialLookupUrl: requirement.officialLookupUrl,
      checkedAt: record.checkedAt,
      expiresAt: record.expiresAt,
    }] : [];
  });
  const [currentProvider, activePlatformServiceCodes, profileContentApproved] = await Promise.all([
    providerAccountFor(provider.email),
    currentPlatformActiveServiceCodes(POLICY_JURISDICTION),
    profile.publicStatus === "published"
      ? providerProfileHasCurrentContentApproval(profile)
      : Promise.resolve(false),
  ]);
  const currentPublicServices = parseProviderServices(provider.approvedServices)
    .filter((serviceCode) => activePlatformServiceCodes.has(serviceCode));
  const publicAccess = (
    profile.publicStatus === "published"
    && profileContentApproved
    && provider.status === "approved"
    && provider.verificationStatus === "verified"
    && provider.isTestProvider === "no"
    && currentProvider?.id === provider.id
    && currentPublicServices.length > 0
    && credentialRequirementsSatisfied
  );
  return {
    publicAccess,
    currentPublicServices,
    credentialRequirementsSatisfied,
    credentialRequirementCount: credentialRequirements.length,
    currentCredentials,
  };
}

export type PublicProviderSummary = {
  slug: string;
  businessName: string;
  headline: string;
  about: string;
  businessMunicipality: string;
  services: string[];
  areas: string[];
  hasLogo: boolean;
  profileId: string;
  foundingProvider: boolean;
  reviewSummary: { average: number; count: number };
  reviews: Array<{
    id: string;
    customerDisplayName: string;
    service: string;
    rating: number;
    comment: string;
  }>;
  completedJobs: number;
  updatedAt: string;
};

/**
 * Public-only provider data for server-rendered metadata and structured data.
 * Returns null whenever the page is not publicly visible — a private draft,
 * an unapproved profile, or a paused marketplace — so nothing that customers
 * cannot reach can be indexed. Never increments the profile view counter;
 * view counting stays with the storefront API so a crawler or a metadata
 * render cannot inflate it.
 */
export async function publicProviderSummary(
  slug: string,
): Promise<PublicProviderSummary | null> {
  const trimmed = slug.trim().slice(0, 100);
  if (!trimmed) return null;
  if (!await runtimeMarketplaceActionAllowed("discovery")) return null;
  const db = getDb();
  const [result] = await db.select({
    profile: providerProfiles,
    provider: providerApplications,
  }).from(providerProfiles)
    .innerJoin(
      providerApplications,
      eq(providerApplications.id, providerProfiles.providerId),
    )
    .where(eq(providerProfiles.slug, trimmed))
    .limit(1);
  if (!result) return null;
  const access = await evaluateProviderPublicAccess(result.profile, result.provider);
  if (!access.publicAccess) return null;

  const reviews = await db.select({
    id: jobReviews.id,
    customerDisplayName: jobReviews.customerDisplayName,
    service: jobReviews.service,
    rating: jobReviews.rating,
    comment: jobReviews.comment,
  }).from(jobReviews)
    .where(and(
      eq(jobReviews.providerEmail, result.provider.email),
      eq(jobReviews.status, "published"),
    ))
    .orderBy(desc(jobReviews.createdAt));
  const [completedJobs] = await db.select({
    count: sql<number>`count(*)`,
  }).from(providerQuotes)
    .innerJoin(customerRequests, eq(customerRequests.id, providerQuotes.requestId))
    .where(and(
      eq(providerQuotes.providerEmail, result.provider.email),
      eq(providerQuotes.status, "accepted"),
      eq(customerRequests.status, "completed"),
      eq(customerRequests.isTestJob, "no"),
    ));
  const average = reviews.length
    ? Number((reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length).toFixed(1))
    : 0;

  return {
    slug: trimmed,
    businessName: result.profile.businessName,
    headline: result.profile.headline,
    about: result.profile.about,
    businessMunicipality: result.provider.businessMunicipality,
    services: access.currentPublicServices,
    areas: parseProviderAreas(result.provider.serviceArea),
    hasLogo: Boolean(result.profile.logoImageKey),
    profileId: result.profile.id,
    foundingProvider: isFoundingMember(result.provider.foundingRank),
    reviewSummary: { average, count: reviews.length },
    reviews,
    completedJobs: Number(completedJobs?.count ?? 0),
    updatedAt: result.profile.updatedAt || result.profile.createdAt || "",
  };
}

export type PublicProviderSitemapEntry = { slug: string; updatedAt: string };

/**
 * Slugs of every publicly visible provider page, for the sitemap. Applies the
 * same access rules as the page itself, so an unpublished or paused profile is
 * never advertised to crawlers.
 */
export async function publicProviderSitemapEntries(
  limit = 500,
): Promise<PublicProviderSitemapEntry[]> {
  if (!await runtimeMarketplaceActionAllowed("discovery")) return [];
  const db = getDb();
  const candidates = await db.select({
    profile: providerProfiles,
    provider: providerApplications,
  }).from(providerProfiles)
    .innerJoin(
      providerApplications,
      eq(providerApplications.id, providerProfiles.providerId),
    )
    .where(and(
      eq(providerProfiles.publicStatus, "published"),
      eq(providerApplications.status, "approved"),
      eq(providerApplications.verificationStatus, "verified"),
      eq(providerApplications.isTestProvider, "no"),
    ))
    .limit(Math.max(1, Math.min(limit, 1000)));

  const entries: PublicProviderSitemapEntry[] = [];
  for (const candidate of candidates) {
    if (!candidate.profile.slug) continue;
    const access = await evaluateProviderPublicAccess(candidate.profile, candidate.provider);
    if (!access.publicAccess) continue;
    entries.push({
      slug: candidate.profile.slug,
      updatedAt: candidate.profile.updatedAt || candidate.profile.createdAt || "",
    });
  }
  return entries;
}
