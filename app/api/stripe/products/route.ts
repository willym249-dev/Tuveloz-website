import type Stripe from "stripe";
import { getDb } from "../../../../db";
import { providerApplications } from "../../../../db/schema";
import { isSameOriginRequest } from "../../../../lib/account-auth";
import {
  getStripeClient,
  retrieveRecipientAccountStatus,
  stripeErrorResponse,
} from "../../../../lib/stripe";
import { authenticatedStripeProvider } from "../../../../lib/stripe-provider";

function clean(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function expandedDefaultPrice(product: Stripe.Product) {
  return product.default_price
    && typeof product.default_price !== "string"
    && !("deleted" in product.default_price)
    ? product.default_price
    : null;
}

export async function GET() {
  try {
    const stripeClient = getStripeClient();

    // Products live on the Tuveloz platform account. Expanding default_price
    // avoids one extra Stripe request for every storefront card.
    const [platformProducts, providers] = await Promise.all([
      stripeClient.products.list({
        active: true,
        limit: 100,
        expand: ["data.default_price"],
      }).autoPagingToArray({ limit: 10_000 }),
      getDb().select({
        id: providerApplications.id,
        name: providerApplications.name,
        stripeAccountId: providerApplications.stripeAccountId,
        status: providerApplications.status,
        verificationStatus: providerApplications.verificationStatus,
        isTestProvider: providerApplications.isTestProvider,
      }).from(providerApplications),
    ]);

    const connectedProviders = providers.filter((provider) => (
      provider.stripeAccountId
      && provider.status === "approved"
      && provider.verificationStatus === "verified"
      && provider.isTestProvider === "no"
    ));
    const providersById = new Map(
      connectedProviders.map((provider) => [provider.id, provider]),
    );

    // The storefront shows every connected provider, and each status comes
    // directly from Stripe rather than from a cached database flag.
    const accountResults = await Promise.allSettled(
      connectedProviders.map(async (provider) => ({
        provider,
        status: await retrieveRecipientAccountStatus(
          stripeClient,
          provider.stripeAccountId!,
        ),
      })),
    );
    const accounts = accountResults.map((result, index) => {
      const provider = connectedProviders[index];
      if (result.status === "rejected") {
        return {
          providerId: provider.id,
          providerName: provider.name,
          accountReference: provider.stripeAccountId?.slice(-8) ?? "",
          readyToReceivePayments: false,
          transferStatus: "unavailable",
        };
      }
      return {
        providerId: provider.id,
        providerName: provider.name,
        accountReference: result.value.status.accountId.slice(-8),
        readyToReceivePayments: result.value.status.readyToReceivePayments,
        transferStatus: result.value.status.transferStatus,
      };
    });

    // Follow Stripe pagination so the storefront displays every active
    // platform product instead of silently stopping after the first page.
    const products = platformProducts.flatMap((product) => {
      const price = expandedDefaultPrice(product);
      const providerId = product.metadata.tuveloz_provider_application_id;
      const connectedAccountId = product.metadata.tuveloz_connected_account_id;
      const provider = providersById.get(providerId);

      // Ignore products whose metadata no longer matches an active connected
      // provider. Checkout repeats this validation on the server.
      if (
        !price
        || !price.active
        || price.type !== "one_time"
        || price.unit_amount === null
        || !provider?.stripeAccountId
        || provider.stripeAccountId !== connectedAccountId
      ) {
        return [];
      }

      return [{
        id: product.id,
        name: product.name,
        description: product.description ?? "",
        priceId: price.id,
        unitAmount: price.unit_amount,
        currency: price.currency,
        providerId: provider.id,
        providerName: provider.name,
        providerReady: accounts.some((account) => (
          account.providerId === provider.id && account.readyToReceivePayments
        )),
      }];
    });

    return Response.json({ products, connectedAccounts: accounts });
  } catch (error) {
    return stripeErrorResponse(error, "Unable to load the Stripe storefront.");
  }
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "Cross-origin product creation is not allowed." }, { status: 403 });
  }

  const provider = await authenticatedStripeProvider(request);
  if (!provider) {
    return Response.json(
      { error: "Sign in to a verified provider account before creating an offering." },
      { status: 401 },
    );
  }
  if (!provider.stripeAccountId) {
    return Response.json(
      { error: "Complete Stripe Connect onboarding before creating an offering." },
      { status: 409 },
    );
  }

  const body = (await request.json()) as {
    name?: unknown;
    description?: unknown;
    priceInCents?: unknown;
    currency?: unknown;
    idempotencyKey?: unknown;
  };
  const name = clean(body.name, 120);
  const description = clean(body.description, 500);
  const priceInCents = Number(body.priceInCents);
  const currency = clean(body.currency, 3).toLowerCase() || "usd";
  const idempotencyKey = clean(body.idempotencyKey, 80);

  if (name.length < 3 || description.length < 3) {
    return Response.json(
      { error: "Enter a product name and a short customer-facing description." },
      { status: 400 },
    );
  }
  if (!Number.isInteger(priceInCents) || priceInCents < 50 || priceInCents > 1_000_000) {
    return Response.json(
      { error: "Enter a price from $0.50 through $10,000.00." },
      { status: 400 },
    );
  }
  if (currency !== "usd") {
    return Response.json(
      { error: "This Tuveloz sample currently creates USD products only." },
      { status: 400 },
    );
  }
  if (!/^[a-zA-Z0-9_-]{16,80}$/.test(idempotencyKey)) {
    return Response.json(
      { error: "Refresh the page and try creating the product again." },
      { status: 400 },
    );
  }

  try {
    const stripeClient = getStripeClient();
    const accountStatus = await retrieveRecipientAccountStatus(
      stripeClient,
      provider.stripeAccountId,
    );
    if (!accountStatus.readyToReceivePayments) {
      return Response.json(
        { error: "Stripe onboarding is not complete enough to receive transfers yet." },
        { status: 409 },
      );
    }

    // No connected-account request option is passed here: the product and its
    // default price are intentionally created on the platform account.
    const product = await stripeClient.products.create(
      {
        name,
        description,
        default_price_data: {
          unit_amount: priceInCents,
          currency,
        },
        metadata: {
          tuveloz_provider_application_id: provider.id,
          tuveloz_connected_account_id: provider.stripeAccountId,
          tuveloz_provider_name: provider.name,
        },
      },
      {
        idempotencyKey: `tuveloz-product-${idempotencyKey}`,
      },
    );

    return Response.json({ ok: true, productId: product.id }, { status: 201 });
  } catch (error) {
    return stripeErrorResponse(error, "Unable to create the Stripe product.");
  }
}
