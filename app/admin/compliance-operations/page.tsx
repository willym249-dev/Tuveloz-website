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

type Appeal = {
  id: string;
  providerId: string;
  providerName: string;
  providerEmail: string;
  evidenceSubmissionId: string;
  serviceCode: string;
  appealType: string;
  reason: string;
  status: string;
  submittedAt: string;
  dueAt: string;
  reviewedBy: string;
  reviewedAt: string;
  decision: string;
  decisionReason: string;
  resolutionNotes: string;
};

type RightsRequest = {
  id: string;
  requesterEmail: string;
  requesterRole: string;
  providerId: string;
  requestType: string;
  scope: string;
  details: string;
  identityVerificationStatus: string;
  status: string;
  receivedAt: string;
  dueAt: string;
  legalHold: string;
  resolvedAt: string;
  resolvedBy: string;
  responseSummary: string;
  deletionCompletedAt: string;
};

type Reminder = {
  id: string;
  providerId: string;
  providerName: string;
  evidenceSubmissionId: string;
  serviceCode: string;
  reminderType: string;
  dueAt: string;
  channel: string;
  recipientEmail: string;
  status: string;
  scheduledAt: string;
  sentAt: string;
  lastAttemptAt: string;
  attempts: number;
};

type JobRecord = {
  id: string;
  requestId: string;
  status: string;
  [key: string]: unknown;
};

type QueueResponse = {
  error?: string;
  generatedAt: string;
  notice: string;
  queueSummary: {
    appeals: { totalOpen: number; loaded: number; hasMore: boolean };
    dataRightsRequests: { totalOpen: number; loaded: number; hasMore: boolean };
    scheduledReminders: { totalOpen: number; loaded: number; hasMore: boolean };
  };
  appeals: Appeal[];
  dataRightsRequests: RightsRequest[];
  reminders: Reminder[];
  jobOperations: {
    incidents: JobRecord[];
    cancellations: JobRecord[];
    changeOrders: JobRecord[];
    invoices: JobRecord[];
    paymentAdjustments: JobRecord[];
  };
};

function words(value: unknown) {
  return String(value || "").replaceAll("_", " ");
}

export default function ComplianceOperationsPage() {
  const [data, setData] = useState<QueueResponse | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/compliance-operations", { cache: "no-store" });
    const result = await response.json().catch(() => ({})) as QueueResponse;
    if (!response.ok) throw new Error(result.error || "Unable to load the owner queue.");
    setData(result);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      load().catch((reason) => setError(
        reason instanceof Error ? reason.message : "Unable to load the owner queue.",
      ));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function submit(
    key: string,
    action: string,
    id: string,
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setBusy(key);
    setError("");
    setNotice("");
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    try {
      const response = await fetch("/api/admin/compliance-operations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...values, action, id }),
      });
      const result = await response.json().catch(() => ({})) as { error?: string; message?: string };
      if (!response.ok) throw new Error(result.error || "Unable to save this review action.");
      setNotice(result.message || "Review action recorded.");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to save this review action.");
    } finally {
      setBusy("");
    }
  }

  const jobRequests = useMemo(() => {
    const result = new Map<string, {
      requestId: string;
      incidents: number;
      cancellations: number;
      changes: number;
      invoices: number;
      adjustments: number;
    }>();
    function add(items: JobRecord[] | undefined, fieldName: "incidents" | "cancellations" | "changes" | "invoices" | "adjustments") {
      for (const item of items ?? []) {
        if (!item.requestId) continue;
        const current = result.get(item.requestId) ?? {
          requestId: item.requestId,
          incidents: 0,
          cancellations: 0,
          changes: 0,
          invoices: 0,
          adjustments: 0,
        };
        current[fieldName] += 1;
        result.set(item.requestId, current);
      }
    }
    add(data?.jobOperations.incidents, "incidents");
    add(data?.jobOperations.cancellations, "cancellations");
    add(data?.jobOperations.changeOrders, "changes");
    add(data?.jobOperations.invoices, "invoices");
    add(data?.jobOperations.paymentAdjustments, "adjustments");
    return [...result.values()];
  }, [data]);

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <Link className="brand" href="/"><BrandMark /><span>Tuveloz</span></Link>
        <div>
          <span>Private compliance operations</span>
          <Link href="/admin/launch-readiness">Integrated launch review</Link>
          <Link href="/admin">Owner dashboard</Link>
        </div>
      </header>

      <section className="admin-intro">
        <span className="kicker">Appeals · privacy · renewals · job records</span>
        <h1>One owner queue for the work that cannot be ignored.</h1>
        <p>
          Record what was actually reviewed or completed. This queue never accepts provider
          evidence, deletes files, sends messages, moves money, or restores job access by itself.
        </p>
        {error && <p className="form-error" role="alert">{error}</p>}
        {notice && <p className="portal-success" role="status">{notice}</p>}
        {!data && !error && <p className="admin-note">Loading the owner queue…</p>}
        {data && (
          <>
            <p className="request-reminder-status">{data.notice}</p>
            <div className="admin-stats">
              <article><strong>{data.queueSummary.appeals.totalOpen}</strong><span>Open appeals</span></article>
              <article><strong>{data.queueSummary.dataRightsRequests.totalOpen}</strong><span>Open privacy requests</span></article>
              <article><strong>{data.queueSummary.scheduledReminders.totalOpen}</strong><span>Scheduled renewal reminders</span></article>
              <article><strong>{jobRequests.length}</strong><span>Jobs with operation records</span></article>
            </div>
            {(data.queueSummary.appeals.hasMore
              || data.queueSummary.dataRightsRequests.hasMore
              || data.queueSummary.scheduledReminders.hasMore) && (
              <p className="admin-note">
                Counts cover every open record. The lists below show only the earliest due loaded rows; additional records remain in the queue.
              </p>
            )}
          </>
        )}
      </section>

      {data && (
        <>
          <section className="admin-section">
            <div className="admin-section-heading">
              <div><h2>Provider appeals</h2><p className="admin-section-copy">An appeal decision never accepts evidence or restores a service.</p></div>
              <strong>{data.queueSummary.appeals.totalOpen} open · {data.queueSummary.appeals.loaded} loaded</strong>
            </div>
            <div className="admin-grid">
              {data.appeals.length === 0 && <p>No provider appeals have been submitted.</p>}
              {data.appeals.map((appeal) => (
                <article className="admin-card" key={appeal.id}>
                  <div className="admin-card-top"><span>{words(appeal.status)}</span><time>{appeal.submittedAt}</time></div>
                  <h3>{appeal.providerName || appeal.providerEmail}</h3>
                  <p>{appeal.serviceCode || "Provider-level appeal"} · {words(appeal.appealType)}</p>
                  <p><strong>Provider statement:</strong> {appeal.reason}</p>
                  {appeal.decision && <p className="verification-record">Decision: {words(appeal.decision)} · {appeal.resolutionNotes}</p>}
                  <form className="credential-card" onSubmit={(event) => submit(`appeal:${appeal.id}`, "review-appeal", appeal.id, event)}>
                    <label>
                      Outcome
                      <select name="outcome" defaultValue={appeal.status === "under_review" ? "under_review" : "under_review"}>
                        <option value="under_review">Start/continue review</option>
                        <option value="granted">Grant appeal (still requires separate evidence decision)</option>
                        <option value="correction_required">Correction required</option>
                        <option value="denied">Deny appeal</option>
                      </select>
                    </label>
                    <label>Decision reason<input name="decisionReason" defaultValue={appeal.decisionReason} /></label>
                    <label>Plain-language response<textarea name="resolutionNotes" defaultValue={appeal.resolutionNotes} rows={3} /></label>
                    <button className="save-compliance" disabled={busy === `appeal:${appeal.id}`} type="submit">
                      {busy === `appeal:${appeal.id}` ? "Recording…" : "Record appeal review"}
                    </button>
                  </form>
                </article>
              ))}
            </div>
          </section>

          <section className="admin-section">
            <div className="admin-section-heading">
              <div><h2>Privacy and data-rights requests</h2><p className="admin-section-copy">Verify identity, apply legal holds, and record the real response. Deletion is never automatic here.</p></div>
              <strong>{data.queueSummary.dataRightsRequests.totalOpen} open · {data.queueSummary.dataRightsRequests.loaded} loaded</strong>
            </div>
            <div className="admin-grid">
              {data.dataRightsRequests.length === 0 && <p>No privacy requests have been submitted.</p>}
              {data.dataRightsRequests.map((item) => (
                <article className="admin-card" key={item.id}>
                  <div className="admin-card-top"><span>{words(item.status)}</span><time>{item.receivedAt}</time></div>
                  <h3>{words(item.requestType)}</h3>
                  <p>{item.requesterEmail} · {words(item.requesterRole)} · scope: {words(item.scope)}</p>
                  <p>{item.details || "No additional details."}</p>
                  {item.deletionCompletedAt && <p className="verification-record">Deletion recorded complete {item.deletionCompletedAt}</p>}
                  <form className="credential-card" onSubmit={(event) => submit(`rights:${item.id}`, "update-data-rights", item.id, event)}>
                    <label>
                      Request status
                      <select name="status" defaultValue={item.status}>
                        <option value="submitted">Submitted</option>
                        <option value="identity_verification">Identity verification</option>
                        <option value="in_review">In review</option>
                        <option value="fulfilled">Fulfilled</option>
                        <option value="denied">Denied with lawful reason</option>
                        <option value="closed">Closed</option>
                      </select>
                    </label>
                    <label>
                      Identity verification
                      <select name="identityVerificationStatus" defaultValue={item.identityVerificationStatus || "pending"}>
                        <option value="pending">Pending</option>
                        <option value="account_session_verified">Account session verified</option>
                        <option value="additional_verification_required">More verification required</option>
                        <option value="verified">Verified</option>
                        <option value="failed">Failed</option>
                      </select>
                    </label>
                    <label>Identity-verification reference<input name="identityVerificationReference" placeholder="Vendor result, support ticket, or restricted review reference" /></label>
                    <label className="policy-check">
                      <input name="explicitIdentityVerification" type="checkbox" value="yes" />
                      <span>I confirm this identity status matches a real verification record.</span>
                    </label>
                    <label className="policy-check">
                      <input defaultChecked={item.legalHold === "yes"} name="legalHold" type="checkbox" value="yes" />
                      <span>Legal hold is active; do not delete covered information.</span>
                    </label>
                    {item.legalHold === "yes" && (
                      <>
                        <label>Legal-hold release reference<input name="legalHoldReleaseReference" placeholder="Court, agency, matter, or authorized release reference" /></label>
                        <label className="policy-check">
                          <input name="explicitLegalHoldRelease" type="checkbox" value="yes" />
                          <span>I confirm a real authorized release exists. This must be saved separately before any deletion completion.</span>
                        </label>
                      </>
                    )}
                    <label>Response summary<textarea defaultValue={item.responseSummary} name="responseSummary" rows={4} /></label>
                    <label className="policy-check">
                      <input name="deletionCompleted" type="checkbox" value="yes" />
                      <span>Record that a separately approved deletion was actually completed.</span>
                    </label>
                    <label>Deletion completion reference<input name="deletionReference" placeholder="Deletion job, support ticket, or completion report" /></label>
                    <label className="policy-check">
                      <input name="explicitDeletionConfirmation" type="checkbox" value="yes" />
                      <span>I understand this form does not perform the deletion.</span>
                    </label>
                    <button className="save-compliance" disabled={busy === `rights:${item.id}`} type="submit">
                      {busy === `rights:${item.id}` ? "Recording…" : "Record privacy review"}
                    </button>
                  </form>
                </article>
              ))}
            </div>
          </section>

          <section className="admin-section">
            <div className="admin-section-heading">
              <div><h2>Evidence-renewal reminders</h2><p className="admin-section-copy">These records are scheduled. Until a delivery worker is connected, record only messages actually sent elsewhere.</p></div>
              <strong>{data.queueSummary.scheduledReminders.totalOpen} scheduled · {data.queueSummary.scheduledReminders.loaded} loaded</strong>
            </div>
            <div className="admin-grid">
              {data.reminders.length === 0 && <p>No expiration reminders have been scheduled.</p>}
              {data.reminders.map((item) => (
                <article className="admin-card" key={item.id}>
                  <div className="admin-card-top"><span>{words(item.status)}</span><time>due {item.dueAt}</time></div>
                  <h3>{item.providerName || item.recipientEmail}</h3>
                  <p>{words(item.reminderType)} · {item.serviceCode || "provider-wide"} · attempts {item.attempts}</p>
                  <form className="credential-card" onSubmit={(event) => submit(`reminder:${item.id}`, "record-reminder-result", item.id, event)}>
                    <label>
                      Actual result
                      <select name="result" defaultValue="sent">
                        <option value="sent">Sent outside this screen</option>
                        <option value="failed">Delivery failed</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </label>
                    <label>Delivery/manual-contact reference<input name="deliveryReference" placeholder="Message ID, support ticket, or dated contact note" required /></label>
                    <label className="policy-check">
                      <input name="explicitConfirmation" type="checkbox" value="yes" required />
                      <span>I confirm this record matches what actually happened.</span>
                    </label>
                    <button className="save-compliance" disabled={busy === `reminder:${item.id}`} type="submit">
                      {busy === `reminder:${item.id}` ? "Recording…" : "Record reminder result"}
                    </button>
                  </form>
                </article>
              ))}
            </div>
          </section>

          <section className="admin-section">
            <div className="admin-section-heading">
              <div><h2>Job-operation records</h2><p className="admin-section-copy">Open a job&apos;s dedicated workflow for incidents, cancellations, scope changes, invoices, refunds, holds, and payout review.</p></div>
              <strong>{jobRequests.length} jobs</strong>
            </div>
            <div className="admin-grid">
              {jobRequests.length === 0 && <p>No persisted test job-operation records exist.</p>}
              {jobRequests.map((item) => (
                <article className="admin-card" key={item.requestId}>
                  <div className="admin-card-top"><span>Job record</span><time>{item.requestId}</time></div>
                  <p>
                    {item.incidents} incident(s) · {item.cancellations} cancellation(s) · {item.changes} change(s) · {item.invoices} invoice(s) · {item.adjustments} payment adjustment(s)
                  </p>
                  <Link className="button secondary" href={`/job-operations?requestId=${encodeURIComponent(item.requestId)}`}>
                    Open controlled job workflow
                  </Link>
                </article>
              ))}
            </div>
          </section>

          <section className="admin-section">
            <div className="admin-section-heading">
              <div><h2>Review timestamp</h2><p className="admin-section-copy">Refresh before making a decision if another reviewer may be working.</p></div>
              <time>{new Date(data.generatedAt).toLocaleString()}</time>
            </div>
          </section>
        </>
      )}
    </main>
  );
}
