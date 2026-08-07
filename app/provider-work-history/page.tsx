"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { BrandMark } from "../components/tuveloz-icons";
import { useSiteLanguage } from "../components/site-language";
import {
  WORK_HISTORY_ATTESTATION_TEXT,
  WORK_HISTORY_ATTESTATION_TEXT_ES,
  WORK_HISTORY_CATEGORIES,
} from "../../lib/provider-work-history";

type WorkHistoryEntry = {
  id?: string;
  employerName: string;
  selfEmployed: boolean;
  city: string;
  startMonth: string;
  endMonth: string;
  stillWorkingHere: boolean;
  workPerformed: string;
  serviceCategory: string;
  referenceName: string;
  referencePhone: string;
  referenceContactConsent: boolean;
  auditStatus?: string;
};

type WorkHistoryState = {
  entries: WorkHistoryEntry[];
  signedAt: string;
};

function blankEntry(): WorkHistoryEntry {
  return {
    employerName: "",
    selfEmployed: false,
    city: "",
    startMonth: "",
    endMonth: "",
    stillWorkingHere: false,
    workPerformed: "",
    serviceCategory: "",
    referenceName: "",
    referencePhone: "",
    referenceContactConsent: false,
  };
}

export default function ProviderWorkHistoryPage() {
  const { language } = useSiteLanguage();
  const isSpanish = language === "es";

  const [entries, setEntries] = useState<WorkHistoryEntry[]>([]);
  const [signedAt, setSignedAt] = useState("");
  const [attested, setAttested] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    const response = await fetch("/api/provider-work-history", { cache: "no-store" });
    if (response.status === 401) {
      window.location.replace("/account?role=provider");
      return;
    }
    const result = await response.json() as WorkHistoryState & {
      error?: string;
      errorEs?: string;
    };
    if (!response.ok) {
      throw new Error((isSpanish ? result.errorEs : result.error) || "Unable to load.");
    }
    setEntries(result.entries.length ? result.entries : [blankEntry()]);
    setSignedAt(result.signedAt);
    setAttested(Boolean(result.signedAt));
    setLoaded(true);
  }, [isSpanish]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load().catch((reason) => {
        setError(reason instanceof Error ? reason.message : "Unable to load.");
        setLoaded(true);
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  function updateEntry(index: number, patch: Partial<WorkHistoryEntry>) {
    setEntries((current) => current.map((entry, position) => (
      position === index ? { ...entry, ...patch } : entry
    )));
    // The signature covers the entries as they stood when it was signed, so any
    // edit drops it and the box has to be ticked again.
    if (signedAt) {
      setSignedAt("");
      setAttested(false);
      setNotice(isSpanish
        ? "Cambió su historial, así que hay que firmarlo otra vez."
        : "You changed your history, so it needs signing again.");
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/provider-work-history", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ entries, signAttestation: attested }),
      });
      const result = await response.json() as WorkHistoryState & {
        error?: string;
        errorEs?: string;
      };
      if (!response.ok) {
        throw new Error(
          (isSpanish ? result.errorEs : result.error)
            || (isSpanish ? "No se pudo guardar." : "Unable to save."),
        );
      }
      setEntries(result.entries.length ? result.entries : [blankEntry()]);
      setSignedAt(result.signedAt);
      setAttested(Boolean(result.signedAt));
      setNotice(result.signedAt
        ? (isSpanish ? "Historial de trabajo guardado y firmado." : "Work history saved and signed.")
        : (isSpanish ? "Historial de trabajo guardado." : "Work history saved."));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to save.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="account-shell">
      <header className="account-header">
        <Link className="brand" href="/" aria-label="Tuveloz home">
          <BrandMark />
          <span>Tuveloz</span>
        </Link>
        <Link className="account-home-link" href="/provider-onboarding">
          {isSpanish ? "Verificación" : "Verification"}
        </Link>
      </header>
      <section className="account-main">
        <div className="account-welcome">
          <span className="account-kicker">{isSpanish ? "Proveedor" : "Provider"}</span>
          <h1>{isSpanish ? "Su historial de trabajo." : "Your work history."}</h1>
          <p>
            {isSpanish
              ? "Dónde ha trabajado y qué tipo de trabajo hizo. Las fechas aproximadas están bien — no revisamos meses exactos."
              : "Where you've worked and what kind of work you did. Ballpark dates are fine — we're not checking exact months."}
          </p>
        </div>

        {error && <p className="form-error account-login-message" role="alert">{error}</p>}
        {!loaded && !error && (
          <p className="admin-note account-loading">
            {isSpanish ? "Cargando…" : "Loading…"}
          </p>
        )}

        {loaded && (
          <section className="account-card customer-settings-panel">
            <form className="customer-profile-form" onSubmit={save}>
              {entries.map((entry, index) => (
                <fieldset className="area-fieldset work-history-entry" key={entry.id ?? index}>
                  <legend>
                    {isSpanish ? `Trabajo ${index + 1}` : `Job ${index + 1}`}
                  </legend>
                  <label className="policy-consent">
                    <input
                      checked={entry.selfEmployed}
                      onChange={(event) => updateEntry(index, {
                        selfEmployed: event.target.checked,
                      })}
                      type="checkbox"
                    />
                    <span>{isSpanish ? "Fue mi propio negocio" : "This was my own business"}</span>
                  </label>
                  <label>
                    {entry.selfEmployed
                      ? (isSpanish ? "Nombre del negocio (opcional)" : "Business name (optional)")
                      : (isSpanish ? "Dónde trabajó" : "Where you worked")}
                    <input
                      maxLength={160}
                      onChange={(event) => updateEntry(index, {
                        employerName: event.target.value,
                      })}
                      placeholder={isSpanish ? "Nombre del taller o negocio" : "Shop or business name"}
                      required={!entry.selfEmployed}
                      value={entry.employerName}
                    />
                  </label>
                  <div className="field-row">
                    <label>
                      {isSpanish ? "Ciudad" : "City"}
                      <input
                        maxLength={100}
                        onChange={(event) => updateEntry(index, { city: event.target.value })}
                        placeholder={isSpanish ? "Ciudad o pueblo" : "City or town"}
                        value={entry.city}
                      />
                    </label>
                    <label>
                      {isSpanish ? "Tipo de trabajo" : "Kind of work"}
                      <select
                        onChange={(event) => updateEntry(index, {
                          serviceCategory: event.target.value,
                        })}
                        required
                        value={entry.serviceCategory}
                      >
                        <option value="" disabled>
                          {isSpanish ? "Elija una" : "Choose one"}
                        </option>
                        {WORK_HISTORY_CATEGORIES.map((category) => (
                          <option key={category.code} value={category.code}>
                            {isSpanish ? category.labelEs : category.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="field-row">
                    <label>
                      {isSpanish ? "Empezó" : "Started"}
                      <input
                        onChange={(event) => updateEntry(index, {
                          startMonth: event.target.value,
                        })}
                        required
                        type="month"
                        value={entry.startMonth}
                      />
                    </label>
                    <label>
                      {isSpanish ? "Terminó" : "Finished"}
                      <input
                        disabled={entry.stillWorkingHere}
                        onChange={(event) => updateEntry(index, {
                          endMonth: event.target.value,
                        })}
                        required={!entry.stillWorkingHere}
                        type="month"
                        value={entry.stillWorkingHere ? "" : entry.endMonth}
                      />
                    </label>
                  </div>
                  <label className="policy-consent">
                    <input
                      checked={entry.stillWorkingHere}
                      onChange={(event) => updateEntry(index, {
                        stillWorkingHere: event.target.checked,
                        endMonth: event.target.checked ? "" : entry.endMonth,
                      })}
                      type="checkbox"
                    />
                    <span>{isSpanish ? "Todavía trabajo aquí" : "I still work here"}</span>
                  </label>
                  <label>
                    {isSpanish ? "Qué hacía" : "What you did"}
                    <textarea
                      maxLength={600}
                      onChange={(event) => updateEntry(index, {
                        workPerformed: event.target.value,
                      })}
                      placeholder={isSpanish
                        ? "Frenos, baterías, llantas…"
                        : "Brakes, batteries, tires…"}
                      rows={2}
                      value={entry.workPerformed}
                    />
                  </label>
                  <div className="field-row">
                    <label>
                      {isSpanish ? "Alguien que confirme (opcional)" : "Someone who can confirm (optional)"}
                      <input
                        maxLength={120}
                        onChange={(event) => updateEntry(index, {
                          referenceName: event.target.value,
                        })}
                        placeholder={isSpanish ? "Nombre" : "Name"}
                        value={entry.referenceName}
                      />
                    </label>
                    <label>
                      {isSpanish ? "Su teléfono" : "Their phone"}
                      <input
                        inputMode="tel"
                        maxLength={40}
                        onChange={(event) => updateEntry(index, {
                          referencePhone: event.target.value,
                        })}
                        placeholder="(301) 555-0100"
                        type="tel"
                        value={entry.referencePhone}
                      />
                    </label>
                  </div>
                  {(entry.referenceName || entry.referencePhone) && (
                    <label className="policy-consent">
                      <input
                        checked={entry.referenceContactConsent}
                        onChange={(event) => updateEntry(index, {
                          referenceContactConsent: event.target.checked,
                        })}
                        type="checkbox"
                      />
                      <span>
                        {isSpanish
                          ? "Está bien que se comuniquen con esta persona"
                          : "It's fine to contact this person"}
                      </span>
                    </label>
                  )}
                  {entries.length > 1 && (
                    <button
                      className="button secondary"
                      onClick={() => setEntries((current) => (
                        current.filter((_, position) => position !== index)
                      ))}
                      type="button"
                    >
                      {isSpanish ? "Quitar este trabajo" : "Remove this job"}
                    </button>
                  )}
                </fieldset>
              ))}

              <button
                className="button secondary"
                onClick={() => setEntries((current) => [...current, blankEntry()])}
                type="button"
              >
                {isSpanish ? "Agregar otro trabajo" : "Add another job"}
              </button>

              <div className="legal-requirement-note">
                <small>
                  {isSpanish
                    ? "Podemos comunicarnos con una o dos de las personas que anotó, solo para confirmar que trabajaron juntos."
                    : "We may contact one or two of the people you listed, just to confirm you worked together."}
                </small>
                <label className="policy-consent">
                  <input
                    checked={attested}
                    onChange={(event) => setAttested(event.target.checked)}
                    type="checkbox"
                  />
                  <span>
                    {isSpanish
                      ? WORK_HISTORY_ATTESTATION_TEXT_ES
                      : WORK_HISTORY_ATTESTATION_TEXT}
                  </span>
                </label>
                {signedAt && (
                  <small className="portal-success">
                    {isSpanish ? "Firmado el " : "Signed "}
                    {new Date(signedAt).toLocaleDateString(isSpanish ? "es-US" : "en-US")}
                  </small>
                )}
              </div>

              <button className="button primary" disabled={busy} type="submit">
                {busy
                  ? (isSpanish ? "Guardando…" : "Saving…")
                  : attested
                    ? (isSpanish ? "Guardar y firmar" : "Save and sign")
                    : (isSpanish ? "Guardar" : "Save")}
              </button>
              {notice && <p className="portal-success" role="status">✓ {notice}</p>}
            </form>
          </section>
        )}
      </section>
    </main>
  );
}
