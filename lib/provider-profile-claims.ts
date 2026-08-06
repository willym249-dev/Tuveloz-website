import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../db";
import { providerAuditEvents, providerGalleryItems } from "../db/schema";
import { sha256Text } from "./provider-policy-acceptance";
import type {
  ProviderProfileClaims,
  ProviderProfileGalleryClaim,
} from "./provider-written-claims";

// The prohibited-claim rules live in lib/provider-written-claims.ts, which
// stays free of database imports so the rules can be exercised directly in
// tests. This module keeps the review-fingerprint machinery that needs D1.
export {
  prohibitedProviderProfileClaims,
  prohibitedProviderWrittenClaims,
} from "./provider-written-claims";
export type {
  ProviderProfileClaims,
  ProviderProfileGalleryClaim,
} from "./provider-written-claims";

export const PROVIDER_PROFILE_REVIEW_EVENT = "provider_profile_content_reviewed";

function normalizedClaims(input: ProviderProfileClaims) {
  return {
    businessName: input.businessName.trim(),
    headline: input.headline.trim(),
    about: input.about.trim(),
    yearsExperience: input.yearsExperience.trim(),
    availabilityStatus: input.availabilityStatus.trim(),
    availabilityNote: input.availabilityNote.trim(),
    businessHours: input.businessHours.trim(),
    logoImageKey: input.logoImageKey?.trim() ?? "",
  };
}

export function providerProfileClaimsFingerprint(
  input: ProviderProfileClaims,
  gallery: readonly ProviderProfileGalleryClaim[] = [],
) {
  const normalizedGallery = gallery.map((item) => ({
    id: item.id,
    caption: item.caption.trim(),
    service: item.service.trim(),
    imageKey: item.imageKey?.trim() ?? "",
  })).sort((a, b) => a.id.localeCompare(b.id));
  return sha256Text(JSON.stringify({
    profile: normalizedClaims(input),
    gallery: normalizedGallery,
  }));
}

export async function providerProfileHasCurrentContentApproval(input: {
  id: string;
  providerId: string;
} & ProviderProfileClaims) {
  const db = getDb();
  const [reviews, gallery] = await Promise.all([
    db.select({
      outcome: providerAuditEvents.outcome,
      metadata: providerAuditEvents.metadata,
    }).from(providerAuditEvents).where(and(
      eq(providerAuditEvents.providerId, input.providerId),
      eq(providerAuditEvents.entityType, "provider_profile"),
      eq(providerAuditEvents.entityId, input.id),
      eq(providerAuditEvents.eventType, PROVIDER_PROFILE_REVIEW_EVENT),
    )).orderBy(desc(providerAuditEvents.occurredAt)).limit(1),
    db.select({
      id: providerGalleryItems.id,
      caption: providerGalleryItems.caption,
      service: providerGalleryItems.service,
      imageKey: providerGalleryItems.imageKey,
    }).from(providerGalleryItems)
      .where(eq(providerGalleryItems.providerId, input.providerId)),
  ]);
  const review = reviews[0];
  if (!review || review.outcome !== "approved") return false;

  try {
    const metadata = JSON.parse(review.metadata) as { contentFingerprint?: unknown };
    return metadata.contentFingerprint === await providerProfileClaimsFingerprint(input, gallery);
  } catch {
    return false;
  }
}
