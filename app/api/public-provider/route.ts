import { and, desc, eq, sql } from "drizzle-orm";
import { getDb } from "../../../db";
import {
  customerRequests,
  jobReviews,
  providerApplications,
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
  const publicAccess = (
    result.profile.publicStatus === "published"
    && result.provider.status === "approved"
    && result.provider.verificationStatus === "verified"
    && result.provider.isTestProvider === "no"
  );
  const session = await getAccountSession(request);
  const previewProvider = session?.role === "provider"
    ? await providerAccountFor(session.email)
    : null;
  const privatePreview = previewProvider?.id === result.provider.id;
  if (!publicAccess && !privatePreview) {
    return Response.json({ error: "Provider page not found." }, { status: 404 });
  }
  if (publicAccess) {
    try {
      await db.update(providerProfiles).set({
        profileViewCount: sql`${providerProfiles.profileViewCount} + 1`,
      }).where(eq(providerProfiles.id, result.profile.id));
    } catch (error) {
      console.error("Unable to record provider profile view", error);
    }
  }

  const gallery = await db.select({
    id: providerGalleryItems.id,
    caption: providerGalleryItems.caption,
    service: providerGalleryItems.service,
  }).from(providerGalleryItems)
    .where(eq(providerGalleryItems.providerId, result.provider.id))
    .orderBy(desc(providerGalleryItems.createdAt));
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
    profile: {
      id: result.profile.id,
      businessName: result.profile.businessName,
      headline: result.profile.headline,
      about: result.profile.about,
      yearsExperience: result.profile.yearsExperience,
      availabilityStatus: result.profile.availabilityStatus,
      availabilityNote: result.profile.availabilityNote,
      businessHours: result.profile.businessHours,
      hasLogo: Boolean(result.profile.logoImageKey),
    },
    services: parseProviderServices(result.provider.approvedServices),
    areas: parseProviderAreas(result.provider.serviceArea),
    workLocations: parseProviderWorkLocations(result.provider.workLocations),
    businessMunicipality: result.provider.businessMunicipality,
    gallery,
    reviews,
    privatePreview: !publicAccess && privatePreview,
    testProvider: result.provider.isTestProvider === "yes",
    reviewSummary: { average, count: reviews.length },
    confidence: {
      completedJobs: Number(completedJobs?.count ?? 0),
    },
  }, {
    headers: {
      "cache-control": publicAccess ? "public, max-age=60" : "private, no-store",
    },
  });
}
