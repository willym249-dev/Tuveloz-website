"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CUSTOMER_JOB_POSTING_PAUSED } from "../../lib/launch-status";

type PaymentSummary = {
  id: string;
  scopeVersion: number;
  status: string;
  paidAt: string;
  releasedAt: string;
  refundAmountCents: number;
  disputeStatus: string;
};

type CheckoutAcceptance = {
  agreementKey: string;
  agreementVersion: string;
  agreementHash: string;
  presentedText: string;
  cancellationRefundSummary: string;
  scope: {
    providerLegalName: string;
    serviceCodes: string[];
    scheduledFor: string;
    performingPersonId: string;
    supervisorPersonId: string;
    laborAmountCents: number;
    partsAmountCents: number;
    taxAmountCents: number;
    otherAmountCents: number;
    providerAmountCents: number;
    customerFeeCents: number;
    customerTotalCents: number;
  };
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
  "refund_pending",
  "refund_requires_action",
  "refund_failed_review",
  "refund_canceled_review",
  "refund_status_review",
  "disputed",
  "dispute_won_review",
  "dispute_lost",
]);

const CHECKOUT_STATUS_TOKEN_KEY = "tuveloz:checkout-status-token";

function dollars(value: string | number) {
  return `$${(Number(value) / 100).toFixed(2)}`;
}

function ActiveQuotePaymentCard({
  accessToken,
  quote,
}: QuotePaymentCardProps) {
  const laborOnlyQuote = (
    Number(quote.partsPriceCents) === 0
    && Number(quote.priceCents) === Number(quote.laborPriceCents)
  );
  const [checkoutAllowed, setCheckoutAllowed] = useState(false);
  const [reason, setReason] = useState("");
  const [payment, setPayment] = useState<PaymentSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [acceptedPaymentPolicy, setAcceptedPaymentPolicy] = useState(false);
  const [checkoutAcceptance, setCheckoutAcceptance] =
    useState<CheckoutAcceptance | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const query = new URLSearchParams({ quoteId: quote.id });
    fetch(`/api/stripe/checkout?${query}`, {
      cache: "no-store",
      headers: accessToken
        ? { "x-tuveloz-request-token": accessToken }
        : undefined,
    })
      .then(async (response) => {
        const result = await response.json() as {
          checkoutAllowed?: boolean;
          reason?: string;
          payment?: PaymentSummary | null;
          checkoutAcceptance?: CheckoutAcceptance | null;
          error?: string;
        };
        if (!response.ok) throw new Error(result.error || "Unable to check payment readiness.");
        setCheckoutAllowed(result.checkoutAllowed ?? false);
        setReason(result.reason ?? "");
        setPayment(result.payment ?? null);
        setCheckoutAcceptance(result.checkoutAcceptance ?? null);
        setAcceptedPaymentPolicy(false);
      })
      .catch((failure) => {
        setError(failure instanceof Error ? failure.message : "Unable to check payment readiness.");
      })
      .finally(() => setLoading(false));
  }, [accessToken, quote.id]);

  async function openCheckout() {
    if (!laborOnlyQuote) {
      setError("Checkout is blocked because this quote is not labor only.");
      return;
    }
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
          checkoutAgreementKey: checkoutAcceptance?.agreementKey,
          checkoutAgreementVersion: checkoutAcceptance?.agreementVersion,
          checkoutAgreementHash: checkoutAcceptance?.agreementHash,
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
      if (accessToken) {
        window.sessionStorage.setItem(CHECKOUT_STATUS_TOKEN_KEY, accessToken);
      } else {
        window.sessionStorage.removeItem(CHECKOUT_STATUS_TOKEN_KEY);
      }
      window.location.assign(result.url);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Unable to open Stripe Checkout.");
      setBusy(false);
    }
  }

  function downloadAcceptance() {
    if (!checkoutAcceptance) return;
    const content = JSON.stringify({
      quoteId: quote.id,
      ...checkoutAcceptance,
    }, null, 2);
    const url = URL.createObjectURL(new Blob([content], {
      type: "application/json",
    }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `tuveloz-checkout-authorization-${quote.id}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
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
        <div><dt>Parts charged through Tuveloz</dt><dd>$0.00</dd></div>
        <div><dt>Complete authorized labor amount</dt><dd>{dollars(quote.priceCents)}</dd></div>
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
              ? "✓ Paid. The recorded job is ready for owner-reviewed payout release."
              : "✓ Paid. The provider amount will be released after recorded completion and owner payment review."}
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
          {!laborOnlyQuote && (
            <p className="form-error" role="alert">
              Checkout is blocked because the stored quote contains a parts or non-labor amount.
            </p>
          )}
          {error && <p className="form-error" role="alert">{error}</p>}
          {checkoutAcceptance ? (
            <>
              <dl className="quote-breakdown" aria-label="Exact checkout authorization">
                <div><dt>Provider legal identity</dt><dd>{checkoutAcceptance.scope.providerLegalName}</dd></div>
                <div><dt>Exact service codes</dt><dd>{checkoutAcceptance.scope.serviceCodes.join(", ")}</dd></div>
                <div><dt>Scheduled time</dt><dd>{checkoutAcceptance.scope.scheduledFor}</dd></div>
                <div><dt>Performing person ID</dt><dd>{checkoutAcceptance.scope.performingPersonId}</dd></div>
                <div><dt>Supervisor person ID</dt><dd>{checkoutAcceptance.scope.supervisorPersonId || "none"}</dd></div>
                <div><dt>Labor</dt><dd>{dollars(checkoutAcceptance.scope.laborAmountCents)}</dd></div>
                <div><dt>Parts</dt><dd>{dollars(checkoutAcceptance.scope.partsAmountCents)}</dd></div>
                <div><dt>Tax</dt><dd>{dollars(checkoutAcceptance.scope.taxAmountCents)}</dd></div>
                <div><dt>Other charges</dt><dd>{dollars(checkoutAcceptance.scope.otherAmountCents)}</dd></div>
                <div><dt>Complete provider amount</dt><dd>{dollars(checkoutAcceptance.scope.providerAmountCents)}</dd></div>
                <div><dt>Tuveloz service fee</dt><dd>{dollars(checkoutAcceptance.scope.customerFeeCents)}</dd></div>
                <div className="total"><dt>Customer total</dt><dd>{dollars(checkoutAcceptance.scope.customerTotalCents)}</dd></div>
              </dl>
              <p className="admin-note">
                <strong>Cancellation and refund summary:</strong>{" "}
                {checkoutAcceptance.cancellationRefundSummary}
              </p>
              <label className="policy-consent payment-policy-consent">
                <input
                  checked={acceptedPaymentPolicy}
                  onChange={(event) => setAcceptedPaymentPolicy(event.target.checked)}
                  type="checkbox"
                />
                <span>
                  I confirm this payment includes vehicle-service labor only and no
                  provider-supplied parts, parts reimbursement, parts tax, or parts charge.{" "}
                  {checkoutAcceptance.presentedText}{" "}
                  <Link href="/terms">Terms of Use</Link>{" · "}
                  <Link href="/customer-agreement">Customer Agreement</Link>{" · "}
                  <Link href="/payments">Payment, Cancellation and Refund Policy</Link>
                </span>
              </label>
              <button className="button secondary" onClick={downloadAcceptance} type="button">
                Download this exact authorization
              </button>
            </>
          ) : (
            <p className="admin-note">
              Checkout acceptance is unavailable until the exact released policies,
              provider, scope, schedule, price, fee, and refund summary are bound together.
            </p>
          )}
          <button
            className="button primary"
            disabled={!checkoutAllowed || !checkoutAcceptance || !laborOnlyQuote || !acceptedPaymentPolicy || busy}
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
            total, and configured Tuveloz fee (currently 10% in test) before the
            customer accepts.
          </small>
        </>
      )}
      <small className="payment-release-note">
        Owner payout review is an administrative payment-control step only. It is not an
        inspection, endorsement, or certification of repairs, parts, safety, legal compliance,
        or workmanship.
      </small>
    </section>
  );
}

export function QuotePaymentCard(props: QuotePaymentCardProps) {
  if (CUSTOMER_JOB_POSTING_PAUSED) {
    return (
      <section className="quote-payment-card">
        <div>
          <span className="portal-service">Customer payments are closed</span>
          <h2>No payment is due through Tuveloz.</h2>
          <p>
            Checkout, charges, and provider payouts are disabled during provider
            onboarding. This panel does not contact Stripe or create a payment.
          </p>
        </div>
        <Link className="button secondary" href="/payments">
          Read the payment launch policy
        </Link>
      </section>
    );
  }

  return <ActiveQuotePaymentCard {...props} />;
}
