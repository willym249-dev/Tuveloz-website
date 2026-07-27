import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "../../../db";
import { customerRequests, jobReviews, providerApplications, providerQuotes } from "../../../db/schema";
import { sendAcceptedQuoteAlert } from "../../../lib/provider-alerts";
import {
  effectiveProviderServices,
  providerMatchesArea,
  providerMatchesJob,
  providerMatchesServiceLocation,
} from "../../../lib/service-matching";
import { QUOTE_DECLINE_REASON_VALUES } from "../../../lib/quote-feedback";

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const [job] = await getDb().select().from(customerRequests)
    .where(eq(customerRequests.accessToken, token)).limit(1);
  if (!job || !token) return Response.json({ error: "Private request link not found." }, { status: 404 });
  const quotes = await getDb().select().from(providerQuotes)
    .where(eq(providerQuotes.requestId, job.id)).orderBy(desc(providerQuotes.createdAt));
  const [review] = await getDb().select({
    id: jobReviews.id,
    providerName: jobReviews.providerName,
    customerDisplayName: jobReviews.customerDisplayName,
    service: jobReviews.service,
    rating: jobReviews.rating,
    comment: jobReviews.comment,
    createdAt: jobReviews.createdAt,
  }).from(jobReviews).where(eq(jobReviews.requestId, job.id)).limit(1);
  const providerEmails = [...new Set(quotes.map((quote) => quote.providerEmail))];
  const providerReviews = providerEmails.length > 0
    ? await getDb().select({
        providerEmail: jobReviews.providerEmail,
        rating: jobReviews.rating,
      }).from(jobReviews).where(and(
        eq(jobReviews.status, "published"),
        inArray(jobReviews.providerEmail, providerEmails),
      ))
    : [];
  const providerVerifications = providerEmails.length > 0
      ? await getDb().select({
        email: providerApplications.email,
        status: providerApplications.status,
        verificationStatus: providerApplications.verificationStatus,
        isTestProvider: providerApplications.isTestProvider,
        workLocations: providerApplications.workLocations,
        businessMunicipality: providerApplications.businessMunicipality,
        businessServiceAddress: providerApplications.businessServiceAddress,
      }).from(providerApplications).where(inArray(providerApplications.email, providerEmails))
    : [];
  const providerDetails = new Map(
    providerVerifications.map((provider) => [provider.email, provider]),
  );
  const verifiedEmails = new Set(
    providerVerifications
      .filter((provider) => (
        provider.verificationStatus === "verified"
        && provider.isTestProvider === "no"
        && provider.status === "approved"
      ))
      .map((provider) => provider.email),
  );
  const testProviderEmails = new Set(
    providerVerifications
      .filter((provider) => provider.isTestProvider === "yes")
      .map((provider) => provider.email),
  );
  const ratings = new Map<string, { total: number; count: number }>();
  for (const item of providerReviews) {
    const current = ratings.get(item.providerEmail) ?? { total: 0, count: 0 };
    current.total += item.rating;
    current.count += 1;
    ratings.set(item.providerEmail, current);
  }
  return Response.json({
    job: {
      id: job.id,
      customerName: job.name,
      customerEmail: job.email,
      zip: job.zip,
      vehicle: job.vehicle,
      launchArea: job.launchArea,
      municipality: job.municipality,
      service: job.service,
      partsSource: job.partsSource,
      partsPreference: job.partsPreference,
      serviceLocations: job.serviceLocations,
      serviceAddress: job.serviceAddress,
      preferredProviderName: job.preferredProviderName,
      repeatOfRequestId: job.repeatOfRequestId,
      status: job.status,
      isTestJob: job.isTestJob === "yes",
      hasIssueImage: Boolean(job.issueImageKey),
      hasCompletionImage: Boolean(job.completionImageKey),
    },
    quotes: quotes.map((quote) => {
      const usesLegacyTotal = Number(quote.laborPriceCents) + Number(quote.partsPriceCents) === 0
        && Number(quote.priceCents) > 0;
      return {
        ...quote,
        laborPriceCents: usesLegacyTotal ? quote.priceCents : quote.laborPriceCents,
        ratingAverage: ratings.has(quote.providerEmail)
          ? Number(((ratings.get(quote.providerEmail)?.total ?? 0) / (ratings.get(quote.providerEmail)?.count ?? 1)).toFixed(1))
          : 0,
        reviewCount: ratings.get(quote.providerEmail)?.count ?? 0,
        providerVerified: verifiedEmails.has(quote.providerEmail),
        providerTest: testProviderEmails.has(quote.providerEmail),
        providerWorkLocations: providerDetails.get(quote.providerEmail)?.workLocations ?? "",
        providerBusinessMunicipality:
          providerDetails.get(quote.providerEmail)?.businessMunicipality ?? "",
        providerBusinessServiceAddress: quote.status === "accepted"
          ? providerDetails.get(quote.providerEmail)?.businessServiceAddress ?? ""
          : undefined,
        providerEmail: quote.status === "accepted" ? quote.providerEmail : undefined,
      };
    }),
    review: review ?? null,
  });
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    action?: string;
    declineReason?: string;
    quoteId?: string;
    token?: string;
  };
  const action = body.action ?? "accept-quote";
  const [job] = await getDb().select().from(customerRequests)
    .where(eq(customerRequests.accessToken, body.token ?? "")).limit(1);
  if (!job) return Response.json({ error: "Private request link not found." }, { status: 404 });
  if (job.status !== "approved") {
    return Response.json({ error: "A quote has already been accepted for this request." }, { status: 409 });
  }
  const db = getDb();
  const [quote] = await db.select({
    id: providerQuotes.id,
    providerEmail: providerQuotes.providerEmail,
    status: providerQuotes.status,
  }).from(providerQuotes)
    .where(and(eq(providerQuotes.id, body.quoteId ?? ""), eq(providerQuotes.requestId, job.id))).limit(1);
  if (!quote) return Response.json({ error: "Quote not found for this request." }, { status: 404 });

  if (action === "decline-quote") {
    const declineReason = body.declineReason?.trim() ?? "";
    if (declineReason && !QUOTE_DECLINE_REASON_VALUES.has(declineReason)) {
      return Response.json({ error: "Choose one of the listed feedback options." }, { status: 400 });
    }
    if (quote.status !== "submitted") {
      return Response.json({ error: "This quote decision has already been updated." }, { status: 409 });
    }
    const updated = await db.update(providerQuotes).set({
      status: "declined",
      declineReason,
    }).where(and(
      eq(providerQuotes.id, quote.id),
      eq(providerQuotes.status, "submitted"),
    )).returning({ id: providerQuotes.id });
    if (updated.length === 0) {
      return Response.json({ error: "This quote decision was already updated." }, { status: 409 });
    }
    return Response.json({ ok: true, status: "declined", declineReason });
  }

  if (action === "restore-quote") {
    if (quote.status !== "declined") {
      return Response.json({ error: "Only a passed quote can be reconsidered." }, { status: 409 });
    }
    const updated = await db.update(providerQuotes).set({
      status: "submitted",
      declineReason: "",
    }).where(and(
      eq(providerQuotes.id, quote.id),
      eq(providerQuotes.status, "declined"),
    )).returning({ id: providerQuotes.id });
    if (updated.length === 0) {
      return Response.json({ error: "This quote decision was already updated." }, { status: 409 });
    }
    return Response.json({ ok: true, status: "submitted", declineReason: "" });
  }

  if (action !== "accept-quote") {
    return Response.json({ error: "Unknown quote action." }, { status: 400 });
  }
  if (quote.status !== "submitted") {
    return Response.json(
      { error: "Reconsider this quote before selecting it." },
      { status: 409 },
    );
  }

  const [activeProvider] = await db.select()
    .from(providerApplications)
    .where(and(
      eq(providerApplications.email, quote.providerEmail),
      eq(providerApplications.status, "approved"),
    ))
    .limit(1);
  const activeRealProvider = activeProvider
    && activeProvider.isTestProvider === "no"
    && activeProvider.verificationStatus === "verified";
  const activeTestProvider = activeProvider?.isTestProvider === "yes";
  if (
    !activeProvider
    || (job.isTestJob === "yes" ? !activeTestProvider : !activeRealProvider)
    || !providerMatchesJob(
      effectiveProviderServices(
        activeProvider?.service ?? "",
        activeProvider?.approvedServices ?? "",
        activeProvider?.isTestProvider ?? "no",
      ),
      job.service,
    )
    || !providerMatchesArea(activeProvider.serviceArea, job.launchArea || job.zip)
    || !providerMatchesServiceLocation(
      activeProvider.workLocations,
      job.serviceLocations,
    )
  ) {
    return Response.json({
      error: "This provider is not active for this job type. Please choose another quote.",
    }, { status: 409 });
  }

  const acceptedRequest = await db.update(customerRequests)
    .set({ status: "quote accepted" })
    .where(and(
      eq(customerRequests.id, job.id),
      eq(customerRequests.status, "approved"),
    ))
    .returning({ id: customerRequests.id });
  if (acceptedRequest.length === 0) {
    return Response.json({ error: "A quote has already been accepted for this request." }, { status: 409 });
  }
  await db.update(providerQuotes).set({ status: "accepted" })
    .where(eq(providerQuotes.id, quote.id));
  await db.update(providerQuotes).set({ status: "not selected" })
    .where(and(
      eq(providerQuotes.requestId, job.id),
      eq(providerQuotes.status, "submitted"),
    ));
  const notification = await sendAcceptedQuoteAlert(job.id, quote.id);
  return Response.json({ ok: true, providerEmail: quote.providerEmail, notification });
}
