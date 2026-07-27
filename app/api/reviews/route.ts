import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "../../../db";
import { customerRequests, jobReviews, providerApplications, providerQuotes } from "../../../db/schema";

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
  return Response.json({
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
  const body = (await request.json()) as {
    token?: string;
    rating?: number;
    comment?: string;
  };
  const token = clean(body.token, 120);
  const rating = Number(body.rating);
  const comment = clean(body.comment, 800);
  if (!token) {
    return Response.json({ error: "Use your private request link to leave a review." }, { status: 403 });
  }
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return Response.json({ error: "Choose a rating from 1 to 5 stars." }, { status: 400 });
  }
  if (comment.length < 3) {
    return Response.json({ error: "Add a short comment about your experience." }, { status: 400 });
  }

  const db = getDb();
  const [job] = await db.select().from(customerRequests)
    .where(eq(customerRequests.accessToken, token)).limit(1);
  if (!job) {
    return Response.json({ error: "Private request link not found." }, { status: 404 });
  }
  if (job.status !== "completed") {
    return Response.json({ error: "Reviews are available after the job is completed." }, { status: 409 });
  }
  const [acceptedQuote] = await db.select({
    providerName: providerQuotes.providerName,
    providerEmail: providerQuotes.providerEmail,
  }).from(providerQuotes).where(and(
    eq(providerQuotes.requestId, job.id),
    eq(providerQuotes.status, "accepted"),
  )).limit(1);
  if (!acceptedQuote) {
    return Response.json({ error: "The selected provider could not be verified." }, { status: 409 });
  }
  const [existingReview] = await db.select({ id: jobReviews.id }).from(jobReviews)
    .where(eq(jobReviews.requestId, job.id)).limit(1);
  if (existingReview) {
    return Response.json({ error: "A review was already published for this job." }, { status: 409 });
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
      return Response.json({ error: "A review was already published for this job." }, { status: 409 });
    }
    throw error;
  }
  return Response.json({
    ok: true,
    review: {
      id: review.id,
      providerName: review.providerName,
      customerDisplayName: review.customerDisplayName,
      service: review.service,
      rating: review.rating,
      comment: review.comment,
    },
  }, { status: 201 });
}
