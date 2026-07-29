"use client";
/* eslint-disable @next/next/no-img-element -- private R2 images must bypass shared optimization caches */

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { ConfirmAction } from "../components/confirm-action";
import { JobMessages } from "../components/job-messages";
import { MarketPriceLinks } from "../components/market-price-links";
import { ProviderBusinessPage } from "../components/provider-business-page";
import { SiteLanguageButton } from "../components/site-language";
import { StripeConnectPanel } from "../components/stripe-connect-panel";
import { BrandMark, TuvelozIcon } from "../components/tuveloz-icons";
import {
  parseCustomerServiceLocations,
  parseJobServices,
  parseProviderServices,
  parseProviderWorkLocations,
  PARTS_SOURCE_OPTIONS,
  providerModeForWorkLocations,
  QUOTE_PART_TYPE_OPTIONS,
} from "../../lib/service-matching";

type Job = {
  id: string;
  zip: string;
  launchArea: string;
  municipality: string;
  vehicle: string;
  service: string;
  partsSource: string;
  partsPreference: string;
  serviceLocations: string;
  details: string;
  createdAt: string;
  hasIssueImage: boolean;
  quoteSubmitted: boolean;
  isTestJob: string;
  repeatCustomer: boolean;
};
type ProviderQuote = {
  requestId: string;
  vehicle: string;
  service: string;
  zip: string;
  launchArea: string;
  municipality: string;
  requestStatus: string;
  priceCents: string;
  laborPriceCents: string;
  partsPriceCents: string;
  customerTotalCents: string;
  partType: string;
  availability: string;
  message: string;
  status: string;
  createdAt: string;
};

type AssignedJob = Job & {
  customerName: string;
  customerEmail: string;
  serviceAddress: string;
  status: string;
  priceCents: string;
  laborPriceCents: string;
  partsPriceCents: string;
  partType: string;
  availability: string;
  hasCompletionImage: boolean;
  workStatus: string;
  timerStartedAt: string;
  trackedSeconds: number;
  billableMinutes: number;
  workNotes: string;
  partsNotes: string;
};
type Provider = {
  name: string;
  service: string;
  serviceArea: string;
  workLocations: string;
  businessMunicipality: string;
  businessServiceAddress: string;
  verified: boolean;
  testProvider: boolean;
};
type PendingQuote = {
  requestId: string;
  laborPrice: string;
  partsPrice: string;
  partType: string;
  availability: string;
  message: string;
};
type PendingStatus = {
  requestId: string;
  status: string;
  label: string;
};

const nextStatus: Record<string, { value: string; label: string }> = {
  "quote accepted": { value: "on my way", label: "I'm on my way" },
  "on my way": { value: "arrived", label: "I've arrived" },
  "arrived": { value: "completed", label: "Mark job completed" },
};

function PartTypeHelp() {
  return (
    <details className="legal-help">
      <summary aria-label="What do the part types mean?">?</summary>
      <span>
        OEM means a part made for the vehicle brand. Aftermarket means a compatible
        part made by another company. Choose “No parts needed” only when the quote
        includes labor without a new part.
      </span>
    </details>
  );
}

function defaultPartType(preference: string) {
  return preference === "OEM" || preference === "Aftermarket"
    ? preference
    : "Aftermarket";
}

function requestAgeLabel(createdAt: string, now: number | null) {
  if (!now) return "Recently posted";
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(createdAt)
    ? `${createdAt.replace(" ", "T")}Z`
    : createdAt;
  const createdAtMs = Date.parse(normalized);
  if (!Number.isFinite(createdAtMs)) return "Recently posted";
  const elapsedMinutes = Math.max(0, Math.floor((now - createdAtMs) / 60_000));
  if (elapsedMinutes < 1) return "Posted just now";
  if (elapsedMinutes < 60) return `Posted ${elapsedMinutes}m ago`;
  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `Posted ${elapsedHours}h ago`;
  const elapsedDays = Math.floor(elapsedHours / 24);
  return `Posted ${elapsedDays}d ago`;
}

function durationLabel(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

function trackedSecondsNow(job: AssignedJob, now: number | null) {
  if (!job.timerStartedAt || !now) return job.trackedSeconds;
  const startedAt = Date.parse(job.timerStartedAt);
  if (!Number.isFinite(startedAt)) return job.trackedSeconds;
  return job.trackedSeconds + Math.max(0, Math.floor((now - startedAt) / 1000));
}

export default function ProviderJobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [assignedJobs, setAssignedJobs] = useState<AssignedJob[]>([]);
  const [myQuotes, setMyQuotes] = useState<ProviderQuote[]>([]);
  const [provider, setProvider] = useState<Provider | null>(null);
  const [loading, setLoading] = useState(true);
  const [sent, setSent] = useState("");
  const [error, setError] = useState("");
  const [updatingJobId, setUpdatingJobId] = useState("");
  const [submittingQuoteId, setSubmittingQuoteId] = useState("");
  const [pendingQuote, setPendingQuote] = useState<PendingQuote | null>(null);
  const [pendingStatus, setPendingStatus] = useState<PendingStatus | null>(null);
  const [completionPhoto, setCompletionPhoto] = useState<File | null>(null);
  const [now, setNow] = useState<number | null>(null);
  const [savingRecordId, setSavingRecordId] = useState("");
  const [pendingRecordId, setPendingRecordId] = useState("");
  const [timerJobId, setTimerJobId] = useState("");
  const [signedIn, setSignedIn] = useState(false);
  const [canSwitchWorkspace, setCanSwitchWorkspace] = useState(false);

  useEffect(() => {
    async function loadWorkspace() {
      try {
        const accountResponse = await fetch("/api/account", { cache: "no-store" });
        const account = await accountResponse.json();
        if (accountResponse.status === 401) {
          window.location.replace("/account?role=provider");
          return;
        }
        if (!accountResponse.ok) {
          throw new Error(account.error || "Unable to load your verified provider account.");
        }
        if (account.role !== "provider") {
          window.location.replace("/customer");
          return;
        }
        setSignedIn(true);
        setCanSwitchWorkspace(account.availableRoles?.includes("customer") ?? false);

        const response = await fetch("/api/jobs", { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to load approved jobs.");
        setJobs(data.jobs ?? []);
        setAssignedJobs(data.assignedJobs ?? []);
        setMyQuotes(data.myQuotes ?? []);
        setProvider(data.provider);
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Unable to load approved jobs.");
      } finally {
        setLoading(false);
      }
    }
    void loadWorkspace();
  }, []);

  useEffect(() => {
    const updateNow = () => setNow(Date.now());
    updateNow();
    const intervalId = window.setInterval(updateNow, 1_000);
    return () => window.clearInterval(intervalId);
  }, []);

  function reviewQuote(event: FormEvent<HTMLFormElement>, requestId: string) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    setError("");
    setPendingQuote({
      requestId,
      laborPrice: String(values.laborPrice ?? ""),
      partsPrice: String(values.partsPrice ?? "0"),
      partType: String(values.partType ?? "Customer supplied"),
      availability: String(values.availability ?? ""),
      message: String(values.message ?? ""),
    });
  }

  async function submitQuote() {
    if (!pendingQuote) return;
    setSubmittingQuoteId(pendingQuote.requestId);
    const response = await fetch("/api/jobs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...pendingQuote }),
    });
    const result = await response.json();
    setSubmittingQuoteId("");
    if (!response.ok) return setError(result.error || "Unable to submit quote.");
    setError("");
    setSent(pendingQuote.requestId);
    const refreshedResponse = await fetch("/api/jobs", { cache: "no-store" });
    if (refreshedResponse.ok) {
      const refreshed = await refreshedResponse.json();
      setJobs(refreshed.jobs ?? []);
      setAssignedJobs(refreshed.assignedJobs ?? []);
      setMyQuotes(refreshed.myQuotes ?? []);
    }
    setPendingQuote(null);
  }

  async function updateStatus(requestId: string, status: string) {
    setError("");
    setUpdatingJobId(requestId);
    const isCompletion = status === "completed";
    const response = isCompletion
      ? await (() => {
          const formData = new FormData();
          formData.set("action", "update-status");
          formData.set("requestId", requestId);
          formData.set("status", status);
          if (completionPhoto) formData.set("completion-photo", completionPhoto);
          return fetch("/api/jobs", { method: "POST", body: formData });
        })()
      : await fetch("/api/jobs", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "update-status", requestId, status }),
        });
    const result = await response.json();
    setUpdatingJobId("");
    if (!response.ok) return setError(result.error || "Unable to update this job.");
    setAssignedJobs((items) => items.map((item) => (
      item.id === requestId
        ? {
            ...item,
            status: result.status,
            hasCompletionImage: result.status === "completed" || item.hasCompletionImage,
            ...(result.status === "completed"
              ? {
                  workStatus: "completed",
                  timerStartedAt: "",
                  trackedSeconds: result.trackedSeconds ?? item.trackedSeconds,
                }
              : {}),
          }
        : item
    )));
    setPendingStatus(null);
    setCompletionPhoto(null);
  }

  async function saveJobRecord(event: FormEvent<HTMLFormElement>, job: AssignedJob) {
    event.preventDefault();
    if (pendingRecordId !== job.id) {
      setPendingRecordId(job.id);
      return;
    }
    setError("");
    setSavingRecordId(job.id);
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    const response = await fetch("/api/jobs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "save-job-record",
        requestId: job.id,
        workStatus: values.workStatus,
        actualMinutes: Math.round(Number(values.actualHours || 0) * 60),
        billableMinutes: Math.round(Number(values.billableHours || 0) * 60),
        workNotes: values.workNotes,
        partsNotes: values.partsNotes,
      }),
    });
    const result = await response.json();
    setSavingRecordId("");
    setPendingRecordId("");
    if (!response.ok) return setError(result.error || "Unable to save this job record.");
    setAssignedJobs((items) => items.map((item) => (
      item.id === job.id ? { ...item, ...result.record } : item
    )));
    setSent(`record-${job.id}`);
  }

  async function toggleTimer(job: AssignedJob) {
    setError("");
    setTimerJobId(job.id);
    const response = await fetch("/api/jobs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "toggle-timer",
        requestId: job.id,
        timerMode: job.timerStartedAt ? "stop" : "start",
      }),
    });
    const result = await response.json();
    setTimerJobId("");
    if (!response.ok) return setError(result.error || "Unable to update the timer.");
    setAssignedJobs((items) => items.map((item) => (
      item.id === job.id
        ? { ...item, timerStartedAt: result.timerStartedAt, trackedSeconds: result.trackedSeconds }
        : item
    )));
  }

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.replace("/account?role=provider");
  }

  function openWorkspaceSection(
    sectionId: "provider-history" | "provider-tools",
    targetId: string = sectionId,
  ) {
    const section = document.getElementById(sectionId);
    if (!(section instanceof HTMLDetailsElement)) return;
    section.open = true;
    window.requestAnimationFrame(() => {
      document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  async function switchWorkspace() {
    const response = await fetch("/api/auth/switch-role", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role: "customer" }),
    });
    const result = await response.json();
    if (!response.ok) {
      setError(result.error || "Unable to switch workspaces.");
      return;
    }
    window.location.replace(result.destination);
  }

  const openJobs = jobs.filter((job) => !job.quoteSubmitted && sent !== job.id);
  const activeJobs = assignedJobs.filter((job) => job.status !== "completed");
  const completedJobs = assignedJobs.filter((job) => job.status === "completed");
  const completedTotalCents = completedJobs.reduce(
    (total, job) => total + Number(job.priceCents),
    0,
  );
  const completedLaborCents = completedJobs.reduce(
    (total, job) => total + Number(job.laborPriceCents),
    0,
  );
  const completedPartsCents = completedJobs.reduce(
    (total, job) => total + Number(job.partsPriceCents),
    0,
  );
  const trackedSecondsTotal = assignedJobs.reduce(
    (total, job) => total + trackedSecondsNow(job, now),
    0,
  );
  const billableMinutesTotal = assignedJobs.reduce(
    (total, job) => total + job.billableMinutes,
    0,
  );

  return (
    <main className="portal-shell">
      <header className="portal-header">
        <Link className="brand" href="/"><BrandMark />Tuveloz</Link>
        <span>Founding provider workspace</span>
        <div className="portal-header-actions">
          {signedIn && canSwitchWorkspace && (
            <button className="portal-account-link" onClick={switchWorkspace} type="button">
              Switch
            </button>
          )}
          {signedIn ? (
            <button className="portal-account-link" onClick={signOut} type="button">Sign out</button>
          ) : (
            <Link className="portal-account-link" href="/account?role=provider">Provider sign in</Link>
          )}
          <SiteLanguageButton />
        </div>
      </header>
      <section className="portal-intro">
        <span className="kicker">Matched job alerts</span>
        <h1>{provider ? `Jobs matched for ${provider.name}.` : "Your provider workspace."}</h1>
        {provider?.verified && <span className="verified-badge provider-workspace-badge">✓ Tuveloz verified</span>}
        {provider && (
          <span className="provider-mode-badge provider-workspace-badge">
            {providerModeForWorkLocations(provider.workLocations)}
          </span>
        )}
        {provider?.testProvider && <span className="test-badge provider-workspace-badge">TEST PROVIDER · FICTIONAL</span>}
        <p>
          {provider ? "See active work and matched requests below. " : ""}
          Customer contact details appear only after your quote is selected.
        </p>
        {provider && (
          <details className="workspace-overview-details">
            <summary>Provider account details</summary>
            <div>
              <p>
                Services: {parseProviderServices(provider.service).join(", ")}
                {" · "}Job access: {provider.serviceArea}
              </p>
              <p>
                Service options: {parseProviderWorkLocations(provider.workLocations).join(" · ")}
              </p>
              {!provider.testProvider && (
                <p className="provider-fee-note">
                  Your quote remains your full subtotal. Tuveloz adds a separate
                  10% service fee to the customer&apos;s total.
                </p>
              )}
              {provider.testProvider && (
                <p>This workspace is isolated to test jobs. No real alerts or public ratings are created.</p>
              )}
            </div>
          </details>
        )}
      </section>
      {!loading && !error && (
        <nav className="workspace-nav provider-dashboard-nav" aria-label="Provider dashboard">
          <a className="workspace-nav-primary" href="#open-jobs"><TuvelozIcon name="open-jobs" />Available jobs <span>{openJobs.length}</span></a>
          <a href="#my-quotes">My quotes <span>{myQuotes.length}</span></a>
          <a href="#active-jobs"><TuvelozIcon name="active-job" />Accepted jobs <span>{activeJobs.length}</span></a>
          <a href="#provider-schedule">Schedule</a>
          <a
            href="#earnings-hours"
            onClick={(event) => {
              event.preventDefault();
              openWorkspaceSection("provider-history", "earnings-hours");
            }}
          >
            Earnings
          </a>
          <a href="#provider-messages">Messages</a>
          <a
            href="#provider-reviews"
            onClick={(event) => {
              event.preventDefault();
              openWorkspaceSection("provider-tools", "provider-reviews");
            }}
          >
            Reviews
          </a>
          <a
            href="#business-page"
            onClick={(event) => {
              event.preventDefault();
              openWorkspaceSection("provider-tools", "business-page");
            }}
          >
            Business profile
          </a>
          <a
            href="#provider-performance"
            onClick={(event) => {
              event.preventDefault();
              openWorkspaceSection("provider-tools", "provider-performance");
            }}
          >
            Performance tools
          </a>
        </nav>
      )}
      {!loading && !error && (
        <section className="portal-section provider-schedule-section" id="provider-schedule">
          <div className="portal-section-heading">
            <div><span className="kicker">Schedule</span><h2>Accepted-job availability</h2></div>
            <p>These are the availability details from quotes customers accepted. Confirm exact timing with each customer.</p>
          </div>
          {activeJobs.length === 0 ? (
            <p className="admin-note">No accepted jobs are currently scheduled.</p>
          ) : (
            <div className="portal-grid">
              {activeJobs.map((job) => (
                <article className="portal-card" key={`schedule-${job.id}`}>
                  <span className="portal-service">{job.status}</span>
                  <h2>{job.availability || "Time not confirmed"}</h2>
                  <p>{parseJobServices(job.service).join(" + ")} · {job.vehicle}</p>
                  <p>{job.launchArea || `ZIP ${job.zip}`} · {job.municipality}</p>
                  <small>Private work status: {job.workStatus}</small>
                </article>
              ))}
            </div>
          )}
        </section>
      )}
      {!loading && !error && (
        <section className="portal-section" id="provider-messages">
          <div className="portal-section-heading">
            <div><span className="kicker">Private job communication</span><h2>Messages</h2></div>
            <p>Messaging opens only after a customer accepts your quote. The conversation appears in your workspace and that customer&apos;s workspace; Tuveloz may access stored messages for the purposes in its <a href="/privacy">Privacy Policy</a>.</p>
          </div>
          <JobMessages audience="provider" />
        </section>
      )}
      {error && <p className="form-error portal-alert">{error}</p>}
      {!loading && !error && provider && (
        <details className="workspace-tools provider-workspace-tools" id="provider-tools">
          <summary>Payments and business page</summary>
          <div className="workspace-tool-content">
            {!provider.testProvider && <StripeConnectPanel signedIn={signedIn} />}
            <ProviderBusinessPage />
            <div className="provider-control-note">
              <strong>Your business records</strong>
              <span>Time tracking is optional and controlled by you. It is not payroll or employee monitoring.</span>
            </div>
          </div>
        </details>
      )}
      {!loading && !error && (
        <section className="portal-section" id="active-jobs">
          <div className="portal-section-heading">
            <div><span className="kicker">Job Center</span><h2>Active jobs</h2></div>
            <p>Keep the customer-visible status and your private work record in one place.</p>
          </div>
          {activeJobs.length === 0 ? (
            <p className="admin-note">No customer has selected one of your quotes yet.</p>
          ) : (
            <div className="portal-grid">
              {activeJobs.map((job) => {
                const next = nextStatus[job.status];
                return (
                  <article className="portal-card assigned-job" key={job.id}>
                    <div className="job-status-row">
                      <span className="portal-service">{job.status}</span>
                      <strong>${(Number(job.priceCents) / 100).toFixed(2)}</strong>
                    </div>
                    <h2>{parseJobServices(job.service).join(" + ")}</h2>
                    {job.isTestJob === "yes" && <span className="test-badge">TEST JOB</span>}
                    {job.repeatCustomer && <span className="repeat-badge">Repeat customer</span>}
                    <p>{job.vehicle} · {job.launchArea || `ZIP ${job.zip}`} · {job.municipality}</p>
                    <p>Service can happen: {parseCustomerServiceLocations(job.serviceLocations).join(" · ")}</p>
                    <p>
                      Parts: {job.partsSource}
                      {job.partsSource !== PARTS_SOURCE_OPTIONS[0] ? ` · ${job.partsPreference}` : ""}
                    </p>
                    <dl className="quote-breakdown compact">
                      <div><dt>Labor</dt><dd>${(Number(job.laborPriceCents) / 100).toFixed(2)}</dd></div>
                      {job.partsSource !== PARTS_SOURCE_OPTIONS[0] && (
                        <div>
                          <dt>
                            Parts
                            {job.partType === "Not specified" ? "" : ` (${job.partType})`}
                          </dt>
                          <dd>${(Number(job.partsPriceCents) / 100).toFixed(2)}</dd>
                        </div>
                      )}
                      <div className="total"><dt>Total</dt><dd>${(Number(job.priceCents) / 100).toFixed(2)}</dd></div>
                    </dl>
                    <blockquote>{job.details}</blockquote>
                    {job.hasIssueImage && (
                      <figure className="job-photo">
                        <figcaption>Customer issue photo</figcaption>
                        <img
                          src={`/api/job-images?requestId=${encodeURIComponent(job.id)}&kind=issue`}
                          alt="Customer-provided view of the vehicle issue"
                          referrerPolicy="no-referrer"
                        />
                      </figure>
                    )}
                    <div className="private-contact">
                      <span>Private customer contact</span>
                      <strong>{job.customerName}</strong>
                      <a href={`mailto:${job.customerEmail}`}>{job.customerEmail}</a>
                      {job.serviceAddress && <p>Customer service address: {job.serviceAddress}</p>}
                      {provider?.businessServiceAddress && (
                        <p>Your business meeting address: {provider.businessServiceAddress}</p>
                      )}
                      <small>Confirm the final meeting place with the customer before traveling.</small>
                    </div>
                    <details className="job-record">
                      <summary className="job-record-heading">
                        <div>
                          <span>Private job tools</span>
                          <strong>{job.workStatus.replace(/\b\w/g, (letter) => letter.toUpperCase())}</strong>
                        </div>
                        <div className="approval-pill">✓ Original quote approved</div>
                      </summary>
                      <p className="approval-note">
                        The customer approved the ${(Number(job.priceCents) / 100).toFixed(2)} quote above.
                        Any added work or price change still needs customer confirmation.
                      </p>
                      <form
                        className="job-record-form"
                        key={`${job.id}-${job.trackedSeconds}-${job.timerStartedAt}`}
                        onChange={() => pendingRecordId === job.id && setPendingRecordId("")}
                        onSubmit={(event) => saveJobRecord(event, job)}
                      >
                        <div className="job-record-grid">
                          <label>
                            Internal job status
                            <select name="workStatus" defaultValue={job.workStatus}>
                              <option value="scheduled">Scheduled</option>
                              <option value="in progress">In progress</option>
                              <option value="waiting for parts">Waiting for parts</option>
                            </select>
                          </label>
                          <div className="time-tracker">
                            <span>Actual time worked</span>
                            <strong>{durationLabel(trackedSecondsNow(job, now))}</strong>
                            <button
                              className={`button ${job.timerStartedAt ? "timer-stop" : "secondary"}`}
                              disabled={timerJobId === job.id}
                              onClick={() => toggleTimer(job)}
                              type="button"
                            >
                              {timerJobId === job.id
                                ? "Saving…"
                                : job.timerStartedAt
                                  ? "Stop timer"
                                  : "Start timer"}
                            </button>
                          </div>
                          <label>
                            Adjust actual hours
                            <input
                              name="actualHours"
                              type="number"
                              min="0"
                              step="0.05"
                              defaultValue={(job.trackedSeconds / 3600).toFixed(2)}
                              disabled={Boolean(job.timerStartedAt)}
                            />
                            <small>{job.timerStartedAt ? "Stop the timer before adjusting." : "Optional manual correction."}</small>
                          </label>
                          <label>
                            Billable hours
                            <input
                              name="billableHours"
                              type="number"
                              min="0"
                              step="0.05"
                              defaultValue={(job.billableMinutes / 60).toFixed(2)}
                            />
                            <small>For your records; this does not change the approved quote.</small>
                          </label>
                        </div>
                        <label>
                          Work notes
                          <textarea
                            name="workNotes"
                            rows={3}
                            defaultValue={job.workNotes}
                            placeholder="Diagnosis, work performed, or next step"
                          />
                        </label>
                        <label>
                          Parts and receipt notes
                          <textarea
                            name="partsNotes"
                            rows={2}
                            defaultValue={job.partsNotes}
                            placeholder="Part name, brand, number, supplier, or receipt reference"
                          />
                        </label>
                        {pendingRecordId === job.id ? (
                          <ConfirmAction
                            busy={savingRecordId === job.id}
                            confirmLabel="Confirm and save record"
                            confirmType="submit"
                            message="Review the hours and notes above before saving this private record."
                            onBack={() => setPendingRecordId("")}
                            title="Save this job record?"
                          />
                        ) : (
                          <button className="button secondary" disabled={savingRecordId === job.id} type="submit">
                            {savingRecordId === job.id ? "Saving…" : "Save private job record"}
                          </button>
                        )}
                        {sent === `record-${job.id}` && <small className="record-saved">✓ Job record saved</small>}
                      </form>
                    </details>
                    <ol className="job-progress" aria-label="Job progress">
                      {["Quote accepted", "On my way", "Arrived", "Completed"].map((step) => (
                        <li
                          className={step.toLowerCase() === job.status ? "current" : ""}
                          key={step}
                        >{step}</li>
                      ))}
                    </ol>
                    {next ? pendingStatus?.requestId === job.id ? (
                      <div className="quote-confirm action-confirm" role="group" aria-label={`Confirm ${next.label}`}>
                        <strong>Update the customer?</strong>
                        <p>This will tell the customer that the job status is now “{next.value}.” Please confirm this is correct.</p>
                        {next.value === "completed" && (
                          <label className="completion-photo-field">
                            Finished-work photo <span>(required)</span>
                            <input
                              required
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                              onChange={(event) => setCompletionPhoto(event.target.files?.[0] ?? null)}
                            />
                            <small>JPG, PNG, or WebP · maximum 8 MB.</small>
                          </label>
                        )}
                        <div>
                          <button
                            className="button primary"
                            disabled={updatingJobId === job.id || (next.value === "completed" && !completionPhoto)}
                            onClick={() => updateStatus(job.id, next.value)}
                          >
                            {updatingJobId === job.id ? "Updating…" : "Yes, update status"}
                          </button>
                          <button
                            className="button secondary"
                            disabled={updatingJobId === job.id}
                            onClick={() => setPendingStatus(null)}
                          >
                            Go back
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        className="button primary status-button"
                        onClick={() => {
                          setCompletionPhoto(null);
                          setPendingStatus({
                            requestId: job.id,
                            status: next.value,
                            label: next.label,
                          });
                        }}
                      >
                        {next.label} →
                      </button>
                    ) : (
                      <>
                        <div className="portal-success">✓ Job completed</div>
                        {job.hasCompletionImage && (
                          <figure className="job-photo">
                            <figcaption>Completion photo</figcaption>
                            <img
                              src={`/api/job-images?requestId=${encodeURIComponent(job.id)}&kind=completion`}
                              alt="Provider-submitted view of the completed work"
                              referrerPolicy="no-referrer"
                            />
                          </figure>
                        )}
                      </>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}
      {!loading && !error && (
        <section className="portal-section" id="my-quotes">
          <div className="portal-section-heading">
            <div><span className="kicker">My quotes</span><h2>Submitted quotes</h2></div>
            <p>Only quotes submitted from this provider account appear here.</p>
          </div>
          {myQuotes.length === 0 ? (
            <p className="admin-note">You have not submitted any quotes yet.</p>
          ) : (
            <div className="portal-grid">
              {myQuotes.map((quote) => (
                <article className="portal-card" key={quote.requestId}>
                  <div className="job-status-row">
                    <span className="portal-service">{quote.status}</span>
                    <strong>${(Number(quote.priceCents) / 100).toFixed(2)}</strong>
                  </div>
                  <h2>{parseJobServices(quote.service).join(" + ")}</h2>
                  <p>{quote.vehicle} · {quote.launchArea || `ZIP ${quote.zip}`} · {quote.municipality}</p>
                  <dl className="quote-breakdown compact">
                    <div><dt>Labor</dt><dd>${(Number(quote.laborPriceCents) / 100).toFixed(2)}</dd></div>
                    <div><dt>Parts ({quote.partType})</dt><dd>${(Number(quote.partsPriceCents) / 100).toFixed(2)}</dd></div>
                    <div className="total"><dt>Your subtotal</dt><dd>${(Number(quote.priceCents) / 100).toFixed(2)}</dd></div>
                    <div><dt>Customer sees</dt><dd>${(Number(quote.customerTotalCents) / 100).toFixed(2)}</dd></div>
                  </dl>
                  <p><strong>Availability:</strong> {quote.availability}</p>
                  <blockquote>{quote.message}</blockquote>
                  <small>Request status: {quote.requestStatus}</small>
                </article>
              ))}
            </div>
          )}
        </section>
      )}
      {!loading && !error && (
        <details className="workspace-tools provider-history-tools" id="provider-history">
          <summary>History and private totals ({completedJobs.length})</summary>
          <div className="workspace-tool-content">
        <section className="portal-section" id="completed-jobs">
          <div className="portal-section-heading">
            <div><span className="kicker">Job history</span><h2>Completed jobs</h2></div>
            <p>A simple record of finished work, approved amounts, time, notes, and photos.</p>
          </div>
          {completedJobs.length === 0 ? (
            <p className="admin-note">Completed jobs will appear here.</p>
          ) : (
            <div className="portal-grid">
              {completedJobs.map((job) => (
                <article className="portal-card completed-job" key={job.id}>
                  <div className="job-status-row">
                    <span className="portal-service">Completed</span>
                    <strong>${(Number(job.priceCents) / 100).toFixed(2)}</strong>
                  </div>
                  <h2>{parseJobServices(job.service).join(" + ")}</h2>
                  <p>{job.vehicle} · {job.launchArea || `ZIP ${job.zip}`} · {job.municipality}</p>
                  <dl className="quote-breakdown compact">
                    <div><dt>Labor</dt><dd>${(Number(job.laborPriceCents) / 100).toFixed(2)}</dd></div>
                    <div><dt>Parts</dt><dd>${(Number(job.partsPriceCents) / 100).toFixed(2)}</dd></div>
                    <div className="total"><dt>Approved total</dt><dd>${(Number(job.priceCents) / 100).toFixed(2)}</dd></div>
                  </dl>
                  <div className="completed-record">
                    <span>Actual time <strong>{durationLabel(trackedSecondsNow(job, now))}</strong></span>
                    <span>Billable time <strong>{durationLabel(job.billableMinutes * 60)}</strong></span>
                  </div>
                  {job.workNotes && <p><strong>Work notes:</strong> {job.workNotes}</p>}
                  {job.partsNotes && <p><strong>Parts notes:</strong> {job.partsNotes}</p>}
                  {job.hasCompletionImage && (
                    <figure className="job-photo">
                      <figcaption>Completion photo</figcaption>
                      <img
                        src={`/api/job-images?requestId=${encodeURIComponent(job.id)}&kind=completion`}
                        alt="Provider-submitted view of the completed work"
                        referrerPolicy="no-referrer"
                      />
                    </figure>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
        <section className="portal-section earnings-section" id="earnings-hours">
          <div className="portal-section-heading">
            <div><span className="kicker">Private totals</span><h2>Earnings & hours</h2></div>
            <p>Based on completed, customer-approved quotes and the time you recorded.</p>
          </div>
          <div className="earnings-grid">
            <div><span>Completed earnings</span><strong>${(completedTotalCents / 100).toFixed(2)}</strong></div>
            <div><span>Labor</span><strong>${(completedLaborCents / 100).toFixed(2)}</strong></div>
            <div><span>Parts</span><strong>${(completedPartsCents / 100).toFixed(2)}</strong></div>
            <div><span>Actual time</span><strong>{durationLabel(trackedSecondsTotal)}</strong></div>
            <div><span>Billable time</span><strong>{durationLabel(billableMinutesTotal * 60)}</strong></div>
          </div>
          <p className="records-disclaimer">
            Personal business records only. Tuveloz does not use these hours for payroll,
            wages, schedules, or provider performance scoring.
          </p>
        </section>
          </div>
        </details>
      )}
      {!loading && !error && (
        <div className="portal-section-heading open-jobs-heading" id="open-jobs">
          <div><span className="kicker">Matched alerts</span><h2>Available jobs</h2></div>
          <p>These approved requests match your services, job areas, and meeting options.</p>
        </div>
      )}
      <section className="portal-grid">
        {loading ? <p className="admin-note">Checking for matching jobs…</p> : !error && openJobs.length === 0 ? <p className="admin-note">No matching approved jobs are currently open for a new quote.</p> : openJobs.map((job) => (
          <article className="portal-card" key={job.id}>
            <span className="portal-service">{parseJobServices(job.service).join(" + ")}</span>
            {job.isTestJob === "yes" && <span className="test-badge">TEST JOB</span>}
            {job.repeatCustomer && <span className="repeat-badge">Repeat customer request</span>}
            <h2>{job.vehicle}</h2>
            <div className="job-meta-row" aria-label="Request status">
              <span className="request-age">{requestAgeLabel(job.createdAt, now)}</span>
              <span className={`request-quote-status ${job.quoteSubmitted || sent === job.id ? "submitted" : ""}`}>
                {job.quoteSubmitted || sent === job.id ? "Quote submitted" : "Open for quotes"}
              </span>
            </div>
            <p>{job.launchArea || `ZIP ${job.zip}`} · {job.municipality}</p>
            <p>Service can happen: {parseCustomerServiceLocations(job.serviceLocations).join(" · ")}</p>
            <p>
              Parts: {job.partsSource}
              {job.partsSource !== PARTS_SOURCE_OPTIONS[0] ? ` · ${job.partsPreference}` : ""}
            </p>
            {job.partsSource !== PARTS_SOURCE_OPTIONS[0] && (
              <MarketPriceLinks
                vehicle={job.vehicle}
                service={job.service}
                preference={job.partsPreference}
              />
            )}
            <blockquote>{job.details}</blockquote>
            {job.hasIssueImage && (
              <figure className="job-photo">
                <figcaption>Customer issue photo</figcaption>
                <img
                  src={`/api/job-images?requestId=${encodeURIComponent(job.id)}&kind=issue`}
                  alt="Customer-provided view of the vehicle issue"
                  referrerPolicy="no-referrer"
                />
              </figure>
            )}
            {job.quoteSubmitted || sent === job.id ? <div className="portal-success">✓ Quote submitted for customer review.</div> : (
              <>
                <form onSubmit={(event) => reviewQuote(event, job.id)}>
                  <div className="quote-breakdown-fields">
                    <label>
                      Labor ($)
                      <input
                        disabled={pendingQuote?.requestId === job.id}
                        required
                        name="laborPrice"
                        type="number"
                        min="0.01"
                        step="0.01"
                        placeholder="0.00"
                      />
                    </label>
                    {job.partsSource === PARTS_SOURCE_OPTIONS[0] ? (
                      <>
                        <input name="partsPrice" type="hidden" value="0" />
                        <input name="partType" type="hidden" value="Customer supplied" />
                      </>
                    ) : (
                      <>
                        <label>
                          <span className="field-label-with-help">
                            Part type
                            <PartTypeHelp />
                          </span>
                          <select
                            defaultValue={defaultPartType(job.partsPreference)}
                            disabled={pendingQuote?.requestId === job.id}
                            name="partType"
                            required
                          >
                            {QUOTE_PART_TYPE_OPTIONS.map((option) => (
                              <option key={option}>{option}</option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Parts price ($)
                          <input
                            defaultValue="0"
                            disabled={pendingQuote?.requestId === job.id}
                            required
                            name="partsPrice"
                            type="number"
                            min="0"
                            step="0.01"
                          />
                        </label>
                      </>
                    )}
                  </div>
                  <input disabled={pendingQuote?.requestId === job.id} required name="availability" placeholder="Availability, e.g. Saturday 10–2" />
                  <textarea disabled={pendingQuote?.requestId === job.id} required name="message" rows={3} placeholder="Explain what the labor and parts amounts include." />
                  {pendingQuote?.requestId !== job.id && <button className="button primary" type="submit">Review quote →</button>}
                </form>
                {pendingQuote?.requestId === job.id && (
                  <div className="quote-confirm action-confirm" role="group" aria-label="Confirm quote submission">
                    <strong>Submit this quote?</strong>
                    <p>
                      Labor ${(Number(pendingQuote.laborPrice) || 0).toFixed(2)} + {pendingQuote.partType.toLowerCase()} ${(Number(pendingQuote.partsPrice) || 0).toFixed(2)}
                      {" "}makes a ${(Number(pendingQuote.laborPrice || 0) + Number(pendingQuote.partsPrice || 0)).toFixed(2)} total.
                      Availability: “{pendingQuote.availability}.” Please confirm the details are correct.
                    </p>
                    <div>
                      <button
                        className="button primary"
                        disabled={submittingQuoteId === job.id}
                        onClick={submitQuote}
                      >
                        {submittingQuoteId === job.id ? "Submitting…" : "Yes, submit quote"}
                      </button>
                      <button
                        className="button secondary"
                        disabled={submittingQuoteId === job.id}
                        onClick={() => setPendingQuote(null)}
                      >
                        Go back
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </article>
        ))}
      </section>
    </main>
  );
}
