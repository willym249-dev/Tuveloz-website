import { and, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { customerRequests, providerQuotes } from "../../../db/schema";
import { getAccountSession, providerAccountFor } from "../../../lib/account-auth";
import { parseExactServiceCodes } from "../../../lib/customer-job-scope";
import { getJobImage } from "../../../lib/job-images";
import { isVerifiedOwnerRequest } from "../../../lib/owner-auth";
import { currentPlatformActiveServiceCodes } from "../../../lib/platform-service-activation";
import { POLICY_JURISDICTION } from "../../../lib/provider-policy";
import { runtimeMarketplaceActionAllowed } from "../../../lib/runtime-marketplace-action";
import {
  parseProviderServices,
  providerMatchesArea,
  providerMatchesServiceLocation,
} from "../../../lib/service-matching";

const NO_STORE_HEADERS = { "cache-control": "private, no-store" };

function privateError(error: string, status: number) {
  return Response.json({ error }, { status, headers: NO_STORE_HEADERS });
}

async function providerCanDiscoverIssue(
  provider: NonNullable<Awaited<ReturnType<typeof providerAccountFor>>>,
  job: typeof customerRequests.$inferSelect,
) {
  try {
    if (!(await runtimeMarketplaceActionAllowed("discovery"))) return false;
    const serviceCodes = parseExactServiceCodes(job.serviceCodes);
    if (
      job.jurisdiction !== POLICY_JURISDICTION
      || serviceCodes.length !== 1
      || !parseProviderServices(provider.approvedServices).includes(serviceCodes[0])
    ) {
      return false;
    }
    const activeServiceCodes = await currentPlatformActiveServiceCodes(
      job.jurisdiction,
    );
    return activeServiceCodes.has(serviceCodes[0])
      && providerMatchesArea(provider.serviceArea, job.launchArea || job.zip)
      && providerMatchesServiceLocation(provider.workLocations, job.serviceLocations);
  } catch {
    return false;
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const requestId = url.searchParams.get("requestId") ?? "";
  const kind = url.searchParams.get("kind");
  const token = url.searchParams.get("token") ?? "";
  if (!requestId || !["issue", "completion"].includes(kind ?? "")) {
    return privateError("Image not found.", 404);
  }

  const db = getDb();
  const [job] = await db.select().from(customerRequests)
    .where(eq(customerRequests.id, requestId)).limit(1);
  if (!job) return privateError("Image not found.", 404);

  const session = await getAccountSession(request);
  let allowed = Boolean(token) && token === job.accessToken;
  if (
    !allowed
    && session?.role === "customer"
    && session.email.toLowerCase() === job.email.toLowerCase()
  ) {
    allowed = true;
  }
  if (!allowed && session?.role === "provider") {
    const provider = await providerAccountFor(session.email);
    if (provider && job.isTestJob !== "yes") {
      const [acceptedQuote] = await db.select({ id: providerQuotes.id }).from(providerQuotes)
        .where(and(
          eq(providerQuotes.requestId, job.id),
          eq(providerQuotes.providerEmail, provider.email),
          eq(providerQuotes.status, "accepted"),
        )).limit(1);
      allowed = Boolean(acceptedQuote);
      if (
        !allowed
        && kind === "issue"
        && job.status === "approved"
      ) {
        allowed = await providerCanDiscoverIssue(provider, job);
      }
    }
  }
  if (!allowed) {
    allowed = await isVerifiedOwnerRequest(request);
  }
  if (!allowed) return privateError("Private image access required.", 403);

  const key = kind === "issue" ? job.issueImageKey : job.completionImageKey;
  const contentType = kind === "issue" ? job.issueImageType : job.completionImageType;
  if (!key) return privateError("Image not found.", 404);
  const image = await getJobImage(key);
  if (!image) return privateError("Image not found.", 404);

  return new Response(image.body, {
    headers: {
      "cache-control": "private, no-store",
      "content-type": image.httpMetadata?.contentType || contentType || "application/octet-stream",
      "content-disposition": "inline",
      "x-content-type-options": "nosniff",
    },
  });
}
