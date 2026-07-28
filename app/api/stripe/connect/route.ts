import {
  getStripeClient,
  retrieveRecipientAccountStatus,
  stripeErrorResponse,
} from "../../../../lib/stripe";
import {
  authenticatedStripeProvider,
  createRecipientOnboardingLink,
  rejectCrossOriginStripeWrite,
} from "../../../../lib/stripe-provider";

export async function GET(request: Request) {
  const provider = await authenticatedStripeProvider(request);
  if (!provider) {
    return Response.json(
      { error: "Sign in to your verified provider account to manage Stripe payouts." },
      { status: 401 },
    );
  }

  if (!provider.stripeAccountId) {
    return Response.json({
      connected: false,
      providerName: provider.name,
    });
  }

  try {
    const stripeClient = getStripeClient();

    // Always retrieve current capability and requirement state from Stripe.
    const status = await retrieveRecipientAccountStatus(
      stripeClient,
      provider.stripeAccountId,
    );
    return Response.json({
      connected: true,
      providerName: provider.name,
      status,
    });
  } catch (error) {
    return stripeErrorResponse(error, "Unable to retrieve Stripe onboarding status.");
  }
}

export async function POST(request: Request) {
  const crossOriginResponse = rejectCrossOriginStripeWrite(request);
  if (crossOriginResponse) return crossOriginResponse;

  const provider = await authenticatedStripeProvider(request);
  if (!provider) {
    return Response.json(
      { error: "Sign in to your verified provider account to start Stripe onboarding." },
      { status: 401 },
    );
  }

  try {
    const stripeClient = getStripeClient();

    // This creates the V2 account when needed, then creates a fresh single-use
    // Account Link for Stripe-hosted identity and business onboarding.
    const accountLink = await createRecipientOnboardingLink(
      stripeClient,
      provider,
      request,
    );
    return Response.json({ url: accountLink.url });
  } catch (error) {
    return stripeErrorResponse(error, "Unable to start Stripe onboarding.");
  }
}
