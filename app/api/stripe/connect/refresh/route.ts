import {
  getStripeClient,
  stripeErrorResponse,
} from "../../../../../lib/stripe";
import {
  authenticatedStripeProvider,
  createRecipientOnboardingLink,
} from "../../../../../lib/stripe-provider";

export async function GET(request: Request) {
  const provider = await authenticatedStripeProvider(request);
  if (!provider) {
    return Response.json(
      { error: "Sign in again before refreshing the Stripe onboarding link." },
      { status: 401 },
    );
  }

  try {
    const stripeClient = getStripeClient();

    // Stripe sends expired or already-used links here. Generate a replacement
    // for the same authenticated provider and immediately continue onboarding.
    const accountLink = await createRecipientOnboardingLink(
      stripeClient,
      provider,
      request,
    );
    return Response.redirect(accountLink.url, 303);
  } catch (error) {
    return stripeErrorResponse(error, "Unable to refresh Stripe onboarding.");
  }
}
