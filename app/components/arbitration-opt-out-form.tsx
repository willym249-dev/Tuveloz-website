"use client";

import { useState } from "react";

/**
 * The form behind the promise in section 13 of the Terms of Use: 30 days to
 * decline arbitration, at no cost, in writing.
 *
 * Kept to one field on purpose. The Terms say an email address is all it
 * takes, so asking for anything else here would quietly make the right harder
 * to exercise than the document says it is. The role selector is optional and
 * changes nothing about whether the opt-out counts.
 *
 * On failure the person is pointed at hello@tuveloz.com rather than told to
 * try again, because the email route is equally valid under the Terms and
 * their 30 days keep running either way.
 */
export function ArbitrationOptOutForm() {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ termsVersion: string; recordedAt: string } | null>(null);

  if (done) {
    return (
      <div className="fleet-form-done" role="status">
        <strong>Done. You&apos;re out of arbitration.</strong>
        <p>
          We&apos;ve recorded it against the {done.termsVersion} Terms of Use and
          sent a confirmation to <strong>{email}</strong> — keep that email, it&apos;s
          your proof. Disputes between you and Tuveloz now go to the courts in
          Montgomery County, Maryland, and the class-action waiver doesn&apos;t
          apply to you.
        </p>
        <p>
          Nothing about your account, your pricing, or how your jobs are handled
          changes, and we won&apos;t treat you differently for it. If we publish a
          new version of the Terms, you get a fresh 30 days to decline
          arbitration under that version too.
        </p>
        <p>
          Didn&apos;t get the confirmation within a few minutes? Check spam, then
          email <a href="mailto:hello@tuveloz.com">hello@tuveloz.com</a>. Your
          opt-out is on file either way.
        </p>
      </div>
    );
  }

  return (
    <form
      className="fleet-inquiry-form"
      onSubmit={async (event) => {
        event.preventDefault();
        setError("");
        setBusy(true);
        try {
          const response = await fetch("/api/arbitration-opt-out", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ email, role }),
          });
          const payload = await response.json().catch(() => ({})) as {
            error?: string;
            termsVersion?: string;
            recordedAt?: string;
          };
          if (!response.ok) {
            throw new Error(payload.error
              || "We could not record that. Email hello@tuveloz.com with the subject “Arbitration opt-out”.");
          }
          setDone({
            termsVersion: payload.termsVersion ?? "",
            recordedAt: payload.recordedAt ?? "",
          });
        } catch (submitError) {
          setError(submitError instanceof Error
            ? submitError.message
            : "We could not record that. Email hello@tuveloz.com with the subject “Arbitration opt-out”.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <label>
        <span>The email address you use with Tuveloz</span>
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          maxLength={180}
          autoComplete="email"
          required
        />
      </label>
      <label>
        <span>Are you a customer or a provider? <small>(optional)</small></span>
        <select value={role} onChange={(event) => setRole(event.target.value)}>
          <option value="">Rather not say</option>
          <option value="customer">Customer</option>
          <option value="provider">Provider</option>
        </select>
        <small className="fleet-field-note">
          This is only so we know who we&apos;re talking to. It has no effect on
          whether your opt-out counts.
        </small>
      </label>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      <button className="button primary" type="submit" disabled={busy}>
        {busy ? "Recording…" : "Opt out of arbitration"}
      </button>
      <small className="fleet-field-note">
        Free, and it stays free. We&apos;ll email you a written confirmation.
      </small>
    </form>
  );
}
