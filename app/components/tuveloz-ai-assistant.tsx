"use client";

import { InterfaceCopy } from "./interface-copy";
import { FormEvent, useEffect, useRef, useState } from "react";
import { SiteLink as Link } from "./site-link";
import { useSiteLanguage } from "./site-language";
import { PublicSiteFooter, PublicSiteHeader } from "./public-chrome";
import { starterQuestions, type PolicyAudience } from "../../lib/ai/policy-knowledge";

import { OwnerSupportForm } from "./owner-support-form";

type PolicySource = { label: string; href: string };
type ChatTurn = { role: "user" | "assistant"; content: string; sources?: PolicySource[]; mode?: string };

// Two things people arrive wanting: help putting words to a car problem, and
// a straight answer about how Tuveloz works. The starters offer both, split by
// who is asking.
const VEHICLE_STARTERS = [
  "My car won't start and I hear a clicking sound.",
  "There's a new noise when I brake.",
  "A warning light came on this morning.",
];

const AUDIENCES: ReadonlyArray<{ id: PolicyAudience; label: string; hint: string }> = [
  { id: "customer", label: "I need work done on my car", hint: "Ask how Tuveloz works or describe a car problem." },
  { id: "provider", label: "I do car work", hint: "Ask about applying, quotes, documents, and payments." },
];

export function TuvelozAiAssistant() {
  const { language } = useSiteLanguage();
  const t = (en: string, es: string) => language === "es" ? es : en;
  const [audience, setAudience] = useState<PolicyAudience>("customer");
  const [input, setInput] = useState("");
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState("policy-guide");
  const [supportMessage, setSupportMessage] = useState<string | null>(null);
  const threadRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, pending]);

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
    if (!trimmed || pending) return;
    setError("");
    const history = turns.slice(-8);
    const nextTurns: ChatTurn[] = [...turns, { role: "user", content: trimmed }];
    setTurns(nextTurns);
    setInput("");
    setPending(true);
    try {
      const response = await fetch("/api/ai", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: trimmed, language, history, audience }),
      });
      const data = (await response.json()) as {
        reply?: string;
        error?: string;
        sources?: PolicySource[];
        mode?: string;
      };
      if (!response.ok || !data.reply) {
        setError(data.error || t("We couldn't answer that just now. Please try again.", "No pudimos responder en este momento. Inténtelo de nuevo."));
        setInput(trimmed);
        return;
      }
      setTurns((current) => [
        ...current,
        { role: "assistant", content: data.reply as string, sources: data.sources ?? [], mode: data.mode },
      ]);
    } catch {
      setInput(trimmed);
      setError(t("We couldn't connect. Check your connection and try again.", "No pudimos conectarnos. Revise su conexión e inténtelo de nuevo."));
    } finally {
      setPending(false);
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
          {turns.length === 0 && !pending && (
            <div className="ai-empty">
              <p>Not sure how to start? Try one of these:</p>
              <div className="ai-starters">
                {(mode === "ai" && audience === "customer" ? VEHICLE_STARTERS : []).map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    className="ai-starter"
                    onClick={() => void send(prompt)}
                  >
                    {prompt}
                  </button>
                ))}
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
                    <Link href={source.href} key={source.href}>{source.label}</Link>
                  ))}
                </div>
              )}
            </div>
          ))}

          {pending && (
            <div className="ai-message ai-message-assistant ai-message-pending">
              <span className="ai-message-author">Tuveloz AI</span>
              <p>Thinking…</p>
            </div>
          )}
        </div>

        {error && <p className="ai-error" data-manual-language role="alert">{error}</p>}

        <form className="ai-composer" onSubmit={onSubmit}>
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
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void send(input);
              }
            }}
          />
          <button className="button ai" type="submit" disabled={pending || !input.trim()}>
            {pending ? "Sending…" : "Ask Tuveloz AI"} <span aria-hidden="true">→</span>
          </button>
        </form>
        <div data-manual-language>
          <button type="button" className="button outline" aria-expanded={supportMessage !== null}
            onClick={() => setSupportMessage(current => current === null
              ? input.trim() || [...turns].reverse().find(turn => turn.role === "user")?.content || ""
              : null)}>
            {t("Contact the owner", "Contactar al dueño")}
          </button>
          {supportMessage !== null && <OwnerSupportForm language={language} audience={audience === "provider" ? "provider" : "customer"} initialMessage={supportMessage} />}
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
