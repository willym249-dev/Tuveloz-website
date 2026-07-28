"use client";

import { useCallback, useEffect, useState } from "react";
import { ConfirmAction } from "./confirm-action";

type AdminPayment = {
  id: string;
  paymentType: string;
  productName: string;
  providerName: string | null;
  customerEmail: string;
  providerAmountCents: number;
  applicationFeeCents: number;
  customerTotalCents: number;
  settlementStrategy: string;
  status: string;
  jobStatus: string | null;
  transferId: string | null;
  canRelease: boolean;
  paidAt: string;
  releasedAt: string;
  releasedBy: string;
  createdAt: string;
};

function dollars(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export function StripePaymentAdmin() {
  const [payments, setPayments] = useState<AdminPayment[]>([]);
  const [pendingId, setPendingId] = useState("");
  const [busyId, setBusyId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadPayments = useCallback(async () => {
    try {
      const response = await fetch("/api/stripe/admin/payments", { cache: "no-store" });
      const result = await response.json() as {
        payments?: AdminPayment[];
        error?: string;
      };
      if (!response.ok) throw new Error(result.error || "Unable to load Stripe payments.");
      setPayments(result.payments ?? []);
      setError("");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Unable to load Stripe payments.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/stripe/admin/payments", { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json() as {
          payments?: AdminPayment[];
          error?: string;
        };
        if (!response.ok) {
          throw new Error(result.error || "Unable to load Stripe payments.");
        }
        if (active) {
          setPayments(result.payments ?? []);
          setError("");
        }
      })
      .catch((failure: unknown) => {
        if (active) {
          setError(
            failure instanceof Error
              ? failure.message
              : "Unable to load Stripe payments.",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  async function release(paymentId: string) {
    setBusyId(paymentId);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/stripe/admin/payments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ paymentId }),
      });
      const result = await response.json() as {
        transferId?: string;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(result.error || "Unable to release this provider payment.");
      }
      setMessage(`Provider transfer released${result.transferId ? ` (${result.transferId})` : ""}.`);
      setPendingId("");
      await loadPayments();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Unable to release this provider payment.");
    } finally {
      setBusyId("");
    }
  }

  return (
    <section className="admin-section stripe-payment-admin">
      <h2>Stripe payments</h2>
      <p className="admin-section-copy">
        Storefront products use immediate Destination Charges. Accepted job
        quotes use a separate transfer that becomes releasable only after the
        provider marks the job completed.
      </p>
      {message && <p className="portal-success" role="status">{message}</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      {loading ? (
        <p className="admin-note">Loading Stripe payment records…</p>
      ) : payments.length === 0 ? (
        <p className="admin-note">No Stripe Checkout sessions have been created yet.</p>
      ) : (
        <div className="admin-grid">
          {payments.map((payment) => (
            <article className="admin-card stripe-payment-card" key={payment.id}>
              <div className="admin-card-top">
                <span>{payment.status.replaceAll("_", " ")}</span>
                <time>{payment.createdAt}</time>
              </div>
              <h3>{payment.productName}</h3>
              <p>
                {payment.paymentType === "quote" ? "Accepted quote" : "Storefront product"}
                {" · "}{payment.providerName || "Provider"}
              </p>
              <dl className="quote-breakdown compact">
                <div><dt>Provider amount</dt><dd>{dollars(payment.providerAmountCents)}</dd></div>
                <div><dt>Tuveloz fee</dt><dd>{dollars(payment.applicationFeeCents)}</dd></div>
                <div className="total"><dt>Customer total</dt><dd>{dollars(payment.customerTotalCents)}</dd></div>
              </dl>
              {payment.customerEmail && <p>Customer: {payment.customerEmail}</p>}
              {payment.jobStatus && <p>Job status: {payment.jobStatus}</p>}
              <p>
                Settlement: {payment.settlementStrategy === "destination_charge"
                  ? "Immediate destination charge"
                  : "Owner-released separate transfer"}
              </p>
              {payment.transferId && <p>Transfer: {payment.transferId}</p>}

              {pendingId === payment.id ? (
                <ConfirmAction
                  busy={busyId === payment.id}
                  confirmLabel="Confirm provider transfer"
                  message={`Stripe will transfer ${dollars(payment.providerAmountCents)} to the connected provider. Confirm the job and payment records are correct.`}
                  onBack={() => setPendingId("")}
                  onConfirm={() => release(payment.id)}
                  title="Release this completed-job payment?"
                />
              ) : payment.canRelease ? (
                <button
                  className="button primary"
                  onClick={() => setPendingId(payment.id)}
                  type="button"
                >
                  Review provider release
                </button>
              ) : (
                <small className="admin-link-note">
                  {payment.status === "released" || payment.status === "paid_and_transferred"
                    ? "No release action is needed."
                    : "Waiting for successful payment and job completion."}
                </small>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
