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
import { OWNER_LEGAL_REVIEW_ACKNOWLEDGEMENT } from "../../../lib/launch-readiness";

type InternalGate = {
  key: string;
  title: string;
  stage: "provider_onboarding" | "transaction_pilot";
  passed: boolean;
  detail: string;
};

type AuthorityApproval = {
  authority: string;
  evidenceReference: string;
  approvedBy: string;
  approvedAt: string;
  validThrough: string;
};

type ExternalGate = {
  key: string;
  stage: "provider_onboarding" | "transaction_pilot";
  category: string;
  title: string;
  plainLanguage: string;
  authority: string[];
  required: boolean;
  requiresValidThrough?: boolean;
  acceptedOfficialSourceReferences?: string[];
  reviewState: string;
  decision: null | {
    gateVersion: number;
    status: string;
    evidenceReference: string;
    approvedBy: string;
    approvedAt: string;
    validThrough: string;
    notes: string;
    decidedBy: string;
    createdAt: string;
    authorityApprovals: AuthorityApproval[];
  };
};

type ReadinessResponse = {
  error?: string;
  generatedAt: string;
  summary: {
    providerOnboardingReviewComplete: boolean;
    transactionPilotReviewComplete: boolean;
    realTransactionsEnabled: boolean;
    automaticEnablement: boolean;
    marketplaceMode: string;
    customerRequestsPaused: boolean;
    stripeMode: string;
    liveStripeAllowed: boolean;
  };
  workload: {
    providers: number;
    evidenceScansPending: number;
    providerAppealsOpen: number;
    dataRightsRequestsOpen: number;
    complianceRemindersScheduled: number;
    eligibleProviderServices: number;
    platformServicesActivated: number;
    openJobIncidents: number;
    paymentAdjustmentsPending: number;
  };
  internalGates: InternalGate[];
  externalGates: ExternalGate[];
  ownerLegalReviewChoice: null | {
    format: "tuveloz_owner_legal_review_choice_v1";
    decision: "proceeding_without_counsel";
    scope: string;
    acknowledgedNoLegalApproval: true;
    acknowledgedMandatoryRequirementsRemain: true;
    acknowledgement: string;
    decidedAt: string;
    decidedBy: string;
    gateVersion: number;
    recordedAt: string;
  };
  notice: string;
};

function words(value: string) {
  return value.replaceAll("_", " ");
}

function reviewSymbol(state: string) {
  if (state === "approved") return "✓";
  if (state === "blocked" || state === "expired" || state === "not_approved") return "X";
  if (state === "not_applicable") return "—";
  return "!";
}

function stageTitle(stage: ExternalGate["stage"]) {
  return stage === "provider_onboarding"
    ? "Provider-onboarding review"
    : "Customer transaction pilot review";
}

export default function LaunchReadinessPage() {
  const [data, setData] = useState<ReadinessResponse | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/launch-readiness", { cache: "no-store" });
    const result = await response.json().catch(() => ({})) as ReadinessResponse;
    if (!response.ok) throw new Error(result.error || "Unable to load the integrated review.");
    setData(result);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      load().catch((reason) => setError(
        reason instanceof Error ? reason.message : "Unable to load the integrated review.",
      ));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function saveDecision(gate: ExternalGate, event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(gate.key);
    setError("");
    setNotice("");
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    try {
      const response = await fetch("/api/admin/launch-readiness", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...values, gateKey: gate.key }),
      });
      const result = await response.json().catch(() => ({})) as ReadinessResponse;
      if (!response.ok) throw new Error(result.error || "Unable to record this review decision.");
      setData(result);
      setNotice(
        "Review evidence recorded. Nothing was automatically enabled; transaction and service switches remain separate.",
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to record this review decision.");
    } finally {
      setBusy("");
    }
  }

  async function saveOwnerLegalReviewChoice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("owner_legal_review_choice");
    setError("");
    setNotice("");
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    try {
      const response = await fetch("/api/admin/launch-readiness", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...values,
          gateKey: "owner_legal_review_choice",
          decision: "proceeding_without_counsel",
        }),
      });
      const result = await response.json().catch(() => ({})) as ReadinessResponse;
      if (!response.ok) throw new Error(result.error || "Unable to record the owner legal-review choice.");
      setData(result);
      setNotice(
        "Owner choice recorded as a new version. It did not approve or satisfy any mandatory launch gate, and nothing was enabled.",
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to record the owner legal-review choice.");
    } finally {
      setBusy("");
    }
  }

  const stages = useMemo(() => ([
    "provider_onboarding",
    "transaction_pilot",
  ] as const), []);

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <Link className="brand" href="/"><BrandMark /><span>Tuveloz</span></Link>
        <div>
          <span>Private integrated review</span>
          <Link href="/admin">Back to owner dashboard</Link>
        </div>
      </header>

      <section className="admin-intro">
        <span className="kicker">One review center · no automatic launch</span>
        <h1>See what is built, what is missing, and what evidence is still required.</h1>
        <p>
          Hiring counsel is an optional owner decision. Applicable laws and the evidence
          required for licensing, insurance, tax, payments, privacy, security, identity,
          exact services, and provider-of-record duties are not optional. This page keeps
          the owner choice separate from every mandatory evidence gate.
        </p>
        {error && <p className="form-error" role="alert">{error}</p>}
        {notice && <p className="portal-success" role="status">{notice}</p>}
        {!data && !error && <p className="admin-note">Loading the integrated review…</p>}
        {data && (
          <>
            <p className="request-reminder-status">{data.notice}</p>
            <div className="admin-stats">
              <article>
                <strong>{data.summary.providerOnboardingReviewComplete ? "✓" : "X"}</strong>
                <span>Onboarding review complete</span>
              </article>
              <article>
                <strong>{data.summary.transactionPilotReviewComplete ? "✓" : "X"}</strong>
                <span>Transaction-pilot review complete</span>
              </article>
              <article>
                <strong>{data.summary.realTransactionsEnabled ? "ON" : "OFF"}</strong>
                <span>Real transactions</span>
              </article>
              <article>
                <strong>{data.workload.platformServicesActivated}</strong>
                <span>Exact services activated</span>
              </article>
            </div>
          </>
        )}
      </section>

      {data && (
        <>
          <section className="admin-section">
            <div className="admin-section-heading">
              <div>
                <h2>Optional counsel choice</h2>
                <p className="admin-section-copy">
                  Record the owner&apos;s choice honestly. This record is never counted as
                  legal approval and never satisfies another launch gate.
                </p>
              </div>
              <strong>{data.ownerLegalReviewChoice ? "recorded" : "not recorded"}</strong>
            </div>
            <div className="admin-grid">
              <article className="admin-card">
                <div className="admin-card-top">
                  <span>Owner decision</span>
                  <strong>counsel is optional</strong>
                </div>
                {data.ownerLegalReviewChoice ? (
                  <div className="verification-record">
                    <p><strong>Decision:</strong> proceeding without counsel</p>
                    <p><strong>Scope:</strong> {data.ownerLegalReviewChoice.scope}</p>
                    <p>
                      Version {data.ownerLegalReviewChoice.gateVersion} recorded by {data.ownerLegalReviewChoice.decidedBy}
                      {" on "}{new Date(data.ownerLegalReviewChoice.decidedAt).toLocaleString()}.
                    </p>
                    <p><strong>Not legal approval.</strong> Every mandatory evidence gate below remains separate.</p>
                  </div>
                ) : (
                  <p>No owner choice has been recorded.</p>
                )}
                <form className="credential-card" onSubmit={saveOwnerLegalReviewChoice}>
                  <label>
                    Decision scope
                    <textarea
                      defaultValue={data.ownerLegalReviewChoice?.scope || ""}
                      name="scope"
                      placeholder="Example: Maryland provider-onboarding review and future independent-owner transaction pilot; list any excluded services or locations."
                      required
                      rows={4}
                    />
                  </label>
                  <label>
                    <input
                      name="acknowledgedNoLegalApproval"
                      required
                      type="checkbox"
                      value="yes"
                    />
                    I understand this owner choice is not legal approval.
                  </label>
                  <label>
                    <input
                      name="acknowledgedMandatoryRequirementsRemain"
                      required
                      type="checkbox"
                      value="yes"
                    />
                    {OWNER_LEGAL_REVIEW_ACKNOWLEDGEMENT}
                  </label>
                  <button
                    className="save-compliance"
                    disabled={busy === "owner_legal_review_choice"}
                    type="submit"
                  >
                    {busy === "owner_legal_review_choice" ? "Recording..." : "Record new owner-choice version"}
                  </button>
                </form>
              </article>
            </div>
          </section>

          <section className="admin-section">
            <div className="admin-section-heading">
              <div>
                <h2>Current safety position</h2>
                <p className="admin-section-copy">
                  These values are read from the running server. Secret values are never displayed.
                </p>
              </div>
              <strong>{data.summary.marketplaceMode}</strong>
            </div>
            <div className="admin-grid">
              <article className="admin-card">
                <div className="admin-card-top"><span>Customer requests</span><strong>{data.summary.customerRequestsPaused ? "paused" : "open"}</strong></div>
                <p>Real customer requests should remain paused while this review is incomplete.</p>
              </article>
              <article className="admin-card">
                <div className="admin-card-top"><span>Stripe</span><strong>{words(data.summary.stripeMode)}</strong></div>
                <p>Permission for live Stripe keys: {data.summary.liveStripeAllowed ? "on" : "off"}.</p>
              </article>
              <article className="admin-card">
                <div className="admin-card-top"><span>Automatic launch</span><strong>{data.summary.automaticEnablement ? "on" : "off"}</strong></div>
                <p>This review page cannot turn on jobs, services, payments, or payouts.</p>
              </article>
            </div>
          </section>

          <section className="admin-section">
            <div className="admin-section-heading">
              <div>
                <h2>Owner workload</h2>
                <p className="admin-section-copy">Open records that need review or follow-up.</p>
              </div>
              <div>
                <Link href="/admin/compliance-operations">Open compliance operations</Link>
                <Link href="/admin/provider-compliance">Open provider compliance</Link>
              </div>
            </div>
            <div className="admin-stats">
              <article><strong>{data.workload.providers}</strong><span>Provider applications</span></article>
              <article><strong>{data.workload.evidenceScansPending}</strong><span>Files whose latest scan is not clean</span></article>
              <article><strong>{data.workload.providerAppealsOpen}</strong><span>Provider appeals</span></article>
              <article><strong>{data.workload.dataRightsRequestsOpen}</strong><span>Privacy requests</span></article>
              <article><strong>{data.workload.complianceRemindersScheduled}</strong><span>Renewal reminders scheduled</span></article>
              <article><strong>{data.workload.openJobIncidents}</strong><span>Open job incidents</span></article>
              <article><strong>{data.workload.paymentAdjustmentsPending}</strong><span>Payment decisions pending</span></article>
              <article><strong>{data.workload.eligibleProviderServices}</strong><span>Stored eligible records (rechecked at every job stage)</span></article>
            </div>
          </section>

          {stages.map((stage) => {
            const internal = data.internalGates.filter((gate) => gate.stage === stage);
            const external = data.externalGates.filter((gate) => gate.stage === stage);
            return (
              <section className="admin-section" key={stage}>
                <div className="admin-section-heading">
                  <div>
                    <h2>{stageTitle(stage)}</h2>
                    <p className="admin-section-copy">
                      ✓ means the evidence is current. X or ! means this stage remains blocked.
                    </p>
                  </div>
                  <strong>
                    {stage === "provider_onboarding"
                      ? data.summary.providerOnboardingReviewComplete ? "complete" : "not complete"
                      : data.summary.transactionPilotReviewComplete ? "complete" : "not complete"}
                  </strong>
                </div>

                <h3>Technical and operational checks</h3>
                <div className="admin-grid">
                  {internal.map((gate) => (
                    <article className="admin-card" key={gate.key}>
                      <div className="admin-card-top">
                        <span>{gate.passed ? "✓ passed" : "X blocked"}</span>
                        <time>system check</time>
                      </div>
                      <h3>{gate.title}</h3>
                      <p>{gate.detail}</p>
                    </article>
                  ))}
                </div>

                <h3>Mandatory evidence and reviewer records</h3>
                <div className="admin-grid">
                  {external.map((gate) => (
                    <article className="admin-card" key={gate.key}>
                      <div className="admin-card-top">
                        <span>{reviewSymbol(gate.reviewState)} {words(gate.reviewState)}</span>
                        <time>{gate.required ? "required" : "optional lane"}</time>
                      </div>
                      <h3>{gate.title}</h3>
                      <p>{gate.plainLanguage}</p>
                      <p><strong>Required evidence from:</strong> {gate.authority.join(" + ")}</p>
                      {Boolean(gate.acceptedOfficialSourceReferences?.length) && (
                        <details>
                          <summary>Gate-specific official sources</summary>
                          <p>
                            The official-source field must use one of these relevant links.
                            This list is a scope check, not a claim that no other law applies.
                          </p>
                          <ul>
                            {gate.acceptedOfficialSourceReferences?.map((reference) => (
                              <li key={reference}>
                                <a href={reference} rel="noreferrer" target="_blank">{reference}</a>
                              </li>
                            ))}
                          </ul>
                        </details>
                      )}
                      {gate.decision && (
                        <p className="verification-record">
                          Latest record v{gate.decision.gateVersion} · {words(gate.decision.status)}
                          {gate.decision.decidedBy ? ` · recorded by ${gate.decision.decidedBy}` : ""}
                        </p>
                      )}
                      <form
                        className="credential-card"
                        key={`${gate.key}:${gate.decision?.gateVersion ?? 0}`}
                        onSubmit={(event) => saveDecision(gate, event)}
                      >
                        <label>
                          Review status
                          <select name="status" defaultValue={gate.decision?.status || "pending"}>
                            <option value="pending">Pending</option>
                            <option value="approved">Verified with required evidence</option>
                            <option value="blocked">Blocked</option>
                            {!gate.required && <option value="not_applicable">Not applicable to current pilot</option>}
                          </select>
                        </label>
                        {gate.authority.map((authority, index) => {
                          const existing = gate.decision?.authorityApprovals
                            .find((item) => item.authority === authority);
                          return (
                            <fieldset className="credential-card" key={authority}>
                              <legend>{authority} evidence</legend>
                              <label>
                                Evidence reference
                                <input
                                  defaultValue={existing?.evidenceReference || ""}
                                  name={`authority_${index}_evidenceReference`}
                                  placeholder={authority === "Official legal or licensing source"
                                    ? "Direct current https://...gov source"
                                    : "Signed letter, policy, ticket, test report, or stored record location"}
                                />
                              </label>
                              <label>
                                Reviewed or issued by
                                <input
                                  defaultValue={existing?.approvedBy || ""}
                                  name={`authority_${index}_approvedBy`}
                                  placeholder="Person, agency, official source owner, carrier, CPA, processor, or reviewer"
                                />
                              </label>
                              <label>
                                Evidence review or issue date
                                <input
                                  defaultValue={existing?.approvedAt || ""}
                                  max={new Date().toISOString().slice(0, 10)}
                                  name={`authority_${index}_approvedAt`}
                                  type="date"
                                />
                              </label>
                              <label>
                                Valid through {gate.requiresValidThrough ? "(required for approval)" : "(if it expires)"}
                                <input
                                  defaultValue={existing?.validThrough || ""}
                                  name={`authority_${index}_validThrough`}
                                  type="date"
                                />
                              </label>
                            </fieldset>
                          );
                        })}
                        <label>
                          Notes
                          <textarea
                            defaultValue={gate.decision?.notes || ""}
                            name="notes"
                            placeholder="Scope, limitations, follow-up, or why this is blocked"
                            rows={3}
                          />
                        </label>
                        <button className="save-compliance" disabled={busy === gate.key} type="submit">
                          {busy === gate.key ? "Recording…" : "Record new review version"}
                        </button>
                      </form>
                    </article>
                  ))}
                </div>
              </section>
            );
          })}

          <section className="admin-section">
            <div className="admin-section-heading">
              <div>
                <h2>What happens after this review</h2>
                <p className="admin-section-copy">
                  Fix blocked code or configuration checks, collect the official records and real written decisions
                  named by each gate, rerun the full test suite, and then make a separate launch decision.
                </p>
              </div>
              <time>{new Date(data.generatedAt).toLocaleString()}</time>
            </div>
          </section>
        </>
      )}
    </main>
  );
}
