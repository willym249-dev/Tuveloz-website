"use client";

import { InterfaceCopy } from "./interface-copy";
import { useState } from "react";
import { useSiteLanguage } from "./site-language";
import { hasPublicFormReceipt, publicFormMessage, publicFormProblem, type PublicFormProblem } from "../../lib/public-form-feedback";
import {
  LAUNCH_UPDATE_CONSENT_TEXT_EN,
  LAUNCH_UPDATE_CONSENT_TEXT_ES,
} from "../../lib/launch-updates";

/**
 * Email capture for the pre-launch list. Consent is an unchecked box the
 * visitor has to tick — never pre-checked, and the exact wording shown here is
 * what gets stored against their record.
 */
export function LaunchUpdatesForm({
  source,
  spanish: spanishOverride,
}: {
  source: string;
  spanish?: boolean;
}) {
  const { language } = useSiteLanguage();
  const spanish = spanishOverride ?? language === "es";
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<PublicFormProblem | null>(null);

  if (done) {
    return (
      <InterfaceCopy><p className="launch-updates-done" role="status">
        {spanish
          ? "Ya está en la lista. Le enviaremos novedades sobre el lanzamiento de Tuveloz. Puede cancelar la suscripción cuando quiera."
          : "You're on the list. We'll email you updates about Tuveloz's launch. You can unsubscribe at any time."}
      </p></InterfaceCopy>
    );
  }

  return (
    <InterfaceCopy><form
      className="launch-updates-form"
      aria-busy={busy}
      onSubmit={async (event) => {
        event.preventDefault();
        if (busy) return;
        setError(null);
        setBusy(true);
        try {
          const response = await fetch("/api/launch-updates/subscribe", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              email,
              consent,
              source,
              language: spanish ? "es" : "en",
            }),
          });
          const payload: unknown = await response.json().catch(() => null);
          if (!response.ok || !hasPublicFormReceipt(payload)) {
            setError(publicFormProblem("updates", response.status, payload));
            return;
          }
          setDone(true);
        } catch {
          setError("unconfirmed");
        } finally {
          setBusy(false);
        }
      }}
    >
      <label className="launch-updates-email">
        <span>{spanish ? "Correo electrónico" : "Email address"}</span>
        <input
          type="email"
          name="email"
          required
          disabled={busy}
          maxLength={320}
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            setConsent(false);
          }}
        />
      </label>
      <label className="launch-updates-consent">
        <input
          type="checkbox"
          name="consent"
          checked={consent}
          disabled={busy}
          onChange={(event) => setConsent(event.target.checked)}
        />
        <span>{spanish ? LAUNCH_UPDATE_CONSENT_TEXT_ES : LAUNCH_UPDATE_CONSENT_TEXT_EN}</span>
      </label>
      <button className="button primary" type="submit" disabled={busy || !consent}>
        {busy
          ? (spanish ? "Enviando…" : "Signing up…")
          : (spanish ? "Recibir novedades" : "Get launch updates")}
      </button>
      {error && <p className="form-error" role="alert">{publicFormMessage("updates", error, spanish)}</p>}
    </form></InterfaceCopy>
  );
}
