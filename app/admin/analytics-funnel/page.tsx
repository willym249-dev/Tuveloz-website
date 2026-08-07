"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { BrandMark } from "../../components/tuveloz-icons";

type FunnelStage = {
  key: string;
  label: string;
  event: string;
  count: number;
  pctOfStart: number;
  pctOfPrev: number;
  droppedFromPrev: number;
};

type ExperimentRow = {
  variant: string;
  started: number;
  submitted: number;
  conversion: number;
};

type WindowPayload = {
  provider: FunnelStage[];
  customer: FunnelStage[];
  context: {
    requirementsStepCompleted: number;
    requirementsStepAbandoned: number;
    providerFirstQuoteSent: number;
  };
  experiments: Record<string, ExperimentRow[]>;
  rawCounts: Array<{ event: string; count: number }>;
};

// Keep these titles/labels in sync with the copy rendered for each variant in
// app/page.tsx. Order here is the display order on this page.
const EXPERIMENT_META: Array<{
  name: string;
  title: string;
  labels: Record<string, string>;
}> = [
  {
    name: "provider_hero",
    title: "Hero headline",
    labels: { A: "“Your wrench. Your rules.”", B: "“Do great work. Get paid.”" },
  },
  {
    name: "provider_pitch",
    title: "Pitch headline",
    labels: {
      A: "“You’ve got the skills…”",
      B: "“Your customers. Your prices. Your call.”",
    },
  },
  {
    name: "founding_cta",
    title: "Founding-banner button",
    labels: { A: "“Join free”", B: "“Claim my spot”" },
  },
];

function Experiment({
  title,
  labels,
  rows,
}: {
  title: string;
  labels: Record<string, string>;
  rows: ExperimentRow[];
}) {
  const totalStarted = rows.reduce((sum, row) => sum + row.started, 0);
  const leader = rows.reduce<ExperimentRow | null>((best, row) => {
    if (row.started === 0) return best;
    if (!best || row.conversion > best.conversion) return row;
    return best;
  }, null);
  const enoughData = totalStarted >= 100 && rows.every((row) => row.started >= 30);
  return (
    <section style={{ marginTop: "1.5rem" }}>
      <h3 style={{ fontSize: "0.98rem", margin: "0 0 0.35rem" }}>{title}</h3>
      {totalStarted === 0 ? (
        <p className="hint" style={{ margin: 0 }}>No visits recorded for this test in this window yet.</p>
      ) : (
        <>
          <table style={{ borderCollapse: "collapse", width: "100%", maxWidth: 580 }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: "0.3rem 0.6rem 0.3rem 0", opacity: 0.7 }}>Variant</th>
                <th style={{ textAlign: "right", padding: "0.3rem 0.6rem", opacity: 0.7 }}>Visitors</th>
                <th style={{ textAlign: "right", padding: "0.3rem 0.6rem", opacity: 0.7 }}>Submitted</th>
                <th style={{ textAlign: "right", padding: "0.3rem 0", opacity: 0.7 }}>Conversion</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const isLeader = enoughData && leader?.variant === row.variant;
                return (
                  <tr key={row.variant}>
                    <td style={{ padding: "0.3rem 0.6rem 0.3rem 0" }}>
                      <strong>{row.variant}</strong> {labels[row.variant] ?? ""}
                      {isLeader && <span style={{ marginLeft: "0.4rem" }}>★ leading</span>}
                    </td>
                    <td style={{ padding: "0.3rem 0.6rem", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                      {row.started}
                    </td>
                    <td style={{ padding: "0.3rem 0.6rem", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                      {row.submitted}
                    </td>
                    <td style={{ padding: "0.3rem 0", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                      {row.conversion}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="hint" style={{ margin: "0.5rem 0 0", fontSize: "0.78rem" }}>
            {enoughData
              ? "Enough data to read a direction — but confirm the gap holds before you commit."
              : "Small sample so far. Wait for at least ~30 visitors per variant before trusting the winner."}
          </p>
        </>
      )}
    </section>
  );
}

function Experiments({ windows }: { windows: WindowPayload["experiments"] }) {
  return (
    <section style={{ marginTop: "1.75rem" }}>
      <h2 style={{ fontSize: "1.05rem", margin: "0 0 0.35rem" }}>Copy experiments</h2>
      <p className="hint" style={{ margin: "0 0 0.25rem", fontSize: "0.82rem" }}>
        Which wording turns visitors into submitted applications. Real, first-party
        conversion — no guesswork, nothing shared with a third party.
      </p>
      {EXPERIMENT_META.map((meta) => (
        <Experiment
          key={meta.name}
          title={meta.title}
          labels={meta.labels}
          rows={windows[meta.name] ?? []}
        />
      ))}
    </section>
  );
}

type AssistantSummary = {
  answered: number;
  grounded: number;
  vehicleOnly: number;
  byAudience: { customer: number; provider: number };
  guardReplaced: number;
  topTopics: Array<{ id: string; label: string; count: number }>;
};

type LaunchList = {
  subscribed: number;
  unsubscribed: number;
  recent: number;
  bySource: Array<{ source: string; count: number }>;
};

type FunnelResponse = {
  error?: string;
  generatedAt: string;
  note: string;
  windows: {
    allTime: WindowPayload;
    last30: WindowPayload;
    last7: WindowPayload;
  };
  assistant?: { allTime: AssistantSummary; last7: AssistantSummary };
  launchList?: LaunchList;
};

/**
 * Two things the owner had no way to see: how many people are on the pre-launch
 * list, and what Tuveloz AI is being asked. Neither panel shows an email address
 * or anyone's question — the assistant only records the shape of an answer.
 */
function LaunchListPanel({ list }: { list: LaunchList }) {
  return (
    <section style={{ marginTop: "1.75rem" }}>
      <h2>Launch email list</h2>
      <p className="admin-section-copy">
        People who asked to hear when customer requests open. Addresses are not shown
        here; this is the size and shape of the list.
      </p>
      <div className="admin-stats">
        <div><strong>{list.subscribed}</strong><span>Subscribed</span></div>
        <div><strong>{list.recent}</strong><span>Joined in the last 7 days</span></div>
        <div><strong>{list.unsubscribed}</strong><span>Unsubscribed</span></div>
      </div>
      {list.bySource.length > 0 && (
        <table style={{ borderCollapse: "collapse", marginTop: "1rem" }}>
          <tbody>
            {list.bySource.map((row) => (
              <tr key={row.source}>
                <td style={{ padding: "0.3rem 0.6rem 0.3rem 0", fontFamily: "monospace", fontSize: "0.82rem" }}>
                  {row.source}
                </td>
                <td style={{ padding: "0.3rem 0", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                  {row.count}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function AssistantPanel({ assistant }: { assistant: { allTime: AssistantSummary; last7: AssistantSummary } }) {
  const { allTime, last7 } = assistant;
  return (
    <section style={{ marginTop: "1.75rem" }}>
      <h2>Tuveloz AI</h2>
      <p className="admin-section-copy">
        What the assistant has been asked, and whether its answers about money kept
        the policy&rsquo;s hedges. Questions and answers are never stored — only which
        vetted topic matched.
      </p>
      <div className="admin-stats">
        <div><strong>{allTime.answered}</strong><span>Answers all time</span></div>
        <div><strong>{last7.answered}</strong><span>Last 7 days</span></div>
        <div><strong>{allTime.grounded}</strong><span>Policy questions</span></div>
        <div><strong>{allTime.vehicleOnly}</strong><span>Car questions</span></div>
      </div>

      {allTime.guardReplaced > 0 ? (
        <p className="form-error" role="status" style={{ marginTop: "1rem" }}>
          The hedge guard replaced {allTime.guardReplaced}{" "}
          {allTime.guardReplaced === 1 ? "answer" : "answers"} ({last7.guardReplaced} in the
          last 7 days). Each one was a reply that stated a provisional design — the fee,
          payouts, refunds, or the launch state — as settled fact, so the approved wording
          was served instead. Customers were not shown a wrong answer; this is a signal
          the prompt or the model has drifted and is worth a look.
        </p>
      ) : (
        <p className="hint" style={{ marginTop: "1rem" }}>
          The hedge guard has not had to replace an answer. Every reply about a
          provisional design kept its qualifier.
        </p>
      )}

      <p className="hint" style={{ marginTop: "0.75rem", fontSize: "0.82rem" }}>
        Asked by: {allTime.byAudience.customer} customer · {allTime.byAudience.provider} provider
      </p>

      {allTime.topTopics.length > 0 && (
        <>
          <h3 style={{ marginTop: "1.25rem", fontSize: "1rem" }}>Most asked</h3>
          <table style={{ borderCollapse: "collapse", marginTop: "0.5rem" }}>
            <tbody>
              {allTime.topTopics.map((topic) => (
                <tr key={topic.id}>
                  <td style={{ padding: "0.3rem 0.9rem 0.3rem 0", fontSize: "0.9rem" }}>{topic.label}</td>
                  <td style={{ padding: "0.3rem 0", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                    {topic.count}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="hint" style={{ marginTop: "0.6rem", fontSize: "0.78rem" }}>
            What people ask most is the clearest signal of what the site is not
            explaining well enough on its own.
          </p>
        </>
      )}
    </section>
  );
}

type WindowKey = "last7" | "last30" | "allTime";

const WINDOW_LABELS: Record<WindowKey, string> = {
  last7: "Last 7 days",
  last30: "Last 30 days",
  allTime: "All time",
};

function Funnel({ title, stages, empty }: { title: string; stages: FunnelStage[]; empty: string }) {
  const startCount = stages[0]?.count ?? 0;
  return (
    <section style={{ marginTop: "1.5rem" }}>
      <h2 style={{ fontSize: "1.05rem", margin: "0 0 0.75rem" }}>{title}</h2>
      {startCount === 0 ? (
        <p className="hint" style={{ margin: 0 }}>{empty}</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {stages.map((stage, index) => (
            <div key={stage.key}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: "1rem",
                  fontSize: "0.9rem",
                  marginBottom: "0.2rem",
                }}
              >
                <span>{stage.label}</span>
                <span style={{ fontVariantNumeric: "tabular-nums", opacity: 0.85 }}>
                  <strong>{stage.count}</strong>
                  {index > 0 && (
                    <> · {stage.pctOfStart}% of start · {stage.pctOfPrev}% of prev</>
                  )}
                </span>
              </div>
              <div
                style={{
                  height: "0.75rem",
                  borderRadius: "999px",
                  background: "rgba(127,127,127,0.18)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${Math.max(stage.pctOfStart, startCount > 0 && stage.count > 0 ? 2 : 0)}%`,
                    background: "var(--brand-accent, #f97316)",
                    borderRadius: "999px",
                    transition: "width 200ms ease",
                  }}
                />
              </div>
              {index > 0 && stage.droppedFromPrev > 0 && (
                <p className="hint" style={{ margin: "0.15rem 0 0", fontSize: "0.78rem" }}>
                  {stage.droppedFromPrev} dropped off at this step
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default function AnalyticsFunnelPage() {
  const [data, setData] = useState<FunnelResponse | null>(null);
  const [error, setError] = useState("");
  const [windowKey, setWindowKey] = useState<WindowKey>("last30");

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/analytics-funnel", { cache: "no-store" });
    const result = (await response.json().catch(() => ({}))) as FunnelResponse;
    if (!response.ok) throw new Error(result.error || "Unable to load the funnel.");
    setData(result);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      load().catch((reason) =>
        setError(reason instanceof Error ? reason.message : "Unable to load the funnel."),
      );
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const active = data?.windows[windowKey];

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <Link className="brand" href="/">
          <BrandMark />
          <span>Tuveloz</span>
        </Link>
        <div>
          <span>Private owner dashboard</span>
          <Link href="/admin">Control center</Link>
          <Link href="/admin/launch-readiness">Integrated launch review</Link>
          <Link href="/">View site</Link>
        </div>
      </header>

      <section className="admin-intro">
        <span className="kicker">Owner control center</span>
        <h1>Funnel, launch list &amp; AI</h1>
        <p>
          Where people drop off between opening a form and finishing it, how many are
          waiting on the launch list, and what Tuveloz AI is being asked. Data comes only
          from this site&rsquo;s own event log — nothing is shared with a third party, and
          no email address or visitor question is stored here.
        </p>
      </section>

      {error && (
        <p className="form-error" role="alert" style={{ margin: "1rem 0" }}>
          {error}
        </p>
      )}

      {!data && !error && <p className="hint">Loading funnel…</p>}

      {active && (
        <>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", margin: "1rem 0" }}>
            {(Object.keys(WINDOW_LABELS) as WindowKey[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setWindowKey(key)}
                aria-pressed={windowKey === key}
                style={{
                  padding: "0.35rem 0.9rem",
                  borderRadius: "999px",
                  border: "1px solid rgba(127,127,127,0.35)",
                  background: windowKey === key ? "var(--brand-accent, #f97316)" : "transparent",
                  color: windowKey === key ? "#0b1220" : "inherit",
                  fontWeight: windowKey === key ? 600 : 400,
                  cursor: "pointer",
                }}
              >
                {WINDOW_LABELS[key]}
              </button>
            ))}
          </div>

          <Funnel
            title="Provider applications"
            stages={active.provider}
            empty="No provider signups have started in this window yet."
          />

          <Experiments windows={active.experiments} />

          <p className="hint" style={{ marginTop: "0.75rem" }}>
            Requirements step (only shown for services that need proof or legal documents):{" "}
            <strong>{active.context.requirementsStepCompleted}</strong> completed it
            {active.context.requirementsStepAbandoned > 0 && (
              <>, {active.context.requirementsStepAbandoned} abandoned it</>
            )}
            . A gap between &ldquo;Your services&rdquo; and &ldquo;Submitted&rdquo; is partly this
            skippable step, not only drop-off.
          </p>

          <Funnel
            title="Customer requests (not live yet)"
            stages={active.customer}
            empty="No customer requests recorded — expected while customer posting is paused."
          />

          <details style={{ marginTop: "1.75rem" }}>
            <summary style={{ cursor: "pointer" }}>All raw event counts ({WINDOW_LABELS[windowKey]})</summary>
            <table style={{ marginTop: "0.75rem", borderCollapse: "collapse", width: "100%", maxWidth: 460 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "0.3rem 0.6rem 0.3rem 0", opacity: 0.7 }}>Event</th>
                  <th style={{ textAlign: "right", padding: "0.3rem 0", opacity: 0.7 }}>Count</th>
                </tr>
              </thead>
              <tbody>
                {active.rawCounts.map((row) => (
                  <tr key={row.event}>
                    <td style={{ padding: "0.3rem 0.6rem 0.3rem 0", fontFamily: "monospace", fontSize: "0.82rem" }}>
                      {row.event}
                    </td>
                    <td style={{ padding: "0.3rem 0", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                      {row.count}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>

          {data.launchList && <LaunchListPanel list={data.launchList} />}
          {data.assistant && <AssistantPanel assistant={data.assistant} />}

          <p className="hint" style={{ marginTop: "1.5rem", fontSize: "0.78rem" }}>
            Generated {new Date(data.generatedAt).toLocaleString()}.
          </p>
        </>
      )}
    </main>
  );
}
