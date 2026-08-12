import { and, asc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { providerApplications, providerProfiles } from "../../../db/schema";
import {
  parseProviderAreas,
  parseProviderServices,
  providerModeForWorkLocations,
} from "../../../lib/service-matching";
import { providerAccountFor } from "../../../lib/account-auth";
import { providerProfileHasCurrentContentApproval } from "../../../lib/provider-profile-claims";
import {
  providerCredentialRequirementsAreSatisfied,
  requiredProviderCredentialRequirements,
} from "../../../lib/provider-credentials";
import { providerCredentialVerifications } from "../../../db/schema";
import { parseProviderSelfAssessment } from "../../../lib/provider-compliance";
import { currentPlatformActiveServiceCodes } from "../../../lib/platform-service-activation";
import { POLICY_JURISDICTION } from "../../../lib/provider-policy";
import { marketplacePausedMessage } from "../../../lib/launch-status";
import { runtimeMarketplaceActionAllowed } from "../../../lib/runtime-marketplace-action";

/**
 * The public provider directory.
 *
 * Its job is to stop approved profiles being orphan pages — a profile reachable
 * only by direct link is invisible to a visitor and to a crawler alike, and a
 * sitemap entry is not a substitute for being linked to.
 *
 * It is gated on exactly the same "discovery" marketplace action as an
 * individual profile (app/api/public-provider/route.ts). A directory that
 * listed providers while discovery is closed would be a way around that
 * control, not a feature, so while the marketplace is in onboarding mode this
 * returns the paused response and no provider data of any kind.
 */
function marketplacePausedResponse() {
  return Response.json(
    {
      error: marketplacePausedMessage("discovery"),
      code: "MARKETPLACE_ONBOARDING_ONLY",
      providers: [],
    },
    {
      status: 503,
      headers: { "cache-control": "no-store", "retry-after": "86400" },
    },
  );
}

export async function GET() {
  if (!(await runtimeMarketplaceActionAllowed("discovery"))) {
    return marketplacePausedResponse();
  }

  const db = getDb();
  const rows = await db.select({
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
    .orderBy(asc(providerProfiles.businessName));

  const activeServiceCodes = await currentPlatformActiveServiceCodes(POLICY_JURISDICTION);

  // Every remaining condition from the single-profile gate, applied per row so
  // the directory can never list a provider whose own page would 404.
  const providers = [];
  for (const row of rows) {
    const publicServices = parseProviderServices(row.provider.approvedServices)
      .filter((code) => activeServiceCodes.has(code));
    if (publicServices.length === 0) continue;

    if (!await providerProfileHasCurrentContentApproval(row.profile)) continue;

    // The provider must still hold an account; an application row alone is not
    // a live provider.
    const account = await providerAccountFor(row.provider.email);
    if (account?.id !== row.provider.id) continue;

    const requirements = requiredProviderCredentialRequirements(
      row.provider.approvedServices,
      row.provider.serviceArea,
      parseProviderSelfAssessment(row.provider.providerSelfAssessment),
    );
    if (requirements.length > 0) {
      const records = await db.select().from(providerCredentialVerifications)
        .where(eq(providerCredentialVerifications.providerId, row.provider.id));
      if (!providerCredentialRequirementsAreSatisfied(requirements, records)) continue;
    }

    providers.push({
      slug: row.profile.slug,
      businessName: row.profile.businessName,
      headline: row.profile.headline,
      businessMunicipality: row.provider.businessMunicipality,
      workMode: providerModeForWorkLocations(row.provider.workLocations),
      areas: parseProviderAreas(row.provider.serviceArea),
      services: publicServices,
    });
  }

  return Response.json(
    { providers },
    { headers: { "cache-control": "public, max-age=300" } },
  );
}
