"use client";

import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  JOB_HIGH_VOLTAGE_STATUS_VALUES,
  JOB_LOCATION_TYPE_OPTIONS,
  JOB_PROPERTY_PERMISSION_VALUES,
  JOB_SAFETY_ATTESTATION_CODES,
  JOB_VEHICLE_DRIVEABILITY_VALUES,
  JOB_VEHICLE_STATE_VALUES,
  jobScopeRequirementsForService,
} from "../../lib/job-scope-facts";
import { isServiceCode } from "../../lib/provider-policy";

type ActorRole = "customer" | "provider" | "owner";
type JobRecord = Record<string, unknown> & { id?: string };

type JobOperationsData = {
  testOnly: true;
  transferExecutionEnabled: false;
  actorRole: ActorRole;
  job: {
    requestId: string;
    status: string;
    scopeVersion: number;
    serviceCodes: string[];
    scheduledFor: string;
  };
  cancellations: JobRecord[];
  incidents: JobRecord[];
  changeOrders: JobRecord[];
  invoices: JobRecord[];
  paymentAdjustments: JobRecord[];
  lifecycle: JobRecord[];
};

type Field = {
  name: string;
  label: string;
  type?: "text" | "textarea" | "number" | "select" | "checkbox" | "datetime-local" | "comma-list" | "operation-list";
  options?: Array<{ label: string; value: string }>;
  placeholder?: string;
  required?: boolean;
  defaultValue?: string | number;
  min?: number;
};

type Notice = { kind: "error" | "success"; text: string } | null;

function words(value: unknown) {
  return String(value === null || value === undefined || value === "" ? "not recorded" : value)
    .replaceAll("_", " ");
}

function money(value: unknown) {
  const cents = Number(value);
  return Number.isFinite(cents)
    ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100)
    : "not recorded";
}

function when(value: unknown) {
  const date = new Date(String(value || ""));
  return Number.isFinite(date.getTime()) ? date.toLocaleString() : "not recorded";
}

function list(value: unknown) {
  return Array.isArray(value) && value.length ? value.map(words).join(", ") : "none";
}

function objectText(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return words(value);
  return Object.entries(value as Record<string, unknown>)
    .map(([key, item]) => {
      const rendered = key.toLowerCase().includes("cents") ? money(item) : words(item);
      return `${words(key)}: ${rendered}`;
    })
    .join(" / ");
}

function operationMessage(payload: Record<string, unknown>, ok: boolean) {
  const reasons = Array.isArray(payload.reasonCodes)
    ? payload.reasonCodes.map(words)
    : Array.isArray(payload.reasons)
      ? payload.reasons.map((item) => (
        item && typeof item === "object" && "code" in item
          ? words((item as Record<string, unknown>).code)
          : words(item)
      ))
      : [];
  const base = String(payload.error || payload.notice || (ok ? "Test record saved." : "The operation was denied."));
  return reasons.length ? `${base} Reasons: ${reasons.join(", ")}.` : base;
}

function RecordSection({
  title,
  records,
  empty,
  children,
}: {
  title: string;
  records: JobRecord[];
  empty: string;
  children: (record: JobRecord) => ReactNode;
}) {
  return (
    <section className="job-record-section">
      <div className="job-record-heading">
        <h2>{title}</h2>
        <strong>{records.length}</strong>
      </div>
      {records.length === 0 ? <p>{empty}</p> : (
        <div className="job-record-grid">{records.map((record, index) => (
          <article className="job-record-card" key={record.id || `${title}-${index}`}>
            {children(record)}
          </article>
        ))}</div>
      )}
    </section>
  );
}

function OperationForm({
  title,
  role,
  action,
  fields = [],
  fixed = {},
  busy,
  onSubmit,
  warning,
}: {
  title: string;
  role: string;
  action: string;
  fields?: Field[];
  fixed?: Record<string, unknown>;
  busy: boolean;
  onSubmit: (action: string, values: Record<string, unknown>, key: string) => Promise<boolean>;
  warning?: string;
}) {
  const key = `${action}:${String(fixed.changeOrderId || fixed.cancellationId || fixed.incidentId || fixed.invoiceId || fixed.adjustmentId || "new")}`;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const values: Record<string, unknown> = { ...fixed };
    for (const field of fields) {
      if (field.type === "checkbox") {
        values[field.name] = formData.has(field.name);
        continue;
      }
      const raw = String(formData.get(field.name) || "").trim();
      if (field.type === "number") values[field.name] = raw === "" ? null : Number(raw);
      else if (field.type === "comma-list") {
        values[field.name] = raw.split(",").map((item) => item.trim()).filter(Boolean);
      } else if (field.type === "operation-list") {
        values[field.name] = raw.split(",").map((item) => {
          const [serviceCode = "", operationCode = ""] = item.split(":", 2);
          return { serviceCode: serviceCode.trim(), operationCode: operationCode.trim() };
        }).filter((item) => item.serviceCode && item.operationCode);
      } else values[field.name] = raw;
    }
    const saved = await onSubmit(action, values, key);
    if (saved && (action.startsWith("report-") || action === "request-refund" || action === "record-payment-hold")) {
      form.reset();
    }
  }

  return (
    <details className="job-operation-form">
      <summary><span>{title}</span><small>{role}</small></summary>
      <form onSubmit={submit}>
        {warning && <p className="job-form-warning">{warning}</p>}
        {fields.map((field) => (
          field.type === "checkbox" ? (
            <label className="job-operation-check" key={field.name}>
              <input name={field.name} type="checkbox" value="yes" required={field.required} />
              <span>{field.label}</span>
            </label>
          ) : (
            <label key={field.name}>
              {field.label}
              {field.type === "textarea" ? (
                <textarea name={field.name} placeholder={field.placeholder} required={field.required} rows={4} defaultValue={field.defaultValue} />
              ) : field.type === "select" ? (
                <select name={field.name} required={field.required} defaultValue={field.defaultValue ?? ""}>
                  <option disabled value="">Choose one</option>
                  {field.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              ) : (
                <input
                  name={field.name}
                  type={field.type === "number" ? "number" : field.type === "datetime-local" ? "datetime-local" : "text"}
                  min={field.min}
                  step={field.type === "number" ? 1 : undefined}
                  placeholder={field.placeholder}
                  required={field.required}
                  defaultValue={field.defaultValue}
                />
              )}
            </label>
          )
        ))}
        <button disabled={busy} type="submit">{busy ? "Recording..." : title}</button>
      </form>
    </details>
  );
}

const amountFields: Field[] = [
  { name: "laborAmountCents", label: "Labor amount (cents)", type: "number", min: 0, required: true },
  { name: "partsAmountCents", label: "Parts amount (cents)", type: "number", min: 0, required: true },
  { name: "taxAmountCents", label: "Tax amount (cents)", type: "number", min: 0, required: true },
  { name: "otherAmountCents", label: "Other amount (cents)", type: "number", min: 0, required: true },
];

export function JobOperationsConsole() {
  const [requestId, setRequestId] = useState("");
  const [data, setData] = useState<JobOperationsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyKey, setBusyKey] = useState("");
  const [notice, setNotice] = useState<Notice>(null);

  const load = useCallback(async (id: string, keepNotice = false) => {
    const cleanId = id.trim();
    if (!cleanId) {
      setData(null);
      setNotice({ kind: "error", text: "Enter a persisted test job request ID." });
      return;
    }
    setLoading(true);
    if (!keepNotice) setNotice(null);
    try {
      const result = await fetch(`/api/job-operations?requestId=${encodeURIComponent(cleanId)}`, {
        cache: "no-store",
        credentials: "same-origin",
      });
      const payload = await result.json().catch(() => ({})) as Record<string, unknown>;
      if (!result.ok) {
        setData(null);
        if (!keepNotice) setNotice({ kind: "error", text: operationMessage(payload, false) });
        return;
      }
      setData(payload as JobOperationsData);
      window.history.replaceState(null, "", `/job-operations?requestId=${encodeURIComponent(cleanId)}`);
    } catch {
      setData(null);
      if (!keepNotice) setNotice({ kind: "error", text: "The test job records could not be loaded." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initial = new URL(window.location.href).searchParams.get("requestId") || "";
    if (!initial) return;
    const task = window.setTimeout(() => {
      setRequestId(initial);
      void load(initial);
    }, 0);
    return () => window.clearTimeout(task);
  }, [load]);

  async function submit(action: string, values: Record<string, unknown>, key: string) {
    if (!data?.testOnly || data.transferExecutionEnabled !== false) {
      setNotice({ kind: "error", text: "This console refuses any record that is not explicitly isolated test data." });
      return false;
    }
    setBusyKey(key);
    setNotice(null);
    try {
      const result = await fetch("/api/job-operations", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, requestId: data.job.requestId, ...values }),
      });
      const payload = await result.json().catch(() => ({})) as Record<string, unknown>;
      setNotice({ kind: result.ok ? "success" : "error", text: operationMessage(payload, result.ok) });
      if (result.ok) await load(data.job.requestId, true);
      return result.ok;
    } catch {
      setNotice({ kind: "error", text: "The test operation could not be recorded." });
      return false;
    } finally {
      setBusyKey("");
    }
  }

  const role = data?.actorRole;
  const isBusy = (action: string, id = "new") => busyKey === `${action}:${id}`;
  const currentScopeRequirements = (data?.job.serviceCodes || [])
    .filter(isServiceCode)
    .map((serviceCode) => ({
      serviceCode,
      ...jobScopeRequirementsForService(serviceCode),
    }));
  const currentAllowedOperations = currentScopeRequirements
    .flatMap((item) => item.allowedOperations.map((operation) => `${item.serviceCode}:${operation}`));
  const currentProhibitedOperations = [...new Set(
    currentScopeRequirements.flatMap((item) => item.prohibitedOperations),
  )];

  return (
    <section className="job-operations-console" aria-labelledby="job-console-title">
      <div className="job-console-warning" role="note">
        <strong>Isolated test console -- no employment and no live money</strong>
        <p>TUVELOZ does not employ providers or trainees. Only a signed-in customer, independent provider, or verified owner tied to a persisted test job can use these controls. This screen cannot create a real job, charge, refund, payout, transfer, or transfer reversal.</p>
      </div>

      <h2 id="job-console-title">Open a test job record</h2>
      <form className="job-console-picker" onSubmit={(event) => { event.preventDefault(); void load(requestId); }}>
        <label>
          Request ID
          <input value={requestId} onChange={(event) => setRequestId(event.target.value)} placeholder="Persisted test request ID" required />
        </label>
        <button disabled={loading} type="submit">{loading ? "Loading..." : "Load test job"}</button>
      </form>
      {notice && <p className={`job-console-notice ${notice.kind}`} role={notice.kind === "error" ? "alert" : "status"}>{notice.text}</p>}

      {data && (
        <div className="job-console-results">
          <div className="job-console-overview">
            <div><span>Signed-in role</span><strong>{words(data.actorRole)}</strong></div>
            <div><span>Job status</span><strong>{words(data.job.status)}</strong></div>
            <div><span>Scope version</span><strong>{data.job.scopeVersion}</strong></div>
            <div><span>Scheduled</span><strong>{when(data.job.scheduledFor)}</strong></div>
          </div>
          <p className="job-console-scope"><strong>Exact services:</strong> {list(data.job.serviceCodes)}</p>

          <section className="job-action-section">
            <h2>Controlled test actions</h2>
            <p>The server rechecks identity, role, accepted assignment, test isolation, exact scope, current eligibility, and open holds. A denied action remains denied even if a browser form is changed.</p>
            <div className="job-action-grid">
              {role === "provider" && <>
                <OperationForm
                  title="Propose change order"
                  role="Independent provider only"
                  action="propose-change-order"
                  busy={isBusy("propose-change-order")}
                  onSubmit={submit}
                  fields={[
                    { name: "serviceCodes", label: "Complete exact service codes (comma-separated)", type: "comma-list", required: true, placeholder: data.job.serviceCodes.join(", ") },
                    { name: "requestedOperations", label: "Exact allowed operations (service_code:operation_code, comma-separated)", type: "operation-list", required: true, placeholder: currentAllowedOperations.join(", ") },
                    { name: "prohibitedOperationsAttestedAbsent", label: "Attest every prohibited operation or condition is absent (exact codes, comma-separated)", type: "comma-list", required: true, placeholder: currentProhibitedOperations.join(", ") },
                    { name: "scopeDescription", label: "Complete changed scope", type: "textarea", required: true },
                    { name: "reason", label: "Reason for change", type: "textarea", required: true },
                    { name: "partsResponsibility", label: "Who supplies and owns the parts", required: true },
                    { name: "scheduledFor", label: "Customer-approved changed work time (blank keeps current schedule)", type: "datetime-local" },
                    { name: "jobLocationType", label: "Exact work-location type", type: "select", required: true, options: [...JOB_LOCATION_TYPE_OPTIONS] },
                    { name: "serviceAddress", label: "Exact service address or roadside position", required: true },
                    { name: "propertyPermission", label: "Property authority", type: "select", required: true, options: JOB_PROPERTY_PERMISSION_VALUES.map((value) => ({ label: words(value), value })) },
                    { name: "vehicleDriveability", label: "Vehicle driveability", type: "select", required: true, options: JOB_VEHICLE_DRIVEABILITY_VALUES.map((value) => ({ label: words(value), value })) },
                    { name: "vehicleState", label: "Vehicle state", type: "select", required: true, options: JOB_VEHICLE_STATE_VALUES.map((value) => ({ label: words(value), value })) },
                    { name: "highVoltageStatus", label: "High-voltage status", type: "select", required: true, options: JOB_HIGH_VOLTAGE_STATUS_VALUES.map((value) => ({ label: words(value), value })) },
                    { name: "safetyAttestations", label: "Required location and safety attestations (exact codes, comma-separated)", type: "comma-list", required: true, placeholder: JOB_SAFETY_ATTESTATION_CODES.join(", ") },
                    ...amountFields,
                  ]}
                  warning="Use only the exact allowed operation codes shown for the selected services. Work and the timer stop until the customer authorizes the complete facts, schedule, scope, and price."
                />
                <OperationForm
                  title="Save provider invoice"
                  role="Independent provider only"
                  action="submit-invoice"
                  busy={isBusy("submit-invoice")}
                  onSubmit={submit}
                  fields={[
                    { name: "status", label: "Invoice status", type: "select", required: true, options: [{ label: "Draft", value: "draft" }, { label: "Final", value: "final" }] },
                    ...amountFields,
                    { name: "totalAmountCents", label: "Total amount (cents; must equal all items)", type: "number", min: 0, required: true },
                    { name: "workSummary", label: "Work summary", type: "textarea", required: true },
                    { name: "partsDescription", label: "Parts description", type: "textarea" },
                    { name: "returnedPartsChoice", label: "Returned-parts treatment", type: "select", required: true, options: [{ label: "Returned", value: "returned" }, { label: "Customer declined", value: "customer_declined" }, { label: "Not applicable", value: "not_applicable" }] },
                    { name: "warrantyProvider", label: "Warranty source", type: "select", required: true, options: [{ label: "Provider business", value: "provider_business" }, { label: "Manufacturer", value: "manufacturer" }, { label: "No written warranty disclosed", value: "none_disclosed" }] },
                    { name: "warrantyTerms", label: "Specific warranty terms or no-warranty disclosure", type: "textarea", required: true },
                  ]}
                  warning="A final invoice is immutable, requires completed authorized work, and must exactly match the customer-authorized provider amount."
                />
              </>}

              {(role === "customer" || role === "provider") && <>
                <OperationForm
                  title="Report cancellation or no-show"
                  role="Customer or independent provider"
                  action="report-cancellation"
                  busy={isBusy("report-cancellation")}
                  onSubmit={submit}
                  fields={[
                    { name: "cancellationType", label: "Report type", type: "select", required: true, options: [
                      { label: "Customer cancellation", value: "customer_cancel" },
                      { label: "Provider cancellation", value: "provider_cancel" },
                      { label: "Customer no-show", value: "customer_no_show" },
                      { label: "Provider no-show", value: "provider_no_show" },
                    ] },
                    { name: "reason", label: "What happened", type: "textarea", required: true },
                    { name: "providerTravelStarted", label: "Provider travel had started", type: "checkbox" },
                    { name: "partsCommittedCents", label: "Claimed committed parts (provider only, cents)", type: "number", min: 0, defaultValue: 0 },
                    { name: "workPerformedCents", label: "Claimed authorized work performed (provider only, cents)", type: "number", min: 0, defaultValue: 0 },
                  ]}
                  warning="This stops work for review. It does not calculate or send a refund."
                />
                <OperationForm
                  title="Report incident or claim"
                  role="Customer or independent provider"
                  action="report-incident"
                  busy={isBusy("report-incident")}
                  onSubmit={submit}
                  fields={[
                    { name: "incidentType", label: "Incident type", type: "select", required: true, options: [
                      { label: "Injury", value: "injury" }, { label: "Property damage", value: "property_damage" },
                      { label: "Service-quality claim", value: "service_quality_claim" }, { label: "Fraud", value: "fraud" },
                      { label: "Harassment", value: "harassment" }, { label: "Other", value: "other" },
                    ] },
                    { name: "severity", label: "Severity", type: "select", required: true, options: [
                      { label: "Low", value: "low" }, { label: "Moderate", value: "moderate" },
                      { label: "Serious", value: "serious" }, { label: "Emergency", value: "emergency" },
                    ] },
                    { name: "summary", label: "What happened", type: "textarea", required: true },
                    { name: "occurredAt", label: "When it happened (blank means now)", type: "datetime-local" },
                    { name: "locationSummary", label: "Location summary" },
                    { name: "injuryReported", label: "An injury was reported", type: "checkbox" },
                    { name: "propertyDamageReported", label: "Property damage was reported", type: "checkbox" },
                    { name: "emergencyServicesContacted", label: "Emergency services were contacted", type: "checkbox" },
                  ]}
                  warning="Every incident places a payment hold. Serious, emergency, injury, or property-damage reports also stop work. This is not emergency dispatch -- call 911 when needed."
                />
                <OperationForm
                  title="Stop work for safety"
                  role="Customer or independent provider"
                  action="stop-work"
                  busy={isBusy("stop-work")}
                  onSubmit={submit}
                  fields={[
                    { name: "severity", label: "Severity", type: "select", required: true, options: [{ label: "Low", value: "low" }, { label: "Moderate", value: "moderate" }, { label: "Serious", value: "serious" }, { label: "Emergency", value: "emergency" }] },
                    { name: "summary", label: "Safety reason", type: "textarea", required: true },
                    { name: "occurredAt", label: "When it happened (blank means now)", type: "datetime-local" },
                    { name: "locationSummary", label: "Location summary" },
                    { name: "injuryReported", label: "An injury was reported", type: "checkbox" },
                    { name: "propertyDamageReported", label: "Property damage was reported", type: "checkbox" },
                    { name: "emergencyServicesContacted", label: "Emergency services were contacted", type: "checkbox" },
                  ]}
                  warning="This immediately stops the provider timer and places a payment hold."
                />
                <OperationForm
                  title="Request refund review"
                  role="Customer or independent provider"
                  action="request-refund"
                  busy={isBusy("request-refund")}
                  onSubmit={submit}
                  fields={[
                    { name: "amountCents", label: "Requested amount (cents)", type: "number", min: 1, required: true },
                    { name: "reasonCode", label: "Reason", type: "select", required: true, options: [
                      { label: "Cancellation", value: "cancellation" }, { label: "Provider no-show", value: "provider_no_show" },
                      { label: "Work not performed", value: "work_not_performed" }, { label: "Unauthorized charge", value: "unauthorized_charge" },
                      { label: "Service quality", value: "service_quality" }, { label: "Other", value: "other" },
                    ] },
                    { name: "explanation", label: "Explanation", type: "textarea", required: true },
                  ]}
                  warning="This creates a test review record only. It never sends money or calls Stripe."
                />
              </>}

              {role === "customer" && data.changeOrders.filter((item) => item.status === "pending_customer").map((item) => <div className="job-action-pair" key={`customer-change-${item.id}`}>
                <OperationForm
                  title={`Authorize change ${String(item.id).slice(0, 8)}`}
                  role="Customer only"
                  action="authorize-change-order"
                  fixed={{ changeOrderId: item.id, decision: "authorize" }}
                  busy={isBusy("authorize-change-order", String(item.id))}
                  onSubmit={submit}
                  fields={[
                    { name: "acceptedByName", label: "Type your name", required: true },
                    { name: "authorizationAccepted", label: "I affirmatively authorize this complete stored scope and price before added work begins.", type: "checkbox", required: true },
                  ]}
                />
                <OperationForm
                  title={`Decline change ${String(item.id).slice(0, 8)}`}
                  role="Customer only"
                  action="authorize-change-order"
                  fixed={{ changeOrderId: item.id, decision: "decline" }}
                  busy={isBusy("authorize-change-order", String(item.id))}
                  onSubmit={submit}
                />
              </div>)}

              {role === "customer" && data.invoices.filter((item) => item.status === "final").map((item) => <OperationForm
                key={`invoice-view-${item.id}`}
                title={`Record invoice ${words(item.invoiceNumber)} viewed`}
                role="Customer only"
                action="acknowledge-invoice"
                fixed={{ invoiceId: item.id }}
                busy={isBusy("acknowledge-invoice", String(item.id))}
                onSubmit={submit}
                warning="Viewing records delivery only. It does not accept disputed work or waive any right."
              />)}

              {role === "owner" && <>
                {data.cancellations.filter((item) => ["submitted", "under_review"].includes(String(item.status))).map((item) => <OperationForm
                  key={`cancel-decision-${item.id}`}
                  title={`Decide cancellation ${String(item.id).slice(0, 8)}`}
                  role="Verified owner only"
                  action="decide-cancellation"
                  fixed={{ cancellationId: item.id }}
                  busy={isBusy("decide-cancellation", String(item.id))}
                  onSubmit={submit}
                  fields={[
                    { name: "decision", label: "Decision", type: "select", required: true, options: [{ label: "Approve (test only)", value: "approve" }, { label: "Deny", value: "deny" }] },
                    { name: "proposedRefundCents", label: "Proposed test refund (cents)", type: "number", min: 0, required: true },
                    { name: "retainedAmountCents", label: "Proposed retained amount (cents)", type: "number", min: 0, required: true },
                    { name: "decisionReason", label: "Decision reason", type: "textarea", required: true },
                  ]}
                  warning="No Stripe refund is created. Final schedules and allocation still require approved rules."
                />)}
                {data.incidents.filter((item) => ["open", "under_review", "insurer_review"].includes(String(item.status))).map((item) => <OperationForm
                  key={`incident-decision-${item.id}`}
                  title={`Resolve incident ${String(item.id).slice(0, 8)}`}
                  role="Verified owner only"
                  action="resolve-incident"
                  fixed={{ incidentId: item.id }}
                  busy={isBusy("resolve-incident", String(item.id))}
                  onSubmit={submit}
                  fields={[
                    { name: "resolution", label: "Complete resolution", type: "textarea", required: true },
                    { name: "insurerNotified", label: "Required insurer notice was made", type: "checkbox" },
                    { name: "releasePaymentHold", label: "Explicitly release this incident payment hold", type: "checkbox" },
                  ]}
                  warning="Injury and property-damage incidents cannot close without insurer notice. Leaving release unchecked keeps the payment hold."
                />)}
                {data.paymentAdjustments.filter((item) => item.adjustmentType === "refund_request" && item.status === "requested").map((item) => <OperationForm
                  key={`refund-decision-${item.id}`}
                  title={`Decide refund ${String(item.id).slice(0, 8)}`}
                  role="Verified owner only"
                  action="decide-refund"
                  fixed={{ adjustmentId: item.id }}
                  busy={isBusy("decide-refund", String(item.id))}
                  onSubmit={submit}
                  fields={[
                    { name: "decision", label: "Decision", type: "select", required: true, options: [{ label: "Approve (test record only)", value: "approve" }, { label: "Deny", value: "deny" }] },
                    { name: "decisionReason", label: "Decision reason", type: "textarea", required: true },
                  ]}
                  warning="Approval records an accounting decision only. It never calls Stripe."
                />)}
                <OperationForm
                  title="Place reserve or dispute hold"
                  role="Verified owner only"
                  action="record-payment-hold"
                  busy={isBusy("record-payment-hold")}
                  onSubmit={submit}
                  fields={[
                    { name: "adjustmentType", label: "Hold type", type: "select", required: true, options: [{ label: "Reserve", value: "reserve" }, { label: "Dispute", value: "dispute" }] },
                    { name: "amountCents", label: "Held amount (cents)", type: "number", min: 1, required: true },
                    { name: "reasonCode", label: "Controlled reason code", required: true },
                    { name: "explanation", label: "Explanation", type: "textarea", required: true },
                  ]}
                />
                {data.paymentAdjustments.filter((item) => ["reserve", "dispute"].includes(String(item.adjustmentType)) && item.status === "active").map((item) => <OperationForm
                  key={`hold-resolution-${item.id}`}
                  title={`Resolve ${words(item.adjustmentType)} ${String(item.id).slice(0, 8)}`}
                  role="Verified owner only"
                  action="resolve-payment-hold"
                  fixed={{ adjustmentId: item.id }}
                  busy={isBusy("resolve-payment-hold", String(item.id))}
                  onSubmit={submit}
                  fields={[{ name: "resolution", label: "Resolution", type: "textarea", required: true }]}
                />)}
                <OperationForm
                  title="Run fail-closed payout review"
                  role="Verified owner only"
                  action="review-payout"
                  busy={isBusy("review-payout")}
                  onSubmit={submit}
                  warning="This records a test readiness result only. Even an allowed result creates no transfer and does not enable live money."
                />
              </>}
            </div>
          </section>

          <RecordSection title="Cancellations and no-shows" records={data.cancellations} empty="No cancellation or no-show record exists.">
            {(item) => <><h3>{words(item.cancellationType)}</h3><p><strong>Status:</strong> {words(item.status)} / <strong>Reported by:</strong> {words(item.requestedByRole)} / <strong>Notice:</strong> {words(item.noticeHours)} hours</p><p>{words(item.reason)}</p><p>Parts claimed: {money(item.partsCommittedCents)} / authorized work claimed: {money(item.workPerformedCents)} / proposed refund: {money(item.proposedRefundCents)} / retained: {money(item.retainedAmountCents)}</p>{item.decisionReason && <p><strong>Decision:</strong> {words(item.decisionReason)}</p>}</>}
          </RecordSection>

          <RecordSection title="Incidents, claims, and stop-work" records={data.incidents} empty="No incident or claim record exists.">
            {(item) => <><h3>{words(item.incidentType)} / {words(item.severity)}</h3><p><strong>Status:</strong> {words(item.status)} / <strong>payment hold:</strong> {words(item.holdPayments)} / <strong>occurred:</strong> {when(item.occurredAt)}</p><p>{words(item.summary)}</p><p>Injury: {words(item.injuryReported)} / property damage: {words(item.propertyDamageReported)} / emergency services: {words(item.emergencyServicesContacted)}</p>{item.resolution && <p><strong>Resolution:</strong> {words(item.resolution)}</p>}</>}
          </RecordSection>

          <RecordSection title="Change orders" records={data.changeOrders} empty="No scope or price change has been proposed.">
            {(item) => <><h3>Scope {words(item.priorScopeVersion)} -&gt; {words(item.proposedScopeVersion)}</h3><p><strong>Status:</strong> {words(item.status)} / <strong>services:</strong> {list(item.serviceCodes)}</p><p>{objectText(item.scopeDetails)}</p><p>{objectText(item.priceBreakdown)}</p><p><strong>Reason:</strong> {words(item.reason)}</p></>}
          </RecordSection>

          <RecordSection title="Provider invoices and warranty" records={data.invoices} empty="No provider invoice exists.">
            {(item) => <><h3>{words(item.invoiceNumber)} / {words(item.status)}</h3><p>Labor {money(item.laborAmountCents)} / parts {money(item.partsAmountCents)} / tax {money(item.taxAmountCents)} / other {money(item.otherAmountCents)} / <strong>total {money(item.totalAmountCents)}</strong></p><p>{words(item.workSummary)}</p><p><strong>Parts:</strong> {words(item.partsDescription)} / {words(item.returnedPartsChoice)}</p><p><strong>Warranty:</strong> {words(item.warrantyProvider)} -- {words(item.warrantyTerms)}</p></>}
          </RecordSection>

          <RecordSection title="Refunds, reserves, and disputes" records={data.paymentAdjustments} empty="No payment adjustment or hold exists.">
            {(item) => <><h3>{words(item.adjustmentType)} / {words(item.status)}</h3><p><strong>Amount:</strong> {money(item.amountCents)} / <strong>reason:</strong> {words(item.reasonCode)} / <strong>requested by:</strong> {words(item.requestedByRole)}</p><p>Provider impact: {money(item.providerImpactCents)} / customer impact: {money(item.customerImpactCents)}</p></>}
          </RecordSection>

          <RecordSection title="Immutable lifecycle history" records={data.lifecycle} empty="No lifecycle event exists yet.">
            {(item) => <><h3>{words(item.eventType)}</h3><p><strong>When:</strong> {when(item.occurredAt)} / <strong>actor:</strong> {words(item.actorRole)} / <strong>scope:</strong> {words(item.scopeVersion)}</p><p>{words(item.fromStatus)} -&gt; {words(item.toStatus)} / reason: {words(item.reasonCode)}</p></>}
          </RecordSection>
        </div>
      )}
    </section>
  );
}
