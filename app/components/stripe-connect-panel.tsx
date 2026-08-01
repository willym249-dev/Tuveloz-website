"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";

type ConnectStatus = {
  accountId: string;
  displayName: string;
  dashboard: string;
  livemode: boolean;
  transferStatus: string;
  requirementsStatus: string;
  onboardingComplete: boolean;
  readyToReceivePayments: boolean;
  requirements: Array<{
    description: string;
    awaitingActionFrom: string;
  }>;
};

type ConnectResponse = {
  connected: boolean;
  providerName: string;
  status?: ConnectStatus;
  error?: string;
};

export function StripeConnectPanel({ signedIn }: { signedIn: boolean }) {
  const [connect, setConnect] = useState<ConnectResponse | null>(null);
  const [loading, setLoading] = useState(signedIn);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [productName, setProductName] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [productPrice, setProductPrice] = useState("");
  const [productAttemptId, setProductAttemptId] = useState("");
  const [productMessage, setProductMessage] = useState("");

  useEffect(() => {
    if (!signedIn) return;

    let active = true;
    fetch("/api/stripe/connect", { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json() as ConnectResponse;
        if (!response.ok) {
          throw new Error(result.error || "Unable to check Stripe onboarding.");
        }
        if (active) {
          setConnect(result);
          setError("");
        }
      })
      .catch((reason: unknown) => {
        if (active) {
          setError(
            reason instanceof Error
              ? reason.message
              : "Unable to check Stripe onboarding.",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [signedIn]);

  async function startOnboarding() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/stripe/connect", { method: "POST" });
      const result = await response.json() as { url?: string; error?: string };
      if (!response.ok || !result.url) {
        throw new Error(result.error || "Unable to start Stripe onboarding.");
      }
      window.location.assign(result.url);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to start Stripe onboarding.");
      setBusy(false);
    }
  }

  async function createProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setProductMessage("");
    const attemptId = productAttemptId || crypto.randomUUID();
    if (!productAttemptId) setProductAttemptId(attemptId);

    try {
      const response = await fetch("/api/stripe/products", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: productName,
          description: productDescription,
          priceInCents: Math.round(Number(productPrice) * 100),
          currency: "usd",
          idempotencyKey: attemptId,
        }),
      });
      const result = await response.json() as {
        productId?: string;
        error?: string;
      };
      if (!response.ok || !result.productId) {
        throw new Error(result.error || "Unable to create this Stripe product.");
      }

      setProductMessage("Offering created on the Tuveloz Stripe platform.");
      setProductName("");
      setProductDescription("");
      setProductPrice("");
      setProductAttemptId("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to create this Stripe product.");
    } finally {
      setBusy(false);
    }
  }

  if (!signedIn) {
    return (
      <section className="stripe-connect-panel">
        <div>
          <span className="kicker">Stripe Connect</span>
          <h2>Sign in before setting up payouts.</h2>
          <p>
            Stripe onboarding is available only from an active provider session,
            so private workspace links are never sent to Stripe.
          </p>
        </div>
        <Link className="button primary" href="/account?role=provider">
          Provider sign in
        </Link>
      </section>
    );
  }

  return (
    <section className="stripe-connect-panel" id="stripe-payouts">
      <div className="stripe-connect-heading">
        <div>
          <span className="kicker">Stripe Connect</span>
          <h2>Payments and payouts</h2>
          <p>
            Stripe securely collects identity and bank details. Tuveloz never
            stores those details.
          </p>
        </div>
        <Link className="button secondary" href="/storefront">View storefront</Link>
      </div>

      {loading ? (
        <p className="admin-note">Checking Stripe directly…</p>
      ) : (
        <>
          {error && <p className="form-error" role="alert">{error}</p>}
          {!connect?.connected ? (
            <div className="stripe-status-card">
              <strong>Not connected</strong>
              <p>
                Create your Express payout account and finish the Stripe-hosted
                onboarding form before accepting online payments.
              </p>
              <button
                className="button primary"
                disabled={busy}
                onClick={startOnboarding}
                type="button"
              >
                {busy ? "Opening Stripe…" : "Onboard to collect payments"}
              </button>
            </div>
          ) : connect.status && (
            <>
              <div className="stripe-status-grid">
                <article>
                  <span>Environment</span>
                  <strong>{connect.status.livemode ? "Live" : "Sandbox"}</strong>
                </article>
                <article>
                  <span>Onboarding</span>
                  <strong>{connect.status.onboardingComplete ? "Complete" : "Action needed"}</strong>
                </article>
                <article>
                  <span>Transfers</span>
                  <strong>{connect.status.transferStatus}</strong>
                </article>
                <article>
                  <span>Account</span>
                  <strong>••••{connect.status.accountId.slice(-8)}</strong>
                </article>
              </div>

              {!connect.status.readyToReceivePayments && (
                <div className="stripe-status-card needs-action">
                  <strong>Finish Stripe onboarding</strong>
                  <p>
                    Requirement status: {connect.status.requirementsStatus}.
                    Stripe transfers are currently {connect.status.transferStatus}.
                  </p>
                  {connect.status.requirements.length > 0 && (
                    <ul>
                      {connect.status.requirements.slice(0, 5).map((requirement) => (
                        <li key={`${requirement.awaitingActionFrom}-${requirement.description}`}>
                          {requirement.description}
                        </li>
                      ))}
                    </ul>
                  )}
                  <button
                    className="button primary"
                    disabled={busy}
                    onClick={startOnboarding}
                    type="button"
                  >
                    {busy ? "Opening Stripe…" : "Continue Stripe onboarding"}
                  </button>
                </div>
              )}

              {connect.status.readyToReceivePayments && (
                <form className="stripe-product-form" onSubmit={createProduct}>
                  <div>
                    <span className="kicker">Platform product</span>
                    <h3>Create a storefront offering</h3>
                    <p>
                      The product and price are created on Tuveloz, with your
                      connected-account mapping stored in Stripe metadata.
                    </p>
                  </div>
                  <label>
                    Offering name
                    <input
                      maxLength={120}
                      minLength={3}
                      onChange={(event) => setProductName(event.target.value)}
                      placeholder="Mobile battery installation"
                      required
                      value={productName}
                    />
                  </label>
                  <label>
                    Description
                    <textarea
                      maxLength={500}
                      minLength={3}
                      onChange={(event) => setProductDescription(event.target.value)}
                      placeholder="Explain exactly what the customer receives."
                      required
                      rows={3}
                      value={productDescription}
                    />
                  </label>
                  <label>
                    Provider price (USD)
                    <input
                      max="10000"
                      min="0.50"
                      onChange={(event) => setProductPrice(event.target.value)}
                      placeholder="125.00"
                      required
                      step="0.01"
                      type="number"
                      value={productPrice}
                    />
                    <small>The test configuration proposes a separate 10% customer fee; final live pricing and tax treatment require approval.</small>
                  </label>
                  <button className="button primary" disabled={busy} type="submit">
                    {busy ? "Creating…" : "Create Stripe product"}
                  </button>
                  {productMessage && <p className="portal-success" role="status">{productMessage}</p>}
                </form>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}
