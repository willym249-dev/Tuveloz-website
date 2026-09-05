"use client";

import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";

export function OwnerSupportForm({ language, audience, initialMessage }: {
  language: "en" | "es"; audience: "customer" | "provider"; initialMessage: string;
}) {
  const spanish = language === "es";
  const t = (en: string, es: string) => spanish ? es : en;
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState(initialMessage.slice(0, 3000));
  const [consent, setConsent] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [reference, setReference] = useState("");
  const requestId = useRef<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError("");
    requestId.current ??= crypto.randomUUID();
    try {
      const response = await fetch("/api/support", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, message, audience, language, consent, requestId: requestId.current }),
      });
      const data = await response.json() as { reference?: string; error?: string; status?: string };
      if (!response.ok || data.status !== "queued" || !data.reference) {
        setError(data.error || t("We couldn't save your message. Try again.", "No pudimos guardar su mensaje. Intente de nuevo."));
      } else {
        setReference(data.reference);
      }
    } catch {
      setError(t("We couldn't confirm receipt. Check your connection and try again; your message is still here.", "No pudimos confirmar la recepción. Revise su conexión e intente de nuevo; su mensaje sigue aquí."));
    } finally {
      setPending(false);
    }
  }

  if (reference) return <div className="ai-support" role="status">
    <h2>{t("Your message is queued for the owner", "Su mensaje está en cola para el dueño")}</h2>
    <p>{t("It is saved for email delivery. The owner can reply to the email you provided. This does not book a service or guarantee a response time.", "Se guardó para enviarlo por correo. El dueño podrá responder al correo que indicó. Esto no reserva un servicio ni garantiza un plazo de respuesta.")}</p>
    <p>{t("Reference:", "Referencia:")} <code>{reference}</code></p>
  </div>;

  return <form className="ai-support" onSubmit={submit} aria-label={t("Contact the owner", "Contactar al dueño")}>
    <h2>{t("Ask the owner for help", "Pida ayuda al dueño")}</h2>
    <p>{t("Review the message below. Only this message, your email, your selected role, and language go to the owner. The chat history is not sent.", "Revise el mensaje. Solo se envían al dueño este mensaje, su correo, su rol elegido y su idioma. No se envía el historial del chat.")}</p>
    <label htmlFor="support-email">{t("Your email for a reply", "Su correo para recibir respuesta")}</label>
    <input id="support-email" type="email" autoComplete="email" maxLength={180} required disabled={pending}
      value={email} onChange={event => { setEmail(event.target.value); requestId.current = null; }} />
    <label htmlFor="support-message">{t("Message to the owner", "Mensaje para el dueño")}</label>
    <textarea id="support-message" rows={5} maxLength={3000} required disabled={pending}
      value={message} onChange={event => { setMessage(event.target.value); requestId.current = null; }} />
    <p>{t("Please leave out passwords, payment details, identity documents, and exact addresses.", "No incluya contraseñas, datos de pago, documentos de identidad ni direcciones exactas.")} <Link href="/privacy">{t("Privacy policy", "Política de privacidad")}</Link></p>
    <label className="ai-support-consent">
      <input type="checkbox" required checked={consent} disabled={pending} onChange={event => setConsent(event.target.checked)} />
      {t("Send this information to the Tuveloz owner so they can help me.", "Enviar esta información al dueño de Tuveloz para que pueda ayudarme.")}
    </label>
    {error && <p className="ai-error" role="alert">{error}</p>}
    <button className="button primary" type="submit" disabled={pending || !consent || !email.trim() || !message.trim()}>
      {pending ? t("Saving…", "Guardando…") : t("Send to the owner", "Enviar al dueño")}
    </button>
    <p>{t("You can also email", "También puede escribir a")} <a href="mailto:hello@tuveloz.com">hello@tuveloz.com</a>.</p>
  </form>;
}
