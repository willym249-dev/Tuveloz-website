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
  const [checking, setChecking] = useState(true);
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
      if (!sessionId) setChecking(false);
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
          if (response.ok) {
            window.sessionStorage.removeItem(CHECKOUT_STATUS_TOKEN_KEY);
            if (active) setPayment(result.payment ?? null);
          }
        })
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
        <span className="kicker">{canceled ? "Checkout canceled" : "Stripe Checkout"}</span>
        <h1>{canceled ? "No payment was completed." : "Thanks—your payment is being confirmed."}</h1>
        {payment ? (
          <p>
            {payment.productName} · ${(payment.customerTotalCents / 100).toFixed(2)}
            {" "}· Status: {payment.status.replaceAll("_", " ")}
          </p>
        ) : (
          <p>
            {checking
              ? "Checking the signed Stripe webhook result…"
              : canceled
                ? "You can return whenever you are ready."
                : "Stripe may take a moment to deliver the signed confirmation webhook."}
          </p>
        )}
        <div>
          <Link className="button primary" href="/customer">Customer account</Link>
          <Link className="button secondary" href="/storefront">Storefront</Link>
        </div>
      </section>
    </main>
  );
}
