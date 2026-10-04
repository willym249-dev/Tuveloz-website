"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ConfirmAction } from "./confirm-action";
import { requestAccountResponse } from "../../lib/account-response";
import { validStripePayments, validStripeTransferConfirmation } from "../../lib/stripe-payment-response";

type AdminPayment = {
  id: string;
  paymentType: string;
  productName: string;
  providerName: string | null;
  customerEmail: string;
  customerDisplayName: string | null;
  customerHasAccount: boolean;
  providerAmountCents: number;
  applicationFeeCents: number;
  customerTotalCents: number;
  settlementStrategy: string;
  status: string;
  jobStatus: string | null;
  transferId: string | null;
  transferAttemptStatus: string | null;
  transferReversalReviewRequired: boolean;
  canRelease: boolean;
  paidAt: string;
  releasedAt: string;
  releasedBy: string;
  refundAmountCents: number;
  refundedAt: string;
  refundStatus: string;
  refundUpdatedAt: string;
  refundFailureReason: string;
  disputeStatus: string;
  disputeUpdatedAt: string;
  connectedAccountSnapshotId: string | null;
  payoutFailureHold: number | null;
  payoutHoldReason: string | null;
  externalAccountHold: number | null;
  externalAccountHoldReason: string | null;
  lastPayoutStatus: string | null;
  lastExternalAccountStatus: string | null;
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
  const [ready, setReady] = useState(false);
  const [uncertain, setUncertain] = useState<Set<string>>(() => new Set());
  const inFlight = useRef(false);

  const loadPayments = useCallback(async (signal?: AbortSignal) => {
    setReady(false); setLoading(true); setPendingId(""); setMessage("");
    try {
      const response = await requestAccountResponse("/api/stripe/admin/payments", { cache: "no-store", signal });
      if (signal?.aborted) return null;
      if (!response.ok || !validStripePayments(response.data.payments)) throw new Error("Unable to refresh payment records. The last saved view is still here.");
      const refreshed = response.data.payments as AdminPayment[];
      setPayments(refreshed);
      setReady(true);
      setError("");
      return refreshed;
    } catch {
      if (signal?.aborted) return null;
      setError("Unable to refresh payment records. The last saved view is still here.");
      return null;
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(() => { if (!controller.signal.aborted) return loadPayments(controller.signal); });
    return () => controller.abort();
  }, [loadPayments]);

  async function release(paymentId: string, statusOnly = false) {
    const payment = payments.find(item => item.id === paymentId);
    if (inFlight.current || loading || !ready || !payment
      || (!statusOnly && (payment.transferReversalReviewRequired || uncertain.has(paymentId)))) return;
    inFlight.current = true;
    setBusyId(paymentId);
    setError("");
    setMessage("");
    let failureMessage = "We could not confirm this transfer. Check its saved status before taking another action.";
    try {
      const response = await requestAccountResponse("/api/stripe/admin/payments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ paymentId, action: statusOnly ? "check_transfer" : "release" }),
      });
      if (!response.ok || !validStripeTransferConfirmation(response.data, paymentId)) {
        if (typeof response.data.error === "string" && response.data.error.trim()) failureMessage = response.data.error;
        throw new Error(failureMessage);
      }
      setUncertain(current => { const next = new Set(current); next.delete(paymentId); return next; });
      setPendingId("");
      const refreshed = await loadPayments();
      const updatedPayment = refreshed?.find(item => item.id === paymentId);
      if (updatedPayment && !updatedPayment.transferReversalReviewRequired) {
        setMessage(response.data.transferReviewRequired
          ? "Stripe confirmed the transfer, but this payment still has a hold and needs review."
          : "Stripe confirmed the provider transfer. Arrival in the provider’s bank is not confirmed here.");
      }
    } catch {
      setUncertain(current => new Set(current).add(paymentId));
      setPendingId("");
      if (statusOnly && !await loadPayments()) {
        failureMessage += " Unable to refresh payment records. The last saved view is still here.";
      }
      setError(failureMessage);
    } finally {
      inFlight.current = false;
      setBusyId("");
    }
  }

  return (
    <section className="admin-section stripe-payment-admin">
      <h2>Stripe payments</h2>
      <p className="admin-section-copy">
        Storefront products use immediate Destination Charges. Accepted job
        quotes require completion, customer confirmation, and payment checks
        before the owner can release a separate provider transfer.
      </p>
      <p className="admin-note">
        Keep live processing disabled until Tuveloz&apos;s adult legal owner has
        approved the merchant-of-record, tax, refund, dispute, and reserve
        procedures and completed Stripe&apos;s live-account review.
      </p>
      <p className="admin-note">
        Use Cancellation refunds above for eligible full refunds before work starts.
        Other refunds and disputes need a separate review in Stripe Dashboard.
        Signed webhooks record payment changes here and hold affected payments for review.
      </p>
      {message && <p className="portal-success" role="status">{message}</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <button type="button" className="button secondary" disabled={loading || Boolean(busyId)}
        onClick={() => { if (!inFlight.current) void loadPayments(); }}>Refresh payments</button>
      {loading && payments.length === 0 ? (
        <p className="admin-note">Loading Stripe payment records…</p>
      ) : payments.length === 0 ? (
        !error && <p className="admin-note">No Stripe Checkout sessions have been created yet.</p>
      ) : (
        <div className="admin-grid">
          {payments.map((payment) => (
            <article className="admin-card stripe-payment-card" key={payment.id}>
              <div className="admin-card-top">
                <span>{payment.transferReversalReviewRequired ? "Transfer reversal needs review" : payment.status.replaceAll("_", " ")}</span>
                <time>{payment.createdAt}</time>
              </div>
              <h3>{payment.productName}</h3>
              <p>
                {payment.paymentType === "quote" ? "Accepted quote" : "Storefront product"}
                {" · "}{payment.providerName || "Provider"}
              </p>
              <dl className="quote-breakdown compact">
                <div><dt>Provider amount</dt><dd>{dollars(payment.providerAmountCents)}</dd></div>
                <div><dt>Customer Service Fee</dt><dd>{dollars(payment.applicationFeeCents)}</dd></div>
                <div className="total"><dt>Customer total</dt><dd>{dollars(payment.customerTotalCents)}</dd></div>
              </dl>
              {payment.customerEmail && (
                <div className="payment-customer-account">
                  <p><strong>Customer contact:</strong> {payment.customerEmail}</p>
                  <p>
                    <strong>Tuveloz account:</strong>{" "}
                    {payment.customerHasAccount
                      ? payment.customerDisplayName || payment.customerEmail
                      : "No matching sign-in account"}
                  </p>
                </div>
              )}
              {payment.jobStatus && <p>Job status: {payment.jobStatus}</p>}
              <p>
                Settlement: {payment.settlementStrategy === "destination_charge"
                  ? "Immediate destination charge"
                  : "Owner-released separate transfer"}
              </p>
              {payment.transferId && <p>Transfer: {payment.transferId}</p>}
              {payment.transferReversalReviewRequired && (
                <p className="form-error" role="alert">
                  Stripe reports a full or partial reversal of this provider transfer. Review it in Stripe.
                  Customer refunds are tracked separately.
                </p>
              )}
              {payment.refundAmountCents > 0 && (
                <p>
                  Refunded: {dollars(payment.refundAmountCents)}
                  {payment.refundedAt ? ` · ${payment.refundedAt}` : ""}
                </p>
              )}
              {payment.refundStatus && (
                <p>
                  Refund status: {payment.refundStatus.replaceAll("_", " ")}
                  {payment.refundUpdatedAt ? ` · ${payment.refundUpdatedAt}` : ""}
                  {payment.refundFailureReason
                    ? ` · review reason: ${payment.refundFailureReason.replaceAll("_", " ")}`
                    : ""}
                </p>
              )}
              {payment.disputeStatus && (
                <p>
                  Dispute: {payment.disputeStatus.replaceAll("_", " ")}
                  {payment.disputeUpdatedAt ? ` · ${payment.disputeUpdatedAt}` : ""}
                </p>
              )}
              {!payment.connectedAccountSnapshotId ? (
                <p className="form-error">
                  Provider payout hold: no signed Stripe payout-account snapshot.
                </p>
              ) : payment.payoutFailureHold || payment.externalAccountHold ? (
                <p className="form-error">
                  Provider payout hold: {[
                    payment.payoutFailureHold ? payment.payoutHoldReason : "",
                    payment.externalAccountHold ? payment.externalAccountHoldReason : "",
                  ].filter(Boolean).join(" · ")}
                </p>
              ) : (
                <p>
                  Stripe payout account: clear
                  {payment.lastPayoutStatus
                    ? ` · last payout ${payment.lastPayoutStatus.replaceAll("_", " ")}`
                    : ""}
                  {payment.lastExternalAccountStatus
                    ? ` · external account ${payment.lastExternalAccountStatus.replaceAll("_", " ")}`
                    : ""}
                </p>
              )}

              {(payment.transferAttemptStatus || payment.transferId || payment.transferReversalReviewRequired || uncertain.has(payment.id)) && (
                <div>
                  <p>{payment.transferAttemptStatus === "transfer_recorded" && !payment.transferReversalReviewRequired && !uncertain.has(payment.id)
                    ? "A transfer has been recorded with Stripe."
                    : "Check the saved transfer status. This will not send another payment."}</p>
                  <button type="button" className="button secondary" disabled={!ready || Boolean(busyId) || loading}
                    onClick={() => release(payment.id, true)}>{busyId === payment.id ? "Checking…" : "Check transfer status"}</button>
                </div>
              )}
              {pendingId === payment.id && !payment.transferReversalReviewRequired ? (
                <ConfirmAction
                  busy={busyId === payment.id}
                  confirmLabel="Confirm provider transfer"
                  message={`Stripe will transfer ${dollars(payment.providerAmountCents)} to the connected provider. Confirm the job and payment records are correct.`}
                  onBack={() => setPendingId("")}
                  onConfirm={() => release(payment.id)}
                  title="Release this completed-job payment?"
                />
              ) : payment.canRelease && !payment.transferReversalReviewRequired && !payment.transferAttemptStatus && !payment.transferId && !uncertain.has(payment.id) ? (
                <button
                  className="button primary"
                  disabled={!ready || loading || Boolean(busyId)}
                  onClick={() => setPendingId(payment.id)}
                  type="button"
                >
                  Review provider release
                </button>
              ) : (
                <small className="admin-link-note">
                  {payment.transferReversalReviewRequired
                    ? "Transfer reversal needs review in Stripe. Provider release is unavailable."
                    : uncertain.has(payment.id)
                    ? "Transfer status is unconfirmed. Check its saved status before another action."
                    : payment.status === "released" || payment.status === "paid_and_transferred"
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
