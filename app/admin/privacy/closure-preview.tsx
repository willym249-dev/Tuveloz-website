"use client";

import { useState } from "react";
import type { ClosurePreview } from "../../../lib/privacy-closure-preview";

export function AccountClosurePreview({ requestId }: { requestId: string }) {
  const [preview, setPreview] = useState<ClosurePreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [closing, setClosing] = useState(false);
  const [notice, setNotice] = useState("");
  const [caseReference, setCaseReference] = useState("");
  const [reviewAfter, setReviewAfter] = useState("");
  const [retentionNotes, setRetentionNotes] = useState("");
  const [confirmations, setConfirmations] = useState([false, false, false]);

  async function closeAccess() {
    if (!preview?.reviewToken || closing) return;
    setClosing(true);
    setError("");
    try {
      const response = await fetch("/api/admin/privacy-requests/close-access", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: requestId, reviewToken: preview.reviewToken, caseReference, reviewAfter, retentionNotes,
          confirmWholeAccount: confirmations[1], confirmIdentityAndAuthority: confirmations[0], confirmRetainedDataReview: confirmations[2] }),
      });
      const result = await response.json() as { accessClosed?: boolean; error?: string };
      if (!response.ok || !result.accessClosed) throw new Error(result.error || "Access closure could not be confirmed. Refresh the account review before retrying.");
      setNotice("Sign-in access closed. The privacy request remains open for data review.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Access closure could not be confirmed.");
    } finally {
      setPreview(null);
      setClosing(false);
    }
  }

  async function loadPreview() {
    setLoading(true);
    setError("");
    setPreview(null);
    try {
      const response = await fetch(`/api/admin/privacy-requests/closure-preview?id=${encodeURIComponent(requestId)}`, { cache: "no-store" });
      const result = await response.json() as { preview?: ClosurePreview; error?: string };
      if (!response.ok || !result.preview || result.preview.request.id !== requestId) {
        throw new Error(result.error || "The account review could not be loaded. Please try again.");
      }
      setPreview(result.preview);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The account review could not be loaded. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="verification-record" aria-label="Account closure review">
      <h4>Review the account before closing it</h4>
      <p>This checks records linked to both customer and provider access. It does not sign anyone out, close an account or delete information.</p>
      <button className="save-compliance" type="button" disabled={loading || closing} onClick={() => void loadPreview()}>
        {loading ? "Checking account records…" : preview ? "Refresh account review" : "Preview account records"}
      </button>
      {error && <p role="alert" className="form-error">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      {preview && (
        <div>
          <p role="status">Review loaded. No account or data was changed.</p>
          <p><strong>Whole-account preview, including both roles.</strong> Checked {new Date(preview.generatedAt).toLocaleString()}. Records may change after this check.</p>
          {preview.flags.legalHolds > 0 && <p role="alert">Legal or unclassified holds: {preview.flags.legalHolds}. Resolve the retention review before considering deletion.</p>}
          {preview.flags.incidents > 0 && <p role="alert">Open incidents or payment holds: {preview.flags.incidents}. Review these reports before proceeding.</p>}
          {preview.groups.map(group => (
            <details key={group.id}>
              <summary>{group.label}: {group.recordCount} records</summary>
              <ul>{group.sources.map(source => <li key={source.table}>{source.table.replaceAll("_", " ")}: {source.recordCount}</li>)}</ul>
            </details>
          ))}
          <h4>Still needs review</h4>
          {preview.files && <details>
            <summary>Uploaded file references: {preview.files.items.length}{preview.files.truncated ? "+" : ""} to review</summary>
            <p>These records point to files. Decide ownership, retention and any shared access before taking action. Nothing here deletes or downloads a file.</p>
            {preview.files.storageCheck ? <p>File check attempted {new Date(preview.files.storageCheck.finishedAt).toLocaleString()}. Each refresh checks up to {preview.files.storageCheck.objectLimit} different files. Results can change; a missing file does not prove it was deleted. File contents, older copies, unlinked uploads and vendor backups need a separate review.</p> : <p>File availability has not been checked.</p>}
            {preview.files.items.some(item => item.storage === "unavailable" || item.storage === "not-checked") && <p role="alert">Some files could not be checked. They remain pending; do not treat them as missing or deleted.</p>}
            {preview.files.truncated && <p role="alert">Only the first {preview.files.limit} references are shown. This list is incomplete; arrange a scoped review of the remaining references.</p>}
            {preview.files.items.length === 0 ? <p>No file references were found in the sources checked. Embedded notes, vendor copies, backups and unlinked uploads still need a separate review.</p> :
              <ul>{preview.files.items.map(item => <li key={`${item.source}:${item.recordId}:${item.field}`}>
                <strong>{item.label}</strong> — record {item.recordId}, field {item.field.replaceAll("_", " ")}. Needs review.
                {" "}{item.storage === "found" ? "File found in upload storage." : item.storage === "missing" ? "File missing from upload storage at this check." : item.storage === "unavailable" ? "Couldn’t check this file. Refresh to try again." : "File availability not checked."}
                {item.otherReferences > 0 && <> This file has {item.otherReferences} other recorded reference{item.otherReferences === 1 ? "" : "s"}; review them before removal.</>}
              </li>)}</ul>}
          </details>}
          <ul>{preview.nextSteps.map(step => <li key={step}>{step}</li>)}</ul>
          <details>
            <summary>Sources not counted automatically</summary>
            <ul>{preview.manualSources.map(source => <li key={source.table}>{source.table.replaceAll("_", " ")}: {source.reason}</li>)}</ul>
          </details>
          {preview.accessClosed ? <p>Sign-in access is already closed. Data fulfillment still needs a separate review.</p> : preview.accessClosureAllowed && preview.reviewToken ? (
            <form onSubmit={event => { event.preventDefault(); void closeAccess(); }}>
              <h4>Close sign-in access for this unused account</h4>
              <p>This closes customer and provider access together. It keeps records and the privacy request open for data review.</p>
              <label>Verified case reference<input required minLength={8} maxLength={200} value={caseReference} onChange={event => setCaseReference(event.target.value)} disabled={closing} /></label>
              <label>Next data-review date<input required type="date" value={reviewAfter} onChange={event => setReviewAfter(event.target.value)} disabled={closing} /></label>
              <label htmlFor={`closure-retention-${requestId}`}>Records to retain and reason</label>
              <textarea id={`closure-retention-${requestId}`} required minLength={20} maxLength={2000} value={retentionNotes} onChange={event => setRetentionNotes(event.target.value)} disabled={closing} />
              {["I verified the person’s identity and authority for this request.", "The person requested closure of both customer and provider access.", "I reviewed retained records; this action does not complete the privacy request."].map((label, index) => (
                <label key={label}><input required type="checkbox" checked={confirmations[index]} disabled={closing} onChange={event => setConfirmations(current => current.map((value, position) => position === index ? event.target.checked : value))} />{label}</label>
              ))}
              <button className="save-compliance" type="submit" disabled={closing || !confirmations.every(Boolean)}>{closing ? "Closing sign-in access…" : "Close sign-in access"}</button>
            </form>
          ) : <p>Accounts with job or payment history, holds or shared business access need a separate closure review.</p>}
        </div>
      )}
    </section>
  );
}
