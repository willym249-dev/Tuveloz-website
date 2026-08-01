import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../db";
import { providerAuditEvents, providerGalleryItems } from "../db/schema";
import { sha256Text } from "./provider-policy-acceptance";

export const PROVIDER_PROFILE_REVIEW_EVENT = "provider_profile_content_reviewed";

export type ProviderProfileClaims = {
  businessName: string;
  headline: string;
  about: string;
  yearsExperience: string;
  availabilityStatus: string;
  availabilityNote: string;
  businessHours: string;
  logoImageKey?: string;
};

export type ProviderProfileGalleryClaim = {
  id: string;
  caption: string;
  service: string;
  imageKey?: string;
};

type ProhibitedClaimRule = {
  label: string;
  pattern: RegExp;
};

// These are claims that must come from scoped TUVELOZ records or an approved
// guarantee program, not from provider-authored advertising copy. Provider
// credentials can still be displayed through the dated credential-record UI.
const PROHIBITED_PROVIDER_PROFILE_CLAIMS: readonly ProhibitedClaimRule[] = [
  { label: "TUVELOZ approval or verification", pattern: /\b(?:tuveloz\s+)?(?:approved|verified|vetted)\b/i },
  { label: "licensing claim", pattern: /\blicen[cs](?:e|ed|ing|ure)\b/i },
  { label: "insurance claim", pattern: /\b(?:fully\s+)?insured\b/i },
  { label: "background-screening claim", pattern: /\bbackground[-\s]?check(?:ed)?\b/i },
  { label: "certification claim", pattern: /\bcertif(?:ied|ication)\b/i },
  { label: "guarantee or warranty claim", pattern: /\b(?:guarantee(?:d)?|warrant(?:y|ied))\b/i },
  { label: "absolute safety claim", pattern: /\b(?:completely|fully|100\s*%)\s+safe\b/i },
] as const;

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

export function prohibitedProviderWrittenClaims(values: readonly string[]) {
  const claimsText = values.join("\n");
  return PROHIBITED_PROVIDER_PROFILE_CLAIMS
    .filter((rule) => rule.pattern.test(claimsText))
    .map((rule) => rule.label);
}

export function prohibitedProviderProfileClaims(input: ProviderProfileClaims) {
  // A registered business name is retained as an identity fact. The provider's
  // descriptive and promotional fields are the fields screened as claims.
  return prohibitedProviderWrittenClaims([
    input.headline,
    input.about,
    input.yearsExperience,
    input.availabilityNote,
    input.businessHours,
  ]);
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
