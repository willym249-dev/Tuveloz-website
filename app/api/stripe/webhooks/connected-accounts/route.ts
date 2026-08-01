import Stripe from "stripe";
import {
  getStripeClient,
  getStripeWebhookSecret,
  stripeErrorResponse,
  stripeWebhookCryptoProvider,
} from "../../../../../lib/stripe";
import {
  connectedAccountSnapshotEventSupported,
  recordConnectedAccountSnapshotEvent,
} from "../../../../../lib/stripe-connected-account-snapshots";
import { stripeObjectId } from "../../../../../lib/stripe-payments";
import {
  claimStripeWebhookEvent,
  completeStripeWebhookEvent,
  failStripeWebhookEvent,
} from "../../../../../lib/stripe-webhook-events";

/**
 * Standard snapshot destination for connected-account payout and external
 * account events. Do not send V2 thin events here; they use /connect and a
 * different signing secret.
 */
export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return Response.json({ error: "Missing Stripe-Signature header." }, { status: 400 });
  }

  let claimId = "";
  try {
    const stripeClient = getStripeClient();
    const webhookSecret = getStripeWebhookSecret(
      "STRIPE_CONNECTED_ACCOUNT_WEBHOOK_SECRET",
    );
    const rawBody = await request.text();
    const event = await stripeClient.webhooks.constructEventAsync(
      rawBody,
      signature,
      webhookSecret,
      undefined,
      stripeWebhookCryptoProvider(),
    );
    const object = event.data.object as { id?: unknown };
    const claim = await claimStripeWebhookEvent({
      endpoint: "connected_account_snapshot",
      eventId: event.id,
      eventType: event.type,
      livemode: event.livemode,
      connectedAccountId: stripeObjectId(event.account),
      objectId: typeof object.id === "string" ? object.id : "",
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

    const supported = connectedAccountSnapshotEventSupported(event.type);
    const recorded = supported
      ? await recordConnectedAccountSnapshotEvent(event)
      : false;
    await completeStripeWebhookEvent(
      claim.id,
      supported && recorded ? "processed" : "ignored",
    );
    return Response.json({ received: true });
  } catch (error) {
    if (claimId) {
      try {
        await failStripeWebhookEvent(claimId);
      } catch (receiptError) {
        console.error(
          "Unable to mark the connected-account snapshot webhook attempt failed",
          receiptError,
        );
      }
    }
    if (error instanceof Stripe.errors.StripeSignatureVerificationError) {
      return Response.json(
        { error: "Invalid Stripe connected-account snapshot signature." },
        { status: 400 },
      );
    }
    return stripeErrorResponse(
      error,
      "Unable to process the Stripe connected-account snapshot webhook.",
    );
  }
}
