import Stripe from "stripe";
import {
  getStripeClient,
  getStripeWebhookSecret,
  stripeErrorResponse,
  stripeWebhookCryptoProvider,
} from "../../../../../lib/stripe";
import {
  recordCheckoutSessionStatus,
  recordPaidCheckoutSession,
} from "../../../../../lib/stripe-payments";

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return Response.json({ error: "Missing Stripe-Signature header." }, { status: 400 });
  }

  try {
    const stripeClient = getStripeClient();
    const webhookSecret = getStripeWebhookSecret("STRIPE_PAYMENT_WEBHOOK_SECRET");

    // Signature verification requires the untouched request text. Parsing JSON
    // first would change the signed bytes and make verification unreliable.
    const rawBody = await request.text();
    const event = await stripeClient.webhooks.constructEventAsync(
      rawBody,
      signature,
      webhookSecret,
      undefined,
      stripeWebhookCryptoProvider(),
    );

    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded":
        await recordPaidCheckoutSession(stripeClient, event.data.object);
        break;
      case "checkout.session.async_payment_failed":
        await recordCheckoutSessionStatus(event.data.object, "payment_failed");
        break;
      case "checkout.session.expired":
        await recordCheckoutSessionStatus(event.data.object, "checkout_expired");
        break;
      default:
        // A 2xx response acknowledges unrelated events so Stripe does not retry
        // them. Add an explicit handler before subscribing to another event.
        break;
    }

    return Response.json({ received: true });
  } catch (error) {
    if (error instanceof Stripe.errors.StripeSignatureVerificationError) {
      return Response.json({ error: "Invalid Stripe webhook signature." }, { status: 400 });
    }
    return stripeErrorResponse(error, "Unable to process the Stripe payment webhook.");
  }
}
