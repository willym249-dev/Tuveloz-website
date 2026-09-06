"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BrandMark } from "../components/tuveloz-icons";

type HealthResult = {
  status: "ok" | "degraded";
  checkedAt: string;
  release: {
    commit: string;
    builtAt: string;
  };
  checks: {
    application: "ready";
    database: "ready" | "unavailable";
    schema: "ready" | "migration-required";
  };
  missingTables: string[];
  launch?: {
    customerAccounts?: "open" | "closed";
    providerApplications?: "open" | "closed";
    customerJobRequests?: "open" | "closed";
    customerPayments?: "open" | "closed";
  };
};

function isHealthResult(value: unknown): value is HealthResult {
  if (typeof value !== "object" || value === null) return false;
  const result = value as Partial<HealthResult>;
  return (result.status === "ok" || result.status === "degraded")
    && typeof result.checkedAt === "string"
    && typeof result.release?.commit === "string"
    && typeof result.release?.builtAt === "string"
    && result.checks?.application === "ready"
    && ["ready", "unavailable"].includes(result.checks?.database ?? "")
    && ["ready", "migration-required"].includes(result.checks?.schema ?? "")
    && Array.isArray(result.missingTables)
    && result.missingTables.every((table) => typeof table === "string")
    && (result.status !== "ok"
      || (result.checks.database === "ready" && result.checks.schema === "ready"));
}

function availabilityLabel(value: unknown) {
  return value === "open" ? "Open" : value === "closed" ? "Closed" : "Not reported";
}

function readableDate(value: string) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function statusLabel(value: string) {
  return value.replaceAll("-", " ");
}

export default function SystemStatusPage() {
  const [health, setHealth] = useState<HealthResult | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      fetch(`/api/health?check=${Date.now()}`, {
        cache: "no-store",
        headers: { "cache-control": "no-cache" },
        signal: controller.signal,
      }).then(async (response) => {
        const result: unknown = await response.json();
        if (controller.signal.aborted) return;
        if (!isHealthResult(result)
          || (!response.ok && !(response.status === 503 && result.status === "degraded"))) {
          throw new Error("Status unavailable");
        }
        setHealth(result);
      }).catch(() => {
        if (controller.signal.aborted) return;
        setHealth(null);
        setError("We couldn't check Tuveloz's status. Please try again.");
      });
    }, 0);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [attempt]);

  function retry() {
    setHealth(null);
    setError("");
    setAttempt((value) => value + 1);
  }

  const overallLabel = error
    ? "Status unavailable"
    : health?.status === "ok"
      ? "Operational"
      : health?.status === "degraded"
        ? "Attention required"
        : "Checking";

  return (
    <main className="account-shell system-status-page">
      <header className="account-header">
        <Link className="brand" href="/" aria-label="Tuveloz home">
          <BrandMark />
          <span>Tuveloz</span>
        </Link>
        <div className="account-header-actions">
          <Link className="account-home-link" href="/privacy">Privacy</Link>
          <Link className="account-home-link" href="/">Home</Link>
        </div>
      </header>

      <section className="account-main">
        <div className="account-welcome">
          <span className="account-kicker">Public operational check</span>
          <h1>Tuveloz system status.</h1>
          <p>
            Check whether the website is working and which parts of Tuveloz are open.
            This page does not show private customer or provider information.
          </p>
        </div>

        {error && <p className="form-error account-login-message" role="alert">{error}</p>}

        <div className="account-grid">
          <section className="account-card">
            <div className="account-card-heading">
              <div>
                <span className="account-role">Current condition</span>
                <h2>{overallLabel}</h2>
              </div>
              <span className={`account-status ${health?.status === "ok" ? "is-active" : ""}`}>
                {health?.status ?? (error ? "unavailable" : "checking")}
              </span>
            </div>
            {!health && !error && <p className="admin-note">Checking the live application and database…</p>}
            {health && (
              <>
                <p>Last checked: {readableDate(health.checkedAt)}</p>
                {health.status === "degraded" && (
                  <p>Some features may be unavailable while this issue is being resolved.</p>
                )}
              </>
            )}
            <div className="hero-actions">
              <button className="button secondary" type="button" onClick={retry} disabled={!health && !error}>
                {error ? "Try again" : health ? "Check again" : "Checking…"}
              </button>
            </div>
          </section>

          <section className="account-card">
            <div className="account-card-heading"><h2>Launch availability</h2></div>
            {health ? (
              <dl className="system-status-availability">
                <div><dt>Customer accounts</dt><dd>{availabilityLabel(health.launch?.customerAccounts)}</dd></div>
                <div><dt>Provider applications</dt><dd>{availabilityLabel(health.launch?.providerApplications)}</dd></div>
                <div><dt>Customer requests</dt><dd>{availabilityLabel(health.launch?.customerJobRequests)}</dd></div>
                <div><dt>Customer payments</dt><dd>{availabilityLabel(health.launch?.customerPayments)}</dd></div>
              </dl>
            ) : (
              <p>{error ? "Availability could not be checked. Please try again." : "Checking what is open…"}</p>
            )}
          </section>

          {health && (
            <details className="system-status-details">
              <summary>Technical details</summary>
              <div className="account-grid">
                <section className="account-card">
                  <h2>Website checks</h2>
                  <dl className="owner-settings-grid">
                    <div><dt>Application</dt><dd>{statusLabel(health.checks.application)}</dd></div>
                    <div><dt>Database</dt><dd>{statusLabel(health.checks.database)}</dd></div>
                    <div><dt>Required schema</dt><dd>{statusLabel(health.checks.schema)}</dd></div>
                    <div><dt>Checked</dt><dd>{readableDate(health.checkedAt)}</dd></div>
                  </dl>
                </section>
                <section className="account-card">
                  <div className="account-card-heading">
                    <div>
                      <span className="account-role">Release identity</span>
                      <h2>{health.status === "ok" ? "Verified deployment" : "Release information"}</h2>
                    </div>
                  </div>
                  <dl className="owner-settings-grid">
                    <div>
                      <dt>Release</dt>
                      <dd>{health.release.commit === "development" ? "Local development" : health.release.commit.slice(0, 12)}</dd>
                    </div>
                    <div><dt>Built</dt><dd>{readableDate(health.release.builtAt)}</dd></div>
                  </dl>
                  <p className="admin-section-copy">
                    GitHub deployment automation compares this release identity with the exact
                    commit being deployed. A stale release or missing migration causes the
                    production workflow to fail instead of reporting a false success.
                  </p>
                </section>

                {health?.missingTables.length ? (
                  <section className="account-card">
                    <div className="account-card-heading">
                      <div>
                        <span className="account-role">Migration check</span>
                        <h2>Database update required</h2>
                      </div>
                    </div>
                    <p>
                      One or more required application tables are not ready. Customer requests,
                      regulated services, and live payments should remain paused until the
                      production migration succeeds.
                    </p>
                    <p className="admin-note">Missing operational tables: {health.missingTables.join(", ")}</p>
                  </section>
                ) : null}

                <section className="account-card">
                  <div className="account-card-heading">
                    <div>
                      <span className="account-role">Privacy boundary</span>
                      <h2>What this page never shows</h2>
                    </div>
                  </div>
                  <p>
                    No passwords, verification codes, authentication tokens, names, emails,
                    addresses, job details, uploaded images, payment information, user counts,
                    secret configuration, or internal fraud controls are returned here.
                  </p>
                  <div className="hero-actions">
                    <Link className="button primary" href="/service-standards">Service standards</Link>
                    <Link className="button secondary" href="/privacy">Privacy policy</Link>
                  </div>
                </section>
              </div>
            </details>
          )}
        </div>
      </section>
    </main>
  );
}
