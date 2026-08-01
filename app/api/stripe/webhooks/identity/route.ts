import Stripe from "stripe";
import {
  getStripeIdentityClient,
  getStripeWebhookSecret,
  stripeErrorResponse,
  stripeWebhookCryptoProvider,
} from "../../../../../lib/stripe";
import {
  recordStripeIdentityStatusEvent,
  recordStripeIdentityRedactionEvent,
  recordVerifiedStripeIdentitySession,
} from "../../../../../lib/stripe-identity-verification";
import {
  claimStripeWebhookEvent,
  completeStripeWebhookEvent,
  failStripeWebhookEvent,
} from "../../../../../lib/stripe-webhook-events";

const STATUS_EVENTS = new Set([
  "identity.verification_session.created",
  "identity.verification_session.processing",
  "identity.verification_session.requires_input",
  "identity.verification_session.canceled",
]);

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return Response.json({ error: "Missing Stripe-Signature header." }, { status: 400 });
  }

  let claimId = "";
  try {
    const stripe = getStripeIdentityClient();
    const rawBody = await request.text();
    const event = await stripe.webhooks.constructEventAsync(
      rawBody,
      signature,
      getStripeWebhookSecret("STRIPE_IDENTITY_WEBHOOK_SECRET"),
      undefined,
      stripeWebhookCryptoProvider(),
    );
    const eventSession = event.data.object as Stripe.Identity.VerificationSession;
    const claim = await claimStripeWebhookEvent({
      endpoint: "identity",
      eventId: event.id,
      eventType: event.type,
      livemode: event.livemode,
      objectId: eventSession.id,
    });
    claimId = claim.id;
    if (!claim.shouldProcess) {
      if (claim.busy) {
        return Response.json(
          { error: "This Stripe Identity event is already being processed; retry it." },
          { status: 503, headers: { "retry-after": "5" } },
        );
      }
      return Response.json({ received: true, duplicate: true });
    }

    let handled = false;
    if (event.type === "identity.verification_session.redacted") {
      // Stripe can erase metadata and verified outputs during redaction. The
      // signed event ID, livemode bit, and immutable stored session ID are the
      // authoritative non-PII binding; redaction never creates an approval.
      handled = await recordStripeIdentityRedactionEvent(
        event.id,
        event.created,
        eventSession.id,
        event.livemode,
      );
    } else if (event.type === "identity.verification_session.verified" || STATUS_EVENTS.has(event.type)) {
      // Webhook snapshots can arrive out of order. Retrieve Stripe's current
      // session for every supported status event. Sensitive verified outputs
      // are expanded only for a signed verified event and never persisted.
      const current = await stripe.identity.verificationSessions.retrieve(
        eventSession.id,
        event.type === "identity.verification_session.verified"
          ? { expand: ["verified_outputs"] }
          : undefined,
      );
      handled = event.type === "identity.verification_session.verified"
        && current.status === "verified"
        ? await recordVerifiedStripeIdentitySession(event.id, event.created, current)
        : await recordStripeIdentityStatusEvent(event.id, event.created, current);
    }
    if ((
      event.type === "identity.verification_session.verified"
      || event.type === "identity.verification_session.redacted"
      || STATUS_EVENTS.has(event.type)
    ) && !handled) {
      // A verified/status event arriving before the create route commits its
      // Stripe reference must be retried, never acknowledged and lost.
      throw new Error("Stripe Identity session binding is not available yet.");
    }
    await completeStripeWebhookEvent(claim.id, handled ? "processed" : "ignored");
    return Response.json({ received: true });
  } catch (error) {
    if (claimId) {
      try {
        await failStripeWebhookEvent(claimId);
      } catch (receiptError) {
        console.error("Unable to mark the Stripe Identity webhook attempt failed", receiptError);
      }
    }
    if (error instanceof Stripe.errors.StripeSignatureVerificationError) {
      return Response.json({ error: "Invalid Stripe Identity webhook signature." }, { status: 400 });
    }
    return stripeErrorResponse(error, "Unable to process the Stripe Identity webhook.");
  }
}
