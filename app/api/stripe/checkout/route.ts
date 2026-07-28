import { and, desc, eq } from "drizzle-orm";
import type Stripe from "stripe";
import { getDb } from "../../../../db";
import {
  customerRequests,
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
import { publicPaymentSummary } from "../../../../lib/stripe-payments";

const PAID_PAYMENT_STATUSES = [
  "paid_pending_completion",
  "ready_for_release",
  "released",
  "paid_and_transferred",
] as const;

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
      && session.email === selection.customerEmail;
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

  const body = (await request.json()) as {
    productId?: unknown;
    quoteId?: unknown;
    token?: unknown;
    customerEmail?: unknown;
    quantity?: unknown;
  };
  const productId = clean(body.productId, 120);
  const quoteId = clean(body.quoteId, 120);
  if (Boolean(productId) === Boolean(quoteId)) {
    return Response.json(
      { error: "Choose exactly one Stripe product or one accepted quote." },
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

      const existing = await latestQuotePayment(selection.quoteId);
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
      if (existing?.status === "checkout_open" && existing.checkoutSessionId) {
        const checkoutSession = await stripeClient.checkout.sessions.retrieve(
          existing.checkoutSessionId,
        );
        if (checkoutSession.status === "open" && checkoutSession.url) {
          return Response.json({ url: checkoutSession.url, reused: true });
        }
      }
      if (existing?.status === "checkout_creating") paymentId = existing.id;

      requestId = selection.requestId;
      finalQuoteId = selection.quoteId;
      productName = `${selection.service} — ${selection.vehicle}`;
      providerApplicationId = selection.providerApplicationId;
      connectedAccountId = selection.connectedAccountId;
      customerEmail = selection.customerEmail;
      providerAmountCents = Number(selection.providerAmount);
      const storedFee = Number(selection.customerFeeCents);
      const storedTotal = Number(selection.customerTotalCents);
      const totals = Number.isInteger(storedFee)
          && Number.isInteger(storedTotal)
          && storedTotal === providerAmountCents + storedFee
        ? {
            customerFeeCents: storedFee,
            customerTotalCents: storedTotal,
          }
        : customerPriceFor(
            providerAmountCents,
            selection.customerFeeRateBps,
          );
      applicationFeeCents = totals.customerFeeCents;
      customerTotalCents = totals.customerTotalCents;
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
              description: "10% marketplace service fee",
            },
          },
          quantity: 1,
        },
      ];
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
        createdAt: now,
        updatedAt: now,
      });
    }

    const metadata = {
      tuveloz_payment_record_id: paymentId,
      tuveloz_payment_type: paymentType,
      tuveloz_provider_application_id: providerApplicationId,
      tuveloz_connected_account_id: connectedAccountId,
      ...(requestId ? { tuveloz_request_id: requestId } : {}),
      ...(finalQuoteId ? { tuveloz_quote_id: finalQuoteId } : {}),
      ...(finalProductId ? { tuveloz_product_id: finalProductId } : {}),
    };
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

    const checkoutSession = await stripeClient.checkout.sessions.create(
      {
        line_items: lineItems,
        payment_intent_data: paymentIntentData,
        metadata,
        mode: "payment",
        payment_method_types: ["card"],
        customer_email: customerEmail,
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

    await getDb().update(stripePayments).set({
      checkoutSessionId: checkoutSession.id,
      status: "checkout_open",
      updatedAt: new Date().toISOString(),
    }).where(eq(stripePayments.id, paymentId));
    return Response.json({ url: checkoutSession.url });
  } catch (error) {
    return stripeErrorResponse(error, "Unable to create the Stripe Checkout session.");
  }
}
