"use client";
/* eslint-disable @next/next/no-img-element -- private R2 images must bypass shared optimization caches */

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { ConfirmAction } from "../components/confirm-action";
import { JobAppointmentPanel } from "../components/job-appointment-panel";
import { JobInspectionPanel } from "../components/job-inspection-panel";
import { JobMessages } from "../components/job-messages";
import { ProviderBusinessPage } from "../components/provider-business-page";
import { SiteLanguageButton } from "../components/site-language";
import { StripeConnectPanel } from "../components/stripe-connect-panel";
import { BrandMark, TuvelozIcon } from "../components/tuveloz-icons";
import {
  parseCustomerServiceLocations,
  parseJobServices,
  parseProviderServices,
  parseProviderWorkLocations,
  PARTS_COMMUNICATION_NOTICE,
  providerModeForWorkLocations,
} from "../../lib/service-matching";
import {
  JOB_HIGH_VOLTAGE_STATUS_VALUES,
  JOB_LOCATION_TYPE_OPTIONS,
  JOB_PROPERTY_PERMISSION_VALUES,
  JOB_SCOPE_FACTS_VERSION,
  JOB_VEHICLE_DRIVEABILITY_VALUES,
  JOB_VEHICLE_STATE_VALUES,
  type JobScopeFacts,
} from "../../lib/job-scope-facts";
import { CUSTOMER_JOB_POSTING_PAUSED, MARKETPLACE_MODE } from "../../lib/launch-status";

const MARKETPLACE_IS_ONBOARDING_ONLY = CUSTOMER_JOB_POSTING_PAUSED
  || String(MARKETPLACE_MODE) !== "live";

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
  jobFacts: JobScopeFacts | null;
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
type ProviderInvoice = {
  id: string;
  invoiceNumber: string;
  status: string;
  totalAmountCents: number;
  laborAmountCents: number;
  partsAmountCents: number;
  taxAmountCents: number;
  workSummary: string;
  issuedAt: string;
  createdAt: string;
};
type PendingQuote = {
  requestId: string;
  laborPrice: string;
  availability: string;
  message: string;
  workmanshipWarranty: string;
  laborOnlyConfirmed: boolean;
};
type PendingStatus = {
  requestId: string;
  status: string;
  label: string;
};

type ProviderView =
  | "available"
  | "quotes"
  | "accepted"
  | "schedule"
  | "earnings"
  | "invoices"
  | "messages"
  | "reviews"
  | "profile"
  | "performance";

const nextStatus: Record<string, { value: string; label: string }> = {
  "quote accepted": { value: "on my way", label: "I'm on my way" },
  "on my way": { value: "arrived", label: "I've arrived" },
  "arrived": { value: "completed", label: "Mark job completed" },
};


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

function actionErrorMessage(reason: unknown, fallback: string) {
  return reason instanceof Error && reason.message ? reason.message : fallback;
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
  const [activeView, setActiveView] = useState<ProviderView>("available");
  const [signingOut, setSigningOut] = useState(false);
  const [invoices, setInvoices] = useState<ProviderInvoice[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const [invoicesLoaded, setInvoicesLoaded] = useState(false);
  const [invoicesError, setInvoicesError] = useState("");

  useEffect(() => {
    async function loadWorkspace() {
      try {
        const accountResponse = await fetch("/api/account", { cache: "no-store" });
        const account = await accountResponse.json().catch(() => ({})) as {
          error?: string;
          role?: string;
          availableRoles?: string[];
        };
        if (accountResponse.status === 401) {
          window.location.replace("/account?role=provider");
          return;
        }
        if (!accountResponse.ok) {
          throw new Error(account.error || "Unable to load your provider account.");
        }
        if (account.role !== "provider") {
          window.location.replace("/customer");
          return;
        }
        setSignedIn(true);
        setCanSwitchWorkspace(account.availableRoles?.includes("customer") ?? false);

        const response = await fetch("/api/jobs", { cache: "no-store" });
        const data = await response.json().catch(() => ({})) as {
          error?: string;
          jobs?: Job[];
          assignedJobs?: AssignedJob[];
          myQuotes?: ProviderQuote[];
          provider?: Provider;
        };
        if (!response.ok) throw new Error(data.error || "Unable to load approved jobs.");
        if (!data.provider) throw new Error("The provider workspace returned incomplete account data.");
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

  function loadInvoices() {
    if (invoicesLoaded || invoicesLoading) return;
    setInvoicesLoading(true);
    fetch("/api/provider-invoices", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json().catch(() => ({})) as {
          error?: string;
          invoices?: ProviderInvoice[];
        };
        if (!response.ok) throw new Error(data.error || "Unable to load invoices.");
        setInvoices(data.invoices ?? []);
        setInvoicesLoaded(true);
      })
      .catch((reason) => {
        setInvoicesError(reason instanceof Error ? reason.message : "Unable to load invoices.");
      })
      .finally(() => setInvoicesLoading(false));
  }

  function reviewQuote(event: FormEvent<HTMLFormElement>, requestId: string) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    setError("");
    setPendingQuote({
      requestId,
      laborPrice: String(values.laborPrice ?? ""),
      availability: String(values.availability ?? ""),
      message: String(values.message ?? ""),
      workmanshipWarranty: String(values.workmanshipWarranty ?? "").trim(),
      laborOnlyConfirmed: values.laborOnlyConfirmed === "yes",
    });
  }

  async function submitQuote() {
    if (!pendingQuote) return;
    const quote = pendingQuote;
    setSubmittingQuoteId(quote.requestId);
    setError("");
    try {
      const response = await fetch("/api/jobs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...quote }),
      });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(result.error || "Unable to submit quote.");

      setSent(quote.requestId);
      setPendingQuote(null);

      try {
        const refreshedResponse = await fetch("/api/jobs", { cache: "no-store" });
        const refreshed = await refreshedResponse.json().catch(() => ({})) as {
          jobs?: Job[];
          assignedJobs?: AssignedJob[];
          myQuotes?: ProviderQuote[];
        };
        if (!refreshedResponse.ok) throw new Error("refresh failed");
        setJobs(refreshed.jobs ?? []);
        setAssignedJobs(refreshed.assignedJobs ?? []);
        setMyQuotes(refreshed.myQuotes ?? []);
      } catch {
        setError("Your quote was submitted, but the workspace could not refresh. Reload the page to see the latest status.");
      }
    } catch (reason) {
      setError(actionErrorMessage(reason, "Unable to submit quote."));
    } finally {
      setSubmittingQuoteId("");
    }
  }

  async function updateStatus(requestId: string, status: string) {
    setError("");
    setUpdatingJobId(requestId);
    const isCompletion = status === "completed";
    try {
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
      const result = await response.json().catch(() => ({})) as {
        error?: string;
        status?: string;
        trackedSeconds?: number;
      };
      if (!response.ok) throw new Error(result.error || "Unable to update this job.");
      if (!result.status) throw new Error("The job update returned an incomplete response.");

      setAssignedJobs((items) => items.map((item) => (
        item.id === requestId
          ? {
              ...item,
              status: result.status as string,
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
    } catch (reason) {
      setError(actionErrorMessage(reason, "Unable to update this job."));
    } finally {
      setUpdatingJobId("");
    }
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
    try {
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
      const result = await response.json().catch(() => ({})) as {
        error?: string;
        record?: Partial<AssignedJob>;
      };
      if (!response.ok) throw new Error(result.error || "Unable to save this job record.");
      const record = result.record;
      if (!record) throw new Error("The saved job record returned an incomplete response.");
      setAssignedJobs((items) => items.map((item) => (
        item.id === job.id ? { ...item, ...record } : item
      )));
      setSent(`record-${job.id}`);
    } catch (reason) {
      setError(actionErrorMessage(reason, "Unable to save this job record."));
    } finally {
      setSavingRecordId("");
      setPendingRecordId("");
    }
  }

  async function toggleTimer(
    job: AssignedJob,
    arrivalJobFacts?: JobScopeFacts,
    arrivalConfirmed = false,
  ) {
    setError("");
    setTimerJobId(job.id);
    try {
      const response = await fetch("/api/jobs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "toggle-timer",
          requestId: job.id,
          timerMode: job.timerStartedAt ? "stop" : "start",
          ...(arrivalJobFacts ? { arrivalJobFacts, arrivalConfirmed } : {}),
        }),
      });
      const result = await response.json().catch(() => ({})) as {
        error?: string;
        timerStartedAt?: string;
        trackedSeconds?: number;
      };
      if (!response.ok) throw new Error(result.error || "Unable to update the timer.");
      if (typeof result.trackedSeconds !== "number") {
        throw new Error("The timer update returned an incomplete response.");
      }
      setAssignedJobs((items) => items.map((item) => (
        item.id === job.id
          ? {
              ...item,
              timerStartedAt: result.timerStartedAt ?? "",
              trackedSeconds: result.trackedSeconds as number,
            }
          : item
      )));
    } catch (reason) {
      setError(actionErrorMessage(reason, "Unable to update the timer."));
    } finally {
      setTimerJobId("");
    }
  }

  async function startTimerFromArrival(
    event: FormEvent<HTMLFormElement>,
    job: AssignedJob,
  ) {
    event.preventDefault();
    if (!job.jobFacts) {
      setError("The accepted structured job scope is missing; work cannot start.");
      return;
    }
    const values = new FormData(event.currentTarget);
    const arrivalJobFacts: JobScopeFacts = {
      version: JOB_SCOPE_FACTS_VERSION,
      requestedOperations: job.jobFacts.requestedOperations.filter((operation) => (
        values.getAll("arrival-operation").includes(
          `${operation.serviceCode}:${operation.operationCode}`,
        )
      )),
      prohibitedOperationsAttestedAbsent: values.getAll("arrival-prohibited")
        .map(String),
      location: {
        type: String(values.get("arrival-location-type")) as JobScopeFacts["location"]["type"],
        address: String(values.get("arrival-address")),
        municipality: String(values.get("arrival-municipality")),
        county: String(values.get("arrival-county")) as JobScopeFacts["location"]["county"],
        state: String(values.get("arrival-state")) as JobScopeFacts["location"]["state"],
        postalCode: String(values.get("arrival-postal-code")),
        jurisdiction: String(values.get("arrival-jurisdiction")) as JobScopeFacts["location"]["jurisdiction"],
        propertyPermission: String(values.get("arrival-property-permission")) as JobScopeFacts["location"]["propertyPermission"],
      },
      vehicle: {
        driveability: String(values.get("arrival-driveability")) as JobScopeFacts["vehicle"]["driveability"],
        state: String(values.get("arrival-vehicle-state")) as JobScopeFacts["vehicle"]["state"],
        highVoltageStatus: String(values.get("arrival-high-voltage")) as JobScopeFacts["vehicle"]["highVoltageStatus"],
      },
      safetyAttestations: values.getAll("arrival-safety")
        .map(String) as JobScopeFacts["safetyAttestations"],
    };
    const arrivalConfirmed = values.get("arrival-confirmed") === "on";
    await toggleTimer(job, arrivalJobFacts, arrivalConfirmed);
  }

  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    setError("");
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) {
        throw new Error(result.error || "Unable to sign out. Your session is still active.");
      }
      window.location.replace("/account?role=provider");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to sign out. Your session is still active.");
      setSigningOut(false);
    }
  }

  async function switchWorkspace() {
    setError("");
    try {
      const response = await fetch("/api/auth/switch-role", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role: "customer" }),
      });
      const result = await response.json().catch(() => ({})) as {
        error?: string;
        destination?: string;
      };
      if (!response.ok) throw new Error(result.error || "Unable to switch workspaces.");
      if (!result.destination) throw new Error("The workspace switch returned an incomplete response.");
      window.location.replace(result.destination);
    } catch (reason) {
      setError(actionErrorMessage(reason, "Unable to switch workspaces."));
    }
  }

  const openJobs = jobs.filter((job) => !job.quoteSubmitted && sent !== job.id);
  const activeJobs = assignedJobs.filter((job) => job.status !== "completed");
  const completedJobs = assignedJobs.filter((job) => job.status === "completed");
  const completedJobValueCents = completedJobs.reduce(
    (total, job) => total + Number(job.priceCents),
    0,
  );
  const completedLaborCents = completedJobs.reduce(
    (total, job) => total + Number(job.laborPriceCents),
    0,
  );
  const trackedSecondsTotal = assignedJobs.reduce(
    (total, job) => total + trackedSecondsNow(job, now),
    0,
  );
  const workspaceReady = !loading && provider !== null;
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
            <button
              className="portal-account-link"
              disabled={signingOut}
              onClick={signOut}
              type="button"
            >
              {signingOut ? "Signing out…" : "Sign out"}
            </button>
          ) : (
            <Link className="portal-account-link" href="/account?role=provider">Provider sign in</Link>
          )}
          <SiteLanguageButton />
        </div>
      </header>
      <section className="portal-intro">
        <span className="kicker">
          {MARKETPLACE_IS_ONBOARDING_ONLY ? "Provider onboarding" : "Matched job alerts"}
        </span>
        <h1>{provider ? `Provider workspace for ${provider.name}.` : "Your provider workspace."}</h1>
        {provider?.verified && (
          <span className="verified-badge provider-workspace-badge">
            ✓ Account verification status recorded — no service or job access
          </span>
        )}
        {provider && (
          <span className="provider-mode-badge provider-workspace-badge">
            {providerModeForWorkLocations(provider.workLocations)}
          </span>
        )}
        {provider?.testProvider && <span className="test-badge provider-workspace-badge">TEST PROVIDER · FICTIONAL</span>}
        <p>
          {MARKETPLACE_IS_ONBOARDING_ONLY && !provider?.testProvider
            ? "TUVELOZ is accepting provider applications and evidence only. Real job alerts, quotes, appointments, work, and payments are disabled."
            : "Customer contact details appear only after your quote is selected."}
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
                  Your quote remains the provider subtotal. The current test
                  configuration proposes a separate 5% TUVELOZ customer fee;
                  final pricing and tax treatment remain under mandatory legal and CPA or tax-adviser review.
                </p>
              )}
              {provider.testProvider && (
                <p>This workspace is isolated to test jobs. No real alerts or public ratings are created.</p>
              )}
            </div>
          </details>
        )}
      </section>
      {workspaceReady && (
        <nav className="workspace-nav provider-dashboard-nav" aria-label="Provider dashboard">
          <button
            aria-pressed={activeView === "available"}
            className={activeView === "available" ? "workspace-nav-primary is-active" : "workspace-nav-primary"}
            onClick={() => setActiveView("available")}
            type="button"
          >
            <TuvelozIcon name="open-jobs" />
            {MARKETPLACE_IS_ONBOARDING_ONLY && !provider?.testProvider
              ? "Job access closed"
              : "Available jobs"} <span>{openJobs.length}</span>
          </button>
          <button aria-pressed={activeView === "quotes"} className={activeView === "quotes" ? "is-active" : ""} onClick={() => setActiveView("quotes")} type="button">
            My quotes <span>{myQuotes.length}</span>
          </button>
          <button aria-pressed={activeView === "accepted"} className={activeView === "accepted" ? "is-active" : ""} onClick={() => setActiveView("accepted")} type="button">
            <TuvelozIcon name="active-job" />Accepted jobs <span>{activeJobs.length}</span>
          </button>
          <button aria-pressed={activeView === "schedule"} className={activeView === "schedule" ? "is-active" : ""} onClick={() => setActiveView("schedule")} type="button">Schedule</button>
          <button aria-pressed={activeView === "earnings"} className={activeView === "earnings" ? "is-active" : ""} onClick={() => setActiveView("earnings")} type="button">Earnings</button>
          <button aria-pressed={activeView === "invoices"} className={activeView === "invoices" ? "is-active" : ""} onClick={() => { setActiveView("invoices"); loadInvoices(); }} type="button">Invoices</button>
          <button aria-pressed={activeView === "messages"} className={activeView === "messages" ? "is-active" : ""} onClick={() => setActiveView("messages")} type="button">Messages</button>
          <button aria-pressed={activeView === "reviews"} className={activeView === "reviews" ? "is-active" : ""} onClick={() => setActiveView("reviews")} type="button">Reviews</button>
          <button aria-pressed={activeView === "profile"} className={activeView === "profile" ? "is-active" : ""} onClick={() => setActiveView("profile")} type="button">Business profile</button>
          <button aria-pressed={activeView === "performance"} className={activeView === "performance" ? "is-active" : ""} onClick={() => setActiveView("performance")} type="button">Performance tools</button>
          <Link href="/ai?for=provider">Ask Tuveloz AI</Link>
        </nav>
      )}
      {workspaceReady && activeView === "schedule" && (
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
      {workspaceReady && activeView === "messages" && (
        <section className="portal-section" id="provider-messages">
          <div className="portal-section-heading">
            <div><span className="kicker">Private job communication</span><h2>Messages</h2></div>
            <p>Messaging opens only after a customer accepts your quote. The conversation appears in your workspace and that customer&apos;s workspace; Tuveloz may access stored messages for the purposes in its <a href="/privacy">Privacy Policy</a>.</p>
          </div>
          <JobMessages audience="provider" />
        </section>
      )}
      {error && <p className="form-error portal-alert">{error}</p>}
      {workspaceReady && provider && activeView === "earnings" && !provider.testProvider && (
        <details className="workspace-tools provider-workspace-tools" id="provider-payouts">
          <summary>Payout setup</summary>
          <div className="workspace-tool-content">
            <StripeConnectPanel signedIn={signedIn} />
          </div>
        </details>
      )}
      {workspaceReady && provider && (
        activeView === "profile" || activeView === "reviews" || activeView === "performance"
      ) && (
        <section className="portal-section provider-focused-tools" aria-live="polite">
          <ProviderBusinessPage
            focus={activeView === "reviews" ? "reviews" : activeView === "performance" ? "performance" : "profile"}
          />
          <div className="provider-control-note">
            <strong>Your business records</strong>
            <span>Time tracking is optional and controlled by you. It is not payroll or employee monitoring.</span>
          </div>
        </section>
      )}
      {workspaceReady && activeView === "accepted" && (
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
                    <p>Service locations: {parseCustomerServiceLocations(job.serviceLocations).join(" · ")}</p>
                    <p>
                      Parts arrangement: {job.partsSource} · Preference: {job.partsPreference}
                    </p>
                    <p className="admin-note">{PARTS_COMMUNICATION_NOTICE}</p>
                    <dl className="quote-breakdown compact">
                      <div><dt>Labor-only provider amount</dt><dd>${(Number(job.laborPriceCents) / 100).toFixed(2)}</dd></div>
                      <div><dt>Parts charged through Tuveloz</dt><dd>$0.00</dd></div>
                      <div className="total"><dt>Provider labor subtotal</dt><dd>${(Number(job.priceCents) / 100).toFixed(2)}</dd></div>
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
                            {job.timerStartedAt ? (
                              <button
                                className="button timer-stop"
                                disabled={timerJobId === job.id}
                                onClick={() => toggleTimer(job)}
                                type="button"
                              >
                                {timerJobId === job.id ? "Saving…" : "Stop timer"}
                              </button>
                            ) : (
                              <small>Complete the fresh arrival check below to start work.</small>
                            )}
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
                          Customer-supplied parts notes
                          <textarea
                            name="partsNotes"
                            rows={2}
                            defaultValue={job.partsNotes}
                            placeholder="Customer-supplied part name, brand, number, fitment note, or customer receipt reference"
                          />
                          <small>This private record does not add a parts charge to the Tuveloz payment.</small>
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
                      {!job.timerStartedAt && job.jobFacts && (
                        <form className="job-record-form" onSubmit={(event) => startTimerFromArrival(event, job)}>
                          <strong>Fresh provider arrival-safety check</strong>
                          <p className="approval-note">
                            Confirm the actual facts now. Stored customer facts alone cannot authorize work start.
                          </p>
                          {job.jobFacts.requestedOperations.map((operation) => (
                            <label key={`${operation.serviceCode}:${operation.operationCode}`}>
                              <input name="arrival-operation" required type="checkbox" value={`${operation.serviceCode}:${operation.operationCode}`} />
                              Actual operation: {operation.serviceCode} / {operation.operationCode}
                            </label>
                          ))}
                          {job.jobFacts.prohibitedOperationsAttestedAbsent.map((operation) => (
                            <label key={operation}>
                              <input name="arrival-prohibited" required type="checkbox" value={operation} />
                              Confirm {operation} remains absent at arrival.
                            </label>
                          ))}
                          <div className="job-record-grid">
                            <label>
                              Actual location type
                              <select name="arrival-location-type" required defaultValue={job.jobFacts.location.type}>
                                {JOB_LOCATION_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                              </select>
                            </label>
                            <label>
                              Property authority now
                              <select name="arrival-property-permission" required defaultValue={job.jobFacts.location.propertyPermission}>
                                {JOB_PROPERTY_PERMISSION_VALUES.map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}
                              </select>
                            </label>
                          </div>
                          <label>Exact arrival address<input name="arrival-address" required defaultValue={job.jobFacts.location.address} /></label>
                          <div className="job-record-grid">
                            <label>Municipality<input name="arrival-municipality" required defaultValue={job.jobFacts.location.municipality} /></label>
                            <label>ZIP<input name="arrival-postal-code" required defaultValue={job.jobFacts.location.postalCode} /></label>
                            <label>County<input name="arrival-county" readOnly value={job.jobFacts.location.county} /></label>
                            <label>State<input name="arrival-state" readOnly value={job.jobFacts.location.state} /></label>
                          </div>
                          <input name="arrival-jurisdiction" type="hidden" value={job.jobFacts.location.jurisdiction} />
                          <div className="job-record-grid">
                            <label>
                              Driveability now
                              <select name="arrival-driveability" required defaultValue="">
                                <option disabled value="">Choose at arrival</option>
                                {JOB_VEHICLE_DRIVEABILITY_VALUES.map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}
                              </select>
                            </label>
                            <label>
                              Vehicle state now
                              <select name="arrival-vehicle-state" required defaultValue="">
                                <option disabled value="">Choose at arrival</option>
                                {JOB_VEHICLE_STATE_VALUES.map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}
                              </select>
                            </label>
                            <label>
                              High-voltage status now
                              <select name="arrival-high-voltage" required defaultValue="">
                                <option disabled value="">Choose at arrival</option>
                                {JOB_HIGH_VOLTAGE_STATUS_VALUES.map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}
                              </select>
                            </label>
                          </div>
                          {job.jobFacts.safetyAttestations.map((attestation) => (
                            <label key={attestation}>
                              <input name="arrival-safety" required type="checkbox" value={attestation} />
                              Reconfirm {attestation.replaceAll("_", " ")} now.
                            </label>
                          ))}
                          <label className="policy-consent">
                            <input name="arrival-confirmed" required type="checkbox" />
                            <span>
                              I am the assigned performing provider and personally rechecked these actual operation,
                              location, vehicle, and safety facts now. If anything changes or becomes unsafe, I will
                              stop work and request a newly authorized scope before continuing.
                            </span>
                          </label>
                          <button className="button primary" disabled={timerJobId === job.id} type="submit">
                            {timerJobId === job.id ? "Checking..." : "Validate arrival facts and start timer"}
                          </button>
                        </form>
                      )}
                      {!job.timerStartedAt && !job.jobFacts && (
                        <p className="portal-error">Structured accepted job facts are missing. Work start is blocked.</p>
                      )}
                    </details>
                    <details className="job-tools job-appointment-details">
                      <summary>Appointment time</summary>
                      <JobAppointmentPanel requestId={job.id} />
                    </details>
                    <details className="job-tools job-inspection-details">
                      <summary>Inspection checklist</summary>
                      <JobInspectionPanel requestId={job.id} />
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
      {workspaceReady && activeView === "quotes" && (
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
                    <div><dt>Labor-only amount</dt><dd>${(Number(quote.laborPriceCents) / 100).toFixed(2)}</dd></div>
                    <div><dt>Parts charged through Tuveloz</dt><dd>$0.00</dd></div>
                    <div className="total"><dt>Your labor subtotal</dt><dd>${(Number(quote.priceCents) / 100).toFixed(2)}</dd></div>
                    <div><dt>Customer total including Customer Service Fee</dt><dd>${(Number(quote.customerTotalCents) / 100).toFixed(2)}</dd></div>
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
      {workspaceReady && activeView === "earnings" && (
        <div className="provider-history-tools" id="provider-history">
          <div className="workspace-tool-content">
        <section className="portal-section" id="completed-jobs">
          <div className="portal-section-heading">
            <div><span className="kicker">Job history</span><h2>Completed jobs</h2></div>
            <p>A simple record of finished work, accepted quote subtotals, time, notes, and photos.</p>
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
                    <div><dt>Labor-only amount</dt><dd>${(Number(job.laborPriceCents) / 100).toFixed(2)}</dd></div>
                    <div><dt>Parts charged through Tuveloz</dt><dd>$0.00</dd></div>
                    <div className="total"><dt>Accepted labor subtotal</dt><dd>${(Number(job.priceCents) / 100).toFixed(2)}</dd></div>
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
            <div><span className="kicker">Private totals</span><h2>Job value & hours</h2></div>
            <p>Completed job value is the sum of accepted quote subtotals for jobs marked completed. It is not a Stripe payout or transfer status.</p>
          </div>
          <div className="earnings-grid">
            <div><span>Completed labor value</span><strong>${(completedJobValueCents / 100).toFixed(2)}</strong></div>
            <div><span>Labor</span><strong>${(completedLaborCents / 100).toFixed(2)}</strong></div>
            <div><span>Parts charged through Tuveloz</span><strong>$0.00</strong></div>
            <div><span>Actual time</span><strong>{durationLabel(trackedSecondsTotal)}</strong></div>
            <div><span>Billable time</span><strong>{durationLabel(billableMinutesTotal * 60)}</strong></div>
          </div>
          <p className="records-disclaimer">
            Personal business records only, not payout confirmations. Check Stripe for payout
            and transfer status. Tuveloz does not use these hours for payroll, wages, schedules,
            or provider performance scoring.
          </p>
        </section>
          </div>
        </div>
      )}
      {workspaceReady && activeView === "invoices" && (
        <section className="portal-section" id="provider-invoices">
          <div className="portal-section-heading">
            <div><span className="kicker">Job records</span><h2>Invoices</h2></div>
            <p>Invoices issued for your completed jobs.</p>
          </div>
          {invoicesError && <p className="form-error" role="alert">{invoicesError}</p>}
          {invoicesLoading ? (
            <p className="admin-note">Loading invoices…</p>
          ) : invoices.length === 0 ? (
            <p className="admin-note">No invoices yet. They&apos;ll appear here once a job is completed and invoiced.</p>
          ) : (
            <div className="portal-grid">
              {invoices.map((invoice) => (
                <article className="portal-card" key={invoice.id}>
                  <div className="job-status-row">
                    <span className="portal-service">{invoice.invoiceNumber}</span>
                    <strong>${(invoice.totalAmountCents / 100).toFixed(2)}</strong>
                  </div>
                  <p>{invoice.workSummary}</p>
                  <dl className="quote-breakdown compact">
                    <div><dt>Labor</dt><dd>${(invoice.laborAmountCents / 100).toFixed(2)}</dd></div>
                    <div><dt>Parts</dt><dd>${(invoice.partsAmountCents / 100).toFixed(2)}</dd></div>
                    <div><dt>Tax</dt><dd>${(invoice.taxAmountCents / 100).toFixed(2)}</dd></div>
                    <div className="total"><dt>Total</dt><dd>${(invoice.totalAmountCents / 100).toFixed(2)}</dd></div>
                  </dl>
                  <p className="records-disclaimer">
                    Status: {invoice.status}{invoice.issuedAt ? ` · Issued ${invoice.issuedAt}` : ""}
                  </p>
                </article>
              ))}
            </div>
          )}
        </section>
      )}
      {workspaceReady && activeView === "available" && (
        <div className="portal-section-heading open-jobs-heading" id="open-jobs">
          <div>
            <span className="kicker">
              {MARKETPLACE_IS_ONBOARDING_ONLY && !provider?.testProvider ? "Onboarding only" : "Matched alerts"}
            </span>
            <h2>
              {MARKETPLACE_IS_ONBOARDING_ONLY && !provider?.testProvider
                ? "Real job access is closed"
                : "Available jobs"}
            </h2>
          </div>
          <p>
            {MARKETPLACE_IS_ONBOARDING_ONLY && !provider?.testProvider
              ? "Complete your application and evidence review. Approval does not activate any job or service while the marketplace remains closed."
              : "These approved requests match your services, job areas, and meeting options."}
          </p>
        </div>
      )}
      {activeView === "available" && (
      <section className="portal-grid">
        {loading ? <p className="admin-note">Checking for matching jobs…</p> : !provider ? null : openJobs.length === 0 ? <p className="admin-note">No matching approved jobs are currently open for a new quote.</p> : openJobs.map((job) => (
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
            <p>Service locations: {parseCustomerServiceLocations(job.serviceLocations).join(" · ")}</p>
            <p>
              Parts arrangement: {job.partsSource} · Preference: {job.partsPreference}
            </p>
            <p className="admin-note">{PARTS_COMMUNICATION_NOTICE}</p>
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
                      Labor-only amount ($)
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
                    <div className="fixed-launch-area">
                      <span>Parts charged through Tuveloz</span>
                      <strong>$0.00</strong>
                    </div>
                  </div>
                  <input disabled={pendingQuote?.requestId === job.id} required name="availability" placeholder="Availability, e.g. Saturday 10–2" />
                  <textarea disabled={pendingQuote?.requestId === job.id} required name="message" rows={3} placeholder="Explain the labor included, exclusions, timing, and any customer-supplied-part assumptions. Do not include a parts price." />
                  <label>
                    Workmanship warranty (optional — your business&apos;s own promise)
                    <input
                      disabled={pendingQuote?.requestId === job.id}
                      name="workmanshipWarranty"
                      maxLength={300}
                      placeholder="e.g. 12 months / 12,000 miles on workmanship. Leave blank if you don't offer one."
                    />
                  </label>
                  <label className="policy-consent">
                    <input
                      disabled={pendingQuote?.requestId === job.id}
                      name="laborOnlyConfirmed"
                      required
                      type="checkbox"
                      value="yes"
                    />
                    <span>
                      I confirm this quote is for labor only. It contains no provider-supplied
                      part, parts reimbursement, parts tax, or other parts charge.
                    </span>
                  </label>
                  {pendingQuote?.requestId !== job.id && <button className="button primary" type="submit">Review quote →</button>}
                </form>
                {pendingQuote?.requestId === job.id && (
                  <div className="quote-confirm action-confirm" role="group" aria-label="Confirm quote submission">
                    <strong>Submit this quote?</strong>
                    <p>
                      Labor-only amount ${(Number(pendingQuote.laborPrice) || 0).toFixed(2)}.
                      Parts charged through Tuveloz: $0.00. Availability: “{pendingQuote.availability}.”
                      {pendingQuote.workmanshipWarranty
                        ? ` Workmanship warranty offered by your business: “${pendingQuote.workmanshipWarranty}.”`
                        : " No workmanship warranty — the customer will see that stated on your quote and confirm it before hiring you."}
                      {" "}Please confirm the labor scope and details are correct.
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
      )}
    </main>
  );
}
