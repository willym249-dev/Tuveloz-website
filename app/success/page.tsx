"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BrandMark } from "../components/tuveloz-icons";

type PaymentSummary = {
  productName: string;
  customerTotalCents: number;
  status: string;
};

const CHECKOUT_STATUS_TOKEN_KEY = "tuveloz:checkout-status-token";
const REQUEST_ACCESS_TOKEN_HEADER = "x-tuveloz-request-token";

export default function StripeSuccessPage() {
  const [payment, setPayment] = useState<PaymentSummary | null>(null);
  const [checking, setChecking] = useState(false);
  const [canceled, setCanceled] = useState(false);

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
          }
        })
        .catch(() => undefined)
        .finally(() => {
          if (active) setChecking(false);
        });
    }

    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="payment-result-shell">
      <Link className="brand" href="/"><BrandMark />Tuveloz</Link>
      <section>
        <span className="kicker">
          {payment
            ? "Verified payment record"
            : checking
              ? "Payment record"
              : canceled
                ? "Checkout canceled"
                : "Payments are closed"}
        </span>
        <h1>
          {payment
            ? "Your payment record is available."
            : checking
              ? "Checking a prior payment record."
              : canceled
                ? "No payment was completed."
                : "Customer payments are not open yet."}
        </h1>
        {payment ? (
          <p>
            {payment.productName} · ${(payment.customerTotalCents / 100).toFixed(2)}
            {" "}· Status: {payment.status.replaceAll("_", " ")}
          </p>
        ) : (
          <p>
            {checking
              ? "Checking the authenticated payment record…"
              : canceled
                ? "Customer checkout remains closed during provider onboarding."
                : "Tuveloz is accepting account signups and provider applications, but customer checkout and payment links remain unavailable."}
          </p>
        )}
        <div>
          <Link className="button primary" href="/customer">Customer account</Link>
          <Link className="button secondary" href="/payments">Payment policy</Link>
          <Link className="button secondary" href="/join">Apply as a provider</Link>
        </div>
      </section>
    </main>
  );
}
