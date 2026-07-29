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
};

type CustomerAccount = {
  role: "customer";
  email: string;
  availableRoles: Array<"customer" | "provider">;
  requests: CustomerRequest[];
};

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
            <section className="account-card">
              <div className="account-card-heading">
                <div>
                  <span className="account-role">Customer requests</span>
                  <h2>My jobs</h2>
                </div>
                <span className="account-count">{account.requests.length}</span>
              </div>
              {account.requests.length > 0 ? (
                <div className="account-request-list">
                  {account.requests.map((request) => (
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
                  <strong>No requests yet</strong>
                  <span>Your vehicle-service requests will appear here.</span>
                </div>
              )}
              <Link className="button primary account-button" href="/#request">
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
