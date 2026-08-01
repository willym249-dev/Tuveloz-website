"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { BrandMark } from "../components/tuveloz-icons";

type LineItem = {
  lineType: string;
  description: string;
  partNumber: string;
  partCondition: string;
  quantity: number;
  unitAmountCents: number;
  lineAmountCents: number;
  laborMinutes: number;
  mechanicIdentifier: string;
};

type Authorization = Record<string, unknown> & {
  id: string;
  status: string;
  documentHash: string;
  customerSignatureAt: string;
  lineItems: LineItem[];
};

type Invoice = Record<string, unknown> & {
  id: string;
  invoiceNumber: string;
  status: string;
  documentHash: string;
  customerSignatureAt: string;
  customerCopyDeliveredAt: string;
  lineItems: LineItem[];
};

type RepairJob = {
  requestId: string;
  requestStatus: string;
  vehicle: string;
  service: string;
  serviceCodes: string;
  jurisdiction: string;
  municipality: string;
  serviceAddress: string;
  customerName: string;
  customerEmail: string;
  quoteId: string;
  quotePriceCents: string;
  scopeVersion: number;
  providerId: string;
  providerName: string;
  providerEmail: string;
  providerBusinessAddress: string;
  authorization: Authorization | null;
  invoice: Invoice | null;
};

type RepairData = {
  testOnly: true;
  realJobsEnabled: false;
  role: "customer" | "provider";
  email: string;
  version: string;
  legalNotices: {
    customerRightsHeading: string;
    customerRightsText: string;
    writtenEstimateStandard: string;
    manufacturerNotice: string;
    responsibilityNotice: string;
    electronicSignatureNotice: string;
  };
  jobs: RepairJob[];
};

const sampleLines = JSON.stringify([
  {
    lineType: "labor",
    description: "Describe the exact authorized labor",
    partNumber: "",
    partCondition: "not_applicable",
    quantity: 1,
    unitAmountCents: 10000,
    lineAmountCents: 10000,
    laborMinutes: 60,
    mechanicIdentifier: "TECH-1"
  }
], null, 2);

function money(value: unknown) {
  const cents = Number(value);
  return Number.isFinite(cents)
    ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100)
    : "Not recorded";
}

function when(value: unknown) {
  const date = new Date(String(value || ""));
  return Number.isFinite(date.getTime()) ? date.toLocaleString() : "Not recorded";
}

function text(value: unknown) {
  return String(value ?? "");
}

function LineItems({ items }: { items: LineItem[] }) {
  if (!items.length) return <p>No itemized lines saved.</p>;
  return (
    <div className="repair-record-table-wrap">
      <table className="repair-record-table">
        <thead><tr><th>Type</th><th>Description</th><th>Part</th><th>Condition</th><th>Qty</th><th>Amount</th><th>Mechanic</th></tr></thead>
        <tbody>{items.map((item, index) => (
          <tr key={`${item.description}-${index}`}>
            <td>{item.lineType}</td>
            <td>{item.description}</td>
            <td>{item.partNumber || "—"}</td>
            <td>{item.partCondition}</td>
            <td>{item.quantity}</td>
            <td>{money(item.lineAmountCents)}</td>
            <td>{item.mechanicIdentifier || "—"}</td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

function Field({ label, name, defaultValue = "", type = "text", required = true }: {
  label: string;
  name: string;
  defaultValue?: string | number;
  type?: string;
  required?: boolean;
}) {
  return <label>{label}<input defaultValue={defaultValue} name={name} required={required} type={type} /></label>;
}

export default function RepairRecordsPage() {
  const [data, setData] = useState<RepairData | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    setError("");
    const response = await fetch("/api/repair-records", { cache: "no-store" });
    const result = await response.json().catch(() => ({})) as RepairData & { error?: string };
    if (!response.ok) throw new Error(result.error || "Unable to load repair records.");
    setData(result);
    setSelectedId((current) => current || result.jobs[0]?.requestId || "");
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      load().catch((reason) => setError(reason instanceof Error ? reason.message : "Unable to load repair records."));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const job = useMemo(
    () => data?.jobs.find((item) => item.requestId === selectedId) ?? null,
    [data, selectedId],
  );

  async function post(action: string, values: Record<string, unknown>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/repair-records", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, requestId: selectedId, ...values }),
      });
      const result = await response.json().catch(() => ({})) as RepairData & { error?: string; status?: string };
      if (!response.ok) throw new Error(result.error || "The repair record was not saved.");
      setData(result);
      setNotice(`Saved: ${result.status || "repair record updated"}.`);
      return true;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The repair record was not saved.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  function valuesFromForm(form: HTMLFormElement) {
    const formData = new FormData(form);
    const result: Record<string, unknown> = {};
    for (const [key, value] of formData.entries()) {
      if (key === "providerCertified" || key === "signatureAccepted") {
        result[key] = true;
      } else if (["odometerReading", "estimateFeeCents", "surchargeCents"].includes(key)) {
        result[key] = Number(String(value));
      } else if (key === "mechanicIdentifiers") {
        result[key] = String(value).split(",").map((item) => item.trim()).filter(Boolean);
      } else {
        result[key] = String(value).trim();
      }
    }
    return result;
  }

  async function submitAuthorization(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = valuesFromForm(event.currentTarget);
    try {
      values.lineItems = JSON.parse(String(values.lineItems || "[]"));
    } catch {
      return setError("The itemized estimate lines must be valid JSON.");
    }
    await post("save-authorization", values);
  }

  async function submitInvoice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = valuesFromForm(event.currentTarget);
    try {
      values.lineItems = JSON.parse(String(values.lineItems || "[]"));
    } catch {
      return setError("The itemized invoice lines must be valid JSON.");
    }
    await post("save-invoice", values);
  }

  async function submitSignature(event: FormEvent<HTMLFormElement>, action: "sign-authorization" | "sign-invoice") {
    event.preventDefault();
    await post(action, valuesFromForm(event.currentTarget));
  }

  return (
    <main className="admin-shell repair-record-shell">
      <header className="admin-header">
        <Link className="brand" href="/"><BrandMark /><span>Tuveloz</span></Link>
        <div><span>Private repair records</span><Link href="/job-operations">Job operations</Link><Link href="/account">Account</Link></div>
      </header>

      <section className="admin-intro">
        <span className="kicker">Written estimate · authorization · itemized provider invoice</span>
        <h1>Maryland repair-document test workflow</h1>
        <p>
          This workspace records an exact provider estimate, customer authorization,
          itemized final provider invoice, electronic signatures, customer copy, and
          provider retained copy. It is restricted to isolated test jobs. It cannot
          create a real job, charge a customer, release payment, or activate a provider.
        </p>
        {error && <p className="form-error" role="alert">{error}</p>}
        {notice && <p className="portal-success" role="status">{notice}</p>}
      </section>

      {!data && !error && <p className="admin-note">Loading repair records…</p>}
      {data && (
        <>
          <section className="admin-section">
            <h2>Select an isolated test job</h2>
            {data.jobs.length === 0 ? <p>No accepted isolated test job is available for this account.</p> : (
              <label>Job<select value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
                {data.jobs.map((item) => <option key={item.requestId} value={item.requestId}>{item.vehicle} · {item.service} · {item.requestStatus}</option>)}
              </select></label>
            )}
          </section>

          {job && data.role === "provider" && (
            <>
              <section className="admin-section">
                <h2>1. Provider written estimate and repair authorization</h2>
                <p>Save a draft first. Presenting the record freezes its contents so the customer can review and sign the exact version.</p>
                <form className="repair-record-form" onSubmit={submitAuthorization}>
                  <div className="repair-record-grid">
                    <Field label="Provider business name" name="providerBusinessName" defaultValue={text(job.authorization?.providerBusinessName || job.providerName)} />
                    <Field label="Provider business address" name="providerBusinessAddress" defaultValue={text(job.authorization?.providerBusinessAddress || job.providerBusinessAddress)} />
                    <Field label="Provider business phone" name="providerBusinessPhone" defaultValue={text(job.authorization?.providerBusinessPhone)} />
                    <Field label="Montgomery County registration number" name="countyRegistrationNumber" defaultValue={text(job.authorization?.countyRegistrationNumber)} />
                    <Field label="Customer name" name="customerName" defaultValue={text(job.authorization?.customerName || job.customerName)} />
                    <Field label="Customer address" name="customerAddress" defaultValue={text(job.authorization?.customerAddress || job.serviceAddress)} />
                    <Field label="Vehicle year" name="vehicleYear" defaultValue={text(job.authorization?.vehicleYear)} />
                    <Field label="Vehicle make and model" name="vehicleMakeModel" defaultValue={text(job.authorization?.vehicleMakeModel || job.vehicle)} />
                    <Field label="Vehicle tag" name="vehicleTag" defaultValue={text(job.authorization?.vehicleTag)} />
                    <Field label="VIN (optional)" name="vehicleVin" defaultValue={text(job.authorization?.vehicleVin)} required={false} />
                    <Field label="Odometer reading" name="odometerReading" defaultValue={Number(job.authorization?.odometerReading || 0)} type="number" />
                    <label>Labor billing method<select defaultValue={text(job.authorization?.laborBillingMethod || "")} name="laborBillingMethod" required>
                      <option disabled value="">Choose one</option><option value="clock_hour">Clock hour</option><option value="flat_rate_manual">Industry flat-rate manual</option><option value="other_flat_rate">Other disclosed flat-rate measure</option>
                    </select></label>
                    <Field label="Estimated completion date/time" name="estimatedCompletionAt" defaultValue={text(job.authorization?.estimatedCompletionAt).slice(0, 16)} type="datetime-local" required={false} />
                    <Field label="Estimate fee (cents; 0 if none)" name="estimateFeeCents" defaultValue={Number(job.authorization?.estimateFeeCents || 0)} type="number" />
                    <Field label="Surcharge (cents; 0 if none)" name="surchargeCents" defaultValue={Number(job.authorization?.surchargeCents || 0)} type="number" />
                    <Field label="Provider representative name" name="providerRepresentativeName" defaultValue={text(job.authorization?.providerRepresentativeName)} />
                    <Field label="Provider representative title" name="providerRepresentativeTitle" defaultValue={text(job.authorization?.providerRepresentativeTitle)} />
                  </div>
                  <label>Customer instructions or description of symptoms<textarea defaultValue={text(job.authorization?.customerInstructions)} name="customerInstructions" required rows={4} /></label>
                  <label>Provider diagnosis<textarea defaultValue={text(job.authorization?.providerDiagnosis)} name="providerDiagnosis" required rows={4} /></label>
                  <label>Complete labor billing disclosure<textarea defaultValue={text(job.authorization?.laborDisclosure)} name="laborDisclosure" required rows={3} /></label>
                  <label>Completion disclosure when a date cannot be determined<textarea defaultValue={text(job.authorization?.completionDisclosure)} name="completionDisclosure" rows={2} /></label>
                  <label>Surcharge description when a surcharge applies<textarea defaultValue={text(job.authorization?.surchargeDescription)} name="surchargeDescription" rows={2} /></label>
                  <label>Replaced-parts handling<select defaultValue={text(job.authorization?.replacedPartsChoice || "return")} name="replacedPartsChoice" required>
                    <option value="return">Return replaced parts to customer</option><option value="customer_declined">Customer expressly declined return</option><option value="warranty_return">Part must be returned under warranty</option><option value="not_applicable">No replaced parts</option>
                  </select></label>
                  <label>Itemized estimate lines (JSON)<textarea defaultValue={job.authorization?.lineItems?.length ? JSON.stringify(job.authorization.lineItems.map(({ id: _id, sortOrder: _sort, ...item }) => item), null, 2) : sampleLines} name="lineItems" required rows={18} /></label>
                  <label className="job-operation-check"><input name="providerCertified" type="checkbox" /><span>I certify the provider information and itemized estimate are accurate. This checkbox is required when presenting the record.</span></label>
                  <div className="repair-record-actions">
                    <button disabled={busy} name="status" type="submit" value="draft">Save draft</button>
                    <button disabled={busy} name="status" type="submit" value="presented">Present exact record to customer</button>
                  </div>
                </form>
              </section>

              <section className="admin-section">
                <h2>2. Provider final invoice</h2>
                <p>The customer must sign the authorization first. The final invoice cannot issue until the test job is completed and its itemized provider total matches the signed authorization.</p>
                <form className="repair-record-form" onSubmit={submitInvoice}>
                  <label>All work performed, including warranty work<textarea defaultValue={text(job.invoice?.workSummary)} name="workSummary" required rows={5} /></label>
                  <label>Warranty work statement<textarea defaultValue={text(job.invoice?.warrantyWorkStatement)} name="warrantyWorkStatement" required rows={3} /></label>
                  <label>Warranty provider<select defaultValue={text(job.invoice?.warrantyProvider || "")} name="warrantyProvider" required>
                    <option disabled value="">Choose one</option><option value="provider_business">Provider business express warranty</option><option value="manufacturer">Manufacturer or supplier warranty</option><option value="none_offered">No provider express warranty offered</option>
                  </select></label>
                  <label>Specific warranty terms and limitations<textarea defaultValue={text(job.invoice?.warrantyTerms)} name="warrantyTerms" required rows={4} /></label>
                  <label>Final replaced-parts result<select defaultValue={text(job.invoice?.returnedPartsChoice || "returned")} name="returnedPartsChoice" required>
                    <option value="returned">Returned to customer</option><option value="customer_declined">Customer expressly declined return</option><option value="warranty_return">Returned under warranty requirement</option><option value="not_applicable">No replaced parts</option>
                  </select></label>
                  <Field label="Mechanic names, initials, or numbers (comma-separated)" name="mechanicIdentifiers" defaultValue={(() => { try { return JSON.parse(text(job.invoice?.mechanicIdentifiers || "[]")).join(", "); } catch { return ""; } })()} />
                  <Field label="Provider representative name" name="providerRepresentativeName" defaultValue={text(job.invoice?.providerRepresentativeName)} />
                  <Field label="Provider representative title" name="providerRepresentativeTitle" defaultValue={text(job.invoice?.providerRepresentativeTitle)} />
                  <label>Itemized final invoice lines (JSON)<textarea defaultValue={job.invoice?.lineItems?.length ? JSON.stringify(job.invoice.lineItems.map(({ id: _id, sortOrder: _sort, ...item }) => item), null, 2) : sampleLines} name="lineItems" required rows={18} /></label>
                  <label className="job-operation-check"><input name="providerCertified" type="checkbox" /><span>I certify the listed work and parts were needed and performed or supplied, and the vehicle was tested or test driven when needed. Required for final invoice.</span></label>
                  <div className="repair-record-actions">
                    <button disabled={busy} name="status" type="submit" value="draft">Save invoice draft</button>
                    <button disabled={busy} name="status" type="submit" value="final">Issue immutable final provider invoice</button>
                  </div>
                </form>
              </section>
            </>
          )}

          {job && data.role === "customer" && (
            <>
              <section className="admin-section repair-print-document">
                <h2>Provider written estimate and repair authorization</h2>
                {!job.authorization ? <p>The provider has not prepared the authorization.</p> : (
                  <>
                    <p><strong>Status:</strong> {job.authorization.status}</p>
                    <p><strong>Provider:</strong> {text(job.authorization.providerBusinessName)} · Registration {text(job.authorization.countyRegistrationNumber)}</p>
                    <p><strong>Vehicle:</strong> {text(job.authorization.vehicleYear)} {text(job.authorization.vehicleMakeModel)} · Tag {text(job.authorization.vehicleTag)} · Odometer {text(job.authorization.odometerReading)}</p>
                    <p><strong>Your instructions:</strong> {text(job.authorization.customerInstructions)}</p>
                    <p><strong>Provider diagnosis:</strong> {text(job.authorization.providerDiagnosis)}</p>
                    <p><strong>Estimated completion:</strong> {when(job.authorization.estimatedCompletionAt)} {text(job.authorization.completionDisclosure)}</p>
                    <LineItems items={job.authorization.lineItems} />
                    <p><strong>Authorized provider total:</strong> {money(job.authorization.totalAmountCents)}</p>
                    <div className="repair-legal-notice"><strong>{data.legalNotices.manufacturerNotice.split("\n")[0]}</strong><p>{data.legalNotices.manufacturerNotice.split("\n").slice(1).join(" ")}</p></div>
                    <div className="repair-legal-notice"><p>{data.legalNotices.responsibilityNotice}</p></div>
                    <div className="repair-customer-rights">
                      <h3>{data.legalNotices.customerRightsHeading}</h3>
                      <p>{data.legalNotices.customerRightsText}</p>
                    </div>
                    {job.authorization.status === "presented" && (
                      <form className="repair-signature-form" onSubmit={(event) => submitSignature(event, "sign-authorization")}>
                        <p>{data.legalNotices.electronicSignatureNotice}</p>
                        <Field label="Type your full name" name="acceptedByName" />
                        <label className="job-operation-check"><input name="signatureAccepted" required type="checkbox" /><span>I reviewed the complete written estimate, Customer's Rights section, notices, itemized scope, parts, charges, and provider identity. I authorize only this exact stored record.</span></label>
                        <button disabled={busy} type="submit">Sign and authorize this exact record</button>
                      </form>
                    )}
                    {job.authorization.customerSignatureAt && <p className="portal-success">Signed {when(job.authorization.customerSignatureAt)}. Record hash: {job.authorization.documentHash}</p>}
                  </>
                )}
              </section>

              <section className="admin-section repair-print-document">
                <h2>Final provider invoice</h2>
                {!job.invoice ? <p>No provider invoice has been issued.</p> : (
                  <>
                    <p><strong>Invoice:</strong> {job.invoice.invoiceNumber} · {job.invoice.status}</p>
                    <p><strong>Provider:</strong> {text(job.invoice.providerBusinessName)} · Registration {text(job.invoice.countyRegistrationNumber)}</p>
                    <p><strong>Customer:</strong> {text(job.invoice.customerName)} · {text(job.invoice.customerAddress)}</p>
                    <p><strong>Vehicle:</strong> {text(job.invoice.vehicleYear)} {text(job.invoice.vehicleMakeModel)} · Tag {text(job.invoice.vehicleTag)} · Odometer {text(job.invoice.odometerReading)}</p>
                    <p><strong>Customer instructions:</strong> {text(job.invoice.customerInstructions)}</p>
                    <p><strong>Provider diagnosis:</strong> {text(job.invoice.providerDiagnosis)}</p>
                    <p><strong>Work performed:</strong> {text(job.invoice.workSummary)}</p>
                    <LineItems items={job.invoice.lineItems} />
                    <p><strong>Provider total:</strong> {money(job.invoice.totalAmountCents)}</p>
                    <p><strong>Mechanics:</strong> {text(job.invoice.mechanicIdentifiers)}</p>
                    <p><strong>Warranty:</strong> {text(job.invoice.warrantyTerms)}</p>
                    <p><strong>Replaced parts:</strong> {text(job.invoice.returnedPartsChoice)}</p>
                    <div className="repair-legal-notice"><strong>{data.legalNotices.manufacturerNotice.split("\n")[0]}</strong><p>{data.legalNotices.manufacturerNotice.split("\n").slice(1).join(" ")}</p></div>
                    <div className="repair-legal-notice"><p>{data.legalNotices.responsibilityNotice}</p></div>
                    {job.invoice.status === "final" && !job.invoice.customerSignatureAt && (
                      <form className="repair-signature-form" onSubmit={(event) => submitSignature(event, "sign-invoice")}>
                        <p>{data.legalNotices.electronicSignatureNotice}</p>
                        <Field label="Type your full name" name="acceptedByName" />
                        <label className="job-operation-check"><input name="signatureAccepted" required type="checkbox" /><span>I sign this exact provider invoice to record receipt. This does not waive a complaint, warranty claim, refund right, or any other non-waivable right.</span></label>
                        <button disabled={busy} type="submit">Sign invoice and receive secure copy</button>
                      </form>
                    )}
                    {job.invoice.customerSignatureAt && <p className="portal-success">Signed and delivered through the secure account on {when(job.invoice.customerCopyDeliveredAt)}. Provider retained copy recorded. Payment was not automatically released.</p>}
                    <button className="button secondary" onClick={() => window.print()} type="button">Print or save this secure copy</button>
                  </>
                )}
              </section>
            </>
          )}
        </>
      )}
    </main>
  );
}
