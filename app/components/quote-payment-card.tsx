"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CUSTOMER_JOB_POSTING_PAUSED } from "../../lib/launch-status";
import { PAYMENT_MERCHANT_DISCLOSURE } from "../../lib/payment-merchant";
import { useSiteLanguage, type SiteLanguage } from "./site-language";

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
  language: SiteLanguage;
  agreementKey: string;
  agreementVersion: string;
  agreementHash: string;
  presentedText: string;
  cancellationRefundSummary: string;
  scope: {
    quoteId: string;
    scopeVersion: number;
    providerLegalName: string;
    serviceCodes: string[];
    scheduledFor: string;
    performingPersonId: string;
    supervisorPersonId: string;
    workmanshipWarranty: string;
    laborAmountCents: number;
    partsAmountCents: number;
    taxAmountCents: number;
    otherAmountCents: number;
    providerAmountCents: number;
    customerFeeRateBps: number;
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
  const { language } = useSiteLanguage();
  const [retry, setRetry] = useState(0);
  // Remount before rendering a changed quote or access context. Old consent,
  // downloads and in-flight redirects must never carry into a new presentation.
  const presentationKey = JSON.stringify([
    accessToken, language, retry, quote.id, quote.scopeVersion, quote.providerName,
    quote.priceCents, quote.laborPriceCents, quote.partsPriceCents,
    quote.customerFeeRateBps, quote.customerFeeCents, quote.customerTotalCents,
  ]);
  return (
    <QuoteCheckout
      key={presentationKey}
      accessToken={accessToken}
      quote={quote}
      language={language}
      onRetry={() => setRetry(value => value + 1)}
    />
  );
}

function QuoteCheckout({ accessToken, quote, language, onRetry }: QuotePaymentCardProps & {
  language: SiteLanguage;
  onRetry: () => void;
}) {
  const {
    id: quoteId, scopeVersion, priceCents, laborPriceCents, partsPriceCents,
    customerFeeRateBps, customerFeeCents, customerTotalCents,
  } = quote;
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
  const [quoteChanged, setQuoteChanged] = useState(false);
  const checkoutRequest = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      controller.abort();
      setError("Checking this quote took too long. Please try again.");
      setLoading(false);
    }, 20_000);
    const query = new URLSearchParams({ quoteId, language });
    fetch(`/api/stripe/checkout?${query}`, {
      cache: "no-store",
      signal: controller.signal,
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
        if (controller.signal.aborted) return;
        if (!response.ok) throw new Error(result.error || "Unable to check payment readiness.");
        if (result.checkoutAcceptance && result.checkoutAcceptance.language !== language) {
          throw new Error(language === "es"
            ? "No pudimos cargar el acuerdo de pago en español. Vuelve a intentarlo."
            : "We couldn’t load the payment agreement in English. Please try again.");
        }
        const scope = result.checkoutAcceptance?.scope;
        if (result.checkoutAcceptance && (
          !scope || scope.quoteId !== quoteId || scope.scopeVersion !== scopeVersion
          || scope.providerAmountCents !== Number(priceCents)
          || scope.laborAmountCents !== Number(laborPriceCents)
          || scope.partsAmountCents !== Number(partsPriceCents)
          || scope.customerFeeRateBps !== customerFeeRateBps
          || scope.customerFeeCents !== Number(customerFeeCents)
          || scope.customerTotalCents !== Number(customerTotalCents)
        )) {
          setQuoteChanged(true);
          throw new Error("This quote changed. Refresh the page to review the latest details before paying.");
        }
        setCheckoutAllowed(result.checkoutAllowed === true);
        setReason(result.reason ?? "");
        setPayment(result.payment ?? null);
        setCheckoutAcceptance(result.checkoutAcceptance ?? null);
        setAcceptedPaymentPolicy(false);
      })
      .catch((failure) => {
        if (controller.signal.aborted) return;
        setError(failure instanceof Error ? failure.message : "Unable to check payment readiness.");
      })
      .finally(() => {
        window.clearTimeout(timeout);
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
      checkoutRequest.current?.abort();
    };
  }, [accessToken, language, quoteId, scopeVersion, priceCents, laborPriceCents,
    partsPriceCents, customerFeeRateBps, customerFeeCents, customerTotalCents]);

  async function openCheckout() {
    if (loading || busy || checkoutRequest.current || !checkoutAllowed
      || !checkoutAcceptance || !acceptedPaymentPolicy) return;
    if (!laborOnlyQuote) {
      setError("Checkout is blocked because this quote is not labor only.");
      return;
    }
    setBusy(true);
    setError("");
    const controller = new AbortController();
    checkoutRequest.current = controller;
    const recoveryMessage = language === "es"
      ? "No pudimos confirmar si se abrió el pago en Stripe. Revisa tu cotización antes de volver a intentarlo."
      : "We couldn’t confirm whether Stripe Checkout opened. Check your quote before trying again.";
    function requireFreshReview(message: string) {
      setCheckoutAllowed(false);
      setCheckoutAcceptance(null);
      setAcceptedPaymentPolicy(false);
      setError(message);
      setBusy(false);
    }
    // Aborting the browser request cannot cancel server-side session creation.
    // Require a fresh status read and consent; never automatically repeat POST.
    const timeout = window.setTimeout(() => {
      if (controller.signal.aborted) return;
      controller.abort();
      requireFreshReview(recoveryMessage);
    }, 20_000);
    controller.signal.addEventListener("abort", () => window.clearTimeout(timeout), { once: true });
    let failureMessage = recoveryMessage;
    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        signal: controller.signal,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          quoteId: quote.id,
          language,
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
      if (controller.signal.aborted) return;
      if (!response.ok || !result.url) {
        if (result.payment) setPayment(result.payment);
        failureMessage = result.error || recoveryMessage;
        throw new Error(failureMessage);
      }
      if (accessToken) {
        window.sessionStorage.setItem(CHECKOUT_STATUS_TOKEN_KEY, accessToken);
      } else {
        window.sessionStorage.removeItem(CHECKOUT_STATUS_TOKEN_KEY);
      }
      window.location.assign(result.url);
    } catch {
      if (controller.signal.aborted) return;
      requireFreshReview(failureMessage);
    } finally {
      window.clearTimeout(timeout);
      if (checkoutRequest.current === controller) checkoutRequest.current = null;
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
        <h2>Pay <span data-no-interface-translation translate="no">{quote.providerName}</span>&apos;s accepted quote</h2>
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
          <dt>Customer Service Fee ({quote.customerFeeRateBps / 100}%)</dt>
          <dd>{dollars(quote.customerFeeCents)}</dd>
        </div>
        <div className="total"><dt>Total</dt><dd>{dollars(quote.customerTotalCents)}</dd></div>
      </dl>
      <p className="payment-release-note" data-manual-language lang={language}>
        {PAYMENT_MERCHANT_DISCLOSURE[language]}
      </p>
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
          {reason && <p className="admin-note" role="status">{reason}</p>}
          {!laborOnlyQuote && (
            <p className="form-error" role="alert">
              Checkout is blocked because the stored quote contains a parts or non-labor amount.
            </p>
          )}
          {error && (
            <div>
              <p className="form-error" role="alert">{error}</p>
              <button
                className="button secondary"
                data-manual-language
                lang={language}
                disabled={busy}
                onClick={quoteChanged ? () => window.location.reload() : onRetry}
                type="button"
              >
                {quoteChanged
                  ? language === "es" ? "Actualizar detalles de la cotización" : "Refresh quote details"
                  : language === "es" ? "Revisar cotización" : "Check quote again"}
              </button>
            </div>
          )}
          {checkoutAcceptance ? (
            <>
              <dl className="quote-breakdown" aria-label="Exact checkout authorization">
                <div className="quote-authorization-detail"><dt>Provider legal identity</dt><dd data-no-interface-translation translate="no">{checkoutAcceptance.scope.providerLegalName}</dd></div>
                <div className="quote-authorization-detail"><dt>Exact service codes</dt><dd data-no-interface-translation translate="no">{checkoutAcceptance.scope.serviceCodes.join(", ")}</dd></div>
                <div className="quote-authorization-detail"><dt>Scheduled time</dt><dd data-no-interface-translation translate="no">{checkoutAcceptance.scope.scheduledFor}</dd></div>
                <div className="quote-authorization-detail"><dt>Performing person ID</dt><dd data-no-interface-translation translate="no">{checkoutAcceptance.scope.performingPersonId}</dd></div>
                <div className="quote-authorization-detail"><dt>Supervisor person ID</dt><dd><span data-no-interface-translation translate="no">{checkoutAcceptance.scope.supervisorPersonId}</span>{!checkoutAcceptance.scope.supervisorPersonId && "none"}</dd></div>
                <div className="quote-authorization-detail">
                  <dt>Workmanship warranty</dt>
                  <dd>
                    {checkoutAcceptance.scope.workmanshipWarranty?.trim()
                      ? <span data-no-interface-translation translate="no">{checkoutAcceptance.scope.workmanshipWarranty}</span>
                      : "None offered — you confirmed this when you selected the provider"}
                  </dd>
                </div>
                <div><dt>Labor</dt><dd>{dollars(checkoutAcceptance.scope.laborAmountCents)}</dd></div>
                <div><dt>Parts</dt><dd>{dollars(checkoutAcceptance.scope.partsAmountCents)}</dd></div>
                <div><dt>Tax</dt><dd>{dollars(checkoutAcceptance.scope.taxAmountCents)}</dd></div>
                <div><dt>Other charges</dt><dd>{dollars(checkoutAcceptance.scope.otherAmountCents)}</dd></div>
                <div><dt>Complete provider amount</dt><dd>{dollars(checkoutAcceptance.scope.providerAmountCents)}</dd></div>
                <div><dt>Customer Service Fee</dt><dd>{dollars(checkoutAcceptance.scope.customerFeeCents)}</dd></div>
                <div className="total"><dt>Customer total</dt><dd>{dollars(checkoutAcceptance.scope.customerTotalCents)}</dd></div>
              </dl>
              <p className="admin-note">
                <strong>Cancellation and refund summary:</strong>{" "}
                <span data-no-interface-translation translate="no" lang={checkoutAcceptance.language}>{checkoutAcceptance.cancellationRefundSummary}</span>
              </p>
              <label className="policy-consent payment-policy-consent">
                <input
                  checked={acceptedPaymentPolicy}
                  disabled={busy}
                  onChange={(event) => setAcceptedPaymentPolicy(event.target.checked)}
                  type="checkbox"
                />
                {/* The exact server presentation and provider data must stay
                    outside the interface dictionary, in their recorded language. */}
                <span data-no-interface-translation translate="no" lang={checkoutAcceptance.language}>
                  {checkoutAcceptance.presentedText}
                </span>
              </label>
              <p className="admin-note">
                <Link href="/terms">Terms of Use</Link>{" · "}
                <Link href="/customer-agreement">Customer Agreement</Link>{" · "}
                <Link href="/payments">Payment, Cancellation and Refund Policy</Link>
              </p>
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
            disabled={!checkoutAllowed || !checkoutAcceptance || !laborOnlyQuote || !acceptedPaymentPolicy || loading || busy}
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
            total, and configured Customer Service Fee (currently 5% in test) before the
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
