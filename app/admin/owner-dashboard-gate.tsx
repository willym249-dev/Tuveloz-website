"use client";

import {
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from "react";

type FailureCategory =
  | "access"
  | "configuration"
  | "schema"
  | "database"
  | "network"
  | "temporary";

type AccessStatus = {
  ok?: boolean;
  code?: string;
  category?: FailureCategory;
  error?: string;
  retryable?: boolean;
  reauthenticate?: boolean;
};

type GateState =
  | { mode: "checking" }
  | { mode: "ready" }
  | {
      mode: "failed";
      category: FailureCategory;
      message: string;
      retryable: boolean;
      reauthenticate: boolean;
    };

const FAILURE_MESSAGES: Record<FailureCategory, string> = {
  access: "Your Cloudflare Owner Access session is missing, expired, or signed in with a different account.",
  configuration: "Owner Access is not fully configured on this deployment. The dashboard remains locked.",
  schema: "The owner dashboard database needs the current application migration. No private owner data was loaded.",
  database: "The owner dashboard database is temporarily unavailable. No owner action was changed.",
  network: "This device could not reach the protected owner data service. Check the connection and try again.",
  temporary: "Owner data could not be loaded right now. No owner action was changed.",
};

function categoryFor(status: number, result: AccessStatus): FailureCategory {
  if (result.category) return result.category;
  if (result.code === "OWNER_SCHEMA_MIGRATION_REQUIRED") return "schema";
  if (result.code === "OWNER_DATABASE_UNAVAILABLE") return "database";
  if (result.code === "OWNER_ACCESS_CONFIGURATION_MISSING") return "configuration";
  if (status === 401 || status === 403) return "access";
  return "temporary";
}

function ownerReauthenticationPath() {
  const url = new URL("/admin", window.location.origin);
  url.searchParams.set("ownerReauth", String(Date.now()));
  return `${url.pathname}${url.search}`;
}

export function OwnerDashboardGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<GateState>({ mode: "checking" });
  const [childFailure, setChildFailure] = useState(false);

  const checkAccess = useCallback(async () => {
    setState({ mode: "checking" });
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15_000);
    try {
      const response = await fetch("/admin/access-status", {
        cache: "no-store",
        credentials: "same-origin",
        redirect: "manual",
        headers: { accept: "application/json" },
        signal: controller.signal,
      });
      if (response.type === "opaqueredirect" || response.status === 0) {
        setState({
          mode: "failed",
          category: "access",
          message: FAILURE_MESSAGES.access,
          retryable: false,
          reauthenticate: true,
        });
        return;
      }
      const contentType = response.headers.get("content-type") ?? "";
      const result = contentType.includes("application/json")
        ? await response.json().catch(() => ({})) as AccessStatus
        : {};
      if (!response.ok || result.ok !== true) {
        const category = categoryFor(response.status, result);
        setState({
          mode: "failed",
          category,
          message: result.error || FAILURE_MESSAGES[category],
          retryable: result.retryable ?? ["database", "network", "temporary"].includes(category),
          reauthenticate: result.reauthenticate ?? category === "access",
        });
        return;
      }
      setState({ mode: "ready" });
    } catch (error) {
      const timedOut = error instanceof DOMException && error.name === "AbortError";
      setState({
        mode: "failed",
        category: "network",
        message: timedOut
          ? "The protected owner data check timed out. Check the connection and try again."
          : FAILURE_MESSAGES.network,
        retryable: true,
        reauthenticate: false,
      });
    } finally {
      window.clearTimeout(timeout);
    }
  }, []);

  useEffect(() => {
    void checkAccess();
  }, [checkAccess]);

  useEffect(() => {
    if (state.mode !== "ready") return;
    const detectFailure = () => {
      const failures = Array.from(
        document.querySelectorAll<HTMLElement>(".admin-intro .form-error"),
      );
      setChildFailure(failures.some((item) => item.textContent?.trim()));
    };
    detectFailure();
    const observer = new MutationObserver(detectFailure);
    observer.observe(document.body, {
      childList: true,
      characterData: true,
      subtree: true,
    });
    return () => observer.disconnect();
  }, [state.mode]);

  if (state.mode === "checking") {
    return (
      <main className="owner-gate-page" aria-busy="true">
        <section className="owner-gate-card" role="status">
          <span>Owner Tools</span>
          <h1>Checking protected access</h1>
          <p>Verifying Cloudflare Owner Access and the required database schema before private data loads.</p>
        </section>
      </main>
    );
  }

  if (state.mode === "failed") {
    return (
      <main className="owner-gate-page">
        <section className={`owner-gate-card owner-gate-${state.category}`} role="alert">
          <span>Owner Tools remain locked</span>
          <h1>Owner dashboard could not open</h1>
          <p>{state.message}</p>
          <div className="owner-gate-actions">
            {(state.retryable || state.category === "configuration" || state.category === "schema") && (
              <button onClick={() => void checkAccess()} type="button">Try again</button>
            )}
            {(state.reauthenticate || state.category === "access") && (
              <button
                className="secondary"
                onClick={() => window.location.assign(ownerReauthenticationPath())}
                type="button"
              >
                Owner sign in again
              </button>
            )}
            <a href="/">Return to Tuveloz</a>
          </div>
          <small>
            Customer and provider passwords, sessions, or role selections never satisfy Owner Access.
          </small>
        </section>
      </main>
    );
  }

  return (
    <div className={`owner-dashboard-gate${childFailure ? " has-child-failure" : ""}`}>
      {childFailure && (
        <section className="owner-inline-recovery" role="alert">
          <div>
            <strong>Owner data did not finish loading</strong>
            <p>
              The protected page opened, but one owner data request failed. No customer,
              provider, payment, or launch decision was changed.
            </p>
          </div>
          <div className="owner-gate-actions">
            <button onClick={() => window.location.reload()} type="button">Try again</button>
            <button
              className="secondary"
              onClick={() => window.location.assign(ownerReauthenticationPath())}
              type="button"
            >
              Owner sign in again
            </button>
          </div>
        </section>
      )}
      {children}
    </div>
  );
}
