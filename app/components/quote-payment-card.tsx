"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type PaymentSummary = {
  id: string;
  scopeVersion: number;
  status: string;
  paidAt: string;
  releasedAt: string;
  refundAmountCents: number;
  disputeStatus: string;
};

type QuotePaymentCardProps = {
  accessToken: string;
  quote: {
    id: string;
    providerName: string;
    priceCents: string;
    laborPriceCents: string;
    partsPriceCents: string;
    customerFeeRateBps: number;
    customerFeeCents: string;
    customerTotalCents: string;
    scopeVersion: number;
  };
};

const COMPLETE_STATUSES = new Set([
  "paid_pending_completion",
  "ready_for_release",
  "released",
]);

const REVIEW_STATUSES = new Set([
  "refunded",
  "partially_refunded",
  "disputed",
  "dispute_won_review",
  "dispute_lost",
]);

function dollars(value: string | number) {
  return `$${(Number(value) / 100).toFixed(2)}`;
}

export function QuotePaymentCard({
  accessToken,
  quote,
}: QuotePaymentCardProps) {
  const taxAndOtherCents = Math.max(
    0,
    Number(quote.priceCents)
      - Number(quote.laborPriceCents)
      - Number(quote.partsPriceCents),
  );
  const [checkoutAllowed, setCheckoutAllowed] = useState(false);
  const [reason, setReason] = useState("");
  const [payment, setPayment] = useState<PaymentSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [acceptedPaymentPolicy, setAcceptedPaymentPolicy] = useState(false);
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
          policyAccepted: acceptedPaymentPolicy,
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
        <div><dt>Provider labor</dt><dd>{dollars(quote.laborPriceCents)}</dd></div>
        <div><dt>Provider parts</dt><dd>{dollars(quote.partsPriceCents)}</dd></div>
        <div><dt>Authorized tax and other charges</dt><dd>{dollars(taxAndOtherCents)}</dd></div>
        <div><dt>Complete authorized provider amount</dt><dd>{dollars(quote.priceCents)}</dd></div>
        <div>
          <dt>Tuveloz service fee ({quote.customerFeeRateBps / 100}%)</dt>
          <dd>{dollars(quote.customerFeeCents)}</dd>
        </div>
        <div className="total"><dt>Total</dt><dd>{dollars(quote.customerTotalCents)}</dd></div>
      </dl>
      <small className="payment-release-note">
        Authorized job scope version {quote.scopeVersion}.
      </small>

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
      ) : payment && (
        REVIEW_STATUSES.has(payment.status)
        || payment.refundAmountCents > 0
        || Boolean(payment.disputeStatus)
      ) ? (
        <p className="form-error" role="status">
          This payment is under owner review because it was refunded or disputed.
          Contact hello@tuveloz.com before attempting another payment.
        </p>
      ) : (
        <>
          {reason && <p className="admin-note">{reason}</p>}
          {error && <p className="form-error" role="alert">{error}</p>}
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
          <button
            className="button primary"
            disabled={!checkoutAllowed || !acceptedPaymentPolicy || busy}
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
            Real checkout is currently disabled. If the proposed flow receives
            final approval, the checkout screen must show the provider subtotal,
            total, and Configured Tuveloz fee (currently 10% in test) before the
            customer accepts.
          </small>
        </>
      )}
    </section>
  );
}
