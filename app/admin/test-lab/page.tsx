"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type CSSProperties } from "react";

const STORAGE_KEY = "tuveloz-owner-test-lab-v1";

type LabStage =
  | "ready"
  | "request-created"
  | "quote-created"
  | "quote-accepted"
  | "appointment-scheduled"
  | "provider-on-the-way"
  | "provider-arrived"
  | "job-completed"
  | "payment-succeeded"
  | "payment-failed";

type LabScenario = {
  stage: LabStage;
  updatedAt: string;
  history: string[];
};

type AccessResponse = {
  ok?: boolean;
  error?: string;
  environment?: "production" | "staging";
  stagingUrl?: string;
};

const emptyScenario: LabScenario = {
  stage: "ready",
  updatedAt: "",
  history: [],
};

const stageOrder: LabStage[] = [
  "ready",
  "request-created",
  "quote-created",
  "quote-accepted",
  "appointment-scheduled",
  "provider-on-the-way",
  "provider-arrived",
  "job-completed",
  "payment-succeeded",
];

const pageStyle: CSSProperties = {
  background: "#07182d",
  color: "#f7f4f1",
  minHeight: "100vh",
  padding: "clamp(1rem, 4vw, 3rem)",
};

const cardStyle: CSSProperties = {
  background: "#111111",
  border: "1px solid #6d3d20",
  borderRadius: "1rem",
  padding: "1rem",
};

const buttonStyle: CSSProperties = {
  background: "#ff6a00",
  border: 0,
  borderRadius: ".75rem",
  color: "#07182d",
  cursor: "pointer",
  fontWeight: 900,
  minHeight: "2.8rem",
  padding: ".7rem 1rem",
};

const secondaryButtonStyle: CSSProperties = {
  ...buttonStyle,
  background: "transparent",
  border: "1px solid #ff8b3d",
  color: "#ff9a55",
};

function readableStage(stage: LabStage) {
  return stage.replaceAll("-", " ");
}

export default function AdminTestLabPage() {
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [accessError, setAccessError] = useState("");
  const [environment, setEnvironment] = useState<"production" | "staging">("production");
  const [stagingUrl, setStagingUrl] = useState("https://staging.tuveloz.com");
  const [scenario, setScenario] = useState<LabScenario>(emptyScenario);

  useEffect(() => {
    let active = true;
    const storageTimer = window.setTimeout(() => {
      try {
        const saved = window.localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved) as Partial<LabScenario>;
          if (
            typeof parsed.stage === "string"
            && stageOrder.includes(parsed.stage as LabStage)
            && Array.isArray(parsed.history)
          ) {
            setScenario({
              stage: parsed.stage as LabStage,
              updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : "",
              history: parsed.history.filter((item): item is string => typeof item === "string").slice(-20),
            });
          }
        }
      } catch {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    }, 0);

    void fetch("/api/admin/test-lab/access", { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json() as AccessResponse;
        if (!response.ok || result.ok !== true) {
          throw new Error(result.error || "Owner verification was not accepted.");
        }
        if (!active) return;
        setAuthorized(true);
        setEnvironment(result.environment === "staging" ? "staging" : "production");
        if (result.stagingUrl) setStagingUrl(result.stagingUrl);
      })
      .catch((reason) => {
        if (!active) return;
        setAuthorized(false);
        setAccessError(reason instanceof Error ? reason.message : "Owner verification failed.");
      });

    return () => {
      active = false;
      window.clearTimeout(storageTimer);
    };
  }, []);

  useEffect(() => {
    if (scenario.stage === "ready" && scenario.history.length === 0) {
      window.localStorage.removeItem(STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(scenario));
  }, [scenario]);

  const currentIndex = useMemo(() => {
    const normalized = scenario.stage === "payment-failed" ? "job-completed" : scenario.stage;
    return Math.max(0, stageOrder.indexOf(normalized));
  }, [scenario.stage]);

  function advance(stage: LabStage, message: string) {
    const timestamp = new Date().toLocaleString();
    setScenario((current) => ({
      stage,
      updatedAt: timestamp,
      history: [...current.history, `${timestamp} — ${message}`].slice(-20),
    }));
  }

  function reset() {
    window.localStorage.removeItem(STORAGE_KEY);
    setScenario(emptyScenario);
  }

  if (authorized === null) {
    return <main style={pageStyle}><p>Verifying secure owner access…</p></main>;
  }

  if (!authorized) {
    return (
      <main style={pageStyle}>
        <section style={{ ...cardStyle, maxWidth: "42rem", margin: "4rem auto" }}>
          <p style={{ color: "#ff9a55", fontWeight: 900 }}>OWNER ACCESS REQUIRED</p>
          <h1>Tuveloz Test Lab is locked</h1>
          <p>{accessError}</p>
          <Link href="/account" style={{ color: "#ff9a55", fontWeight: 800 }}>
            Continue to secure owner sign in
          </Link>
        </section>
      </main>
    );
  }

  const canCreateRequest = scenario.stage === "ready";
  const canCreateQuote = scenario.stage === "request-created";
  const canAcceptQuote = scenario.stage === "quote-created";
  const canSchedule = scenario.stage === "quote-accepted";
  const canStartTrip = scenario.stage === "appointment-scheduled";
  const canArrive = scenario.stage === "provider-on-the-way";
  const canComplete = scenario.stage === "provider-arrived";
  const canTestPayment = scenario.stage === "job-completed" || scenario.stage === "payment-failed";

  return (
    <main style={pageStyle}>
      <div style={{ margin: "0 auto", maxWidth: "72rem" }}>
        <header style={{ display: "flex", flexWrap: "wrap", gap: "1rem", justifyContent: "space-between", marginBottom: "1.25rem" }}>
          <div>
            <p style={{ color: "#ff8b3d", fontWeight: 900, letterSpacing: ".08em", margin: 0 }}>
              OWNER-ONLY TESTING
            </p>
            <h1 style={{ fontSize: "clamp(2rem, 6vw, 4rem)", margin: ".35rem 0" }}>Tuveloz Test Lab</h1>
            <p style={{ color: "#c8c0ba", lineHeight: 1.6, maxWidth: "46rem" }}>
              Practice the marketplace workflow with fake information. This page does not write to the Tuveloz database and does not contact Stripe, customers, providers, Resend, or notification systems.
            </p>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: ".65rem", alignItems: "flex-start" }}>
            <Link href="/admin/test-lab/ai" style={{ ...secondaryButtonStyle, display: "inline-flex", alignItems: "center", textDecoration: "none" }}>
              Tuveloz AI Test
            </Link>
            <Link href="/admin" style={{ ...secondaryButtonStyle, display: "inline-flex", alignItems: "center", textDecoration: "none" }}>
              Back to Owner Center
            </Link>
            <button onClick={reset} style={secondaryButtonStyle} type="button">Reset fake test</button>
          </div>
        </header>

        <section style={{ ...cardStyle, borderColor: "#ff6a00", marginBottom: "1rem" }}>
          <strong style={{ color: "#ff9a55" }}>TEST MODE — NOTHING HERE IS REAL</strong>
          <p style={{ marginBottom: 0, lineHeight: 1.6 }}>
            Current runtime: <strong>{environment}</strong>. The separate staging deployment is designed for {stagingUrl} and remains fail-closed unless Cloudflare Access verifies the owner.
          </p>
        </section>

        <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "repeat(auto-fit, minmax(18rem, 1fr))" }}>
          <section style={cardStyle}>
            <p style={{ color: "#a99d95", fontSize: ".8rem", fontWeight: 800, textTransform: "uppercase" }}>Fake customer</p>
            <h2 style={{ marginTop: 0 }}>Test Customer 001</h2>
            <p>2018 Example Sedan</p>
            <p>Rockville, Maryland · 20850</p>
            <p>Requested service: Brake inspection</p>
          </section>

          <section style={cardStyle}>
            <p style={{ color: "#a99d95", fontSize: ".8rem", fontWeight: 800, textTransform: "uppercase" }}>Fake provider</p>
            <h2 style={{ marginTop: 0 }}>Test Provider Garage</h2>
            <p>Quote: $125.00 simulated total</p>
            <p>Availability: Tomorrow at 10:00 AM</p>
            <p>No real provider receives this test.</p>
          </section>

          <section style={cardStyle}>
            <p style={{ color: "#a99d95", fontSize: ".8rem", fontWeight: 800, textTransform: "uppercase" }}>Current simulated state</p>
            <h2 style={{ marginTop: 0, textTransform: "capitalize" }}>{readableStage(scenario.stage)}</h2>
            <p>Step {currentIndex + 1} of {stageOrder.length}</p>
            <p>{scenario.updatedAt ? `Last changed ${scenario.updatedAt}` : "No fake actions recorded yet."}</p>
          </section>
        </div>

        <section style={{ ...cardStyle, marginTop: "1rem" }}>
          <h2>Run the fake workflow</h2>
          <div style={{ display: "grid", gap: ".7rem", gridTemplateColumns: "repeat(auto-fit, minmax(13rem, 1fr))" }}>
            <button disabled={!canCreateRequest} onClick={() => advance("request-created", "Created a fake customer request.")} style={{ ...buttonStyle, opacity: canCreateRequest ? 1 : .4 }} type="button">1. Create fake request</button>
            <button disabled={!canCreateQuote} onClick={() => advance("quote-created", "Added a fake provider quote.")} style={{ ...buttonStyle, opacity: canCreateQuote ? 1 : .4 }} type="button">2. Add fake quote</button>
            <button disabled={!canAcceptQuote} onClick={() => advance("quote-accepted", "Fake customer accepted the quote.")} style={{ ...buttonStyle, opacity: canAcceptQuote ? 1 : .4 }} type="button">3. Accept quote</button>
            <button disabled={!canSchedule} onClick={() => advance("appointment-scheduled", "Scheduled a fake appointment.")} style={{ ...buttonStyle, opacity: canSchedule ? 1 : .4 }} type="button">4. Schedule appointment</button>
            <button disabled={!canStartTrip} onClick={() => advance("provider-on-the-way", "Fake provider marked on the way.")} style={{ ...buttonStyle, opacity: canStartTrip ? 1 : .4 }} type="button">5. Provider on the way</button>
            <button disabled={!canArrive} onClick={() => advance("provider-arrived", "Fake provider marked arrived.")} style={{ ...buttonStyle, opacity: canArrive ? 1 : .4 }} type="button">6. Provider arrived</button>
            <button disabled={!canComplete} onClick={() => advance("job-completed", "Completed the fake job.")} style={{ ...buttonStyle, opacity: canComplete ? 1 : .4 }} type="button">7. Complete fake job</button>
            <button disabled={!canTestPayment} onClick={() => advance("payment-succeeded", "Simulated a successful Stripe test-mode payment.")} style={{ ...buttonStyle, opacity: canTestPayment ? 1 : .4 }} type="button">8. Payment succeeds</button>
            <button disabled={!canTestPayment} onClick={() => advance("payment-failed", "Simulated a declined Stripe test-mode payment.")} style={{ ...secondaryButtonStyle, opacity: canTestPayment ? 1 : .4 }} type="button">Payment fails instead</button>
          </div>
        </section>

        <section style={{ ...cardStyle, marginTop: "1rem" }}>
          <h2>Fake activity log</h2>
          {scenario.history.length === 0 ? (
            <p style={{ color: "#a99d95" }}>Start with “Create fake request.”</p>
          ) : (
            <ol style={{ display: "grid", gap: ".55rem", paddingLeft: "1.25rem" }}>
              {scenario.history.map((item, index) => <li key={`${index}:${item}`}>{item}</li>)}
            </ol>
          )}
        </section>
      </div>
    </main>
  );
}
