"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { COUNTY_REGISTRATION_SOURCE, type CountyRegistrationReceipt } from "../../../lib/county-registration";

export function CountyRegistrationCheck({ providerId, evidenceId, disabled }: {
  providerId: string; evidenceId: string; disabled: boolean;
}) {
  const [number, setNumber] = useState("");
  const [name, setName] = useState("");
  const [check, setCheck] = useState<CountyRegistrationReceipt | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const revision = useRef(0);
  useEffect(() => {
    const controller = new AbortController();
    const startedAt = revision.current;
    fetch(`/api/admin/provider-compliance?registrationEvidenceId=${encodeURIComponent(evidenceId)}`, {
      cache: "no-store", signal: controller.signal,
    }).then(async response => {
      if (!response.ok) throw new Error("Previous check could not be loaded.");
      const data = await response.json() as { check: CountyRegistrationReceipt | null };
      if (!controller.signal.aborted && revision.current === startedAt) setCheck(data.check);
    }).catch(() => {
      if (!controller.signal.aborted && revision.current === startedAt) setError("The previous check could not be loaded. You can run a new check.");
    });
    return () => controller.abort();
  }, [evidenceId]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    revision.current++;
    setBusy(true);
    setError("");
    setCheck(null);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    try {
      const response = await fetch("/api/admin/provider-compliance", {
        method: "POST", headers: { "content-type": "application/json" }, signal: controller.signal,
        body: JSON.stringify({ action: "check-county-registration", providerId, evidenceId,
          registrationNumber: number, expectedLegalName: name }),
      });
      const data = await response.json() as { check?: CountyRegistrationReceipt; error?: string };
      if (!response.ok || !data.check) throw new Error(data.error || "The county check could not be completed.");
      setCheck(data.check);
    } catch (reason) {
      setError(reason instanceof Error && reason.name !== "AbortError" ? reason.message
        : "The check timed out. Keep the document pending and try again.");
    } finally { clearTimeout(timeout); setBusy(false); }
  }

  return <section className="credential-card county-registration-check" aria-label="County registration check">
    <strong>Check the county registration</strong>
    <p>Enter the number and complete legal business name printed on the document. Tuveloz will compare them with the county’s records.</p>
    <form onSubmit={submit}>
      <fieldset className="credential-card" disabled={disabled || busy}>
        <label>Registration number
          <input required minLength={3} maxLength={40} value={number} onChange={event => { revision.current++; setNumber(event.target.value); setCheck(null); }} />
        </label>
        <label>Legal business name on the document
          <input required minLength={2} maxLength={180} value={name} onChange={event => { revision.current++; setName(event.target.value); setCheck(null); }} />
        </label>
        <button className="button secondary" type="submit">{busy ? "Checking county records…" : "Check county records"}</button>
      </fieldset>
    </form>
    {disabled && <p>Finish the current save or wait for a clean file safety scan before checking this document.</p>}
    {error && <p className="form-error" role="alert">{error}</p>}
    {check && <div role="status" className="credential-card">
      <strong>{check.status === "record_match" ? "County record found — confirmation still needed" : "County check needs follow-up"}</strong>
      <p>{check.message}</p>
      <p>Checked number: {check.registrationNumber}. Expected legal name: {check.expectedLegalName}.</p>
      {check.records.map((row, index) => <p key={`${row.registrationNumber}-${index}`}>
        {row.legalName}{row.tradeName ? ` (trading as ${row.tradeName})` : ""}<br />
        Registration {row.registrationNumber} · issued {row.issuedOn} · expires {row.expiresOn}
      </p>)}
      <p>Checked {new Date(check.checkedAt).toLocaleString()}
        {check.sourceUpdatedAt ? ` · County data updated ${new Date(check.sourceUpdatedAt).toLocaleDateString()}` : ""}
        <br />Saved receipt: {check.receiptId}</p>
    </div>}
    <p>This check does not approve the provider or confirm insurance. Ask OCP to confirm current standing and the services covered before accepting the registration.</p>
    <div className="county-registration-links">
      <a href={COUNTY_REGISTRATION_SOURCE} target="_blank" rel="noreferrer">View county records</a>
      <a href="https://www.montgomerycountymd.gov/OCP/licensing/mvr_tow_main.html" target="_blank" rel="noreferrer">Contact OCP</a>
    </div>
  </section>;
}
