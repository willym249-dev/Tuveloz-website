"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { primeAccountHeaderState } from "../components/account-header-state";
import { CustomerAccountTools } from "../components/customer-account-tools";
import { CustomerPaymentMethods } from "../components/customer-payment-methods";
import { JobMessages } from "../components/job-messages";
import { LaunchUpdatesForm } from "../components/launch-updates-form";
import { SiteLanguageButton } from "../components/site-language";
import { BrandMark } from "../components/tuveloz-icons";
import { parseJobServices } from "../../lib/service-matching";
import { CUSTOMER_JOB_POSTING_PAUSED } from "../../lib/launch-status";

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
  refundStatus: string;
  refundUpdatedAt: string;
  disputeStatus: string;
  createdAt: string;
};

type CustomerAccount = {
  role: "customer";
  email: string;
  availableRoles: Array<"customer" | "provider">;
  requests: CustomerRequest[];
  payments: CustomerPayment[];
};

type CustomerView = "requests" | "quotes" | "active" | "messages" | "history" | "payments" | "saved" | "settings";

const ACTIVE_JOB_STATUSES = new Set(["quote accepted", "on my way", "arrived"]);
const HISTORY_JOB_STATUSES = new Set(["completed", "cancelled", "canceled"]);
const REQUEST_VIEWS = new Set<CustomerView>(["requests", "quotes", "active", "history"]);
const CUSTOMER_VIEWS = new Set<CustomerView>([
  "requests",
  "quotes",
  "active",
  "messages",
  "history",
  "payments",
  "saved",
  "settings",
]);

const CUSTOMER_VIEW_COPY: Record<CustomerView, {
  title: string;
  emptyTitle: string;
  emptyText: string;
}> = {
  requests: {
    title: "My jobs",
    emptyTitle: "No requests yet",
    emptyText: "After customer launch, your vehicle-service requests will appear here.",
  },
  quotes: {
    title: "Quotes received",
    emptyTitle: "No quotes received yet",
    emptyText: "After customer launch, requests with provider quotes will appear here.",
  },
  active: {
    title: "Active jobs",
    emptyTitle: "No active jobs",
    emptyText: "After customer launch, jobs will appear here if you accept a provider quote.",
  },
  history: {
    title: "Job history",
    emptyTitle: "No completed jobs yet",
    emptyText: "After customer launch, completed and canceled jobs will appear here.",
  },
  messages: {
    title: "Messages",
    emptyTitle: "No job conversations yet",
    emptyText: "After customer launch, messages become available when a quote is accepted.",
  },
  payments: {
    title: "Payments",
    emptyTitle: "No payments yet",
    emptyText: "After payments launch, checkout records for this customer account will appear here.",
  },
  saved: {
    title: "Saved providers",
    emptyTitle: "No saved providers yet",
    emptyText: "After customer launch, providers from your quote history can be saved here.",
  },
  settings: {
    title: "Profile & settings",
    emptyTitle: "Profile unavailable",
    emptyText: "Your customer profile settings will appear here.",
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
    ? "Date unavailable"
    : parsed.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function formatMoney(cents: number, currency: string) {
  const normalizedCurrency = currency.trim().toUpperCase() || "USD";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: normalizedCurrency,
    }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${normalizedCurrency}`;
  }
}

function paymentStatusLabel(status: string) {
  const labels: Record<string, string> = {
    checkout_creating: "Not paid",
    checkout_created: "Not paid",
    checkout_expired: "Checkout expired",
    payment_failed: "Payment failed",
    paid_pending_completion: "Paid",
    ready_for_release: "Paid",
    released: "Paid",
    paid_and_transferred: "Paid",
    refunded: "Refunded",
    partially_refunded: "Partially refunded",
    refund_pending: "Refund pending",
    refund_requires_action: "Refund needs action",
    refund_failed_review: "Refund failed — under review",
    refund_canceled_review: "Refund canceled — under review",
    refund_status_review: "Refund under review",
    disputed: "Dispute open",
    dispute_won_review: "Dispute resolved",
    dispute_lost: "Dispute closed",
  };
  return labels[status] ?? status.replaceAll("_", " ");
}

function paymentStatusIsSettled(status: string) {
  return [
    "paid_pending_completion",
    "ready_for_release",
    "released",
    "paid_and_transferred",
    "refunded",
    "partially_refunded",
  ].includes(status);
}

function initialCustomerView(): CustomerView {
  if (typeof window === "undefined") return "requests";
  const requestedView = new URL(window.location.href).searchParams.get("view");
  return requestedView && CUSTOMER_VIEWS.has(requestedView as CustomerView)
    ? requestedView as CustomerView
    : "requests";
}

export default function CustomerPage() {
  const [account, setAccount] = useState<CustomerAccount | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [activeView, setActiveView] = useState<CustomerView>(initialCustomerView);

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
      // Public pages linked from here share this answer, so the launch status
      // page never shows a signed-in customer the signed-out wording.
      primeAccountHeaderState("customer", "/customer");
      setAccount(result);
    }).catch((reason) => setError(reason.message || "Unable to load your customer workspace."));
  }, []);

  async function signOut() {
    setBusy(true);
    await fetch("/api/auth/logout", { method: "POST" });
    // The cached answer outlives the page, so it has to be retired with the
    // session or public pages would keep claiming this person is signed in.
    primeAccountHeaderState("signed-out");
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

  const requestView = REQUEST_VIEWS.has(activeView);
  const visibleRequests = account && requestView
    ? account.requests.filter((request) => requestMatchesView(request, activeView))
    : [];
  const viewCopy = CUSTOMER_VIEW_COPY[activeView];
  const dashboardCount = activeView === "payments"
    ? account?.payments.length ?? 0
    : requestView
      ? visibleRequests.length
      : null;
  const viewRole = activeView === "payments"
    ? "Customer payments"
    : activeView === "messages"
      ? "Private job messages"
      : activeView === "saved"
        ? "Customer providers"
        : activeView === "settings"
          ? "Customer profile"
          : "Customer requests";

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
          <h1>Your customer account.</h1>
          <p>Manage your account now. New customer requests and payments remain closed during provider onboarding.</p>
          {account && <small>Signed in as {account.email}</small>}
        </div>

        {CUSTOMER_JOB_POSTING_PAUSED && (
          <aside className="customer-launch-callout" role="status">
            <span className="account-kicker">Customer launch status</span>
            <strong>You&rsquo;re in! Job requests open soon.</strong>
            <p>
              Your account is ready now &mdash; creating it did not submit a
              request, contact a provider, book service, or charge you.
            </p>
            <p className="customer-launch-callout-optin">
              Want an email the moment service requests open? Add your address
              below. Creating an account does not sign you up on its own.
            </p>
            <LaunchUpdatesForm source="customer-dashboard" />
          </aside>
        )}

        {error && <p className="form-error account-login-message" role="alert">{error}</p>}
        {!account && !error && <p className="admin-note account-loading">Loading your requests…</p>}
        {account && (
          <div className="account-grid account-customer-grid">
            <nav className="workspace-nav customer-workspace-nav" aria-label="Customer dashboard">
              <Link className="workspace-nav-primary" href="/post-job">Customer launch status</Link>
              <Link className="workspace-nav-primary" href="/ai">Ask Tuveloz AI</Link>
              {([
                ["requests", "My requests"],
                ["quotes", "Quotes received"],
                ["active", "Active jobs"],
                ["messages", "Messages"],
                ["history", "Job history"],
                ["payments", "Payments"],
                ["saved", "Saved providers"],
                ["settings", "Profile & settings"],
              ] as Array<[CustomerView, string]>).map(([view, label]) => (
                <button
                  aria-controls="customer-dashboard-content"
                  aria-pressed={activeView === view}
                  className={activeView === view ? "is-active" : ""}
                  key={view}
                  onClick={() => setActiveView(view)}
                  type="button"
                >
                  {label}
                </button>
              ))}
            </nav>

            <section aria-live="polite" className="account-card" id="customer-dashboard-content">
              <div className="account-card-heading">
                <div>
                  <span className="account-role">{viewRole}</span>
                  <h2>{viewCopy.title}</h2>
                </div>
                {dashboardCount !== null && <span className="account-count">{dashboardCount}</span>}
              </div>

              {activeView === "messages" ? (
                <JobMessages audience="customer" />
              ) : activeView === "saved" || activeView === "settings" ? (
                <CustomerAccountTools view={activeView} />
              ) : activeView === "payments" ? (
                <>
                  <p>Customer account: <strong>{account.email}</strong></p>
                  <CustomerPaymentMethods />
                  {account.payments.length > 0 ? (
                    <div className="account-request-list">
                      {account.payments.map((payment) => (
                        <article className="account-request" key={payment.id}>
                          <span>
                            <strong>{payment.productName}</strong>
                            <small>
                              {formatMoney(payment.customerTotalCents, payment.currency)} total
                              {" · "}
                              {shortDate(payment.paidAt || payment.createdAt)}
                            </small>
                            <small>
                              Provider subtotal: {formatMoney(payment.providerAmountCents, payment.currency)}
                              {" · "}
                              Customer Service Fee: {formatMoney(payment.applicationFeeCents, payment.currency)}
                            </small>
                            {payment.refundAmountCents > 0 && (
                              <small>
                                Refund recorded: {formatMoney(payment.refundAmountCents, payment.currency)}
                                {payment.refundedAt ? ` · ${shortDate(payment.refundedAt)}` : ""}
                              </small>
                            )}
                            {payment.refundStatus && (
                              <small>
                                Refund status: {payment.refundStatus.replaceAll("_", " ")}
                                {payment.refundUpdatedAt
                                  ? ` · ${shortDate(payment.refundUpdatedAt)}`
                                  : ""}
                              </small>
                            )}
                            {payment.disputeStatus && (
                              <small>Dispute status: {payment.disputeStatus.replaceAll("_", " ")}</small>
                            )}
                          </span>
                          <span className={`account-status ${
                            paymentStatusIsSettled(payment.status) ? "is-active" : ""
                          }`}>
                            {paymentStatusLabel(payment.status)}
                          </span>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <div className="account-empty">
                      <strong>{viewCopy.emptyTitle}</strong>
                      <span>{viewCopy.emptyText}</span>
                    </div>
                  )}
                </>
              ) : visibleRequests.length > 0 ? (
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

              {activeView === "payments" ? (
                <Link className="button secondary account-button" href="/payments">
                  Payment policy <span>→</span>
                </Link>
              ) : requestView ? (
                <Link className="button primary account-button" href="/post-job">
                  Customer launch status <span>→</span>
                </Link>
              ) : null}
            </section>

            <details className="workspace-tools account-customer-guide">
              <summary>How customer privacy works</summary>
              <div className="workspace-tool-content">
                <p>
                  After customer launch, providers will see only the information
                  needed to decide whether to quote. Your exact address and contact
                  details will be shared only with the provider you select.
                </p>
              </div>
            </details>
          </div>
        )}
      </section>
    </main>
  );
}
