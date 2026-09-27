"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { SiteLanguageButton, useSiteLanguage, type SiteLanguage } from "../components/site-language";
import { InterfaceCopy } from "../components/interface-copy";
import { BrandMark } from "../components/tuveloz-icons";

type AccountRole = "customer" | "provider";
type PrivacyRequestType =
  | "access"
  | "correction"
  | "account-closure"
  | "limit-processing"
  | "opt-out"
  | "appeal";

type PrivacyRequest = {
  id: string;
  requestType: PrivacyRequestType;
  relatedRequestId: string;
  details: string;
  status: "submitted" | "in-review" | "completed" | "denied" | "withdrawn";
  resolutionNote: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string;
};

type PrivacyCenterData = {
  role: AccountRole;
  email: string;
  availablePrivacyScopes: AccountRole[];
  preferences: {
    marketingEmail: boolean;
    productUpdateEmail: boolean;
    optionalReminderEmail: boolean;
    essentialTransactionalEmail: true;
    securityEmail: true;
    launchNotificationEmail: boolean;
    launchNotificationConsentAt: string;
    launchNotificationConsentVersion: string;
    launchNotificationConsentSource: string;
    updatedAt: string;
  };
  requests: PrivacyRequest[];
  immediateTools: {
    dataExport: string;
    profileCorrection: string;
  };
  notices: string[];
};

const REQUEST_LABELS: Record<PrivacyRequestType, string> = {
  access: "Ask a question about my data",
  correction: "Correct information",
  "account-closure": "Close my account and review data for deletion",
  "limit-processing": "Limit a use of my information",
  "opt-out": "Turn off optional marketing and product updates",
  appeal: "Appeal an earlier privacy decision",
};

const STATUS_LABELS: Record<PrivacyRequest["status"], string> = {
  submitted: "Submitted",
  "in-review": "In review",
  completed: "Completed",
  denied: "Denied",
  withdrawn: "Withdrawn",
};

function readableDate(value: string, language: SiteLanguage) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return language === "es" ? "Sin registrar" : "Not recorded";
  return date.toLocaleString(language === "es" ? "es-US" : "en-US");
}

async function privacyUpdate(send: (signal: AbortSignal) => Promise<Response>) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 15000);
  let message = "We couldn't confirm this update. Refresh your privacy center to check it before trying again.";
  try {
    const response = await send(controller.signal);
    const result = await response.json().catch(() => null) as (PrivacyCenterData & { error?: string }) | null;
    if (!response.ok) {
      if (typeof result?.error === "string") message = result.error;
      throw new Error(message);
    }
    if (!result?.preferences || !result.immediateTools || !Array.isArray(result.requests)
      || !Array.isArray(result.availablePrivacyScopes) || !Array.isArray(result.notices)
      || !["customer", "provider"].includes(result.role)) throw new Error(message);
    return result;
  } catch {
    throw new Error(message);
  } finally {
    window.clearTimeout(timeout);
  }
}

export default function PrivacyCenterPage() {
  const { language } = useSiteLanguage();
  const [data, setData] = useState<PrivacyCenterData | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");
  const [requestType, setRequestType] = useState<PrivacyRequestType>("access");
  const [marketingEmail, setMarketingEmail] = useState(false);
  const [productUpdateEmail, setProductUpdateEmail] = useState(false);
  const [optionalReminderEmail, setOptionalReminderEmail] = useState(true);
  const [launchNotificationEmail, setLaunchNotificationEmail] = useState(false);
  const [launchConsent, setLaunchConsent] = useState({ at: "", version: "", source: "" });
  const requestedScope = useRef<AccountRole | undefined>(undefined);

  async function load(scope?: AccountRole) {
    requestedScope.current = scope;
    const query = scope ? `?scope=${scope}` : "";
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(`/api/privacy-center${query}`, { cache: "no-store", signal: controller.signal });
      if (response.status === 401) {
        const languageHint = document.documentElement.lang === "es" ? "es" : "en";
        window.location.replace(`/account?role=customer&privacy=1&lang=${languageHint}`);
        return;
      }
      const result = await response.json().catch(() => null) as PrivacyCenterData | null;
      if (!response.ok || !result || !result.preferences || !result.immediateTools
        || !Array.isArray(result.requests) || !Array.isArray(result.availablePrivacyScopes)
        || !Array.isArray(result.notices) || !["customer", "provider"].includes(result.role)) {
        throw new Error("Invalid privacy response");
      }
      setData(result);
      setMarketingEmail(result.preferences.marketingEmail);
      setProductUpdateEmail(result.preferences.productUpdateEmail);
      setOptionalReminderEmail(result.preferences.optionalReminderEmail);
      setLaunchNotificationEmail(result.preferences.launchNotificationEmail);
      setLaunchConsent({
        at: result.preferences.launchNotificationConsentAt,
        version: result.preferences.launchNotificationConsentVersion,
        source: result.preferences.launchNotificationConsentSource,
      });
    } catch {
      throw new Error("We couldn't load your privacy center. Please try again.");
    } finally {
      window.clearTimeout(timeout);
    }
  }

  async function refreshPrivacyCenter() {
    setBusy("refresh");
    setError("");
    setNotice("");
    try {
      await load(requestedScope.current);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "We couldn't load your privacy center. Please try again.");
    } finally {
      setBusy("");
    }
  }

  async function selectPrivacyScope(scope: AccountRole) {
    if (scope === data?.role) return;
    setBusy("scope");
    setError("");
    setNotice("");
    setData(null);
    try {
      await load(scope);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to change privacy data views.");
    } finally {
      setBusy("");
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const scope = new URLSearchParams(window.location.search).get("scope");
      void load(scope === "customer" || scope === "provider" ? scope : undefined).catch((reason) => {
        setError(reason instanceof Error ? reason.message : "Unable to load the privacy center.");
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function savePreferences(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("preferences");
    setError("");
    setNotice("");
    try {
      const result = await privacyUpdate(signal => fetch(`/api/privacy-center?scope=${data?.role ?? "customer"}`, {
        method: "POST",
        signal,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "save-preferences",
          marketingEmail,
          productUpdateEmail,
          optionalReminderEmail,
          launchNotificationEmail,
        }),
      }));
      setData(result);
      setMarketingEmail(result.preferences.marketingEmail);
      setProductUpdateEmail(result.preferences.productUpdateEmail);
      setOptionalReminderEmail(result.preferences.optionalReminderEmail);
      setLaunchNotificationEmail(result.preferences.launchNotificationEmail);
      setLaunchConsent({
        at: result.preferences.launchNotificationConsentAt,
        version: result.preferences.launchNotificationConsentVersion,
        source: result.preferences.launchNotificationConsentSource,
      });
      setNotice("Communication choices saved.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to save communication choices.");
    } finally {
      setBusy("");
    }
  }

  async function submitRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form).entries());
    setBusy("request");
    setError("");
    setNotice("");
    try {
      const result = await privacyUpdate(signal => fetch(`/api/privacy-center?scope=${data?.role ?? "customer"}`, {
        method: "POST",
        signal,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "submit-request",
          requestType,
          relatedRequestId: values.relatedRequestId,
          details: values.details,
        }),
      }));
      setData(result);
      setMarketingEmail(result.preferences.marketingEmail);
      setProductUpdateEmail(result.preferences.productUpdateEmail);
      setOptionalReminderEmail(result.preferences.optionalReminderEmail);
      setLaunchNotificationEmail(result.preferences.launchNotificationEmail);
      setLaunchConsent({
        at: result.preferences.launchNotificationConsentAt,
        version: result.preferences.launchNotificationConsentVersion,
        source: result.preferences.launchNotificationConsentSource,
      });
      form.reset();
      setRequestType("access");
      setNotice(
        requestType === "opt-out"
          ? "Optional marketing and product-update emails are now off."
          : "Privacy request submitted from your verified account.",
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to submit the privacy request.");
    } finally {
      setBusy("");
    }
  }

  async function withdrawRequest(id: string) {
    setBusy(id);
    setError("");
    setNotice("");
    try {
      const result = await privacyUpdate(signal => fetch(`/api/privacy-center?scope=${data?.role ?? "customer"}`, {
        method: "POST",
        signal,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "withdraw-request", id }),
      }));
      setData(result);
      setNotice("Privacy request withdrawn.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to withdraw the request.");
    } finally {
      setBusy("");
    }
  }

  const appealOptions = data?.requests.filter(
    (item) => item.status === "completed" || item.status === "denied",
  ) ?? [];

  return (
    <InterfaceCopy>
    <main className="account-shell">
      <header className="account-header">
        <Link className="brand" href="/" aria-label="Tuveloz home">
          <BrandMark />
          <span>Tuveloz</span>
        </Link>
        <div className="account-header-actions">
          <SiteLanguageButton />
          <Link className="account-home-link" href={`/account?lang=${language}`}>
            Account
          </Link>
        </div>
      </header>

      <section className="account-main">
        <div className="account-welcome">
          <span className="account-kicker">Privacy and data</span>
          <h1>Your information. Your choices.</h1>
          <p>Download a privacy-safe account copy, manage optional communications, and submit verified privacy requests.</p>
          {data && <small>{data.role === "provider" ? "Provider account" : "Customer account"} · <span data-no-interface-translation>{data.email}</span></small>}
        </div>

        {error && <div className="account-login-message">
          <p className="form-error" role="alert">{error}</p>
          <button className="contact-cta ghost" type="button" disabled={Boolean(busy)} onClick={() => void refreshPrivacyCenter()}>
            Refresh privacy center
          </button>
        </div>}
        {notice && <p className="portal-success account-login-message" role="status">{notice}</p>}
        {!data && !error && <p className="admin-note account-loading">Loading privacy controls…</p>}

        {data && (
          <div className="account-grid account-customer-grid">
            {data.availablePrivacyScopes.length > 1 && (
              <div>
                <div className="account-role-tabs" aria-label="Choose privacy data">
                  {data.availablePrivacyScopes.map((scope) => (
                    <button
                      aria-pressed={data.role === scope}
                      className={data.role === scope ? "selected" : ""}
                      disabled={busy === "scope"}
                      key={scope}
                      onClick={() => void selectPrivacyScope(scope)}
                      type="button"
                    >
                      {scope === "provider" ? "Provider application data" : "Customer account data"}
                    </button>
                  ))}
                </div>
                <p className="admin-note">
                  Provider application data is a privacy-only view. It does not approve provider
                  work, unlock jobs, or change marketplace eligibility.
                </p>
              </div>
            )}
            <nav className="workspace-nav customer-workspace-nav" aria-label="Privacy center sections">
              <a className="workspace-nav-primary" href={data.immediateTools.dataExport}>
                Download my data
              </a>
              <Link href={data.immediateTools.profileCorrection}>Correct my profile</Link>
              <Link href="/privacy">Privacy policy</Link>
              <Link href="/service-standards">Marketplace standards</Link>
            </nav>

            <section className="account-card">
              <div className="account-card-heading">
                <div>
                  <span className="account-role">Private account export</span>
                  <h2>Get a copy of your Tuveloz data</h2>
                </div>
              </div>
              <p>
                The JSON export includes account and marketplace records connected to this signed-in role.
                It excludes passwords, login codes, tokens, complete payment credentials, internal security
                methods, and unrelated information belonging to another person.
              </p>
              <a className="button primary account-button" href={data.immediateTools.dataExport}>
                Download private data copy <span>↓</span>
              </a>
            </section>

            <section className="account-card">
              <div className="account-card-heading">
                <div>
                  <span className="account-role">Communication choices</span>
                  <h2>Optional email settings</h2>
                </div>
              </div>
              <form className="customer-profile-form privacy-preferences" onSubmit={savePreferences}>
                <label>
                  <input
                    checked={marketingEmail}
                    onChange={(event) => setMarketingEmail(event.target.checked)}
                    type="checkbox"
                  />
                  Occasional promotions and offers
                </label>
                <label>
                  <input
                    checked={productUpdateEmail}
                    onChange={(event) => setProductUpdateEmail(event.target.checked)}
                    type="checkbox"
                  />
                  Optional product and feature updates
                </label>
                <label>
                  <input
                    checked={optionalReminderEmail}
                    onChange={(event) => setOptionalReminderEmail(event.target.checked)}
                    type="checkbox"
                  />
                  Optional reminders that are not required to complete an active job
                </label>
                {/*
                  Customer scope only. Preferences are keyed (email, role), so
                  the provider scope is a separate row that was never offered
                  this consent — rendering the toggle there would not surface a
                  customer's consent, it would offer a way to create one the
                  account-create path deliberately refuses to grant. Someone
                  holding both roles manages this under their customer scope.

                  The provenance line is the point of the rest: seeing that you
                  consented is weaker than seeing when, to what, and from where.
                */}
                {data.role === "customer" && (
                <label>
                  <input
                    checked={launchNotificationEmail}
                    onChange={(event) => setLaunchNotificationEmail(event.target.checked)}
                    type="checkbox"
                  />
                  Email me when Tuveloz opens customer requests, plus essential launch updates
                </label>
                )}
                {data.role === "customer" && launchNotificationEmail && launchConsent.at && (
                  <p className="hint">
                    Agreed <span data-no-interface-translation>{readableDate(launchConsent.at, language)}</span>
                    {launchConsent.version ? ` · policy version ${launchConsent.version}` : ""}
                    {launchConsent.source === "account_create"
                      ? " · from account creation"
                      : launchConsent.source === "privacy_center"
                        ? " · from this page"
                        : ""}
                    . This does not include general marketing email, which is a
                    separate choice above.
                  </p>
                )}
                <div className="customer-security-note">
                  <strong>Essential messages stay on</strong>
                  <p>
                    Account security, payment, appointment, authorization, quote-selection, provider-arrival,
                    completion, refund, dispute, and other active-job messages remain enabled.
                  </p>
                </div>
                <button className="button primary" disabled={busy === "preferences"} type="submit">
                  {busy === "preferences" ? "Saving…" : "Save communication choices"}
                </button>
              </form>
            </section>

            <section className="account-card" id="privacy-request">
              <div className="account-card-heading">
                <div>
                  <span className="account-role">Verified request</span>
                  <h2>Submit a privacy request</h2>
                </div>
              </div>
              <form className="customer-profile-form privacy-request-form" onSubmit={submitRequest}>
                <label>
                  Request type
                  <select
                    name="requestType"
                    onChange={(event) => setRequestType(event.target.value as PrivacyRequestType)}
                    value={requestType}
                  >
                    {(Object.keys(REQUEST_LABELS) as PrivacyRequestType[]).map((type) => (
                      <option key={type} value={type}>{REQUEST_LABELS[type]}</option>
                    ))}
                  </select>
                </label>
                {requestType === "appeal" && (
                  <label>
                    Earlier request
                    <select name="relatedRequestId" required>
                      <option value="">Choose a completed or denied request</option>
                      {appealOptions.map((item) => (
                        <option key={item.id} value={item.id}>
                          {REQUEST_LABELS[item.requestType]} · {item.id.slice(0, 8)}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <label>
                  Details
                  <textarea
                    maxLength={2000}
                    name="details"
                    placeholder={
                      requestType === "account-closure"
                        ? "Optional context about the account you want closed."
                        : "Explain the information or processing you want Tuveloz to review."
                    }
                    required={requestType === "correction" || requestType === "appeal"}
                    rows={5}
                  />
                </label>
                {requestType === "account-closure" && (
                  <div className="customer-security-note">
                    <strong>Closure is reviewed before deletion</strong>
                    <p>
                      Tuveloz may retain records reasonably needed for open jobs, customer authorizations,
                      payments, refunds, chargebacks, disputes, safety, fraud prevention, tax, accounting,
                      insurance, or other legal duties. The account is not instantly erased when this form is sent.
                    </p>
                  </div>
                )}
                <button className="button primary" disabled={busy === "request"} type="submit">
                  {busy === "request" ? "Submitting…" : "Submit verified request"}
                </button>
              </form>
            </section>

            <section className="account-card">
              <div className="account-card-heading">
                <div>
                  <span className="account-role">Request history</span>
                  <h2>Privacy request status</h2>
                </div>
                <span className="account-count">{data.requests.length}</span>
              </div>
              {data.requests.length === 0 ? (
                <div className="account-empty">
                  <strong>No privacy requests yet</strong>
                  <span>Your signed-in requests and decisions will appear here.</span>
                </div>
              ) : (
                <div className="account-request-list">
                  {data.requests.map((item) => (
                    <article className="account-request" key={item.id}>
                      <span>
                        <strong>{REQUEST_LABELS[item.requestType]}</strong>
                        <small><span data-no-interface-translation>{item.id}</span> · submitted <span data-no-interface-translation>{readableDate(item.createdAt, language)}</span></small>
                        {item.details && <small data-no-interface-translation>{item.details}</small>}
                        {item.resolutionNote && <small>Decision: <span data-no-interface-translation>{item.resolutionNote}</span></small>}
                      </span>
                      <span>
                        <span className={`account-status ${item.status === "completed" ? "is-active" : ""}`}>
                          {STATUS_LABELS[item.status]}
                        </span>
                        {(item.status === "submitted" || item.status === "in-review") && (
                          <button
                            className="button secondary"
                            disabled={busy === item.id}
                            onClick={() => void withdrawRequest(item.id)}
                            type="button"
                          >
                            {busy === item.id ? "Updating…" : "Withdraw"}
                          </button>
                        )}
                      </span>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <details className="workspace-tools account-customer-guide">
              <summary>Important privacy notes</summary>
              <div className="workspace-tool-content">
                {data.notices.map((item) => <p key={item}>{item}</p>)}
              </div>
            </details>
          </div>
        )}
      </section>
    </main>
    </InterfaceCopy>
  );
}
