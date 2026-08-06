"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { ConfirmAction } from "../components/confirm-action";
import { StripePaymentAdmin } from "../components/stripe-payment-admin";
import {
  OwnerControlCenter,
  type AdminView,
  type OwnerPlatform,
  type OwnerUser,
} from "../components/owner-control-center";
import { BrandMark } from "../components/tuveloz-icons";
import {
  effectiveProviderServices,
  parseCustomerServiceLocations,
  parseProviderServices,
  parseProviderWorkLocations,
  providerMatchesArea,
  providerMatchesJob,
  providerMatchesServiceLocation,
  providerModeForWorkLocations,
} from "../../lib/service-matching";
import {
  evaluateProviderServices,
  getProviderLegalRequirementFlags,
  parseProviderSelfAssessment,
} from "../../lib/provider-compliance";
import { customerPriceFor } from "../../lib/customer-fee";
import {
  PROVIDER_CREDENTIAL_METHODS,
  PROVIDER_CREDENTIAL_STATUSES,
  providerCredentialRequirementsAreSatisfied,
  requiredProviderCredentialRequirements,
  type ProviderCredentialVerificationRecord,
} from "../../lib/provider-credentials";

type CustomerRequest = {
  id: string;
  name: string;
  email: string;
  zip: string;
  launchArea: string;
  municipality: string;
  isTestJob: string;
  vehicle: string;
  service: string;
  serviceLocations: string;
  serviceAddress: string;
  preferredProviderName: string;
  repeatOfRequestId: string;
  details: string;
  status: string;
  approvedAt: string;
  reminderSentAt: string;
  reminderLastAttemptAt: string;
  createdAt: string;
};

type ProviderApplication = {
  id: string;
  name: string;
  email: string;
  preferredLanguage: string;
  service: string;
  serviceArea: string;
  businessMunicipality: string;
  workLocations: string;
  businessServiceAddress: string;
  experience: string;
  insuranceStatus: string;
  insuranceExpiresAt: string;
  verificationStatus: string;
  isTestProvider: string;
  serviceRulesVersion: string;
  serviceRulesAcknowledgedAt: string;
  providerSelfAssessment: string;
  serviceEligibilityStatuses: string;
  approvedServices: string;
  verificationChecklist: string;
  verifiedAt: string;
  verifiedBy: string;
  alertsEnabled: string;
  status: string;
  createdAt: string;
  credentialVerifications: Array<ProviderCredentialVerificationRecord & { notes?: string }>;
};

type LaunchFeedback = {
  id: string;
  audience: string;
  featureWanted: string;
  problemToSolve: string;
  trustBuilder: string;
  email: string;
  status: string;
  createdAt: string;
};

type ExpansionInterest = {
  id: string;
  audience: "Customer" | "Provider" | "Both";
  providerType: string;
  locality: string;
  state: string;
  email: string;
  createdAt: string;
};

type ExpansionDemand = {
  locality: string;
  state: string;
  total: number;
  customers: number;
  providers: number;
  mobileProviders: number;
  contacts: string[];
};

type ProviderQuote = {
  id: string;
  requestId: string;
  providerName: string;
  providerEmail: string;
  priceCents: string;
  customerFeeRateBps: number;
  customerFeeCents: string;
  customerTotalCents: string;
  partType: string;
  availability: string;
  message: string;
  status: string;
  createdAt: string;
};
type PendingAdminAction = {
  kind: "request" | "provider";
  id: string;
  status: "approved" | "declined";
  title: string;
  message: string;
};

function customerPriceSnapshot(quote: ProviderQuote) {
  const providerQuoteCents = Number(quote.priceCents);
  const customerFeeCents = Number(quote.customerFeeCents);
  const customerTotalCents = Number(quote.customerTotalCents);
  if (
    Number.isFinite(customerFeeCents)
    && Number.isFinite(customerTotalCents)
    && customerTotalCents > 0
    && providerQuoteCents + customerFeeCents === customerTotalCents
  ) {
    return { customerFeeCents, customerTotalCents };
  }
  return customerPriceFor(providerQuoteCents, quote.customerFeeRateBps);
}

type VerificationChecklist = {
  businessIdentity: boolean;
  serviceExperience: boolean;
  stateRegistration: boolean;
  localRegistration: boolean;
  consumerRules: boolean;
  serviceRules: boolean;
};

type VerificationDraft = {
  checklist: VerificationChecklist;
  approvedServices: string[];
};

const emptyChecklist: VerificationChecklist = {
  businessIdentity: false,
  serviceExperience: false,
  stateRegistration: false,
  localRegistration: false,
  consumerRules: false,
  serviceRules: false,
};

function requiredChecklistLabels(
  services: string[],
  serviceArea: string,
): Array<[keyof VerificationChecklist, string]> {
  const requirements = getProviderLegalRequirementFlags(services, serviceArea);
  const labels: Array<[keyof VerificationChecklist, string]> = [];

  if (requirements.montgomeryRegistration) {
    labels.push([
      "localRegistration",
      "Required Montgomery County repair-registration proof received and verified",
    ]);
  }
  if (requirements.marylandCustomerPaperwork) {
    labels.push([
      "consumerRules",
      "Required customer authorization and invoice process verified",
    ]);
  }
  if (requirements.tintCompliance || requirements.washWaterCompliance) {
    labels.push([
      "serviceRules",
      requirements.tintCompliance && requirements.washWaterCompliance
        ? "Applicable tint and commercial wash-water rules confirmed"
        : requirements.tintCompliance
          ? "Applicable state tint limits confirmed"
          : "Required commercial wash-water disposal process confirmed",
    ]);
  }

  return labels;
}

function parseChecklist(value: string): VerificationChecklist {
  try {
    return { ...emptyChecklist, ...(JSON.parse(value) as Partial<VerificationChecklist>) };
  } catch {
    return { ...emptyChecklist };
  }
}

export default function AdminPage() {
  const [requests, setRequests] = useState<CustomerRequest[]>([]);
  const [providers, setProviders] = useState<ProviderApplication[]>([]);
  const [feedback, setFeedback] = useState<LaunchFeedback[]>([]);
  const [expansion, setExpansion] = useState<ExpansionInterest[]>([]);
  const [quotes, setQuotes] = useState<ProviderQuote[]>([]);
  const [users, setUsers] = useState<OwnerUser[]>([]);
  const [platform, setPlatform] = useState<OwnerPlatform | null>(null);
  const [activeAdminView, setActiveAdminView] = useState<AdminView>("jobs");
  const [alertStatus, setAlertStatus] = useState("");
  const [error, setError] = useState("");
  const [controlCenterError, setControlCenterError] = useState("");
  const [loading, setLoading] = useState(true);
  const [accessGranted, setAccessGranted] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAdminAction | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [verificationDrafts, setVerificationDrafts] = useState<Record<string, VerificationDraft>>({});
  const [verificationBusyId, setVerificationBusyId] = useState("");
  const [pendingVerificationId, setPendingVerificationId] = useState("");

  async function updateRequest(id: string, status: "approved" | "declined") {
    setError("");
    setAlertStatus("");
    const response = await fetch("/api/admin/requests", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    const result = (await response.json()) as {
      error?: string;
      approvedAt?: string;
      alerts?: { configured: boolean; attempted: number; sent: number; failures?: string[] } | null;
    };
    if (!response.ok) return setError(result.error || "Unable to update this request.");
    setRequests((items) => items.map((item) => item.id === id ? {
      ...item,
      status,
      ...(result.approvedAt ? { approvedAt: result.approvedAt } : {}),
    } : item));
    setPendingAction(null);
    if (status === "approved" && result.alerts) {
      const approvedRequest = requests.find((item) => item.id === id);
      if (approvedRequest?.isTestJob === "yes") {
        setAlertStatus("Test job approved. It is visible only to test providers, and no automatic emails were sent.");
      } else if (!result.alerts.configured) {
        setAlertStatus("Job approved. Automatic email alerts are waiting for the email-service connection.");
      } else if (result.alerts.attempted === 0) {
        setAlertStatus("Job approved. No approved providers currently match both its service and area.");
      } else if (result.alerts.sent < result.alerts.attempted) {
        setAlertStatus(
          `Job approved. ${result.alerts.sent} of ${result.alerts.attempted} matching provider alerts sent. ${result.alerts.failures?.[0] ?? "Check the email-service settings."}`,
        );
      } else {
        setAlertStatus(`Job approved. ${result.alerts.sent} of ${result.alerts.attempted} matching provider alerts sent.`);
      }
    }
  }

  async function updateProvider(id: string, status: "approved" | "declined") {
    setError("");
    const response = await fetch("/api/admin/providers", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(status === "approved" ? { id, action: "verify" } : { id, status }),
    });
    const result = (await response.json()) as {
      error?: string;
      serviceArea?: string;
      verificationStatus?: string;
    };
    if (!response.ok) return setError(result.error || "Unable to update this provider.");
    setProviders((items) => items.map((item) => (
      item.id === id ? {
        ...item,
        status,
        serviceArea: result.serviceArea ?? item.serviceArea,
        verificationStatus: result.verificationStatus ?? item.verificationStatus,
      } : item
    )));
    setPendingAction(null);
  }

  function updateVerificationDraft(
    providerId: string,
    update: (draft: VerificationDraft) => VerificationDraft,
  ) {
    setPendingVerificationId("");
    setVerificationDrafts((current) => ({
      ...current,
      [providerId]: update(current[providerId] ?? {
        checklist: { ...emptyChecklist },
        approvedServices: [],
      }),
    }));
  }

  async function saveVerification(providerId: string) {
    const draft = verificationDrafts[providerId];
    if (!draft) return;
    setError("");
    setVerificationBusyId(providerId);
    const response = await fetch("/api/admin/providers", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: providerId,
        action: "save-verification",
        checklist: draft.checklist,
        approvedServices: draft.approvedServices,
      }),
    });
    const result = (await response.json()) as {
      error?: string;
      verificationChecklist?: string;
      approvedServices?: string;
      verificationStatus?: string;
    };
    setVerificationBusyId("");
    setPendingVerificationId("");
    if (!response.ok) return setError(result.error || "Unable to save the compliance review.");
    setProviders((items) => items.map((item) => (
      item.id === providerId ? {
        ...item,
        verificationChecklist: result.verificationChecklist ?? item.verificationChecklist,
        approvedServices: result.approvedServices ?? item.approvedServices,
        verificationStatus: result.verificationStatus ?? item.verificationStatus,
      } : item
    )));
    setAlertStatus("Provider compliance checklist saved. Verification still requires the second confirmation.");
  }

  async function saveCredential(
    providerId: string,
    requirementKey: string,
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError("");
    setVerificationBusyId(providerId);
    const response = await fetch("/api/admin/providers", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: providerId,
        action: "save-credential",
        credential: {
          requirementKey,
          credentialIdentifier: String(form.get("credentialIdentifier") ?? ""),
          status: String(form.get("status") ?? ""),
          verificationMethod: String(form.get("verificationMethod") ?? ""),
          expiresAt: String(form.get("expiresAt") ?? ""),
          notes: String(form.get("notes") ?? ""),
        },
      }),
    });
    const result = await response.json() as {
      error?: string;
      credential?: ProviderCredentialVerificationRecord & { notes?: string };
    };
    setVerificationBusyId("");
    if (!response.ok || !result.credential) {
      return setError(result.error || "Unable to save the official credential check.");
    }
    const savedCredential = result.credential;
    setProviders((items) => items.map((item) => (
      item.id === providerId
        ? {
            ...item,
            credentialVerifications: [
              ...(item.credentialVerifications ?? []).filter(
                (credential) => credential.requirementKey !== requirementKey,
              ),
              savedCredential,
            ],
          }
        : item
    )));
    setAlertStatus(
      savedCredential.status === "verified"
        ? "Official credential check saved. Activation still requires every applicable check."
        : "Credential review status saved. This provider cannot be activated until every applicable credential is verified.",
    );
  }

  async function confirmPendingAction() {
    if (!pendingAction) return;
    setActionBusy(true);
    try {
      if (pendingAction.kind === "request") {
        await updateRequest(pendingAction.id, pendingAction.status);
      } else {
        await updateProvider(pendingAction.id, pendingAction.status);
      }
    } finally {
      setActionBusy(false);
    }
  }

  useEffect(() => {
    fetch("/api/admin", { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Unable to load dashboard.");
        setRequests(result.requests);
        const providerItems = result.providers as ProviderApplication[];
        setProviders(providerItems.map((provider) => ({
          ...provider,
          credentialVerifications: provider.credentialVerifications ?? [],
        })));
        setVerificationDrafts(Object.fromEntries(providerItems.map((provider) => [
          provider.id,
          {
            checklist: parseChecklist(provider.verificationChecklist),
            approvedServices: parseProviderServices(provider.approvedServices),
          },
        ])));
        setFeedback(result.feedback);
        setExpansion(result.expansion ?? []);
        setQuotes(result.quotes);
        setAccessGranted(true);
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Unable to load dashboard."))
      .finally(() => setLoading(false));

    fetch("/api/admin/control-center", { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json() as {
          users?: OwnerUser[];
          platform?: OwnerPlatform;
          error?: string;
        };
        if (!response.ok) {
          throw new Error(
            result.error || "Signed owner verification is required for account management.",
          );
        }
        setUsers(result.users ?? []);
        setPlatform(result.platform ?? null);
        setControlCenterError("");
      })
      .catch((reason) => {
        setControlCenterError(
          reason instanceof Error
            ? reason.message
            : "Signed owner verification is required for account management.",
        );
      });
  }, []);

  const expansionDemand = expansion
    .reduce<ExpansionDemand[]>((groups, item) => {
      const existing = groups.find((group) => (
        group.locality.toLowerCase() === item.locality.toLowerCase()
        && group.state === item.state
      ));
      if (existing) {
        existing.total += 1;
        if (item.audience === "Customer" || item.audience === "Both") existing.customers += 1;
        if (item.audience === "Provider" || item.audience === "Both") existing.providers += 1;
        if (item.providerType === "Mobile mechanic or service truck") existing.mobileProviders += 1;
        if (!existing.contacts.includes(item.email)) existing.contacts.push(item.email);
        return groups;
      }
      groups.push({
        locality: item.locality,
        state: item.state,
        total: 1,
        customers: item.audience === "Customer" || item.audience === "Both" ? 1 : 0,
        providers: item.audience === "Provider" || item.audience === "Both" ? 1 : 0,
        mobileProviders: item.providerType === "Mobile mechanic or service truck" ? 1 : 0,
        contacts: [item.email],
      });
      return groups;
    }, [])
    .sort((first, second) => (
      second.total - first.total
      || first.state.localeCompare(second.state)
      || first.locality.localeCompare(second.locality)
    ));
  const acceptedFeeCents = quotes
    .filter((quote) => quote.status === "accepted")
    .reduce((total, quote) => total + customerPriceSnapshot(quote).customerFeeCents, 0);
  const ownerMetrics = {
    jobRequests: requests.length,
    approvedJobs: requests.filter((item) => item.status === "approved").length,
    testJobs: requests.filter((item) => item.isTestJob === "yes").length,
    providerQuotes: quotes.length,
    acceptedQuotes: quotes.filter((quote) => quote.status === "accepted").length,
    providerApplications: providers.length,
    verifiedProviders: providers.filter((provider) => (
      provider.status === "approved"
      && provider.verificationStatus === "verified"
      && provider.isTestProvider !== "yes"
    )).length,
    expansionRequests: expansion.length,
    feedbackResponses: feedback.length,
    acceptedFeeCents,
  };

  if (!accessGranted && !error) return null;

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <Link className="brand" href="/"><BrandMark /><span>Tuveloz</span></Link>
        <div>
          <span>Private owner dashboard</span>
          <Link href="/admin/launch-readiness">Integrated launch review</Link>
          <Link href="/admin/analytics-funnel">Funnel, launch list &amp; AI</Link>
          <Link href="/admin/compliance-operations">Compliance operations</Link>
          <Link href="/admin/provider-compliance">Provider compliance queue</Link>
          <Link href="/">View site</Link>
        </div>
      </header>

      <section className="admin-intro">
        <span className="kicker">Owner control center</span>
        <h1>Tuveloz operations</h1>
        <p>Use focused owner-only views backed by stored Tuveloz records and connected service status.</p>
        {loading ? <p className="admin-note">Loading submissions…</p> : error ? (
          <p className="form-error" role="alert">{error}</p>
        ) : (
          <>
            {alertStatus && <p className="portal-success" role="status">{alertStatus}</p>}
            <div className="admin-stats">
              <article><strong>{requests.length}</strong><span>Job requests</span></article>
              <article><strong>{quotes.length}</strong><span>Provider quotes</span></article>
              <article><strong>${(acceptedFeeCents / 100).toFixed(2)}</strong><span>Accepted service fees</span></article>
              <article><strong>{providers.length}</strong><span>Provider applications</span></article>
              <article><strong>{expansion.length}</strong><span>Expansion requests</span></article>
              <article><strong>{feedback.length}</strong><span>Feedback responses</span></article>
            </div>
          </>
        )}
      </section>

      {!loading && !error && (
        <>
          <OwnerControlCenter
            activeView={activeAdminView}
            metrics={ownerMetrics}
            onSessionsRevoked={(email) => {
              setUsers((items) => items.map((item) => (
                item.email === email ? { ...item, activeSessionCount: 0 } : item
              )));
            }}
            onViewChange={setActiveAdminView}
            platform={platform}
            securityError={controlCenterError}
            users={users}
          />

          <section className="admin-section" hidden={activeAdminView !== "jobs"} id="owner-jobs">
            <h2>Customer job requests</h2>
            {requests.length === 0 ? <p className="admin-note">No requests yet.</p> : (
              <div className="admin-grid">
                {requests.map((item) => (
                  <article className="admin-card" key={item.id}>
                    <div className="admin-card-top"><span>{item.status}</span><time>{item.createdAt}</time></div>
                    <h3>{item.service}</h3>
                    {item.isTestJob === "yes" && <span className="test-badge">TEST JOB · NOT REAL</span>}
                    <p>{item.vehicle} · {item.launchArea || "Legacy pilot area"} · {item.municipality || `ZIP ${item.zip}`}</p>
                    <p>Service can happen: {parseCustomerServiceLocations(item.serviceLocations).join(" · ")}</p>
                    {item.preferredProviderName && (
                      <p className="request-reminder-status complete">
                        Repeat request for {item.preferredProviderName}
                      </p>
                    )}
                    {item.serviceAddress && <p>Private service address: {item.serviceAddress}</p>}
                    <blockquote>{item.details}</blockquote>
                    {item.status === "approved" && item.isTestJob === "yes" && (
                      <p className="request-reminder-status">Test job · automatic reminders disabled</p>
                    )}
                    {item.status === "approved"
                      && item.isTestJob !== "yes"
                      && quotes.some((quote) => quote.requestId === item.id) && (
                        <p className="request-reminder-status complete">Provider response received · reminder stopped</p>
                      )}
                    {item.status === "approved"
                      && item.isTestJob !== "yes"
                      && !quotes.some((quote) => quote.requestId === item.id)
                      && item.reminderSentAt && (
                        <p className="request-reminder-status complete">
                          No quote after 30 minutes · reminder sent {new Date(item.reminderSentAt).toLocaleString()}
                        </p>
                      )}
                    {item.status === "approved"
                      && item.isTestJob !== "yes"
                      && !quotes.some((quote) => quote.requestId === item.id)
                      && !item.reminderSentAt
                      && item.approvedAt && (
                        <p className="request-reminder-status">Automatic reminder scheduled after 30 minutes without a quote</p>
                      )}
                    {item.status === "approved"
                      && item.isTestJob !== "yes"
                      && !quotes.some((quote) => quote.requestId === item.id)
                      && !item.approvedAt && (
                        <p className="request-reminder-status">Legacy approved request · automatic reminder not scheduled</p>
                      )}
                    {item.status === "new" && pendingAction?.kind === "request" && pendingAction.id === item.id ? (
                      <div className="quote-confirm action-confirm" role="group" aria-label={pendingAction.title}>
                        <strong>{pendingAction.title}</strong>
                        <p>{pendingAction.message}</p>
                        <div>
                          <button className="button primary" disabled={actionBusy} onClick={confirmPendingAction}>
                            {actionBusy ? "Updating…" : "Yes, confirm"}
                          </button>
                          <button className="button secondary" disabled={actionBusy} onClick={() => setPendingAction(null)}>Go back</button>
                        </div>
                      </div>
                    ) : item.status === "new" && (
                      <div className="admin-actions">
                        <button onClick={() => setPendingAction({
                          kind: "request",
                          id: item.id,
                          status: "approved",
                          title: "Approve this customer request?",
                          message: item.preferredProviderName
                            ? `This will notify only ${item.preferredProviderName} for the customer's repeat request.`
                            : "This will notify matching providers and allow them to submit quotes.",
                        })}>Approve and notify</button>
                        <button onClick={() => setPendingAction({
                          kind: "request",
                          id: item.id,
                          status: "declined",
                          title: "Decline this customer request?",
                          message: "The request will not be shown to providers. Please confirm before continuing.",
                        })}>Decline</button>
                      </div>
                    )}
                    <div className="admin-contact"><strong>{item.name}</strong><a href={`mailto:${item.email}`}>{item.email}</a></div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="admin-section" hidden={activeAdminView !== "jobs"}>
            <h2>Quote management</h2>
            <p className="admin-section-copy">Review every price offered and see which provider the customer selected.</p>
            {quotes.length === 0 ? <p className="admin-note">No provider quotes yet.</p> : (
              <div className="admin-grid">
                {quotes.map((quote) => {
                  const job = requests.find((item) => item.id === quote.requestId);
                  const customerPrice = customerPriceSnapshot(quote);
                  return (
                    <article className={`admin-card quote-admin-card ${quote.status === "accepted" ? "is-accepted" : ""}`} key={quote.id}>
                      <div className="admin-card-top">
                        <span>{quote.status === "accepted" ? "Customer accepted" : quote.status}</span>
                        <time>{quote.createdAt}</time>
                      </div>
                      <div className="quote-admin-heading">
                        <div>
                          <h3>{quote.providerName}</h3>
                          <p>{job ? `${job.service} · ${job.vehicle}` : "Job request"}</p>
                        </div>
                        <div className="quote-admin-price">
                          <small>Customer total</small>
                          <strong>${(customerPrice.customerTotalCents / 100).toFixed(2)}</strong>
                          <span>
                            ${(Number(quote.priceCents) / 100).toFixed(2)} provider quote
                            {" "}+ ${(customerPrice.customerFeeCents / 100).toFixed(2)} fee
                          </span>
                        </div>
                      </div>
                      <p><b>Availability:</b> {quote.availability}</p>
                      <p><b>Parts:</b> {quote.partType === "Not specified" ? "Legacy quote — not labeled" : quote.partType}</p>
                      <blockquote>{quote.message}</blockquote>
                      <div className="admin-contact">
                        <span>{job ? `Customer: ${job.name}` : "Customer request unavailable"}</span>
                        <a href={`mailto:${quote.providerEmail}`}>{quote.providerEmail}</a>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          {activeAdminView === "payments" && <StripePaymentAdmin />}

          <section className="admin-section" hidden={activeAdminView !== "providers"} id="owner-provider-approvals">
            <h2>Provider applications</h2>
            <p className="admin-section-copy">
              Register and review every real applicant in the Provider Registration &amp; Compliance
              queue. This older view is retained for isolated fictional test providers only and
              cannot grant a real provider blanket approval. Tuveloz currently reviews applications
              only for Montgomery County, Maryland.
            </p>
            <div className="compliance-guides">
              <article>
                <span>Montgomery County, Maryland</span>
                <strong>State and county review</strong>
                <a href="https://mgaleg.maryland.gov/mgawebsite/Laws/StatuteText?article=gcl&enactments=false&section=14-1001" target="_blank" rel="noreferrer">Maryland repair-facility definition</a>
                <a href="https://mgaleg.maryland.gov/mgawebsite/laws/StatuteText?article=gcl&section=14-1002" target="_blank" rel="noreferrer">Estimate and authorization rules</a>
                <a href="https://mgaleg.maryland.gov/mgawebsite/laws/StatuteText?article=gcl&section=14-1008" target="_blank" rel="noreferrer">Customer authorization rights</a>
                <a href="https://www.montgomerycountymd.gov/office-consumer-protection/business-education-registration-unit-bear/motor-vehicle-repair-maintenance-towing" target="_blank" rel="noreferrer">County repair registration</a>
                <a href="https://mva.maryland.gov/your-mva-guide/businesses/inspection-stations-mechanics" target="_blank" rel="noreferrer">Official inspection licensing</a>
                <a href="https://www.montgomerycountymd.gov/DEP/property-care/car-care.html" target="_blank" rel="noreferrer">Commercial vehicle wash-water rules</a>
              </article>
            </div>
            {providers.length === 0 ? <p className="admin-note">No applications yet.</p> : (
              <div className="admin-grid">
                {providers.map((item) => {
                  const draft = verificationDrafts[item.id] ?? {
                    checklist: { ...emptyChecklist },
                    approvedServices: [],
                  };
                  const requestedServices = parseProviderServices(item.service);
                  const eligibilityStatuses = evaluateProviderServices(
                    requestedServices,
                    item.serviceArea,
                    parseProviderSelfAssessment(item.providerSelfAssessment),
                  );
                  const hasEligibilityGuide = Object.keys(eligibilityStatuses).length > 0;
                  const checklistLabels = requiredChecklistLabels(
                    draft.approvedServices,
                    item.serviceArea,
                  );
                  const savedApprovedServices = parseProviderServices(item.approvedServices);
                  const savedChecklistLabels = requiredChecklistLabels(
                    savedApprovedServices,
                    item.serviceArea,
                  );
                  const savedChecklist = parseChecklist(item.verificationChecklist);
                  const credentialRequirements = requiredProviderCredentialRequirements(
                    savedApprovedServices,
                    item.serviceArea,
                    parseProviderSelfAssessment(item.providerSelfAssessment),
                  );
                  const savedCredentials = item.credentialVerifications ?? [];
                  const savedCredentialsComplete = providerCredentialRequirementsAreSatisfied(
                    credentialRequirements,
                    savedCredentials,
                  );
                  const savedComplete = savedChecklistLabels.every(([key]) => savedChecklist[key])
                    && savedApprovedServices.length > 0
                    && savedCredentialsComplete;
                  const isVerified = item.verificationStatus === "verified";
                  const isTestProvider = item.isTestProvider === "yes";
                  if (!isTestProvider) {
                    return (
                      <article className="admin-card" key={item.id}>
                        <div className="admin-card-top">
                          <span>{item.status} · {item.verificationStatus}</span>
                          <time>{item.createdAt}</time>
                        </div>
                        <h3>{item.name}</h3>
                        <p>Requested services: {requestedServices.join(", ") || "No exact services recorded"}</p>
                        <p>
                          Real provider applications use the v0.11 relationship, evidence, agreement,
                          and exact-service rules. This legacy screen cannot approve or activate them.
                        </p>
                        <div className="admin-link-actions">
                          <Link href="/admin/provider-compliance">Open Provider Registration &amp; Compliance</Link>
                          <a href={`mailto:${item.email}`}>{item.email}</a>
                        </div>
                        {item.status === "new" && (
                          <button onClick={() => setPendingAction({
                            kind: "provider",
                            id: item.id,
                            status: "declined",
                            title: "Decline this provider?",
                            message: "The provider will remain blocked from workspace access, job alerts, and customer work.",
                          })}>Decline application</button>
                        )}
                        {pendingAction?.kind === "provider" && pendingAction.id === item.id && (
                          <div className="quote-confirm action-confirm" role="group" aria-label={pendingAction.title}>
                            <strong>{pendingAction.title}</strong>
                            <p>{pendingAction.message}</p>
                            <div>
                              <button className="button primary" disabled={actionBusy} onClick={confirmPendingAction}>
                                {actionBusy ? "Updating…" : "Yes, confirm"}
                              </button>
                              <button className="button secondary" disabled={actionBusy} onClick={() => setPendingAction(null)}>Go back</button>
                            </div>
                          </div>
                        )}
                      </article>
                    );
                  }
                  const matchingJobs = requests.filter((request) => (
                    request.status === "approved"
                    && providerMatchesJob(
                      effectiveProviderServices(item.service, item.approvedServices, item.isTestProvider),
                      request.service,
                    )
                    && providerMatchesArea(item.serviceArea, request.launchArea || request.zip)
                    && providerMatchesServiceLocation(item.workLocations, request.serviceLocations)
                    && isTestProvider === (request.isTestJob === "yes")
                  ));
                  const alertJob = matchingJobs[0];
                  const workspaceUrl = isVerified
                    ? "https://tuveloz.com/account?role=provider"
                    : "";
                  const alertHref = !isTestProvider && alertJob && workspaceUrl
                    ? `mailto:${item.email}?subject=${encodeURIComponent(`New Tuveloz ${alertJob.service} request`)}&body=${encodeURIComponent(`A new ${alertJob.service} request for ${alertJob.vehicle} is available in ${alertJob.launchArea || `ZIP ${alertJob.zip.slice(0, 5)}`}.\n\nService-location options: ${parseCustomerServiceLocations(alertJob.serviceLocations).join(" or ")}.\n\nReview and quote the job through your private provider workspace:\n${workspaceUrl}\n\nCustomer contact details and exact location remain private until a quote is selected.`)}`
                    : "";
                  return (
                  <article className="admin-card" key={item.id}>
                    <div className="admin-card-top"><span>{item.status} · {item.verificationStatus}</span><time>{item.createdAt}</time></div>
                    <h3>{item.name}</h3>
                    {isVerified && (
                      <span className="verified-badge">
                        ✓ Eligibility reviewed
                      </span>
                    )}
                    <span className="provider-mode-badge">
                      {providerModeForWorkLocations(item.workLocations)}
                    </span>
                    {isTestProvider && <span className="test-badge">TEST PROVIDER · NOT VERIFIED</span>}
                    <p>Requested services: {requestedServices.join(", ")} · {item.serviceArea}</p>
                    <p>
                      Approved for real jobs:{" "}
                      {parseProviderServices(item.approvedServices).join(", ") || "None saved yet"}
                    </p>
                    <p>
                      Preferred language: {item.preferredLanguage || "English"} · Legal requirements acknowledged:{" "}
                      {item.serviceRulesAcknowledgedAt
                        ? `${item.serviceRulesAcknowledgedAt.slice(0, 10)} (guide ${item.serviceRulesVersion})`
                        : "Legacy application — not recorded"}
                    </p>
                    <p>Business municipality: {item.businessMunicipality || "Not provided on legacy application"}</p>
                    <p>Customer meeting options: {parseProviderWorkLocations(item.workLocations).join(" · ")}</p>
                    {item.businessServiceAddress && (
                      <p>Private business meeting address: {item.businessServiceAddress}</p>
                    )}
                    {item.experience && <blockquote>{item.experience}</blockquote>}
                    {item.status !== "declined" && !isTestProvider && (
                      <div className="compliance-checklist">
                        <div>
                          <strong>Required legal verification</strong>
                          <span>
                            Select services below. Only the legal checks they trigger will appear here.
                          </span>
                        </div>
                        {checklistLabels.length === 0 && (
                          <p className="admin-link-note">
                            No checklist-only legal process is triggered by these draft selections.
                          </p>
                        )}
                        {checklistLabels.map(([key, label]) => (
                          <label key={key}>
                            <input
                              checked={draft.checklist[key]}
                              disabled={isVerified || verificationBusyId === item.id}
                              onChange={(event) => updateVerificationDraft(item.id, (current) => ({
                                ...current,
                                checklist: { ...current.checklist, [key]: event.target.checked },
                              }))}
                              type="checkbox"
                            />
                            {label}
                          </label>
                        ))}
                        <div className="service-approval-review">
                          <strong>Services approved after review</strong>
                          <span>
                            Select services after confirming the legal requirements that actually
                            apply. An action-required result means the provider reported a specific
                            legal requirement that is not yet satisfied.
                          </span>
                          {!hasEligibilityGuide && (
                            <p className="admin-link-note">
                              Legacy application: the guided eligibility answers were not recorded.
                              Complete a direct manual review before selecting any service.
                            </p>
                          )}
                          {requestedServices.map((service) => {
                            const eligibility = eligibilityStatuses[service];
                            const blocked = eligibility?.status === "blocked";
                            const statusLabel = eligibility?.status === "ready"
                              ? "Ready for owner review"
                              : eligibility?.status === "needs-review"
                                ? "Compliance review needed"
                                : eligibility?.status === "blocked"
                                  ? "Legal requirement not met"
                                  : "Manual review required";
                            return (
                              <div className={`service-approval-item ${eligibility?.status ?? "legacy"}`} key={service}>
                                <label>
                                  <input
                                    checked={draft.approvedServices.includes(service)}
                                    disabled={isVerified || verificationBusyId === item.id || blocked}
                                    onChange={(event) => updateVerificationDraft(item.id, (current) => ({
                                      ...current,
                                      approvedServices: event.target.checked
                                        ? [...new Set([...current.approvedServices, service])]
                                        : current.approvedServices.filter((itemService) => itemService !== service),
                                    }))}
                                    type="checkbox"
                                  />
                                  <span><strong>{service}</strong><small>{statusLabel}</small></span>
                                </label>
                                {eligibility?.reasons.map((reason) => <small key={reason}>{reason}</small>)}
                              </div>
                            );
                          })}
                        </div>
                        <div className="credential-review">
                          <div>
                            <strong>Official government credential checks</strong>
                            <span>
                              Requirements are derived from the saved services, service area, and
                              provider answers. Use an official record or direct issuing-authority
                              confirmation. Do not store Social Security numbers, driver-license
                              numbers, or unrelated private documents.
                            </span>
                          </div>
                          {savedApprovedServices.length === 0 ? (
                            <p className="admin-link-note">
                              Save at least one approved service before recording a credential check.
                            </p>
                          ) : credentialRequirements.length === 0 ? (
                            <p className="verification-record">
                              Eligibility reviewed — these saved services do not trigger a government
                              credential in the current Montgomery County launch rules.
                            </p>
                          ) : credentialRequirements.map((requirement) => {
                            const credential = savedCredentials.find(
                              (record) => record.requirementKey === requirement.key,
                            );
                            return (
                              <form
                                className="credential-card"
                                key={`${requirement.key}:${credential?.checkedAt ?? ""}:${credential?.status ?? ""}`}
                                onSubmit={(event) => saveCredential(item.id, requirement.key, event)}
                              >
                                <div>
                                  <strong>{requirement.label}</strong>
                                  <span>{requirement.jurisdiction} · {requirement.issuingAuthority}</span>
                                </div>
                                <p>{requirement.verificationGuidance}</p>
                                <div className="admin-link-actions">
                                  <a href={requirement.legalBasisUrl} target="_blank" rel="noreferrer">
                                    Official requirement
                                  </a>
                                  <a href={requirement.officialLookupUrl} target="_blank" rel="noreferrer">
                                    Official lookup
                                  </a>
                                </div>
                                <label>
                                  Exact official listing name or credential number
                                  <input
                                    defaultValue={credential?.credentialIdentifier ?? ""}
                                    name="credentialIdentifier"
                                    placeholder="Enter exactly what the official source shows"
                                    required
                                    type="text"
                                  />
                                </label>
                                <label>
                                  Review status
                                  <select defaultValue={credential?.status ?? "pending"} name="status">
                                    {PROVIDER_CREDENTIAL_STATUSES.map((status) => (
                                      <option key={status} value={status}>
                                        {status.replaceAll("-", " ")}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                                <label>
                                  Verification method
                                  <select
                                    defaultValue={credential?.verificationMethod ?? "official-online-record"}
                                    name="verificationMethod"
                                  >
                                    {PROVIDER_CREDENTIAL_METHODS.map((method) => (
                                      <option key={method} value={method}>
                                        {method.replaceAll("-", " ")}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                                <label>
                                  Expiration date, if the authority provides one
                                  <input defaultValue={credential?.expiresAt ?? ""} name="expiresAt" type="date" />
                                </label>
                                <label>
                                  Owner review note
                                  <textarea
                                    defaultValue={credential?.notes ?? ""}
                                    name="notes"
                                    placeholder="Record the source and any name-match details; avoid unnecessary personal data."
                                    rows={3}
                                  />
                                </label>
                                {credential?.checkedAt && (
                                  <p className="verification-record">
                                    Last verified {new Date(credential.checkedAt).toLocaleDateString()}
                                  </p>
                                )}
                                <button
                                  className="save-compliance"
                                  disabled={verificationBusyId === item.id}
                                  type="submit"
                                >
                                  {verificationBusyId === item.id ? "Saving…" : "Save official check"}
                                </button>
                              </form>
                            );
                          })}
                        </div>
                        {!isVerified && (pendingVerificationId === item.id ? (
                          <ConfirmAction
                            busy={verificationBusyId === item.id}
                            confirmLabel="Confirm and save checklist"
                            message="Review every selected service and legal check before saving this compliance record."
                            onBack={() => setPendingVerificationId("")}
                            onConfirm={() => saveVerification(item.id)}
                            title="Save this compliance checklist?"
                          />
                        ) : (
                          <button
                            className="save-compliance"
                            disabled={verificationBusyId === item.id}
                            onClick={() => setPendingVerificationId(item.id)}
                            type="button"
                          >
                            {verificationBusyId === item.id ? "Saving…" : "Save compliance checklist"}
                          </button>
                        ))}
                        {isVerified && (
                          <p className="verification-record">
                            Verified {item.verifiedAt ? new Date(item.verifiedAt).toLocaleDateString() : ""}
                          </p>
                        )}
                      </div>
                    )}
                    {pendingAction?.kind === "provider" && pendingAction.id === item.id ? (
                      <div className="quote-confirm action-confirm" role="group" aria-label={pendingAction.title}>
                        <strong>{pendingAction.title}</strong>
                        <p>{pendingAction.message}</p>
                        <div>
                          <button className="button primary" disabled={actionBusy} onClick={confirmPendingAction}>
                            {actionBusy ? "Updating…" : "Yes, confirm"}
                          </button>
                          <button className="button secondary" disabled={actionBusy} onClick={() => setPendingAction(null)}>Go back</button>
                        </div>
                      </div>
                    ) : !isVerified && !isTestProvider && item.status !== "declined" && (
                      <div className="admin-actions">
                        <button disabled={!savedComplete} onClick={() => setPendingAction({
                          kind: "provider",
                          id: item.id,
                          status: "approved",
                          title: "Verify and activate this provider?",
                          message: "This grants private workspace access and matching job alerts for the saved approved services. The public profile will show only exact current credential checks or that no government credential was triggered. Confirm that every saved record is accurate.",
                        })}>{item.status === "approved" ? "Activate after eligibility review" : "Approve after eligibility review"}</button>
                        {item.status === "new" && (
                          <button onClick={() => setPendingAction({
                            kind: "provider",
                            id: item.id,
                            status: "declined",
                            title: "Decline this provider?",
                            message: "The provider will not receive workspace access, job alerts, or a public eligibility record.",
                          })}>Decline</button>
                        )}
                        {!savedComplete && (
                          <span className="admin-link-note">
                            Save at least one approved service, every applicable checklist item, and
                            every legally triggered official credential check before activation.
                          </span>
                        )}
                      </div>
                    )}
                    {(isVerified || isTestProvider) && item.status === "approved" && alertHref && (
                      <div className="admin-link-actions">
                        <a href={alertHref}>Email matching-job alert</a>
                      </div>
                    )}
                    {(isVerified || isTestProvider) && item.status === "approved" && (
                      <p className="admin-link-note">
                        {matchingJobs.length} matching approved {isTestProvider ? "test " : ""}
                        {matchingJobs.length === 1 ? "job" : "jobs"} in this provider&apos;s service area.
                        {isTestProvider ? " Automatic emails are disabled." : ""}
                      </p>
                    )}
                    <div className="admin-contact"><a href={`mailto:${item.email}`}>{item.email}</a></div>
                  </article>
                  );
                })}
              </div>
            )}
          </section>

          <section className="admin-section" hidden={activeAdminView !== "reports"} id="owner-reports">
            <h2>Expansion demand</h2>
            <p className="admin-section-copy">
              Areas are ranked by unique people, with customer and provider
              interest shown separately.
            </p>
            {expansionDemand.length === 0 ? (
              <p className="admin-note">No expansion requests yet.</p>
            ) : (
              <div className="admin-grid expansion-demand-grid">
                {expansionDemand.map((area) => (
                  <article className="admin-card expansion-demand-card" key={`${area.state}-${area.locality}`}>
                    <div className="admin-card-top">
                      <span>{area.total} {area.total === 1 ? "person" : "people"}</span>
                    </div>
                    <h3>{area.locality}</h3>
                    <p>{area.state}</p>
                    <div className="expansion-demand-counts">
                      <span><strong>{area.customers}</strong> customer interest</span>
                      <span><strong>{area.providers}</strong> provider interest</span>
                      <span><strong>{area.mobileProviders}</strong> mobile mechanic/service-truck interest</span>
                    </div>
                    <details className="expansion-contacts">
                      <summary>View contact emails</summary>
                      <ul>
                        {area.contacts.map((email) => (
                          <li key={email}><a href={`mailto:${email}`}>{email}</a></li>
                        ))}
                      </ul>
                    </details>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="admin-section" hidden={activeAdminView !== "reports"}>
            <h2>Tuveloz feedback</h2>
            {feedback.length === 0 ? <p className="admin-note">No feedback yet.</p> : (
              <div className="admin-grid">
                {feedback.map((item) => (
                  <article className="admin-card" key={item.id}>
                    <div className="admin-card-top"><span>{item.audience}</span><time>{item.createdAt}</time></div>
                    <h3>Jobs or services requested</h3>
                    <blockquote>{item.featureWanted}</blockquote>
                    <h3>Provider tools requested</h3>
                    <p>{item.problemToSolve}</p>
                    <h3>Customer improvements requested</h3>
                    <p>{item.trustBuilder}</p>
                    {item.email && <div className="admin-contact"><a href={`mailto:${item.email}`}>{item.email}</a></div>}
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}
