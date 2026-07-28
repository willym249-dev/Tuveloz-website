import Stripe from "stripe";
import {
  getStripeClient,
  getStripeWebhookSecret,
  retrieveRecipientAccountStatus,
  stripeErrorResponse,
  stripeWebhookCryptoProvider,
} from "../../../../../lib/stripe";

async function handleRequirementsUpdated(
  stripeClient: Stripe,
  accountId: string,
  stripeContext?: Stripe.StripeContextType,
) {
  const status = await retrieveRecipientAccountStatus(
    stripeClient,
    accountId,
    stripeContext,
  );
  console.info("Stripe connected-account requirements changed", {
    accountId,
    requirementsStatus: status.requirementsStatus,
    outstandingRequirements: status.requirements.length,
  });
}

async function handleRecipientCapabilityUpdated(
  stripeClient: Stripe,
  accountId: string,
  stripeContext?: Stripe.StripeContextType,
) {
  const status = await retrieveRecipientAccountStatus(
    stripeClient,
    accountId,
    stripeContext,
  );
  console.info("Stripe connected-account recipient capability changed", {
    accountId,
    transferStatus: status.transferStatus,
    readyToReceivePayments: status.readyToReceivePayments,
  });
}

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return Response.json({ error: "Missing Stripe-Signature header." }, { status: 400 });
  }

  try {
    const stripeClient = getStripeClient();
    const webhookSecret = getStripeWebhookSecret("STRIPE_CONNECT_WEBHOOK_SECRET");
    const rawBody = await request.text();

    // V2 Accounts require thin events. The latest SDK calls this
    // parseEventNotificationAsync (the successor to older parseThinEvent
    // examples) and verifies the signature before exposing the event ID.
    const thinEvent = await stripeClient.parseEventNotificationAsync(
      rawBody,
      signature,
      webhookSecret,
      undefined,
      stripeWebhookCryptoProvider(),
    );

    // Fetch the complete V2 event through the same Stripe Client. Passing the
    // event context is important for organization or connected-account events.
    const event = await stripeClient.v2.core.events.retrieve(
      thinEvent.id,
      {},
      thinEvent.context ? { stripeContext: thinEvent.context } : undefined,
    );
    switch (event.type) {
      case "v2.core.account[requirements].updated":
        await handleRequirementsUpdated(
          stripeClient,
          event.related_object.id,
          thinEvent.context,
        );
        break;
      case "v2.core.account[configuration.recipient].capability_status_updated":
        await handleRecipientCapabilityUpdated(
          stripeClient,
          event.related_object.id,
          thinEvent.context,
        );
        break;
      default:
        break;
    }

    return Response.json({ received: true });
  } catch (error) {
    if (error instanceof Stripe.errors.StripeSignatureVerificationError) {
      return Response.json({ error: "Invalid Stripe thin-event signature." }, { status: 400 });
    }
    return stripeErrorResponse(error, "Unable to process the Stripe Connect webhook.");
  }
}
