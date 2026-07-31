"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { BrandMark } from "../../components/tuveloz-icons";

type PrivacyStatus = "submitted" | "in-review" | "completed" | "denied" | "withdrawn";

type PrivacyRequest = {
  id: string;
  email: string;
  role: "customer" | "provider";
  requestType: string;
  relatedRequestId: string;
  details: string;
  status: PrivacyStatus;
  identitySource: string;
  resolutionNote: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string;
};

function readableDate(value: string) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export default function AdminPrivacyPage() {
  const [requests, setRequests] = useState<PrivacyRequest[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState("");

  async function load() {
    const response = await fetch("/api/admin/privacy-requests", { cache: "no-store" });
    const result = await response.json() as { requests?: PrivacyRequest[]; error?: string };
    if (!response.ok) throw new Error(result.error || "Unable to load privacy requests.");
    setRequests(result.requests ?? []);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load().catch((reason) => {
        setError(reason instanceof Error ? reason.message : "Unable to load privacy requests.");
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function updateRequest(
    event: FormEvent<HTMLFormElement>,
    request: PrivacyRequest,
  ) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    setBusyId(request.id);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/privacy-requests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: request.id,
          status: values.status,
          resolutionNote: values.resolutionNote,
        }),
      });
      const result = await response.json() as { requests?: PrivacyRequest[]; error?: string };
      if (!response.ok) throw new Error(result.error || "Unable to update the privacy request.");
      setRequests(result.requests ?? []);
      setNotice(`Privacy request ${request.id} updated.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to update the privacy request.");
    } finally {
      setBusyId("");
    }
  }

  const openCount = requests.filter((item) => item.status === "submitted" || item.status === "in-review").length;

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <Link className="brand" href="/admin"><BrandMark /><span>Tuveloz</span></Link>
        <div><span>Private owner privacy workspace</span><Link href="/admin">Owner dashboard</Link></div>
      </header>

      <section className="admin-intro">
        <span className="kicker">Privacy operations</span>
        <h1>Verified privacy requests</h1>
        <p>
          Review signed-in requests, record a customer-facing explanation, and preserve the decision history.
          Do not copy passwords, login codes, payment credentials, or unrelated third-party information into notes.
        </p>
        <div className="admin-stats">
          <article><strong>{requests.length}</strong><span>Total requests</span></article>
          <article><strong>{openCount}</strong><span>Open requests</span></article>
          <article><strong>{requests.filter((item) => item.status === "completed").length}</strong><span>Completed</span></article>
          <article><strong>{requests.filter((item) => item.status === "denied").length}</strong><span>Denied</span></article>
        </div>
      </section>

      {error && <p className="form-error admin-control-message" role="alert">{error}</p>}
      {notice && <p className="portal-success admin-control-message" role="status">{notice}</p>}

      <section className="admin-section">
        <div className="admin-section-heading">
          <div>
            <span className="kicker">Identity source: signed-in account</span>
            <h2>Request queue</h2>
          </div>
          <strong>{openCount} open</strong>
        </div>
        <p className="admin-section-copy">
          Completing an account-closure request records the privacy decision; it does not automatically erase
          records required for active jobs, authorizations, payments, refunds, disputes, safety, fraud prevention,
          tax, accounting, insurance, or other lawful retention needs.
        </p>

        {requests.length === 0 ? (
          <p className="admin-note">No verified privacy requests yet.</p>
        ) : (
          <div className="admin-grid">
            {requests.map((item) => (
              <article className="admin-card" key={item.id}>
                <div className="admin-card-top">
                  <span>{item.status}</span>
                  <time>{readableDate(item.createdAt)}</time>
                </div>
                <h3>{item.requestType.replaceAll("-", " ")}</h3>
                <p>{item.role} account · <a href={`mailto:${item.email}`}>{item.email}</a></p>
                <p>Identity verification: {item.identitySource.replaceAll("-", " ")}</p>
                <p>Request ID: {item.id}</p>
                {item.relatedRequestId && <p>Related request: {item.relatedRequestId}</p>}
                {item.details ? <blockquote>{item.details}</blockquote> : <p className="admin-note">No additional details supplied.</p>}
                {item.resolutionNote && (
                  <div className="verification-record">
                    <strong>Recorded response</strong>
                    <p>{item.resolutionNote}</p>
                    {item.resolvedAt && <small>Resolved {readableDate(item.resolvedAt)}</small>}
                  </div>
                )}

                {item.status !== "withdrawn" && (
                  <form className="credential-card" onSubmit={(event) => updateRequest(event, item)}>
                    <label>
                      Review status
                      <select defaultValue={item.status === "submitted" ? "in-review" : item.status} name="status">
                        <option value="in-review">In review</option>
                        <option value="completed">Completed</option>
                        <option value="denied">Denied</option>
                      </select>
                    </label>
                    <label>
                      Customer-facing explanation
                      <textarea
                        defaultValue={item.resolutionNote.split("\n\nOwner reviewer:")[0]}
                        maxLength={2000}
                        name="resolutionNote"
                        placeholder="Explain what was done, what was retained, or why the request cannot be fully granted."
                        rows={5}
                      />
                    </label>
                    <button className="save-compliance" disabled={busyId === item.id} type="submit">
                      {busyId === item.id ? "Saving…" : "Save review decision"}
                    </button>
                  </form>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
