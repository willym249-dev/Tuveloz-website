"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { EVIDENCE_UPLOAD_HELP } from "../../lib/provider-evidence-limits";
import { evidenceText, type EvidenceLanguage } from "../../lib/provider-evidence-copy";
import { prepareProviderEvidence, type PreparedProviderEvidence } from "../../lib/prepare-provider-evidence";

export function EvidenceUpload({
  requirement,
  serviceCode,
  supersedesEvidenceId = "",
  preferredLanguage = "English",
  onUploaded,
}: {
  requirement: { code: string; requiresExpiration: boolean };
  serviceCode: string;
  supersedesEvidenceId?: string;
  preferredLanguage?: string;
  onUploaded: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [prepared, setPrepared] = useState<PreparedProviderEvidence | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [language, setLanguage] = useState<EvidenceLanguage>(preferredLanguage === "Spanish" ? "es" : "en");
  const t = (value: string) => evidenceText(value, language);
  const selection = useRef(0);

  useEffect(() => () => { selection.current += 1; }, []);
  useEffect(() => {
    return () => { if (previewUrl) URL.revokeObjectURL(previewUrl); };
  }, [previewUrl]);

  async function chooseDocument(file?: File) {
    const currentSelection = ++selection.current;
    setPrepared(null);
    setFileName(file?.name || "");
    setPreviewUrl("");
    setError("");
    setNotice("");
    setPreparing(Boolean(file));
    if (!file) return;
    try {
      const result = await prepareProviderEvidence(file);
      if (selection.current === currentSelection) {
        setPrepared(result);
        if (result.resized) setPreviewUrl(URL.createObjectURL(result.file));
      }
    } catch (reason) {
      if (selection.current === currentSelection) {
        setError(reason instanceof Error ? reason.message : "Unable to prepare this document.");
      }
    } finally {
      if (selection.current === currentSelection) setPreparing(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || preparing || !prepared) return;
    // React's currentTarget is cleared after the handler yields. Capture the
    // form now so a successful upload can reset without reporting a false error.
    const form = event.currentTarget;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const formData = new FormData(form);
      formData.set("document", prepared.file, prepared.file.name);
      formData.set("serviceCode", serviceCode);
      formData.set("requirementKey", requirement.code);
      if (supersedesEvidenceId) formData.set("supersedesEvidenceId", supersedesEvidenceId);
      const response = await fetch("/api/provider-evidence", { method: "POST", body: formData });
      const result = await response.json().catch(() => ({})) as { error?: string; message?: string };
      if (!response.ok) throw new Error(result.error || "Unable to upload this evidence.");
      form.reset();
      setFileName("");
      setPrepared(null);
      setPreviewUrl("");
      setNotice("Uploaded privately for scanning and review.");
      try {
        await onUploaded();
      } catch {
        setNotice("Your document was uploaded. Refresh the page to see its status.");
      }
    } catch (reason) {
      setError(reason instanceof Error && !(reason instanceof TypeError) ? reason.message : "Unable to upload this evidence.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="provider-evidence-form" lang={language} onSubmit={submit}>
      <div className="provider-document-language" role="group" aria-label="Document language / Idioma del documento">
        <button aria-pressed={language === "en"} disabled={busy} lang="en" onClick={() => setLanguage("en")} type="button">English</button>
        <button aria-pressed={language === "es"} disabled={busy} lang="es" onClick={() => setLanguage("es")} type="button">Español</button>
      </div>
      <label>
        {t("Document")}
        <span className="provider-document-picker">
          <span>{t("Choose document")}</span>
          <span className="provider-document-filename" translate="no">{fileName || t("No document chosen")}</span>
          <input
            accept="application/pdf,image/jpeg,image/png,image/webp"
            aria-label={t("Document")}
            disabled={busy}
            name="document"
            onChange={event => { void chooseDocument(event.currentTarget.files?.[0]); }}
            required
            type="file"
          />
        </span>
        <small>{t(EVIDENCE_UPLOAD_HELP)}</small>
        <small>{t("Your document stays private and is checked for harmful files before review.")}</small>
      </label>
      <label>
        {t("Issuer or source")}
        <input disabled={busy} maxLength={180} name="issuer" placeholder={t("Insurer, agency, school, or business")} />
      </label>
      <label>
        {t("Effective date")}
        <input disabled={busy} name="effectiveAt" type="date" />
      </label>
      <label>
        {t(requirement.requiresExpiration ? "Expiration date (required)" : "Expiration date")}
        <input disabled={busy} name="expiresAt" required={requirement.requiresExpiration} type="date" />
      </label>
      {prepared?.resized && previewUrl && (
        <div className="provider-document-preview" key={previewUrl}>
          <p>{t("Photo resized. Check that the whole document is clear before uploading.")}</p>
          {/* A local blob preview must use the browser image element, not the image optimizer. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img alt={t("Resized document preview")} src={previewUrl} />
          <a href={previewUrl} rel="noopener noreferrer" target="_blank">{t("Open full-size preview")}</a>
          <label>
            <input disabled={busy} required type="checkbox" />
            <span>{t("The whole document is clear and readable.")}</span>
          </label>
        </div>
      )}
      <button className="button secondary" disabled={busy || preparing || !prepared || (prepared.resized && !previewUrl)} type="submit">
        {t(preparing
          ? "Preparing photo…"
          : busy
            ? "Uploading…"
            : supersedesEvidenceId
              ? "Upload corrected replacement"
              : "Upload document")}
      </button>
      {error && <small className="form-error" role="alert">{t(error)}</small>}
      {notice && <small className="portal-success" role="status">{t(notice)}</small>}
    </form>
  );
}
