"use client";

import { useState } from "react";

export type AdminView =
  | "users"
  | "providers"
  | "jobs"
  | "payments"
  | "reports"
  | "analytics"
  | "settings";

export type OwnerCustomerProfile = {
  profileComplete: boolean;
  municipality: string;
  zip: string;
  serviceLocations: string[];
  activeJobCount: number;
  completedJobCount: number;
  cancelledJobCount: number;
  quotesReceivedCount: number;
  acceptedQuoteCount: number;
  savedProviderCount: number;
  appointmentCount: number;
  pendingAppointmentCount: number;
  notificationCount: number;
  unreadNotificationCount: number;
  emailSentCount: number;
  emailPendingCount: number;
  emailFailedCount: number;
  lastRequestAt: string;
  profileUpdatedAt: string;
};

export type OwnerUser = {
  email: string;
  displayName: string;
  roles: Array<"customer" | "provider">;
  status: "active" | "temporarily locked";
  verifiedAt: string;
  termsAcceptedAt: string;
  termsVersion: string;
  createdAt: string;
  updatedAt: string;
  activeSessionCount: number;
  lastSeenAt: string;
  requestCount: number;
  providerQuoteCount: number;
  paymentCount: number;
  customerProfile: OwnerCustomerProfile;
};

export type OwnerPlatform = {
  generatedAt: string;
  siteUrl: string;
  serviceArea: string;
  customerServiceFeePercent: number;
  ownerAccessProtected: boolean;
  emailDeliveryConfigured: boolean;
  emailSenderDomain: string;
  stripeConfigured: boolean;
  stripeMode: "not configured" | "test" | "live blocked" | "live";
  livePaymentsEnabled: boolean;
  sessionProtection: string;
  policyVersions: {
    terms: string;
    customer: string;
    provider: string;
    privacy: string;
    payments: string;
  };
};

export type OwnerMetrics = {
  jobRequests: number;
  approvedJobs: number;
  testJobs: number;
  providerQuotes: number;
  acceptedQuotes: number;
  providerApplications: number;
  verifiedProviders: number;
  expansionRequests: number;
  feedbackResponses: number;
  acceptedFeeCents: number;
};

type OwnerControlCenterProps = {
  activeView: AdminView;
  onViewChange: (view: AdminView) => void;
  users: OwnerUser[];
  platform: OwnerPlatform | null;
  metrics: OwnerMetrics;
  securityError: string;
  onSessionsRevoked: (email: string) => void;
};

const ownerViews: Array<{ id: AdminView; label: string }> = [
  { id: "users", label: "User management" },
  { id: "providers", label: "Provider approvals" },
  { id: "jobs", label: "Jobs" },
  { id: "payments", label: "Payments" },
  { id: "reports", label: "Reports" },
  { id: "analytics", label: "Analytics" },
  { id: "settings", label: "Platform settings" },
];

function readableDate(value: string) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function yesNo(value: boolean) {
  return value ? "Yes" : "No";
}

function valueOrNotSaved(value: string) {
  return value || "Not saved";
}

function customerEmailStatus(profile: OwnerCustomerProfile) {
  const parts = [`${profile.emailSentCount} sent`];
  if (profile.emailPendingCount > 0) parts.push(`${profile.emailPendingCount} pending`);
  if (profile.emailFailedCount > 0) parts.push(`${profile.emailFailedCount} failed`);
  return parts.join(" · ");
}

export function OwnerControlCenter({
  activeView,
  onViewChange,
  users,
  platform,
  metrics,
  securityError,
  onSessionsRevoked,
}: OwnerControlCenterProps) {
  const [pendingEmail, setPendingEmail] = useState("");
  const [busyEmail, setBusyEmail] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  async function revokeSessions(email: string) {
    setBusyEmail(email);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "revoke-sessions", email }),
      });
      const result = await response.json() as { error?: string; revoked?: number };
      if (!response.ok) {
        throw new Error(result.error || "Unable to sign this account out.");
      }
      onSessionsRevoked(email);
      setNotice(
        result.revoked === 1
          ? "One active session was signed out."
          : `${result.revoked ?? 0} active sessions were signed out.`,
      );
      setPendingEmail("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to sign this account out.");
    } finally {
      setBusyEmail("");
    }
  }

  const quoteAcceptanceRate = metrics.providerQuotes > 0
    ? Math.round((metrics.acceptedQuotes / metrics.providerQuotes) * 100)
    : 0;

  return (
    <>
      <nav className="admin-control-nav" aria-label="Owner tools">
        {ownerViews.map((view) => (
          <button
            aria-pressed={activeView === view.id}
            className={activeView === view.id ? "is-active" : ""}
            key={view.id}
            onClick={() => onViewChange(view.id)}
            type="button"
          >
            {view.label}
          </button>
        ))}
      </nav>

      {notice && <p className="portal-success admin-control-message" role="status">{notice}</p>}
      {error && <p className="form-error admin-control-message" role="alert">{error}</p>}

      {activeView === "users" && (
        <section className="admin-section owner-users-section">
          <div className="admin-section-heading">
            <div>
              <span className="kicker">Privacy-safe account directory</span>
              <h2>Customer profiles and user management</h2>
            </div>
            <strong>{users.length} verified sign-in {users.length === 1 ? "account" : "accounts"}</strong>
          </div>
          <p className="admin-section-copy">
            Customer cards combine the profile, service-area preference, requests,
            appointments, saved providers, notifications, and email-delivery records
            already stored by Tuveloz. Passwords, verification codes, session tokens,
            full payment details, and exact service street addresses are never shown here.
          </p>
          {securityError ? (
            <p className="form-error" role="alert">{securityError}</p>
          ) : users.length === 0 ? (
            <p className="admin-note">No verified sign-in accounts yet.</p>
          ) : (
            <div className="owner-user-grid">
              {users.map((user) => (
                <article className="owner-user-card" key={user.email}>
                  <header>
                    <div>
                      <h3>{user.displayName || "No display name saved"}</h3>
                      <a href={`mailto:${user.email}`}>{user.email}</a>
                    </div>
                    <span className={user.status === "active" ? "status-ok" : "status-warning"}>
                      {user.status}
                    </span>
                  </header>
                  <div className="owner-role-list" aria-label="Account roles">
                    {user.roles.map((role) => <span key={role}>{role}</span>)}
                  </div>
                  <dl className="owner-user-facts">
                    <div><dt>Active sessions</dt><dd>{user.activeSessionCount}</dd></div>
                    <div><dt>Last activity</dt><dd>{readableDate(user.lastSeenAt)}</dd></div>
                    <div><dt>Job requests</dt><dd>{user.requestCount}</dd></div>
                    <div><dt>Quotes submitted as provider</dt><dd>{user.providerQuoteCount}</dd></div>
                    <div><dt>Payment records</dt><dd>{user.paymentCount}</dd></div>
                    <div><dt>Email verified</dt><dd>{readableDate(user.verifiedAt)}</dd></div>
                    <div><dt>Terms accepted</dt><dd>{readableDate(user.termsAcceptedAt)}</dd></div>
                    <div><dt>Terms version</dt><dd>{user.termsVersion || "Not recorded"}</dd></div>
                    <div><dt>Account created</dt><dd>{readableDate(user.createdAt)}</dd></div>
                  </dl>

                  <div className="owner-policy-versions">
                    <h3>Customer profile</h3>
                    <div className="owner-role-list" aria-label="Customer profile status">
                      <span>
                        {user.customerProfile.profileComplete
                          ? "Profile details saved"
                          : "Profile still being completed"}
                      </span>
                    </div>
                    <dl>
                      <div>
                        <dt>City or municipality</dt>
                        <dd>{valueOrNotSaved(user.customerProfile.municipality)}</dd>
                      </div>
                      <div>
                        <dt>ZIP code</dt>
                        <dd>{valueOrNotSaved(user.customerProfile.zip)}</dd>
                      </div>
                      <div>
                        <dt>Service preference</dt>
                        <dd>
                          {user.customerProfile.serviceLocations.length > 0
                            ? user.customerProfile.serviceLocations.join(" · ")
                            : "Not saved"}
                        </dd>
                      </div>
                      <div>
                        <dt>Last request</dt>
                        <dd>{readableDate(user.customerProfile.lastRequestAt)}</dd>
                      </div>
                      <div>
                        <dt>Active jobs</dt>
                        <dd>{user.customerProfile.activeJobCount}</dd>
                      </div>
                      <div>
                        <dt>Completed jobs</dt>
                        <dd>{user.customerProfile.completedJobCount}</dd>
                      </div>
                      <div>
                        <dt>Cancelled jobs</dt>
                        <dd>{user.customerProfile.cancelledJobCount}</dd>
                      </div>
                      <div>
                        <dt>Quotes received</dt>
                        <dd>{user.customerProfile.quotesReceivedCount}</dd>
                      </div>
                      <div>
                        <dt>Accepted quotes</dt>
                        <dd>{user.customerProfile.acceptedQuoteCount}</dd>
                      </div>
                      <div>
                        <dt>Saved providers</dt>
                        <dd>{user.customerProfile.savedProviderCount}</dd>
                      </div>
                      <div>
                        <dt>Appointments</dt>
                        <dd>
                          {user.customerProfile.appointmentCount}
                          {user.customerProfile.pendingAppointmentCount > 0
                            ? ` · ${user.customerProfile.pendingAppointmentCount} pending`
                            : ""}
                        </dd>
                      </div>
                      <div>
                        <dt>Notifications</dt>
                        <dd>
                          {user.customerProfile.notificationCount}
                          {user.customerProfile.unreadNotificationCount > 0
                            ? ` · ${user.customerProfile.unreadNotificationCount} unread`
                            : ""}
                        </dd>
                      </div>
                      <div>
                        <dt>Customer emails</dt>
                        <dd>{customerEmailStatus(user.customerProfile)}</dd>
                      </div>
                      <div>
                        <dt>Profile updated</dt>
                        <dd>{readableDate(user.customerProfile.profileUpdatedAt)}</dd>
                      </div>
                    </dl>
                    <p className="admin-section-copy">
                      Exact service street addresses are intentionally not shown in this
                      directory. Open the relevant accepted job only when that address is
                      needed for support or operations.
                    </p>
                  </div>

                  {user.activeSessionCount > 0 && pendingEmail !== user.email && (
                    <button
                      className="admin-secondary-action"
                      onClick={() => setPendingEmail(user.email)}
                      type="button"
                    >
                      Sign out all sessions
                    </button>
                  )}
                  {pendingEmail === user.email && (
                    <div className="owner-session-confirm" role="group" aria-label="Confirm session sign-out">
                      <p>
                        This ends every current Tuveloz session for {user.email}. The person can
                        sign in again normally.
                      </p>
                      <div>
                        <button
                          className="admin-secondary-action"
                          disabled={busyEmail === user.email}
                          onClick={() => setPendingEmail("")}
                          type="button"
                        >
                          Cancel
                        </button>
                        <button
                          className="admin-danger-action"
                          disabled={busyEmail === user.email}
                          onClick={() => revokeSessions(user.email)}
                          type="button"
                        >
                          {busyEmail === user.email ? "Signing out…" : "Confirm sign out"}
                        </button>
                      </div>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {activeView === "analytics" && (
        <section className="admin-section owner-analytics-section">
          <div className="admin-section-heading">
            <div>
              <span className="kicker">Stored marketplace records</span>
              <h2>Analytics</h2>
            </div>
            <strong>Updated with this dashboard load</strong>
          </div>
          <p className="admin-section-copy">
            These are exact counts from Tuveloz records. They are operational marketplace
            metrics, not estimated web traffic or advertising analytics.
          </p>
          <div className="owner-metric-grid">
            <article><strong>{metrics.jobRequests}</strong><span>Total job requests</span></article>
            <article><strong>{metrics.approvedJobs}</strong><span>Approved jobs</span></article>
            <article><strong>{metrics.testJobs}</strong><span>Clearly marked test jobs</span></article>
            <article><strong>{metrics.providerQuotes}</strong><span>Provider quotes</span></article>
            <article><strong>{metrics.acceptedQuotes}</strong><span>Accepted quotes</span></article>
            <article><strong>{quoteAcceptanceRate}%</strong><span>Accepted quotes / all quotes</span></article>
            <article><strong>{metrics.providerApplications}</strong><span>Provider applications</span></article>
            <article><strong>{metrics.verifiedProviders}</strong><span>Verified real providers</span></article>
            <article><strong>{metrics.expansionRequests}</strong><span>Expansion requests</span></article>
            <article><strong>{metrics.feedbackResponses}</strong><span>Feedback responses</span></article>
            <article>
              <strong>${(metrics.acceptedFeeCents / 100).toFixed(2)}</strong>
              <span>Service fees on accepted quotes</span>
            </article>
          </div>
        </section>
      )}

      {activeView === "settings" && (
        <section className="admin-section owner-settings-section">
          <div className="admin-section-heading">
            <div>
              <span className="kicker">Read-only runtime facts</span>
              <h2>Platform settings</h2>
            </div>
            <strong>{platform ? `Checked ${readableDate(platform.generatedAt)}` : "Unavailable"}</strong>
          </div>
          <p className="admin-section-copy">
            This page reports the configuration the server actually sees. It does not pretend
            to change Cloudflare, Resend, Stripe, or legal-policy settings.
          </p>
          {securityError ? (
            <p className="form-error" role="alert">{securityError}</p>
          ) : !platform ? (
            <p className="admin-note">Platform configuration could not be loaded.</p>
          ) : (
            <>
              <dl className="owner-settings-grid">
                <div><dt>Production site</dt><dd>{platform.siteUrl}</dd></div>
                <div><dt>Active service area</dt><dd>{platform.serviceArea}</dd></div>
                <div><dt>Customer service fee</dt><dd>{platform.customerServiceFeePercent}%</dd></div>
                <div><dt>Owner access protected</dt><dd>{yesNo(platform.ownerAccessProtected)}</dd></div>
                <div><dt>Email delivery configured</dt><dd>{yesNo(platform.emailDeliveryConfigured)}</dd></div>
                <div><dt>Email sender domain</dt><dd>{platform.emailSenderDomain || "Not configured"}</dd></div>
                <div><dt>Stripe connection configured</dt><dd>{yesNo(platform.stripeConfigured)}</dd></div>
                <div><dt>Stripe mode</dt><dd>{platform.stripeMode}</dd></div>
                <div><dt>Live payments enabled</dt><dd>{yesNo(platform.livePaymentsEnabled)}</dd></div>
                <div><dt>Session protection</dt><dd>{platform.sessionProtection}</dd></div>
              </dl>
              <div className="owner-policy-versions">
                <h3>Published policy versions</h3>
                <dl>
                  <div><dt>Terms</dt><dd>{platform.policyVersions.terms}</dd></div>
                  <div><dt>Customer agreement</dt><dd>{platform.policyVersions.customer}</dd></div>
                  <div><dt>Provider agreement</dt><dd>{platform.policyVersions.provider}</dd></div>
                  <div><dt>Privacy policy</dt><dd>{platform.policyVersions.privacy}</dd></div>
                  <div><dt>Payment policy</dt><dd>{platform.policyVersions.payments}</dd></div>
                </dl>
              </div>
              <p className="owner-live-money-note">
                Live money must remain off until the adult legal owner and qualified advisers
                complete the business, payments, refund, dispute, tax, and compliance review.
              </p>
            </>
          )}
        </section>
      )}
    </>
  );
}
