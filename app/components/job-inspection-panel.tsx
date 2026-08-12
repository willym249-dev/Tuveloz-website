"use client";

import { useEffect, useState } from "react";

type InspectionStatus = "pending" | "good" | "attention";

type InspectionItem = {
  id?: string;
  label: string;
  status: InspectionStatus;
  note: string;
};

type InspectionResponse = {
  role?: "provider" | "customer";
  canEdit?: boolean;
  items?: Array<{ label?: string; status?: string; note?: string }>;
  suggestions?: string[];
  serviceLabels?: string[];
  error?: string;
};

const STATUS_LABEL: Record<InspectionStatus, string> = {
  pending: "Not checked",
  good: "Good",
  attention: "Needs attention",
};

function normalizeStatus(value: unknown): InspectionStatus {
  return value === "good" || value === "attention" ? value : "pending";
}

export function JobInspectionPanel(
  { requestId, token }: { requestId: string; token?: string },
) {
  const readOnly = Boolean(token);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [items, setItems] = useState<InspectionItem[]>([]);
  const [serviceLabels, setServiceLabels] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    const query = token
      ? `token=${encodeURIComponent(token)}`
      : `requestId=${encodeURIComponent(requestId)}`;
    (async () => {
      try {
        const response = await fetch(`/api/job-inspection?${query}`, { cache: "no-store" });
        const result = (await response.json().catch(() => ({}))) as InspectionResponse;
        if (cancelled) return;
        if (!response.ok) throw new Error(result.error || "Unable to load the inspection.");
        setServiceLabels(result.serviceLabels ?? []);
        setSuggestions(result.suggestions ?? []);
        const loaded = (result.items ?? []).map((item) => ({
          label: item.label ?? "",
          status: normalizeStatus(item.status),
          note: item.note ?? "",
        }));
        setItems(loaded);
      } catch (reason) {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Unable to load the inspection.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [requestId, token]);

  function updateItem(index: number, patch: Partial<InspectionItem>) {
    setItems((current) => current.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function addItem(label = "") {
    setItems((current) => [...current, { label, status: "pending", note: "" }]);
  }

  function removeItem(index: number) {
    setItems((current) => current.filter((_, i) => i !== index));
  }

  async function save() {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const payload = items
        .map((item) => ({ label: item.label.trim(), status: item.status, note: item.note.trim() }))
        .filter((item) => item.label);
      const response = await fetch("/api/job-inspection", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ requestId, items: payload }),
      });
      const result = (await response.json().catch(() => ({}))) as InspectionResponse;
      if (!response.ok) throw new Error(result.error || "Unable to save the inspection.");
      setItems((result.items ?? []).map((item) => ({
        label: item.label ?? "",
        status: normalizeStatus(item.status),
        note: item.note ?? "",
      })));
      setNotice("Inspection saved. Your customer can see it.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to save the inspection.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="job-inspection-loading">Loading inspection…</p>;
  }

  if (readOnly) {
    if (!items.length) {
      return (
        <p className="job-inspection-empty">
          Your provider hasn&apos;t shared an inspection for this job yet.
        </p>
      );
    }
    return (
      <div className="job-inspection job-inspection-readonly">
        {error ? <p className="job-inspection-error">{error}</p> : null}
        <ul className="job-inspection-list">
          {items.map((item, index) => (
            <li key={index} className={`job-inspection-item status-${item.status}`}>
              <div className="job-inspection-item-head">
                <span className={`inspection-flag flag-${item.status}`}>{STATUS_LABEL[item.status]}</span>
                <strong>{item.label}</strong>
              </div>
              {item.note ? <p className="job-inspection-note">{item.note}</p> : null}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="job-inspection job-inspection-editor">
      {serviceLabels.length ? (
        <p className="job-inspection-hint">
          A checklist for <strong>{serviceLabels.join(", ")}</strong>. Mark each item, add a
          note, and save — your customer sees it on their request.
        </p>
      ) : null}
      {error ? <p className="job-inspection-error">{error}</p> : null}
      {notice ? <p className="job-inspection-notice">{notice}</p> : null}

      {items.length === 0 && suggestions.length > 0 ? (
        <div className="job-inspection-suggest">
          <span>Suggested for this job:</span>
          <div className="job-inspection-suggest-chips">
            {suggestions.map((label) => (
              <button key={label} type="button" className="chip" onClick={() => addItem(label)}>
                + {label}
              </button>
            ))}
            <button
              type="button"
              className="chip chip-all"
              onClick={() => setItems(suggestions.map((label) => ({ label, status: "pending", note: "" })))}
            >
              + Add all
            </button>
          </div>
        </div>
      ) : null}

      <ul className="job-inspection-list">
        {items.map((item, index) => (
          <li key={index} className={`job-inspection-item status-${item.status}`}>
            <input
              className="job-inspection-label-input"
              value={item.label}
              maxLength={80}
              placeholder="Checklist item"
              onChange={(event) => updateItem(index, { label: event.target.value })}
            />
            <div className="job-inspection-status-toggle" role="group" aria-label="Item status">
              {(["good", "attention", "pending"] as InspectionStatus[]).map((status) => (
                <button
                  key={status}
                  type="button"
                  className={`inspection-flag flag-${status} ${item.status === status ? "active" : ""}`}
                  aria-pressed={item.status === status}
                  onClick={() => updateItem(index, { status })}
                >
                  {STATUS_LABEL[status]}
                </button>
              ))}
            </div>
            <input
              className="job-inspection-note-input"
              value={item.note}
              maxLength={300}
              placeholder="Note (optional)"
              onChange={(event) => updateItem(index, { note: event.target.value })}
            />
            <button
              type="button"
              className="job-inspection-remove"
              aria-label="Remove item"
              onClick={() => removeItem(index)}
            >
              ✕
            </button>
          </li>
        ))}
      </ul>

      <div className="job-inspection-actions">
        <button type="button" className="link-button" onClick={() => addItem()}>
          + Add item
        </button>
        <button type="button" className="button lime small" disabled={saving} onClick={save}>
          {saving ? "Saving…" : "Save inspection"}
        </button>
      </div>
    </div>
  );
}
