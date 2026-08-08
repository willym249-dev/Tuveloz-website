"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import {
  browserSupportsWebAuthn,
  platformAuthenticatorIsAvailable,
  startAuthentication,
  startRegistration,
} from "@simplewebauthn/browser";
import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from "@simplewebauthn/browser";
import { track } from "../../lib/analytics";
import { SiteLanguageButton } from "../components/site-language";
import { BrandMark } from "../components/tuveloz-icons";

type Role = "customer" | "provider";
type AuthMode = "signin" | "create" | "reset" | "code";
type PasswordPurpose = "create" | "reset";

const PASSWORD_MIN_LENGTH = 10;
const PASSWORD_MAX_LENGTH = 128;

/**
 * The password policy, in one place. The live checklist and the submit-time
 * error both read from this, so they cannot drift into disagreeing about
 * whether a password is acceptable. Rule order is the order errors surface in,
 * which is the order they were reported in before the checklist existed.
 *
 * Labels are plain English on purpose: /account carries no
 * data-manual-language marker, so the site dictionary translates them.
 */
function passwordRules(value: string) {
  const length = Array.from(value).length;
  return [
    {
      key: "min",
      label: `At least ${PASSWORD_MIN_LENGTH} characters`,
      error: `Use at least ${PASSWORD_MIN_LENGTH} characters.`,
      met: length >= PASSWORD_MIN_LENGTH,
    },
    {
      key: "max",
      label: `${PASSWORD_MAX_LENGTH} characters or fewer`,
      error: `Use no more than ${PASSWORD_MAX_LENGTH} characters.`,
      met: length > 0 && length <= PASSWORD_MAX_LENGTH,
    },
    {
      key: "uppercase",
      label: "One uppercase letter",
      error: "Add at least one uppercase letter.",
      met: /\p{Lu}/u.test(value),
    },
    {
      key: "special",
      label: "One special character",
      error: "Add at least one special character.",
      met: /[^\p{L}\p{N}\s]/u.test(value),
    },
  ];
}
const REMEMBERED_EMAIL_KEY = "tuveloz.remembered-email";

function destinationAfterSignIn(destination: string) {
  const privacyReturn = new URLSearchParams(window.location.search).get("privacy") === "1";
  return privacyReturn ? "/privacy-center" : destination;
}

export default function AccountPage() {
  const [role, setRole] = useState<Role>("customer");
  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptedPolicies, setAcceptedPolicies] = useState(false);
  // Optional and unchecked by default. Never bundled with the Terms checkbox —
  // a required acceptance and an optional marketing-adjacent consent cannot
  // share one control, or neither is freely given.
  const [launchNotification, setLaunchNotification] = useState(false);
  const [code, setCode] = useState("");
  const [codeRequested, setCodeRequested] = useState(false);
  const [passwordChallengeRequested, setPasswordChallengeRequested] = useState(false);
  const [rememberEmail, setRememberEmail] = useState(false);
  const [passkeySupported, setPasskeySupported] = useState(false);
  const [passkeySetupDestination, setPasskeySetupDestination] = useState("");
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [privacyReturn, setPrivacyReturn] = useState(false);

  useEffect(() => {
    if (browserSupportsWebAuthn()) {
      platformAuthenticatorIsAvailable()
        .then((available) => setPasskeySupported(available))
        .catch(() => {
          // Password and email-code sign-in remain available.
        });
    }
    try {
      const rememberedEmail = window.localStorage.getItem(REMEMBERED_EMAIL_KEY);
      if (rememberedEmail) {
        Promise.resolve().then(() => {
          setEmail(rememberedEmail);
          setRememberEmail(true);
        });
      }
    } catch {
      // Sign-in still works when this browser blocks local storage.
    }
    const searchParams = new URLSearchParams(window.location.search);
    const requestedRole = searchParams.get("role");
    if (searchParams.get("privacy") === "1") {
      Promise.resolve().then(() => setPrivacyReturn(true));
    }
    if (requestedRole === "provider" || requestedRole === "customer") {
      Promise.resolve().then(() => setRole(requestedRole));
    }
    // `mode` was previously read by nobody, so every "Create customer account"
    // link — both of the ones on /post-job — dropped its visitor on the
    // sign-in form instead. Reset and code are honored too so a support link
    // can point straight at either.
    const requestedMode = searchParams.get("mode");
    if (requestedMode === "create" || requestedMode === "reset" || requestedMode === "code") {
      Promise.resolve().then(() => {
        setMode(requestedMode);
        // chooseMode() is what normally reports funnel entry, and arriving by
        // URL bypasses it.
        if (requestedMode === "create") {
          track("account_create_started", {
            role: requestedRole === "provider" ? "provider" : "customer",
            entry: "url",
          });
        }
      });
    }
    fetch("/api/account", { cache: "no-store" }).then(async (response) => {
      if (!response.ok) return;
      const result = (await response.json()) as { role?: Role; destination?: string };
      if (result.role) {
        window.location.replace(destinationAfterSignIn(
          result.destination || (result.role === "customer" ? "/customer" : "/provider-onboarding"),
        ));
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
    setLaunchNotification(false);
    clearFlowMessages();
  }

  function chooseMode(nextMode: AuthMode) {
    // Account creation was previously unmeasured end to end — the provider
    // funnel had step events and the customer side had none at all.
    if (nextMode === "create" && mode !== "create") {
      track("account_create_started", { role, entry: "tab" });
    }
    setMode(nextMode);
    setPassword("");
    setConfirmPassword("");
    setAcceptedPolicies(false);
    setLaunchNotification(false);
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
    const failed = passwordRules(password).find((rule) => !rule.met);
    if (failed) return failed.error;
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
      if (passkeySupported) {
        setPasswordChallengeRequested(false);
        setCode("");
        setMessage("");
        setPasskeySetupDestination(destinationAfterSignIn(result.destination));
        return;
      }
      window.location.replace(destinationAfterSignIn(result.destination));
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
      if (purpose === "create") track("account_create_code_sent", { role });
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
          // Only meaningful on customer create; the server ignores it
          // otherwise rather than trusting the client to have scoped it.
          launchNotificationConsent: launchNotification,
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
      if (purpose === "create") track("account_created", { role });
      if (passkeySupported) {
        setCodeRequested(false);
        setCode("");
        setMessage("");
        setPasskeySetupDestination(destinationAfterSignIn(result.destination));
        return;
      }
      window.location.replace(destinationAfterSignIn(result.destination));
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
      window.location.replace(destinationAfterSignIn(result.destination));
    } catch {
      setError("Sign-in is temporarily unavailable. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function signInWithPasskey() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const optionsResponse = await fetch(
        "/api/auth/passkeys/authenticate/options",
        { method: "POST" },
      );
      const optionsResult = (await optionsResponse.json()) as {
        error?: string;
        options?: PublicKeyCredentialRequestOptionsJSON;
      };
      if (!optionsResponse.ok || !optionsResult.options) {
        setError(optionsResult.error || "Passkey sign-in is unavailable.");
        return;
      }

      const passkeyResponse = await startAuthentication({
        optionsJSON: optionsResult.options,
      });
      const verificationResponse = await fetch(
        "/api/auth/passkeys/authenticate/verify",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ response: passkeyResponse }),
        },
      );
      const verificationResult = (await verificationResponse.json()) as {
        destination?: string;
        error?: string;
      };
      if (!verificationResponse.ok || !verificationResult.destination) {
        setError(
          verificationResult.error || "That passkey could not sign you in.",
        );
        return;
      }
      window.location.replace(destinationAfterSignIn(verificationResult.destination));
    } catch {
      setError("Passkey sign-in was canceled or is unavailable on this device.");
    } finally {
      setBusy(false);
    }
  }

  async function setUpPasskey() {
    setBusy(true);
    setError("");
    try {
      const optionsResponse = await fetch(
        "/api/auth/passkeys/register/options",
        { method: "POST" },
      );
      const optionsResult = (await optionsResponse.json()) as {
        error?: string;
        options?: PublicKeyCredentialCreationOptionsJSON;
      };
      if (!optionsResponse.ok || !optionsResult.options) {
        setError(optionsResult.error || "Passkey setup is unavailable.");
        return;
      }

      const passkeyResponse = await startRegistration({
        optionsJSON: optionsResult.options,
      });
      const verificationResponse = await fetch(
        "/api/auth/passkeys/register/verify",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ response: passkeyResponse }),
        },
      );
      const verificationResult = (await verificationResponse.json()) as {
        error?: string;
        ok?: boolean;
      };
      if (!verificationResponse.ok || !verificationResult.ok) {
        setError(
          verificationResult.error || "This passkey could not be verified.",
        );
        return;
      }
      window.location.replace(passkeySetupDestination);
    } catch {
      setError("Passkey setup was canceled or is unavailable on this device.");
    } finally {
      setBusy(false);
    }
  }

  const workspaceDescription = role === "customer"
    ? "Create or sign in to your customer account. New job requests and payments are not open yet."
    : "Provider applicants can sign in to complete onboarding. Approved providers can also open their workspace here.";

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
          <span className="account-kicker">Sign in to Tuveloz</span>
          <h1>Welcome to Tuveloz.</h1>
          <p>
            Access your customer account or provider application. Customer job
            tools remain closed during provider onboarding.
          </p>
        </div>

        <section className="account-login-card" aria-busy={checking || busy}>
          {passkeySetupDestination ? (
            <div className="account-passkey-setup">
              <span className="account-kicker">Optional</span>
              <h2>Sign in faster next time.</h2>
              <p>
                Set up a passkey to use Face ID, Touch ID, a fingerprint, or
                your device lock.
              </p>
              <button
                className="button primary"
                disabled={busy}
                onClick={setUpPasskey}
                type="button"
              >
                {busy ? "Setting up…" : "Set up a passkey"}
              </button>
              <button
                className="account-text-button"
                disabled={busy}
                onClick={() => window.location.replace(passkeySetupDestination)}
                type="button"
              >
                Not now
              </button>
              <small className="account-passkey-privacy">
                Tuveloz stores a public key—not your face or fingerprint. Your
                device or password manager may securely sync the passkey.
              </small>
            </div>
          ) : (
            <>
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
              Provider applicant / provider
            </button>
          </div>

          {privacyReturn && (
            <div className="customer-security-note">
              <strong>Signing in for provider-application privacy access</strong>
              <p>
                Use or create the Customer sign-in with the same verified email used on your
                provider application. After sign-in, choose Provider application data in the
                Privacy Center. This privacy-only access does not approve provider work or grant
                access to jobs.
              </p>
            </div>
          )}

          <h2>
            {mode === "create"
              ? "Create an account."
              : mode === "reset"
                ? "Reset your password."
                : mode === "code"
                  ? "Use an email code."
                  : role === "customer"
                    ? "Sign in as a customer"
                    : "Sign in as a provider"}
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

          {/*
            Customer create mode previously said job tools were closed and then
            asked for a password, with no reason to continue. This states what
            an account is worth today versus at launch. Both lines name the
            pre-launch gate rather than implying anyone can book now — keep it
            that way: CUSTOMER_JOB_POSTING_PAUSED is still true.

            Customers only. A provider applicant creating credentials is on a
            different path and this would misdescribe it.
          */}
          {mode === "create" && role === "customer" && (
            <div className="account-value-prop">
              <p>
                Create your account now so you are ready to ask for prices when
                customer requests open.
              </p>
              <ul>
                <li>Today: save your account and sign in securely.</li>
                <li>At launch: post one request, compare local quotes, and choose.</li>
              </ul>
            </div>
          )}

          {mode === "signin" && !passwordChallengeRequested && (
            <form className="account-login-form" onSubmit={signInWithPassword}>
              {passkeySupported && (
                <>
                  <button
                    className="account-passkey-button"
                    disabled={checking || busy}
                    onClick={signInWithPasskey}
                    type="button"
                  >
                    Use a passkey
                  </button>
                  <small className="account-passkey-hint">
                    Use Face ID, Touch ID, a fingerprint, or your device lock.
                  </small>
                  <div className="account-signin-divider" aria-hidden="true">
                    <span>or</span>
                  </div>
                </>
              )}
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
                {busy ? "Verifying…" : "Finish signing in"}
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
              {/*
                The rules were previously one static sentence, and passwordError()
                surfaced only the first unmet one, on submit — so a password could
                be rejected several times in a row for a different reason each
                time. The list shows all of them, live.
              */}
              <ul className="password-rules" aria-label="Password requirements">
                {passwordRules(password).map((rule) => (
                  <li className={rule.met ? "met" : ""} key={rule.key}>
                    <span aria-hidden="true">{rule.met ? "✓" : "○"}</span>
                    <span>{rule.label}</span>
                    <span className="visually-hidden">
                      {rule.met ? "Requirement met" : "Not met yet"}
                    </span>
                  </li>
                ))}
                {confirmPassword.length > 0 && (
                  <li className={password === confirmPassword ? "met" : ""} key="match">
                    <span aria-hidden="true">
                      {password === confirmPassword ? "✓" : "○"}
                    </span>
                    <span>Both passwords match</span>
                    <span className="visually-hidden">
                      {password === confirmPassword ? "Requirement met" : "Not met yet"}
                    </span>
                  </li>
                )}
              </ul>
              <small className="account-password-guidance">Spaces are allowed.</small>
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
                    <Link
                      aria-label="Terms (opens in a new tab)"
                      href="/terms"
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      Terms
                    </Link> and{" "}
                    <Link
                      aria-label={`${role === "provider" ? "Provider Agreement" : "Customer Agreement"} (opens in a new tab)`}
                      href={role === "provider" ? "/provider-agreement" : "/customer-agreement"}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      {role === "provider" ? "Provider Agreement" : "Customer Agreement"}
                    </Link>, and acknowledge the{" "}
                    <Link
                      aria-label="Privacy Policy (opens in a new tab)"
                      href="/privacy"
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      Privacy Policy
                    </Link>.
                  </span>
                </label>
              )}
              {/*
                Optional, unchecked, and a separate control from the Terms
                acceptance above — bundling a required acceptance with an
                optional one makes neither freely given. Customer create only:
                the wording promises customer requests opening, which does not
                describe a provider applicant's path.

                Scope is deliberately narrow. This is not permission for a
                general marketing list; that stays the separate marketingEmail
                preference, and neither implies the other.
              */}
              {mode === "create" && role === "customer" && (
                <label className="policy-consent optional-consent">
                  <input
                    checked={launchNotification}
                    disabled={checking || busy}
                    name="launch-notification-consent"
                    onChange={(event) => setLaunchNotification(event.target.checked)}
                    type="checkbox"
                  />
                  <span>
                    Email me when Tuveloz opens customer requests, plus
                    essential launch updates. Optional, and you can turn it off
                    any time in the Privacy Center.
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
                Back to password sign-in
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
            </>
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
          {!passkeySetupDestination && (
            <small className="account-security-note">
              Passwords are securely hashed. Email codes expire in 10 minutes
              and can be used once.
            </small>
          )}
        </section>

        <div className="account-login-help">
          <p>New provider? Verification starts with an application.</p>
          <Link className="button secondary" href="/join">
            Apply to join <span>→</span>
          </Link>
        </div>
      </section>
    </main>
  );
}
