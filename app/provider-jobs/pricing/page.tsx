"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { SiteLanguageButton } from "../../components/site-language";
import { BrandMark } from "../../components/tuveloz-icons";
import { CUSTOMER_SERVICE_FEE_PERCENT } from "../../../lib/customer-fee";
import {
  computeLaborQuote,
  formatCentsAsDollars,
} from "../../../lib/provider-price-helper";

type AccountSummary = {
  role?: "customer" | "provider";
  email?: string;
};

function parseDollarsToCents(value: string): number {
  const cleaned = value.replace(/[$,\s]/g, "");
  if (!cleaned) return 0;
  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed) || parsed < 0) return Number.NaN;
  return Math.round(parsed * 100);
}

function parseHoursToMinutes(value: string): number {
  const cleaned = value.trim();
  if (!cleaned) return 0;
  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed) || parsed < 0) return Number.NaN;
  return Math.round(parsed * 60);
}

function parseMinutes(value: string): number {
  const cleaned = value.trim();
  if (!cleaned) return 0;
  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed) || parsed < 0) return Number.NaN;
  return Math.round(parsed);
}

export default function ProviderPriceHelperPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rate, setRate] = useState("");
  const [hours, setHours] = useState("");
  const [travel, setTravel] = useState("");
  const [minimum, setMinimum] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch("/api/account", { cache: "no-store" });
        const account = await response.json().catch(() => ({})) as AccountSummary & { error?: string };
        if (response.status === 401) {
          window.location.replace("/account?role=provider");
          return;
        }
        if (!response.ok) throw new Error(account.error || "Unable to verify your provider account.");
        if (account.role !== "provider") {
          window.location.replace("/customer");
          return;
        }
        setEmail(account.email ?? "");
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Unable to load the price helper.");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  const started = rate.trim() !== "" || hours.trim() !== "";
  const result = useMemo(() => computeLaborQuote({
    hourlyRateCents: parseDollarsToCents(rate) || 0,
    jobMinutes: parseHoursToMinutes(hours) || 0,
    travelMinutes: parseMinutes(travel) || 0,
    minimumPriceCents: parseDollarsToCents(minimum) || 0,
  }), [rate, hours, travel, minimum]);

  return (
    <main className="account-shell">
      <header className="account-header">
        <Link className="brand" href="/" aria-label="Tuveloz home">
          <BrandMark />
          <span>Tuveloz</span>
        </Link>
        <div className="account-header-actions">
          <SiteLanguageButton />
          <Link className="account-home-link" href="/provider-jobs">Provider workspace</Link>
        </div>
      </header>

      <section className="account-main">
        <div className="account-welcome">
          <span className="account-kicker">Provider-controlled business tools</span>
          <h1>Your price, your math.</h1>
          <p>
            Tuveloz never sets, suggests, or recommends your rate. This calculator
            only does the arithmetic on numbers you type in — your hourly rate, your
            time estimate, your minimum — and shows exactly what the customer would
            see next to your labor-only price.
          </p>
          <p className="admin-note">
            Tuveloz is currently open for provider onboarding only. This private helper is a
            preparation tool; it does not create a quote, activate a service, or apply to a
            real job.
          </p>
          {email && <small>Signed in as {email}</small>}
        </div>

        {error && <p className="form-error account-login-message" role="alert">{error}</p>}
        {loading ? (
          <p className="admin-note account-loading">Loading the price helper…</p>
        ) : (
          <div className="account-grid">
            <section className="account-card">
              <div className="account-card-heading">
                <div>
                  <span className="account-role">How this works</span>
                  <h2>Labor only, disclosed fully.</h2>
                </div>
              </div>
              <p>
                Tuveloz quotes are labor-only: never include provider-supplied parts,
                parts reimbursement, or parts tax — the customer purchases any part
                separately. You receive your full quoted price; the proposed{" "}
                {CUSTOMER_SERVICE_FEE_PERCENT}% customer service fee is added on top and
                charged to the customer, shown separately before checkout.
              </p>
              <p className="admin-note">
                Once real jobs complete, Tuveloz publishes only real completed-price
                ranges from a minimum of three non-test jobs — the same numbers customers
                see. Tuveloz never invents a market price and never tells you what to
                charge.
              </p>
            </section>

            <section className="account-card">
              <div className="account-card-heading">
                <div>
                  <span className="account-role">Price helper</span>
                  <h2>Work out a labor price from your numbers.</h2>
                </div>
              </div>
              <label>
                Your hourly labor rate (dollars)
                <input
                  inputMode="decimal"
                  onChange={(event) => setRate(event.target.value)}
                  placeholder="Your own rate — Tuveloz does not suggest one"
                  value={rate}
                />
              </label>
              <label>
                Estimated time on the job (hours)
                <input
                  inputMode="decimal"
                  onChange={(event) => setHours(event.target.value)}
                  placeholder="For example 1.5"
                  value={hours}
                />
              </label>
              <label>
                Travel time you choose to bill (minutes, optional)
                <input
                  inputMode="numeric"
                  onChange={(event) => setTravel(event.target.value)}
                  placeholder="0"
                  value={travel}
                />
              </label>
              <label>
                Your minimum job price (dollars, optional)
                <input
                  inputMode="decimal"
                  onChange={(event) => setMinimum(event.target.value)}
                  placeholder="A floor you set for any visit"
                  value={minimum}
                />
              </label>
              {started && (result.ok ? (
                <div className="admin-note" role="status">
                  <p>
                    Billable time: {Math.floor(result.breakdown.billableMinutes / 60)}h{" "}
                    {result.breakdown.billableMinutes % 60}m
                    {result.breakdown.minimumApplied
                      ? ` — your ${formatCentsAsDollars(parseDollarsToCents(minimum) || 0)} minimum applies instead of the time-based ${formatCentsAsDollars(result.breakdown.timeBasedPriceCents)}.`
                      : "."}
                  </p>
                  <p>
                    <strong>Your labor price: {formatCentsAsDollars(result.breakdown.laborPriceCents)}</strong>{" "}
                    — you receive this full amount.
                  </p>
                  <p>
                    The customer would see: labor {formatCentsAsDollars(result.breakdown.laborPriceCents)}{" "}
                    + {CUSTOMER_SERVICE_FEE_PERCENT}% service fee{" "}
                    {formatCentsAsDollars(result.breakdown.customerFeeCents)} ={" "}
                    {formatCentsAsDollars(result.breakdown.customerTotalCents)} total, before any
                    part they buy separately.
                  </p>
                  <p>
                    Quote whatever price you decide — this arithmetic is not a
                    recommendation.
                  </p>
                </div>
              ) : (
                <p className="form-error" role="alert">{result.error}</p>
              ))}
            </section>

            <section className="account-card">
              <div className="account-card-heading">
                <div>
                  <span className="account-role">Connected provider tools</span>
                  <h2>Put it on a clear written quote.</h2>
                </div>
              </div>
              <p>
                A customer accepts only the written scope and price submitted for that
                job. Pair your price with plain quote wording and your warranty choice.
              </p>
              <div className="hero-actions">
                <Link className="button primary" href="/provider-jobs/toolkit">Quote templates</Link>
                <Link className="button secondary" href="/provider-jobs/warranty">Warranty helper</Link>
                <Link className="button secondary" href="/provider-jobs">Provider workspace</Link>
                <Link className="button secondary" href="/job-authorizations">Job agreements</Link>
              </div>
            </section>
          </div>
        )}
      </section>
    </main>
  );
}
