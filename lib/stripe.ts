import { env } from "cloudflare:workers";
import Stripe from "stripe";

type RuntimeEnvironment = Record<string, string | undefined>;

export class StripeConfigurationError extends Error {}

function runtimeEnvironment() {
  return env as unknown as RuntimeEnvironment;
}

function requiredRuntimeValue(name: string) {
  const value = runtimeEnvironment()[name]?.trim() ?? "";
  if (!value || /^(your_|replace_|placeholder)/i.test(value)) {
    throw new StripeConfigurationError(
      `${name} is not configured. Add it as a private Cloudflare secret before using Stripe.`,
    );
  }
  return value;
}

/**
 * Creates the one Stripe Client used by every server-side Stripe operation.
 *
 * The SDK's default API version is intentionally not overridden. stripe-node
 * 22.3.2 already defaults to 2026-06-24.dahlia, so future SDK upgrades can
 * bring their matching API version without a second version setting here.
 */
export function getStripeClient() {
  const secretKey = requiredRuntimeValue("STRIPE_SECRET_KEY");

  // Keep a copied live key from silently turning a local demo into real money.
  // An adult legal owner can deliberately enable live mode after the full
  // business, compliance, dispute, and refund review is complete.
  if (
    secretKey.startsWith("sk_live_")
    && runtimeEnvironment().STRIPE_ALLOW_LIVE_MODE !== "true"
  ) {
    throw new StripeConfigurationError(
      "A live Stripe key was provided while live mode is disabled. Use a sandbox sk_test_ key, or have the legal owner explicitly set STRIPE_ALLOW_LIVE_MODE=true after launch review.",
    );
  }

  return new Stripe(secretKey, {
    // Cloudflare Workers use fetch rather than Node's native HTTP module.
    httpClient: Stripe.createFetchHttpClient(),
    appInfo: {
      name: "Tuveloz",
      version: "0.1.0",
      url: "https://tuveloz.com",
    },
  });
}

export function getStripeWebhookSecret(
  name: "STRIPE_CONNECT_WEBHOOK_SECRET" | "STRIPE_PAYMENT_WEBHOOK_SECRET",
) {
  return requiredRuntimeValue(name);
}

export function stripeWebhookCryptoProvider() {
  return Stripe.createSubtleCryptoProvider();
}

export function siteUrlFor(request: Request) {
  const configured = runtimeEnvironment().SITE_URL?.trim().replace(/\/+$/, "");
  return configured || new URL(request.url).origin;
}

export type RecipientAccountStatus = {
  accountId: string;
  displayName: string;
  dashboard: string;
  livemode: boolean;
  transferStatus: "active" | "pending" | "restricted" | "unsupported" | "unrequested";
  requirementsStatus: "currently_due" | "eventually_due" | "past_due" | "none";
  onboardingComplete: boolean;
  readyToReceivePayments: boolean;
  requirements: Array<{
    description: string;
    awaitingActionFrom: string;
  }>;
};

/**
 * Reads onboarding state directly from Stripe. The database stores only the
 * provider-to-account mapping; capability and requirement state is never
 * cached because Stripe can change it at any time.
 */
export async function retrieveRecipientAccountStatus(
  stripeClient: Stripe,
  accountId: string,
  stripeContext?: Stripe.StripeContextType,
): Promise<RecipientAccountStatus> {
  const account = await stripeClient.v2.core.accounts.retrieve(
    accountId,
    {
      include: ["configuration.recipient", "requirements"],
    },
    stripeContext ? { stripeContext } : undefined,
  );

  const transferStatus = account.configuration
    ?.recipient
    ?.capabilities
    ?.stripe_balance
    ?.stripe_transfers
    ?.status ?? "unrequested";
  const requirementsStatus =
    account.requirements?.summary?.minimum_deadline?.status ?? "none";

  return {
    accountId: account.id,
    displayName: account.display_name ?? "Connected provider",
    dashboard: account.dashboard ?? "express",
    livemode: account.livemode,
    transferStatus,
    requirementsStatus,
    onboardingComplete:
      requirementsStatus !== "currently_due" && requirementsStatus !== "past_due",
    readyToReceivePayments: transferStatus === "active",
    requirements: (account.requirements?.entries ?? []).map((entry) => ({
      description: entry.description,
      awaitingActionFrom: entry.awaiting_action_from,
    })),
  };
}

export function stripeErrorResponse(error: unknown, fallback: string) {
  if (error instanceof StripeConfigurationError) {
    return Response.json({ error: error.message }, { status: 503 });
  }

  // Stripe's raw error can contain request details that do not belong in a
  // public response. Log it server-side and return a stable, helpful message.
  console.error(fallback, error);
  return Response.json({ error: fallback }, { status: 502 });
}
