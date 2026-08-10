import { and, eq } from "drizzle-orm";
import { getDb } from "../db";
import {
  providerApplications,
  providerCredentialVerifications,
  providerProfiles,
} from "../db/schema";
import { providerAccountFor } from "./account-auth";
import { currentPlatformActiveServiceCodes } from "./platform-service-activation";
import {
  providerCredentialRequirementsAreSatisfied,
  requiredProviderCredentialRequirements,
} from "./provider-credentials";
import { parseProviderAreas, parseProviderServices } from "./service-matching";
import { parseProviderSelfAssessment } from "./provider-compliance";
import { providerProfileHasCurrentContentApproval } from "./provider-profile-claims";
import { POLICY_JURISDICTION } from "./provider-policy";
import { runtimeMarketplaceActionAllowed } from "./runtime-marketplace-action";

/**
 * Publicly indexable provider profiles.
 *
 * `app/api/public-provider/route.ts` remains the authoritative gate for
 * serving a profile; this module answers the narrower question of which
 * profiles a crawler may be told about. It applies the same conditions, and
 * short-circuits on the discovery action, so while the marketplace is in
 * onboarding-only mode there is nothing to list at all — a sitemap entry or a
 * structured-data block for a profile the API would refuse to serve is both a
 * dead link and a disclosure the pause is meant to prevent.
 *
 * These conditions must stay in step with `publicAccess` in that route. Widen
 * that gate and this list stays narrower; nothing here can make a private
 * profile public on its own.
 */

export type PublicProviderDirectoryEntry = {
  slug: string;
  businessName: string;
  headline: string;
  about: string;
  businessMunicipality: string;
  services: string[];
  areas: string[];
  updatedAt: string;
};

type ProfileRow = typeof providerProfiles.$inferSelect;
type ProviderRow = typeof providerApplications.$inferSelect;

function credentialRecordsFor(providerId: string) {
  return getDb().select().from(providerCredentialVerifications)
    .where(eq(providerCredentialVerifications.providerId, providerId));
}

async function visibleEntryFor(
  profile: ProfileRow,
  provider: ProviderRow,
  activeServiceCodes: Set<string>,
): Promise<PublicProviderDirectoryEntry | null> {
  if (
    profile.publicStatus !== "published"
    || provider.status !== "approved"
    || provider.verificationStatus !== "verified"
    || provider.isTestProvider !== "no"
  ) {
    return null;
  }

  const services = parseProviderServices(provider.approvedServices)
    .filter((serviceCode) => activeServiceCodes.has(serviceCode));
  if (services.length === 0) return null;

  const currentProvider = await providerAccountFor(provider.email);
  if (currentProvider?.id !== provider.id) return null;

  const credentialRequirements = requiredProviderCredentialRequirements(
    provider.approvedServices,
    provider.serviceArea,
    parseProviderSelfAssessment(provider.providerSelfAssessment),
  );
  if (credentialRequirements.length > 0) {
    const satisfied = providerCredentialRequirementsAreSatisfied(
      credentialRequirements,
      await credentialRecordsFor(provider.id),
    );
    if (!satisfied) return null;
  }

  if (!await providerProfileHasCurrentContentApproval(profile)) return null;

  return {
    slug: profile.slug,
    businessName: profile.businessName,
    headline: profile.headline,
    about: profile.about,
    businessMunicipality: provider.businessMunicipality,
    services,
    areas: parseProviderAreas(provider.serviceArea),
    updatedAt: profile.updatedAt,
  };
}

async function publishedRows(slug?: string) {
  const db = getDb();
  const published = eq(providerProfiles.publicStatus, "published");
  return db.select({
    profile: providerProfiles,
    provider: providerApplications,
  }).from(providerProfiles)
    .innerJoin(
      providerApplications,
      eq(providerApplications.id, providerProfiles.providerId),
    )
    .where(slug ? and(published, eq(providerProfiles.slug, slug)) : published);
}

/** Every provider profile a crawler may index, or [] while discovery is paused. */
export async function publicProviderDirectory(): Promise<PublicProviderDirectoryEntry[]> {
  if (!await runtimeMarketplaceActionAllowed("discovery")) return [];

  const [rows, activeServiceCodes] = await Promise.all([
    publishedRows(),
    currentPlatformActiveServiceCodes(POLICY_JURISDICTION),
  ]);
  const entries = await Promise.all(
    rows.map(({ profile, provider }) =>
      visibleEntryFor(profile, provider, activeServiceCodes)),
  );
  return entries.filter((entry): entry is PublicProviderDirectoryEntry => entry !== null);
}

/** One indexable provider profile, or null when it is not public today. */
export async function publicProviderDirectoryEntry(
  slug: string,
): Promise<PublicProviderDirectoryEntry | null> {
  const trimmed = slug.trim().slice(0, 100);
  if (!trimmed) return null;
  if (!await runtimeMarketplaceActionAllowed("discovery")) return null;

  const [rows, activeServiceCodes] = await Promise.all([
    publishedRows(trimmed),
    currentPlatformActiveServiceCodes(POLICY_JURISDICTION),
  ]);
  const row = rows[0];
  if (!row) return null;
  return visibleEntryFor(row.profile, row.provider, activeServiceCodes);
}
