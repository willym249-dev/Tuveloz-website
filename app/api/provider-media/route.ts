import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import {
  providerApplications,
  providerGalleryItems,
  providerProfiles,
} from "../../../db/schema";
import { getProviderImage } from "../../../lib/provider-media";
import { getAccountSession, providerAccountFor } from "../../../lib/account-auth";

async function providerCanReadPrivateMedia(request: Request, providerId: string) {
  const session = await getAccountSession(request);
  if (!session || session.role !== "provider") return false;
  const provider = await providerAccountFor(session.email);
  return provider?.id === providerId;
}

async function providerIsPublic(providerId: string) {
  const [result] = await getDb().select({
    publicStatus: providerProfiles.publicStatus,
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
  return Boolean(
    result
    && result.publicStatus === "published"
    && result.status === "approved"
    && result.verificationStatus === "verified"
    && result.isTestProvider === "no",
  );
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
    return Response.json({ error: "Provider image not found." }, { status: 404 });
  }
  const publicAccess = await providerIsPublic(providerId);
  const privateAccess = publicAccess
    ? false
    : await providerCanReadPrivateMedia(request, providerId);
  if (!publicAccess && !privateAccess) {
    return Response.json(
      { error: "Provider image access required." },
      { status: 403, headers: { "cache-control": "no-store" } },
    );
  }
  const image = await getProviderImage(key);
  if (!image) {
    return Response.json({ error: "Provider image not found." }, { status: 404 });
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
