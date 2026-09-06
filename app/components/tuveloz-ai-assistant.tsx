"use client";

import { InterfaceCopy } from "./interface-copy";
import { FormEvent, useEffect, useRef, useState } from "react";
import { SiteLink as Link } from "./site-link";
import { useSiteLanguage } from "./site-language";
import { PublicSiteFooter, PublicSiteHeader } from "./public-chrome";
import { starterQuestions, type PolicyAudience } from "../../lib/ai/policy-knowledge";
import { assistantProblem, assistantProblemMessage, readAssistantReply, type AssistantProblem, type AssistantSource } from "../../lib/ai/assistant-response";
import { translateInterfaceValue } from "../../lib/spanish-react";

import { OwnerSupportForm } from "./owner-support-form";

type ChatTurn = { role: "user" | "assistant"; content: string; sources?: AssistantSource[]; mode?: string };

// Two things people arrive wanting: help putting words to a car problem, and
// a straight answer about how Tuveloz works. The starters offer both, split by
// who is asking.
const VEHICLE_STARTERS = [
  { en: "My car won't start and I hear a clicking sound.", es: "Mi carro no arranca y escucho un chasquido." },
  { en: "There's a new noise when I brake.", es: "Hay un ruido nuevo cuando freno." },
  { en: "A warning light came on this morning.", es: "Se encendió una luz de advertencia esta mañana." },
];

const AUDIENCES: ReadonlyArray<{ id: PolicyAudience; label: string; hint: string }> = [
  { id: "customer", label: "I need work done on my car", hint: "Ask about fees, parts, or choosing a provider." },
  { id: "provider", label: "I do car work", hint: "Ask about applying, required documents, or getting paid." },
];

export function TuvelozAiAssistant() {
  const { language } = useSiteLanguage();
  const t = (en: string, es: string) => language === "es" ? es : en;
  const [audience, setAudience] = useState<PolicyAudience>("customer");
  const [input, setInput] = useState("");
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [unansweredQuestion, setUnansweredQuestion] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<AssistantProblem | null>(null);
  const [mode, setMode] = useState("policy-guide");
  const [supportMessage, setSupportMessage] = useState<string | null>(null);
  const [supportOpen, setSupportOpen] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<AbortController | null>(null);
  const inputRevision = useRef(0);

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, pending, unansweredQuestion]);

  useEffect(() => () => {
    requestRef.current?.abort();
    requestRef.current = null;
  }, []);

  useEffect(() => {
    // A mechanic arriving from the provider pages shouldn't have to say so.
    // Applied after paint, the same way the homepage assigns its variants, so
    // the server and client first render agree on the default.
    const requested = new URLSearchParams(window.location.search).get("for");
    if (requested !== "provider" && requested !== "customer") return;
    queueMicrotask(() => setAudience(requested));
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/ai", { signal: controller.signal, cache: "no-store" })
      .then(response => response.ok ? response.json() : null)
      .then(data => { if (data && typeof data === "object" && "mode" in data && data.mode === "ai") setMode("ai"); })
      .catch(() => { /* send reports connectivity; keep policy prompts available */ });
    return () => controller.abort();
  }, []);

  async function send(message: string) {
    const trimmed = message.trim();
    if (!trimmed || requestRef.current) return;
    const controller = new AbortController();
    requestRef.current = controller;
    const submittedRevision = inputRevision.current;
    const timeout = window.setTimeout(() => controller.abort(), 45000);
    const restoreDraft = () => setInput(current => inputRevision.current === submittedRevision ? trimmed : current);
    setError(null);
    // Only completed exchanges belong in the next question's history.
    const history = turns.slice(-8).map(({ role, content }) => ({ role, content }));
    setUnansweredQuestion(trimmed);
    setInput("");
    setPending(true);
    try {
      const response = await fetch("/api/ai", {
        method: "POST",
        signal: controller.signal,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: trimmed, language, history, audience }),
      });
      const data: unknown = await response.json().catch(() => null);
      if (requestRef.current !== controller) return;
      const answer = response.ok ? readAssistantReply(data) : null;
      if (!answer) {
        const problem = assistantProblem(response.status, data);
        setError(problem);
        if (problem === "unavailable") setMode("policy-guide");
        restoreDraft();
        return;
      }
      setTurns((current) => [
        ...current,
        { role: "user", content: trimmed },
        { role: "assistant", content: answer.reply, sources: answer.sources, mode: answer.mode },
      ]);
      setUnansweredQuestion(null);
    } catch {
      if (requestRef.current !== controller) return;
      restoreDraft();
      setError("unconfirmed");
    } finally {
      window.clearTimeout(timeout);
      if (requestRef.current === controller) {
        requestRef.current = null;
        setPending(false);
      }
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void send(input);
  }

  return (
    <InterfaceCopy><main className="public-info-shell ai-page">
      <PublicSiteHeader navigationId="ai-main-navigation" cta={audience === "provider" ? "provider" : "customer"} />

      <section className="public-info-hero">
        <span className="kicker">Tuveloz help</span>
        <h1>Questions about Tuveloz? Start here.</h1>
        <p>
          Ask about fees, parts, or applying as a provider. Our automated guide uses
          Tuveloz&apos;s policies to answer your questions. If you need more help,
          you can contact the owner below.
        </p>
        <div className="ai-audience" role="group" aria-label="Who is asking">
          {AUDIENCES.map((option) => (
            <button
              aria-pressed={audience === option.id}
              disabled={pending}
              className={audience === option.id ? "ai-audience-option is-active" : "ai-audience-option"}
              key={option.id}
              onClick={() => setAudience(option.id)}
              type="button"
            >
              <strong>{option.label}</strong>
              <small>{option.hint}</small>
            </button>
          ))}
        </div>
      </section>

      <section className="ai-assistant" aria-label="Tuveloz AI assistant">
        <p className="ai-availability" data-manual-language role="status">
          {mode === "ai"
            ? t("Ask about Tuveloz or describe a vehicle concern.", "Pregunte sobre Tuveloz o cuéntenos qué le preocupa de su vehículo.")
            : t("You can ask about Tuveloz here. Help with vehicle questions is unavailable right now.", "Puede preguntar sobre Tuveloz aquí. La ayuda con preguntas sobre vehículos no está disponible por ahora.")}
        </p>
        <div className="ai-safety-note" role="note">
          <strong>Safety first.</strong> If your vehicle is unsafe — brakes failing, smoke, fire,
          a fuel smell, or you are stranded in traffic — stop when it is safe and call 911 or a
          professional right away. Tuveloz AI is guidance only.
        </div>

        <div className="ai-thread" ref={threadRef} aria-live="polite">
          {turns.length === 0 && !unansweredQuestion && !pending && (
            <div className="ai-empty">
              <p>Not sure how to start? Try one of these:</p>
              <div className="ai-starters">
                {(mode === "ai" && audience === "customer" ? VEHICLE_STARTERS : []).map((question) => {
                  const prompt = t(question.en, question.es);
                  return (
                    <button
                      key={prompt}
                      type="button"
                      className="ai-starter"
                      onClick={() => void send(prompt)}
                    >
                      {prompt}
                    </button>
                  );
                })}
                {starterQuestions(audience, 4, language).map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    className="ai-starter ai-starter-policy"
                    onClick={() => void send(prompt)}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {turns.map((turn, index) => (
            <div key={index} className={`ai-message ai-message-${turn.role}`} data-manual-language>
              <span className="ai-message-author">
                {turn.role === "user" ? t("You", "Usted") : turn.mode === "policy-guide" ? t("Tuveloz guide", "Guía de Tuveloz") : "Tuveloz AI"}
              </span>
              <p>{turn.content}</p>
              {turn.sources && turn.sources.length > 0 && (
                <div className="ai-sources">
                  <span>{t("More details:", "Más detalles:")}</span>
                  {turn.sources.map((source) => (
                    <Link href={source.href} key={source.href}>{language === "es" ? translateInterfaceValue(source.label) : source.label}</Link>
                  ))}
                </div>
              )}
            </div>
          ))}

          {unansweredQuestion && (
            <div className="ai-message ai-message-user" data-manual-language>
              <span className="ai-message-author">{t("You", "Usted")}</span>
              <p>{unansweredQuestion}</p>
            </div>
          )}

          {pending && (
            <div className="ai-message ai-message-assistant ai-message-pending">
              <span className="ai-message-author">Tuveloz guide</span>
              <p>Finding an answer…</p>
            </div>
          )}
        </div>

        {error && <p className="ai-error" data-manual-language role="alert">{assistantProblemMessage(error, language)}</p>}

        <form className="ai-composer" onSubmit={onSubmit} aria-busy={pending}>
          <label className="sr-only" htmlFor="ai-input">
            Ask a question about Tuveloz
          </label>
          <textarea
            id="ai-input"
            className="ai-input"
            rows={2}
            maxLength={1500}
            placeholder={audience === "provider"
              ? "Ask how quoting, paperwork, or getting paid works…"
              : "Ask about Tuveloz, fees, or parts."}
            value={input}
            onChange={(event) => {
              inputRevision.current += 1;
              setInput(event.target.value);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                void send(input);
              }
            }}
          />
          <button className="button ai" type="submit" disabled={pending || !input.trim()}>
            {pending ? "Sending…" : "Ask a question"} <span aria-hidden="true">→</span>
          </button>
        </form>
        <div data-manual-language>
          <button type="button" className="button outline" aria-expanded={supportOpen} aria-controls="owner-support-panel"
            onClick={() => {
              if (supportMessage === null) setSupportMessage(input.trim() || unansweredQuestion || [...turns].reverse().find(turn => turn.role === "user")?.content || "");
              setSupportOpen(current => !current);
            }}>
            {t("Contact the owner", "Contactar al dueño")}
          </button>
          <div id="owner-support-panel" hidden={!supportOpen}>
            {supportMessage !== null && <OwnerSupportForm language={language} audience={audience === "provider" ? "provider" : "customer"} initialMessage={supportMessage} />}
          </div>
        </div>
        <p className="ai-disclaimer">
          Tuveloz AI does not diagnose or inspect your vehicle, give a price quote,
          guarantee pricing, dispatch help, or choose a provider. Read the linked
          policies for details. Need more help? Email <a href="mailto:hello@tuveloz.com">hello@tuveloz.com</a>.
          Customer bookings and payments are not open yet.
        </p>
      </section>

      <PublicSiteFooter />
    </main></InterfaceCopy>
  );
}
