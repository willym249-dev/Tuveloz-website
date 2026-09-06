"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { OwnerSupportError, ownerSupportProblemMessage, requestOwnerSupport, type OwnerSupportProblem } from "../../lib/owner-support-response";

export function OwnerSupportForm({ language, audience, initialMessage }: {
  language: "en" | "es"; audience: "customer" | "provider"; initialMessage: string;
}) {
  const spanish = language === "es";
  const t = (en: string, es: string) => spanish ? es : en;
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState(initialMessage.slice(0, 3000));
  const [consent, setConsent] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<OwnerSupportProblem | null>(null);
  const [reference, setReference] = useState("");
  const submission = useRef<{ content: string; requestId: string } | null>(null);
  const request = useRef<AbortController | null>(null);

  useEffect(() => () => {
    request.current?.abort();
    request.current = null;
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (request.current || reference) return;
    const controller = new AbortController();
    request.current = controller;
    setPending(true);
    setError(null);
    try {
      const details = { email, message, audience, language, consent };
      const content = JSON.stringify(details);
      // A deliberate retry of the same message keeps the server's deduplication
      // reference. Changed details are a new message and need a new reference.
      if (submission.current?.content !== content) {
        submission.current = { content, requestId: crypto.randomUUID() };
      }
      const savedReference = await requestOwnerSupport({ ...details, requestId: submission.current.requestId }, controller.signal);
      if (request.current === controller) setReference(savedReference);
    } catch (error) {
      if (request.current === controller) setError(error instanceof OwnerSupportError ? error.problem : "unconfirmed");
    } finally {
      if (request.current === controller) {
        request.current = null;
        setPending(false);
      }
    }
  }

  if (reference) return <div className="ai-support" role="status">
    <h2>{t("Your message is saved", "Su mensaje se guardó")}</h2>
    <p>{t("It's waiting to be emailed to Tuveloz's owner, who can reply to the address you provided. This does not book a service or guarantee a reply time.", "Está pendiente de enviarse por correo al dueño de Tuveloz, quien puede responder a la dirección que indicó. Esto no reserva un servicio ni garantiza un plazo de respuesta.")}</p>
    <p>{t("Reference:", "Referencia:")} <code>{reference}</code></p>
  </div>;

  return <form className="ai-support" onSubmit={submit} aria-busy={pending} aria-label={t("Contact the owner", "Contactar al dueño")}>
    <h2>{t("Ask the owner for help", "Pida ayuda al dueño")}</h2>
    <p>{t("Review the message below. Only this message, your email, your selected role, and language go to the owner. The chat history is not sent.", "Revise el mensaje. Solo se envían al dueño este mensaje, su correo, su rol elegido y su idioma. No se envía el historial del chat.")}</p>
    <label htmlFor="support-email">{t("Your email for a reply", "Su correo para recibir respuesta")}</label>
    <input id="support-email" type="email" autoComplete="email" maxLength={180} required disabled={pending}
      value={email} onChange={event => setEmail(event.target.value)} />
    <label htmlFor="support-message">{t("Message to the owner", "Mensaje para el dueño")}</label>
    <textarea id="support-message" rows={5} maxLength={3000} required disabled={pending}
      value={message} onChange={event => setMessage(event.target.value)} />
    <p>{t("Please leave out passwords, payment details, identity documents, and exact addresses.", "No incluya contraseñas, datos de pago, documentos de identidad ni direcciones exactas.")} <Link href="/privacy">{t("Privacy policy", "Política de privacidad")}</Link></p>
    <label className="ai-support-consent">
      <input type="checkbox" required checked={consent} disabled={pending} onChange={event => setConsent(event.target.checked)} />
      {t("Send this information to the Tuveloz owner so they can help me.", "Enviar esta información al dueño de Tuveloz para que pueda ayudarme.")}
    </label>
    {error && <p className="ai-error" role="alert">{ownerSupportProblemMessage(error, spanish)}</p>}
    <button className="button primary" type="submit" disabled={pending || !consent || !email.trim() || !message.trim()}>
      {pending ? t("Saving…", "Guardando…") : t("Send to the owner", "Enviar al dueño")}
    </button>
    <p>{t("You can also email", "También puede escribir a")} <a href="mailto:hello@tuveloz.com">hello@tuveloz.com</a>.</p>
  </form>;
}
