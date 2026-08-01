import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "../../../db";
import { customerRequests, jobReviews, providerApplications, providerQuotes } from "../../../db/schema";
import { marketplacePausedMessage } from "../../../lib/launch-status";
import { runtimeMarketplaceActionAllowed } from "../../../lib/runtime-marketplace-action";

const NO_STORE_HEADERS = { "cache-control": "no-store" };

function noStoreJson(body: unknown, status = 200) {
  return Response.json(body, { status, headers: NO_STORE_HEADERS });
}

async function publicReviewsAreAvailable() {
  try {
    return await runtimeMarketplaceActionAllowed("discovery");
  } catch {
    return false;
  }
}

function marketplacePausedResponse() {
  return noStoreJson({
    error: marketplacePausedMessage("discovery"),
    code: "MARKETPLACE_ONBOARDING_ONLY",
    reviews: [],
    summary: { average: 0, count: 0 },
  }, 503);
}

function clean(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function publicCustomerName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Verified customer";
  if (parts.length === 1) return parts[0].slice(0, 40);
  return `${parts[0].slice(0, 30)} ${parts.at(-1)?.charAt(0).toUpperCase()}.`;
}

export async function GET() {
  if (!(await publicReviewsAreAvailable())) {
    return marketplacePausedResponse();
  }
  const publishedReviews = await getDb().select({
    id: jobReviews.id,
    providerName: jobReviews.providerName,
    providerEmail: jobReviews.providerEmail,
    customerDisplayName: jobReviews.customerDisplayName,
    service: jobReviews.service,
    rating: jobReviews.rating,
    comment: jobReviews.comment,
    createdAt: jobReviews.createdAt,
  }).from(jobReviews)
    .where(eq(jobReviews.status, "published"))
    .orderBy(desc(jobReviews.createdAt));

  const providerEmails = [...new Set(publishedReviews.map((review) => review.providerEmail))]
    .filter(Boolean);
  const providerVerifications = providerEmails.length > 0
      ? await getDb().select({
        email: providerApplications.email,
        verificationStatus: providerApplications.verificationStatus,
        isTestProvider: providerApplications.isTestProvider,
      }).from(providerApplications)
        .where(inArray(providerApplications.email, providerEmails))
    : [];
  const verifiedProviderEmails = new Set(
    providerVerifications
      .filter((provider) => (
        provider.verificationStatus === "verified"
        && provider.isTestProvider === "no"
      ))
      .map((provider) => provider.email),
  );
  const testProviderEmails = new Set(
    providerVerifications
      .filter((provider) => provider.isTestProvider === "yes")
      .map((provider) => provider.email),
  );
  const publicReviews = publishedReviews.filter(
    (review) => !testProviderEmails.has(review.providerEmail),
  );
  return noStoreJson({
    reviews: publicReviews.slice(0, 12).map((review) => {
      const { providerEmail, ...publicReview } = review;
      return {
        ...publicReview,
        providerVerified: verifiedProviderEmails.has(providerEmail),
      };
    }),
    summary: {
      average: Number((
        publicReviews.length
          ? publicReviews.reduce((sum, review) => sum + review.rating, 0) / publicReviews.length
          : 0
      ).toFixed(1)),
      count: publicReviews.length,
    },
  });
}

export async function POST(request: Request) {
  if (!(await publicReviewsAreAvailable())) {
    return marketplacePausedResponse();
  }
  const body = (await request.json()) as {
    token?: string;
    rating?: number;
    comment?: string;
  };
  const token = clean(body.token, 120);
  const rating = Number(body.rating);
  const comment = clean(body.comment, 800);
  if (!token) {
    return noStoreJson({ error: "Use your private request link to leave a review." }, 403);
  }
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return noStoreJson({ error: "Choose a rating from 1 to 5 stars." }, 400);
  }
  if (comment.length < 3) {
    return noStoreJson({ error: "Add a short comment about your experience." }, 400);
  }

  const db = getDb();
  const [job] = await db.select().from(customerRequests)
    .where(eq(customerRequests.accessToken, token)).limit(1);
  if (!job) {
    return noStoreJson({ error: "Private request link not found." }, 404);
  }
  if (job.status !== "completed") {
    return noStoreJson({ error: "Reviews are available after the job is completed." }, 409);
  }
  const [acceptedQuote] = await db.select({
    providerName: providerQuotes.providerName,
    providerEmail: providerQuotes.providerEmail,
  }).from(providerQuotes).where(and(
    eq(providerQuotes.requestId, job.id),
    eq(providerQuotes.status, "accepted"),
  )).limit(1);
  if (!acceptedQuote) {
    return noStoreJson({ error: "The selected provider could not be verified." }, 409);
  }
  const [existingReview] = await db.select({ id: jobReviews.id }).from(jobReviews)
    .where(eq(jobReviews.requestId, job.id)).limit(1);
  if (existingReview) {
    return noStoreJson({ error: "A review was already published for this job." }, 409);
  }

  const review = {
    id: crypto.randomUUID(),
    requestId: job.id,
    providerName: acceptedQuote.providerName,
    providerEmail: acceptedQuote.providerEmail,
    customerDisplayName: publicCustomerName(job.name),
    service: job.service,
    rating,
    comment,
    status: job.isTestJob === "yes" ? "test" : "published",
  };
  try {
    await db.insert(jobReviews).values(review);
  } catch (error) {
    const [duplicate] = await db.select({ id: jobReviews.id }).from(jobReviews)
      .where(eq(jobReviews.requestId, job.id)).limit(1);
    if (duplicate) {
      return noStoreJson({ error: "A review was already published for this job." }, 409);
    }
    throw error;
  }
  return noStoreJson({
    ok: true,
    review: {
      id: review.id,
      providerName: review.providerName,
      customerDisplayName: review.customerDisplayName,
      service: review.service,
      rating: review.rating,
      comment: review.comment,
    },
  }, 201);
}
