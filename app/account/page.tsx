"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { SiteLanguageButton } from "../components/site-language";
import { BrandMark } from "../components/tuveloz-icons";

type Role = "customer" | "provider";

export default function AccountPage() {
  const [role, setRole] = useState<Role>("customer");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [codeRequested, setCodeRequested] = useState(false);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const requestedRole = new URLSearchParams(window.location.search).get("role");
    if (requestedRole === "provider" || requestedRole === "customer") {
      Promise.resolve().then(() => setRole(requestedRole));
    }
    fetch("/api/account", { cache: "no-store" }).then(async (response) => {
      if (!response.ok) return;
      const result = (await response.json()) as { role?: Role };
      if (result.role) {
        window.location.replace(result.role === "customer" ? "/customer" : "/provider-jobs");
      }
    }).finally(() => setChecking(false));
  }, []);

  function chooseRole(nextRole: Role) {
    setRole(nextRole);
    setCode("");
    setCodeRequested(false);
    setMessage("");
    setError("");
  }

  async function requestCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    const response = await fetch("/api/auth/request-code", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, role }),
    });
    const result = (await response.json()) as { error?: string; message?: string };
    setBusy(false);
    if (!response.ok) {
      setError(result.error || "Unable to send a sign-in code.");
      return;
    }
    setCodeRequested(true);
    setMessage(result.message || "Check your email for a sign-in code.");
  }

  async function verifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const response = await fetch("/api/auth/verify-code", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, role, code }),
    });
    const result = (await response.json()) as { destination?: string; error?: string };
    setBusy(false);
    if (!response.ok || !result.destination) {
      setError(result.error || "Unable to verify this code.");
      return;
    }
    window.location.replace(result.destination);
  }

  return (
    <main className="account-shell">
      <header className="account-header">
        <Link className="brand" href="/" aria-label="Tuveloz home">
          <BrandMark />
          <span>Tuveloz</span>
        </Link>
        <div className="account-header-actions">
          <SiteLanguageButton />
          <Link className="account-home-link" href="/">Home</Link>
        </div>
      </header>

      <section className="account-main account-login-main">
        <div className="account-welcome">
          <span className="account-kicker">Tuveloz sign in</span>
          <h1>One simple sign-in. The right tools only.</h1>
          <p>
            Enter the email used for your customer request or verified provider
            account. We&apos;ll email a one-time code—no password needed.
          </p>
        </div>

        <section className="account-login-card" aria-busy={checking || busy}>
          <div className="account-role-tabs" aria-label="Choose a workspace">
            <button
              aria-pressed={role === "customer"}
              className={role === "customer" ? "selected" : ""}
              disabled={busy}
              onClick={() => chooseRole("customer")}
              type="button"
            >
              Customer
            </button>
            <button
              aria-pressed={role === "provider"}
              className={role === "provider" ? "selected" : ""}
              disabled={busy}
              onClick={() => chooseRole("provider")}
              type="button"
            >
              Verified provider
            </button>
          </div>

          <span className="account-role">
            {role === "customer" ? "Customer workspace" : "Verified provider workspace"}
          </span>
          <h2>
            {role === "customer"
              ? "Open your requests and quotes."
              : "Open your jobs and business tools."}
          </h2>
          <p>
            {role === "customer"
              ? "Use the same email address you entered when posting a job."
              : "Provider sign-in is available only after Tuveloz approves and verifies your account."}
          </p>

          {!codeRequested ? (
            <form className="account-login-form" onSubmit={requestCode}>
              <label>
                Email address
                <input
                  autoComplete="email"
                  disabled={checking || busy}
                  name="email"
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  required
                  type="email"
                  value={email}
                />
              </label>
              <button className="button primary" disabled={checking || busy} type="submit">
                {checking ? "Checking…" : busy ? "Sending…" : "Email me a code"}
              </button>
            </form>
          ) : (
            <form className="account-login-form" onSubmit={verifyCode}>
              <label>
                6-digit sign-in code
                <input
                  autoComplete="one-time-code"
                  autoFocus
                  inputMode="numeric"
                  maxLength={6}
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                  pattern="[0-9]{6}"
                  placeholder="000000"
                  required
                  value={code}
                />
              </label>
              <button className="button primary" disabled={busy || code.length !== 6} type="submit">
                {busy ? "Signing in…" : "Sign in"}
              </button>
              <button
                className="account-text-button"
                disabled={busy}
                onClick={() => {
                  setCodeRequested(false);
                  setCode("");
                  setMessage("");
                  setError("");
                }}
                type="button"
              >
                Use a different email
              </button>
            </form>
          )}
          {message && <p className="form-success account-login-message" role="status">{message}</p>}
          {error && <p className="form-error account-login-message" role="alert">{error}</p>}
          <small className="account-security-note">
            Codes expire after 10 minutes and work once. Tuveloz never asks for
            your email password.
          </small>
        </section>

        <div className="account-login-help">
          <p>
            New provider? Verification starts with an application.
          </p>
          <Link className="button secondary" href="/#providers">
            Apply to join <span>→</span>
          </Link>
        </div>
      </section>
    </main>
  );
}
