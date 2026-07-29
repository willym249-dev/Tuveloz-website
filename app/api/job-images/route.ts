import { and, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { customerRequests, providerApplications, providerQuotes } from "../../../db/schema";
import { getJobImage } from "../../../lib/job-images";
import { isOwnerRequest } from "../../../lib/owner-auth";
import {
  effectiveProviderServices,
  providerMatchesArea,
  providerMatchesJob,
  providerMatchesServiceLocation,
} from "../../../lib/service-matching";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const requestId = url.searchParams.get("requestId") ?? "";
  const kind = url.searchParams.get("kind");
  const token = url.searchParams.get("token") ?? "";
  if (!requestId || !["issue", "completion"].includes(kind ?? "")) {
    return Response.json({ error: "Image not found." }, { status: 404 });
  }

  const db = getDb();
  const [job] = await db.select().from(customerRequests)
    .where(eq(customerRequests.id, requestId)).limit(1);
  if (!job) return Response.json({ error: "Image not found." }, { status: 404 });

  let allowed = isOwnerRequest(request) || (Boolean(token) && token === job.accessToken);
  if (!allowed && token) {
    const [provider] = await db.select().from(providerApplications)
      .where(and(
        eq(providerApplications.accessToken, token),
        eq(providerApplications.status, "approved"),
      )).limit(1);
    const providerAccessIsActive = provider && (
      provider.isTestProvider === "yes"
      || (
        provider.verificationStatus === "verified"
      )
    );
    if (
      provider
      && providerAccessIsActive
      && (provider.isTestProvider === "yes") === (job.isTestJob === "yes")
    ) {
      const [acceptedQuote] = await db.select({ id: providerQuotes.id }).from(providerQuotes)
        .where(and(
          eq(providerQuotes.requestId, job.id),
          eq(providerQuotes.providerEmail, provider.email),
          eq(providerQuotes.status, "accepted"),
        )).limit(1);
      allowed = Boolean(acceptedQuote) || (
        kind === "issue"
        && job.status === "approved"
        && providerMatchesJob(
          effectiveProviderServices(provider.service, provider.approvedServices, provider.isTestProvider),
          job.service,
        )
        && providerMatchesArea(provider.serviceArea, job.launchArea || job.zip)
        && providerMatchesServiceLocation(provider.workLocations, job.serviceLocations)
      );
    }
  }
  if (!allowed) return Response.json({ error: "Private image access required." }, { status: 403 });

  const key = kind === "issue" ? job.issueImageKey : job.completionImageKey;
  const contentType = kind === "issue" ? job.issueImageType : job.completionImageType;
  if (!key) return Response.json({ error: "Image not found." }, { status: 404 });
  const image = await getJobImage(key);
  if (!image) return Response.json({ error: "Image not found." }, { status: 404 });

  return new Response(image.body, {
    headers: {
      "cache-control": "private, no-store",
      "content-type": image.httpMetadata?.contentType || contentType || "application/octet-stream",
      "content-disposition": "inline",
      "x-content-type-options": "nosniff",
    },
  });
}
