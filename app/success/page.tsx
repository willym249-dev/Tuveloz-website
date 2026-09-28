"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BrandMark } from "../components/tuveloz-icons";
import { SiteLanguageButton, useSiteLanguage } from "../components/site-language";
import { PAYMENT_MERCHANT_RECORD_LABEL, paymentRecordStatusLabel } from "../../lib/payment-merchant";
import { translatedValue } from "../../lib/spanish-interface-text";

type PaymentSummary = {
  productName: string;
  customerTotalCents: number;
  status: string;
};

const CHECKOUT_STATUS_TOKEN_KEY = "tuveloz:checkout-status-token";
const REQUEST_ACCESS_TOKEN_HEADER = "x-tuveloz-request-token";

export default function StripeSuccessPage() {
  const { language } = useSiteLanguage();
  const t = (text: string) => language === "es" ? translatedValue(text) : text;
  const [payment, setPayment] = useState<PaymentSummary | null>(null);
  const [checking, setChecking] = useState(false);
  const [canceled, setCanceled] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const sessionId = searchParams.get("session_id") ?? "";
    const checkoutCanceled = searchParams.get("canceled") === "1";
    const privateRequestToken = window.sessionStorage.getItem(CHECKOUT_STATUS_TOKEN_KEY) ?? "";
    let active = true;

    Promise.resolve().then(() => {
      if (!active) return;
      setCanceled(checkoutCanceled);
      if (sessionId) setChecking(true);
      if (checkoutCanceled) {
        window.sessionStorage.removeItem(CHECKOUT_STATUS_TOKEN_KEY);
      }
    });

    if (sessionId) {
      fetch(`/api/stripe/checkout?sessionId=${encodeURIComponent(sessionId)}`, {
        cache: "no-store",
        headers: privateRequestToken
          ? { [REQUEST_ACCESS_TOKEN_HEADER]: privateRequestToken }
          : undefined,
      })
        .then(async (response) => {
          const result = await response.json() as { payment?: PaymentSummary };
          if (response.ok && result.payment) {
            window.sessionStorage.removeItem(CHECKOUT_STATUS_TOKEN_KEY);
            if (active) setPayment(result.payment);
          } else if (active) {
            setUnavailable(true);
          }
        })
        .catch(() => { if (active) setUnavailable(true); })
        .finally(() => {
          if (active) setChecking(false);
        });
    }

    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="payment-result-shell" data-manual-language lang={language}>
      <header className="payment-result-header">
        <Link className="brand" href={language === "es" ? "/es" : "/"}><BrandMark />Tuveloz</Link>
        <SiteLanguageButton />
      </header>
      <section>
        <span className="kicker">
          {t(payment
            ? "Verified payment record"
            : checking
              ? "Payment status"
              : unavailable
                ? "Payment record unavailable"
                : canceled
                  ? "Checkout canceled"
                  : "Payments are closed")}
        </span>
        <h1>
          {t(payment
            ? "Your payment record is available."
            : checking
              ? "Checking a prior payment record."
              : unavailable
                ? "We couldn’t load this payment record."
                : canceled
                  ? "Checkout was canceled."
                  : "Customer payments are not open yet.")}
        </h1>
        {payment ? (
          <p>
            <span data-no-interface-translation>{payment.productName}</span> · ${(payment.customerTotalCents / 100).toFixed(2)}
            {" "}· {t("Status:")} {paymentRecordStatusLabel(payment.status, language)}
          </p>
        ) : (
          <p role={unavailable ? "alert" : undefined}>
            {t(checking
              ? "Confirming your payment…"
              : unavailable
                ? "Sign in to the customer account used for this payment, then try again. For help, email hello@tuveloz.com."
                : canceled
                  ? "Customer checkout remains closed during provider onboarding."
                  : "Tuveloz is accepting account signups and provider applications, but customer checkout and payment links remain unavailable.")}
          </p>
        )}
        {payment && (
          <p data-manual-language lang={language}>
            {PAYMENT_MERCHANT_RECORD_LABEL[language]}
          </p>
        )}
        <div>
          <Link className="button primary" href="/customer">{t("Customer account")}</Link>
          <Link className="button secondary" href={language === "es" ? "/es/payments" : "/payments"}>{t("Payment policy")}</Link>
          <Link className="button secondary" href={language === "es" ? "/es/join#provider-apply" : "/join#provider-apply"}>{t("Apply as a provider")}</Link>
        </div>
      </section>
    </main>
  );
}
