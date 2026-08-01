import { and, desc, eq, exists } from "drizzle-orm";
import type Stripe from "stripe";
import { getDb } from "../../../../db";
import {
  customerRequests,
  jobAuthorizationSnapshots,
  jobScopeVersions,
  providerApplications,
  providerQuotes,
  stripePayments,
} from "../../../../db/schema";
import {
  getAccountSession,
  isSameOriginRequest,
} from "../../../../lib/account-auth";
import { customerPriceFor } from "../../../../lib/customer-fee";
import {
  getStripeClient,
  retrieveRecipientAccountStatus,
  siteUrlFor,
  stripeErrorResponse,
} from "../../../../lib/stripe";
import { getOrCreateStripeCustomer } from "../../../../lib/stripe-customers";
import { publicPaymentSummary } from "../../../../lib/stripe-payments";
import {
  CHECKOUT_POLICY_BUNDLE_VERSION,
  policyAccepted,
} from "../../../../lib/policies";
import {
  marketplacePausedMessage,
} from "../../../../lib/launch-status";
import { runtimeMarketplaceActionAllowed } from "../../../../lib/runtime-marketplace-action";
import { runtimeRealMarketplaceReleaseDecision } from "../../../../lib/runtime-launch-readiness";
import {
  activeJobOperationHoldReasons,
  parseExactServiceCodes,
} from "../../../../lib/job-operations";
import {
  eligibilityErrorMessage,
  evaluateStageEligibility,
  type StageEligibilityInput,
} from "../../../../lib/provider-eligibility-engine";
import { jobScopeFactsFromScopeDetails } from "../../../../lib/job-scope-facts";

function marketplacePausedResponse() {
  return Response.json(
    {
      error: marketplacePausedMessage("checkout"),
      code: "MARKETPLACE_ONBOARDING_ONLY",
      checkoutAllowed: false,
    },
    {
      status: 503,
      headers: { "cache-control": "no-store", "retry-after": "86400" },
    },
  );
}

const PAID_PAYMENT_STATUSES = [
  "paid_pending_completion",
  "ready_for_release",
  "released",
  "paid_and_transferred",
] as const;

const REVIEW_PAYMENT_STATUSES = [
  "refunded",
  "partially_refunded",
  "disputed",
  "dispute_won_review",
  "dispute_lost",
] as const;

type AuthorizedScopePrice = {
  laborAmountCents: number;
  partsAmountCents: number;
  taxAmountCents: number;
  otherAmountCents: number;
  totalAmountCents: number;
  customerFeeRateBps: number;
  customerFeeCents: number;
  customerTotalCents: number;
};

function authorizedScopePrice(value: string): AuthorizedScopePrice | null {
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    const result = {
      laborAmountCents: Number(parsed.laborAmountCents),
      partsAmountCents: Number(parsed.partsAmountCents),
      taxAmountCents: Number(parsed.taxAmountCents),
      otherAmountCents: Number(parsed.otherAmountCents),
      totalAmountCents: Number(parsed.totalAmountCents),
      customerFeeRateBps: Number(parsed.customerFeeRateBps),
      customerFeeCents: Number(parsed.customerFeeCents),
      customerTotalCents: Number(parsed.customerTotalCents),
    };
    if (
      Object.values(result).some((item) => !Number.isInteger(item) || item < 0)
      || result.totalAmountCents <= 0
      || result.laborAmountCents + result.partsAmountCents
        + result.taxAmountCents + result.otherAmountCents !== result.totalAmountCents
    ) return null;
    const expected = customerPriceFor(
      result.totalAmountCents,
      result.customerFeeRateBps,
    );
    return expected.customerFeeCents === result.customerFeeCents
        && expected.customerTotalCents === result.customerTotalCents
      ? result
      : null;
  } catch {
    return null;
  }
}

function clean(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function expandedDefaultPrice(product: Stripe.Product) {
  return product.default_price
    && typeof product.default_price !== "string"
    && !("deleted" in product.default_price)
    ? product.default_price
    : null;
}

async function acceptedQuoteForCustomer(
  request: Request,
  quoteId: string,
  token: string,
) {
  const [selection] = await getDb().select({
    quoteId: providerQuotes.id,
    quoteStatus: providerQuotes.status,
    providerAmount: providerQuotes.priceCents,
    customerFeeRateBps: providerQuotes.customerFeeRateBps,
    customerFeeCents: providerQuotes.customerFeeCents,
    customerTotalCents: providerQuotes.customerTotalCents,
    quoteServiceCodes: providerQuotes.serviceCodes,
    performingPersonId: providerQuotes.performingPersonId,
    supervisorPersonId: providerQuotes.supervisorPersonId,
    quoteScheduledFor: providerQuotes.scheduledFor,
    scopeVersion: providerQuotes.scopeVersion,
    quoteAuthorizationDecisionId: providerQuotes.authorizationDecisionId,
    providerApplicationId: providerApplications.id,
    providerName: providerApplications.name,
    connectedAccountId: providerApplications.stripeAccountId,
    providerStatus: providerApplications.status,
    providerVerificationStatus: providerApplications.verificationStatus,
    providerIsTest: providerApplications.isTestProvider,
    requestId: customerRequests.id,
    requestStatus: customerRequests.status,
    requestAccessToken: customerRequests.accessToken,
    customerEmail: customerRequests.email,
    customerName: customerRequests.name,
    isTestJob: customerRequests.isTestJob,
    requestServiceCodes: customerRequests.serviceCodes,
    jurisdiction: customerRequests.jurisdiction,
    requestScheduledFor: customerRequests.scheduledFor,
    assignedPersonId: customerRequests.assignedPersonId,
    assignedSupervisorPersonId: customerRequests.assignedSupervisorPersonId,
    assignmentVersion: customerRequests.assignmentVersion,
    customerProviderDisclosureAcceptedAt:
      customerRequests.customerProviderDisclosureAcceptedAt,
    service: customerRequests.service,
    vehicle: customerRequests.vehicle,
  }).from(providerQuotes)
    .innerJoin(
      customerRequests,
      eq(customerRequests.id, providerQuotes.requestId),
    )
    .innerJoin(
      providerApplications,
      eq(providerApplications.email, providerQuotes.providerEmail),
    )
    .where(and(
      eq(providerQuotes.id, quoteId),
      eq(providerQuotes.status, "accepted"),
    ))
    .limit(1);
  if (!selection) return null;

  // A private request token or the signed-in customer session may authorize
  // checkout. The browser never supplies provider or amount information.
  let authorized = Boolean(token) && token === selection.requestAccessToken;
  if (!authorized) {
    const session = await getAccountSession(request);
    authorized = session?.role === "customer"
      && session.email.toLowerCase() === selection.customerEmail.toLowerCase();
  }
  return authorized ? selection : null;
}

async function latestQuotePayment(quoteId: string) {
  const [payment] = await getDb().select().from(stripePayments)
    .where(eq(stripePayments.quoteId, quoteId))
    .orderBy(desc(stripePayments.createdAt))
    .limit(1);
  return payment;
}

export async function GET(request: Request) {
  // Payment records and Stripe sessions are real financial objects. Test jobs
  // intentionally never create either. Keep authenticated/token-bound status
  // inspection available if launch readiness is later revoked so prior money
  // can still be reconciled; only payment-creating POST actions are gated.
  const searchParams = new URL(request.url).searchParams;
  const sessionId = searchParams.get("sessionId") ?? "";
  if (sessionId) {
    const [payment] = await getDb().select().from(stripePayments)
      .where(eq(stripePayments.checkoutSessionId, sessionId))
      .limit(1);
    if (!payment) {
      return Response.json({ error: "Payment session not found." }, { status: 404 });
    }
    return Response.json({ payment: publicPaymentSummary(payment) });
  }

  const quoteId = searchParams.get("quoteId") ?? "";
  const token = searchParams.get("token") ?? "";
  const selection = await acceptedQuoteForCustomer(request, quoteId, token);
  if (!selection) {
    return Response.json({ error: "Accepted quote not found for this customer." }, { status: 404 });
  }
  if (selection.isTestJob === "yes") {
    return Response.json({
      checkoutAllowed: false,
      reason: "Test jobs never create real or sandbox payments.",
      payment: null,
    });
  }
  if (!selection.connectedAccountId) {
    return Response.json({
      checkoutAllowed: false,
      reason: "The selected provider is still setting up Stripe payouts.",
      payment: publicPaymentSummary(await latestQuotePayment(quoteId)),
    });
  }

  try {
    const stripeClient = getStripeClient();
    const accountStatus = await retrieveRecipientAccountStatus(
      stripeClient,
      selection.connectedAccountId,
    );
    return Response.json({
      checkoutAllowed: accountStatus.readyToReceivePayments,
      reason: accountStatus.readyToReceivePayments
        ? ""
        : "The selected provider must finish Stripe onboarding before checkout.",
      payment: publicPaymentSummary(await latestQuotePayment(quoteId)),
    });
  } catch (error) {
    return stripeErrorResponse(error, "Unable to check payment readiness.");
  }
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "Cross-origin checkout requests are not allowed." }, { status: 403 });
  }
  if (!(await runtimeMarketplaceActionAllowed("checkout"))) {
    return marketplacePausedResponse();
  }

  const body = (await request.json()) as {
    productId?: unknown;
    quoteId?: unknown;
    token?: unknown;
    customerEmail?: unknown;
    quantity?: unknown;
    policyAccepted?: unknown;
  };
  const productId = clean(body.productId, 120);
  const quoteId = clean(body.quoteId, 120);
  if (Boolean(productId) === Boolean(quoteId)) {
    return Response.json(
      { error: "Choose exactly one Stripe product or one accepted quote." },
      { status: 400 },
    );
  }
  if (productId) {
    return Response.json({
      error: "Standalone product checkout is disabled. A future payment must be tied to one accepted exact-service job scope, provider, performing person, schedule, and customer authorization.",
      code: "UNSCOPED_PRODUCT_CHECKOUT_DISABLED",
    }, { status: 409, headers: { "cache-control": "no-store" } });
  }
  if (!policyAccepted(body.policyAccepted)) {
    return Response.json(
      { error: "You must be 18 or older and accept the Terms, Customer Agreement, and Payment Policy before checkout." },
      { status: 400 },
    );
  }

  try {
    const stripeClient = getStripeClient();
    const rootUrl = siteUrlFor(request);
    const now = new Date().toISOString();
    let paymentId = crypto.randomUUID();
    let paymentType: "product" | "quote";
    let requestId: string | null = null;
    let finalQuoteId: string | null = null;
    let paymentScopeVersion = 0;
    let scopeAuthorizationDecisionId = "";
    let authorizedPriceSnapshot = "{}";
    let checkoutEligibilityValidThrough = "";
    let bookingEligibilityRecheckInput: StageEligibilityInput | null = null;
    let finalProductId: string | null = null;
    let priceId: string | null = null;
    let productName: string;
    let providerApplicationId: string;
    let connectedAccountId: string;
    let customerEmail: string;
    let currency = "usd";
    let quantity = 1;
    let providerAmountCents: number;
    let applicationFeeCents: number;
    let customerTotalCents: number;
    let settlementStrategy: "destination_charge" | "separate_transfer";
    let lineItems: Stripe.Checkout.SessionCreateParams.LineItem[];

    if (productId) {
      paymentType = "product";
      customerEmail = clean(body.customerEmail, 180).toLowerCase();
      quantity = Math.max(1, Math.min(10, Math.floor(Number(body.quantity) || 1)));
      if (!validEmail(customerEmail)) {
        return Response.json(
          { error: "Enter a valid email address for the Stripe receipt." },
          { status: 400 },
        );
      }

      // Retrieve the product and price from Stripe. Price and destination data
      // are never accepted from the browser.
      const product = await stripeClient.products.retrieve(productId, {
        expand: ["default_price"],
      });
      const price = expandedDefaultPrice(product);
      const mappedProviderId = product.metadata.tuveloz_provider_application_id;
      const mappedAccountId = product.metadata.tuveloz_connected_account_id;
      const [provider] = await getDb().select().from(providerApplications)
        .where(eq(providerApplications.id, mappedProviderId))
        .limit(1);
      if (
        !product.active
        || !price?.active
        || price.type !== "one_time"
        || price.unit_amount === null
        || price.currency !== "usd"
        || !provider
        || provider.status !== "approved"
        || provider.verificationStatus !== "verified"
        || provider.isTestProvider !== "no"
        || !provider.stripeAccountId
        || provider.stripeAccountId !== mappedAccountId
      ) {
        return Response.json(
          { error: "This product is not available from an active connected provider." },
          { status: 409 },
        );
      }
      const accountStatus = await retrieveRecipientAccountStatus(
        stripeClient,
        provider.stripeAccountId,
      );
      if (!accountStatus.readyToReceivePayments) {
        return Response.json(
          { error: "This provider is not ready to receive Stripe payments." },
          { status: 409 },
        );
      }

      finalProductId = product.id;
      priceId = price.id;
      productName = product.name;
      providerApplicationId = provider.id;
      connectedAccountId = provider.stripeAccountId;
      currency = price.currency;
      providerAmountCents = price.unit_amount * quantity;
      const totals = customerPriceFor(providerAmountCents);
      applicationFeeCents = totals.customerFeeCents;
      customerTotalCents = totals.customerTotalCents;
      settlementStrategy = "destination_charge";
      lineItems = [
        { price: price.id, quantity },
        {
          price_data: {
            currency,
            unit_amount: applicationFeeCents,
            product_data: {
              name: "Tuveloz customer service fee",
              description: "10% marketplace service fee",
            },
          },
          quantity: 1,
        },
      ];
    } else {
      paymentType = "quote";
      const selection = await acceptedQuoteForCustomer(
        request,
        quoteId,
        clean(body.token, 120),
      );
      if (!selection) {
        return Response.json(
          { error: "Accepted quote not found for this customer." },
          { status: 404 },
        );
      }
      if (selection.isTestJob === "yes") {
        return Response.json(
          { error: "Test jobs cannot create Stripe Checkout sessions." },
          { status: 409 },
        );
      }
      if (
        !selection.connectedAccountId
        || selection.providerStatus !== "approved"
        || selection.providerVerificationStatus !== "verified"
        || selection.providerIsTest !== "no"
      ) {
        return Response.json(
          { error: "The selected provider is not ready for payment." },
          { status: 409 },
        );
      }
      const [latestScope] = await getDb().select({
        id: jobScopeVersions.id,
        version: jobScopeVersions.version,
        serviceCodes: jobScopeVersions.serviceCodes,
        scheduledFor: jobScopeVersions.scheduledFor,
        scopeDetails: jobScopeVersions.scopeDetails,
        priceBreakdown: jobScopeVersions.priceBreakdown,
        customerAuthorizedAt: jobScopeVersions.customerAuthorizedAt,
        authorizationDecisionId: jobScopeVersions.authorizationDecisionId,
      }).from(jobScopeVersions)
        .where(and(
          eq(jobScopeVersions.requestId, selection.requestId),
          eq(jobScopeVersions.quoteId, selection.quoteId),
        ))
        .orderBy(desc(jobScopeVersions.version))
        .limit(1);
      const serviceCodes = parseExactServiceCodes(latestScope?.serviceCodes || "");
      const scopePrice = latestScope
        ? authorizedScopePrice(latestScope.priceBreakdown)
        : null;
      const jobFacts = latestScope
        ? jobScopeFactsFromScopeDetails(latestScope.scopeDetails)
        : null;
      const performingPersonId = selection.assignedPersonId
        || selection.performingPersonId;
      const supervisorPersonId = selection.assignedSupervisorPersonId
        || selection.supervisorPersonId;
      const scheduledFor = latestScope?.scheduledFor || "";
      if (
        !latestScope
        || latestScope.version !== selection.scopeVersion
        || latestScope.authorizationDecisionId !== selection.quoteAuthorizationDecisionId
        || !latestScope.customerAuthorizedAt
        || latestScope.scheduledFor !== selection.quoteScheduledFor
        || latestScope.scheduledFor !== selection.requestScheduledFor
        || !scopePrice
        || !jobFacts
        || Number(selection.providerAmount) !== scopePrice.totalAmountCents
        || Number(selection.customerFeeCents) !== scopePrice.customerFeeCents
        || Number(selection.customerTotalCents) !== scopePrice.customerTotalCents
        || !selection.quoteAuthorizationDecisionId
        || !performingPersonId
        || !scheduledFor
        || serviceCodes.length === 0
      ) {
        return Response.json({
          error: "The accepted quote does not exactly match its latest customer-authorized scope, schedule, performer, and complete price snapshot.",
          code: "CHECKOUT_SCOPE_AUTHORIZATION_MISSING",
        }, { status: 409, headers: { "cache-control": "no-store" } });
      }
      const [storedScopeDecision] = await getDb().select({
        stage: jobAuthorizationSnapshots.stage,
        decision: jobAuthorizationSnapshots.decision,
        requestId: jobAuthorizationSnapshots.requestId,
        quoteId: jobAuthorizationSnapshots.quoteId,
        providerId: jobAuthorizationSnapshots.providerId,
        performingPersonId: jobAuthorizationSnapshots.performingPersonId,
        serviceCodes: jobAuthorizationSnapshots.serviceCodes,
        scheduledFor: jobAuthorizationSnapshots.scheduledFor,
        scopeVersion: jobAuthorizationSnapshots.scopeVersion,
        assignmentVersion: jobAuthorizationSnapshots.assignmentVersion,
      }).from(jobAuthorizationSnapshots)
        .where(eq(
          jobAuthorizationSnapshots.id,
          selection.quoteAuthorizationDecisionId,
        ))
        .limit(1);
      if (
        storedScopeDecision?.stage !== (latestScope.version === 1 ? "booking" : "scope_change")
        || storedScopeDecision.decision !== "allow"
        || storedScopeDecision.requestId !== selection.requestId
        || storedScopeDecision.quoteId !== selection.quoteId
        || storedScopeDecision.providerId !== selection.providerApplicationId
        || storedScopeDecision.performingPersonId !== performingPersonId
        || JSON.stringify(parseExactServiceCodes(storedScopeDecision.serviceCodes)) !== JSON.stringify(serviceCodes)
        || storedScopeDecision.scheduledFor !== scheduledFor
        || storedScopeDecision.scopeVersion !== latestScope.version
        || storedScopeDecision.assignmentVersion !== selection.assignmentVersion
      ) {
        return Response.json({
          error: "The accepted quote is not bound to its latest customer-authorized scope decision.",
          code: "CHECKOUT_SCOPE_SNAPSHOT_MISMATCH",
        }, { status: 409, headers: { "cache-control": "no-store" } });
      }
      const operationalHolds = await activeJobOperationHoldReasons(selection.requestId);
      if (operationalHolds.length) {
        return Response.json({
          error: "Checkout is held while a job incident, cancellation, or scope authorization is unresolved.",
          code: "CHECKOUT_OPERATIONAL_HOLD",
          reasons: operationalHolds,
        }, { status: 409, headers: { "cache-control": "no-store" } });
      }
      const bookingEligibilityInput: StageEligibilityInput = {
        stage: "booking",
        providerId: selection.providerApplicationId,
        personId: performingPersonId,
        supervisorPersonId,
        serviceCodes,
        jurisdiction: selection.jurisdiction,
        scheduledFor,
        requestId: selection.requestId,
        quoteId: selection.quoteId,
        scopeVersion: latestScope.version,
        assignmentVersion: selection.assignmentVersion,
        customerProviderDisclosureAcceptedAt:
          selection.customerProviderDisclosureAcceptedAt,
        jobFacts,
        effectiveAt: now,
        testOnly: false,
        persist: true,
      };
      const bookingEligibility = await evaluateStageEligibility(bookingEligibilityInput);
      if (!bookingEligibility.allowed || !bookingEligibility.decisionId) {
        return Response.json({
          error: eligibilityErrorMessage(bookingEligibility),
          code: "CHECKOUT_BOOKING_ELIGIBILITY_DENIED",
          reasons: bookingEligibility.reasons,
        }, { status: 409, headers: { "cache-control": "no-store" } });
      }
      checkoutEligibilityValidThrough = bookingEligibility.validThrough;
      bookingEligibilityRecheckInput = {
        ...bookingEligibilityInput,
        persist: false,
      };
      const accountStatus = await retrieveRecipientAccountStatus(
        stripeClient,
        selection.connectedAccountId,
      );
      if (!accountStatus.readyToReceivePayments) {
        return Response.json(
          { error: "The selected provider must finish Stripe onboarding before checkout." },
          { status: 409 },
        );
      }

      requestId = selection.requestId;
      finalQuoteId = selection.quoteId;
      paymentScopeVersion = latestScope.version;
      scopeAuthorizationDecisionId = latestScope.authorizationDecisionId;
      authorizedPriceSnapshot = latestScope.priceBreakdown;
      productName = `${selection.service} -- ${selection.vehicle}`;
      providerApplicationId = selection.providerApplicationId;
      connectedAccountId = selection.connectedAccountId;
      customerEmail = selection.customerEmail;
      providerAmountCents = scopePrice.totalAmountCents;
      applicationFeeCents = scopePrice.customerFeeCents;
      customerTotalCents = scopePrice.customerTotalCents;
      settlementStrategy = "separate_transfer";
      lineItems = [
        {
          price_data: {
            currency,
            unit_amount: providerAmountCents,
            product_data: {
              name: productName,
              description: `Provider quote from ${selection.providerName}`,
            },
          },
          quantity: 1,
        },
        {
          price_data: {
            currency,
            unit_amount: applicationFeeCents,
            product_data: {
              name: "Tuveloz customer service fee",
              description: `${scopePrice.customerFeeRateBps / 100}% marketplace service fee`,
            },
          },
          quantity: 1,
        },
      ];

      const existing = await latestQuotePayment(selection.quoteId);
      if (
        existing
        && (
          existing.providerAmountCents !== providerAmountCents
          || existing.applicationFeeCents !== applicationFeeCents
          || existing.customerTotalCents !== customerTotalCents
          || existing.scopeVersion !== paymentScopeVersion
          || existing.scopeAuthorizationDecisionId !== scopeAuthorizationDecisionId
          || existing.authorizedPriceSnapshot !== authorizedPriceSnapshot
        )
      ) {
        return Response.json({
          error: "The authorized scope or price changed after this payment snapshot was created. The old Checkout Session cannot be reused.",
          code: "CHECKOUT_PAYMENT_SCOPE_SNAPSHOT_MISMATCH",
        }, { status: 409, headers: { "cache-control": "no-store" } });
      }
      if (existing && PAID_PAYMENT_STATUSES.includes(
        existing.status as (typeof PAID_PAYMENT_STATUSES)[number],
      )) {
        return Response.json(
          {
            error: "This accepted quote has already been paid.",
            payment: publicPaymentSummary(existing),
          },
          { status: 409 },
        );
      }
      if (existing && (
        REVIEW_PAYMENT_STATUSES.includes(
          existing.status as (typeof REVIEW_PAYMENT_STATUSES)[number],
        )
        || existing.refundAmountCents > 0
        || Boolean(existing.disputeStatus)
      )) {
        return Response.json(
          {
            error: "This quote has a refunded or disputed payment that requires owner review.",
            payment: publicPaymentSummary(existing),
          },
          { status: 409 },
        );
      }
      if (existing?.status === "checkout_open" && existing.checkoutSessionId) {
        const checkoutSession = await stripeClient.checkout.sessions.retrieve(
          existing.checkoutSessionId,
        );
        if (
          checkoutSession.livemode
          || checkoutSession.metadata?.tuveloz_payment_record_id !== existing.id
          || checkoutSession.metadata?.tuveloz_request_id !== selection.requestId
          || checkoutSession.metadata?.tuveloz_quote_id !== selection.quoteId
          || checkoutSession.metadata?.tuveloz_scope_version
            !== String(paymentScopeVersion)
          || checkoutSession.metadata?.tuveloz_scope_authorization_id
            !== scopeAuthorizationDecisionId
        ) {
          return Response.json({
            error: "The existing Checkout Session is not bound to the current test-mode job authorization and cannot be reused.",
            code: "CHECKOUT_SESSION_BINDING_MISMATCH",
          }, { status: 409, headers: { "cache-control": "no-store" } });
        }
        if (checkoutSession.status === "open" && checkoutSession.url) {
          if (!(await runtimeMarketplaceActionAllowed("checkout"))) {
            return marketplacePausedResponse();
          }
          await getDb().update(stripePayments).set({
            policyAcceptedAt: now,
            policyVersion: CHECKOUT_POLICY_BUNDLE_VERSION,
            updatedAt: now,
          }).where(eq(stripePayments.id, existing.id));
          return Response.json({ url: checkoutSession.url, reused: true });
        }
      }
      if (existing?.status === "checkout_expiration_unconfirmed") {
        return Response.json({
          error: "A prior Checkout Session could not be confirmed expired. TUVELOZ will not create or return another payment link until that session is reconciled.",
          code: "CHECKOUT_EXPIRATION_UNCONFIRMED",
        }, { status: 409, headers: { "cache-control": "no-store" } });
      }
      if (existing && ["checkout_creating", "checkout_release_recheck"].includes(existing.status)) {
        paymentId = existing.id;
      }
    }

    const transferGroup = `tuveloz_${paymentId}`;
    const existingRecord = await getDb().select({ id: stripePayments.id })
      .from(stripePayments)
      .where(eq(stripePayments.id, paymentId))
      .limit(1);
    if (existingRecord.length === 0) {
      // Save the immutable server-calculated snapshot before calling Stripe.
      // If the network fails, the same payment ID and idempotency key can be
      // retried without creating a second Checkout Session.
      await getDb().insert(stripePayments).values({
        id: paymentId,
        paymentType,
        requestId,
        quoteId: finalQuoteId,
        scopeVersion: paymentScopeVersion,
        scopeAuthorizationDecisionId,
        authorizedPriceSnapshot,
        stripeProductId: finalProductId,
        stripePriceId: priceId,
        productName,
        providerApplicationId,
        connectedAccountId,
        customerEmail,
        currency,
        quantity,
        providerAmountCents,
        applicationFeeCents,
        customerTotalCents,
        settlementStrategy,
        transferGroup,
        status: "checkout_creating",
        policyAcceptedAt: now,
        policyVersion: CHECKOUT_POLICY_BUNDLE_VERSION,
        createdAt: now,
        updatedAt: now,
      });
    } else {
      await getDb().update(stripePayments).set({
        policyAcceptedAt: now,
        policyVersion: CHECKOUT_POLICY_BUNDLE_VERSION,
        updatedAt: now,
      }).where(eq(stripePayments.id, paymentId));
    }

    const metadata: Record<string, string> = {
      tuveloz_payment_record_id: paymentId,
      tuveloz_payment_type: paymentType,
      tuveloz_provider_application_id: providerApplicationId,
      tuveloz_connected_account_id: connectedAccountId,
      tuveloz_policy_version: CHECKOUT_POLICY_BUNDLE_VERSION,
      ...(requestId ? { tuveloz_request_id: requestId } : {}),
      ...(finalQuoteId ? { tuveloz_quote_id: finalQuoteId } : {}),
      ...(paymentScopeVersion ? { tuveloz_scope_version: String(paymentScopeVersion) } : {}),
      ...(scopeAuthorizationDecisionId
        ? { tuveloz_scope_authorization_id: scopeAuthorizationDecisionId }
        : {}),
      ...(finalProductId ? { tuveloz_product_id: finalProductId } : {}),
    };
    const accountSession = await getAccountSession(request);
    const stripeCustomerId = accountSession?.role === "customer"
        && accountSession.email.toLowerCase() === customerEmail.toLowerCase()
      ? await getOrCreateStripeCustomer(stripeClient, accountSession.email)
      : "";
    const paymentIntentData: Stripe.Checkout.SessionCreateParams.PaymentIntentData =
      settlementStrategy === "destination_charge"
        ? {
            // Storefront products use the requested Destination Charge pattern:
            // Stripe transfers the provider amount immediately and leaves the
            // 10% application fee on the Tuveloz platform.
            application_fee_amount: applicationFeeCents,
            transfer_data: {
              destination: connectedAccountId,
            },
            transfer_group: transferGroup,
            metadata,
          }
        : {
            // Quote-based jobs intentionally omit transfer_data. Their provider
            // amount stays on the platform until completion and owner release.
            transfer_group: transferGroup,
            metadata,
          };

    const releaseDecision = await runtimeRealMarketplaceReleaseDecision();
    if (!releaseDecision.approved) {
      return marketplacePausedResponse();
    }
    metadata.tuveloz_launch_onboarding_ids =
      releaseDecision.providerOnboardingDecisionIds.join(",").slice(0, 500);
    metadata.tuveloz_launch_pilot_ids =
      releaseDecision.transactionPilotDecisionIds.join(",").slice(0, 500);
    metadata.tuveloz_service_activation_ids =
      releaseDecision.serviceActivationDecisionIds.join(",").slice(0, 500);
    metadata.tuveloz_launch_checked_at = releaseDecision.checkedAt;
    metadata.tuveloz_launch_valid_through = releaseDecision.validThrough;

    const nowSeconds = Math.floor(Date.now() / 1000);
    const eligibilityExpiry = Date.parse(
      checkoutEligibilityValidThrough.includes("T")
        ? checkoutEligibilityValidThrough
        : `${checkoutEligibilityValidThrough}T23:59:59.999Z`,
    );
    const launchExpiry = Date.parse(
      releaseDecision.validThrough.includes("T")
        ? releaseDecision.validThrough
        : `${releaseDecision.validThrough}T23:59:59.999Z`,
    );
    const minimumCheckoutExpiry = nowSeconds + (31 * 60);
    if (
      !checkoutEligibilityValidThrough
      || !Number.isFinite(eligibilityExpiry)
      || !releaseDecision.validThrough
      || !Number.isFinite(launchExpiry)
      || Math.floor(eligibilityExpiry / 1000) < minimumCheckoutExpiry
      || Math.floor(launchExpiry / 1000) < minimumCheckoutExpiry
    ) {
      return Response.json({
        error: "Current provider, service, insurance, or legal eligibility does not remain valid long enough to open a payment session.",
        code: "CHECKOUT_ELIGIBILITY_WINDOW_TOO_SHORT",
      }, { status: 409, headers: { "cache-control": "no-store" } });
    }
    const checkoutExpiresAt = Math.min(
      Math.floor(eligibilityExpiry / 1000),
      Math.floor(launchExpiry / 1000),
      nowSeconds + (24 * 60 * 60),
    );

    const checkoutSession = await stripeClient.checkout.sessions.create(
      {
        line_items: lineItems,
        payment_intent_data: paymentIntentData,
        metadata,
        mode: "payment",
        expires_at: checkoutExpiresAt,
        payment_method_types: ["card"],
        ...(stripeCustomerId
          ? {
              customer: stripeCustomerId,
              saved_payment_method_options: {
                payment_method_save: "enabled" as const,
              },
            }
          : { customer_email: customerEmail }),
        success_url: `${rootUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${rootUrl}/success?canceled=1`,
      },
      {
        idempotencyKey: `tuveloz-checkout-${paymentId}`,
      },
    );
    if (!checkoutSession.url) {
      throw new Error("Stripe returned a Checkout Session without a hosted URL.");
    }

    const trackedSession = await getDb().update(stripePayments).set({
      checkoutSessionId: checkoutSession.id,
      status: "checkout_release_recheck",
      updatedAt: new Date().toISOString(),
    }).where(and(
      eq(stripePayments.id, paymentId),
      eq(stripePayments.status, "checkout_creating"),
    )).returning({ id: stripePayments.id });
    if (!trackedSession.length) {
      if (checkoutSession.status === "open") {
        await stripeClient.checkout.sessions.expire(checkoutSession.id);
      }
      return Response.json({
        error: "Checkout state changed while Stripe was creating the payment session. No payment link was returned.",
        code: "CHECKOUT_TRACKING_CHANGED_DURING_CREATION",
      }, { status: 409, headers: { "cache-control": "no-store" } });
    }

    // Provider-, person-, evidence-, agreement-, insurance-, and service-level
    // eligibility can change independently of the global launch decision.
    // Re-evaluate after Stripe creates the Session and before returning its URL.
    const postCreateBookingEligibility = bookingEligibilityRecheckInput
      ? await evaluateStageEligibility({
          ...bookingEligibilityRecheckInput,
          effectiveAt: new Date().toISOString(),
          persist: false,
        })
      : null;
    const postCreateEligibilityValidThrough =
      postCreateBookingEligibility?.validThrough ?? "";
    const postCreateEligibilityExpiry = Date.parse(
      postCreateEligibilityValidThrough.includes("T")
        ? postCreateEligibilityValidThrough
        : `${postCreateEligibilityValidThrough}T23:59:59.999Z`,
    );
    if (
      !postCreateBookingEligibility?.allowed
      || !Number.isFinite(postCreateEligibilityExpiry)
      || Math.floor(postCreateEligibilityExpiry / 1000) < checkoutExpiresAt
    ) {
      try {
        if (checkoutSession.status === "open") {
          const expired = await stripeClient.checkout.sessions.expire(checkoutSession.id);
          if (expired.status !== "expired") {
            throw new Error("Stripe did not confirm Checkout expiration.");
          }
        } else if (checkoutSession.status !== "expired") {
          throw new Error("The eligibility-stale Checkout Session cannot be expired safely.");
        }
        await getDb().update(stripePayments).set({
          status: "checkout_expired_eligibility_changed",
          updatedAt: new Date().toISOString(),
        }).where(and(
          eq(stripePayments.id, paymentId),
          eq(stripePayments.status, "checkout_release_recheck"),
        ));
      } catch (expirationError) {
        await getDb().update(stripePayments).set({
          status: "checkout_expiration_unconfirmed",
          updatedAt: new Date().toISOString(),
        }).where(and(
          eq(stripePayments.id, paymentId),
          eq(stripePayments.status, "checkout_release_recheck"),
        ));
        console.error(
          "Unable to confirm Checkout expiration after provider eligibility changed",
          expirationError,
        );
        return Response.json({
          error: "Provider or service eligibility changed while Checkout was being created, and expiration could not be confirmed. No payment link was returned.",
          code: "CHECKOUT_ELIGIBILITY_EXPIRATION_UNCONFIRMED",
        }, { status: 502, headers: { "cache-control": "no-store" } });
      }
      return Response.json({
        error: "Provider or service eligibility changed while Checkout was being created. The payment session was expired and no link was returned.",
        code: "CHECKOUT_ELIGIBILITY_CHANGED_DURING_CREATION",
        reasons: postCreateBookingEligibility?.reasons ?? [],
      }, { status: 409, headers: { "cache-control": "no-store" } });
    }

    const postCreateReleaseDecision = await runtimeRealMarketplaceReleaseDecision();
    const releaseBindingChanged = (
      postCreateReleaseDecision.providerOnboardingDecisionIds.join(",")
        !== releaseDecision.providerOnboardingDecisionIds.join(",")
      || postCreateReleaseDecision.transactionPilotDecisionIds.join(",")
        !== releaseDecision.transactionPilotDecisionIds.join(",")
      || postCreateReleaseDecision.serviceActivationDecisionIds.join(",")
        !== releaseDecision.serviceActivationDecisionIds.join(",")
      || postCreateReleaseDecision.validThrough !== releaseDecision.validThrough
    );
    if (!postCreateReleaseDecision.approved || releaseBindingChanged) {
      try {
        if (checkoutSession.status === "open") {
          const expired = await stripeClient.checkout.sessions.expire(checkoutSession.id);
          if (expired.status !== "expired") {
            throw new Error("Stripe did not confirm Checkout expiration.");
          }
        } else if (checkoutSession.status !== "expired") {
          throw new Error("The newly created Checkout Session cannot be expired safely.");
        }
        await getDb().update(stripePayments).set({
          status: "checkout_expired_launch_readiness",
          updatedAt: new Date().toISOString(),
        }).where(and(
          eq(stripePayments.id, paymentId),
          eq(stripePayments.status, "checkout_release_recheck"),
        ));
      } catch (expirationError) {
        await getDb().update(stripePayments).set({
          status: "checkout_expiration_unconfirmed",
          updatedAt: new Date().toISOString(),
        }).where(and(
          eq(stripePayments.id, paymentId),
          eq(stripePayments.status, "checkout_release_recheck"),
        ));
        console.error("Unable to confirm Checkout expiration after launch readiness changed", expirationError);
        return Response.json({
          error: "Launch readiness changed while Checkout was being created, and expiration could not be confirmed. No payment link was returned.",
          code: "CHECKOUT_LAUNCH_EXPIRATION_UNCONFIRMED",
        }, { status: 502, headers: { "cache-control": "no-store" } });
      }
      return marketplacePausedResponse();
    }

    const openedPayment = await getDb().update(stripePayments).set({
      status: "checkout_open",
      updatedAt: new Date().toISOString(),
    }).where(and(
      eq(stripePayments.id, paymentId),
      eq(stripePayments.status, "checkout_release_recheck"),
      eq(stripePayments.requestId, requestId),
      eq(stripePayments.quoteId, finalQuoteId),
      eq(stripePayments.scopeVersion, paymentScopeVersion),
      eq(
        stripePayments.scopeAuthorizationDecisionId,
        scopeAuthorizationDecisionId,
      ),
      eq(stripePayments.authorizedPriceSnapshot, authorizedPriceSnapshot),
      exists(
        getDb().select({ id: jobScopeVersions.id }).from(jobScopeVersions)
          .where(and(
            eq(jobScopeVersions.requestId, requestId || ""),
            eq(jobScopeVersions.quoteId, finalQuoteId || ""),
            eq(jobScopeVersions.version, paymentScopeVersion),
            eq(
              jobScopeVersions.authorizationDecisionId,
              scopeAuthorizationDecisionId,
            ),
            eq(jobScopeVersions.priceBreakdown, authorizedPriceSnapshot),
          )),
      ),
      exists(
        getDb().select({ id: providerQuotes.id }).from(providerQuotes)
          .where(and(
            eq(providerQuotes.id, finalQuoteId || ""),
            eq(providerQuotes.requestId, requestId || ""),
            eq(providerQuotes.status, "accepted"),
            eq(providerQuotes.scopeVersion, paymentScopeVersion),
            eq(
              providerQuotes.authorizationDecisionId,
              scopeAuthorizationDecisionId,
            ),
            eq(providerQuotes.priceCents, String(providerAmountCents)),
            eq(providerQuotes.customerFeeCents, String(applicationFeeCents)),
            eq(providerQuotes.customerTotalCents, String(customerTotalCents)),
          )),
      ),
    )).returning({ id: stripePayments.id });
    if (!openedPayment.length) {
      try {
        if (checkoutSession.status === "open") {
          const expired = await stripeClient.checkout.sessions.expire(
            checkoutSession.id,
          );
          if (expired.status !== "expired") {
            throw new Error("Stripe did not confirm Checkout expiration.");
          }
        } else if (checkoutSession.status !== "expired") {
          throw new Error("The superseded Checkout Session cannot be expired safely.");
        }
      } catch (expirationError) {
        console.error(
          "Unable to expire a Checkout Session superseded during creation",
          expirationError,
        );
        return Response.json({
          error: "The job scope changed while Checkout was being created, and expiration of the superseded session could not be confirmed. No Checkout URL was returned.",
          code: "SUPERSEDED_CHECKOUT_EXPIRATION_UNCONFIRMED",
        }, { status: 502, headers: { "cache-control": "no-store" } });
      }
      await getDb().update(stripePayments).set({
        status: "checkout_invalidated_scope_change",
        updatedAt: new Date().toISOString(),
      }).where(and(
        eq(stripePayments.id, paymentId),
        eq(stripePayments.status, "checkout_release_recheck"),
      ));
      return Response.json({
        error: "The authorized job scope or price changed while Checkout was being created. The old session expired; request a new Checkout Session for the current authorization.",
        code: "CHECKOUT_SCOPE_CHANGED_DURING_CREATION",
      }, { status: 409, headers: { "cache-control": "no-store" } });
    }
    return Response.json({ url: checkoutSession.url });
  } catch (error) {
    return stripeErrorResponse(error, "Unable to create the Stripe Checkout session.");
  }
}
