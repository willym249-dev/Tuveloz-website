"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { BrandMark } from "../../components/tuveloz-icons";

type RequirementStatus =
  | "accepted"
  | "pending"
  | "needs_correction"
  | "expired"
  | "rejected"
  | "missing"
  | "required_per_job";

type EvidenceMetadata = {
  id: string;
  personId: string;
  requirementKey: string;
  serviceCode: string;
  jurisdiction: string;
  evidenceType: string;
  contentType: string;
  issuer: string;
  effectiveAt: string;
  expiresAt: string;
  status: string;
  submittedAt: string;
  reviewedAt: string;
  reviewedBy: string;
  reviewDecisionId: string;
  reasonCodes: string[];
  reviewNotes: string;
  businessIdentitySourceEligible: boolean;
  verifiedLegalBusinessName: string;
  authenticityVerificationMethod: string;
  authenticityVerifiedBy: string;
  authenticityVerificationReference: string;
  authenticitySourceUrl: string;
  authenticityVerifiedAt: string;
  authenticityValidThrough: string;
  supersedesEvidenceId: string;
  hasPrivateFile: boolean;
  scanStatus: string;
  scanProvider: string;
  scanEngineVersion: string;
  scanCompletedAt: string;
  scanReviewedBy: string;
};

type ServiceEvaluation = {
  code: string;
  label: string;
  status: "eligible" | "blocked";
  reasons: string[];
  requirements: Array<{
    code: string;
    label: string;
    status: RequirementStatus;
    baseEligibilityBlocking: boolean;
    submission: EvidenceMetadata | null;
  }>;
  activation: null | {
    id: string;
    decision: string;
    decisionVersion: number;
    validThrough: string;
    activationEvidenceComplete: boolean;
    live: boolean;
  };
  validThrough: string;
};

type ProviderApplication = {
  id: string;
  name: string;
  email: string;
  preferredLanguage: string;
  legacyRequestedServices: string;
  selectedServices: string[];
  serviceArea: string;
  businessMunicipality: string;
  experience: string;
  applicationStatus: string;
  verificationStatus: string;
  isTestProvider: string;
  serviceRulesVersion: string;
  createdAt: string;
  profile: null | {
    id: string;
    personId: string;
    pathway: string;
    providerLevel: string;
    sponsorProviderId: string;
    status: string;
    policyVersion: string;
    pathwayVersion: number;
    holdReasonCodes: string[];
    effectiveAt: string;
    validThrough: string;
  };
  personnel: Array<{
    personId: string;
    relationshipType: string;
    personnelRole: string;
    providerLevel: string;
    status: string;
    identityVerifiedAt: string;
    ageVerifiedAt: string;
    identityVerificationProvider: string;
    identityVerificationReference: string;
    identityVerificationCheckedAt: string;
    identityVerificationValidThrough: string;
    ageVerificationProvider: string;
    ageVerificationReference: string;
    ageVerificationCheckedAt: string;
    ageVerificationValidThrough: string;
    employmentStartedAt: string;
    employerAttestedAt: string;
    workAuthorizationAttestedAt: string;
    lawfulPayAttestedAt: string;
    employerAttestedByPersonId: string;
  }>;
  agreements: Array<{
    key: string;
    title: string;
    href: string;
    requiredVersion: string;
    current: boolean;
    acceptedAt: string;
    acceptedByName: string;
    acceptedByTitle: string;
  }>;
  allAgreementsCurrent: boolean;
  evidence: EvidenceMetadata[];
  services: ServiceEvaluation[];
  eligibleServices: string[];
  canInitializeV011: boolean;
};

type Catalog = {
  pathways: Array<{
    code: string;
    label: string;
    description: string;
    allowedLevels: string[];
  }>;
  levels: Array<{
    code: string;
    label: string;
    description: string;
    allowedServiceCodes: string[];
  }>;
  services: Array<{
    code: string;
    label: string;
    description: string;
    allowedPathways: string[];
    allowedProviderLevels: string[];
    launchState: string;
  }>;
};

type ComplianceResponse = {
  policy: {
    version: string;
    status: string;
    jurisdiction: string;
    rulesEngineVersion: string;
    defaultPolicy: string;
    marketplaceMode: string;
    notice: string;
  };
  catalog: Catalog;
  platformServices: Array<{
    code: string;
    label: string;
    launchState: string;
    decision: string;
    decisionVersion: number;
    validThrough: string;
    decidedAt: string;
    decidedBy: string;
    live: boolean;
    activationEvidenceComplete: boolean;
    legalRequirementsServiceCode: string;
    legalRequirementsJurisdiction: string;
    legalRequirementsReference: string;
    legalRequirementsValidThrough: string;
    officialSourceCount: number;
    legalProfessionalReviewStatus: string;
    requiredOfficialSourceReferences: string[];
    insurerReference: string;
    insurerValidThrough: string;
  }>;
  applications: ProviderApplication[];
  error?: string;
};

type InitializeDraft = {
  pathway: string;
  providerLevel: string;
  serviceCodes: string[];
};

const REVIEW_REASONS = [
  ["owner_evidence_accepted", "Evidence accepted"],
  ["unreadable_or_incomplete", "Unreadable or incomplete"],
  ["expired_or_invalid_date", "Expired or invalid date"],
  ["name_or_scope_mismatch", "Name or scope mismatch"],
  ["issuer_or_authority_unverified", "Issuer or authority not verified"],
  ["coverage_or_limit_mismatch", "Coverage or limit mismatch"],
  ["wrong_document_type", "Wrong document type"],
  ["other_documented_issue", "Other documented issue"],
] as const;

function prettify(value: string) {
  return value.replaceAll("_", " ").replaceAll(":", ": ");
}

function statusIcon(status: RequirementStatus | "eligible" | "blocked") {
  if (status === "accepted" || status === "eligible") return "✓";
  if (status === "pending" || status === "required_per_job") return "◷";
  return "✕";
}

function statusLabel(status: RequirementStatus) {
  if (status === "accepted") return "Accepted";
  if (status === "pending") return "Under review — still blocked";
  if (status === "needs_correction") return "Correction needed";
  if (status === "expired") return "Expired";
  if (status === "rejected") return "Rejected";
  if (status === "required_per_job") return "Required for each job";
  return "Missing";
}

function EvidenceReviewForm({
  applicationId,
  evidence,
  busy,
  onSubmit,
}: {
  applicationId: string;
  evidence: EvidenceMetadata;
  busy: boolean;
  onSubmit: (payload: Record<string, unknown>) => Promise<void>;
}) {
  const fileIsClean = !evidence.hasPrivateFile || evidence.scanStatus === "clean";
  const [status, setStatus] = useState<"accepted" | "needs_correction" | "rejected">(
    evidence.status === "needs_correction" || evidence.status === "rejected"
      ? evidence.status
      : fileIsClean ? "accepted" : "needs_correction",
  );
  const availableReasons = status === "accepted"
    ? REVIEW_REASONS.slice(0, 1)
    : REVIEW_REASONS.slice(1);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    await onSubmit({
      action: "review-evidence",
      providerId: applicationId,
      evidenceId: evidence.id,
      status,
      reasonCode: values.reasonCode,
      notes: values.notes,
      authenticityVerificationMethod: values.authenticityVerificationMethod,
      authenticityVerifiedBy: values.authenticityVerifiedBy,
      authenticityVerificationReference: values.authenticityVerificationReference,
      authenticitySourceUrl: values.authenticitySourceUrl,
      authenticityVerifiedAt: values.authenticityVerifiedAt,
      authenticityValidThrough: values.authenticityValidThrough,
      verifiedLegalBusinessName: values.verifiedLegalBusinessName,
      legalBusinessNameConfirmed: values.legalBusinessNameConfirmed === "yes",
    });
  }

  async function submitScan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    await onSubmit({
      action: "record-evidence-scan",
      providerId: applicationId,
      evidenceId: evidence.id,
      scanStatus: values.scanStatus,
      scanProvider: values.scanProvider,
      scanEngineVersion: values.scanEngineVersion,
      reviewNotes: values.reviewNotes,
      explicitConfirmation: values.explicitConfirmation === "yes",
    });
  }

  return (
    <div className="credential-card">
      <div>
        <strong>{prettify(evidence.requirementKey)}</strong>
        <span>{evidence.serviceCode} · submitted {evidence.submittedAt}</span>
      </div>
      <p>
        Issuer: {evidence.issuer || "Not supplied"}
        {evidence.effectiveAt ? ` · effective ${evidence.effectiveAt}` : ""}
        {evidence.expiresAt ? ` · expires ${evidence.expiresAt}` : ""}
      </p>
      {evidence.authenticityVerificationMethod && (
        <p className="verification-record">
          Authenticity: {prettify(evidence.authenticityVerificationMethod)} by {evidence.authenticityVerifiedBy}
          {` | checked ${evidence.authenticityVerifiedAt} | valid through ${evidence.authenticityValidThrough}`}
          {evidence.authenticityVerificationReference
            ? ` | reference ${evidence.authenticityVerificationReference}`
            : ""}
        </p>
      )}
      {evidence.verifiedLegalBusinessName && (
        <p className="verification-record">
          Verified legal business name: {evidence.verifiedLegalBusinessName}
        </p>
      )}
      {evidence.hasPrivateFile && fileIsClean ? (
        <a
          className="button secondary"
          href={`/api/admin/provider-compliance?evidenceId=${encodeURIComponent(evidence.id)}`}
          rel="noreferrer"
          target="_blank"
        >
          Open private evidence
        </a>
      ) : evidence.hasPrivateFile ? (
        <p className="form-error">
          File quarantined. Latest scan: {prettify(evidence.scanStatus || "missing")}.
          It cannot be opened or accepted.
        </p>
      ) : (
        <p>Structured attestation only; no file or sensitive identity record is stored.</p>
      )}
      {evidence.hasPrivateFile && (
        <form className="credential-card" onSubmit={submitScan}>
          <strong>Record an external non-clean result or operational hold</strong>
          <p>
            Clean results can arrive only through the signed scanner callback for this exact
            stored file hash. Looking at the file yourself is not a malware scan. Use this
            owner form only to keep a file blocked after a documented failed, infected, or error result.
          </p>
          <label>
            Result
            <select name="scanStatus" defaultValue="failed">
              <option value="infected">Threat detected</option>
              <option value="failed">Scan failed</option>
              <option value="error">Scanner error</option>
            </select>
          </label>
          <label>
            Scanner/provider
            <input name="scanProvider" placeholder="Vendor or scanner name" required />
          </label>
          <label>
            Engine/signature version
            <input name="scanEngineVersion" placeholder="Exact engine and signature/version" required />
          </label>
          <label>
            Restricted report reference and notes
            <textarea
              name="reviewNotes"
              placeholder="External report or ticket reference; do not paste secrets or unnecessary personal data"
              required
              rows={3}
            />
          </label>
          <label className="policy-check">
            <input name="explicitConfirmation" type="checkbox" value="yes" required />
            <span>I confirm this result came from the named external scanner for this exact stored file.</span>
          </label>
          <button className="save-compliance" disabled={busy} type="submit">
            {busy ? "Recording…" : "Record external scan result"}
          </button>
        </form>
      )}
      <form className="credential-card" onSubmit={submit}>
        <label>
          Evidence decision
          <select value={status} onChange={(event) => setStatus(event.target.value as typeof status)}>
            <option disabled={!fileIsClean} value="accepted">Accept this exact evidence</option>
            <option value="needs_correction">Needs correction</option>
            <option value="rejected">Reject</option>
          </select>
        </label>
        <label>
          Controlled reason
          <select key={status} name="reasonCode">
            {availableReasons.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label>
          Review note {status === "accepted" ? "(optional)" : "(required)"}
          <textarea
            defaultValue={evidence.reviewNotes}
            name="notes"
            placeholder="Record what matched or what the provider must correct. Do not copy unnecessary personal data."
            required={status !== "accepted"}
            rows={3}
          />
        </label>
        {status === "accepted" && (
          <fieldset className="credential-card">
            <legend>Required external authenticity check</legend>
            <p>
              Do not accept an upload from appearance alone. Confirm it through the official
              authority, issuing organization, insurer or broker, or an approved verification
              vendor. Official online lookups require an HTTPS .gov source; every other method
              requires a secure HTTPS source.
            </p>
            <label>
              Verification method
              <select
                defaultValue={evidence.authenticityVerificationMethod || ""}
                name="authenticityVerificationMethod"
                required
              >
                <option disabled value="">Choose the external method</option>
                <option value="official_online_lookup">Official online lookup</option>
                <option value="issuer_direct_confirmation">Issuer direct confirmation</option>
                <option value="insurer_or_broker_confirmation">Insurer or broker confirmation</option>
                <option value="approved_verification_vendor">Approved verification vendor</option>
              </select>
            </label>
            <label>
              Verified by
              <input
                defaultValue={evidence.authenticityVerifiedBy}
                name="authenticityVerifiedBy"
                placeholder="Name or team that performed the external check"
                required
              />
            </label>
            <label>
              External result or case reference
              <input
                defaultValue={evidence.authenticityVerificationReference}
                minLength={8}
                name="authenticityVerificationReference"
                placeholder="Lookup result, issuer case, insurer reference, or vendor result"
                required
              />
            </label>
            <label>
              Secure source URL
              <input
                defaultValue={evidence.authenticitySourceUrl}
                name="authenticitySourceUrl"
                placeholder="https://..."
                required
                type="url"
              />
            </label>
            <label>
              Checked date
              <input
                defaultValue={evidence.authenticityVerifiedAt.slice(0, 10)}
                max={new Date().toISOString().slice(0, 10)}
                name="authenticityVerifiedAt"
                required
                type="date"
              />
            </label>
            <label>
              Authenticity valid through
              <input
                defaultValue={evidence.authenticityValidThrough.slice(0, 10)}
                min={new Date().toISOString().slice(0, 10)}
                name="authenticityValidThrough"
                required
                type="date"
              />
            </label>
            {evidence.businessIdentitySourceEligible && (
              <>
                <label>
                  Exact legal business name on the verified source
                  <input
                    defaultValue={evidence.verifiedLegalBusinessName}
                    maxLength={180}
                    minLength={2}
                    name="verifiedLegalBusinessName"
                    placeholder="Enter the complete name exactly as verified"
                    required
                  />
                </label>
                <label className="policy-check">
                  <input name="legalBusinessNameConfirmed" required type="checkbox" value="yes" />
                  <span>
                    I confirm this exact legal business name appears in or was directly
                    confirmed for this external source; it is not copied only from the application.
                  </span>
                </label>
              </>
            )}
          </fieldset>
        )}
        <button
          className="save-compliance"
          disabled={busy || (status === "accepted" && !fileIsClean)}
          type="submit"
        >
          {busy ? "Saving…" : "Save evidence decision"}
        </button>
      </form>
    </div>
  );
}

export default function ProviderCompliancePage() {
  const [data, setData] = useState<ComplianceResponse | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyKey, setBusyKey] = useState("");
  const [initializeDrafts, setInitializeDrafts] = useState<Record<string, InitializeDraft>>({});

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/provider-compliance", { cache: "no-store" });
    const result = await response.json().catch(() => ({})) as ComplianceResponse;
    if (!response.ok) throw new Error(result.error || "Unable to load provider compliance.");
    setData(result);
    setInitializeDrafts((current) => {
      const next = { ...current };
      for (const application of result.applications) {
        if (!application.canInitializeV011 || next[application.id]) continue;
        const pathway = result.catalog.pathways[0]?.code ?? "independent_startup";
        const providerLevel = result.catalog.pathways[0]?.allowedLevels.find((level) => level !== "learning_account")
          ?? "provisional_independent";
        next[application.id] = { pathway, providerLevel, serviceCodes: [] };
      }
      return next;
    });
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load().catch((reason) => setError(
        reason instanceof Error ? reason.message : "Unable to load provider compliance.",
      ));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function submitAction(payload: Record<string, unknown>, key: string) {
    setBusyKey(key);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/provider-compliance", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({})) as { error?: string; message?: string };
      if (!response.ok) throw new Error(result.error || "Unable to save this decision.");
      setNotice(result.message || "Compliance decision saved.");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to save this decision.");
    } finally {
      setBusyKey("");
    }
  }

  const pendingEvidenceCount = useMemo(() => data?.applications.reduce(
    (total, application) => total + application.evidence.filter((item) => item.status === "pending").length,
    0,
  ) ?? 0, [data]);
  const eligibleProviderCount = useMemo(() => data?.applications.filter(
    (application) => application.eligibleServices.length > 0,
  ).length ?? 0, [data]);
  const liveServiceCount = useMemo(() => data?.platformServices.filter((service) => service.live).length ?? 0, [data]);

  function updateInitializeDraft(providerId: string, update: (draft: InitializeDraft) => InitializeDraft) {
    setInitializeDrafts((current) => ({
      ...current,
      [providerId]: update(current[providerId] ?? {
        pathway: "independent_startup",
        providerLevel: "provisional_independent",
        serviceCodes: [],
      }),
    }));
  }

  async function initializeApplication(application: ProviderApplication) {
    const draft = initializeDrafts[application.id];
    if (!draft) return;
    await submitAction({
      action: "initialize-provider-pathway",
      providerId: application.id,
      pathway: draft.pathway,
      providerLevel: draft.providerLevel,
      serviceCodes: draft.serviceCodes,
    }, `initialize:${application.id}`);
  }

  async function submitActivation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    await submitAction({
      action: "activate-service",
      serviceCode: values.serviceCode,
      jurisdiction: data?.policy.jurisdiction,
      validThrough: values.validThrough,
      legalRequirementsReviewedAt: values.legalRequirementsReviewedAt,
      legalRequirementsValidThrough: values.legalRequirementsValidThrough,
      legalRequirementsReviewedBy: values.legalRequirementsReviewedBy,
      legalRequirementsReference: values.legalRequirementsReference,
      applicableRequirementsSummary: values.applicableRequirementsSummary,
      officialSourceReferences: values.officialSourceReferences,
      legalProfessionalReviewStatus: values.legalProfessionalReviewStatus,
      ownerLegalComplianceAcknowledged: values.ownerLegalComplianceAcknowledged === "yes",
      explicitProceedingWithoutCounsel: values.explicitProceedingWithoutCounsel === "yes",
      insurerApprovedAt: values.insurerApprovedAt,
      insurerValidThrough: values.insurerValidThrough,
      insurerApprovedBy: values.insurerApprovedBy,
      insurerReference: values.insurerReference,
      explicitConfirmation: values.explicitConfirmation === "yes",
    }, "activate-service");
  }

  async function submitDisable(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    await submitAction({
      action: "disable-service",
      serviceCode: values.serviceCode,
      jurisdiction: data?.policy.jurisdiction,
      reason: values.reason,
      explicitConfirmation: values.explicitConfirmation === "yes",
    }, "disable-service");
  }

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <Link className="brand" href="/"><BrandMark /><span>Tuveloz</span></Link>
        <div>
          <span>Private owner compliance queue</span>
          <Link href="/admin">Back to owner dashboard</Link>
        </div>
      </header>

      <section className="admin-intro">
        <span className="kicker">Provider registration · policy v{data?.policy.version ?? "0.11"}</span>
        <h1>Approve exact services, not whole people.</h1>
        <p>
          This queue helps you register applicants and review their evidence. There is no unrestricted
          provider-approval button: the system activates a provider automatically only after at least one
          exact service passes the current pathway, person, agreement, evidence, and written-approval rules.
        </p>
        {error && <p className="form-error" role="alert">{error}</p>}
        {notice && <p className="portal-success" role="status">{notice}</p>}
        {!data && !error && <p className="admin-note">Loading the private compliance queue…</p>}
        {data && (
          <>
            <p className="request-reminder-status">{data.policy.notice}</p>
            <p className="request-reminder-status">
              Marketplace mode: {prettify(data.policy.marketplaceMode)}. Service activation records readiness,
              but the current marketplace-wide onboarding hold still blocks real jobs until the separate launch gate is released.
            </p>
            <div className="admin-stats">
              <article><strong>{data.applications.length}</strong><span>Applications</span></article>
              <article><strong>{pendingEvidenceCount}</strong><span>Documents waiting</span></article>
              <article><strong>{eligibleProviderCount}</strong><span>Providers with an eligible service</span></article>
              <article><strong>{liveServiceCount}</strong><span>Exact services activated</span></article>
            </div>
          </>
        )}
      </section>

      {data && (
        <>
          <section className="admin-section">
            <div className="admin-section-heading">
              <div>
                <h2>Platform service database</h2>
                <p className="admin-section-copy">
                  Every service starts disabled. Activation requires official-source evidence for the
                  mandatory requirements, a written insurer record, an expiration date, and your explicit
                  confirmation. Hiring a lawyer is optional; following the law is not. General auto repair is never offered.
                </p>
              </div>
              <strong>{data.policy.jurisdiction}</strong>
            </div>
            <div className="admin-grid">
              {data.platformServices.map((service) => (
                <article className="admin-card" key={service.code}>
                  <div className="admin-card-top">
                    <span>{service.live ? "✓ enabled live" : "✕ disabled"}</span>
                    <time>v{service.decisionVersion}</time>
                  </div>
                  <h3>{service.label}</h3>
                  <p>{service.code}</p>
                  <p>Policy state: {prettify(service.launchState)}</p>
                  <p>
                    Current decision: {prettify(service.decision)}
                    {service.validThrough ? ` · through ${service.validThrough}` : ""}
                  </p>
                  {service.live && (
                    <p className="verification-record">
                      Mandatory-compliance and insurer references are recorded for {service.legalRequirementsServiceCode}
                      {" in "}{service.legalRequirementsJurisdiction}. Legal review through {service.legalRequirementsValidThrough};
                      {" insurer approval through "}{service.insurerValidThrough}. Professional review: {prettify(service.legalProfessionalReviewStatus)}.
                    </p>
                  )}
                  <details>
                    <summary>
                      Minimum required official source set ({service.requiredOfficialSourceReferences.length})
                    </summary>
                    <ul>
                      {service.requiredOfficialSourceReferences.map((source) => (
                        <li key={source}>
                          <a href={source} rel="noreferrer" target="_blank">{source}</a>
                        </li>
                      ))}
                    </ul>
                  </details>
                </article>
              ))}
            </div>
          </section>

          <section className="admin-section">
            <h2>Activate one exact service</h2>
            <p className="request-reminder-status">
              Record the laws, agency requirements, permits, registrations, insurance terms, and official
              sources that actually apply to this exact service and location. A lawyer may review this work,
              but lawyer review is not used as a substitute for the underlying requirements or as proof of compliance.
            </p>
            <form className="credential-card compliance-checklist" onSubmit={submitActivation}>
              <p className="request-reminder-status">
                Evidence jurisdiction/location: <strong>{data.policy.jurisdiction}</strong>. The saved
                evidence is bound to this jurisdiction and the exact service code selected below; it cannot
                be reused for another service or location.
              </p>
              <label>
                Exact service
                <select name="serviceCode" required>
                  {data.catalog.services.map((service) => (
                    <option key={service.code} value={service.code}>{service.label} · {service.code}</option>
                  ))}
                </select>
              </label>
              <label>
                Live decision valid through
                <input name="validThrough" required type="date" />
                <span className="admin-note">This date cannot be later than either review-valid-through date below.</span>
              </label>
              <label>
                Mandatory-requirements review date
                <input name="legalRequirementsReviewedAt" required type="date" />
              </label>
              <label>
                Mandatory-requirements review valid through (maximum one year)
                <input name="legalRequirementsValidThrough" required type="date" />
              </label>
              <label>
                Reviewed by
                <input maxLength={180} name="legalRequirementsReviewedBy" placeholder="Owner or responsible compliance reviewer" required />
              </label>
              <label>
                Internal compliance reference
                <input maxLength={300} name="legalRequirementsReference" placeholder="Checklist, permit file, or requirements-matrix reference" required />
              </label>
              <label>
                Applicable requirements summary
                <textarea maxLength={4000} name="applicableRequirementsSummary" placeholder="List the required registrations, permits, customer forms, invoices, records, insurance, and service restrictions for this exact service and location." required rows={5} />
              </label>
              <label>
                Official government sources (include every minimum listed source plus any other applicable sources; one HTTPS .gov URL per line)
                <textarea maxLength={12000} name="officialSourceReferences" placeholder="https://www.montgomerycountymd.gov/..." required rows={4} />
              </label>
              <label>
                Lawyer or other legal-professional review
                <select defaultValue="not_obtained_owner_proceeding" name="legalProfessionalReviewStatus" required>
                  <option value="not_obtained_owner_proceeding">Not obtained — owner is proceeding without counsel</option>
                  <option value="obtained_optional">Obtained as optional professional review</option>
                </select>
              </label>
              <label>
                <input name="explicitProceedingWithoutCounsel" type="checkbox" value="yes" />
                If no lawyer review was obtained, I confirm the owner chose to proceed without counsel and understands this record is not legal approval.
              </label>
              <label>
                Insurer or broker approval date
                <input name="insurerApprovedAt" required type="date" />
              </label>
              <label>
                Insurer or broker approval valid through (maximum one year)
                <input name="insurerValidThrough" required type="date" />
              </label>
              <label>
                Insurer or broker approver
                <input maxLength={180} name="insurerApprovedBy" placeholder="Carrier, broker, and contact" required />
              </label>
              <label>
                Written insurer reference
                <input maxLength={300} name="insurerReference" placeholder="Binder, endorsement, email, or policy reference" required />
              </label>
              <label>
                <input name="ownerLegalComplianceAcknowledged" required type="checkbox" value="yes" />
                I confirm the official-source requirements record is complete for this exact service and location, and I understand TUVELOZ must still satisfy every applicable law.
              </label>
              <label>
                <input name="explicitConfirmation" required type="checkbox" value="yes" />
                I confirm the insurer evidence and mandatory-compliance record are genuine, current, and limited to this exact service and jurisdiction.
              </label>
              <button className="save-compliance" disabled={busyKey === "activate-service"} type="submit">
                {busyKey === "activate-service" ? "Recalculating providers…" : "Activate exact service and recalculate"}
              </button>
            </form>
          </section>

          <section className="admin-section">
            <h2>Emergency service hold</h2>
            <form className="credential-card compliance-checklist" onSubmit={submitDisable}>
              <label>
                Exact service to disable
                <select name="serviceCode" required>
                  {data.catalog.services.map((service) => (
                    <option key={service.code} value={service.code}>{service.label}</option>
                  ))}
                </select>
              </label>
              <label>
                Hold reason
                <textarea name="reason" placeholder="Why this exact service must stop" required rows={3} />
              </label>
              <label>
                <input name="explicitConfirmation" required type="checkbox" value="yes" />
                Disable this service now and recalculate every affected provider.
              </label>
              <button className="save-compliance" disabled={busyKey === "disable-service"} type="submit">
                {busyKey === "disable-service" ? "Disabling…" : "Disable exact service"}
              </button>
            </form>
          </section>

          <section className="admin-section">
            <h2>Provider registration and evidence queue</h2>
            <p className="admin-section-copy">
              ✓ means the exact item passed. ✕ means customer work remains blocked. ◷ means a document
              is waiting or a job-specific check must happen later.
            </p>
            {data.applications.length === 0 ? (
              <p className="admin-note">No provider applications yet.</p>
            ) : (
              <div className="admin-grid">
                {data.applications.map((application) => {
                  const person = application.personnel.find((item) => (
                    item.personId === application.profile?.personId
                  ));
                  const today = new Date().toISOString().slice(0, 10);
                  const externalIdentityAndAgeCurrent = Boolean(
                    person?.identityVerifiedAt
                    && person.ageVerifiedAt
                    && person.identityVerificationProvider
                    && person.identityVerificationReference
                    && person.identityVerificationCheckedAt
                    && person.identityVerificationValidThrough >= today
                    && person.ageVerificationProvider
                    && person.ageVerificationReference
                    && person.ageVerificationCheckedAt
                    && person.ageVerificationValidThrough >= today,
                  );
                  const employeePath = application.profile?.pathway === "sponsored_trainee_employee"
                    || application.profile?.pathway === "provider_business_employee";
                  const draft = initializeDrafts[application.id];
                  const selectedPathway = data.catalog.pathways.find((item) => item.code === draft?.pathway);
                  const compatibleLevels = selectedPathway?.allowedLevels.filter((level) => level !== "learning_account") ?? [];
                  const availableServices = data.catalog.services.filter((service) => (
                    draft
                    && service.allowedPathways.includes(draft.pathway)
                    && service.allowedProviderLevels.includes(draft.providerLevel)
                  ));
                  const eligibleSponsors = data.applications.filter((candidate) => (
                    candidate.id !== application.id
                    && candidate.applicationStatus === "approved"
                    && candidate.verificationStatus === "verified"
                    && candidate.isTestProvider !== "yes"
                    && candidate.eligibleServices.length > 0
                  ));
                  return (
                    <article className="admin-card" key={application.id}>
                      <div className="admin-card-top">
                        <span>
                          {application.eligibleServices.length > 0
                            ? "✓ exact service eligible"
                            : "✕ pending / blocked"}
                        </span>
                        <time>{application.createdAt}</time>
                      </div>
                      <h3>{application.name}</h3>
                      <p>{application.email} · {application.preferredLanguage || "Language not set"}</p>
                      <div className="admin-contact">
                        <Link href="/account?role=provider">Open provider sign-in</Link>
                        <a
                          href={`mailto:${application.email}?subject=${encodeURIComponent("Continue your TUVELOZ provider onboarding")}&body=${encodeURIComponent(`Hi ${application.name},\n\nPlease sign in to TUVELOZ with this same email address (${application.email}) to accept the current provider agreements and upload the evidence requested for each exact service.\n\nProvider sign-in: https://tuveloz.com/account?role=provider\n\nUploading a document does not activate a service; TUVELOZ will review each item and notify you of corrections.`)}`}
                        >
                          Draft onboarding email
                        </a>
                      </div>
                      <p>Provider next-step link: <code>/account?role=provider</code></p>
                      <p>
                        Application: {application.applicationStatus} · verification: {application.verificationStatus}
                      </p>
                      <p>
                        Pathway: {application.profile
                          ? `${prettify(application.profile.pathway)} · ${prettify(application.profile.providerLevel)}`
                          : "Legacy application — not initialized"}
                      </p>
                      <p>Service area: {application.serviceArea || "Not recorded"}</p>
                      {application.experience && <blockquote>{application.experience}</blockquote>}

                      {application.canInitializeV011 && draft && (
                        <div className="compliance-checklist">
                          <div>
                            <strong>Initialize this legacy application</strong>
                            <span>
                              Choose the real relationship and exact services. This creates pending records only;
                              it does not fabricate signatures, employment, evidence, or approval.
                            </span>
                          </div>
                          <div className="credential-card">
                            <label>
                              Pathway
                              <select
                                value={draft.pathway}
                                onChange={(event) => {
                                  const pathway = event.target.value;
                                  const allowed = data.catalog.pathways.find((item) => item.code === pathway)?.allowedLevels
                                    .filter((level) => level !== "learning_account") ?? [];
                                  updateInitializeDraft(application.id, () => ({
                                    pathway,
                                    providerLevel: allowed[0] ?? "",
                                    serviceCodes: [],
                                  }));
                                }}
                              >
                                {data.catalog.pathways.map((pathway) => (
                                  <option key={pathway.code} value={pathway.code}>{pathway.label}</option>
                                ))}
                              </select>
                            </label>
                            <label>
                              Provider level
                              <select
                                value={draft.providerLevel}
                                onChange={(event) => updateInitializeDraft(application.id, (current) => ({
                                  ...current,
                                  providerLevel: event.target.value,
                                  serviceCodes: [],
                                }))}
                              >
                                {compatibleLevels.map((level) => (
                                  <option key={level} value={level}>
                                    {data.catalog.levels.find((item) => item.code === level)?.label ?? prettify(level)}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <div className="service-approval-review">
                              <strong>Exact service codes</strong>
                              {availableServices.map((service) => (
                                <label key={service.code}>
                                  <input
                                    checked={draft.serviceCodes.includes(service.code)}
                                    onChange={(event) => updateInitializeDraft(application.id, (current) => ({
                                      ...current,
                                      serviceCodes: event.target.checked
                                        ? [...new Set([...current.serviceCodes, service.code])]
                                        : current.serviceCodes.filter((code) => code !== service.code),
                                    }))}
                                    type="checkbox"
                                  />
                                  <span><strong>{service.label}</strong><small>{service.code}</small></span>
                                </label>
                              ))}
                            </div>
                            <button
                              className="save-compliance"
                              disabled={busyKey === `initialize:${application.id}` || draft.serviceCodes.length === 0}
                              onClick={() => void initializeApplication(application)}
                              type="button"
                            >
                              {busyKey === `initialize:${application.id}` ? "Initializing…" : "Create pending v0.11 pathway"}
                            </button>
                          </div>
                        </div>
                      )}

                      {application.profile && person && (
                        <div className="compliance-checklist">
                          <div>
                            <strong>1. Applicant identity and adult review</strong>
                            <span>
                              Record only the external provider, result/case reference, and review dates.
                              Do not enter an SSN, driver-license number, passport number, I-9, or
                              identity-document image here.
                            </span>
                          </div>
                          {externalIdentityAndAgeCurrent ? (
                            <p className="verification-record">
                              ✓ Identity and adult status reviewed {person.identityVerifiedAt}
                              <br />Identity provider: {person.identityVerificationProvider}
                              {` | reference ${person.identityVerificationReference}`}
                              {` | valid through ${person.identityVerificationValidThrough}`}
                              <br />Adult-status provider: {person.ageVerificationProvider}
                              {` | reference ${person.ageVerificationReference}`}
                              {` | valid through ${person.ageVerificationValidThrough}`}
                            </p>
                          ) : (
                            <form
                              className="credential-card"
                              onSubmit={(event) => {
                                event.preventDefault();
                                const values = Object.fromEntries(new FormData(event.currentTarget).entries());
                                void submitAction({
                                  action: "identity-age-review",
                                  providerId: application.id,
                                  personId: person.personId,
                                  identityVerificationProvider: values.identityVerificationProvider,
                                  identityVerificationReference: values.identityVerificationReference,
                                  identityVerificationCheckedAt: values.identityVerificationCheckedAt,
                                  identityVerificationValidThrough: values.identityVerificationValidThrough,
                                  ageVerificationProvider: values.ageVerificationProvider,
                                  ageVerificationReference: values.ageVerificationReference,
                                  ageVerificationCheckedAt: values.ageVerificationCheckedAt,
                                  ageVerificationValidThrough: values.ageVerificationValidThrough,
                                  identityConfirmed: values.identityConfirmed === "yes",
                                  adultConfirmed: values.adultConfirmed === "yes",
                                  explicitConfirmation: values.explicitConfirmation === "yes",
                                }, `identity:${application.id}`);
                              }}
                            >
                              <strong>External identity verification</strong>
                              <label>
                                Provider
                                <input name="identityVerificationProvider" placeholder="Independent identity-verification service" required />
                              </label>
                              <label>
                                Result or case reference
                                <input minLength={8} name="identityVerificationReference" placeholder="External result/case reference, never an ID number" required />
                              </label>
                              <label>
                                Checked date
                                <input max={today} name="identityVerificationCheckedAt" required type="date" />
                              </label>
                              <label>
                                Valid through
                                <input min={today} name="identityVerificationValidThrough" required type="date" />
                              </label>
                              <strong>External adult-status verification</strong>
                              <label>
                                Provider
                                <input name="ageVerificationProvider" placeholder="Independent age-verification service" required />
                              </label>
                              <label>
                                Result or case reference
                                <input minLength={8} name="ageVerificationReference" placeholder="External result/case reference, never an ID number" required />
                              </label>
                              <label>
                                Checked date
                                <input max={today} name="ageVerificationCheckedAt" required type="date" />
                              </label>
                              <label>
                                Valid through
                                <input min={today} name="ageVerificationValidThrough" required type="date" />
                              </label>
                              <label><input name="identityConfirmed" required type="checkbox" value="yes" /> The external identity result matches this application.</label>
                              <label><input name="adultConfirmed" required type="checkbox" value="yes" /> The external result confirms the applicant is at least 18 years old.</label>
                              <label><input name="explicitConfirmation" required type="checkbox" value="yes" /> Record references and dates only; no identity number or document.</label>
                              <button className="save-compliance" disabled={busyKey === `identity:${application.id}`} type="submit">
                                {busyKey === `identity:${application.id}` ? "Saving…" : "Record identity and age review"}
                              </button>
                            </form>
                          )}
                        </div>
                      )}

                      {application.profile && person && employeePath && (
                        <div className="compliance-checklist">
                          <div>
                            <strong>2. Employer attestation</strong>
                            <span>
                              The employer—not TUVELOZ—keeps I-9 and work-authorization records. Record only
                              the responsible provider reference and attestation timestamps.
                            </span>
                          </div>
                          {person.employerAttestedAt ? (
                            <p className="verification-record">
                              ✓ Employer attested {person.employerAttestedAt} · sponsor {application.profile.sponsorProviderId}
                            </p>
                          ) : (
                            <form
                              className="credential-card"
                              onSubmit={(event) => {
                                event.preventDefault();
                                const values = Object.fromEntries(new FormData(event.currentTarget).entries());
                                void submitAction({
                                  action: "employer-attestation",
                                  providerId: application.id,
                                  personId: person.personId,
                                  sponsorProviderId: values.sponsorProviderId,
                                  employerAttestedByPersonId: values.employerAttestedByPersonId,
                                  employmentStartedAt: values.employmentStartedAt,
                                  genuineEmployeeConfirmed: values.genuineEmployeeConfirmed === "yes",
                                  employerRetainsWorkAuthorizationRecords: values.employerRetainsWorkAuthorizationRecords === "yes",
                                  lawfulPayAndCoverageConfirmed: values.lawfulPayAndCoverageConfirmed === "yes",
                                  noBorrowedCredentialsConfirmed: values.noBorrowedCredentialsConfirmed === "yes",
                                  explicitConfirmation: values.explicitConfirmation === "yes",
                                }, `employer:${application.id}`);
                              }}
                            >
                              <label>
                                Active sponsoring provider business
                                <select name="sponsorProviderId" required>
                                  <option value="">Choose an active registered provider</option>
                                  {eligibleSponsors.map((candidate) => (
                                    <option key={candidate.id} value={candidate.id}>
                                      {candidate.name} · {candidate.email}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              {eligibleSponsors.length === 0 && (
                                <p className="form-error">
                                  Register and qualify the sponsoring provider business before recording this employee attestation.
                                </p>
                              )}
                              <label>
                                Authorized employer signer/reference
                                <input name="employerAttestedByPersonId" placeholder="Employer signer or controlled personnel reference" required />
                              </label>
                              <label>
                                Employment start date
                                <input name="employmentStartedAt" required type="date" />
                              </label>
                              <label><input name="genuineEmployeeConfirmed" required type="checkbox" value="yes" /> This person is a genuine paid employee, not a 1099 trainee borrowing credentials.</label>
                              <label><input name="employerRetainsWorkAuthorizationRecords" required type="checkbox" value="yes" /> The employer—not TUVELOZ—completed and retains required work-authorization records.</label>
                              <label><input name="lawfulPayAndCoverageConfirmed" required type="checkbox" value="yes" /> Lawful pay, workers&apos; compensation responsibility, and applicable coverage were confirmed.</label>
                              <label><input name="noBorrowedCredentialsConfirmed" required type="checkbox" value="yes" /> No borrowed-credential arrangement is being used.</label>
                              <label><input name="explicitConfirmation" required type="checkbox" value="yes" /> Record attestations as timestamps only; do not upload I-9 or identity documents.</label>
                              <button className="save-compliance" disabled={busyKey === `employer:${application.id}`} type="submit">
                                {busyKey === `employer:${application.id}` ? "Saving…" : "Record employer attestation"}
                              </button>
                            </form>
                          )}
                        </div>
                      )}

                      <div className="compliance-checklist">
                        <div><strong>Current agreements</strong><span>The provider must sign; the owner cannot create acceptance for them.</span></div>
                        {application.agreements.map((agreement) => (
                          <p className={agreement.current ? "verification-record" : "form-error"} key={agreement.key}>
                            {agreement.current ? "✓" : "✕"} {agreement.title} v{agreement.requiredVersion}
                            {agreement.current ? ` · ${agreement.acceptedAt}` : " · provider signature required"}
                          </p>
                        ))}
                      </div>

                      <div className="compliance-checklist">
                        <div><strong>Exact service results</strong><span>Eligibility is recalculated after every owner decision.</span></div>
                        {application.services.length === 0 ? (
                          <p className="form-error">✕ No exact v0.11 services selected.</p>
                        ) : application.services.map((service) => (
                          <details className={`service-approval-item ${service.status === "eligible" ? "ready" : "blocked"}`} key={service.code}>
                            <summary>
                              <strong>{statusIcon(service.status)} {service.label}</strong>
                              <small>{service.status === "eligible" ? "Eligible" : "Blocked"} · {service.code}</small>
                            </summary>
                            {service.reasons.map((reason) => <small key={reason}>✕ {prettify(reason)}</small>)}
                            {service.requirements.map((requirement) => (
                              <p className={requirement.status === "accepted" ? "verification-record" : "form-error"} key={requirement.code}>
                                {statusIcon(requirement.status)} {requirement.label} · {statusLabel(requirement.status)}
                              </p>
                            ))}
                            <p>
                              Platform activation: {service.activation?.live ? "✓ Live" : "✕ Not live"}
                              {service.activation?.validThrough ? ` through ${service.activation.validThrough}` : ""}
                            </p>
                          </details>
                        ))}
                      </div>

                      <div className="compliance-checklist">
                        <div>
                          <strong>Private evidence decisions</strong>
                          <span>Open the private document first. The JSON and page never expose R2 keys or document hashes.</span>
                        </div>
                        {application.evidence.length === 0 ? (
                          <p className="form-error">✕ No evidence submitted.</p>
                        ) : application.evidence.map((evidence) => (
                          <EvidenceReviewForm
                            applicationId={application.id}
                            busy={busyKey === `evidence:${evidence.id}`}
                            evidence={evidence}
                            key={evidence.id}
                            onSubmit={(payload) => submitAction(payload, `evidence:${evidence.id}`)}
                          />
                        ))}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}
