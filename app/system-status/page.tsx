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
  privacy: string;
};

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

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      fetch(`/api/health?check=${Date.now()}`, {
        cache: "no-store",
        headers: { "cache-control": "no-cache" },
        signal: controller.signal,
      }).then(async (response) => {
        const result = await response.json() as HealthResult & { error?: string };
        if (!response.ok && !result.status) {
          throw new Error(result.error || "Unable to read the Tuveloz system status.");
        }
        setHealth(result);
      }).catch((reason) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setError(reason instanceof Error ? reason.message : "Unable to read the Tuveloz system status.");
      });
    }, 0);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, []);

  const overallLabel = health?.status === "ok"
    ? "Operational"
    : health?.status === "degraded"
      ? "Attention required"
      : "Checking";

  return (
    <main className="account-shell">
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
            This page verifies the application release and the database tables required
            for accounts, marketplace records, job agreements, privacy requests, and
            private job evidence. It does not expose customer or provider information.
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
                {health?.status ?? "checking"}
              </span>
            </div>
            {!health && !error && <p className="admin-note">Checking the live application and database…</p>}
            {health && (
              <dl className="owner-settings-grid">
                <div><dt>Application</dt><dd>{statusLabel(health.checks.application)}</dd></div>
                <div><dt>Database</dt><dd>{statusLabel(health.checks.database)}</dd></div>
                <div><dt>Required schema</dt><dd>{statusLabel(health.checks.schema)}</dd></div>
                <div><dt>Checked</dt><dd>{readableDate(health.checkedAt)}</dd></div>
              </dl>
            )}
          </section>

          <section className="account-card">
            <div className="account-card-heading">
              <div>
                <span className="account-role">Release identity</span>
                <h2>Verified deployment</h2>
              </div>
            </div>
            {health ? (
              <dl className="owner-settings-grid">
                <div>
                  <dt>Release</dt>
                  <dd>{health.release.commit === "development" ? "Local development" : health.release.commit.slice(0, 12)}</dd>
                </div>
                <div><dt>Built</dt><dd>{readableDate(health.release.builtAt)}</dd></div>
              </dl>
            ) : (
              <p className="admin-note">Release information will appear after the status check.</p>
            )}
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
      </section>
    </main>
  );
}
