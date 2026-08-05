"use client";

import { useState } from "react";
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
  spanish = false,
}: {
  source: string;
  spanish?: boolean;
}) {
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  if (done) {
    return (
      <p className="launch-updates-done" role="status">
        {spanish
          ? "Listo — le escribiremos cuando el lanzamiento se acerque. Revise su correo para la confirmación."
          : "Done — we'll write when launch gets close. Check your email for the confirmation."}
      </p>
    );
  }

  return (
    <form
      className="launch-updates-form"
      onSubmit={async (event) => {
        event.preventDefault();
        setError("");
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
          if (!response.ok) {
            const payload = await response.json().catch(() => ({})) as { error?: string };
            throw new Error(payload.error || "Could not sign you up.");
          }
          setDone(true);
        } catch (submitError) {
          setError(submitError instanceof Error ? submitError.message : "Could not sign you up.");
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
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </label>
      <label className="launch-updates-consent">
        <input
          type="checkbox"
          name="consent"
          checked={consent}
          onChange={(event) => setConsent(event.target.checked)}
        />
        <span>{spanish ? LAUNCH_UPDATE_CONSENT_TEXT_ES : LAUNCH_UPDATE_CONSENT_TEXT_EN}</span>
      </label>
      <button className="button primary" type="submit" disabled={busy || !consent}>
        {busy
          ? (spanish ? "Enviando…" : "Signing up…")
          : (spanish ? "Recibir novedades" : "Get launch updates")}
      </button>
      {error && <p className="form-error" role="alert">{error}</p>}
    </form>
  );
}
