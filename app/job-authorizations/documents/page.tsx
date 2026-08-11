"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SiteLanguageButton } from "../../components/site-language";
import { BrandMark } from "../../components/tuveloz-icons";
import { parseJobServices } from "../../../lib/service-matching";

type Role = "customer" | "provider";
type AuthorizationStatus = "pending" | "accepted" | "declined" | "withdrawn" | "superseded";
type AuthorizationType = "accepted-quote" | "work-order" | "change-order" | "diagnostic-follow-up" | "scope-update";

type JobAuthorization = {
  id: string;
  requestId: string;
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
  createdAt: string;
  respondedAt: string;
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
  jobs: AcceptedJob[];
};

type CustomerPayment = {
  id: string;
  paymentType: string;
  requestId: string | null;
  productName: string;
  currency: string;
  quantity: number;
  providerAmountCents: number;
  applicationFeeCents: number;
  customerTotalCents: number;
  status: string;
  paidAt: string;
  refundAmountCents: number;
  refundedAt: string;
  disputeStatus: string;
  createdAt: string;
};

type CustomerAccount = {
  role?: string;
  email?: string;
  payments?: CustomerPayment[];
};

const RECEIPT_STATUSES = new Set([
  "paid_pending_completion",
  "ready_for_release",
  "released",
  "paid_and_transferred",
  "refunded",
  "partially_refunded",
]);

function money(cents: number | string, currency = "USD") {
  const value = typeof cents === "number" ? cents : Number(cents);
  const normalizedCurrency = currency.trim().toUpperCase() || "USD";
  const safeValue = Number.isFinite(value) ? value : 0;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: normalizedCurrency,
    }).format(safeValue / 100);
  } catch {
    return `${(safeValue / 100).toFixed(2)} ${normalizedCurrency}`;
  }
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

function paymentStatusLabel(status: string) {
  const labels: Record<string, string> = {
    paid_pending_completion: "Paid — job completion pending",
    ready_for_release: "Paid — ready for provider release review",
    released: "Paid — provider transfer released",
    paid_and_transferred: "Paid and transferred",
    refunded: "Refunded",
    partially_refunded: "Partially refunded",
  };
  return labels[status] ?? status.replaceAll("_", " ");
}

function escapeHtml(value: string) {
  const replacements: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;",
  };
  return value.replace(/[&<>"']/g, (character) => replacements[character]);
}

function escapeLines(value: string) {
  return escapeHtml(value).replace(/\r?\n/g, "<br />");
}

function openPrintWindow(title: string, body: string) {
  const printWindow = window.open("", "_blank", "width=940,height=760");
  if (!printWindow) return false;
  printWindow.opener = null;
  printWindow.document.open();
  printWindow.document.write(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    :root { color-scheme: light; }
    * { box-sizing: border-box; }
    body { margin: 0; color: #07182d; font-family: Arial, Helvetica, sans-serif; background: #fff; }
    main { width: min(920px, 100%); margin: 0 auto; padding: 36px; }
    header { display: flex; justify-content: space-between; gap: 24px; align-items: flex-start; border-bottom: 3px solid #ff6a00; padding-bottom: 18px; }
    h1 { margin: 0 0 6px; font-size: 28px; }
    h2 { margin: 26px 0 10px; font-size: 18px; }
    p { line-height: 1.5; }
    .brand { font-size: 22px; font-weight: 900; letter-spacing: .04em; }
    .brand strong { color: #ff6a00; }
    .meta { text-align: right; font-size: 12px; line-height: 1.5; }
    .facts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px 24px; margin: 24px 0; }
    .facts div { border-bottom: 1px solid #d9dee5; padding: 8px 0; }
    .facts span { display: block; color: #586575; font-size: 12px; }
    .facts strong { display: block; margin-top: 3px; }
    table { width: 100%; border-collapse: collapse; margin: 16px 0; }
    th, td { border: 1px solid #cfd6df; padding: 9px; vertical-align: top; text-align: left; }
    th { background: #f4f6f8; font-size: 12px; }
    td.amount, th.amount { text-align: right; white-space: nowrap; }
    tfoot td { font-weight: 800; }
    .record { border: 1px solid #d9dee5; border-radius: 10px; padding: 14px; margin: 12px 0; break-inside: avoid; }
    .record h3 { margin: 0 0 6px; font-size: 16px; }
    .record small { color: #586575; }
    .notice { border-left: 4px solid #ff6a00; background: #fff6ee; padding: 12px 14px; margin-top: 22px; }
    footer { border-top: 1px solid #cfd6df; margin-top: 28px; padding-top: 14px; color: #586575; font-size: 11px; line-height: 1.5; }
    @media print { main { padding: 0; } .no-print { display: none; } }
    @media (max-width: 640px) { main { padding: 20px; } header { display: block; } .meta { text-align: left; margin-top: 12px; } .facts { grid-template-columns: 1fr; } }
  </style>
</head>
<body><main>${body}</main></body>
</html>`);
  printWindow.document.close();
  window.setTimeout(() => {
    printWindow.focus();
    printWindow.print();
  }, 150);
  return true;
}

function defaultSelectedIds(job: AcceptedJob) {
  const accepted = job.authorizations.filter((authorization) => authorization.status === "accepted");
  const baseline = accepted.filter((authorization) => authorization.authorizationType === "accepted-quote");
  const additions = accepted.filter((authorization) => (
    authorization.authorizationType === "change-order"
    || authorization.authorizationType === "diagnostic-follow-up"
  ));
  const defaults = [...baseline, ...additions].map((authorization) => authorization.id);
  return defaults.length > 0 ? defaults : accepted.map((authorization) => authorization.id);
}

function authorizationDocumentBody(
  job: AcceptedJob,
  records: JobAuthorization[],
  documentType: "authorization" | "invoice",
) {
  const total = records.reduce((sum, record) => sum + record.totalCents, 0);
  const title = documentType === "invoice"
    ? "Independent provider invoice / work summary"
    : "Accepted estimate and authorization record";
  const rows = records.map((record) => `
    <tr>
      <td><strong>${escapeHtml(record.title)}</strong><br /><small>${escapeHtml(authorizationLabel(record.authorizationType))}</small></td>
      <td class="amount">${escapeHtml(money(record.laborCents))}</td>
      <td class="amount">${escapeHtml(money(record.partsCents))}</td>
      <td class="amount">${escapeHtml(money(record.otherFeesCents))}</td>
      <td class="amount">${escapeHtml(money(record.totalCents))}</td>
    </tr>`).join("");
  const recordDetails = records.map((record) => `
    <section class="record">
      <h3>${escapeHtml(record.title)}</h3>
      <small>${escapeHtml(authorizationLabel(record.authorizationType))} · accepted ${escapeHtml(readableDate(record.respondedAt || record.createdAt))}</small>
      <p>${escapeLines(record.description)}</p>
      ${record.diagnosticOnly ? "<p><strong>Diagnostic only:</strong> No repair is authorized by this record.</p>" : ""}
      <p><strong>Estimated completion:</strong> ${escapeHtml(readableDate(record.estimatedCompletionAt))}</p>
      <p><strong>Provider workmanship warranty:</strong> ${escapeLines(record.workmanshipWarranty || "Not separately stated in this record.")}</p>
      <p><strong>Parts or manufacturer warranty:</strong> ${escapeLines(record.partsWarranty || "Not separately stated in this record.")}</p>
      ${record.replacedPartsReturn === "requested" ? "<p><strong>Customer requested return of replaced parts where legally and safely available.</strong></p>" : ""}
    </section>`).join("");
  const disclosures = job.disclosures.length > 0
    ? `<h2>Service disclosures</h2><ul>${job.disclosures.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
    : "";

  return `
    <header>
      <div>
        <div class="brand">TUVE<strong>LOZ</strong></div>
        <h1>${escapeHtml(title)}</h1>
        <p>Generated from accepted Tuveloz marketplace records.</p>
      </div>
      <div class="meta">
        <strong>Job reference</strong><br />${escapeHtml(job.requestId)}<br />
        Generated ${escapeHtml(new Date().toLocaleString())}
      </div>
    </header>
    <section class="facts">
      <div><span>Independent provider</span><strong>${escapeHtml(job.providerName)}</strong>${job.providerEmail ? `<br />${escapeHtml(job.providerEmail)}` : ""}</div>
      <div><span>Customer</span><strong>${escapeHtml(job.customerName)}</strong>${job.customerEmail ? `<br />${escapeHtml(job.customerEmail)}` : ""}</div>
      <div><span>Vehicle</span><strong>${escapeHtml(job.vehicle)}</strong></div>
      <div><span>Service</span><strong>${escapeHtml(parseJobServices(job.service).join(" + "))}</strong></div>
      <div><span>Marketplace job status</span><strong>${escapeHtml(job.requestStatus)}</strong></div>
      <div><span>Provider availability stated</span><strong>${escapeHtml(job.availability || "Not stated")}</strong></div>
    </section>
    <h2>Accepted records selected for this document</h2>
    <table>
      <thead><tr><th>Accepted scope</th><th class="amount">Labor</th><th class="amount">Parts</th><th class="amount">Other</th><th class="amount">Total</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr><td colspan="4">Selected accepted-record total</td><td class="amount">${escapeHtml(money(total))}</td></tr></tfoot>
    </table>
    ${recordDetails}
    ${disclosures}
    <div class="notice">
      <strong>${documentType === "invoice" ? "Payment is not proven by this invoice." : "Authorization scope only."}</strong>
      <p>
        Only accepted records selected by the person printing this document are included. Pending,
        declined, withdrawn, and superseded records are excluded. Compare this document with the
        complete Job agreements history before relying on the total.
      </p>
    </div>
    <footer>
      Tuveloz is a marketplace and does not perform the vehicle service. The independent provider is
      responsible for the service, final invoice accuracy, applicable taxes and fees, lawful work,
      stated warranties, and any provider-issued receipt. A separate Tuveloz payment receipt records
      only a marketplace payment processed through Tuveloz; it does not replace the provider's itemized invoice.
    </footer>`;
}

function paymentReceiptBody(payment: CustomerPayment, customerEmail: string) {
  const date = payment.paidAt || payment.createdAt;
  return `
    <header>
      <div>
        <div class="brand">TUVE<strong>LOZ</strong></div>
        <h1>Tuveloz payment receipt</h1>
        <p>Marketplace payment record for the signed-in customer.</p>
      </div>
      <div class="meta">
        <strong>Receipt record</strong><br />${escapeHtml(payment.id)}<br />
        ${escapeHtml(readableDate(date))}
      </div>
    </header>
    <section class="facts">
      <div><span>Customer account</span><strong>${escapeHtml(customerEmail)}</strong></div>
      <div><span>Payment status</span><strong>${escapeHtml(paymentStatusLabel(payment.status))}</strong></div>
      <div><span>Item or job</span><strong>${escapeHtml(payment.productName)}</strong></div>
      <div><span>Job reference</span><strong>${escapeHtml(payment.requestId || "Not linked to a job")}</strong></div>
      <div><span>Payment type</span><strong>${escapeHtml(payment.paymentType.replaceAll("_", " "))}</strong></div>
      <div><span>Quantity</span><strong>${escapeHtml(String(payment.quantity || 1))}</strong></div>
    </section>
    <table>
      <tbody>
        <tr><td>Independent-provider subtotal</td><td class="amount">${escapeHtml(money(payment.providerAmountCents, payment.currency))}</td></tr>
        <tr><td>Customer Service Fee</td><td class="amount">${escapeHtml(money(payment.applicationFeeCents, payment.currency))}</td></tr>
        <tr><td><strong>Total marketplace payment</strong></td><td class="amount"><strong>${escapeHtml(money(payment.customerTotalCents, payment.currency))}</strong></td></tr>
        ${payment.refundAmountCents > 0 ? `<tr><td>Refund recorded${payment.refundedAt ? ` · ${escapeHtml(readableDate(payment.refundedAt))}` : ""}</td><td class="amount">-${escapeHtml(money(payment.refundAmountCents, payment.currency))}</td></tr>` : ""}
      </tbody>
    </table>
    ${payment.disputeStatus ? `<p><strong>Dispute status:</strong> ${escapeHtml(payment.disputeStatus.replaceAll("_", " "))}</p>` : ""}
    <div class="notice">
      <strong>This receipt records the Tuveloz marketplace payment only.</strong>
      <p>
        It does not prove the quality or completion of vehicle work and does not replace the
        independent provider's itemized invoice, warranty terms, tax documentation, or provider-issued receipt.
      </p>
    </div>
    <footer>
      No full card number, CVC, bank account, Stripe secret, or private processor credential is included.
      Keep this receipt with the accepted Job agreements and the provider's final invoice.
    </footer>`;
}

export default function JobDocumentsPage() {
  const [data, setData] = useState<AuthorizationData | null>(null);
  const [payments, setPayments] = useState<CustomerPayment[]>([]);
  const [selected, setSelected] = useState<Record<string, string[]>>({});
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch("/api/job-authorizations", { cache: "no-store" });
        const result = await response.json().catch(() => ({})) as AuthorizationData & { error?: string };
        if (response.status === 401) {
          window.location.replace("/account");
          return;
        }
        if (!response.ok) throw new Error(result.error || "Unable to load job documents.");
        setData(result);
        setSelected(Object.fromEntries(result.jobs.map((job) => [job.requestId, defaultSelectedIds(job)])));

        if (result.role === "customer") {
          const accountResponse = await fetch("/api/account", { cache: "no-store" });
          const account = await accountResponse.json().catch(() => ({})) as CustomerAccount;
          if (accountResponse.ok && account.role === "customer") {
            setPayments((account.payments ?? []).filter((payment) => RECEIPT_STATUSES.has(payment.status)));
          }
        }
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Unable to load job documents.");
      }
    }
    void load();
  }, []);

  function toggleRecord(requestId: string, authorizationId: string) {
    setSelected((current) => {
      const currentIds = current[requestId] ?? [];
      const nextIds = currentIds.includes(authorizationId)
        ? currentIds.filter((id) => id !== authorizationId)
        : [...currentIds, authorizationId];
      return { ...current, [requestId]: nextIds };
    });
    setNotice("");
  }

  function printJobDocument(job: AcceptedJob, documentType: "authorization" | "invoice") {
    setError("");
    setNotice("");
    const selectedIds = new Set(selected[job.requestId] ?? []);
    const records = job.authorizations.filter((authorization) => (
      authorization.status === "accepted" && selectedIds.has(authorization.id)
    ));
    if (records.length === 0) {
      setError("Select at least one accepted authorization before creating the document.");
      return;
    }
    const title = documentType === "invoice"
      ? `Provider invoice — ${job.vehicle}`
      : `Accepted authorization — ${job.vehicle}`;
    const opened = openPrintWindow(title, authorizationDocumentBody(job, records, documentType));
    if (!opened) {
      setError("Your browser blocked the print window. Allow pop-ups for Tuveloz and try again.");
      return;
    }
    setNotice("The print-ready document opened in a new window. Review it before saving or printing.");
  }

  function printPaymentReceipt(payment: CustomerPayment) {
    if (!data || data.role !== "customer") return;
    setError("");
    setNotice("");
    const opened = openPrintWindow(
      `Tuveloz payment receipt — ${payment.productName}`,
      paymentReceiptBody(payment, data.email),
    );
    if (!opened) {
      setError("Your browser blocked the receipt window. Allow pop-ups for Tuveloz and try again.");
      return;
    }
    setNotice("The payment receipt opened in a new window. Review it before saving or printing.");
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
          <span className="account-kicker">Accepted scope and factual payment records</span>
          <h1>Invoices, estimates, and receipts.</h1>
          <p>
            Create print-ready records from accepted Job agreements without treating pending
            work as approved or confusing a provider invoice with a Tuveloz payment receipt.
          </p>
          {data && <small>Signed in as {data.email}</small>}
        </div>

        {error && <p className="form-error account-login-message" role="alert">{error}</p>}
        {notice && <p className="portal-success account-login-message" role="status">{notice}</p>}
        {!data && !error && <p className="admin-note account-loading">Loading accepted job records…</p>}

        {data && (
          <div className="account-grid">
            <section className="account-card">
              <div className="account-card-heading">
                <div>
                  <span className="account-role">Important document boundary</span>
                  <h2>Invoice and receipt are not the same.</h2>
                </div>
              </div>
              <p>
                The independent provider is responsible for the itemized service invoice, taxes,
                lawful work, and stated warranties. A Tuveloz payment receipt records only a
                marketplace payment stored for the signed-in customer.
              </p>
              <p className="admin-note">
                Selecting records below changes only the printout. It does not edit, accept,
                decline, withdraw, supersede, charge, refund, or pay anything.
              </p>
              <Link className="button secondary account-button" href="/job-authorizations">
                Open complete Job agreements history <span>→</span>
              </Link>
            </section>

            {data.jobs.length === 0 ? (
              <section className="account-card account-empty">
                <strong>No accepted jobs yet</strong>
                <span>Document tools become available after a customer accepts a provider quote.</span>
              </section>
            ) : data.jobs.map((job) => {
              const accepted = job.authorizations.filter((authorization) => authorization.status === "accepted");
              const selectedIds = new Set(selected[job.requestId] ?? []);
              const selectedRecords = accepted.filter((authorization) => selectedIds.has(authorization.id));
              const selectedTotal = selectedRecords.reduce((sum, authorization) => sum + authorization.totalCents, 0);
              const completed = job.requestStatus.toLowerCase() === "completed";
              return (
                <section className="account-card" key={job.requestId}>
                  <div className="account-card-heading">
                    <div>
                      <span className="account-role">{job.requestStatus}</span>
                      <h2>{parseJobServices(job.service).join(" + ")}</h2>
                      <p>{job.vehicle}</p>
                    </div>
                    <span className="account-count">{accepted.length}</span>
                  </div>

                  <div className="owner-settings-grid">
                    <div><dt>Provider</dt><dd>{job.providerName}</dd></div>
                    <div><dt>Customer</dt><dd>{job.customerName}</dd></div>
                    <div><dt>Original accepted quote</dt><dd>{money(job.priceCents)}</dd></div>
                    <div><dt>Selected print total</dt><dd>{money(selectedTotal)}</dd></div>
                  </div>

                  {accepted.length === 0 ? (
                    <p className="admin-note">No active accepted authorization records are available for this job.</p>
                  ) : (
                    <div className="account-request-list">
                      {accepted.map((authorization) => (
                        <label className="account-request" key={authorization.id}>
                          <span>
                            <strong>{authorization.title}</strong>
                            <small>
                              {authorizationLabel(authorization.authorizationType)} · {money(authorization.totalCents)}
                            </small>
                            <small>
                              Labor {money(authorization.laborCents)} · Parts {money(authorization.partsCents)} · Other {money(authorization.otherFeesCents)}
                            </small>
                          </span>
                          <input
                            aria-label={`Include ${authorization.title} in the printout`}
                            checked={selectedIds.has(authorization.id)}
                            onChange={() => toggleRecord(job.requestId, authorization.id)}
                            type="checkbox"
                          />
                        </label>
                      ))}
                    </div>
                  )}

                  <p className="admin-note">
                    Default selection includes the accepted quote and accepted change or diagnostic
                    additions. Review carefully: a detailed work order or scope update may restate
                    earlier work instead of adding to it.
                  </p>
                  <div className="hero-actions">
                    <button
                      className="button primary"
                      disabled={selectedRecords.length === 0}
                      onClick={() => printJobDocument(job, "authorization")}
                      type="button"
                    >
                      Print estimate and authorization
                    </button>
                    {data.role === "provider" && (
                      <button
                        className="button secondary"
                        disabled={!completed || selectedRecords.length === 0}
                        onClick={() => printJobDocument(job, "invoice")}
                        type="button"
                      >
                        Print provider invoice / work summary
                      </button>
                    )}
                  </div>
                  {data.role === "provider" && !completed && (
                    <small>The provider invoice/work-summary option becomes available after the job is recorded as completed.</small>
                  )}
                </section>
              );
            })}

            {data.role === "customer" && (
              <section className="account-card">
                <div className="account-card-heading">
                  <div>
                    <span className="account-role">Customer payment records</span>
                    <h2>Tuveloz payment receipts</h2>
                  </div>
                  <span className="account-count">{payments.length}</span>
                </div>
                {payments.length === 0 ? (
                  <div className="account-empty">
                    <strong>No paid or refunded marketplace records yet</strong>
                    <span>Eligible receipts appear only after Tuveloz records a settled payment or refund.</span>
                  </div>
                ) : (
                  <div className="account-request-list">
                    {payments.map((payment) => (
                      <article className="account-request" key={payment.id}>
                        <span>
                          <strong>{payment.productName}</strong>
                          <small>{money(payment.customerTotalCents, payment.currency)} · {readableDate(payment.paidAt || payment.createdAt)}</small>
                          <small>{paymentStatusLabel(payment.status)}</small>
                        </span>
                        <button
                          className="button secondary"
                          onClick={() => printPaymentReceipt(payment)}
                          type="button"
                        >
                          Print receipt
                        </button>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
