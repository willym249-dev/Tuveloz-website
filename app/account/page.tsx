"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { SiteLanguageButton } from "../components/site-language";
import { BrandMark } from "../components/tuveloz-icons";

type Role = "customer" | "provider";
type AuthMode = "signin" | "create" | "reset" | "code";
type PasswordPurpose = "create" | "reset";

const PASSWORD_MIN_LENGTH = 10;
const REMEMBERED_EMAIL_KEY = "tuveloz.remembered-email";

export default function AccountPage() {
  const [role, setRole] = useState<Role>("customer");
  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptedPolicies, setAcceptedPolicies] = useState(false);
  const [code, setCode] = useState("");
  const [codeRequested, setCodeRequested] = useState(false);
  const [passwordChallengeRequested, setPasswordChallengeRequested] = useState(false);
  const [rememberEmail, setRememberEmail] = useState(false);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      const rememberedEmail = window.localStorage.getItem(REMEMBERED_EMAIL_KEY);
      if (rememberedEmail) {
        setEmail(rememberedEmail);
        setRememberEmail(true);
      }
    } catch {
      // Sign-in still works when this browser blocks local storage.
    }
    const requestedRole = new URLSearchParams(window.location.search).get("role");
    if (requestedRole === "provider" || requestedRole === "customer") {
      Promise.resolve().then(() => setRole(requestedRole));
    }
    fetch("/api/account", { cache: "no-store" }).then(async (response) => {
      if (!response.ok) return;
      const result = (await response.json()) as { role?: Role };
      if (result.role) {
        window.location.replace(
          result.role === "customer" ? "/customer" : "/provider-jobs",
        );
      }
    }).catch(() => {
      // The sign-in form remains available if the session check is unavailable.
    }).finally(() => setChecking(false));
  }, []);

  function clearFlowMessages() {
    setCode("");
    setCodeRequested(false);
    setPasswordChallengeRequested(false);
    setMessage("");
    setError("");
  }

  function chooseRole(nextRole: Role) {
    setRole(nextRole);
    setPassword("");
    setConfirmPassword("");
    setAcceptedPolicies(false);
    clearFlowMessages();
  }

  function chooseMode(nextMode: AuthMode) {
    setMode(nextMode);
    setPassword("");
    setConfirmPassword("");
    setAcceptedPolicies(false);
    clearFlowMessages();
  }

  function rememberCurrentEmail() {
    try {
      if (rememberEmail) {
        window.localStorage.setItem(
          REMEMBERED_EMAIL_KEY,
          email.trim().toLowerCase(),
        );
      } else {
        window.localStorage.removeItem(REMEMBERED_EMAIL_KEY);
      }
    } catch {
      // Remembering the email is optional and never blocks sign-in.
    }
  }

  function passwordError() {
    if (Array.from(password).length < PASSWORD_MIN_LENGTH) {
      return `Use at least ${PASSWORD_MIN_LENGTH} characters.`;
    }
    if (Array.from(password).length > 128) {
      return "Use no more than 128 characters.";
    }
    if (!/\p{Lu}/u.test(password)) {
      return "Add at least one uppercase letter.";
    }
    if (!/[^\p{L}\p{N}\s]/u.test(password)) {
      return "Add at least one special character.";
    }
    if (password !== confirmPassword) {
      return "The passwords do not match.";
    }
    return "";
  }

  async function signInWithPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, role, password }),
      });
      const result = (await response.json()) as {
        challengeRequired?: boolean;
        error?: string;
        message?: string;
      };
      if (!response.ok || !result.challengeRequired) {
        setError(result.error || "Unable to sign in.");
        return;
      }
      rememberCurrentEmail();
      setCode("");
      setPasswordChallengeRequested(true);
      setMessage(
        result.message || "Enter the code sent to your email to finish signing in.",
      );
    } catch {
      setError("Sign-in is temporarily unavailable. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function verifyPasswordSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/password/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code, email, role }),
      });
      const result = (await response.json()) as {
        destination?: string;
        error?: string;
      };
      if (!response.ok || !result.destination) {
        setError(result.error || "Unable to verify this code.");
        return;
      }
      window.location.replace(result.destination);
    } catch {
      setError("Sign-in is temporarily unavailable. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function requestPasswordCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationError = passwordError();
    if (validationError) {
      setError(validationError);
      return;
    }
    const purpose: PasswordPurpose = mode === "reset" ? "reset" : "create";
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/auth/password/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, role, purpose }),
      });
      const result = (await response.json()) as {
        error?: string;
        message?: string;
      };
      if (!response.ok) {
        setError(result.error || "Unable to send a verification code.");
        return;
      }
      rememberCurrentEmail();
      setCodeRequested(true);
      setMessage(
        result.message || "Check your email for a verification code.",
      );
    } catch {
      setError("Verification email is temporarily unavailable. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function completePasswordSetup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const purpose: PasswordPurpose = mode === "reset" ? "reset" : "create";
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/password/complete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          code,
          email,
          password,
          purpose,
          role,
          termsAccepted: acceptedPolicies,
        }),
      });
      const result = (await response.json()) as {
        destination?: string;
        error?: string;
      };
      if (!response.ok || !result.destination) {
        setError(result.error || "Unable to verify this code.");
        return;
      }
      window.location.replace(result.destination);
    } catch {
      setError("Account setup is temporarily unavailable. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function requestSignInCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/auth/request-code", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, role }),
      });
      const result = (await response.json()) as {
        error?: string;
        message?: string;
      };
      if (!response.ok) {
        setError(result.error || "Unable to send a sign-in code.");
        return;
      }
      rememberCurrentEmail();
      setCodeRequested(true);
      setMessage(result.message || "Check your email for a sign-in code.");
    } catch {
      setError("Sign-in email is temporarily unavailable. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function verifySignInCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/verify-code", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, role, code }),
      });
      const result = (await response.json()) as {
        destination?: string;
        error?: string;
      };
      if (!response.ok || !result.destination) {
        setError(result.error || "Unable to verify this code.");
        return;
      }
      window.location.replace(result.destination);
    } catch {
      setError("Sign-in is temporarily unavailable. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const workspaceDescription = role === "customer"
    ? "Use the same email address you entered when posting a job."
    : "Provider sign-in is available only after Tuveloz approves and verifies your account.";

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
          <h1>Welcome to Tuveloz.</h1>
          <p>Access your customer requests or verified-provider workspace.</p>
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

          <h2>
            {mode === "create"
              ? "Create an account."
              : mode === "reset"
                ? "Reset your password."
                : mode === "code"
                  ? "Use an email code."
                  : role === "customer"
                    ? "Customer sign in"
                    : "Provider sign in"}
          </h2>
          <p>
            {mode === "create"
              ? "We'll email a code to verify your address."
              : mode === "reset"
                ? "We'll verify your email before changing your password."
                : mode === "code"
                  ? "We'll send a 6-digit code that expires in 10 minutes."
                  : workspaceDescription}
          </p>

          <div className="account-auth-modes" aria-label="Account options">
            <button
              className={mode === "signin" ? "selected" : ""}
              disabled={busy}
              onClick={() => chooseMode("signin")}
              type="button"
            >
              Sign in
            </button>
            <button
              className={mode === "create" ? "selected" : ""}
              disabled={busy}
              onClick={() => chooseMode("create")}
              type="button"
            >
              Create account
            </button>
          </div>

          {mode === "signin" && !passwordChallengeRequested && (
            <form className="account-login-form" onSubmit={signInWithPassword}>
              <label>
                Email address
                <input
                  autoComplete="username webauthn"
                  disabled={checking || busy}
                  name="email"
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  required
                  type="email"
                  value={email}
                />
              </label>
              <label>
                Password
                <input
                  autoComplete="current-password"
                  disabled={checking || busy}
                  name="password"
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  type="password"
                  value={password}
                />
              </label>
              <label className="account-remember-email">
                <input
                  checked={rememberEmail}
                  disabled={busy}
                  onChange={(event) => setRememberEmail(event.target.checked)}
                  type="checkbox"
                />
                <span>Remember my email on this device</span>
              </label>
              <small className="account-remember-note">
                Tuveloz never saves your password in this browser.
              </small>
              <div className="account-form-links">
                <button
                  className="account-text-button"
                  disabled={busy}
                  onClick={() => chooseMode("reset")}
                  type="button"
                >
                  Forgot password?
                </button>
              </div>
              <button className="button primary" disabled={checking || busy} type="submit">
                {checking ? "Checking…" : busy ? "Signing in…" : "Sign in"}
              </button>
              <button
                className="account-code-backup"
                disabled={busy}
                onClick={() => chooseMode("code")}
                type="button"
              >
                Email me a one-time code instead
              </button>
            </form>
          )}

          {mode === "signin" && passwordChallengeRequested && (
            <form className="account-login-form" onSubmit={verifyPasswordSignIn}>
              <label>
                6-digit verification code
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
                {busy ? "Verifying…" : "Finish sign in"}
              </button>
              <button
                className="account-text-button"
                disabled={busy}
                onClick={() => {
                  setPasswordChallengeRequested(false);
                  setCode("");
                  setMessage("");
                  setError("");
                }}
                type="button"
              >
                Start over
              </button>
            </form>
          )}

          {(mode === "create" || mode === "reset") && !codeRequested && (
            <form className="account-login-form" onSubmit={requestPasswordCode}>
              <label>
                Email address
                <input
                  autoComplete="username"
                  disabled={checking || busy}
                  name="email"
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  required
                  type="email"
                  value={email}
                />
              </label>
              <label>
                {mode === "create" ? "Create password" : "New password"}
                <input
                  autoComplete="new-password"
                  disabled={checking || busy}
                  name="password"
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  type="password"
                  value={password}
                />
              </label>
              <label>
                Confirm password
                <input
                  autoComplete="new-password"
                  disabled={checking || busy}
                  name="confirm-password"
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  required
                  type="password"
                  value={confirmPassword}
                />
              </label>
              <small className="account-password-guidance">
                Use at least 10 characters, including one uppercase letter and one
                special character. Spaces are allowed.
              </small>
              {mode === "create" && (
                <label className="policy-consent">
                  <input
                    checked={acceptedPolicies}
                    name="policy-consent"
                    onChange={(event) => setAcceptedPolicies(event.target.checked)}
                    required
                    type="checkbox"
                  />
                  <span>
                    I am 18 or older and agree to the{" "}
                    <Link href="/terms" target="_blank">Terms</Link> and{" "}
                    <Link
                      href={role === "provider" ? "/provider-agreement" : "/customer-agreement"}
                      target="_blank"
                    >
                      {role === "provider" ? "Provider Agreement" : "Customer Agreement"}
                    </Link>, and acknowledge the{" "}
                    <Link href="/privacy" target="_blank">Privacy Policy</Link>.
                  </span>
                </label>
              )}
              <button className="button primary" disabled={checking || busy} type="submit">
                {busy ? "Sending…" : "Send verification code"}
              </button>
              {mode === "reset" && (
                <button
                  className="account-text-button"
                  disabled={busy}
                  onClick={() => chooseMode("signin")}
                  type="button"
                >
                  Back to sign in
                </button>
              )}
            </form>
          )}

          {(mode === "create" || mode === "reset") && codeRequested && (
            <form className="account-login-form" onSubmit={completePasswordSetup}>
              <label>
                6-digit verification code
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
                {busy
                  ? "Verifying…"
                  : mode === "create"
                    ? "Create account"
                    : "Reset password"}
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
                Start over
              </button>
            </form>
          )}

          {mode === "code" && !codeRequested && (
            <form className="account-login-form" onSubmit={requestSignInCode}>
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
                {checking ? "Checking…" : busy ? "Sending…" : "Email me a sign-in code"}
              </button>
              <button
                className="account-text-button"
                disabled={busy}
                onClick={() => chooseMode("signin")}
                type="button"
              >
                Back to password sign in
              </button>
            </form>
          )}

          {mode === "code" && codeRequested && (
            <form className="account-login-form" onSubmit={verifySignInCode}>
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

          {message && (
            <p className="form-success account-login-message" role="status">
              {message}
            </p>
          )}
          {error && (
            <p className="form-error account-login-message" role="alert">
              {error}
            </p>
          )}
          <small className="account-security-note">
            Passwords are securely hashed. Email codes expire in 10 minutes and
            can be used once.
          </small>
        </section>

        <div className="account-login-help">
          <p>New provider? Verification starts with an application.</p>
          <Link className="button secondary" href="/#providers">
            Apply to join <span>→</span>
          </Link>
        </div>
      </section>
    </main>
  );
}
