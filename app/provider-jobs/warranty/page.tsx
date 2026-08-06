"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { SiteLanguageButton } from "../../components/site-language";
import { BrandMark } from "../../components/tuveloz-icons";
import {
  MAX_CUSTOM_WARRANTY_LENGTH,
  STANDARD_WARRANTY_TIERS,
  standardWarrantyTier,
  warrantyDisclosure,
  type WarrantyChoice,
  type WarrantyWorkType,
} from "../../../lib/provider-warranty";

type AccountSummary = {
  role?: "customer" | "provider";
  email?: string;
};

async function copyText(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const field = document.createElement("textarea");
  field.value = value;
  field.setAttribute("readonly", "true");
  field.style.position = "fixed";
  field.style.opacity = "0";
  document.body.appendChild(field);
  field.select();
  const copied = document.execCommand("copy");
  field.remove();
  if (!copied) throw new Error("Copy was blocked by this browser.");
}

export default function ProviderWarrantyHelperPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [workType, setWorkType] = useState<WarrantyWorkType>("repair");
  const [choice, setChoice] = useState<WarrantyChoice>("standard");
  const [customTerms, setCustomTerms] = useState("");

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
        setError(reason instanceof Error ? reason.message : "Unable to load the warranty helper.");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  const tier = standardWarrantyTier(workType);
  const result = useMemo(
    () => warrantyDisclosure({ workType, choice, customTerms }),
    [workType, choice, customTerms],
  );

  async function copyDisclosure() {
    if (!result.ok) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await copyText(`Warranty: ${result.disclosure}`);
      setNotice("Warranty disclosure copied. Paste it into the quote before the customer accepts, and state it again on the final invoice.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to copy the disclosure.");
    } finally {
      setBusy(false);
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
          <Link className="account-home-link" href="/provider-jobs">Provider workspace</Link>
        </div>
      </header>

      <section className="account-main">
        <div className="account-welcome">
          <span className="account-kicker">Provider-controlled business tools</span>
          <h1>Your warranty, your choice.</h1>
          <p>
            Offering a warranty is optional. Pick the type of work and your choice —
            the standard labor warranty, your own written warranty, or none — and
            copy clear disclosure wording for the quote and final invoice. Tuveloz
            never sets your warranty and does not provide, back, administer, or
            insure any provider warranty.
          </p>
          <p className="admin-note">
            Tuveloz is currently open for provider onboarding only. This private helper is a
            preparation tool; it does not activate a service, record a warranty, or apply to
            a real job.
          </p>
          {email && <small>Signed in as {email}</small>}
        </div>

        {error && <p className="form-error account-login-message" role="alert">{error}</p>}
        {notice && <p className="portal-success account-login-message" role="status">{notice}</p>}
        {loading ? (
          <p className="admin-note account-loading">Loading the warranty helper…</p>
        ) : (
          <div className="account-grid">
            <section className="account-card">
              <div className="account-card-heading">
                <div>
                  <span className="account-role">How this works</span>
                  <h2>Choose it, disclose it, honor it.</h2>
                </div>
              </div>
              <p>
                Whatever you choose must be disclosed to the customer before they accept
                your quote and stated again on the final invoice, including a clear
                statement when no written warranty is offered.
              </p>
              <p className="admin-note">
                A warranty you state is your business&apos;s commitment. A disputed claim is
                reviewed on the job records; refusing to honor a claim those records
                confirm is covered results in immediate termination of platform access.
                See the <a href="/provider-agreement">Provider Agreement</a> and{" "}
                <a href="/marketplace-conduct">Marketplace Conduct Policy</a>.
              </p>
            </section>

            <section className="account-card">
              <div className="account-card-heading">
                <div>
                  <span className="account-role">Warranty helper</span>
                  <h2>Build the disclosure for this job.</h2>
                </div>
              </div>
              <label>
                Type of work
                <select
                  onChange={(event) => setWorkType(event.target.value as WarrantyWorkType)}
                  value={workType}
                >
                  {STANDARD_WARRANTY_TIERS.map((entry) => (
                    <option key={entry.workType} value={entry.workType}>{entry.label}</option>
                  ))}
                </select>
              </label>
              <p className="admin-note">
                {tier.examples}.{" "}
                {tier.periodStatement
                  ? `Standard labor warranty period for this work: ${tier.periodStatement}.`
                  : "No workmanship warranty applies to this work — there is no labor to re-perform."}
              </p>
              <label>
                Your warranty choice
                <select
                  onChange={(event) => setChoice(event.target.value as WarrantyChoice)}
                  value={choice}
                >
                  <option value="standard">Offer the Tuveloz standard labor warranty</option>
                  <option value="custom">Offer my business&apos;s own written warranty</option>
                  <option value="none">Offer no written warranty</option>
                </select>
              </label>
              {choice === "custom" && (
                <label>
                  Your own warranty terms
                  <textarea
                    maxLength={MAX_CUSTOM_WARRANTY_LENGTH}
                    onChange={(event) => setCustomTerms(event.target.value)}
                    placeholder="State what is covered, what is excluded, the period or mileage, and how you honor it."
                    rows={5}
                    value={customTerms}
                  />
                </label>
              )}
              {result.ok ? (
                <>
                  <label>
                    Disclosure preview
                    <textarea readOnly rows={7} value={result.disclosure} />
                  </label>
                  <button
                    className="button primary account-button"
                    disabled={busy}
                    onClick={() => void copyDisclosure()}
                    type="button"
                  >
                    {busy ? "Copying…" : "Copy warranty disclosure"}
                  </button>
                </>
              ) : (
                <p className="form-error" role="alert">{result.error}</p>
              )}
            </section>

            <section className="account-card">
              <div className="account-card-heading">
                <div>
                  <span className="account-role">Connected provider tools</span>
                  <h2>Put it on the quote and the invoice.</h2>
                </div>
              </div>
              <p>
                The disclosure belongs in the written quote the customer accepts and on
                the final invoice, next to your labor scope and price. Review the actual
                job before reusing wording.
              </p>
              <div className="hero-actions">
                <Link className="button primary" href="/provider-jobs/toolkit">Quote templates</Link>
                <Link className="button secondary" href="/provider-jobs">Provider workspace</Link>
                <Link className="button secondary" href="/job-authorizations">Job agreements</Link>
                <Link className="button secondary" href="/job-authorizations/documents">Invoices and receipts</Link>
              </div>
            </section>
          </div>
        )}
      </section>
    </main>
  );
}
