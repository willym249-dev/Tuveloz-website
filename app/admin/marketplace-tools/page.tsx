"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { BrandMark } from "../../components/tuveloz-icons";

type Credential = {
  id: string;
  providerName: string;
  providerEmail: string;
  credentialName: string;
  issuingAuthority: string;
  credentialIdentifier: string;
  jurisdiction: string;
  expiresAt: string;
  status: string;
  reviewNote: string;
  publicDisplay: string;
  createdAt: string;
};

type Appointment = {
  id: string;
  providerName: string;
  providerEmail: string;
  customerName: string;
  customerEmail: string;
  service: string;
  requestedByRole: string;
  startsAt: string;
  confirmedStartAt: string;
  status: string;
  createdAt: string;
};

type AdminToolsResponse = {
  credentials: Credential[];
  appointments: Appointment[];
  metrics: {
    activeCatalogItems: number;
    pendingAppointments: number;
    pendingCredentials: number;
    activeLocationShares: number;
    redeemedOilChangeOffers: number;
  };
  error?: string;
};

function dateLabel(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
}

export default function AdminMarketplaceToolsPage() {
  const [data, setData] = useState<AdminToolsResponse | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/marketplace-tools", { cache: "no-store" });
    const result = await response.json().catch(() => ({})) as AdminToolsResponse;
    if (!response.ok) throw new Error(result.error || "Unable to load owner marketplace tools.");
    setData(result);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load().catch((reason) => setError(
        reason instanceof Error ? reason.message : "Unable to load owner marketplace tools.",
      ));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function reviewCredential(event: FormEvent<HTMLFormElement>, credentialId: string) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    setBusy(credentialId);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/marketplace-tools", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "review-credential",
          id: credentialId,
          status: values.status,
          reviewNote: values.reviewNote,
          publicDisplay: values.publicDisplay === "on",
        }),
      });
      const result = await response.json().catch(() => ({})) as AdminToolsResponse;
      if (!response.ok) throw new Error(result.error || "Unable to review this credential.");
      setData(result);
      setNotice("Credential review saved.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to review this credential.");
    } finally {
      setBusy("");
    }
  }

  return (
    <main className="account-shell">
      <header className="account-header">
        <Link className="brand" href="/"><BrandMark /><span>Tuveloz</span></Link>
        <div className="account-header-actions">
          <Link className="account-home-link" href="/admin">Main admin</Link>
          <Link className="account-home-link" href="/">Website</Link>
        </div>
      </header>
      <section className="account-main">
        <div className="account-welcome">
          <span className="account-kicker">Owner-only tools</span>
          <h1>Marketplace operations.</h1>
          <p>Review provider-entered optional credentials and monitor appointment, promotion, catalog, and active location-sharing records.</p>
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        {notice && <p className="portal-success" role="status">{notice}</p>}
        {!data && !error && <p className="admin-note">Loading protected owner tools…</p>}
        {data && (
          <>
            <section className="account-card">
              <div className="earnings-grid">
                <div><span>Active provider prices</span><strong>{data.metrics.activeCatalogItems}</strong></div>
                <div><span>Pending appointments</span><strong>{data.metrics.pendingAppointments}</strong></div>
                <div><span>Pending credentials</span><strong>{data.metrics.pendingCredentials}</strong></div>
                <div><span>Active location shares</span><strong>{data.metrics.activeLocationShares}</strong></div>
                <div><span>Oil-change offers redeemed</span><strong>{data.metrics.redeemedOilChangeOffers}</strong></div>
              </div>
              <p className="records-disclaimer">
                Live location records contain only the latest provider point, expire automatically,
                and are not displayed here. Use this count only for operational monitoring.
              </p>
            </section>

            <section className="account-card">
              <div className="account-card-heading">
                <div><span className="account-role">Provider credentials</span><h2>Optional submissions</h2></div>
                <span className="account-count">{data.credentials.length}</span>
              </div>
              <p>
                These provider-entered records are separate from legally required official credential checks.
                Verify only when you have reviewed a reliable source. Public display remains off unless explicitly approved.
              </p>
              {data.credentials.length ? (
                <div className="account-request-list">
                  {data.credentials.map((credential) => (
                    <article className="account-request" key={credential.id}>
                      <span>
                        <strong>{credential.credentialName} · {credential.providerName}</strong>
                        <small>{credential.providerEmail}</small>
                        <small>
                          {credential.issuingAuthority || "No issuing authority entered"}
                          {credential.jurisdiction ? ` · ${credential.jurisdiction}` : ""}
                          {credential.expiresAt ? ` · expires ${credential.expiresAt}` : ""}
                        </small>
                        {credential.credentialIdentifier && <small>Identifier: {credential.credentialIdentifier}</small>}
                      </span>
                      <form onSubmit={(event) => reviewCredential(event, credential.id)}>
                        <label>
                          Review status
                          <select name="status" defaultValue={credential.status}>
                            <option value="pending">Pending</option>
                            <option value="verified">Verified</option>
                            <option value="rejected">Rejected</option>
                          </select>
                        </label>
                        <label>
                          Review note
                          <textarea
                            name="reviewNote"
                            maxLength={600}
                            rows={3}
                            defaultValue={credential.reviewNote}
                            placeholder="Record the official source or why the submission was rejected"
                          />
                        </label>
                        <label>
                          <input
                            name="publicDisplay"
                            type="checkbox"
                            defaultChecked={credential.publicDisplay === "yes"}
                          />
                          Allow this verified optional credential to appear publicly
                        </label>
                        <button className="button primary" disabled={busy === credential.id} type="submit">
                          {busy === credential.id ? "Saving…" : "Save review"}
                        </button>
                      </form>
                    </article>
                  ))}
                </div>
              ) : <p className="admin-note">No provider-entered credentials.</p>}
            </section>

            <section className="account-card">
              <div className="account-card-heading">
                <div><span className="account-role">Appointments</span><h2>Recent requests</h2></div>
                <span className="account-count">{data.appointments.length}</span>
              </div>
              {data.appointments.length ? (
                <div className="account-request-list">
                  {data.appointments.map((appointment) => (
                    <article className="account-request" key={appointment.id}>
                      <span>
                        <strong>{appointment.service} · {appointment.status}</strong>
                        <small>{dateLabel(appointment.confirmedStartAt || appointment.startsAt)}</small>
                        <small>Provider: {appointment.providerName} ({appointment.providerEmail})</small>
                        <small>Customer: {appointment.customerName} ({appointment.customerEmail})</small>
                        <small>Requested by: {appointment.requestedByRole}</small>
                      </span>
                    </article>
                  ))}
                </div>
              ) : <p className="admin-note">No appointments have been requested.</p>}
            </section>
          </>
        )}
      </section>
    </main>
  );
}