import { env } from "cloudflare:workers";
import { and, desc, eq, sql } from "drizzle-orm";
import { getDb } from "../../../db";
import {
  customerRequests,
  jobReviews,
  providerApplications,
  providerCredentialVerifications,
  providerGalleryItems,
  providerProfiles,
  providerQuotes,
} from "../../../db/schema";
import {
  parseProviderAreas,
  parseProviderServices,
  parseProviderWorkLocations,
} from "../../../lib/service-matching";
import { getAccountSession, providerAccountFor } from "../../../lib/account-auth";
import { parseProviderSelfAssessment } from "../../../lib/provider-compliance";
import { isFoundingMember } from "../../../lib/founding-cohort";
import {
  providerCredentialRecordIsCurrent,
  providerCredentialRequirementsAreSatisfied,
  requiredProviderCredentialRequirements,
} from "../../../lib/provider-credentials";
import {
  marketplacePausedMessage,
} from "../../../lib/launch-status";
import { runtimeMarketplaceActionAllowed } from "../../../lib/runtime-marketplace-action";
import { currentPlatformActiveServiceCodes } from "../../../lib/platform-service-activation";
import { POLICY_JURISDICTION } from "../../../lib/provider-policy";
import { providerProfileHasCurrentContentApproval } from "../../../lib/provider-profile-claims";

function marketplacePausedResponse() {
  return Response.json(
    {
      error: marketplacePausedMessage("discovery"),
      code: "MARKETPLACE_ONBOARDING_ONLY",
    },
    {
      status: 503,
      headers: { "cache-control": "no-store", "retry-after": "86400" },
    },
  );
}

type CatalogRow = {
  id: string;
  service: string;
  priceType: string;
  startingPriceCents: number;
  maximumPriceCents: number;
  description: string;
  durationMinutes: number;
};

type OptionalCredentialRow = {
  id: string;
  credentialName: string;
  issuingAuthority: string;
  jurisdiction: string;
  expiresAt: string;
  reviewNote: string;
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const slug = url.searchParams.get("slug")?.trim().slice(0, 100) ?? "";
  if (!slug) {
    return Response.json({ error: "Provider page not found." }, { status: 404 });
  }
  const db = getDb();
  const [result] = await db.select({
    profile: providerProfiles,
    provider: providerApplications,
  }).from(providerProfiles)
    .innerJoin(
      providerApplications,
      eq(providerApplications.id, providerProfiles.providerId),
    )
    .where(eq(providerProfiles.slug, slug))
    .limit(1);
  if (!result) {
    return Response.json({ error: "Provider page not found." }, { status: 404 });
  }
  const credentialRequirements = requiredProviderCredentialRequirements(
    result.provider.approvedServices,
    result.provider.serviceArea,
    parseProviderSelfAssessment(result.provider.providerSelfAssessment),
  );
  const credentialRecords = credentialRequirements.length > 0
    ? await db.select().from(providerCredentialVerifications)
      .where(eq(providerCredentialVerifications.providerId, result.provider.id))
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
  const currentProvider = await providerAccountFor(result.provider.email);
  const activePlatformServiceCodes = await currentPlatformActiveServiceCodes(
    POLICY_JURISDICTION,
  );
  const currentPublicServices = parseProviderServices(result.provider.approvedServices)
    .filter((serviceCode) => activePlatformServiceCodes.has(serviceCode));
  const currentProfileContentApproved = result.profile.publicStatus === "published"
    && await providerProfileHasCurrentContentApproval(result.profile);
  const publicAccess = (
    result.profile.publicStatus === "published"
    && currentProfileContentApproved
    && result.provider.status === "approved"
    && result.provider.verificationStatus === "verified"
    && result.provider.isTestProvider === "no"
    && currentProvider?.id === result.provider.id
    && currentPublicServices.length > 0
    && credentialRequirementsSatisfied
  );
  const session = await getAccountSession(request);
  const previewProvider = session?.role === "provider"
    ? await providerAccountFor(session.email)
    : null;
  const privatePreview = previewProvider?.id === result.provider.id;
  if (!publicAccess && !privatePreview) {
    return Response.json({ error: "Provider page not found." }, { status: 404 });
  }
  const publicDiscoveryAllowed = await runtimeMarketplaceActionAllowed("discovery");
  if (!privatePreview && !publicDiscoveryAllowed) {
    return marketplacePausedResponse();
  }
  const servingPublicProfile = publicAccess && publicDiscoveryAllowed;
  if (servingPublicProfile) {
    try {
      await db.update(providerProfiles).set({
        profileViewCount: sql`${providerProfiles.profileViewCount} + 1`,
      }).where(eq(providerProfiles.id, result.profile.id));
    } catch (error) {
      console.error("Unable to record provider profile view", error);
    }
  }

  const [gallery, reviews, catalogResult, optionalCredentialResult] = await Promise.all([
    db.select({
      id: providerGalleryItems.id,
      caption: providerGalleryItems.caption,
      service: providerGalleryItems.service,
    }).from(providerGalleryItems)
      .where(eq(providerGalleryItems.providerId, result.provider.id))
      .orderBy(desc(providerGalleryItems.createdAt)),
    db.select({
      id: jobReviews.id,
      customerDisplayName: jobReviews.customerDisplayName,
      service: jobReviews.service,
      rating: jobReviews.rating,
      comment: jobReviews.comment,
      providerReply: jobReviews.providerReply,
    }).from(jobReviews)
      .where(and(
        eq(jobReviews.providerEmail, result.provider.email),
        eq(jobReviews.status, "published"),
      ))
      .orderBy(desc(jobReviews.createdAt)),
    env.DB.prepare(
      `SELECT id, service, price_type AS priceType,
              starting_price_cents AS startingPriceCents,
              maximum_price_cents AS maximumPriceCents,
              description, duration_minutes AS durationMinutes
         FROM provider_catalog_items
        WHERE provider_id = ? AND active = 'yes'
        ORDER BY service ASC`,
    ).bind(result.provider.id).all<CatalogRow>(),
    env.DB.prepare(
      `SELECT id, credential_name AS credentialName,
              issuing_authority AS issuingAuthority,
              jurisdiction, expires_at AS expiresAt,
              review_note AS reviewNote
         FROM provider_submitted_credentials
        WHERE provider_id = ?
          AND status = 'verified'
          AND public_display = 'yes'
        ORDER BY credential_name ASC`,
    ).bind(result.provider.id).all<OptionalCredentialRow>(),
  ]);
  const average = reviews.length
    ? Number((reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length).toFixed(1))
    : 0;
  const [completedJobs] = await db.select({
    count: sql<number>`count(*)`,
  }).from(providerQuotes)
    .innerJoin(
      customerRequests,
      eq(customerRequests.id, providerQuotes.requestId),
    )
    .where(and(
      eq(providerQuotes.providerEmail, result.provider.email),
      eq(providerQuotes.status, "accepted"),
      eq(customerRequests.status, "completed"),
      eq(
        customerRequests.isTestJob,
        result.provider.isTestProvider === "yes" ? "yes" : "no",
      ),
    ));

  return Response.json({
    providerId: result.provider.id,
    profile: {
      id: result.profile.id,
      businessName: result.profile.businessName,
      headline: result.profile.headline,
      about: result.profile.about,
      yearsExperience: result.profile.yearsExperience,
      availabilityStatus: result.profile.availabilityStatus,
      availabilityNote: result.profile.availabilityNote,
      businessHours: result.profile.businessHours,
      customerSuppliedPartsPolicy: result.profile.customerSuppliedPartsPolicy,
      hasLogo: Boolean(result.profile.logoImageKey),
    },
    services: servingPublicProfile
      ? currentPublicServices
      : parseProviderServices(result.provider.approvedServices),
    catalog: servingPublicProfile
      ? catalogResult.results.filter((item) => activePlatformServiceCodes.has(item.service))
      : catalogResult.results,
    optionalCredentials: optionalCredentialResult.results,
    areas: parseProviderAreas(result.provider.serviceArea),
    workLocations: parseProviderWorkLocations(result.provider.workLocations),
    businessMunicipality: result.provider.businessMunicipality,
    gallery,
    reviews,
    privatePreview: privatePreview && !servingPublicProfile,
    testProvider: result.provider.isTestProvider === "yes",
    // Tenure only — states when they joined, never a quality signal. The rank
    // itself stays server-side; the page needs only the fact of membership.
    foundingProvider: isFoundingMember(result.provider.foundingRank),
    reviewSummary: { average, count: reviews.length },
    credentialReview: {
      requirementsSatisfied: credentialRequirementsSatisfied,
      noGovernmentCredentialTriggered: credentialRequirements.length === 0,
      credentials: currentCredentials,
    },
    confidence: {
      completedJobs: Number(completedJobs?.count ?? 0),
    },
  }, {
    headers: {
      "cache-control": servingPublicProfile
        ? "public, max-age=0, must-revalidate"
        : "private, no-store",
    },
  });
}
