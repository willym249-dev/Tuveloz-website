"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { SiteLanguageButton } from "../components/site-language";
import { BrandMark } from "../components/tuveloz-icons";
import { parseJobServices } from "../../lib/service-matching";

type Role = "customer" | "provider";
type AuthorizationStatus = "pending" | "accepted" | "declined" | "withdrawn" | "superseded";
type AuthorizationType = "accepted-quote" | "work-order" | "change-order" | "diagnostic-follow-up" | "scope-update";

type JobAuthorization = {
  id: string;
  requestId: string;
  sourceQuoteId: string;
  providerEmail: string;
  providerName: string;
  customerEmail: string;
  authorizationType: AuthorizationType;
  title: string;
  description: string;
  laborCents: number;
  partsCents: number;
  otherFeesCents: number;
  totalCents: number;
  estimatedCompletionAt: string;
  diagnosticOnly: boolean;
  workmanshipWarranty: string;
  partsWarranty: string;
  replacedPartsReturn: string;
  status: AuthorizationStatus;
  supersedesAuthorizationId: string;
  responseNote: string;
  createdAt: string;
  respondedAt: string;
  withdrawnAt: string;
};

type AcceptedJob = {
  requestId: string;
  vehicle: string;
  service: string;
  requestStatus: string;
  customerName: string;
  customerEmail: string;
  providerName: string;
  providerEmail: string;
  quoteId: string;
  priceCents: string;
  laborPriceCents: string;
  partsPriceCents: string;
  availability: string;
  quoteMessage: string;
  disclosures: string[];
  authorizations: JobAuthorization[];
};

type AuthorizationData = {
  role: Role;
  email: string;
  providerFreedomPrinciples: string[];
  customerAuthorizationPrinciples: string[];
  jobs: AcceptedJob[];
};

type ResponseDraft = {
  note: string;
  replacedPartsReturn: "requested" | "not-requested" | "not-applicable";
  consentAccepted: boolean;
};

const EMPTY_RESPONSE: ResponseDraft = {
  note: "",
  replacedPartsReturn: "not-requested",
  consentAccepted: false,
};

function money(cents: number | string) {
  const value = typeof cents === "number" ? cents : Number(cents);
  return Number.isFinite(value) ? `$${(value / 100).toFixed(2)}` : "$0.00";
}

function readableDate(value: string) {
  if (!value) return "Not stated";
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)
    ? `${value.replace(" ", "T")}Z`
    : value;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function authorizationLabel(type: AuthorizationType) {
  const labels: Record<AuthorizationType, string> = {
    "accepted-quote": "Accepted quote",
    "work-order": "Detailed work order",
    "change-order": "Change order",
    "diagnostic-follow-up": "Diagnostic follow-up",
    "scope-update": "Scope update",
  };
  return labels[type];
}

function statusClass(status: AuthorizationStatus) {
  return status === "accepted"
    ? "is-active"
    : status === "pending"
      ? ""
      : "is-warning";
}

export default function JobAuthorizationsPage() {
  const [data, setData] = useState<AuthorizationData | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState("");
  const [responseDrafts, setResponseDrafts] = useState<Record<string, ResponseDraft>>({});

  async function load() {
    try {
      const response = await fetch("/api/job-authorizations", { cache: "no-store" });
      const result = await response.json() as AuthorizationData & { error?: string };
      if (response.status === 401) {
        window.location.replace("/account");
        return;
      }
      if (!response.ok) throw new Error(result.error || "Unable to load Job agreements.");
      setData(result);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load Job agreements.");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function createAuthorization(event: FormEvent<HTMLFormElement>, requestId: string) {
    event.preventDefault();
    setError("");
    setNotice("");
    setBusyId(`create:${requestId}`);
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form).entries());
    try {
      const response = await fetch("/api/job-authorizations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "create",
          requestId,
          authorizationType: values.authorizationType,
          title: values.title,
          description: values.description,
          laborAmount: values.laborAmount,
          partsAmount: values.partsAmount,
          otherFeesAmount: values.otherFeesAmount,
          estimatedCompletionAt: values.estimatedCompletionAt,
          diagnosticOnly: values.diagnosticOnly === "yes",
          workmanshipWarranty: values.workmanshipWarranty,
          partsWarranty: values.partsWarranty,
          supersedesAuthorizationId: values.supersedesAuthorizationId,
        }),
      });
      const result = await response.json() as AuthorizationData & { error?: string };
      if (!response.ok) throw new Error(result.error || "Unable to create this authorization.");
      setData(result);
      form.reset();
      setNotice("The authorization was sent. No added work or charge is approved until the customer accepts it.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to create this authorization.");
    } finally {
      setBusyId("");
    }
  }

  async function respond(id: string, decision: "accepted" | "declined") {
    const draft = responseDrafts[id] ?? EMPTY_RESPONSE;
    setError("");
    setNotice("");
    setBusyId(`respond:${id}`);
    try {
      const response = await fetch("/api/job-authorizations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "respond",
          id,
          decision,
          responseNote: draft.note,
          replacedPartsReturn: draft.replacedPartsReturn,
          consentAccepted: draft.consentAccepted,
        }),
      });
      const result = await response.json() as AuthorizationData & { error?: string };
      if (!response.ok) throw new Error(result.error || "Unable to save your decision.");
      setData(result);
      setResponseDrafts((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
      setNotice(
        decision === "accepted"
          ? "Your authorization was recorded. Only the written scope and amount were approved."
          : "Your decline was recorded. The proposed work or charge is not authorized.",
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to save your decision.");
    } finally {
      setBusyId("");
    }
  }

  async function withdraw(id: string) {
    setError("");
    setNotice("");
    setBusyId(`withdraw:${id}`);
    try {
      const response = await fetch("/api/job-authorizations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "withdraw", id }),
      });
      const result = await response.json() as AuthorizationData & { error?: string };
      if (!response.ok) throw new Error(result.error || "Unable to withdraw this authorization.");
      setData(result);
      setNotice("The pending authorization was withdrawn and is not approved.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to withdraw this authorization.");
    } finally {
      setBusyId("");
    }
  }

  function updateResponseDraft(id: string, update: Partial<ResponseDraft>) {
    setResponseDrafts((current) => ({
      ...current,
      [id]: { ...(current[id] ?? EMPTY_RESPONSE), ...update },
    }));
  }

  const workspaceHref = data?.role === "provider" ? "/provider-jobs" : "/customer";
  const workspaceLabel = data?.role === "provider" ? "Provider workspace" : "Customer workspace";

  return (
    <main className="account-shell">
      <header className="account-header">
        <Link className="brand" href="/" aria-label="Tuveloz home">
          <BrandMark />
          <span>Tuveloz</span>
        </Link>
        <div className="account-header-actions">
          <SiteLanguageButton />
          <Link className="account-home-link" href={workspaceHref}>{workspaceLabel}</Link>
        </div>
      </header>

      <section className="account-main">
        <div className="account-welcome">
          <span className="account-kicker">Written scope and customer choice</span>
          <h1>Job agreements.</h1>
          <p>
            Preserve the accepted quote, record provider-created work orders, and require
            customer approval before additional work or charges.
          </p>
          {data && <small>Signed in as {data.email}</small>}
        </div>

        {error && <p className="form-error account-login-message" role="alert">{error}</p>}
        {notice && <p className="portal-success account-login-message" role="status">{notice}</p>}
        {!data && !error && <p className="admin-note account-loading">Loading Job agreements…</p>}

        {data && (
          <div className="account-grid">
            <section className="account-card">
              <div className="account-card-heading">
                <div>
                  <span className="account-role">
                    {data.role === "provider" ? "Independent-provider freedom" : "Customer authorization"}
                  </span>
                  <h2>
                    {data.role === "provider"
                      ? "You control your business decisions."
                      : "You control what additional work is approved."}
                  </h2>
                </div>
              </div>
              <ul>
                {(data.role === "provider"
                  ? data.providerFreedomPrinciples
                  : data.customerAuthorizationPrinciples
                ).map((principle) => <li key={principle}>{principle}</li>)}
              </ul>
              <p className="admin-note">
                Tuveloz supplies marketplace records and communication tools. The independent
                provider performs the vehicle service and is responsible for the stated scope,
                lawful work, invoice, and provider warranty.
              </p>
              <Link className="button secondary account-button" href="/service-standards">
                View service standards <span>→</span>
              </Link>
            </section>

            {data.jobs.length === 0 ? (
              <section className="account-card account-empty">
                <strong>No accepted jobs yet</strong>
                <span>Job agreements become available after a customer accepts a provider quote.</span>
              </section>
            ) : data.jobs.map((job) => (
              <section className="account-card" key={job.requestId}>
                <div className="account-card-heading">
                  <div>
                    <span className="account-role">{job.requestStatus}</span>
                    <h2>{parseJobServices(job.service).join(" + ")}</h2>
                    <p>{job.vehicle}</p>
                  </div>
                  <span className="account-count">{job.authorizations.length}</span>
                </div>

                <div className="owner-settings-grid">
                  <div><dt>Provider</dt><dd>{job.providerName}</dd></div>
                  <div><dt>Customer</dt><dd>{job.customerName}</dd></div>
                  <div><dt>Accepted quote</dt><dd>{money(job.priceCents)}</dd></div>
                  <div><dt>Availability stated</dt><dd>{job.availability || "Not stated"}</dd></div>
                </div>

                <details className="workspace-tools">
                  <summary>Service-specific customer disclosures</summary>
                  <div className="workspace-tool-content">
                    <ul>
                      {job.disclosures.map((disclosure) => <li key={disclosure}>{disclosure}</li>)}
                    </ul>
                  </div>
                </details>

                {data.role === "provider" && job.requestStatus !== "completed" && (
                  <details className="workspace-tools">
                    <summary>Create a detailed work order or change order</summary>
                    <div className="workspace-tool-content">
                      <p>
                        Set your own scope, price, timing, and warranty. Tuveloz does not set
                        provider prices or direct how lawful work must be performed.
                      </p>
                      <form onSubmit={(event) => createAuthorization(event, job.requestId)}>
                        <label>
                          Authorization type
                          <select defaultValue="change-order" name="authorizationType">
                            <option value="work-order">Detailed work order</option>
                            <option value="change-order">Change order</option>
                            <option value="diagnostic-follow-up">Diagnostic follow-up</option>
                            <option value="scope-update">Scope update</option>
                          </select>
                        </label>
                        <label>
                          Title
                          <input name="title" placeholder="Example: Replace front brake pads and rotors" required type="text" />
                        </label>
                        <label>
                          Exact work or diagnostic scope
                          <textarea
                            name="description"
                            placeholder="Describe what is included, what is excluded, parts assumptions, and why the change is being proposed."
                            required
                            rows={5}
                          />
                        </label>
                        <label>
                          Labor amount
                          <input min="0" name="laborAmount" required step="0.01" type="number" />
                        </label>
                        <label>
                          Parts amount
                          <input defaultValue="0" min="0" name="partsAmount" required step="0.01" type="number" />
                        </label>
                        <label>
                          Other disclosed fees
                          <input defaultValue="0" min="0" name="otherFeesAmount" required step="0.01" type="number" />
                        </label>
                        <label>
                          Estimated completion, optional
                          <input name="estimatedCompletionAt" type="datetime-local" />
                        </label>
                        <label>
                          Scope type
                          <select defaultValue="no" name="diagnosticOnly">
                            <option value="no">Work or repair authorization</option>
                            <option value="yes">Diagnostic only — no repair authorized</option>
                          </select>
                        </label>
                        <label>
                          Provider workmanship warranty
                          <textarea
                            name="workmanshipWarranty"
                            placeholder="State your own warranty or explicitly state that no additional written warranty is offered."
                            rows={3}
                          />
                        </label>
                        <label>
                          Parts or manufacturer warranty
                          <textarea
                            name="partsWarranty"
                            placeholder="State the parts warranty, manufacturer terms, customer-supplied-part limit, or that no new parts are included."
                            rows={3}
                          />
                        </label>
                        <label>
                          Supersedes an earlier non-quote authorization, optional
                          <select defaultValue="" name="supersedesAuthorizationId">
                            <option value="">Does not replace an earlier authorization</option>
                            {job.authorizations
                              .filter((authorization) => authorization.authorizationType !== "accepted-quote")
                              .map((authorization) => (
                                <option key={authorization.id} value={authorization.id}>
                                  {authorization.title} · {authorization.status}
                                </option>
                              ))}
                          </select>
                        </label>
                        <button
                          className="button primary account-button"
                          disabled={busyId === `create:${job.requestId}`}
                          type="submit"
                        >
                          {busyId === `create:${job.requestId}` ? "Sending…" : "Send for customer decision"}
                        </button>
                      </form>
                    </div>
                  </details>
                )}

                <div className="account-request-list">
                  {job.authorizations.map((authorization) => {
                    const draft = responseDrafts[authorization.id] ?? EMPTY_RESPONSE;
                    return (
                      <article className="account-request" key={authorization.id}>
                        <span>
                          <strong>{authorization.title}</strong>
                          <small>
                            {authorizationLabel(authorization.authorizationType)} · {money(authorization.totalCents)} · {readableDate(authorization.createdAt)}
                          </small>
                          <small>
                            Labor {money(authorization.laborCents)} · Parts {money(authorization.partsCents)} · Other fees {money(authorization.otherFeesCents)}
                          </small>
                          <p>{authorization.description}</p>
                          {authorization.diagnosticOnly && (
                            <p className="admin-note">Diagnostic only — this record does not authorize repair work.</p>
                          )}
                          <p><strong>Workmanship warranty:</strong> {authorization.workmanshipWarranty || "Not separately stated in the accepted quote."}</p>
                          <p><strong>Parts warranty:</strong> {authorization.partsWarranty || "Not separately stated in the accepted quote."}</p>
                          <p><strong>Estimated completion:</strong> {readableDate(authorization.estimatedCompletionAt)}</p>
                          {authorization.replacedPartsReturn === "requested" && (
                            <p><strong>Customer requested return of replaced parts where legally and safely available.</strong></p>
                          )}
                          {authorization.responseNote && <blockquote>{authorization.responseNote}</blockquote>}

                          {data.role === "customer" && authorization.status === "pending" && (
                            <div className="workspace-tool-content">
                              <label>
                                Replaced-parts preference
                                <select
                                  onChange={(event) => updateResponseDraft(authorization.id, {
                                    replacedPartsReturn: event.target.value as ResponseDraft["replacedPartsReturn"],
                                  })}
                                  value={draft.replacedPartsReturn}
                                >
                                  <option value="not-requested">I am not requesting replaced parts</option>
                                  <option value="requested">Return replaced parts where legally and safely available</option>
                                  <option value="not-applicable">No replaced parts are involved</option>
                                </select>
                              </label>
                              <label>
                                Optional response note
                                <textarea
                                  onChange={(event) => updateResponseDraft(authorization.id, { note: event.target.value })}
                                  placeholder="Ask the provider to clarify an item or record why you declined."
                                  rows={3}
                                  value={draft.note}
                                />
                              </label>
                              <label>
                                <input
                                  checked={draft.consentAccepted}
                                  onChange={(event) => updateResponseDraft(authorization.id, { consentAccepted: event.target.checked })}
                                  type="checkbox"
                                />
                                I reviewed the written scope and amount. I understand that accepting authorizes only this record and does not make Tuveloz the vehicle-service provider.
                              </label>
                              <div className="hero-actions">
                                <button
                                  className="button primary"
                                  disabled={busyId === `respond:${authorization.id}`}
                                  onClick={() => respond(authorization.id, "accepted")}
                                  type="button"
                                >
                                  Accept written authorization
                                </button>
                                <button
                                  className="button secondary"
                                  disabled={busyId === `respond:${authorization.id}`}
                                  onClick={() => respond(authorization.id, "declined")}
                                  type="button"
                                >
                                  Decline
                                </button>
                              </div>
                            </div>
                          )}

                          {data.role === "provider" && authorization.status === "pending" && (
                            <button
                              className="button secondary account-button"
                              disabled={busyId === `withdraw:${authorization.id}`}
                              onClick={() => withdraw(authorization.id)}
                              type="button"
                            >
                              {busyId === `withdraw:${authorization.id}` ? "Withdrawing…" : "Withdraw pending authorization"}
                            </button>
                          )}
                        </span>
                        <span className={`account-status ${statusClass(authorization.status)}`}>
                          {authorization.status}
                        </span>
                      </article>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
