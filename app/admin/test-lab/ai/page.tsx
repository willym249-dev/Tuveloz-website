"use client";

import Link from "next/link";
import { useEffect, useState, type CSSProperties, type FormEvent } from "react";

type SafetyLevel =
  | "routine_review"
  | "do_not_drive_until_inspected"
  | "contact_emergency_or_roadside_help";

type RequestDraft = {
  plainLanguageSummary: string;
  suggestedServiceCategory: string;
  suggestedRequestScope: string;
  clarifyingQuestions: string[];
  safetyLevel: SafetyLevel;
  safetyMessage: string;
  partsReminder: string;
  limitations: string[];
};

type AccessResponse = {
  ok?: boolean;
  error?: string;
};

type StatusResponse = {
  ok?: boolean;
  enabled?: boolean;
  error?: string;
};

type DraftResponse = {
  ok?: boolean;
  error?: string;
  draft?: RequestDraft;
  ownerReviewRequired?: boolean;
  submittedAnywhere?: boolean;
};

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

const inputStyle: CSSProperties = {
  background: "#07182d",
  border: "1px solid #6d3d20",
  borderRadius: ".75rem",
  color: "#f7f4f1",
  font: "inherit",
  padding: ".8rem",
  width: "100%",
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

function readableSafety(level: SafetyLevel) {
  if (level === "contact_emergency_or_roadside_help") {
    return "Contact emergency or roadside help";
  }
  if (level === "do_not_drive_until_inspected") {
    return "Do not drive until inspected";
  }
  return "Routine review";
}

export default function TuvelozAiTestPage() {
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [accessError, setAccessError] = useState("");
  const [vehicle, setVehicle] = useState("2018 example sedan");
  const [description, setDescription] = useState(
    "The steering wheel shakes when the brakes are applied at highway speed. No warning lights are visible.",
  );
  const [draft, setDraft] = useState<RequestDraft | null>(null);
  const [requestError, setRequestError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    void Promise.all([
      fetch("/api/admin/test-lab/access", { cache: "no-store" }),
      fetch("/api/admin/test-lab/ai-request-draft", { cache: "no-store" }),
    ])
      .then(async ([accessResponse, statusResponse]) => {
        const access = await accessResponse.json() as AccessResponse;
        const status = await statusResponse.json() as StatusResponse;
        if (!accessResponse.ok || access.ok !== true) {
          throw new Error(access.error || "Owner verification was not accepted.");
        }
        if (!statusResponse.ok || status.ok !== true) {
          throw new Error(status.error || "Tuveloz AI status could not be verified.");
        }
        if (!active) return;
        setAuthorized(true);
        setEnabled(status.enabled === true);
      })
      .catch((reason) => {
        if (!active) return;
        setAuthorized(false);
        setEnabled(false);
        setAccessError(
          reason instanceof Error ? reason.message : "Owner verification failed.",
        );
      });

    return () => {
      active = false;
    };
  }, []);

  async function createDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setRequestError("");
    setDraft(null);

    try {
      const response = await fetch("/api/admin/test-lab/ai-request-draft", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ vehicle, description }),
      });
      const result = await response.json() as DraftResponse;
      if (!response.ok || result.ok !== true || !result.draft) {
        throw new Error(result.error || "The AI test did not return a draft.");
      }
      setDraft(result.draft);
    } catch (reason) {
      setRequestError(
        reason instanceof Error ? reason.message : "The AI test could not be completed.",
      );
    } finally {
      setLoading(false);
    }
  }

  if (authorized === null || enabled === null) {
    return <main style={pageStyle}><p>Verifying secure owner access…</p></main>;
  }

  if (!authorized) {
    return (
      <main style={pageStyle}>
        <section style={{ ...cardStyle, maxWidth: "42rem", margin: "4rem auto" }}>
          <p style={{ color: "#ff9a55", fontWeight: 900 }}>OWNER ACCESS REQUIRED</p>
          <h1>Tuveloz AI Test Lab is locked</h1>
          <p>{accessError}</p>
          <Link href="/account" style={{ color: "#ff9a55", fontWeight: 800 }}>
            Continue to secure owner sign in
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <div style={{ margin: "0 auto", maxWidth: "64rem" }}>
        <header style={{ display: "flex", flexWrap: "wrap", gap: "1rem", justifyContent: "space-between", marginBottom: "1rem" }}>
          <div>
            <p style={{ color: "#ff8b3d", fontWeight: 900, letterSpacing: ".08em", margin: 0 }}>
              OWNER-ONLY AI TESTING
            </p>
            <h1 style={{ fontSize: "clamp(2rem, 6vw, 4rem)", margin: ".35rem 0" }}>
              Tuveloz AI Request Helper
            </h1>
            <p style={{ color: "#c8c0ba", lineHeight: 1.6, maxWidth: "46rem" }}>
              Test how Tuveloz AI organizes a vehicle concern into a clear request draft. It cannot diagnose the vehicle, submit a job, contact a provider, choose a provider, set a price, or process a payment.
            </p>
          </div>
          <Link href="/admin/test-lab" style={{ ...secondaryButtonStyle, display: "inline-flex", alignItems: "center", alignSelf: "flex-start", textDecoration: "none" }}>
            Back to Test Lab
          </Link>
        </header>

        <section style={{ ...cardStyle, borderColor: enabled ? "#ff6a00" : "#9a5a32", marginBottom: "1rem" }}>
          <strong style={{ color: "#ff9a55" }}>
            {enabled ? "AI TEST IS ENABLED" : "AI TEST IS SAFELY DISABLED"}
          </strong>
          <p style={{ lineHeight: 1.6, marginBottom: 0 }}>
            {enabled
              ? "Every result remains a draft and requires owner review. No result is saved or submitted to the marketplace."
              : "The code is installed, but no OpenAI request will run until OPENAI_API_KEY is stored as a Cloudflare secret and TUVELOZ_AI_ENABLED is deliberately changed to true."}
          </p>
        </section>

        <form onSubmit={createDraft} style={{ ...cardStyle, display: "grid", gap: "1rem" }}>
          <label style={{ display: "grid", gap: ".45rem", fontWeight: 800 }}>
            Fake vehicle description
            <input
              disabled={!enabled || loading}
              maxLength={320}
              onChange={(event) => setVehicle(event.target.value)}
              style={inputStyle}
              value={vehicle}
            />
            <small style={{ color: "#a99d95", fontWeight: 500 }}>
              Do not enter a VIN, license plate, customer name, address, email, phone number, payment information, or account credentials.
            </small>
          </label>

          <label style={{ display: "grid", gap: ".45rem", fontWeight: 800 }}>
            Fake customer issue description
            <textarea
              disabled={!enabled || loading}
              maxLength={1500}
              onChange={(event) => setDescription(event.target.value)}
              rows={6}
              style={inputStyle}
              value={description}
            />
          </label>

          <button
            disabled={!enabled || loading || description.trim().length < 12}
            style={{ ...buttonStyle, opacity: !enabled || loading ? .45 : 1 }}
            type="submit"
          >
            {loading ? "Creating safe draft…" : "Create AI request draft"}
          </button>

          {requestError ? (
            <p role="alert" style={{ color: "#ffb07a", fontWeight: 800, margin: 0 }}>
              {requestError}
            </p>
          ) : null}
        </form>

        {draft ? (
          <section aria-live="polite" style={{ display: "grid", gap: "1rem", marginTop: "1rem" }}>
            <div style={{ ...cardStyle, borderColor: "#ff6a00" }}>
              <p style={{ color: "#ff9a55", fontWeight: 900, marginTop: 0 }}>AI-GENERATED DRAFT — OWNER REVIEW REQUIRED</p>
              <h2>{draft.suggestedServiceCategory}</h2>
              <p style={{ lineHeight: 1.6 }}>{draft.plainLanguageSummary}</p>
            </div>

            <div style={cardStyle}>
              <h2>Suggested request scope</h2>
              <p style={{ lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{draft.suggestedRequestScope}</p>
            </div>

            <div style={cardStyle}>
              <h2>Safety review</h2>
              <strong style={{ color: "#ff9a55" }}>{readableSafety(draft.safetyLevel)}</strong>
              <p style={{ lineHeight: 1.6 }}>{draft.safetyMessage}</p>
            </div>

            <div style={cardStyle}>
              <h2>Questions still needed</h2>
              {draft.clarifyingQuestions.length ? (
                <ul style={{ display: "grid", gap: ".6rem", lineHeight: 1.5 }}>
                  {draft.clarifyingQuestions.map((question) => <li key={question}>{question}</li>)}
                </ul>
              ) : <p>No additional questions were suggested for this fake test.</p>}
            </div>

            <div style={cardStyle}>
              <h2>Parts boundary</h2>
              <p style={{ lineHeight: 1.6 }}>{draft.partsReminder}</p>
            </div>

            <div style={cardStyle}>
              <h2>Required limitations</h2>
              <ul style={{ display: "grid", gap: ".6rem", lineHeight: 1.5 }}>
                {draft.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}
              </ul>
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
