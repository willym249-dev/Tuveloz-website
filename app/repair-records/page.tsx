"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { BrandMark } from "../components/tuveloz-icons";
import { formLineItems, type Translate } from "./line-items";
import { RepairWorkspace, type Action, type Label, type RepairData } from "./record-workspace";
import { hasReceipt, object, readRepairData } from "./response";

function formValues(form: FormData): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  form.forEach((value, key) => { if (!key.startsWith("line.") && key !== "lineCount") values[key] = String(value).trim(); });
  for (const key of ["providerCertified", "signatureAccepted", "copyReceived"]) values[key] = form.get(key) === "on";
  for (const key of ["odometerReading", "estimateFeeCents", "surchargeCents"]) if (form.has(key)) values[key] = Number(form.get(key));
  if (form.has("mechanicIdentifiers")) values.mechanicIdentifiers = String(form.get("mechanicIdentifiers")).split(",").map(value => value.trim()).filter(Boolean);
  return values;
}
function sameAccount(a: RepairData, b: RepairData) { return a.role === b.role && a.email.toLowerCase() === b.email.toLowerCase(); }

export default function RepairRecordsPage() {
  const [data, setData] = useState<RepairData | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [spanish, setSpanish] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [needsCheck, setNeedsCheck] = useState(false);
  const [signInNeeded, setSignInNeeded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Label | null>(null);
  const [notice, setNotice] = useState<Label | null>(null);
  const currentAccount = useRef<RepairData | null>(null);
  const readRequest = useRef<AbortController | null>(null);
  const desiredId = useRef("");
  const busyRef = useRef(false);
  const shell = useRef<HTMLElement | null>(null);
  const t: Translate = (en, es) => spanish ? es : en;

  const load = useCallback(async () => {
    readRequest.current?.abort();
    const controller = new AbortController();
    readRequest.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 20_000);
    setLoading(true); setLoadFailed(false);
    try {
      const query = desiredId.current ? `?requestId=${encodeURIComponent(desiredId.current)}` : "";
      const response = await fetch(`/api/repair-records${query}`, { cache: "no-store", signal: controller.signal });
      if (readRequest.current !== controller) return false;
      if (response.status === 401 || response.status === 403) {
        setSignInNeeded(true); setData(null); currentAccount.current = null;
        throw new Error("Sign in required");
      }
      if (!response.ok) throw new Error("Read failed");
      const result = await readRepairData(await response.json());
      if (readRequest.current !== controller) return false;
      if (controller.signal.aborted) throw new Error("Read timed out");
      if (currentAccount.current && !sameAccount(currentAccount.current, result)) {
        setData(null); currentAccount.current = null; setSignInNeeded(true);
        throw new Error("Account changed");
      }
      currentAccount.current = result; setData(result);
      setSelectedId(current => current || desiredId.current || result.jobs[0]?.requestId || "");
      setNeedsCheck(false); setSignInNeeded(false);
      return true;
    } catch {
      if (readRequest.current === controller) setLoadFailed(true);
      return false;
    } finally {
      window.clearTimeout(timeout);
      if (readRequest.current === controller) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    desiredId.current = query.get("requestId")?.trim() || "";
    const timer = window.setTimeout(() => {
      let saved = "en";
      try { saved = localStorage.getItem("tuveloz-language") || "en"; } catch { /* The page works when storage is unavailable. */ }
      const language = query.get("lang");
      setSpanish(language === "es" || (language !== "en" && saved === "es"));
      void load();
    }, 0);
    return () => { window.clearTimeout(timer); readRequest.current?.abort(); readRequest.current = null; };
  }, [load]);

  const job = data?.jobs.find(item => item.requestId === selectedId);
  const blocked = busy || loading || loadFailed || needsCheck || signInNeeded;
  async function post(action: Action, values: Record<string, unknown>) {
    if (!data || !job || blocked || busyRef.current) return;
    const authorizationAction = action === "save-authorization" || action === "sign-authorization";
    if (!(authorizationAction ? job.authorizationWritesAllowed : job.invoiceWritesAllowed)) return;
    const record = authorizationAction ? job.authorization : job.invoice;
    const saving = action === "save-authorization" || action === "save-invoice";
    const payload = { ...values, action, requestId: job.requestId, expectedQuoteId: job.quoteId, expectedScopeVersion: job.scopeVersion,
      expectedRecordId: record?.id || "", ...(saving ? { expectedUpdatedAt: record?.updatedAt || "" } : { expectedDocumentHash: record?.documentHash || "" }) };
    busyRef.current = true; setBusy(true); setError(null); setNotice(null);
    readRequest.current?.abort(); readRequest.current = null;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 20_000);
    try {
      const response = await fetch("/api/repair-records", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), signal: controller.signal });
      if (!response.ok) {
        if (response.status === 400) {
          setError(["Review the required fields, amounts and certification. Your entries are still here.", "Revise los campos obligatorios, los importes y la certificación. Sus datos siguen aquí."]); return;
        }
        setNeedsCheck(true);
        if (response.status === 409) setError(["This job or document changed. Load the latest saved record before continuing.", "Este trabajo o documento cambió. Cargue el último documento guardado antes de continuar."]);
        else if (response.status === 503) {
          const result: unknown = await response.json();
          if (!object(result) || result.code !== "REPAIR_RECORD_WRITES_PAUSED") throw new Error("Save not confirmed");
          setError(["Changes are paused for this job. You can still read your saved copies. Reload to check availability.", "Los cambios están pausados para este trabajo. Puede seguir leyendo sus copias guardadas. Vuelva a cargar para consultar la disponibilidad."]);
        }
        else if (response.status === 401 || response.status === 403) {
          setSignInNeeded(true); setData(null); currentAccount.current = null;
          setError(["Sign in to the account that owns this job to continue.", "Inicie sesión en la cuenta a la que pertenece este trabajo para continuar."]);
        } else throw new Error("Save not confirmed");
        return;
      }
      const result: unknown = await response.json();
      if (!hasReceipt(result, job, action, payload)) throw new Error("Unverified receipt");
      window.clearTimeout(timeout);
      setNotice(action === "sign-invoice" || action === "receive-invoice-copy"
        ? ["Your invoice action was recorded. Job completion is separate; no payment was released.", "Su acción sobre la factura quedó registrada. La finalización del trabajo es independiente; no se liberó ningún pago."]
        : action === "sign-authorization" ? ["Your signature was recorded for this exact authorization.", "Su firma quedó registrada para esta autorización exacta."]
          : ["Your document was saved.", "Su documento se guardó."]);
      setNeedsCheck(true);
      // A confirmed write stays confirmed even when its response snapshot or the
      // next read fails. Only a fresh validated read enables another action.
      desiredId.current = job.requestId;
      if (!(await load())) setNotice(["Your action was recorded, but the latest copy could not be loaded. Reload before continuing.", "Su acción quedó registrada, pero no se pudo cargar la última copia. Vuelva a cargar antes de continuar."]);
    } catch {
      setNeedsCheck(true);
      setError(["We could not confirm the save. Your entries are still here. Load the saved record before trying again.", "No pudimos confirmar que se guardó. Sus datos siguen aquí. Cargue el documento guardado antes de volver a intentarlo."]);
    } finally {
      window.clearTimeout(timeout); busyRef.current = false; setBusy(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>, action: Action) {
    event.preventDefault();
    const form = new FormData(event.currentTarget), values = formValues(form);
    if (action === "save-authorization" || action === "save-invoice") {
      const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
      values.status = submitter?.value || "draft";
      const items = formLineItems(form);
      const expected = action === "save-invoice" ? job?.authorization?.totalAmountCents : Number(job?.quotePriceCents);
      if (!items || items.reduce((sum, item) => sum + item.lineAmountCents, 0) !== expected) {
        setError(["Complete each item and make the total match the agreed provider amount. Your entries are still here.", "Complete cada concepto y haga que el total coincida con el importe acordado del proveedor. Sus datos siguen aquí."]); return;
      }
      values.lineItems = items;
      if (values.estimatedCompletionAt) {
        const date = new Date(String(values.estimatedCompletionAt));
        if (!Number.isFinite(date.getTime())) { setError(["Enter a valid completion date and time.", "Ingrese una fecha y hora de finalización válidas."]); return; }
        values.estimatedCompletionAt = date.toISOString();
      }
      if (values.status !== "draft" && values.providerCertified !== true) {
        setError(["Read and select the provider certification before presenting or issuing this document.", "Lea y marque la certificación del proveedor antes de presentar o emitir este documento."]); return;
      }
    }
    void post(action, values);
  }

  function changeLanguage() {
    setSpanish(value => !value);
    shell.current?.querySelectorAll<HTMLInputElement>('input[type="checkbox"]').forEach(input => { input.checked = false; });
  }
  return <main className="repair-record-shell" ref={shell} lang={spanish ? "es" : "en"} data-manual-language>
    <header className="repair-record-header"><Link href="/" aria-label="Tuveloz" prefetch={false}><BrandMark /><span>Tuveloz</span></Link><nav>
      <Link href={`/account?role=${data?.role || "customer"}`} prefetch={false}>{t("My account", "Mi cuenta")}</Link>
      <button type="button" data-language-control aria-label={spanish ? "Switch to English" : "Cambiar a español"} disabled={busy} onClick={changeLanguage}>{spanish ? "English" : "Español"}</button>
    </nav></header>
    <section className="repair-record-intro"><h1>{t("Your repair records", "Sus documentos de reparación")}</h1>
      <p>{t("Review the written estimate, authorization and invoice for your job. You can read and save your copies without signing them.", "Revise el presupuesto escrito, la autorización y la factura de su trabajo. Puede leer y guardar sus copias sin firmarlas.")}</p>
      {data && <p className="repair-account-note">{t("Signed in as", "Sesión iniciada como")} {data.email} · {data.role === "provider" ? t("Provider account", "Cuenta de proveedor") : t("Customer account", "Cuenta de cliente")}</p>}
    </section>
    <div className="repair-feedback" aria-busy={loading || busy}>
      {error && <p className="form-error" role="alert">{t(...error)}</p>}{notice && <p className="form-success" role="status">{t(...notice)}</p>}
      {signInNeeded && <p><Link href="/account" prefetch={false}>{t("Sign in to your account", "Inicie sesión en su cuenta")}</Link></p>}
      {(loadFailed || needsCheck) && <div className="repair-read-warning" role="alert"><p>{data ? t("We need a fresh copy before you continue. Any documents below are the last version loaded; your unsaved entries are preserved.", "Necesitamos una copia actualizada antes de continuar. Los documentos de abajo son la última versión cargada; sus datos sin guardar se conservan.") : t("We could not load your repair records. Please try again.", "No pudimos cargar sus documentos de reparación. Inténtelo de nuevo.")}</p>
        {data?.role === "provider" && job && (!job.authorization || job.authorization.status === "draft" || (job.authorization.status === "signed" && (!job.invoice || job.invoice.status === "draft"))) && <p>{t("If the saved draft changed, reloading replaces this form with the latest saved draft.", "Si el borrador guardado cambió, al volver a cargar se reemplaza este formulario por el último borrador guardado.")}</p>}
        <button className="button secondary" type="button" disabled={loading || busy} onClick={() => { setError(null); void load(); }}>{t("Try loading again", "Intentar cargar de nuevo")}</button></div>}
      {loading && <p role="status">{t("Loading your saved records…", "Cargando sus documentos guardados…")}</p>}
      {busy && <p role="status">{t("Recording your action and checking the latest copy…", "Registrando su acción y consultando la última copia…")}</p>}
    </div>
    {data && <section className="repair-job-selector"><label htmlFor="repair-job-select">{t("Job", "Trabajo")}</label><select id="repair-job-select" value={selectedId} disabled={busy} onChange={event => { setSelectedId(event.target.value); desiredId.current = event.target.value; setNotice(null); setError(null); }}>
      {selectedId && !job && <option value={selectedId}>{t("Requested job unavailable", "Trabajo solicitado no disponible")}</option>}
      {!data.jobs.length && !selectedId && <option value="">{t("No jobs available", "No hay trabajos disponibles")}</option>}
      {data.jobs.map(item => <option key={item.requestId} value={item.requestId}>{item.vehicle} · {item.service}{item.isTest ? t(" (test)", " (prueba)") : ""}</option>)}
    </select>{!job && <p role={selectedId ? "alert" : "status"}>{selectedId ? t("The requested job is not available in this account. No other job has been selected for you.", "El trabajo solicitado no está disponible en esta cuenta. No se seleccionó ningún otro trabajo por usted.") : t("Your accepted jobs will appear here when their repair records are available.", "Sus trabajos aceptados aparecerán aquí cuando sus documentos estén disponibles.")}</p>}</section>}
    {data && job && <RepairWorkspace key={`${data.email}:${job.requestId}:${job.quoteId}:${job.scopeVersion}`} {...{ data, job, t, spanish, blocked, submit }} />}
  </main>;
}
