import { and, desc, eq, exists, inArray } from "drizzle-orm";
import { getDb } from "../../../db";
import {
  customerAgreementAcceptances,
  customerRequests,
  jobScopeVersions,
  jobReviews,
  providerApplications,
  providerPathwayProfiles,
  providerQuotes,
} from "../../../db/schema";
import { getAccountSession } from "../../../lib/account-auth";
import { sendAcceptedQuoteAlert } from "../../../lib/provider-alerts";
import {
  CUSTOMER_PROVIDER_SELECTION_AGREEMENT_KEY,
  CUSTOMER_PROVIDER_SELECTION_AGREEMENT_VERSION,
  CUSTOMER_REQUEST_AGREEMENT_KEY,
  CUSTOMER_REQUEST_AGREEMENT_VERSION,
  CUSTOMER_REQUEST_PRIVACY_AGREEMENT_KEY,
  CUSTOMER_REQUEST_PRIVACY_AGREEMENT_VERSION,
  CUSTOMER_REQUEST_SCOPE_VERSION,
  customerAcceptanceDeviceContext,
  customerProviderSelectionAcceptanceText,
  customerProviderSelectionAgreementEvidenceText,
  customerProviderSelectionAgreementHash,
  customerQuoteSelectionScopeSnapshot,
  customerRequestAgreementEvidenceText,
  customerRequestPrivacyAgreementEvidenceText,
  customerRequestScopedAgreementHash,
  customerRequestScopedPrivacyAgreementHash,
  customerRequestScopeSnapshot,
  parseExactServiceCodes,
  requestIpAddress,
  type CustomerRequestScope,
  type CustomerQuoteSelectionScope,
} from "../../../lib/customer-job-scope";
import { loadCurrentAcceptedCustomerRequestScope } from "../../../lib/job-scope-records";
import { customerPriceFor } from "../../../lib/customer-fee";
import {
  eligibilityErrorMessage,
  evaluateStageEligibility,
} from "../../../lib/provider-eligibility-engine";
import {
  marketplacePausedMessage,
  type MarketplaceAction,
} from "../../../lib/launch-status";
import { runtimeMarketplaceActionAllowed } from "../../../lib/runtime-marketplace-action";
import { policyAccepted } from "../../../lib/policies";
import { POLICY_VERSION } from "../../../lib/provider-policy";
import { QUOTE_DECLINE_REASON_VALUES } from "../../../lib/quote-feedback";
import { isSameOriginRequest } from "../../../lib/request-security";
import {
  providerMatchesArea,
  providerMatchesServiceLocation,
} from "../../../lib/service-matching";

function marketplacePausedResponse(action: MarketplaceAction) {
  return Response.json(
    {
      error: marketplacePausedMessage(action),
      code: "MARKETPLACE_ONBOARDING_ONLY",
    },
    {
      status: 503,
      headers: { "cache-control": "no-store", "retry-after": "86400" },
    },
  );
}

function noStoreJson(
  body: Record<string, unknown>,
  status = 200,
) {
  return Response.json(body, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

function storedCustomerPrice(quote: typeof providerQuotes.$inferSelect) {
  const storedFeeCents = Number(quote.customerFeeCents);
  const storedTotalCents = Number(quote.customerTotalCents);
  return Number.isFinite(storedFeeCents)
      && Number.isFinite(storedTotalCents)
      && storedTotalCents > 0
      && Number(quote.priceCents) + storedFeeCents === storedTotalCents
    ? {
        customerFeeRateBps: quote.customerFeeRateBps,
        customerFeeCents: storedFeeCents,
        customerTotalCents: storedTotalCents,
      }
    : customerPriceFor(Number(quote.priceCents), quote.customerFeeRateBps);
}

function selectionScopeFor(
  job: typeof customerRequests.$inferSelect,
  acceptedRequestScope: CustomerRequestScope | null,
  quote: typeof providerQuotes.$inferSelect,
  providerId: string,
  providerName: string,
  profile: typeof providerPathwayProfiles.$inferSelect | undefined,
): { scope: CustomerQuoteSelectionScope; reason: "" } | { scope: null; reason: string } {
  const requestServiceCodes = parseExactServiceCodes(job.serviceCodes);
  const quoteServiceCodes = parseExactServiceCodes(quote.serviceCodes);
  if (
    requestServiceCodes.length !== 1
    || quoteServiceCodes.length !== 1
    || requestServiceCodes[0] !== quoteServiceCodes[0]
  ) {
    return {
      scope: null,
      reason: "This quote is not bound to the request's one exact service code.",
    };
  }
  if (
    !acceptedRequestScope
    || acceptedRequestScope.requestId !== job.id
    || acceptedRequestScope.scopeVersion !== CUSTOMER_REQUEST_SCOPE_VERSION
    || acceptedRequestScope.serviceCodes.length !== 1
    || acceptedRequestScope.serviceCodes[0] !== requestServiceCodes[0]
    || acceptedRequestScope.jurisdiction !== job.jurisdiction
    || acceptedRequestScope.municipality !== job.municipality
    || acceptedRequestScope.scheduledFor !== job.scheduledFor
    || acceptedRequestScope.vehicle !== job.vehicle
    || acceptedRequestScope.zip !== job.zip
    || acceptedRequestScope.launchArea !== job.launchArea
    || acceptedRequestScope.serviceLocations !== job.serviceLocations
    || acceptedRequestScope.serviceAddress !== job.serviceAddress
    || acceptedRequestScope.partsSource !== job.partsSource
    || acceptedRequestScope.partsPreference !== job.partsPreference
    || acceptedRequestScope.details !== job.details
    || acceptedRequestScope.hasIssueImage !== Boolean(job.issueImageKey)
  ) {
    return {
      scope: null,
      reason: "The current request row is not bound to its immutable accepted operation, location, vehicle, and safety facts.",
    };
  }
  if (
    quote.scopeVersion !== CUSTOMER_REQUEST_SCOPE_VERSION
    || !quote.scheduledFor
    || quote.scheduledFor !== job.scheduledFor
  ) {
    return {
      scope: null,
      reason: "This quote is not bound to the current scope version and scheduled time.",
    };
  }
  if (
    !providerId
    || !providerName
    || quote.providerName !== providerName
    || !quote.performingPersonId
    || !profile
    || profile.providerId !== providerId
    || profile.status !== "active"
    || profile.policyVersion !== POLICY_VERSION
    || profile.relationshipPath !== "independent_startup"
    || profile.providerPersonId !== quote.performingPersonId
  ) {
    return {
      scope: null,
      reason: "The responsible provider and its exact verified owner-operator have not been bound to this quote.",
    };
  }

  const price = storedCustomerPrice(quote);
  const laborPriceCents = Number(quote.laborPriceCents);
  const partsPriceCents = Number(quote.partsPriceCents);
  const providerSubtotalCents = Number(quote.priceCents);
  const storedFeeCents = Number(quote.customerFeeCents);
  const storedTotalCents = Number(quote.customerTotalCents);
  if (
    ![laborPriceCents, partsPriceCents, providerSubtotalCents, storedFeeCents, storedTotalCents]
      .every((value) => Number.isSafeInteger(value) && value >= 0)
    || providerSubtotalCents <= 0
    || !Number.isSafeInteger(quote.customerFeeRateBps)
    || quote.customerFeeRateBps < 0
    || quote.customerFeeRateBps > 10_000
    || laborPriceCents + partsPriceCents !== providerSubtotalCents
    || providerSubtotalCents + storedFeeCents !== storedTotalCents
    || storedFeeCents !== price.customerFeeCents
    || storedTotalCents !== price.customerTotalCents
  ) {
    return {
      scope: null,
      reason: "This quote does not contain one consistent immutable labor, parts, fee, and total breakdown.",
    };
  }
  const performingPersonDisplay = `${quote.providerName} — verified owner-operator`;
  return {
    reason: "",
    scope: {
      request: acceptedRequestScope,
      quote: {
        quoteId: quote.id,
        providerId,
        providerName: quote.providerName,
        performingPersonId: quote.performingPersonId,
        performingPersonDisplay,
        supervisorPersonId: quote.supervisorPersonId,
        serviceCodes: quoteServiceCodes,
        scheduledFor: quote.scheduledFor,
        scopeVersion: quote.scopeVersion,
        laborPriceCents: quote.laborPriceCents,
        partsPriceCents: quote.partsPriceCents,
        providerSubtotalCents: quote.priceCents,
        customerFeeRateBps: price.customerFeeRateBps,
        customerFeeCents: String(price.customerFeeCents),
        customerTotalCents: String(price.customerTotalCents),
        partType: quote.partType,
        availability: quote.availability,
        message: quote.message,
      },
    },
  };
}

async function selectionPresentation(
  job: typeof customerRequests.$inferSelect,
  acceptedRequestScope: CustomerRequestScope | null,
  quote: typeof providerQuotes.$inferSelect,
  providerId: string,
  providerName: string,
  profile: typeof providerPathwayProfiles.$inferSelect | undefined,
) {
  const result = selectionScopeFor(
    job,
    acceptedRequestScope,
    quote,
    providerId,
    providerName,
    profile,
  );
  if (!result.scope) {
    return { selectionAcceptance: null, selectionBlockedReason: result.reason };
  }
  return {
    selectionBlockedReason: "",
    selectionAcceptance: {
      agreementKey: CUSTOMER_PROVIDER_SELECTION_AGREEMENT_KEY,
      agreementVersion: CUSTOMER_PROVIDER_SELECTION_AGREEMENT_VERSION,
      agreementHash: await customerProviderSelectionAgreementHash(result.scope),
      presentedText: customerProviderSelectionAcceptanceText(result.scope),
      scopeVersion: result.scope.quote.scopeVersion,
      performingPersonDisplay: result.scope.quote.performingPersonDisplay,
      scheduledFor: result.scope.quote.scheduledFor,
      serviceCodes: result.scope.quote.serviceCodes,
    },
  };
}

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const token = searchParams.get("token") ?? "";
  const requestId = searchParams.get("requestId") ?? "";
  let job: typeof customerRequests.$inferSelect | undefined;
  if (token) {
    [job] = await getDb().select().from(customerRequests)
      .where(eq(customerRequests.accessToken, token)).limit(1);
  } else if (requestId) {
    const session = await getAccountSession(request);
    if (session?.role === "customer") {
      [job] = await getDb().select().from(customerRequests)
        .where(and(
          eq(customerRequests.id, requestId),
          eq(customerRequests.email, session.email),
        ))
        .limit(1);
    }
  }
  if (!job) return noStoreJson({ error: "Customer request not found." }, 404);
  if (!(await runtimeMarketplaceActionAllowed("quote", { testOnly: job.isTestJob === "yes" }))) {
    return marketplacePausedResponse("quote");
  }

  const db = getDb();
  const acceptedRequestScope = await loadCurrentAcceptedCustomerRequestScope(
    job.id,
    job.email,
  );
  const quotes = await db.select().from(providerQuotes)
    .where(eq(providerQuotes.requestId, job.id)).orderBy(desc(providerQuotes.createdAt));
  const [review] = await db.select({
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
    ? await db.select({
        providerEmail: jobReviews.providerEmail,
        rating: jobReviews.rating,
      }).from(jobReviews).where(and(
        eq(jobReviews.status, "published"),
        inArray(jobReviews.providerEmail, providerEmails),
      ))
    : [];
  const providerVerifications = providerEmails.length > 0
    ? await db.select({
        id: providerApplications.id,
        name: providerApplications.name,
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
  const providerIds = providerVerifications.map((provider) => provider.id);
  const profileRows = providerIds.length > 0
    ? await db.select().from(providerPathwayProfiles)
      .where(inArray(providerPathwayProfiles.providerId, providerIds))
      .orderBy(desc(providerPathwayProfiles.pathwayVersion))
    : [];
  const latestProfiles = new Map<string, typeof providerPathwayProfiles.$inferSelect>();
  for (const profile of profileRows) {
    if (!latestProfiles.has(profile.providerId)) {
      latestProfiles.set(profile.providerId, profile);
    }
  }
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

  const presentedQuotes = await Promise.all(quotes.map(async (quote) => {
    const usesLegacyTotal = Number(quote.laborPriceCents) + Number(quote.partsPriceCents) === 0
      && Number(quote.priceCents) > 0;
    const customerPrice = storedCustomerPrice(quote);
    const provider = providerDetails.get(quote.providerEmail);
    const presentation = await selectionPresentation(
      job,
      acceptedRequestScope,
      quote,
      provider?.id ?? "",
      provider?.name ?? "",
      provider ? latestProfiles.get(provider.id) : undefined,
    );
    return {
      ...quote,
      laborPriceCents: usesLegacyTotal ? quote.priceCents : quote.laborPriceCents,
      customerFeeRateBps: customerPrice.customerFeeRateBps,
      customerFeeCents: String(customerPrice.customerFeeCents),
      customerTotalCents: String(customerPrice.customerTotalCents),
      ratingAverage: ratings.has(quote.providerEmail)
        ? Number(((ratings.get(quote.providerEmail)?.total ?? 0) / (ratings.get(quote.providerEmail)?.count ?? 1)).toFixed(1))
        : 0,
      reviewCount: ratings.get(quote.providerEmail)?.count ?? 0,
      providerVerified: verifiedEmails.has(quote.providerEmail),
      providerTest: testProviderEmails.has(quote.providerEmail),
      providerWorkLocations: provider?.workLocations ?? "",
      providerBusinessMunicipality: provider?.businessMunicipality ?? "",
      providerBusinessServiceAddress: quote.status === "accepted"
        ? provider?.businessServiceAddress ?? ""
        : undefined,
      providerEmail: quote.status === "accepted" ? quote.providerEmail : undefined,
      ...presentation,
      // Internal person identifiers stay server-side; customers receive the
      // exact human-readable disclosure embedded in selectionAcceptance.
      performingPersonId: undefined,
      supervisorPersonId: undefined,
      authorizationDecisionId: undefined,
    };
  }));

  return noStoreJson({
    accessToken: job.accessToken,
    job: {
      id: job.id,
      customerName: job.name,
      customerEmail: job.email,
      zip: job.zip,
      vehicle: job.vehicle,
      launchArea: job.launchArea,
      jurisdiction: job.jurisdiction,
      municipality: job.municipality,
      service: job.service,
      serviceCodes: parseExactServiceCodes(job.serviceCodes),
      scheduledFor: job.scheduledFor,
      partsSource: job.partsSource,
      partsPreference: job.partsPreference,
      serviceLocations: job.serviceLocations,
      serviceAddress: job.serviceAddress,
      details: job.details,
      preferredProviderName: job.preferredProviderName,
      repeatOfRequestId: job.repeatOfRequestId,
      status: job.status,
      isTestJob: job.isTestJob === "yes",
      hasIssueImage: Boolean(job.issueImageKey),
      hasCompletionImage: Boolean(job.completionImageKey),
    },
    quotes: presentedQuotes,
    review: review ?? null,
  });
}

async function requestAcceptanceIsCurrent(
  job: typeof customerRequests.$inferSelect,
  scope: CustomerQuoteSelectionScope["request"],
) {
  const scopeSnapshot = customerRequestScopeSnapshot(scope);
  const [requestHash, privacyHash, acceptances] = await Promise.all([
    customerRequestScopedAgreementHash(scopeSnapshot),
    customerRequestScopedPrivacyAgreementHash(scopeSnapshot),
    getDb().select().from(customerAgreementAcceptances).where(and(
      eq(customerAgreementAcceptances.requestId, job.id),
      eq(customerAgreementAcceptances.quoteId, ""),
      eq(customerAgreementAcceptances.scopeVersion, CUSTOMER_REQUEST_SCOPE_VERSION),
    )),
  ]);
  const requestAcceptance = acceptances.find((acceptance) => (
    acceptance.customerEmail === job.email
    && acceptance.agreementKey === CUSTOMER_REQUEST_AGREEMENT_KEY
    && acceptance.agreementVersion === CUSTOMER_REQUEST_AGREEMENT_VERSION
    && acceptance.agreementHash === requestHash
    && acceptance.agreementText === customerRequestAgreementEvidenceText(scopeSnapshot)
    && acceptance.scopeSnapshot === scopeSnapshot
    && Boolean(acceptance.acceptedAt)
  ));
  const privacyAcceptance = acceptances.find((acceptance) => (
    acceptance.customerEmail === job.email
    && acceptance.agreementKey === CUSTOMER_REQUEST_PRIVACY_AGREEMENT_KEY
    && acceptance.agreementVersion === CUSTOMER_REQUEST_PRIVACY_AGREEMENT_VERSION
    && acceptance.agreementHash === privacyHash
    && acceptance.agreementText === customerRequestPrivacyAgreementEvidenceText(scopeSnapshot)
    && acceptance.scopeSnapshot === scopeSnapshot
    && Boolean(acceptance.acceptedAt)
  ));
  return Boolean(requestAcceptance && privacyAcceptance);
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return noStoreJson({
      error: "This quote decision must be submitted from TUVELOZ.",
      code: "SAME_ORIGIN_REQUIRED",
    }, 403);
  }
  const body = (await request.json()) as {
    action?: string;
    declineReason?: string;
    quoteId?: string;
    token?: string;
    selectionAccepted?: unknown;
    selectionAgreementKey?: string;
    selectionAgreementVersion?: string;
    selectionAgreementHash?: string;
  };
  const action = body.action ?? "accept-quote";
  const [job] = await getDb().select().from(customerRequests)
    .where(eq(customerRequests.accessToken, body.token ?? "")).limit(1);
  if (!job) return noStoreJson({ error: "Private request link not found." }, 404);
  const marketplaceAction: MarketplaceAction = action === "accept-quote"
    ? "booking"
    : "quote";
  if (!(await runtimeMarketplaceActionAllowed(marketplaceAction, { testOnly: job.isTestJob === "yes" }))) {
    return marketplacePausedResponse(marketplaceAction);
  }
  if (job.status !== "approved") {
    return noStoreJson({ error: "A quote has already been accepted for this request." }, 409);
  }

  const db = getDb();
  const [quote] = await db.select().from(providerQuotes)
    .where(and(
      eq(providerQuotes.id, body.quoteId ?? ""),
      eq(providerQuotes.requestId, job.id),
    )).limit(1);
  if (!quote) return noStoreJson({ error: "Quote not found for this request." }, 404);

  if (action === "decline-quote") {
    const declineReason = body.declineReason?.trim() ?? "";
    if (declineReason && !QUOTE_DECLINE_REASON_VALUES.has(declineReason)) {
      return noStoreJson({ error: "Choose one of the listed feedback options." }, 400);
    }
    if (quote.status !== "submitted") {
      return noStoreJson({ error: "This quote decision has already been updated." }, 409);
    }
    const updated = await db.update(providerQuotes).set({
      status: "declined",
      declineReason,
    }).where(and(
      eq(providerQuotes.id, quote.id),
      eq(providerQuotes.status, "submitted"),
    )).returning({ id: providerQuotes.id });
    if (updated.length === 0) {
      return noStoreJson({ error: "This quote decision was already updated." }, 409);
    }
    return noStoreJson({ ok: true, status: "declined", declineReason });
  }

  if (action === "restore-quote") {
    if (quote.status !== "declined") {
      return noStoreJson({ error: "Only a passed quote can be reconsidered." }, 409);
    }
    const updated = await db.update(providerQuotes).set({
      status: "submitted",
      declineReason: "",
    }).where(and(
      eq(providerQuotes.id, quote.id),
      eq(providerQuotes.status, "declined"),
    )).returning({ id: providerQuotes.id });
    if (updated.length === 0) {
      return noStoreJson({ error: "This quote decision was already updated." }, 409);
    }
    return noStoreJson({ ok: true, status: "submitted", declineReason: "" });
  }

  if (action !== "accept-quote") {
    return noStoreJson({ error: "Unknown quote action." }, 400);
  }
  if (quote.status !== "submitted") {
    return noStoreJson({ error: "Reconsider this quote before selecting it." }, 409);
  }

  const [activeProvider] = await db.select().from(providerApplications)
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
    || !providerMatchesArea(activeProvider.serviceArea, job.launchArea || job.zip)
    || !providerMatchesServiceLocation(
      activeProvider.workLocations,
      job.serviceLocations,
    )
  ) {
    return noStoreJson({
      error: "This provider is not active for this exact area and service-location arrangement.",
    }, 409);
  }

  const [activeProfile] = await db.select().from(providerPathwayProfiles)
    .where(eq(providerPathwayProfiles.providerId, activeProvider.id))
    .orderBy(desc(providerPathwayProfiles.pathwayVersion))
    .limit(1);
  const acceptedRequestScope = await loadCurrentAcceptedCustomerRequestScope(
    job.id,
    job.email,
  );
  const selection = selectionScopeFor(
    job,
    acceptedRequestScope,
    quote,
    activeProvider.id,
    activeProvider.name,
    activeProfile,
  );
  if (!selection.scope) {
    return noStoreJson({
      error: selection.reason,
      code: "QUOTE_SCOPE_BINDING_REQUIRED",
    }, 409);
  }
  if (
    job.policyVersion !== POLICY_VERSION
    || !job.termsAcceptedAt
    || !(await requestAcceptanceIsCurrent(job, selection.scope.request))
  ) {
    return noStoreJson({
      error: "The exact request scope does not have the current immutable customer acceptance record.",
      code: "REQUEST_SCOPE_ACCEPTANCE_REQUIRED",
    }, 409);
  }

  const expectedSelectionHash = await customerProviderSelectionAgreementHash(selection.scope);
  if (
    !policyAccepted(body.selectionAccepted)
    || body.selectionAgreementKey !== CUSTOMER_PROVIDER_SELECTION_AGREEMENT_KEY
    || body.selectionAgreementVersion !== CUSTOMER_PROVIDER_SELECTION_AGREEMENT_VERSION
    || body.selectionAgreementHash?.toLowerCase() !== expectedSelectionHash
  ) {
    return noStoreJson({
      error: "Review and affirmatively accept the exact provider, performing person, scope, schedule, quote, fee, and total shown.",
      code: "PROVIDER_QUOTE_ACCEPTANCE_REQUIRED",
    }, 400);
  }

  const acceptedAt = new Date().toISOString();
  const assignmentVersion = job.assignmentVersion + 1;
  const eligibility = await evaluateStageEligibility({
    stage: "booking",
    providerId: activeProvider.id,
    personId: quote.performingPersonId,
    supervisorPersonId: quote.supervisorPersonId,
    serviceCodes: selection.scope.quote.serviceCodes,
    jurisdiction: selection.scope.request.jurisdiction,
    scheduledFor: selection.scope.quote.scheduledFor,
    requestId: job.id,
    quoteId: quote.id,
    scopeVersion: selection.scope.quote.scopeVersion,
    assignmentVersion,
    customerProviderDisclosureAcceptedAt: acceptedAt,
    jobFacts: selection.scope.request.jobFacts,
    effectiveAt: acceptedAt,
    testOnly: job.isTestJob === "yes" && activeProvider.isTestProvider === "yes",
    persist: true,
  });
  if (!eligibility.allowed) {
    return noStoreJson({
      error: eligibilityErrorMessage(eligibility),
      code: "PROVIDER_NOT_ELIGIBLE_AT_BOOKING",
      authorizationDecisionId: eligibility.decisionId,
    }, 409);
  }

  const accountSession = await getAccountSession(request);
  const acceptanceId = crypto.randomUUID();
  const baseScopeVersionId = crypto.randomUUID();
  const acceptanceSessionId = accountSession?.role === "customer"
      && accountSession.email === job.email
    ? accountSession.id
    : crypto.randomUUID();
  const selectionSnapshot = customerQuoteSelectionScopeSnapshot(selection.scope);
  const customerPrice = storedCustomerPrice(quote);
  const baseScopeDetails = JSON.stringify({
    description: selection.scope.request.details,
    vehicle: selection.scope.request.vehicle,
    municipality: selection.scope.request.municipality,
    zip: selection.scope.request.zip,
    launchArea: selection.scope.request.launchArea,
    serviceLocations: selection.scope.request.serviceLocations,
    serviceAddress: selection.scope.request.serviceAddress,
    providerName: selection.scope.quote.providerName,
    performingPersonDisplay: selection.scope.quote.performingPersonDisplay,
    quoteMessage: selection.scope.quote.message,
    availability: selection.scope.quote.availability,
    partType: selection.scope.quote.partType,
    jobFacts: selection.scope.request.jobFacts,
  });
  const basePriceBreakdown = JSON.stringify({
    laborAmountCents: Number(selection.scope.quote.laborPriceCents),
    partsAmountCents: Number(selection.scope.quote.partsPriceCents),
    taxAmountCents: 0,
    otherAmountCents: 0,
    totalAmountCents: Number(selection.scope.quote.providerSubtotalCents),
    customerFeeRateBps: selection.scope.quote.customerFeeRateBps,
    customerFeeCents: Number(selection.scope.quote.customerFeeCents),
    customerTotalCents: Number(selection.scope.quote.customerTotalCents),
  });
  const acceptedBatch = await (async () => {
    try {
      return await db.batch([
        db.insert(customerAgreementAcceptances).values({
          id: acceptanceId,
          customerEmail: job.email,
          requestId: job.id,
          quoteId: quote.id,
          scopeVersion: selection.scope.quote.scopeVersion,
          scopeSnapshot: selectionSnapshot,
          agreementKey: CUSTOMER_PROVIDER_SELECTION_AGREEMENT_KEY,
          agreementVersion: CUSTOMER_PROVIDER_SELECTION_AGREEMENT_VERSION,
          agreementHash: expectedSelectionHash,
          agreementText: customerProviderSelectionAgreementEvidenceText(selection.scope),
          acceptedByName: job.name,
          acceptanceAction: "affirmative-provider-quote-selection-checkbox",
          acceptedAt,
          ipAddress: requestIpAddress(request),
          sessionId: acceptanceSessionId,
          deviceContext: customerAcceptanceDeviceContext(request),
          createdAt: acceptedAt,
        }).returning({ id: customerAgreementAcceptances.id }),
        db.insert(jobScopeVersions).values({
          id: baseScopeVersionId,
          requestId: job.id,
          quoteId: quote.id,
          version: CUSTOMER_REQUEST_SCOPE_VERSION,
          serviceCodes: JSON.stringify(selection.scope.quote.serviceCodes),
          jurisdiction: selection.scope.request.jurisdiction,
          scheduledFor: selection.scope.quote.scheduledFor,
          scopeDetails: baseScopeDetails,
          priceBreakdown: basePriceBreakdown,
          partsResponsibility: selection.scope.request.partsSource,
          changeReason: "initial_customer_quote_selection",
          createdByProviderId: activeProvider.id,
          createdByPersonId: quote.performingPersonId,
          providerApprovedAt: quote.createdAt,
          customerAuthorizedAt: acceptedAt,
          authorizationDecisionId: eligibility.decisionId,
          supersedesScopeVersionId: "",
          createdAt: acceptedAt,
        }).returning({ id: jobScopeVersions.id }),
        db.update(providerQuotes).set({
          status: "accepted",
          authorizationDecisionId: eligibility.decisionId,
          customerFeeRateBps: customerPrice.customerFeeRateBps,
          customerFeeCents: String(customerPrice.customerFeeCents),
          customerTotalCents: String(customerPrice.customerTotalCents),
        }).where(and(
          eq(providerQuotes.id, quote.id),
          eq(providerQuotes.status, "submitted"),
          exists(
            db.select({ id: customerRequests.id }).from(customerRequests).where(and(
              eq(customerRequests.id, job.id),
              eq(customerRequests.status, "approved"),
            )),
          ),
        )).returning({ id: providerQuotes.id }),
        db.update(customerRequests).set({
          status: "quote accepted",
          assignedPersonId: quote.performingPersonId,
          assignedSupervisorPersonId: quote.supervisorPersonId,
          assignmentVersion,
          customerProviderDisclosureAcceptedAt: acceptedAt,
        }).where(and(
          eq(customerRequests.id, job.id),
          eq(customerRequests.status, "approved"),
          exists(
            db.select({ id: providerQuotes.id }).from(providerQuotes).where(and(
              eq(providerQuotes.id, quote.id),
              eq(providerQuotes.status, "accepted"),
            )),
          ),
        )).returning({ id: customerRequests.id }),
        db.update(providerQuotes).set({ status: "not selected" })
          .where(and(
            eq(providerQuotes.requestId, job.id),
            eq(providerQuotes.status, "submitted"),
            exists(
              db.select({ id: customerRequests.id }).from(customerRequests).where(and(
                eq(customerRequests.id, job.id),
                eq(customerRequests.status, "quote accepted"),
              )),
            ),
          )),
      ] as const);
    } catch (error) {
      console.error("Customer booking transaction failed.", error);
      return null;
    }
  })();

  if (!acceptedBatch) {
    return noStoreJson({
      error: "A quote has already been accepted, its base scope already exists, or booking changed before completion.",
      code: "BOOKING_CONFLICT",
    }, 409);
  }

  const acceptedQuoteRows = acceptedBatch[2];
  const acceptedRequestRows = acceptedBatch[3];
  if (acceptedQuoteRows.length === 0 || acceptedRequestRows.length === 0) {
    await db.batch([
      db.delete(customerAgreementAcceptances)
        .where(eq(customerAgreementAcceptances.id, acceptanceId)),
      db.delete(jobScopeVersions)
        .where(eq(jobScopeVersions.id, baseScopeVersionId)),
    ] as const);
    return noStoreJson({
      error: "A quote has already been accepted or this quote changed before booking completed.",
      code: "BOOKING_CONFLICT",
    }, 409);
  }

  const notification = await sendAcceptedQuoteAlert(job.id, quote.id);
  return noStoreJson({
    ok: true,
    providerEmail: quote.providerEmail,
    authorizationDecisionId: eligibility.decisionId,
    customerAcceptanceId: acceptanceId,
    jobScopeVersionId: baseScopeVersionId,
    scopeVersion: CUSTOMER_REQUEST_SCOPE_VERSION,
    notification,
  });
}
