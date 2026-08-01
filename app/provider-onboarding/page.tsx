"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  PROVIDER_PRIVACY_ACKNOWLEDGMENT_TEXT,
  PROVIDER_TERMS_ACCEPTANCE_TEXT,
} from "../../lib/provider-policy-acceptance";
import { BrandMark } from "../components/tuveloz-icons";

type EvidenceSubmission = {
  id: string;
  status: string;
  submittedAt: string;
  expiresAt: string;
  reviewNotes: string;
  supersedesEvidenceId: string;
  scanStatus: string;
  scanLabel: string;
  scanUpdatedAt: string;
  downloadAllowed: boolean;
  expirationStatus: "not_applicable" | "current" | "expiring_soon" | "expired";
  expirationLabel: string;
  daysUntilExpiration: number | null;
  reminderStatus: string;
  reminderLabel: string;
};

type ProviderAppeal = {
  id: string;
  evidenceId: string;
  requestType: string;
  status: string;
  statement: string;
  submittedAt: string;
  dueAt: string;
  resolvedAt: string;
  resolutionNotes: string;
};

type DataRightsRequest = {
  id: string;
  requestType: string;
  status: string;
  submittedAt: string;
  dueAt: string;
  legalHold: string;
  completedAt: string;
  responseNotes: string;
};

type Requirement = {
  code: string;
  label: string;
  requiresExpiration: boolean;
  private: boolean;
  uploadAllowed: boolean;
  status: "accepted" | "under_review" | "needs_correction" | "rejected" | "expired" | "missing";
  submission: EvidenceSubmission | null;
};

type ServiceStatus = {
  code: string;
  label: string;
  description: string;
  status: string;
  statusLabel: string;
  canTakeJobs: false;
  reason: string;
  requirements: Requirement[];
};

type OnboardingResponse = {
  policy: {
    version: string;
    status: string;
    jurisdiction: string;
    marketplaceMode: string;
    notice: string;
  };
  provider: {
    id: string;
    name: string;
    email: string;
    applicationStatus: string;
    verificationStatus: string;
  };
  pathway: null | {
    code: string;
    label: string;
    providerLevel: string;
    providerLevelLabel: string;
    status: string;
    personId: string;
  };
  services: ServiceStatus[];
  agreements: Array<{
    key: string;
    title: string;
    href: string;
    requiredVersion: string;
    releaseStatus: string;
    acceptedForApplicationReview: boolean;
    eligibilityCurrent: boolean;
    current: boolean;
    acceptedAt: string;
  }>;
  appeals: ProviderAppeal[];
  dataRightsRequests: DataRightsRequest[];
  privacy: {
    storage: string;
    access: string;
    retention: string;
    deletion: string;
    prohibitedUploads: string;
  };
  allAgreementsCurrent: boolean;
  allAgreementsAcknowledgedForApplicationReview: boolean;
  allAgreementsEligibilityCurrent: boolean;
  guide: string[];
  error?: string;
};

function requirementIcon(status: Requirement["status"]) {
  if (status === "accepted") return "✓";
  if (status === "under_review") return "⏳";
  if (status === "expired") return "⚠";
  return "✕";
}

function requirementLabel(status: Requirement["status"]) {
  if (status === "accepted") return "Accepted";
  if (status === "under_review") return "Under review — still blocked";
  if (status === "needs_correction") return "Correction needed";
  if (status === "rejected") return "Not accepted — correction or appeal available";
  if (status === "expired") return "Expired — replacement required";
  return "Missing";
}

function readableStatus(value: string) {
  return value.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase());
}

function EvidenceUpload({
  requirement,
  serviceCode,
  supersedesEvidenceId = "",
  onUploaded,
}: {
  requirement: Requirement;
  serviceCode: string;
  supersedesEvidenceId?: string;
  onUploaded: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const formData = new FormData(event.currentTarget);
      formData.set("serviceCode", serviceCode);
      formData.set("requirementKey", requirement.code);
      if (supersedesEvidenceId) formData.set("supersedesEvidenceId", supersedesEvidenceId);
      const response = await fetch("/api/provider-evidence", {
        method: "POST",
        body: formData,
      });
      const result = await response.json().catch(() => ({})) as { error?: string; message?: string };
      if (!response.ok) throw new Error(result.error || "Unable to upload this evidence.");
      event.currentTarget.reset();
      setNotice(result.message || "Uploaded to the private quarantine for scanning and review.");
      await onUploaded();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to upload this evidence.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="provider-evidence-form" onSubmit={submit}>
      <label>
        Document
        <input
          accept="application/pdf,image/jpeg,image/png,image/webp"
          name="document"
          required
          type="file"
        />
        <small>
          Private PDF, JPG, PNG, or WebP; maximum 10 MB. The file stays quarantined
          until its malware scan reports clean.
        </small>
      </label>
      <label>
        Issuer or source
        <input maxLength={180} name="issuer" placeholder="Insurer, agency, school, or business" />
      </label>
      <label>
        Effective date
        <input name="effectiveAt" type="date" />
      </label>
      <label>
        Expiration date{requirement.requiresExpiration ? " (required)" : ""}
        <input name="expiresAt" required={requirement.requiresExpiration} type="date" />
      </label>
      <button className="button secondary" disabled={busy} type="submit">
        {busy
          ? "Uploading…"
          : supersedesEvidenceId
            ? "Upload corrected replacement"
            : "Upload for scanning and review"}
      </button>
      {error && <small className="form-error" role="alert">{error}</small>}
      {notice && <small className="portal-success" role="status">{notice}</small>}
    </form>
  );
}

function EvidenceAppealForm({
  evidenceId,
  onSubmitted,
}: {
  evidenceId: string;
  onSubmitted: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const formData = new FormData(event.currentTarget);
      const response = await fetch("/api/provider-onboarding", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "submit-evidence-appeal",
          evidenceId,
          statement: formData.get("statement"),
        }),
      });
      const result = await response.json().catch(() => ({})) as {
        error?: string;
        message?: string;
      };
      if (!response.ok) throw new Error(result.error || "Unable to submit this appeal.");
      event.currentTarget.reset();
      setNotice(result.message || "Appeal submitted for review.");
      await onSubmitted();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to submit this appeal.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="provider-evidence-form" onSubmit={submit}>
      <label style={{ gridColumn: "1 / -1" }}>
        Explain what should be reconsidered
        <textarea
          maxLength={2000}
          minLength={20}
          name="statement"
          placeholder="Identify the decision, explain why you believe it should change, and note any supporting information."
          required
          rows={5}
        />
      </label>
      <button className="button secondary" disabled={busy} type="submit">
        {busy ? "Submitting…" : "Submit appeal"}
      </button>
      <small>
        An appeal does not approve evidence or restore job access. The affected service
        remains blocked while the appeal is pending.
      </small>
      {error && <small className="form-error" role="alert">{error}</small>}
      {notice && <small className="portal-success" role="status">{notice}</small>}
    </form>
  );
}

function DataRightsRequestForm({ onSubmitted }: { onSubmitted: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const formData = new FormData(event.currentTarget);
      const response = await fetch("/api/provider-onboarding", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "submit-data-rights-request",
          requestType: formData.get("requestType"),
          details: formData.get("details"),
          identityVerificationAcknowledged:
            formData.get("identityVerificationAcknowledged") === "yes",
        }),
      });
      const result = await response.json().catch(() => ({})) as {
        error?: string;
        message?: string;
      };
      if (!response.ok) {
        throw new Error(result.error || "Unable to submit this privacy request.");
      }
      event.currentTarget.reset();
      setNotice(result.message || "Privacy request submitted.");
      await onSubmitted();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Unable to submit this privacy request.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="provider-evidence-form" onSubmit={submit}>
      <label>
        Request
        <select defaultValue="" name="requestType" required>
          <option disabled value="">Choose one</option>
          <option value="access">Access my provider data</option>
          <option value="correction">Correct my provider data</option>
          <option value="portability">Receive a portable copy</option>
          <option value="deletion">Delete eligible provider data</option>
        </select>
      </label>
      <label>
        Details
        <textarea maxLength={2000} minLength={10} name="details" required rows={5} />
      </label>
      <label className="policy-consent" style={{ gridColumn: "1 / -1" }}>
        <input
          name="identityVerificationAcknowledged"
          required
          type="checkbox"
          value="yes"
        />
        <span>
          I understand TUVELOZ may verify my identity and that deletion can exclude
          records that must be retained for security, fraud prevention, legal obligations,
          disputes, or an active legal hold.
        </span>
      </label>
      <button className="button secondary" disabled={busy} type="submit">
        {busy ? "Submitting…" : "Submit privacy request"}
      </button>
      {error && <small className="form-error" role="alert">{error}</small>}
      {notice && <small className="portal-success" role="status">{notice}</small>}
    </form>
  );
}

export default function ProviderOnboardingPage() {
  const [data, setData] = useState<OnboardingResponse | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [agreementBusy, setAgreementBusy] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch("/api/provider-onboarding", { cache: "no-store" });
    const result = await response.json().catch(() => ({})) as OnboardingResponse;
    if (response.status === 401) {
      window.location.replace("/account?role=provider");
      return;
    }
    if (!response.ok) throw new Error(result.error || "Unable to load provider onboarding.");
    setData(result);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load().catch((reason) => setError(
        reason instanceof Error ? reason.message : "Unable to load provider onboarding.",
      ));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function acceptAgreements(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAgreementBusy(true);
    setError("");
    setNotice("");
    try {
      const values = Object.fromEntries(new FormData(event.currentTarget).entries());
      const response = await fetch("/api/provider-onboarding", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "accept-current-agreements",
          signerName: values.signerName,
          signerTitle: values.signerTitle,
          termsBundleAccepted: values.termsBundleAccepted === "yes",
          privacyAcknowledged: values.privacyAcknowledged === "yes",
        }),
      });
      const result = await response.json().catch(() => ({})) as OnboardingResponse;
      if (!response.ok) throw new Error(result.error || "Unable to save the agreement acceptance.");
      setData(result);
      setNotice("Current agreement versions accepted and recorded.");
      event.currentTarget.reset();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to save the agreement acceptance.");
    } finally {
      setAgreementBusy(false);
    }
  }

  const trackedExpirations = data
    ? data.services.flatMap((service) => service.requirements.flatMap((requirement) => (
      requirement.submission?.expiresAt
        ? [{
          key: requirement.submission.id,
          serviceLabel: service.label,
          requirementLabel: requirement.label,
          submission: requirement.submission,
        }]
        : []
    )))
    : [];

  return (
    <main className="account-shell">
      <header className="account-header">
        <Link className="brand" href="/"><BrandMark /><span>Tuveloz</span></Link>
        <Link className="account-home-link" href="/account?role=provider">Provider account</Link>
      </header>
      <section className="account-main">
        <div className="account-welcome">
          <span className="account-kicker">Provider onboarding and service verification</span>
          <h1>Know exactly what is ready—and what is blocked.</h1>
          <p>
            TUVELOZ reviews evidence for each exact service. An upload, account approval, or status badge
            is not a promise of safety, quality, or outcome and does not waive TUVELOZ&apos;s own legal duties.
          </p>
          <p>
            <strong>TUVELOZ does not employ or train anybody.</strong> Applying, uploading a
            document, completing onboarding, or receiving a review result does not create employment,
            training, a job offer, wages, placement, customer jobs, or any promise of future work.
          </p>
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        {notice && <p className="portal-success" role="status">{notice}</p>}
        {!data && !error && <p className="admin-note">Loading your onboarding checklist…</p>}
        {data && (
          <div className="account-grid">
            <section className="account-card">
              <div className="account-card-heading">
                <div><span className="account-role">Policy v{data.policy.version}</span><h2>Launch protection is active</h2></div>
                <span className="account-count">✕</span>
              </div>
              <p className="form-error">{data.policy.notice}</p>
              <dl>
                <div><dt>Applicant</dt><dd>{data.provider.name} · {data.provider.email}</dd></div>
                <div><dt>Pathway</dt><dd>{data.pathway?.label || "Not recorded"}</dd></div>
                <div><dt>Level</dt><dd>{data.pathway?.providerLevelLabel || "Not recorded"}</dd></div>
                <div><dt>Application</dt><dd>{data.provider.applicationStatus}</dd></div>
                <div><dt>Evidence review</dt><dd>{data.provider.verificationStatus}</dd></div>
              </dl>
              <p>
                ✓ means a listed requirement was accepted. ✕ means the service cannot be used for a
                customer job. ⏳ means TUVELOZ received an item, but job access remains blocked.
              </p>
            </section>

            <section className="account-card">
              <div className="account-card-heading">
                <div><span className="account-role">Renewal controls</span><h2>Expiration and reminders</h2></div>
                <span className="account-count">{trackedExpirations.length}</span>
              </div>
              <p>
                Renewal reminders do not extend eligibility. A replacement remains blocked until
                its malware scan is clean and TUVELOZ separately accepts the evidence.
              </p>
              <div className="account-request-list">
                {trackedExpirations.length === 0 && (
                  <p>No submitted evidence with an expiration date is currently tracked.</p>
                )}
                {trackedExpirations.map((item) => (
                  <article
                    className="account-request"
                    key={`${item.key}:${item.serviceLabel}:${item.requirementLabel}`}
                  >
                    <span>
                      <strong>{item.requirementLabel}</strong>
                      <small>{item.serviceLabel}</small>
                      <small>{item.submission.expirationLabel}</small>
                      <small>{item.submission.reminderLabel}</small>
                      <small>Malware scan: {item.submission.scanLabel}</small>
                    </span>
                  </article>
                ))}
              </div>
            </section>

            <section className="account-card">
              <div className="account-card-heading">
                <div><span className="account-role">Corrections and appeals</span><h2>Decision status</h2></div>
                <span className="account-count">{data.appeals.length}</span>
              </div>
              <p>
                Upload a corrected replacement from the affected checklist item, or submit an appeal
                when a review is marked “Needs correction” or “Rejected.” An appeal is not approval,
                is not a background-report dispute process, and never restores access while a gate is unmet.
              </p>
              <div className="account-request-list">
                {data.appeals.length === 0 && <p>No evidence appeals have been submitted.</p>}
                {data.appeals.map((appeal) => (
                  <article className="account-request" key={appeal.id}>
                    <span>
                      <strong>{readableStatus(appeal.status)}</strong>
                      <small>Submitted {appeal.submittedAt}</small>
                      {appeal.dueAt && <small>Target response by {appeal.dueAt}</small>}
                      <small>{appeal.statement}</small>
                      {appeal.resolutionNotes && <small>Response: {appeal.resolutionNotes}</small>}
                    </span>
                  </article>
                ))}
              </div>
            </section>

            <section className="account-card">
              <div className="account-card-heading">
                <div><span className="account-role">Restricted documents</span><h2>Privacy, retention, and deletion</h2></div>
                <span className="account-count">Private</span>
              </div>
              <p>{data.privacy.storage}</p>
              <p>{data.privacy.access}</p>
              <p>{data.privacy.retention}</p>
              <p>{data.privacy.deletion}</p>
              <p className="form-error">{data.privacy.prohibitedUploads}</p>
              <div className="account-request-list">
                {data.dataRightsRequests.map((item) => (
                  <article className="account-request" key={item.id}>
                    <span>
                      <strong>{readableStatus(item.requestType)} · {readableStatus(item.status)}</strong>
                      <small>Submitted {item.submittedAt}</small>
                      {item.dueAt && <small>Target response by {item.dueAt}</small>}
                      {item.legalHold === "yes" && (
                        <small>A legal hold currently limits deletion; eligible data remains under review.</small>
                      )}
                      {item.completedAt && <small>Completed {item.completedAt}</small>}
                      {item.responseNotes && <small>Response: {item.responseNotes}</small>}
                    </span>
                  </article>
                ))}
              </div>
              <DataRightsRequestForm onSubmitted={load} />
            </section>

            <section className="account-card">
              <div className="account-card-heading">
                <div><span className="account-role">Easy provider guide</span><h2>Seven steps</h2></div>
                <span className="account-count">7</span>
              </div>
              <ol className="provider-onboarding-guide">
                {data.guide.map((step, index) => <li key={step}><strong>{index + 1}.</strong> {step}</li>)}
              </ol>
              <p>
                Never upload an SSN, Social Security card, passport, I-9, or other work-authorization
                document here. The employer keeps those records and uses the separate employer attestation workflow.
              </p>
            </section>

            <section className="account-card provider-service-status-card">
              <div className="account-card-heading">
                <div><span className="account-role">Exact service checklist</span><h2>Selected services</h2></div>
                <span className="account-count">{data.services.length}</span>
              </div>
              {data.services.length === 0 && <p>No exact services are on this application.</p>}
              <div className="account-request-list">
                {data.services.map((service) => (
                  <article className="account-request provider-onboarding-service" key={service.code}>
                    <div>
                      <span className="form-error"><strong>{service.statusLabel}</strong></span>
                      <h3>{service.label}</h3>
                      <p>{service.description}</p>
                      <small>{service.reason}</small>
                    </div>
                    {service.requirements.length > 0 ? (
                      <div className="provider-requirement-list">
                        {service.requirements.map((requirement) => (
                          <details key={requirement.code}>
                            <summary>
                              <strong>{requirementIcon(requirement.status)} {requirement.label}</strong>
                              <small>{requirementLabel(requirement.status)}</small>
                            </summary>
                            {requirement.submission && (
                              <div>
                                <p>
                                  Submitted {requirement.submission.submittedAt}.{" "}
                                  <strong>Malware scan: {requirement.submission.scanLabel}.</strong>{" "}
                                  {requirement.submission.expirationLabel}.{" "}
                                  {requirement.submission.reminderLabel}.
                                </p>
                                {requirement.submission.reviewNotes && (
                                  <p>Review note: {requirement.submission.reviewNotes}</p>
                                )}
                                {requirement.submission.downloadAllowed ? (
                                  <p>
                                    <a href={`/api/provider-evidence?id=${encodeURIComponent(requirement.submission.id)}`}>
                                      Download my clean private submission
                                    </a>
                                  </p>
                                ) : (
                                  <p className="form-error">
                                    This file is quarantined and cannot be opened or downloaded unless its
                                    malware scan reports clean. It cannot satisfy a requirement while blocked.
                                  </p>
                                )}
                                {data.appeals
                                  .filter((appeal) => appeal.evidenceId === requirement.submission?.id)
                                  .map((appeal) => (
                                    <p key={appeal.id}>
                                      Appeal {readableStatus(appeal.status)} · submitted {appeal.submittedAt}.
                                      {appeal.resolutionNotes ? ` Response: ${appeal.resolutionNotes}` : ""}
                                    </p>
                                  ))}
                                {["needs_correction", "rejected"].includes(requirement.submission.status)
                                  && !data.appeals.some((appeal) => (
                                    appeal.evidenceId === requirement.submission?.id
                                    && ["submitted", "under_review"].includes(appeal.status)
                                  )) && (
                                    <EvidenceAppealForm
                                      evidenceId={requirement.submission.id}
                                      onSubmitted={load}
                                    />
                                  )}
                              </div>
                            )}
                            {requirement.uploadAllowed ? (
                              <EvidenceUpload
                                requirement={requirement}
                                serviceCode={service.code}
                                supersedesEvidenceId={
                                  requirement.submission
                                  && (
                                    ["accepted", "needs_correction", "rejected", "expired"]
                                      .includes(requirement.submission.status)
                                    || requirement.submission.expirationStatus === "expiring_soon"
                                  )
                                    ? requirement.submission.id
                                    : ""
                                }
                                onUploaded={load}
                              />
                            ) : (
                              <p>
                                This item is created by the employer, supervisor, or TUVELOZ review workflow;
                                it cannot be satisfied by uploading personal work-authorization records.
                              </p>
                            )}
                          </details>
                        ))}
                      </div>
                    ) : (
                      <p>
                        This applicant-only selection has no upload checklist and provides no training or
                        customer jobs. Choose a provider pathway only when your independent business or
                        genuine employment relationship with a separate provider business is ready for review.
                      </p>
                    )}
                  </article>
                ))}
              </div>
            </section>

            <section className="account-card">
              <div className="account-card-heading">
                <div><span className="account-role">Application-review record</span><h2>Policy acknowledgments</h2></div>
                <span className="account-count">
                  {data.allAgreementsAcknowledgedForApplicationReview ? "✓" : "✕"}
                </span>
              </div>
              <p>
                Acknowledging a draft lets TUVELOZ review the application. It does not make the
                document active, approve any service, or allow customer jobs. If a policy is later
                released for job eligibility, the provider must affirmatively accept that released version.
              </p>
              <div className="account-request-list">
                {data.agreements.map((agreement) => (
                  <article className="account-request" key={agreement.key}>
                    <span>
                      <strong>
                        {agreement.acceptedForApplicationReview ? "✓" : "✕"}{" "}
                        <a href={agreement.href}>{agreement.title}</a>
                      </strong>
                      <small>Version {agreement.requiredVersion} · release status {agreement.releaseStatus}</small>
                      <small>
                        {agreement.acceptedForApplicationReview
                          ? `Acknowledged for application review ${agreement.acceptedAt}`
                          : "Application-review acknowledgment required"}
                      </small>
                      <small>
                        {agreement.eligibilityCurrent
                          ? "Active released agreement accepted for job eligibility"
                          : "Not current for job eligibility"}
                      </small>
                    </span>
                  </article>
                ))}
              </div>
              {!data.allAgreementsAcknowledgedForApplicationReview && (
                <form onSubmit={acceptAgreements}>
                  <label>Authorized signer name<input maxLength={120} name="signerName" required /></label>
                  <label>Signer title or capacity<input maxLength={100} name="signerTitle" required /></label>
                  <label className="policy-consent">
                    <input name="termsBundleAccepted" required type="checkbox" value="yes" />
                    <span>{PROVIDER_TERMS_ACCEPTANCE_TEXT}</span>
                  </label>
                  <label className="policy-consent">
                    <input name="privacyAcknowledged" required type="checkbox" value="yes" />
                    <span>{PROVIDER_PRIVACY_ACKNOWLEDGMENT_TEXT}</span>
                  </label>
                  <button className="button primary" disabled={agreementBusy} type="submit">
                    {agreementBusy ? "Recording…" : "Acknowledge displayed versions"}
                  </button>
                </form>
              )}
            </section>
          </div>
        )}
      </section>
    </main>
  );
}
