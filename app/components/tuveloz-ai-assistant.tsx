"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { SiteLanguageButton, useSiteLanguage } from "./site-language";
import { BrandMark } from "./tuveloz-icons";
import { SocialLinks } from "./social-links";

type ChatTurn = { role: "user" | "assistant"; content: string };

const STARTER_PROMPTS = [
  "My car won't start and I hear a clicking sound.",
  "There's a new noise when I brake.",
  "A warning light came on this morning.",
  "Help me describe a flat tire for a quote request.",
];

export function TuvelozAiAssistant() {
  const { language } = useSiteLanguage();
  const [menuOpen, setMenuOpen] = useState(false);
  const [input, setInput] = useState("");
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const threadRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, pending]);

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
        body: JSON.stringify({ message: trimmed, language, history }),
      });
      const data = (await response.json()) as { reply?: string; error?: string };
      if (!response.ok || !data.reply) {
        setError(data.error || "Tuveloz AI could not answer that just now. Please try again.");
        return;
      }
      setTurns((current) => [...current, { role: "assistant", content: data.reply as string }]);
    } catch {
      setError("We couldn't reach Tuveloz AI. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void send(input);
  }

  return (
    <main className="public-info-shell ai-page">
      <header className="site-header">
        <Link className="brand" href="/" aria-label="Tuveloz home">
          <BrandMark />
          <span>Tuveloz</span>
        </Link>
        <button
          className="menu-button"
          aria-controls="ai-main-navigation"
          aria-label={menuOpen ? "Close main menu" : "Open main menu"}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((value) => !value)}
          type="button"
        >
          <span />
          <span />
        </button>
        <nav className={menuOpen ? "nav open" : "nav"} id="ai-main-navigation" aria-label="Main navigation">
          <Link href="/about" onClick={() => setMenuOpen(false)}>Learn about Tuveloz</Link>
          <Link href="/post-job" onClick={() => setMenuOpen(false)}>Customer launch status</Link>
          <Link href="/join" onClick={() => setMenuOpen(false)}>Join as a provider</Link>
          <Link href="/how-it-works" onClick={() => setMenuOpen(false)}>How it works</Link>
          <Link href="/safety" onClick={() => setMenuOpen(false)}>Safety &amp; trust</Link>
          <Link href="/faq" onClick={() => setMenuOpen(false)}>FAQ</Link>
        </nav>
        <div className="header-actions">
          <SiteLanguageButton />
          <Link className="header-sign-in" href="/account">Sign in</Link>
          <Link className="header-cta" href="/post-job">Launch status</Link>
        </div>
      </header>

      <section className="public-info-hero">
        <span className="kicker">Available now · Tuveloz AI</span>
        <h1>Describe what your vehicle needs, clearly.</h1>
        <p>
          Get bilingual, safety-first guidance that helps you organize what your vehicle is
          doing and prepare for a future service request. Tuveloz AI does not diagnose your
          vehicle, dispatch help, guarantee pricing, or choose a provider.
        </p>
      </section>

      <section className="ai-assistant" aria-label="Tuveloz AI assistant">
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
                {STARTER_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    className="ai-starter"
                    onClick={() => void send(prompt)}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {turns.map((turn, index) => (
            <div key={index} className={`ai-message ai-message-${turn.role}`}>
              <span className="ai-message-author">
                {turn.role === "user" ? "You" : "Tuveloz AI"}
              </span>
              <p>{turn.content}</p>
            </div>
          ))}

          {pending && (
            <div className="ai-message ai-message-assistant ai-message-pending">
              <span className="ai-message-author">Tuveloz AI</span>
              <p>Thinking…</p>
            </div>
          )}
        </div>

        {error && <p className="ai-error" role="alert">{error}</p>}

        <form className="ai-composer" onSubmit={onSubmit}>
          <label className="sr-only" htmlFor="ai-input">
            Describe what your vehicle is doing
          </label>
          <textarea
            id="ai-input"
            className="ai-input"
            rows={2}
            maxLength={1500}
            placeholder="Describe what your vehicle is doing…"
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
            {pending ? "Sending…" : "Ask Tuveloz AI"} <span aria-hidden="true">✦</span>
          </button>
        </form>
        <p className="ai-disclaimer">
          Tuveloz AI gives general guidance only. It is not a diagnosis, an inspection, or a price
          quote, and it does not choose a provider. Customer service requests and payments are not
          open yet.
        </p>
      </section>

      <footer>
        <Link className="brand footer-brand" href="/">
          <BrandMark /><span>Tuveloz</span>
        </Link>
        <p>Vehicle services built around customer choice and provider freedom.</p>
        <div className="footer-links">
          <Link href="/about">Learn about Tuveloz</Link>
          <Link href="/how-it-works">How it works</Link>
          <Link href="/safety">Safety &amp; trust</Link>
          <Link href="/faq">FAQ</Link>
          <Link href="/account">Sign in</Link>
          <Link href="/privacy">Privacy</Link>
        </div>
        <div className="footer-bottom">
          <SocialLinks />
          <span>© 2026 Tuveloz. All rights reserved.</span>
          <span>Provider onboarding is open in Montgomery County, Maryland.</span>
        </div>
      </footer>
    </main>
  );
}
