"use client";
/* eslint-disable @next/next/no-img-element -- private R2 images must bypass shared optimization caches */

import { useEffect, useState } from "react";
import Link from "next/link";
import { BrandMark } from "../components/tuveloz-icons";
import { SiteLanguageButton } from "../components/site-language";
import { QuotePaymentCard } from "../components/quote-payment-card";
import {
  parseCustomerServiceLocations,
  parseJobServices,
  parseProviderWorkLocations,
  PARTS_SOURCE_OPTIONS,
} from "../../lib/service-matching";
import { QUOTE_DECLINE_REASONS } from "../../lib/quote-feedback";

type Quote = {
  id: string;
  providerName: string;
  providerEmail?: string;
  priceCents: string;
  laborPriceCents: string;
  partsPriceCents: string;
  scopeVersion: number;
  customerFeeRateBps: number;
  customerFeeCents: string;
  customerTotalCents: string;
  partType: string;
  availability: string;
  message: string;
  status: string;
  declineReason: string;
  ratingAverage: number;
  reviewCount: number;
  providerVerified: boolean;
  providerTest: boolean;
  providerWorkLocations: string;
  providerBusinessMunicipality: string;
  providerBusinessServiceAddress?: string;
  selectionBlockedReason: string;
  selectionAcceptance: null | {
    agreementKey: string;
    agreementVersion: string;
    agreementHash: string;
    presentedText: string;
    scopeVersion: number;
    performingPersonDisplay: string;
    scheduledFor: string;
    serviceCodes: string[];
  };
};
type Job = {
  id: string;
  customerName: string;
  customerEmail: string;
  zip: string;
  vehicle: string;
  launchArea: string;
  jurisdiction: string;
  municipality: string;
  service: string;
  serviceCodes: string[];
  scheduledFor: string;
  partsSource: string;
  partsPreference: string;
  serviceLocations: string;
  serviceAddress: string;
  details: string;
  preferredProviderName: string;
  repeatOfRequestId: string;
  status: string;
  isTestJob: boolean;
  hasIssueImage: boolean;
  hasCompletionImage: boolean;
};
type Review = {
  id: string;
  providerName: string;
  customerDisplayName: string;
  service: string;
  rating: number;
  comment: string;
  createdAt?: string;
};

export default function MyRequestPage() {
  const [job, setJob] = useState<Job | null>(null);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [pendingQuoteId, setPendingQuoteId] = useState("");
  const [pendingDeclineId, setPendingDeclineId] = useState("");
  const [submittingQuoteId, setSubmittingQuoteId] = useState("");
  const [acceptedSelectionQuoteId, setAcceptedSelectionQuoteId] = useState("");
  const [error, setError] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [review, setReview] = useState<Review | null>(null);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState("");
  const [confirmingReview, setConfirmingReview] = useState(false);
  const [reviewBusy, setReviewBusy] = useState(false);
  const acceptedQuote = quotes.find((quote) => quote.status === "accepted");

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const token = searchParams.get("token") ?? "";
    const requestId = searchParams.get("request") ?? "";
    if (!token && !requestId) {
      Promise.resolve().then(() => setError("Sign in or use the private link provided after submitting your request."));
      return;
    }
    const query = token
      ? `token=${encodeURIComponent(token)}`
      : `requestId=${encodeURIComponent(requestId)}`;
    fetch(`/api/customer-quotes?${query}`).then(async (response) => {
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setAccessToken(result.accessToken || token);
      setJob(result.job); setQuotes(result.quotes); setReview(result.review);
    }).catch((reason) => setError(reason.message || "Unable to load request."));
  }, []);

  async function accept(quoteId: string) {
    const selectedQuote = quotes.find((quote) => quote.id === quoteId);
    if (
      !selectedQuote?.selectionAcceptance
      || acceptedSelectionQuoteId !== quoteId
    ) {
      setError("Review and accept the exact provider, performing person, scope, schedule, and price first.");
      return;
    }
    setError("");
    setSubmittingQuoteId(quoteId);
    const response = await fetch("/api/customer-quotes", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "accept-quote",
        token: accessToken,
        quoteId,
        selectionAccepted: true,
        selectionAgreementKey: selectedQuote.selectionAcceptance.agreementKey,
        selectionAgreementVersion: selectedQuote.selectionAcceptance.agreementVersion,
        selectionAgreementHash: selectedQuote.selectionAcceptance.agreementHash,
      }),
    });
    const result = (await response.json()) as { error?: string; providerEmail?: string };
    setSubmittingQuoteId("");
    if (!response.ok) return setError(result.error || "Unable to accept this quote.");
    setQuotes((items) => items.map((item) => ({
      ...item,
      status: item.id === quoteId
        ? "accepted"
        : item.status === "submitted"
          ? "not selected"
          : item.status,
      providerEmail: item.id === quoteId ? result.providerEmail : item.providerEmail,
    })));
    setJob((current) => current ? { ...current, status: "quote accepted" } : current);
    setPendingQuoteId("");
    setAcceptedSelectionQuoteId("");
  }

  async function declineQuote(quoteId: string, declineReason: string) {
    setError("");
    setSubmittingQuoteId(quoteId);
    const response = await fetch("/api/customer-quotes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "decline-quote",
        token: accessToken,
        quoteId,
        declineReason,
      }),
    });
    const result = (await response.json()) as { error?: string };
    setSubmittingQuoteId("");
    if (!response.ok) return setError(result.error || "Unable to update this quote.");
    setQuotes((items) => items.map((item) => item.id === quoteId
      ? { ...item, status: "declined", declineReason }
      : item));
    setPendingDeclineId("");
  }

  async function restoreQuote(quoteId: string) {
    setError("");
    setSubmittingQuoteId(quoteId);
    const response = await fetch("/api/customer-quotes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "restore-quote",
        token: accessToken,
        quoteId,
      }),
    });
    const result = (await response.json()) as { error?: string };
    setSubmittingQuoteId("");
    if (!response.ok) return setError(result.error || "Unable to restore this quote.");
    setQuotes((items) => items.map((item) => item.id === quoteId
      ? { ...item, status: "submitted", declineReason: "" }
      : item));
  }

  async function publishReview() {
    setError("");
    setReviewBusy(true);
    const response = await fetch("/api/reviews", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        token: accessToken,
        rating: reviewRating,
        comment: reviewComment,
      }),
    });
    const result = (await response.json()) as { error?: string; review?: Review };
    setReviewBusy(false);
    if (!response.ok || !result.review) {
      return setError(result.error || "Unable to publish this review.");
    }
    setReview(result.review);
    setConfirmingReview(false);
  }

  return (
    <main className="portal-shell">
      <header className="portal-header">
        <Link className="brand" href="/"><BrandMark />Tuveloz</Link>
        <span>Private customer request</span>
        <div className="portal-header-actions">
          <Link className="portal-account-link" href="/customer">Customer account</Link>
          <SiteLanguageButton />
        </div>
      </header>
      <section className="portal-intro">
        <span className="kicker">Your request</span>
        <h1>{job ? parseJobServices(job.service).join(" + ") : "Compare provider quotes."}</h1>
        {job && (
          <p>
            Exact service: {job.serviceCodes.join(", ") || "No exact service code recorded"}
            {job.scheduledFor ? ` · ${new Date(job.scheduledFor).toLocaleString()}` : ""}
          </p>
        )}
        {job && <p>{job.vehicle} · {job.launchArea || job.municipality} · Status: {job.status}</p>}
        {job && (
          <p>Service locations: {parseCustomerServiceLocations(job.serviceLocations).join(" · ")}</p>
        )}
        {job && (
          <p>
            Parts: {job.partsSource}
            {job.partsSource !== PARTS_SOURCE_OPTIONS[0] ? ` · ${job.partsPreference}` : ""}
          </p>
        )}
        {job?.preferredProviderName && (
          <p>Requested again with: {job.preferredProviderName}</p>
        )}
        {job?.isTestJob && <span className="test-badge">TEST JOB · NO REAL SERVICE</span>}
      </section>
      {error && <p className="form-error portal-alert">{error}</p>}
      {job?.hasIssueImage && (
        <section className="customer-photo-card">
          <span>Photo attached to your request</span>
          <img
            src={`/api/job-images?requestId=${encodeURIComponent(job.id)}&kind=issue&token=${encodeURIComponent(accessToken)}`}
            alt="The vehicle issue photo attached to this request"
            referrerPolicy="no-referrer"
          />
        </section>
      )}
      {job && job.status !== "approved" && (
        <section className="customer-progress" aria-label="Current job status">
          <span>Live job status</span>
          <strong>{job.status}</strong>
          <ol>
            {["Quote accepted", "On my way", "Arrived", "Completed"].map((step) => (
              <li className={step.toLowerCase() === job.status ? "current" : ""} key={step}>{step}</li>
            ))}
          </ol>
          <p>Refresh this private page to see the provider’s latest update.</p>
        </section>
      )}
      {job?.hasCompletionImage && (
        <section className="customer-photo-card completion-proof">
          <span>Provider completion photo</span>
          <img
            src={`/api/job-images?requestId=${encodeURIComponent(job.id)}&kind=completion&token=${encodeURIComponent(accessToken)}`}
            alt="Provider-submitted photo of the completed work"
            referrerPolicy="no-referrer"
          />
        </section>
      )}
      <section className="portal-grid">
        {job && quotes.length === 0 && <p className="admin-note">No quotes yet. Check this private link again later.</p>}
        {quotes.map((quote) => (
          <article className="portal-card" key={quote.id}>
            <span className="portal-service">
              {quote.status === "submitted" ? "Quote from" : quote.status}
            </span>
            <h2>{quote.providerName}</h2>
            {quote.providerVerified && <span className="verified-badge">Provider account active for this quote</span>}
            {quote.providerTest && <span className="test-badge">TEST PROVIDER · FICTIONAL</span>}
            {!quote.providerTest && quote.reviewCount > 0 && (
              <p className="provider-rating" aria-label={`${quote.ratingAverage} out of 5 stars from ${quote.reviewCount} reviews`}>
                <span aria-hidden="true">★</span> {quote.ratingAverage.toFixed(1)} · {quote.reviewCount} verified {quote.reviewCount === 1 ? "review" : "reviews"}
              </p>
            )}
            <dl className="quote-breakdown">
              <div><dt>Labor</dt><dd>${(Number(quote.laborPriceCents) / 100).toFixed(2)}</dd></div>
              {job?.partsSource !== PARTS_SOURCE_OPTIONS[0] && (
                <div>
                  <dt>
                    Parts
                    {quote.partType === "Not specified" ? "" : ` (${quote.partType})`}
                  </dt>
                  <dd>${(Number(quote.partsPriceCents) / 100).toFixed(2)}</dd>
                </div>
              )}
              <div><dt>Provider quote subtotal</dt><dd>${(Number(quote.priceCents) / 100).toFixed(2)}</dd></div>
              <div>
                <dt>Tuveloz service fee shown at acceptance</dt>
                <dd>${(Number(quote.customerFeeCents) / 100).toFixed(2)}</dd>
              </div>
              <div className="total">
                <dt>Customer total</dt>
                <dd>${(Number(quote.customerTotalCents) / 100).toFixed(2)}</dd>
              </div>
            </dl>
            <div className="quote-summary">
              <span>What this quote includes</span>
              <p>{quote.message}</p>
            </div>
            <details className="quote-provider-details">
              <summary>View provider details</summary>
              <p>Availability: {quote.availability}</p>
              <p>
                Service options: {parseProviderWorkLocations(quote.providerWorkLocations).join(" · ")}
                {quote.providerBusinessMunicipality
                  ? ` · ${quote.providerBusinessMunicipality}`
                  : ""}
              </p>
            </details>
            {quote.status === "accepted" ? (
              <>
                <div className="portal-success">✓ Quote selected</div>
                {quote.providerEmail && (
                  <div className="private-contact">
                    <span>Your selected provider</span>
                    <strong>{quote.providerName}</strong>
                    <a href={`mailto:${quote.providerEmail}`}>{quote.providerEmail}</a>
                    {quote.providerBusinessServiceAddress && (
                      <p>Provider business address: {quote.providerBusinessServiceAddress}</p>
                    )}
                    {job?.serviceAddress && <p>Your service address: {job.serviceAddress}</p>}
                    <small>Confirm the final meeting place before anyone travels.</small>
                  </div>
                )}
              </>
            ) : quote.status === "declined" ? (
              <div className="quote-passed">
                <strong>You passed on this quote</strong>
                <span>
                  {QUOTE_DECLINE_REASONS.find((reason) => reason.value === quote.declineReason)?.label
                    ?? "No reason shared"}
                </span>
                {job?.status === "approved" && (
                  <button
                    className="button secondary"
                    disabled={submittingQuoteId === quote.id}
                    onClick={() => restoreQuote(quote.id)}
                    type="button"
                  >
                    {submittingQuoteId === quote.id ? "Restoring…" : "Reconsider this quote"}
                  </button>
                )}
              </div>
            ) : job?.status !== "approved" ? (
              <p className="admin-note">Another quote was selected.</p>
            ) : pendingQuoteId === quote.id ? (
              <div className="quote-confirm" role="group" aria-label={`Confirm ${quote.providerName} quote`}>
                <strong>Authorize this exact provider and quote?</strong>
                <p>
                  {quote.providerName} · Customer total ${(Number(quote.customerTotalCents) / 100).toFixed(2)},
                  including the 10% Tuveloz service fee
                </p>
                {quote.selectionAcceptance ? (
                  <label className="policy-consent">
                    <input
                      checked={acceptedSelectionQuoteId === quote.id}
                      onChange={(event) => setAcceptedSelectionQuoteId(
                        event.target.checked ? quote.id : "",
                      )}
                      type="checkbox"
                    />
                    <span>
                      {quote.selectionAcceptance.presentedText}{" "}
                      <Link href="/terms">Terms</Link>{" · "}
                      <Link href="/customer-agreement">Customer Agreement</Link>{" · "}
                      <Link href="/payments">Payment Policy</Link>
                    </span>
                  </label>
                ) : (
                  <p className="form-error" role="alert">
                    {quote.selectionBlockedReason || "This quote is missing its exact authorization record."}
                  </p>
                )}
                <div>
                  <button
                    className="button primary"
                    disabled={
                      submittingQuoteId === quote.id
                      || !quote.selectionAcceptance
                      || acceptedSelectionQuoteId !== quote.id
                    }
                    onClick={() => accept(quote.id)}
                  >
                    {submittingQuoteId === quote.id ? "Confirming…" : "Confirm quote"}
                  </button>
                  <button
                    className="button secondary"
                    disabled={submittingQuoteId === quote.id}
                    onClick={() => {
                      setPendingQuoteId("");
                      setAcceptedSelectionQuoteId("");
                    }}
                    type="button"
                  >
                    Go back
                  </button>
                </div>
              </div>
            ) : pendingDeclineId === quote.id ? (
              <div className="quote-decline" role="group" aria-label={`Pass on ${quote.providerName} quote`}>
                <strong>Why are you passing?</strong>
                <p>This is optional. Tuveloz shows providers only combined feedback so they can improve.</p>
                <div className="quote-reason-grid">
                  {QUOTE_DECLINE_REASONS.map((reason) => (
                    <button
                      disabled={submittingQuoteId === quote.id}
                      key={reason.value}
                      onClick={() => declineQuote(quote.id, reason.value)}
                      type="button"
                    >
                      {reason.label}
                    </button>
                  ))}
                </div>
                <button
                  className="button secondary"
                  disabled={submittingQuoteId === quote.id}
                  onClick={() => declineQuote(quote.id, "")}
                  type="button"
                >
                  Pass without sharing a reason
                </button>
                <button
                  className="quote-keep-button"
                  disabled={submittingQuoteId === quote.id}
                  onClick={() => setPendingDeclineId("")}
                  type="button"
                >
                  Keep this quote
                </button>
              </div>
            ) : (
              <div className="quote-decision-actions">
                <button
                  className="button primary"
                  disabled={!quote.selectionAcceptance}
                  onClick={() => {
                    setPendingDeclineId("");
                    setAcceptedSelectionQuoteId("");
                    setPendingQuoteId(quote.id);
                  }}
                  type="button"
                >
                  Choose provider
                </button>
                {!quote.selectionAcceptance && (
                  <small className="form-error">
                    {quote.selectionBlockedReason || "Exact quote authorization is unavailable."}
                  </small>
                )}
                <button
                  className="quote-pass-link"
                  onClick={() => {
                    setPendingQuoteId("");
                    setPendingDeclineId(quote.id);
                  }}
                  type="button"
                >
                  Not this one
                </button>
              </div>
            )}
          </article>
        ))}
      </section>
      {acceptedQuote && job && !job.isTestJob && accessToken && (
        <QuotePaymentCard accessToken={accessToken} quote={acceptedQuote} />
      )}
      {job?.status === "completed"
        && !job.isTestJob
        && acceptedQuote?.providerVerified
        && !acceptedQuote.providerTest && (
          <section className="repeat-booking-panel">
            <div>
              <span className="portal-service">Book again</span>
              <h2>Want to hire {acceptedQuote.providerName} again?</h2>
              <p>
                Start a new request with your contact, vehicle, and location details
                already filled in. The provider will send a new quote.
              </p>
            </div>
            <Link
              className="button primary"
              href={`/?bookAgain=${encodeURIComponent(accessToken)}#request`}
            >
              Request {acceptedQuote.providerName} again
            </Link>
          </section>
        )}
      {job?.status === "completed" && (
        <section className="review-panel">
          {review ? (
            <>
              <span className="portal-service">{job.isTestJob ? "Saved test review" : "Published review"}</span>
              <div className="published-review-stars" aria-label={`${review.rating} out of 5 stars`}>
                <span aria-hidden="true">{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</span>
                <strong>{review.rating}.0</strong>
              </div>
              <blockquote>{review.comment}</blockquote>
              <p>
                {job.isTestJob
                  ? "This test review is private and will not affect public ratings."
                  : `Your verified review of ${review.providerName} is now visible to other customers.`}
              </p>
            </>
          ) : (
            <>
              <span className="portal-service">{job.isTestJob ? "Private test review" : "Verified customer review"}</span>
              <h2>How did {quotes.find((quote) => quote.status === "accepted")?.providerName ?? "your provider"} do?</h2>
              <p>
                {job.isTestJob
                  ? "This review tests the workflow only. It will not appear publicly or affect provider ratings."
                  : "Your public name will show only your first name and last initial. Your email and request details stay private."}
              </p>
              <fieldset className="star-picker">
                <legend>Choose 1 to 5 stars</legend>
                <div>
                  {[1, 2, 3, 4, 5].map((rating) => (
                    <button
                      aria-label={`${rating} star${rating === 1 ? "" : "s"}`}
                      aria-pressed={reviewRating === rating}
                      className={reviewRating >= rating ? "selected" : ""}
                      key={rating}
                      onClick={() => {
                        setReviewRating(rating);
                        setConfirmingReview(false);
                      }}
                      type="button"
                    >
                      ★
                    </button>
                  ))}
                </div>
              </fieldset>
              <label className="review-comment">
                Comment
                <textarea
                  maxLength={800}
                  onChange={(event) => {
                    setReviewComment(event.target.value);
                    setConfirmingReview(false);
                  }}
                  placeholder="Tell other customers about the service you received."
                  rows={4}
                  value={reviewComment}
                />
                <small>{reviewComment.length}/800</small>
              </label>
              {confirmingReview ? (
                <div className="quote-confirm review-confirm">
                  <strong>Publish this review?</strong>
                  <p>This will make your {reviewRating}-star rating and comment visible to other customers.</p>
                  <div>
                    <button
                      className="button primary"
                      disabled={reviewBusy}
                      onClick={publishReview}
                      type="button"
                    >
                      {reviewBusy ? "Publishing…" : "Yes, publish review"}
                    </button>
                    <button
                      className="button secondary"
                      disabled={reviewBusy}
                      onClick={() => setConfirmingReview(false)}
                      type="button"
                    >
                      Go back
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  className="button primary review-button"
                  disabled={reviewRating === 0 || reviewComment.trim().length < 3}
                  onClick={() => setConfirmingReview(true)}
                  type="button"
                >
                  Review before publishing
                </button>
              )}
            </>
          )}
        </section>
      )}
    </main>
  );
}
