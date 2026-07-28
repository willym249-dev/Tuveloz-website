"use client";

import { useEffect, useState } from "react";

type PaymentSummary = {
  id: string;
  status: string;
  paidAt: string;
  releasedAt: string;
};

type QuotePaymentCardProps = {
  accessToken: string;
  quote: {
    id: string;
    providerName: string;
    priceCents: string;
    customerFeeCents: string;
    customerTotalCents: string;
  };
};

const COMPLETE_STATUSES = new Set([
  "paid_pending_completion",
  "ready_for_release",
  "released",
]);

function dollars(value: string) {
  return `$${(Number(value) / 100).toFixed(2)}`;
}

export function QuotePaymentCard({
  accessToken,
  quote,
}: QuotePaymentCardProps) {
  const [checkoutAllowed, setCheckoutAllowed] = useState(false);
  const [reason, setReason] = useState("");
  const [payment, setPayment] = useState<PaymentSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const query = new URLSearchParams({
      quoteId: quote.id,
      token: accessToken,
    });
    fetch(`/api/stripe/checkout?${query}`, { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json() as {
          checkoutAllowed?: boolean;
          reason?: string;
          payment?: PaymentSummary | null;
          error?: string;
        };
        if (!response.ok) throw new Error(result.error || "Unable to check payment readiness.");
        setCheckoutAllowed(result.checkoutAllowed ?? false);
        setReason(result.reason ?? "");
        setPayment(result.payment ?? null);
      })
      .catch((failure) => {
        setError(failure instanceof Error ? failure.message : "Unable to check payment readiness.");
      })
      .finally(() => setLoading(false));
  }, [accessToken, quote.id]);

  async function openCheckout() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          quoteId: quote.id,
          token: accessToken,
        }),
      });
      const result = await response.json() as {
        url?: string;
        error?: string;
        payment?: PaymentSummary;
      };
      if (!response.ok || !result.url) {
        if (result.payment) setPayment(result.payment);
        throw new Error(result.error || "Unable to open Stripe Checkout.");
      }
      window.location.assign(result.url);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Unable to open Stripe Checkout.");
      setBusy(false);
    }
  }

  return (
    <section className="quote-payment-card">
      <div>
        <span className="portal-service">Secure payment</span>
        <h2>Pay {quote.providerName}&apos;s accepted quote</h2>
        <p>
          Hosted Checkout is provided by Stripe. Tuveloz does not receive or
          store your card number.
        </p>
      </div>
      <dl className="quote-breakdown">
        <div><dt>Provider quote</dt><dd>{dollars(quote.priceCents)}</dd></div>
        <div><dt>Tuveloz service fee (10%)</dt><dd>{dollars(quote.customerFeeCents)}</dd></div>
        <div className="total"><dt>Total</dt><dd>{dollars(quote.customerTotalCents)}</dd></div>
      </dl>

      {loading ? (
        <p className="admin-note">Checking Stripe payment readiness…</p>
      ) : payment && COMPLETE_STATUSES.has(payment.status) ? (
        <div className="portal-success">
          {payment.status === "released"
            ? "✓ Paid. The completed-job provider payment has been released."
            : payment.status === "ready_for_release"
              ? "✓ Paid. The completed job is ready for owner-reviewed payout release."
              : "✓ Paid. The provider amount will be released after job completion and owner review."}
        </div>
      ) : (
        <>
          {reason && <p className="admin-note">{reason}</p>}
          {error && <p className="form-error" role="alert">{error}</p>}
          <button
            className="button primary"
            disabled={!checkoutAllowed || busy}
            onClick={openCheckout}
            type="button"
          >
            {busy
              ? "Opening Stripe…"
              : payment?.status === "checkout_open"
                ? "Continue secure checkout"
                : `Pay ${dollars(quote.customerTotalCents)} with Stripe`}
          </button>
          <small className="payment-release-note">
            For quote-based jobs, Tuveloz charges the customer now and transfers
            the provider&apos;s full quoted subtotal only after completion and
            owner confirmation.
          </small>
        </>
      )}
    </section>
  );
}
