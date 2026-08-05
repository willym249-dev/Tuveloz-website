"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { customerPriceFor } from "../../lib/customer-fee";
import { CUSTOMER_JOB_POSTING_PAUSED } from "../../lib/launch-status";
import { SiteLanguageButton } from "../components/site-language";
import { BrandMark } from "../components/tuveloz-icons";

type StorefrontProduct = {
  id: string;
  name: string;
  description: string;
  unitAmount: number;
  currency: string;
  providerName: string;
  providerReady: boolean;
};

type ConnectedAccount = {
  providerId: string;
  providerName: string;
  accountReference: string;
  readyToReceivePayments: boolean;
  transferStatus: string;
};

type AccountState = "checking" | "signed-out" | "customer" | "provider";

function dollars(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

function StorefrontClosedPage() {
  return (
    <main className="storefront-shell stripe-storefront">
      <header className="storefront-header">
        <Link className="brand" href="/"><BrandMark />Tuveloz</Link>
        <div className="portal-header-actions">
          <Link className="portal-account-link" href="/account">Sign up / Sign in</Link>
          <SiteLanguageButton />
        </div>
      </header>

      <section className="stripe-storefront-hero">
        <span className="kicker">Payments are closed</span>
        <h1>Customer payments are not open yet.</h1>
        <p>
          Tuveloz is accepting customer account signups and provider applications
          while we build a larger network of approved providers.
        </p>
        <p>
          Products, prices, appointments, checkout forms, and payment links are
          unavailable during provider onboarding. Creating an account or applying
          as a provider does not post a job or create a charge.
        </p>
        <div className="portal-header-actions">
          <Link className="button primary" href="/account">Create or open an account</Link>
          <Link className="button secondary" href="/join">Apply as a provider</Link>
          <Link className="button secondary" href="/payments">Read the payment policy</Link>
        </div>
      </section>
    </main>
  );
}

function LiveStripeStorefrontPage() {
  const [products, setProducts] = useState<StorefrontProduct[]>([]);
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [buyingId, setBuyingId] = useState("");
  const [acceptedPaymentPolicy, setAcceptedPaymentPolicy] = useState(false);
  const [error, setError] = useState("");
  const [accountState, setAccountState] = useState<AccountState>("checking");

  useEffect(() => {
    const controller = new AbortController();

    fetch("/api/account", {
      cache: "no-store",
      credentials: "same-origin",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (response.status === 401) {
          setAccountState("signed-out");
          return;
        }
        if (!response.ok) throw new Error("Account status unavailable.");

        const result = (await response.json()) as {
          email?: string;
          role?: "customer" | "provider";
        };
        if (result.role === "customer" || result.role === "provider") {
          setAccountState(result.role);
          if (result.role === "customer" && result.email) {
            setEmail((current) => current || result.email || "");
          }
          return;
        }
        setAccountState("checking");
      })
      .catch((failure) => {
        if (failure instanceof DOMException && failure.name === "AbortError") return;
        setAccountState("checking");
      });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    fetch("/api/stripe/products", { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json() as {
          products?: StorefrontProduct[];
          connectedAccounts?: ConnectedAccount[];
          error?: string;
        };
        if (!response.ok) throw new Error(result.error || "Unable to load the storefront.");
        setProducts(result.products ?? []);
        setAccounts(result.connectedAccounts ?? []);
      })
      .catch((failure) => {
        setError(failure instanceof Error ? failure.message : "Unable to load the storefront.");
      })
      .finally(() => setLoading(false));
  }, []);

  async function buy(productId: string) {
    setBuyingId(productId);
    setError("");
    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          productId,
          quantity: 1,
          customerEmail: email,
          policyAccepted: acceptedPaymentPolicy,
        }),
      });
      const result = await response.json() as { url?: string; error?: string };
      if (!response.ok || !result.url) {
        throw new Error(result.error || "Unable to open Stripe Checkout.");
      }
      window.location.assign(result.url);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Unable to open Stripe Checkout.");
      setBuyingId("");
    }
  }

  const accountHref =
    accountState === "customer"
      ? "/customer"
      : accountState === "provider"
        ? "/provider-jobs"
        : "/account";
  const accountLabel =
    accountState === "customer"
      ? "Customer account"
      : accountState === "provider"
        ? "Provider account"
        : accountState === "signed-out"
          ? "Sign up or sign in"
          : "Account";

  return (
    <main className="storefront-shell stripe-storefront">
      <header className="storefront-header">
        <Link className="brand" href="/"><BrandMark />Tuveloz</Link>
        <div className="portal-header-actions">
          <Link className="portal-account-link" href={accountHref}>{accountLabel}</Link>
          <SiteLanguageButton />
        </div>
      </header>

      <section className="stripe-storefront-hero">
        <span className="kicker">Stripe storefront</span>
        <h1>Customer payments are not yet available.</h1>
        <p>
          The current test configuration uses provider-set prices and proposes a
          separate 5% Customer Service Fee. Final fees, tax treatment, settlement roles,
          and refund terms require approval and conspicuous checkout disclosure.
        </p>
        <label>
          Receipt email
          <input
            autoComplete="email"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            type="email"
            value={email}
          />
        </label>
        <label className="policy-consent payment-policy-consent">
          <input
            checked={acceptedPaymentPolicy}
            onChange={(event) => setAcceptedPaymentPolicy(event.target.checked)}
            type="checkbox"
          />
          <span>
            I am 18 or older and agree to the <Link href="/terms">Terms</Link>,{" "}
            <Link href="/customer-agreement">Customer Agreement</Link>, and{" "}
            <Link href="/payments">Payment Policy</Link>.
          </span>
        </label>
        {error && <p className="form-error" role="alert">{error}</p>}
      </section>

      <section className="stripe-account-roster">
        <div className="storefront-section-heading">
          <div><span className="kicker">Connected accounts</span><h2>Providers on Stripe Connect</h2></div>
          <p>Status is retrieved directly from Stripe when this page loads.</p>
        </div>
        {loading ? (
          <p className="admin-note">Loading Stripe accounts…</p>
        ) : accounts.length === 0 ? (
          <p className="admin-note">No connected provider accounts are ready yet.</p>
        ) : (
          <div className="stripe-account-grid">
            {accounts.map((account) => (
              <article key={account.providerId}>
                <span>{account.readyToReceivePayments ? "Ready" : "Onboarding"}</span>
                <strong>{account.providerName}</strong>
                <small>
                  Account ••••{account.accountReference} · transfers {account.transferStatus}
                </small>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="stripe-product-section">
        <div className="storefront-section-heading">
          <div><span className="kicker">Products</span><h2>Available offerings</h2></div>
          <p>Products and default prices are stored on the Tuveloz Stripe platform.</p>
        </div>
        {loading ? (
          <p className="admin-note">Loading Stripe products…</p>
        ) : products.length === 0 ? (
          <div className="storefront-empty">
            <span>No products yet</span>
            <p>A connected provider can create the first offering from their workspace.</p>
          </div>
        ) : (
          <div className="stripe-product-grid">
            {products.map((product) => {
              const totals = customerPriceFor(product.unitAmount);
              return (
                <article key={product.id}>
                  <span className="portal-service">{product.providerName}</span>
                  <h2>{product.name}</h2>
                  <p>{product.description}</p>
                  <dl className="quote-breakdown compact">
                    <div><dt>Provider price</dt><dd>{dollars(product.unitAmount)}</dd></div>
                    <div><dt>Customer Service Fee (5%)</dt><dd>{dollars(totals.customerFeeCents)}</dd></div>
                    <div className="total"><dt>Total</dt><dd>{dollars(totals.customerTotalCents)}</dd></div>
                  </dl>
                  <button
                    className="button primary"
                    disabled={
                      !product.providerReady
                      || !email
                      || !acceptedPaymentPolicy
                      || Boolean(buyingId)
                    }
                    onClick={() => buy(product.id)}
                    type="button"
                  >
                    {buyingId === product.id
                      ? "Opening Stripe…"
                      : product.providerReady
                        ? "Buy with Stripe"
                        : "Provider onboarding"}
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}

export default function StripeStorefrontPage() {
  return CUSTOMER_JOB_POSTING_PAUSED
    ? <StorefrontClosedPage />
    : <LiveStripeStorefrontPage />;
}
