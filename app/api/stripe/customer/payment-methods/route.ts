import type Stripe from "stripe";
import {
  getAccountSession,
  isSameOriginRequest,
} from "../../../../../lib/account-auth";
import {
  getOrCreateStripeCustomer,
  stripeCustomerIdForEmail,
} from "../../../../../lib/stripe-customers";
import {
  getStripeClient,
  siteUrlFor,
  stripeErrorResponse,
} from "../../../../../lib/stripe";
import {
  marketplacePausedMessage,
} from "../../../../../lib/launch-status";
import { runtimeMarketplaceActionAllowed } from "../../../../../lib/runtime-marketplace-action";
import { runtimeRealMarketplaceReleaseDecision } from "../../../../../lib/runtime-launch-readiness";

const NO_STORE_HEADERS = { "cache-control": "no-store" };

function response(data: unknown, status = 200) {
  return Response.json(data, { status, headers: NO_STORE_HEADERS });
}

function paymentSetupPausedResponse() {
  return response({
    error: marketplacePausedMessage("checkout"),
    code: "MARKETPLACE_ONBOARDING_ONLY",
  }, 503);
}

async function customerSession(request: Request) {
  const session = await getAccountSession(request);
  return session?.role === "customer" ? session : null;
}

function paymentMethodSummary(method: Stripe.PaymentMethod) {
  if (method.type !== "card" || !method.card) return null;
  return {
    id: method.id,
    brand: method.card.display_brand || method.card.brand,
    last4: method.card.last4,
    expMonth: method.card.exp_month,
    expYear: method.card.exp_year,
  };
}

export async function GET(request: Request) {
  const session = await customerSession(request);
  if (!session) return response({ error: "Customer sign-in required." }, 401);

  try {
    const stripeCustomerId = await stripeCustomerIdForEmail(session.email);
    if (!stripeCustomerId) return response({ paymentMethods: [] });

    const stripeClient = getStripeClient();
    const methods = await stripeClient.paymentMethods.list({
      customer: stripeCustomerId,
      type: "card",
      allow_redisplay: "always",
      limit: 20,
    });
    return response({
      paymentMethods: methods.data
        .map(paymentMethodSummary)
        .filter((method): method is NonNullable<typeof method> => Boolean(method)),
    });
  } catch (error) {
    const stripeResponse = stripeErrorResponse(
      error,
      "Unable to load saved payment methods.",
    );
    stripeResponse.headers.set("cache-control", "no-store");
    return stripeResponse;
  }
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return response({ error: "Cross-origin payment requests are not allowed." }, 403);
  }
  const session = await customerSession(request);
  if (!session) return response({ error: "Customer sign-in required." }, 401);
  if (!(await runtimeMarketplaceActionAllowed("checkout"))) {
    return paymentSetupPausedResponse();
  }

  try {
    const stripeClient = getStripeClient();
    const stripeCustomerId = await getOrCreateStripeCustomer(
      stripeClient,
      session.email,
    );
    const releaseDecision = await runtimeRealMarketplaceReleaseDecision();
    if (!releaseDecision.approved) {
      return paymentSetupPausedResponse();
    }
    const rootUrl = siteUrlFor(request);
    const checkoutSession = await stripeClient.checkout.sessions.create(
      {
        mode: "setup",
        currency: "usd",
        customer: stripeCustomerId,
        payment_method_types: ["card"],
        payment_method_data: {
          allow_redisplay: "always",
        },
        setup_intent_data: {
          description: "Payment method saved from the Tuveloz customer workspace",
          metadata: {
            tuveloz_customer_account: "true",
            tuveloz_launch_onboarding_ids:
              releaseDecision.providerOnboardingDecisionIds.join(",").slice(0, 500),
            tuveloz_launch_pilot_ids:
              releaseDecision.transactionPilotDecisionIds.join(",").slice(0, 500),
            tuveloz_launch_checked_at: releaseDecision.checkedAt,
          },
        },
        success_url: `${rootUrl}/customer?view=payments&payment_details=added`,
        cancel_url: `${rootUrl}/customer?view=payments&payment_details=canceled`,
      },
      {
        idempotencyKey: `tuveloz-payment-method-setup-${crypto.randomUUID()}`,
      },
    );
    if (!checkoutSession.url) {
      throw new Error("Stripe returned a setup session without a hosted URL.");
    }
    return response({ url: checkoutSession.url });
  } catch (error) {
    const stripeResponse = stripeErrorResponse(
      error,
      "Unable to open Stripe payment setup.",
    );
    stripeResponse.headers.set("cache-control", "no-store");
    return stripeResponse;
  }
}

export async function DELETE(request: Request) {
  if (!isSameOriginRequest(request)) {
    return response({ error: "Cross-origin payment requests are not allowed." }, 403);
  }
  const session = await customerSession(request);
  if (!session) return response({ error: "Customer sign-in required." }, 401);
  const body = await request.json().catch(() => ({})) as {
    paymentMethodId?: unknown;
  };
  const paymentMethodId = typeof body.paymentMethodId === "string"
    ? body.paymentMethodId.trim().slice(0, 120)
    : "";
  if (!/^pm_[A-Za-z0-9]+$/.test(paymentMethodId)) {
    return response({ error: "Choose a valid saved payment method." }, 400);
  }

  try {
    const stripeCustomerId = await stripeCustomerIdForEmail(session.email);
    if (!stripeCustomerId) {
      return response({ error: "Saved payment method not found." }, 404);
    }
    const stripeClient = getStripeClient();
    const method = await stripeClient.paymentMethods.retrieve(paymentMethodId);
    const ownerId = typeof method.customer === "string"
      ? method.customer
      : method.customer?.id;
    if (ownerId !== stripeCustomerId) {
      return response({ error: "Saved payment method not found." }, 404);
    }
    await stripeClient.paymentMethods.detach(paymentMethodId);
    return response({ ok: true });
  } catch (error) {
    const stripeResponse = stripeErrorResponse(
      error,
      "Unable to remove the saved payment method.",
    );
    stripeResponse.headers.set("cache-control", "no-store");
    return stripeResponse;
  }
}
