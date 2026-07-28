import { eq } from "drizzle-orm";
import type Stripe from "stripe";
import { getDb } from "../db";
import { providerApplications } from "../db/schema";
import {
  getAccountSession,
  isSameOriginRequest,
  providerAccountFor,
} from "./account-auth";
import { siteUrlFor } from "./stripe";

export async function authenticatedStripeProvider(request: Request) {
  const session = await getAccountSession(request);
  if (!session || session.role !== "provider") return null;
  return providerAccountFor(session.email);
}

export function rejectCrossOriginStripeWrite(request: Request) {
  if (isSameOriginRequest(request)) return null;
  return Response.json({ error: "Cross-origin Stripe requests are not allowed." }, { status: 403 });
}

/**
 * Creates the V2 connected account once and saves only its ID on Tuveloz's
 * provider record. The idempotency key makes a network retry return the same
 * Stripe account instead of creating a duplicate.
 */
export async function findOrCreateRecipientAccount(
  stripeClient: Stripe,
  provider: typeof providerApplications.$inferSelect,
) {
  if (provider.stripeAccountId) return provider.stripeAccountId;

  const account = await stripeClient.v2.core.accounts.create(
    {
      // Keep this object intentionally limited to the fields approved in the
      // integration design. V2 Accounts must not receive a top-level `type`.
      display_name: provider.name,
      contact_email: provider.email,
      identity: {
        country: "us",
      },
      dashboard: "express",
      defaults: {
        responsibilities: {
          fees_collector: "application",
          losses_collector: "application",
        },
      },
      configuration: {
        recipient: {
          capabilities: {
            stripe_balance: {
              stripe_transfers: {
                requested: true,
              },
            },
          },
        },
      },
    },
    {
      idempotencyKey: `tuveloz-connect-account-${provider.id}`,
    },
  );

  await getDb().update(providerApplications)
    .set({ stripeAccountId: account.id })
    .where(eq(providerApplications.id, provider.id));

  return account.id;
}

/**
 * Account Links are single-use, so every click (and every Stripe refresh)
 * creates a fresh link. Both callback URLs require the provider's signed-in
 * session; private provider workspace tokens are never placed in Stripe URLs.
 */
export async function createRecipientOnboardingLink(
  stripeClient: Stripe,
  provider: typeof providerApplications.$inferSelect,
  request: Request,
) {
  const accountId = await findOrCreateRecipientAccount(stripeClient, provider);
  const rootUrl = siteUrlFor(request);
  return stripeClient.v2.core.accountLinks.create({
    account: accountId,
    use_case: {
      type: "account_onboarding",
      account_onboarding: {
        configurations: ["recipient"],
        refresh_url: `${rootUrl}/api/stripe/connect/refresh`,
        return_url: `${rootUrl}/provider-jobs?stripe=return&accountId=${encodeURIComponent(accountId)}`,
      },
    },
  });
}
