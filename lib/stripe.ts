import { env } from "cloudflare:workers";
import Stripe from "stripe";
import { MARKETPLACE_MODE } from "./launch-status";

type RuntimeEnvironment = Record<string, string | undefined>;

export class StripeConfigurationError extends Error {}

// This is intentionally a code-controlled release gate. An environment value
// alone cannot turn on live money movement while the deployed marketplace is
// still onboarding-only.
export const STRIPE_LIVE_MODE_ENABLED = false as const;

// Identity has a separate release lock from payments. This constant was
// deliberately enabled for the provider-side launch (2026-08-04): live
// verification still requires the STRIPE_IDENTITY_ALLOW_LIVE_MODE secret, a
// dedicated rk_live_ Identity key and the webhook
// secret — none of which ship with the code. Payments remain code-locked
// separately via STRIPE_LIVE_MODE_ENABLED above.
export const STRIPE_IDENTITY_LIVE_MODE_ENABLED = true as const;

export function stripeLiveModeEnabled() {
  return Boolean(STRIPE_LIVE_MODE_ENABLED)
    && String(MARKETPLACE_MODE) === "live"
    && runtimeEnvironment().STRIPE_ALLOW_LIVE_MODE === "true";
}

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

function stripeIdentityKeyMode(value: string) {
  if (value.startsWith("rk_test_")) return "test" as const;
  if (value.startsWith("rk_live_")) return "live" as const;
  return "not_configured" as const;
}

export function stripeIdentityLiveModeEnabled() {
  return Boolean(STRIPE_IDENTITY_LIVE_MODE_ENABLED)
    && runtimeEnvironment().STRIPE_IDENTITY_ALLOW_LIVE_MODE === "true";
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
    && !stripeLiveModeEnabled()
  ) {
    throw new StripeConfigurationError(
      "A live Stripe key was provided while live mode is code-disabled. Use a sandbox sk_test_ key; an environment variable cannot enable live payments before a reviewed marketplace release.",
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

export function stripeIdentityConfigurationReady() {
  const runtime = runtimeEnvironment();
  const providers = (runtime.IDENTITY_VERIFICATION_PROVIDERS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase());
  const key = runtime.STRIPE_IDENTITY_SECRET_KEY?.trim() ?? "";
  const keyMode = stripeIdentityKeyMode(key);
  const webhookSecret = runtime.STRIPE_IDENTITY_WEBHOOK_SECRET?.trim() ?? "";
  const safeKeyConfigured = keyMode === "test"
    || (keyMode === "live" && stripeIdentityLiveModeEnabled());
  return providers.includes("stripe_identity")
    && safeKeyConfigured
    && webhookSecret.startsWith("whsec_");
}

/**
 * Identity is isolated from payment release and has its own code-controlled
 * live-mode lock. This client is exported only for Stripe Identity operations.
 */
export function getStripeIdentityClient() {
  if (!stripeIdentityConfigurationReady()) {
    throw new StripeConfigurationError(
      "Stripe Identity is unavailable until stripe_identity and its API and webhook secrets are configured.",
    );
  }
  const secretKey = requiredRuntimeValue("STRIPE_IDENTITY_SECRET_KEY");
  const keyMode = stripeIdentityKeyMode(secretKey);
  if (keyMode === "live" && !stripeIdentityLiveModeEnabled()) {
    throw new StripeConfigurationError(
      "A live Stripe Identity key was provided while Identity live mode is code-disabled. Use the dedicated rk_test_ key until the reviewed live release.",
    );
  }
  if (keyMode === "not_configured") {
    throw new StripeConfigurationError(
      "STRIPE_IDENTITY_SECRET_KEY must be a dedicated restricted rk_test_ or reviewed rk_live_ key.",
    );
  }
  return new Stripe(secretKey, {
    httpClient: Stripe.createFetchHttpClient(),
    appInfo: {
      name: "Tuveloz Identity",
      version: "0.1.0",
      url: "https://tuveloz.com",
    },
  });
}

export function stripeIdentityKeyIsLive() {
  const key = runtimeEnvironment().STRIPE_IDENTITY_SECRET_KEY?.trim() ?? "";
  return stripeIdentityKeyMode(key) === "live";
}

export function stripeIdentityModeMatchesProvider(isTestProvider: string) {
  if (!stripeIdentityConfigurationReady()) return false;
  const keyMode = stripeIdentityKeyMode(
    runtimeEnvironment().STRIPE_IDENTITY_SECRET_KEY?.trim() ?? "",
  );
  return isTestProvider === "yes"
    ? keyMode === "test"
    : keyMode === "live" && stripeIdentityLiveModeEnabled();
}

export function getStripeWebhookSecret(
  name:
    | "STRIPE_CONNECT_WEBHOOK_SECRET"
    | "STRIPE_CONNECTED_ACCOUNT_WEBHOOK_SECRET"
    | "STRIPE_PAYMENT_WEBHOOK_SECRET"
    | "STRIPE_IDENTITY_WEBHOOK_SECRET",
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
