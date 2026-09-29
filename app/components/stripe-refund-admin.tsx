"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RefundReview, RefundReviewQueue } from "../../lib/stripe-refund-review";
import { ConfirmAction } from "./confirm-action";

const labels: Record<string, string> = { customer_cancel: "Customer cancellation", provider_cancel: "Provider cancellation", provider_no_show: "Provider did not arrive", customer_no_show: "Customer did not arrive" };
const statusLabels: Record<string, string> = {
  refund_succeeded: "Stripe confirmed the refund.", refund_pending: "Stripe is processing the refund.",
  refund_requires_action: "Stripe needs action. Review the refund in Stripe.",
  refund_failed: "Stripe reported a failed refund. Review it before taking another action.",
  refund_canceled: "Stripe reported a cancelled refund. Review it before taking another action.",
  refund_submission_unconfirmed: "The refund result is not confirmed. Check its status; do not send another refund.",
  refund_not_sent_review: "This attempt stopped before sending a refund. Review the current cancellation and payment before retrying.",
  refund_status_review: "The refund needs a separate review.",
};
function money(cents: number, currency = "usd") {
  try { return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100); }
  catch { return `${(cents / 100).toFixed(2)} (${currency || "currency missing"})`; }
}
async function requestJson<T>(url: string, init: RequestInit = {}, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { ...init, cache: "no-store", redirect: "error",
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000) });
  if (!response.headers.get("content-type")?.includes("application/json")) throw new Error("Owner sign-in may have expired. Sign in again, then refresh the saved review.");
  const data = await response.json() as { error?: unknown };
  if (!response.ok) throw new Error(typeof data?.error === "string" ? data.error : "Unable to complete this request. Refresh the saved review.");
  return data as T;
}

function RefundCase({ id }: { id: string }) {
  const [review, setReview] = useState<RefundReview | null>(null);
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [confirmSend, setConfirmSend] = useState(false);
  const [busy, setBusy] = useState(false);
  const [stale, setStale] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [recoveryNote, setRecoveryNote] = useState("");
  const lock = useRef(false);
  const lifetime = useRef<AbortController | null>(null);
  const load = useCallback(async (signal: AbortSignal) => {
    const data = await requestJson<RefundReview>(`/api/stripe/admin/refund-reviews?cancellationId=${encodeURIComponent(id)}`, {}, signal);
    if (!data || data.cancellationId !== id || !Array.isArray(data.blockers) || typeof data.reviewToken !== "string") throw new Error("The saved review could not be read. Refresh before approving anything.");
    return data;
  }, [id]);
  useEffect(() => {
    const controller = new AbortController(); lifetime.current = controller;
    load(controller.signal).then(data => { if (!controller.signal.aborted) { setReview(data); setStale(false); } })
      .catch(failure => { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "Unable to load the refund review."); });
    return () => controller.abort();
  }, [load]);
  async function run(action: "refresh" | "approve" | "send" | "check") {
    if (lock.current || !lifetime.current || lifetime.current.signal.aborted) return;
    const signal = lifetime.current.signal;
    lock.current = true; setBusy(true); setError(""); setMessage(""); setRecoveryNote("");
    setStale(true); setConfirmed(false); setConfirmSend(false);
    try {
      if (action === "approve" && review) {
        if (stale || !confirmed || reason.trim().length < 10 || !review.enabled || review.blockers.length) return;
        await requestJson("/api/stripe/admin/refund-reviews", { method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ cancellationId: id, reviewToken: review.reviewToken, reason: reason.trim(), confirmed: true }) }, signal);
        if (!signal.aborted) setMessage("Approval saved. No refund has been sent to Stripe.");
      }
      if ((action === "send" || action === "check") && review?.approval) {
        const retryNotSent = review.execution?.status === "refund_not_sent_review";
        if (action === "send" && (!review.enabled || stale || !confirmSend || (review.execution && !retryNotSent))) return;
        const result = await requestJson<{ status: string; refundSucceeded: boolean; recovery?: string }>(action === "check"
          ? `/api/stripe/admin/refunds?adjustmentId=${encodeURIComponent(review.approval.id)}` : "/api/stripe/admin/refunds",
        action === "check" ? {} : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ adjustmentId: review.approval.id, ...(retryNotSent ? { action: "retry_not_sent" } : {}) }) }, signal);
        if (!result || typeof result.status !== "string") throw new Error("Stripe's result could not be read. Check the saved status before taking another action.");
        if (!signal.aborted && result.recovery === "not_found") setRecoveryNote("Stripe has no matching refund confirmation yet. Keep this payment under review and check its charge in Stripe. Do not send another refund while the first attempt is unconfirmed.");
      }
      const data = await load(signal);
      if (!signal.aborted) { setReview(data); setStale(false); }
    } catch (failure) {
      if (!signal.aborted) {
        setStale(true); setConfirmed(false); setConfirmSend(false);
        setError(failure instanceof Error && failure.name !== "TimeoutError" && failure.name !== "TypeError"
          ? failure.message : "The request could not be confirmed. Refresh the saved review before trying again; a refund may already have been submitted.");
      }
    } finally { lock.current = false; if (!signal.aborted) setBusy(false); }
  }
  const canApprove = !!review && review.enabled && !review.approval && !review.blockers.length && !stale;
  return <article className="admin-card stripe-refund-review" aria-label="Cancellation refund review">
    <div className="admin-card-top"><h3>Review cancellation</h3><button type="button" className="button secondary" disabled={busy} onClick={() => void run("refresh")}>{busy ? "Please wait…" : "Refresh saved review"}</button></div>
    {error && <p className="form-error" role="alert">{error}</p>}
    {message && <p className="portal-success" role="status">{message}</p>}
    {recoveryNote && <div className="admin-note" role="status"><p>{recoveryNote}</p>
      {review?.payment?.stripePaymentIntentId && <p>Stripe payment: <code>{review.payment.stripePaymentIntentId}</code></p>}
    </div>}
    {!review ? <p>{error ? "Use Refresh saved review to try again." : "Loading the cancellation and payment…"}</p> : <>
      <p><strong>{review.customerName}</strong> · {review.providerName}</p>
      <p>{labels[review.cancellationType] ?? "Cancellation"} · Request {review.requestId}</p>
      <p><strong>Reported reason:</strong> {review.reason}</p>
      <p>Job status: {review.jobStatus.replaceAll("_", " ")}. {review.providerTravelStarted ? "Provider travel was reported." : "No provider travel reported."}</p>
      {review.payment && <dl className="quote-breakdown compact">
        <div><dt>Provider amount to return</dt><dd>{money(review.payment.providerAmountCents, review.payment.currency)}</dd></div>
        <div><dt>Customer Service Fee to return</dt><dd>{money(review.payment.customerFeeCents, review.payment.currency)}</dd></div>
        <div className="total"><dt>Full customer refund</dt><dd>{money(review.payment.customerTotalCents, review.payment.currency)}</dd></div>
      </dl>}
      {review.payment && <p className="admin-note">Payment {review.payment.id} · Paid {new Date(review.payment.paidAt).toLocaleString()}</p>}
      <p className="admin-note">The full refund includes the Customer Service Fee. Tuveloz covers any original Stripe processing fees that are not returned.</p>
      {!review.enabled && <p className="admin-note">New refund approvals and submissions are closed. You can still review saved records and check an existing refund status.</p>}
      {!review.approval && review.blockers.length > 0 && <ul>{review.blockers.map(item => <li key={item}>{item}</li>)}</ul>}
      {!review.approval && <form onSubmit={event => { event.preventDefault(); void run("approve"); }}>
        <label htmlFor={`refund-reason-${id}`}>Reason for approving this refund</label>
        <textarea id={`refund-reason-${id}`} value={reason} onChange={event => { setReason(event.target.value); setConfirmed(false); }} minLength={10} maxLength={1000} required disabled={busy} rows={3} />
        <label className="refund-review-confirm"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} disabled={busy || !canApprove} required />
          I reviewed the cancellation and payment. No work has started, and the customer should receive the full amount shown above.</label>
        <p className="admin-note">Saving approval cancels this job. Sending the refund is a separate step.</p>
        <button className="button primary" type="submit" disabled={busy || !canApprove || !confirmed || reason.trim().length < 10}>Save refund approval</button>
      </form>}
      {review.approval && <>
        <p><strong>Saved decision:</strong> {review.approval.reason}</p>
        <p>Approval status: {review.approval.status.replaceAll("_", " ")} · {new Date(review.approval.decidedAt).toLocaleString()}</p>
        <p role="status">{review.execution ? statusLabels[review.execution.status] ?? "The refund needs a separate review." : "No Stripe refund attempt is saved."}</p>
        {review.execution && <button type="button" className="button secondary" disabled={busy} onClick={() => void run("check")}>Check Stripe refund status</button>}
        {(!review.execution || review.execution.status === "refund_not_sent_review") && review.approval.status === "approved" && (!confirmSend
          ? <button type="button" className="button primary" disabled={busy || stale || !review.enabled || review.payment?.status !== "paid_pending_completion"} onClick={() => setConfirmSend(true)}>{review.execution ? "Review and retry refund" : "Send refund to Stripe"}</button>
          : <ConfirmAction title={review.execution ? "Retry this unsent refund?" : "Send this refund?"} message={`Send ${money(review.approval.amountCents)} back to this customer's original payment method. This moves money and cannot be undone here.`}
            confirmLabel="Confirm and send refund" busyLabel="Sending…" busy={busy} onConfirm={() => void run("send")} onBack={() => setConfirmSend(false)} />)}
      </>}
    </>}
  </article>;
}

export function StripeRefundAdmin() {
  const [queue, setQueue] = useState<RefundReviewQueue | null>(null);
  const [selected, setSelected] = useState("");
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    requestJson<RefundReviewQueue>("/api/stripe/admin/refund-reviews", {}, controller.signal).then(data => {
      if (!data || !Array.isArray(data.cases)) throw new Error("Unable to read the refund review list.");
      if (!controller.signal.aborted) { setQueue(data); setError(""); }
    }).catch(failure => { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "Unable to load refund reviews."); });
    return () => controller.abort();
  }, [reload]);
  return <section className="admin-section" aria-labelledby="refund-review-heading">
    <div className="admin-card-top"><h2 id="refund-review-heading">Cancellation refunds</h2><button type="button" className="button secondary" onClick={() => setReload(value => value + 1)}>Refresh list</button></div>
    <p>Review the cancellation and full customer payment, then save your decision. Stripe submission requires a separate confirmation.</p>
    {error && <p className="form-error" role="alert">{error}</p>}
    {!queue ? <p>{error ? "Refresh the list to try again." : "Loading cancellation reviews…"}</p> : !queue.cases.length ? <p>No real cancellation requests are waiting for review.</p> : <>
      <label htmlFor="refund-review-case">Choose a cancellation</label>
      <select id="refund-review-case" value={selected} onChange={event => setSelected(event.target.value)}>
        <option value="">Select a customer and request</option>
        {queue.cases.map(item => <option key={item.id} value={item.id}>{item.customerName} · {labels[item.cancellationType] ?? "Cancellation"} · {item.requestId} · {item.status.replaceAll("_", " ")}</option>)}
      </select>
      {queue.hasMore && <p className="admin-note">Showing up to 100 cancellations, with undecided cases first. Other cases need a separate record search.</p>}
    </>}
    {selected && <RefundCase key={selected} id={selected} />}
  </section>;
}
