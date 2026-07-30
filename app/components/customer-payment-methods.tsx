"use client";

import { useCallback, useEffect, useState } from "react";

type SavedPaymentMethod = {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
};

function brandLabel(brand: string) {
  return brand
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function initialPaymentNotice() {
  if (typeof window === "undefined") return "";
  const status = new URL(window.location.href).searchParams.get("payment_details");
  if (status === "added") return "Payment method saved securely by Stripe.";
  if (status === "canceled") return "No payment method was added.";
  return "";
}

export function CustomerPaymentMethods() {
  const [methods, setMethods] = useState<SavedPaymentMethod[]>([]);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(initialPaymentNotice);

  const load = useCallback(async () => {
    setError("");
    try {
      const response = await fetch("/api/stripe/customer/payment-methods", {
        cache: "no-store",
      });
      const result = await response.json() as {
        paymentMethods?: SavedPaymentMethod[];
        error?: string;
      };
      if (!response.ok || !result.paymentMethods) {
        throw new Error(result.error || "Unable to load payment details.");
      }
      setMethods(result.paymentMethods);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load payment details.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function addPaymentMethod() {
    setBusy("add");
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/stripe/customer/payment-methods", {
        method: "POST",
      });
      const result = await response.json() as { url?: string; error?: string };
      if (!response.ok || !result.url) {
        throw new Error(result.error || "Unable to open Stripe payment setup.");
      }
      window.location.assign(result.url);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to open Stripe payment setup.");
      setBusy("");
    }
  }

  async function removePaymentMethod(paymentMethodId: string) {
    setBusy(paymentMethodId);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/stripe/customer/payment-methods", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ paymentMethodId }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) {
        throw new Error(result.error || "Unable to remove the payment method.");
      }
      setNotice("Payment method removed.");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to remove the payment method.");
    } finally {
      setBusy("");
    }
  }

  return (
    <section className="customer-payment-methods-panel" aria-labelledby="payment-details-heading">
      <div className="customer-payment-methods-heading">
        <div>
          <h3 id="payment-details-heading">Payment details</h3>
          <p>
            Saved securely by Stripe. Tuveloz never stores your full card number or CVC.
            Adding a payment method does not charge it.
          </p>
        </div>
        <button
          className="button primary"
          disabled={busy === "add"}
          onClick={() => void addPaymentMethod()}
          type="button"
        >
          {busy === "add" ? "Opening Stripe…" : "Add payment method"}
        </button>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      {notice && <p className="portal-success" role="status">{notice}</p>}
      {methods.length === 0 ? (
        <div className="account-empty">
          <strong>No saved payment methods</strong>
          <span>Add one through Stripe when you are ready. No charge is made.</span>
        </div>
      ) : (
        <div className="customer-payment-method-list">
          {methods.map((method) => (
            <article key={method.id}>
              <span>
                <strong>{brandLabel(method.brand)} •••• {method.last4}</strong>
                <small>
                  Expires {String(method.expMonth).padStart(2, "0")}/{method.expYear}
                </small>
              </span>
              <button
                className="button secondary"
                disabled={busy === method.id}
                onClick={() => void removePaymentMethod(method.id)}
                type="button"
              >
                {busy === method.id ? "Removing…" : "Remove"}
              </button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
