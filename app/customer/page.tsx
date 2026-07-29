"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SiteLanguageButton } from "../components/site-language";
import { BrandMark } from "../components/tuveloz-icons";
import { parseJobServices } from "../../lib/service-matching";

type CustomerRequest = {
  id: string;
  vehicle: string;
  service: string;
  launchArea: string;
  municipality: string;
  status: string;
  createdAt: string;
  quoteCount: number;
};

type CustomerAccount = {
  role: "customer";
  email: string;
  availableRoles: Array<"customer" | "provider">;
  requests: CustomerRequest[];
};

type CustomerView = "requests" | "quotes" | "active" | "history";

const ACTIVE_JOB_STATUSES = new Set(["quote accepted", "on my way", "arrived"]);
const HISTORY_JOB_STATUSES = new Set(["completed", "cancelled", "canceled"]);

const CUSTOMER_VIEW_COPY: Record<CustomerView, {
  title: string;
  emptyTitle: string;
  emptyText: string;
}> = {
  requests: {
    title: "My requests",
    emptyTitle: "No requests yet",
    emptyText: "Your vehicle-service requests will appear here.",
  },
  quotes: {
    title: "Quotes received",
    emptyTitle: "No quotes received yet",
    emptyText: "Requests with provider quotes will appear here.",
  },
  active: {
    title: "Active jobs",
    emptyTitle: "No active jobs",
    emptyText: "Jobs begin appearing here after you accept a provider quote.",
  },
  history: {
    title: "Job history",
    emptyTitle: "No completed jobs yet",
    emptyText: "Completed and cancelled jobs will appear here.",
  },
};

function requestMatchesView(request: CustomerRequest, view: CustomerView) {
  if (view === "quotes") return request.quoteCount > 0;
  if (view === "active") return ACTIVE_JOB_STATUSES.has(request.status.toLowerCase());
  if (view === "history") return HISTORY_JOB_STATUSES.has(request.status.toLowerCase());
  return true;
}

function shortDate(value: string) {
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)
    ? `${value.replace(" ", "T")}Z`
    : value;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime())
    ? "Recent request"
    : parsed.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function CustomerPage() {
  const [account, setAccount] = useState<CustomerAccount | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [activeView, setActiveView] = useState<CustomerView>("requests");

  useEffect(() => {
    fetch("/api/account", { cache: "no-store" }).then(async (response) => {
      const result = await response.json();
      if (response.status === 401) {
        window.location.replace("/account?role=customer");
        return;
      }
      if (!response.ok) throw new Error(result.error || "Unable to load your customer workspace.");
      if (result.role !== "customer") {
        window.location.replace("/provider-jobs");
        return;
      }
      setAccount(result);
    }).catch((reason) => setError(reason.message || "Unable to load your customer workspace."));
  }, []);

  async function signOut() {
    setBusy(true);
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.replace("/account?role=customer");
  }

  async function switchWorkspace() {
    setBusy(true);
    const response = await fetch("/api/auth/switch-role", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role: "provider" }),
    });
    const result = await response.json();
    setBusy(false);
    if (!response.ok) {
      setError(result.error || "Unable to switch workspaces.");
      return;
    }
    window.location.replace(result.destination);
  }

  const visibleRequests = account
    ? account.requests.filter((request) => requestMatchesView(request, activeView))
    : [];
  const viewCopy = CUSTOMER_VIEW_COPY[activeView];

  return (
    <main className="account-shell">
      <header className="account-header">
        <Link className="brand" href="/" aria-label="Tuveloz home">
          <BrandMark />
          <span>Tuveloz</span>
        </Link>
        <div className="account-header-actions">
          <SiteLanguageButton />
          {account?.availableRoles.includes("provider") && (
            <button className="account-home-link" disabled={busy} onClick={switchWorkspace} type="button">
              Switch
            </button>
          )}
          <button className="account-home-link" disabled={busy} onClick={signOut} type="button">
            Sign out
          </button>
        </div>
      </header>

      <section className="account-main">
        <div className="account-welcome">
          <span className="account-kicker">Customer workspace</span>
          <h1>Your jobs.</h1>
          <p>View updates, review quotes, or post a new request.</p>
          {account && <small>Signed in as {account.email}</small>}
        </div>

        {error && <p className="form-error account-login-message" role="alert">{error}</p>}
        {!account && !error && <p className="admin-note account-loading">Loading your requests…</p>}
        {account && (
          <div className="account-grid account-customer-grid">
            <nav className="workspace-nav customer-workspace-nav" aria-label="Customer dashboard">
              <Link className="workspace-nav-primary" href="/post-job">Post a job</Link>
              <button
                aria-controls="my-requests"
                aria-pressed={activeView === "requests"}
                className={activeView === "requests" ? "is-active" : ""}
                onClick={() => setActiveView("requests")}
                type="button"
              >
                My requests
              </button>
              <button
                aria-controls="my-requests"
                aria-pressed={activeView === "quotes"}
                className={activeView === "quotes" ? "is-active" : ""}
                onClick={() => setActiveView("quotes")}
                type="button"
              >
                Quotes received
              </button>
              <button
                aria-controls="my-requests"
                aria-pressed={activeView === "active"}
                className={activeView === "active" ? "is-active" : ""}
                onClick={() => setActiveView("active")}
                type="button"
              >
                Active jobs
              </button>
              <button
                aria-controls="my-requests"
                aria-pressed={activeView === "history"}
                className={activeView === "history" ? "is-active" : ""}
                onClick={() => setActiveView("history")}
                type="button"
              >
                Job history
              </button>
              <Link href="/payments">Payment policy</Link>
            </nav>

            <section aria-live="polite" className="account-card" id="my-requests">
              <div className="account-card-heading">
                <div>
                  <span className="account-role">Customer requests</span>
                  <h2>{viewCopy.title}</h2>
                </div>
                <span className="account-count">{visibleRequests.length}</span>
              </div>
              {visibleRequests.length > 0 ? (
                <div className="account-request-list">
                  {visibleRequests.map((request) => (
                    <Link
                      className="account-request"
                      href={`/my-request?request=${encodeURIComponent(request.id)}`}
                      key={request.id}
                    >
                      <span>
                        <strong>{parseJobServices(request.service).join(" + ")} · {request.vehicle}</strong>
                        <small>
                          {request.launchArea || request.municipality} · {shortDate(request.createdAt)}
                        </small>
                      </span>
                      <span className={`account-status ${request.status !== "new" ? "is-active" : ""}`}>
                        {request.status}
                      </span>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="account-empty">
                  <strong>{viewCopy.emptyTitle}</strong>
                  <span>{viewCopy.emptyText}</span>
                </div>
              )}
              <Link className="button primary account-button" href="/post-job">
                Post a job <span>→</span>
              </Link>
            </section>

            <details className="workspace-tools account-customer-guide">
              <summary>How customer privacy works</summary>
              <div className="workspace-tool-content">
                <p>
                  Providers see only the information needed to decide whether to
                  quote. Your exact address and contact details are shared only
                  with the provider you select.
                </p>
              </div>
            </details>
          </div>
        )}
      </section>
    </main>
  );
}
