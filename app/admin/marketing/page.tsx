"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { BrandMark } from "../../components/tuveloz-icons";

type KeyCount = { key: string; count: number };

type MarketingWindow = {
  followClicks: {
    total: number;
    byPlatform: KeyCount[];
    byPlacement: KeyCount[];
  };
  applications: {
    started: number;
    submitted: number;
    conversionPct: number;
  };
  emailSignups: {
    total: number;
    bySource: KeyCount[];
  };
};

type MarketingResponse = {
  error?: string;
  generatedAt: string;
  note: string;
  windows: {
    allTime: MarketingWindow;
    last30: MarketingWindow;
    last7: MarketingWindow;
  };
  emailList: {
    active: number;
    unsubscribed: number;
  };
};

type WindowKey = "last7" | "last30" | "allTime";

const WINDOW_LABELS: Record<WindowKey, string> = {
  last7: "Last 7 days",
  last30: "Last 30 days",
  allTime: "All time",
};

const PLATFORM_LABELS: Record<string, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  facebook: "Facebook",
  x: "X",
  google: "Google",
};

// Placement values come from the `source` prop passed to FollowAlong /
// LaunchUpdatesForm call sites; unknown values render as their raw key so new
// placements show up without a code change here.
const PLACEMENT_LABELS: Record<string, string> = {
  provider_application_received: "Provider application-received screen",
  welcome_provider: "Provider welcome page",
  welcome_customer: "Customer welcome page",
  "customer-dashboard": "Customer dashboard",
};

function CountTable({
  caption,
  rows,
  labels,
  empty,
}: {
  caption: string;
  rows: KeyCount[];
  labels: Record<string, string>;
  empty: string;
}) {
  if (rows.length === 0) return <p className="hint" style={{ margin: 0 }}>{empty}</p>;
  return (
    <table style={{ borderCollapse: "collapse", width: "100%", maxWidth: 460 }}>
      <thead>
        <tr>
          <th style={{ textAlign: "left", padding: "0.3rem 0.6rem 0.3rem 0", opacity: 0.7 }}>{caption}</th>
          <th style={{ textAlign: "right", padding: "0.3rem 0", opacity: 0.7 }}>Clicks</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.key}>
            <td style={{ padding: "0.3rem 0.6rem 0.3rem 0" }}>{labels[row.key] ?? row.key}</td>
            <td style={{ padding: "0.3rem 0", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
              {row.count}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function MarketingPage() {
  const [data, setData] = useState<MarketingResponse | null>(null);
  const [error, setError] = useState("");
  const [windowKey, setWindowKey] = useState<WindowKey>("last30");

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/marketing", { cache: "no-store" });
    const result = (await response.json().catch(() => ({}))) as MarketingResponse;
    if (!response.ok) throw new Error(result.error || "Unable to load marketing data.");
    setData(result);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      load().catch((reason) =>
        setError(reason instanceof Error ? reason.message : "Unable to load marketing data."),
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
          <Link href="/admin/analytics-funnel">Signup funnel</Link>
          <Link href="/">View site</Link>
        </div>
      </header>

      <section className="admin-intro">
        <span className="kicker">Owner control center</span>
        <h1>Marketing</h1>
        <p>
          The weekly numbers from the audience-growth playbook, read from this site&rsquo;s own
          first-party data. This page only reads — stage-by-stage drop-off stays on the{" "}
          <Link href="/admin/analytics-funnel">Signup funnel</Link> page.
        </p>
      </section>

      {error && (
        <p className="form-error" role="alert" style={{ margin: "1rem 0" }}>
          {error}
        </p>
      )}

      {!data && !error && <p className="hint">Loading marketing data…</p>}

      {data && active && (
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

          <section style={{ marginTop: "1.5rem" }}>
            <h2 style={{ fontSize: "1.05rem", margin: "0 0 0.35rem" }}>Provider applications</h2>
            <p className="hint" style={{ margin: "0 0 0.5rem", fontSize: "0.82rem" }}>
              The number that decides launch viability. Playbook target: 20&ndash;40 applications
              from social over 8 weeks.
            </p>
            <p style={{ margin: 0, fontSize: "0.95rem" }}>
              <strong style={{ fontVariantNumeric: "tabular-nums" }}>{active.applications.submitted}</strong>{" "}
              submitted from{" "}
              <strong style={{ fontVariantNumeric: "tabular-nums" }}>{active.applications.started}</strong>{" "}
              form opens
              {active.applications.started > 0 && (
                <> · {active.applications.conversionPct}% conversion</>
              )}
              . <Link href="/admin/analytics-funnel">See where people drop off →</Link>
            </p>
          </section>

          <section style={{ marginTop: "1.75rem" }}>
            <h2 style={{ fontSize: "1.05rem", margin: "0 0 0.35rem" }}>Social follow clicks</h2>
            <p className="hint" style={{ margin: "0 0 0.5rem", fontSize: "0.82rem" }}>
              Clicks on the post-commit follow prompts ({active.followClicks.total} in this
              window). Footer links are intentionally untracked.
            </p>
            <div style={{ display: "flex", gap: "2rem", flexWrap: "wrap" }}>
              <CountTable
                caption="Platform"
                rows={active.followClicks.byPlatform}
                labels={PLATFORM_LABELS}
                empty="No follow clicks recorded in this window yet."
              />
              {active.followClicks.byPlacement.length > 0 && (
                <CountTable
                  caption="Placement"
                  rows={active.followClicks.byPlacement}
                  labels={PLACEMENT_LABELS}
                  empty=""
                />
              )}
            </div>
          </section>

          <section style={{ marginTop: "1.75rem" }}>
            <h2 style={{ fontSize: "1.05rem", margin: "0 0 0.35rem" }}>Launch-updates email list</h2>
            <p className="hint" style={{ margin: "0 0 0.5rem", fontSize: "0.82rem" }}>
              Social reach is rented; this list is owned. Currently{" "}
              <strong>{data.emailList.active}</strong> subscribed
              {data.emailList.unsubscribed > 0 && <>, {data.emailList.unsubscribed} unsubscribed</>}.
            </p>
            {active.emailSignups.total === 0 ? (
              <p className="hint" style={{ margin: 0 }}>No new signups in this window yet.</p>
            ) : (
              <CountTable
                caption={`New signups (${active.emailSignups.total})`}
                rows={active.emailSignups.bySource}
                labels={PLACEMENT_LABELS}
                empty=""
              />
            )}
          </section>

          <p className="hint" style={{ marginTop: "1.75rem", fontSize: "0.78rem" }}>
            Not measurable here, per the playbook: follower locality, and saves and shares per
            post. Check Instagram and TikTok insights for those — if Montgomery County is not the
            top city cluster, the content is reaching the wrong people.
          </p>

          <p className="hint" style={{ marginTop: "1rem", fontSize: "0.78rem" }}>
            Generated {new Date(data.generatedAt).toLocaleString()}.
          </p>
        </>
      )}
    </main>
  );
}
