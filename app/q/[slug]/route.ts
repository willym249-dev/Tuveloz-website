import { and, eq, sql } from "drizzle-orm";
import { getDb } from "../../../db";
import { providerApplications, providerProfiles } from "../../../db/schema";

function redirectToProvider(request: Request, slug: string) {
  const destination = new URL(`/providers/${encodeURIComponent(slug)}`, request.url);
  destination.searchParams.set("source", "qr");
  return new Response(null, {
    status: 302,
    headers: {
      "cache-control": "no-store",
      location: destination.toString(),
    },
  });
}

export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug: rawSlug } = await context.params;
  const slug = rawSlug.trim().slice(0, 100);
  if (!slug) return redirectToProvider(request, "");

  const db = getDb();
  const [provider] = await db.select({
    profileId: providerProfiles.id,
  }).from(providerProfiles)
    .innerJoin(
      providerApplications,
      eq(providerApplications.id, providerProfiles.providerId),
    )
    .where(and(
      eq(providerProfiles.slug, slug),
      eq(providerProfiles.publicStatus, "published"),
      eq(providerApplications.status, "approved"),
      eq(providerApplications.verificationStatus, "verified"),
      eq(providerApplications.isTestProvider, "no"),
    ))
    .limit(1);

  if (provider) {
    try {
      await db.update(providerProfiles).set({
        qrScanCount: sql`${providerProfiles.qrScanCount} + 1`,
      }).where(eq(providerProfiles.id, provider.profileId));
    } catch (error) {
      console.error("Unable to record provider QR scan", error);
    }
  }

  return redirectToProvider(request, slug);
}
