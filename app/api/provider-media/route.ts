import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import {
  providerApplications,
  providerGalleryItems,
  providerProfiles,
} from "../../../db/schema";
import { getProviderImage } from "../../../lib/provider-media";
import { getAccountSession, providerAccountFor } from "../../../lib/account-auth";
import { currentPlatformActiveServiceCodes } from "../../../lib/platform-service-activation";
import { POLICY_JURISDICTION } from "../../../lib/provider-policy";
import { runtimeMarketplaceActionAllowed } from "../../../lib/runtime-marketplace-action";
import { parseProviderServices } from "../../../lib/service-matching";

const NO_STORE_HEADERS = { "cache-control": "no-store" };

function privateError(error: string, status: number) {
  return Response.json({ error }, { status, headers: NO_STORE_HEADERS });
}

async function providerCanReadPrivateMedia(request: Request, providerId: string) {
  try {
    const session = await getAccountSession(request);
    if (!session || session.role !== "provider") return false;
    const provider = await providerAccountFor(session.email);
    return provider?.id === providerId;
  } catch {
    return false;
  }
}

async function providerIsPublic(providerId: string) {
  try {
    if (!(await runtimeMarketplaceActionAllowed("discovery"))) return false;
    const activeServiceCodes = await currentPlatformActiveServiceCodes(
      POLICY_JURISDICTION,
    );
    if (activeServiceCodes.size === 0) return false;
    const [result] = await getDb().select({
      publicStatus: providerProfiles.publicStatus,
      email: providerApplications.email,
      status: providerApplications.status,
      verificationStatus: providerApplications.verificationStatus,
      isTestProvider: providerApplications.isTestProvider,
    }).from(providerProfiles)
      .innerJoin(
        providerApplications,
        eq(providerApplications.id, providerProfiles.providerId),
      )
      .where(eq(providerProfiles.providerId, providerId))
      .limit(1);
    if (
      !result
      || result.publicStatus !== "published"
      || result.status !== "approved"
      || result.verificationStatus !== "verified"
      || result.isTestProvider !== "no"
    ) {
      return false;
    }
    const currentProvider = await providerAccountFor(result.email);
    return currentProvider?.id === providerId
      && parseProviderServices(currentProvider.approvedServices)
        .some((serviceCode) => activeServiceCodes.has(serviceCode));
  } catch {
    return false;
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const galleryId = url.searchParams.get("galleryId") ?? "";
  const profileId = url.searchParams.get("profileId") ?? "";
  let providerId = "";
  let key = "";
  let contentType = "";

  if (galleryId) {
    const [item] = await getDb().select().from(providerGalleryItems)
      .where(eq(providerGalleryItems.id, galleryId))
      .limit(1);
    if (item) {
      providerId = item.providerId;
      key = item.imageKey;
      contentType = item.imageType;
    }
  } else if (profileId) {
    const [profile] = await getDb().select().from(providerProfiles)
      .where(eq(providerProfiles.id, profileId))
      .limit(1);
    if (profile) {
      providerId = profile.providerId;
      key = profile.logoImageKey;
      contentType = profile.logoImageType;
    }
  }

  if (!providerId || !key) {
    return privateError("Provider image not found.", 404);
  }
  const privateAccess = await providerCanReadPrivateMedia(request, providerId);
  const publicAccess = privateAccess ? false : await providerIsPublic(providerId);
  if (!publicAccess && !privateAccess) {
    return privateError("Provider image access required.", 403);
  }
  const image = await getProviderImage(key);
  if (!image) {
    return privateError("Provider image not found.", 404);
  }
  return new Response(image.body, {
    headers: {
      "cache-control": publicAccess ? "public, max-age=300" : "private, no-store",
      "content-type": image.httpMetadata?.contentType || contentType || "application/octet-stream",
      "content-disposition": "inline",
      "x-content-type-options": "nosniff",
    },
  });
}
