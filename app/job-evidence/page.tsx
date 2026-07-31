"use client";
/* eslint-disable @next/next/no-img-element -- private evidence images must remain on the authenticated no-store route */

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { SiteLanguageButton } from "../components/site-language";
import { BrandMark } from "../components/tuveloz-icons";

type AccountRole = "customer" | "provider";
type EvidenceType =
  | "customer-condition"
  | "provider-before-work"
  | "progress"
  | "receipt-note"
  | "completion-note";

type EvidenceItem = {
  id: string;
  requestId: string;
  uploadedByRole: AccountRole;
  evidenceType: EvidenceType;
  imageAvailable: boolean;
  imageUrl: string;
  note: string;
  odometerMiles: number;
  technicianName: string;
  createdAt: string;
};

type AcceptedJob = {
  requestId: string;
  vehicle: string;
  service: string;
  requestStatus: string;
  customerName: string;
  customerEmail: string;
  providerName: string;
  providerEmail: string;
  evidence: EvidenceItem[];
};

type EvidenceData = {
  role: AccountRole;
  email: string;
  jobs: AcceptedJob[];
  principles: string[];
};

const EVIDENCE_LABELS: Record<EvidenceType, string> = {
  "customer-condition": "Customer condition record",
  "provider-before-work": "Provider before-work record",
  progress: "Progress record",
  "receipt-note": "Receipt or parts record",
  "completion-note": "Completion note",
};

function readableDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function allowedEvidenceTypes(role: AccountRole, statusValue: string): EvidenceType[] {
  const status = statusValue.trim().toLowerCase();
  if (role === "customer") {
    return new Set(["quote accepted", "on my way", "arrived", "completed"]).has(status)
      ? ["customer-condition"]
      : [];
  }
  const types: EvidenceType[] = [];
  if (new Set(["quote accepted", "on my way", "arrived"]).has(status)) {
    types.push("provider-before-work");
  }
  if (new Set(["on my way", "arrived"]).has(status)) types.push("progress");
  if (new Set(["arrived", "completed"]).has(status)) {
    types.push("receipt-note", "completion-note");
  }
  return types;
}

export default function JobEvidencePage() {
  const [data, setData] = useState<EvidenceData | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyJobId, setBusyJobId] = useState("");

  async function load() {
    const response = await fetch("/api/job-evidence", { cache: "no-store" });
    const result = await response.json() as EvidenceData & { error?: string };
    if (response.status === 401) {
      window.location.replace("/account");
      return;
    }
    if (!response.ok) throw new Error(result.error || "Unable to load private job records.");
    setData(result);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load().catch((reason) => {
        setError(reason instanceof Error ? reason.message : "Unable to load private job records.");
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function addEvidence(event: FormEvent<HTMLFormElement>, requestId: string) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    formData.set("action", "add");
    formData.set("requestId", requestId);
    setBusyJobId(requestId);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/job-evidence", {
        method: "POST",
        body: formData,
      });
      const result = await response.json() as EvidenceData & { error?: string };
      if (!response.ok) throw new Error(result.error || "Unable to add the private job record.");
      setData(result);
      form.reset();
      setNotice("Private job record added. The earlier record remains unchanged.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to add the private job record.");
    } finally {
      setBusyJobId("");
    }
  }

  return (
    <main className="account-shell">
      <header className="account-header">
        <Link className="brand" href="/" aria-label="Tuveloz home">
          <BrandMark />
          <span>Tuveloz</span>
        </Link>
        <div className="account-header-actions">
          <SiteLanguageButton />
          <Link className="account-home-link" href={data?.role === "provider" ? "/provider-jobs" : "/customer"}>
            Account
          </Link>
        </div>
      </header>

      <section className="account-main">
        <div className="account-welcome">
          <span className="account-kicker">Private job record</span>
          <h1>Condition notes and photos.</h1>
          <p>Record visible vehicle condition, work progress, parts information, and completion context without changing the agreed price or scope.</p>
          {data && <small>{data.role} account · {data.email}</small>}
        </div>

        {error && <p className="form-error account-login-message" role="alert">{error}</p>}
        {notice && <p className="portal-success account-login-message" role="status">{notice}</p>}
        {!data && !error && <p className="admin-note account-loading">Loading private job records…</p>}

        {data && (
          <div className="account-grid account-customer-grid">
            <nav className="workspace-nav customer-workspace-nav" aria-label="Job record tools">
              <Link className="workspace-nav-primary" href="/job-authorizations">Job agreements</Link>
              <Link href="/appointments">Appointments</Link>
              <Link href="/tracking">Trip tracking</Link>
              <Link href="/privacy-center">Privacy center</Link>
              <Link href="/service-standards">Service standards</Link>
            </nav>

            <section className="account-card">
              <div className="account-card-heading">
                <div>
                  <span className="account-role">Record boundaries</span>
                  <h2>What this workspace does</h2>
                </div>
              </div>
              {data.principles.map((principle) => <p key={principle}>{principle}</p>)}
            </section>

            {data.jobs.length === 0 ? (
              <section className="account-card">
                <div className="account-empty">
                  <strong>No accepted jobs yet</strong>
                  <span>Private condition records become available after a customer accepts a provider quote.</span>
                </div>
              </section>
            ) : data.jobs.map((job) => {
              const evidenceTypes = allowedEvidenceTypes(data.role, job.requestStatus);
              return (
                <section className="account-card" key={job.requestId}>
                  <div className="account-card-heading">
                    <div>
                      <span className="account-role">{job.requestStatus}</span>
                      <h2>{job.service}</h2>
                      <p>{job.vehicle}</p>
                    </div>
                    <span className="account-count">{job.evidence.length}</span>
                  </div>
                  <p>
                    Customer: <strong>{job.customerName}</strong> · Provider: <strong>{job.providerName}</strong>
                  </p>

                  {job.evidence.length === 0 ? (
                    <div className="account-empty">
                      <strong>No condition records yet</strong>
                      <span>The first factual note or photo will appear here.</span>
                    </div>
                  ) : (
                    <div className="saved-provider-grid">
                      {job.evidence.map((item) => (
                        <article key={item.id}>
                          <span className="verified-badge">{EVIDENCE_LABELS[item.evidenceType]}</span>
                          <h3>{item.uploadedByRole === "provider" ? "Provider record" : "Customer record"}</h3>
                          <small>{readableDate(item.createdAt)}</small>
                          {item.imageAvailable && (
                            <a href={item.imageUrl} target="_blank" rel="noreferrer">
                              <img
                                alt={`${EVIDENCE_LABELS[item.evidenceType]} for ${job.vehicle}`}
                                loading="lazy"
                                src={item.imageUrl}
                              />
                            </a>
                          )}
                          {item.note && <p>{item.note}</p>}
                          {item.odometerMiles > 0 && <small>Odometer recorded: {item.odometerMiles.toLocaleString()} miles</small>}
                          {item.technicianName && <small>Technician identified by provider: {item.technicianName}</small>}
                          <small>Record ID: {item.id}</small>
                        </article>
                      ))}
                    </div>
                  )}

                  {evidenceTypes.length > 0 ? (
                    <form className="customer-profile-form" onSubmit={(event) => addEvidence(event, job.requestId)}>
                      <h3>Add a factual record</h3>
                      <label>
                        Record type
                        <select name="evidenceType" required>
                          {evidenceTypes.map((type) => (
                            <option key={type} value={type}>{EVIDENCE_LABELS[type]}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Photo, optional
                        <input accept="image/jpeg,image/png,image/webp" name="image" type="file" />
                        <small>JPG, PNG, or WebP; maximum 8 MB. Avoid photographing unrelated personal belongings.</small>
                      </label>
                      <label>
                        Factual note
                        <textarea
                          maxLength={1600}
                          name="note"
                          placeholder="Describe only visible condition, work progress, parts information, or completion context."
                          rows={4}
                        />
                      </label>
                      <label>
                        Odometer reading, optional
                        <input inputMode="numeric" max="9999999" min="0" name="odometerMiles" type="number" />
                      </label>
                      {data.role === "provider" && (
                        <label>
                          Technician name, optional
                          <input maxLength={100} name="technicianName" placeholder="Person who performed or documented the work" />
                        </label>
                      )}
                      <div className="customer-security-note">
                        <strong>Add, do not overwrite</strong>
                        <p>
                          These records are immutable. If something needs clarification, add a new dated note.
                          A record does not approve extra work, increase the price, or replace the provider&apos;s itemized invoice.
                        </p>
                      </div>
                      <button className="button primary" disabled={busyJobId === job.requestId} type="submit">
                        {busyJobId === job.requestId ? "Adding…" : "Add private job record"}
                      </button>
                    </form>
                  ) : (
                    <p className="admin-note">No new record type is available at this job status.</p>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
