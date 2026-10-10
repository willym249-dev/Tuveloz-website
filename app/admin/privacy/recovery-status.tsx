"use client";

import { useRef, useState } from "react";

export function PrivacyRecoveryStatus() {
  const pending = useRef(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  async function check() {
    if (pending.current) return;
    pending.current = true;
    setLoading(true); setMessage(""); setError("");
    try {
      const response = await fetch("/api/admin/privacy-requests/recovery-status", { cache: "no-store" });
      const result = await response.json() as { state?: string; deletionEnabled?: boolean; message?: string; error?: string };
      if (!response.ok || result.deletionEnabled !== false || !["not-configured", "read-check-passed"].includes(result.state || "") || !result.message) {
        throw new Error(result.error || "Recovery setup could not be checked. Nothing was changed. Please try again.");
      }
      setMessage(result.message);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Recovery setup could not be checked. Nothing was changed.");
    } finally { pending.current = false; setLoading(false); }
  }
  return (
    <details className="admin-section">
      <summary>Account data deletion: recovery setup</summary>
      <section className="verification-record" aria-label="Privacy recovery setup">
        <p>Account data deletion is unavailable. This read-only check reviews recovery storage; it does not close accounts or remove records.</p>
        <button className="save-compliance" type="button" disabled={loading} onClick={() => void check()}>
          {loading ? "Checking recovery setup…" : "Check recovery setup"}
        </button>
        {message && <p role="status">{message}</p>}
        {error && <p className="form-error" role="alert">{error}</p>}
      </section>
    </details>
  );
}
