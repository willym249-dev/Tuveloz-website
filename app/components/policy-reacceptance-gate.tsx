"use client";

import { useState } from "react";
import {
  POLICY_REACCEPTANCE_TEXT,
  type PolicyAcceptanceStatus,
} from "../../lib/policy-reacceptance";

type PolicyReacceptanceGateProps = {
  status: PolicyAcceptanceStatus;
  onAccepted: (status: PolicyAcceptanceStatus) => void;
};

/**
 * Blocks a signed-in workspace until the account affirmatively accepts the
 * current policy bundle. New terms only bind people who actually agreed to
 * them, so an account whose recorded acceptance predates the current release
 * must click through again before continuing — continued use is never treated
 * as agreement.
 */
export function PolicyReacceptanceGate({
  status,
  onAccepted,
}: PolicyReacceptanceGateProps) {
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (status.current) return null;

  async function accept() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/account/policy-acceptance", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ accepted: "yes" }),
      });
      const result = await response.json();
      if (!response.ok || !result.policyAcceptance?.current) {
        throw new Error(result.error || "Unable to record your acceptance right now.");
      }
      onAccepted(result.policyAcceptance);
    } catch (reason) {
      setError(
        reason instanceof Error && reason.message
          ? reason.message
          : "Unable to record your acceptance right now.",
      );
      setBusy(false);
    }
  }

  return (
    <div
      aria-label="Updated Tuveloz policies"
      aria-modal="true"
      className="policy-reacceptance-backdrop"
      role="dialog"
    >
      <section className="policy-reacceptance-panel">
        <h2>Our terms have changed</h2>
        <p>
          Tuveloz&apos;s policies were updated after you last agreed to them. The
          Terms of Use now include a dispute-resolution and arbitration
          section with a class-action waiver — and a 30-day window to opt out
          of arbitration by email after you accept. Please review the updated
          documents before continuing:
        </p>
        <ul>
          {status.documents.map((document) => (
            <li key={document.key}>
              <a href={document.href} rel="noreferrer" target="_blank">
                {document.title}
              </a>
            </li>
          ))}
        </ul>
        <label className="policy-reacceptance-consent">
          <input
            checked={agreed}
            disabled={busy}
            onChange={(event) => setAgreed(event.target.checked)}
            type="checkbox"
          />
          <span>{POLICY_REACCEPTANCE_TEXT}</span>
        </label>
        <button
          className="button primary"
          disabled={!agreed || busy}
          onClick={accept}
          type="button"
        >
          {busy ? "Saving…" : "I agree"}
        </button>
        {error && <p className="policy-reacceptance-error" role="alert">{error}</p>}
        <p className="policy-reacceptance-note">
          Your workspace stays available after you agree. If you don&apos;t want
          to accept, you can close this page — your account and its data are
          unchanged, and the <a href="/privacy-center">Privacy Center</a>{" "}
          remains available.
        </p>
      </section>
    </div>
  );
}
