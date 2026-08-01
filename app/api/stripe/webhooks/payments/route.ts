import Stripe from "stripe";
import {
  getStripeClient,
  getStripeWebhookSecret,
  stripeErrorResponse,
  stripeWebhookCryptoProvider,
} from "../../../../../lib/stripe";
import {
  recordCheckoutSessionStatus,
  recordDisputeStatus,
  recordPaidCheckoutSession,
  recordRefundedCharge,
  recordRefundStatus,
  stripeObjectId,
} from "../../../../../lib/stripe-payments";
import {
  claimStripeWebhookEvent,
  completeStripeWebhookEvent,
  failStripeWebhookEvent,
} from "../../../../../lib/stripe-webhook-events";

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return Response.json({ error: "Missing Stripe-Signature header." }, { status: 400 });
  }

  let claimId = "";
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
    const eventObject = event.data.object as { id?: unknown };
    const claim = await claimStripeWebhookEvent({
      endpoint: "payments",
      eventId: event.id,
      eventType: event.type,
      livemode: event.livemode,
      connectedAccountId: stripeObjectId(event.account),
      objectId: typeof eventObject.id === "string" ? eventObject.id : "",
    });
    claimId = claim.id;
    if (!claim.shouldProcess) {
      if (claim.busy) {
        return Response.json(
          { error: "This Stripe event is already being processed; retry it." },
          { status: 503, headers: { "retry-after": "5" } },
        );
      }
      return Response.json({ received: true, duplicate: true });
    }

    let handled = true;
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
      case "charge.refunded":
        await recordRefundedCharge(stripeClient, event.data.object);
        break;
      case "charge.refund.updated":
      case "refund.created":
      case "refund.failed":
      case "refund.updated":
        await recordRefundStatus(
          stripeClient,
          event.data.object,
          event.id,
          event.created,
        );
        break;
      case "charge.dispute.created":
      case "charge.dispute.updated":
      case "charge.dispute.closed":
      case "charge.dispute.funds_reinstated":
      case "charge.dispute.funds_withdrawn":
        await recordDisputeStatus(
          stripeClient,
          event.data.object,
          event.id,
          event.created,
        );
        break;
      default:
        // A 2xx response acknowledges unrelated events so Stripe does not retry
        // them. Add an explicit handler before subscribing to another event.
        handled = false;
        break;
    }
    await completeStripeWebhookEvent(claim.id, handled ? "processed" : "ignored");

    return Response.json({ received: true });
  } catch (error) {
    if (claimId) {
      try {
        await failStripeWebhookEvent(claimId);
      } catch (receiptError) {
        console.error("Unable to mark the Stripe payment webhook attempt failed", receiptError);
      }
    }
    if (error instanceof Stripe.errors.StripeSignatureVerificationError) {
      return Response.json({ error: "Invalid Stripe webhook signature." }, { status: 400 });
    }
    return stripeErrorResponse(error, "Unable to process the Stripe payment webhook.");
  }
}
