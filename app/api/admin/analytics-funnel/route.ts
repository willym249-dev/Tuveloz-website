import { count, gte } from "drizzle-orm";
import { getDb } from "../../../../db";
import { analyticsEvents } from "../../../../db/schema";
import { verifyOwnerRequest } from "../../../../lib/owner-auth";

// Owner-only read of the first-party funnel events collected in the
// analytics_events D1 table (see lib/analytics.ts). Nothing here is sent to a
// third party; it simply aggregates what /api/analytics already records so
// signup drop-off is visible without standing up an external analytics tool.

type StepDef = { key: string; event: string; label: string };

// Mainline provider funnel. Step 2 ("Requirements") is intentionally NOT a
// mainline stage: the signup form skips it whenever the selected services need
// no proof upload and have no visible legal requirements, so counting it inline
// would read as fake abandonment. It is surfaced separately as context.
const PROVIDER_FUNNEL: StepDef[] = [
  { key: "started", event: "provider_signup_started", label: "Opened the provider form" },
  { key: "services", event: "provider_step1_completed", label: "Finished step: Your services" },
  { key: "submitted", event: "provider_signup_completed", label: "Submitted the application" },
];

const CUSTOMER_FUNNEL: StepDef[] = [
  { key: "started", event: "customer_request_started", label: "Started a request" },
  { key: "posted", event: "customer_request_posted", label: "Posted the request" },
];

// Everything we track, for a raw count table below the funnels.
const ALL_EVENTS = [
  "provider_signup_started",
  "provider_step1_completed",
  "provider_step2_completed",
  "provider_step2_abandoned",
  "provider_signup_completed",
  "provider_first_quote_sent",
  "customer_request_started",
  "customer_request_posted",
  "quote_received",
  "quote_accepted",
  "job_completed",
];

type FunnelStage = {
  key: string;
  label: string;
  event: string;
  count: number;
  pctOfStart: number;
  pctOfPrev: number;
  droppedFromPrev: number;
};

function pct(part: number, whole: number) {
  if (whole <= 0) return 0;
  return Math.round((part / whole) * 1000) / 10;
}

function buildFunnel(steps: StepDef[], counts: Map<string, number>): FunnelStage[] {
  const startCount = counts.get(steps[0]?.event ?? "") ?? 0;
  let prev = startCount;
  return steps.map((step, index) => {
    const value = counts.get(step.event) ?? 0;
    const stage: FunnelStage = {
      key: step.key,
      label: step.label,
      event: step.event,
      count: value,
      pctOfStart: pct(value, startCount),
      pctOfPrev: index === 0 ? 100 : pct(value, prev),
      droppedFromPrev: index === 0 ? 0 : Math.max(0, prev - value),
    };
    prev = value;
    return stage;
  });
}

// D1 CURRENT_TIMESTAMP stores "YYYY-MM-DD HH:MM:SS" (UTC). Produce a threshold
// in the same shape so lexical comparison on the text column is correct.
function threshold(daysAgo: number, now: number) {
  return new Date(now - daysAgo * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 19)
    .replace("T", " ");
}

async function countsSince(sinceValue: string | null): Promise<Map<string, number>> {
  const db = getDb();
  const base = db
    .select({ event: analyticsEvents.event, value: count() })
    .from(analyticsEvents);
  const rows = sinceValue
    ? await base.where(gte(analyticsEvents.createdAt, sinceValue)).groupBy(analyticsEvents.event)
    : await base.groupBy(analyticsEvents.event);
  const map = new Map<string, number>();
  for (const row of rows) map.set(row.event, Number(row.value));
  return map;
}

function windowPayload(counts: Map<string, number>) {
  return {
    provider: buildFunnel(PROVIDER_FUNNEL, counts),
    customer: buildFunnel(CUSTOMER_FUNNEL, counts),
    context: {
      // Step 2 is conditional — see note above.
      requirementsStepCompleted: counts.get("provider_step2_completed") ?? 0,
      requirementsStepAbandoned: counts.get("provider_step2_abandoned") ?? 0,
      providerFirstQuoteSent: counts.get("provider_first_quote_sent") ?? 0,
    },
    rawCounts: ALL_EVENTS.map((event) => ({ event, count: counts.get(event) ?? 0 })),
  };
}

export async function GET(request: Request) {
  const verification = await verifyOwnerRequest(request);
  if (!verification.ok) {
    const status = verification.reason === "owner-config-missing" ? 503 : 403;
    return Response.json(
      {
        error: status === 503
          ? "Owner access is not fully configured on this deployment."
          : "Signed owner verification is required to view the funnel.",
        reason: verification.reason,
      },
      { status, headers: { "cache-control": "no-store" } },
    );
  }

  try {
    const now = Date.now();
    const [allTime, last30, last7] = await Promise.all([
      countsSince(null),
      countsSince(threshold(30, now)),
      countsSince(threshold(7, now)),
    ]);
    return Response.json(
      {
        generatedAt: new Date(now).toISOString(),
        note: "First-party funnel from analytics_events. Step 2 (Requirements) is conditional and shown as context, not a mainline stage, because the form skips it when selected services need no proof or legal documents.",
        windows: {
          allTime: windowPayload(allTime),
          last30: windowPayload(last30),
          last7: windowPayload(last7),
        },
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    console.error("Unable to load analytics funnel", error);
    return Response.json(
      { error: "Unable to load the funnel. Confirm the analytics_events table exists in this database." },
      { status: 500, headers: { "cache-control": "no-store" } },
    );
  }
}
