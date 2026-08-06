"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SiteLanguageButton } from "../../components/site-language";
import { BrandMark } from "../../components/tuveloz-icons";

type QuoteTemplate = {
  id: string;
  name: string;
  availability: string;
  message: string;
};

type AccountSummary = {
  role?: "customer" | "provider";
  email?: string;
};

const STORAGE_KEY = "tuveloz-provider-quote-templates-v1";

const DEFAULT_TEMPLATES: QuoteTemplate[] = [
  {
    id: "routine-maintenance",
    name: "Routine maintenance",
    availability: "Available by appointment — confirm the exact date and time",
    message:
      "Includes only the labor and parts listed in this quote. I will confirm the exact vehicle and scope before starting. Any added work or price change requires a separate written customer authorization.",
  },
  {
    id: "diagnostic-only",
    name: "Diagnostic-only visit",
    availability: "Diagnostic appointment — confirm the exact date and time",
    message:
      "This quote covers diagnosis of the stated concern only. It does not authorize repairs or promise a specific result. I will send a separate written authorization before any repair or added charge.",
  },
  {
    id: "customer-supplied-parts",
    name: "Customer-supplied parts",
    availability: "Available after the agreed parts and appointment are confirmed",
    message:
      "This quote covers labor using the customer-supplied part or parts identified before the appointment. I will check basic fitment and condition before work. A different part, added work, or price change requires customer approval.",
  },
  {
    id: "mobile-roadside",
    name: "Mobile or roadside visit",
    availability: "Estimated arrival window — confirm a safe meeting location first",
    message:
      "This quote covers the listed mobile or roadside service at the confirmed safe meeting location. Timing is an estimate, not a guaranteed arrival time. Work outside the accepted scope requires customer approval.",
  },
];

function parseStoredTemplates(value: string | null): QuoteTemplate[] | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0 || parsed.length > 12) return null;
    const templates = parsed.map((item) => {
      if (!item || typeof item !== "object") return null;
      const candidate = item as Partial<QuoteTemplate>;
      if (
        typeof candidate.id !== "string"
        || typeof candidate.name !== "string"
        || typeof candidate.availability !== "string"
        || typeof candidate.message !== "string"
      ) {
        return null;
      }
      return {
        id: candidate.id.slice(0, 80),
        name: candidate.name.slice(0, 80),
        availability: candidate.availability.slice(0, 180),
        message: candidate.message.slice(0, 900),
      };
    });
    return templates.every(Boolean) ? templates as QuoteTemplate[] : null;
  } catch {
    return null;
  }
}

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

export default function ProviderQuoteToolkitPage() {
  const [templates, setTemplates] = useState<QuoteTemplate[]>(DEFAULT_TEMPLATES);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");

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
        const stored = parseStoredTemplates(window.localStorage.getItem(STORAGE_KEY));
        if (stored) setTemplates(stored);
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Unable to load quote templates.");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  function updateTemplate(id: string, field: keyof Omit<QuoteTemplate, "id">, value: string) {
    setNotice("");
    setTemplates((current) => current.map((template) => (
      template.id === id ? { ...template, [field]: value } : template
    )));
  }

  function saveTemplates() {
    setError("");
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
      setNotice("Templates saved on this browser and device.");
    } catch {
      setError("This browser could not save the templates. You can still copy and use them during this visit.");
    }
  }

  function resetTemplates() {
    setTemplates(DEFAULT_TEMPLATES.map((template) => ({ ...template })));
    setNotice("Default templates restored. Select “Save on this device” to keep them.");
  }

  async function copyTemplate(template: QuoteTemplate) {
    setBusyId(template.id);
    setError("");
    setNotice("");
    try {
      await copyText(`Availability: ${template.availability}\n\nQuote note: ${template.message}`);
      setNotice(`${template.name} copied. Paste the two lines into the matching quote fields.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to copy this template.");
    } finally {
      setBusyId("");
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
          <h1>Simple quote templates.</h1>
          <p>
            Keep clear wording ready without letting Tuveloz set your prices, schedule,
            services, warranty, or business decisions.
          </p>
          <p className="admin-note">
            Tuveloz is currently open for provider onboarding only. These private templates are
            preparation tools; they do not activate a service or let anyone view, quote, accept,
            start, complete, or receive payment for a real job.
          </p>
          {email && <small>Signed in as {email}</small>}
        </div>

        {error && <p className="form-error account-login-message" role="alert">{error}</p>}
        {notice && <p className="portal-success account-login-message" role="status">{notice}</p>}
        {loading ? (
          <p className="admin-note account-loading">Loading your provider tools…</p>
        ) : (
          <div className="account-grid">
            <section className="account-card">
              <div className="account-card-heading">
                <div>
                  <span className="account-role">How these work</span>
                  <h2>Copy, review, and adjust every time.</h2>
                </div>
              </div>
              <p>
                Templates fill only suggested availability and quote-note wording. Prices are
                never saved in these templates. Set labor, parts, timing, and any provider
                warranty separately for each job.
              </p>
              <p className="admin-note">
                Saved templates stay only in this browser on this device. Do not place customer
                names, addresses, payment information, or other private details in a reusable template.
              </p>
              <div className="hero-actions">
                <button className="button primary" onClick={saveTemplates} type="button">
                  Save on this device
                </button>
                <button className="button secondary" onClick={resetTemplates} type="button">
                  Restore defaults
                </button>
              </div>
            </section>

            {templates.map((template) => (
              <section className="account-card" key={template.id}>
                <div className="account-card-heading">
                  <div>
                    <span className="account-role">Reusable template</span>
                    <h2>{template.name}</h2>
                  </div>
                </div>
                <label>
                  Template name
                  <input
                    maxLength={80}
                    onChange={(event) => updateTemplate(template.id, "name", event.target.value)}
                    value={template.name}
                  />
                </label>
                <label>
                  Availability wording
                  <input
                    maxLength={180}
                    onChange={(event) => updateTemplate(template.id, "availability", event.target.value)}
                    value={template.availability}
                  />
                </label>
                <label>
                  Quote note
                  <textarea
                    maxLength={900}
                    onChange={(event) => updateTemplate(template.id, "message", event.target.value)}
                    rows={5}
                    value={template.message}
                  />
                </label>
                <button
                  className="button primary account-button"
                  disabled={busyId === template.id}
                  onClick={() => void copyTemplate(template)}
                  type="button"
                >
                  {busyId === template.id ? "Copying…" : "Copy availability and quote note"}
                </button>
              </section>
            ))}

            <section className="account-card">
              <div className="account-card-heading">
                <div>
                  <span className="account-role">Connected provider tools</span>
                  <h2>Finish the quote and document the job.</h2>
                </div>
              </div>
              <p>
                Review the actual job before using any template. A customer accepts only the
                written scope and price submitted for that job. Additional work or charges require
                a separate accepted authorization.
              </p>
              <div className="hero-actions">
                <Link className="button primary" href="/provider-jobs">Return to provider workspace</Link>
                <Link className="button secondary" href="/provider-jobs/parts">Parts checklist</Link>
                <Link className="button secondary" href="/provider-jobs/warranty">Warranty helper</Link>
                <Link className="button secondary" href="/provider-jobs/pricing">Price helper</Link>
                <Link className="button secondary" href="/job-authorizations">Job agreements</Link>
                <Link className="button secondary" href="/job-authorizations/documents">Invoices and receipts</Link>
                <Link className="button secondary" href="/appointments">Appointments</Link>
              </div>
            </section>
          </div>
        )}
      </section>
    </main>
  );
}
