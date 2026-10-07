"use client";

import { useState } from "react";
import type { ClosurePreview } from "../../../lib/privacy-closure-preview";

export function AccountClosurePreview({ requestId }: { requestId: string }) {
  const [preview, setPreview] = useState<ClosurePreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
      <button className="save-compliance" type="button" disabled={loading} onClick={() => void loadPreview()}>
        {loading ? "Checking account records…" : preview ? "Refresh account review" : "Preview account records"}
      </button>
      {error && <p role="alert" className="form-error">{error}</p>}
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
          <ul>{preview.nextSteps.map(step => <li key={step}>{step}</li>)}</ul>
          <details>
            <summary>Sources not counted automatically</summary>
            <ul>{preview.manualSources.map(source => <li key={source.table}>{source.table.replaceAll("_", " ")}: {source.reason}</li>)}</ul>
          </details>
        </div>
      )}
    </section>
  );
}
