import { and, count, gte, inArray } from "drizzle-orm";
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

/**
 * The marketing funnel, in the four stages the business is steered by.
 *
 * Each stage is a distinct act rather than a re-render of the one before it:
 * a visit landed, the provider page was deliberately opened, the application
 * was actually started, and it was submitted. Awareness counts sessions, not
 * page loads (see trackOnce in lib/analytics.ts) — as the denominator for
 * everything below, it would otherwise sink every rate on this page whenever
 * someone refreshed.
 *
 * The detailed PROVIDER_FUNNEL above stays as-is: it answers a different
 * question (where inside the form people stall) and is the base the copy
 * experiments have always measured against.
 */
const PROVIDER_STAGES: StepDef[] = [
  { key: "awareness", event: "site_visited", label: "Awareness — arrived on the site" },
  { key: "interest", event: "provider_signup_started", label: "Interest — opened the provider page" },
  { key: "consideration", event: "provider_form_engaged", label: "Consideration — started the application" },
  { key: "decision", event: "provider_signup_completed", label: "Decision — submitted it" },
];

const CUSTOMER_FUNNEL: StepDef[] = [
  { key: "started", event: "customer_request_started", label: "Started a request" },
  { key: "posted", event: "customer_request_posted", label: "Posted the request" },
];

// Everything we track, for a raw count table below the funnels.
const ALL_EVENTS = [
  "site_visited",
  "provider_signup_started",
  "provider_form_engaged",
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

type ExperimentRow = {
  variant: string;
  started: number;
  submitted: number;
  conversion: number;
};

// Experiments whose conversion is start → submitted on the provider funnel.
// Add a name here (and render copy variants in the app) to measure it.
const EXPERIMENTS = ["provider_hero", "provider_pitch", "founding_cta"] as const;

// Read the variant this row was tagged with for a given experiment. Current
// events carry props.variants = { [name]: "A" | "B" }; the older single-field
// shape ({ experiment, variant }) is honored too so no data is lost.
function readVariant(props: string | null, name: string): string {
  try {
    const parsed = JSON.parse(props ?? "{}") as {
      variants?: Record<string, unknown>;
      experiment?: unknown;
      variant?: unknown;
    };
    const fromMap = parsed.variants?.[name];
    if (typeof fromMap === "string") return fromMap;
    if (parsed.experiment === name && typeof parsed.variant === "string") return parsed.variant;
  } catch {
    // Malformed props — treat as unassigned.
  }
  return "";
}

// Real conversion per copy variant, so wording is judged by data, not taste.
// Rows without a valid A/B variant are ignored rather than lumped into a
// misleading bucket.
async function experimentsSince(sinceValue: string | null): Promise<Record<string, ExperimentRow[]>> {
  const db = getDb();
  const events = ["provider_signup_started", "provider_signup_completed"];
  const eventFilter = inArray(analyticsEvents.event, events);
  const rows = await db
    .select({ event: analyticsEvents.event, props: analyticsEvents.props })
    .from(analyticsEvents)
    .where(sinceValue ? and(gte(analyticsEvents.createdAt, sinceValue), eventFilter) : eventFilter);

  const result: Record<string, ExperimentRow[]> = {};
  for (const name of EXPERIMENTS) {
    const tally = new Map<string, { started: number; submitted: number }>();
    for (const row of rows) {
      const variant = readVariant(row.props, name);
      if (variant !== "A" && variant !== "B") continue;
      const bucket = tally.get(variant) ?? { started: 0, submitted: 0 };
      if (row.event === "provider_signup_started") bucket.started += 1;
      else bucket.submitted += 1;
      tally.set(variant, bucket);
    }
    result[name] = [...tally.entries()]
      .map(([variant, value]) => ({
        variant,
        started: value.started,
        submitted: value.submitted,
        conversion: pct(value.submitted, value.started),
      }))
      .sort((a, b) => a.variant.localeCompare(b.variant));
  }
  return result;
}

type StageTally = {
  source: string;
  medium: string;
  awareness: number;
  interest: number;
  consideration: number;
  decision: number;
};

type ChannelRow = StageTally & {
  key: string;
  /** Decision ÷ awareness, or null when this channel has no awareness data. */
  conversion: number | null;
};

// Which stage each event advances, so a channel is measured on the same four
// stages the headline funnel uses.
const STAGE_OF_EVENT: Record<string, keyof Omit<StageTally, "source" | "medium">> = {
  site_visited: "awareness",
  provider_signup_started: "interest",
  provider_form_engaged: "consideration",
  provider_signup_completed: "decision",
};

// The bucket for events recorded before channel tracking shipped, and for any
// event that arrives without attribution. Kept visibly separate from "direct"
// — folding unlabeled history into a real channel would overstate it and send
// the budget to the wrong place, which is the exact mistake this report exists
// to prevent.
const UNLABELED = "unlabeled";

// Where a signup came from, as recorded by lib/attribution.ts on the first page
// the visitor landed on.
function readFrom(props: string | null) {
  try {
    const parsed = JSON.parse(props ?? "{}") as { from?: Record<string, unknown> };
    const from = parsed.from;
    if (!from || typeof from !== "object") return null;
    const source = typeof from.source === "string" ? from.source : "";
    if (!source) return null;
    return {
      source,
      medium: typeof from.medium === "string" ? from.medium : "unknown",
      campaign: typeof from.campaign === "string" ? from.campaign : "",
    };
  } catch {
    return null;
  }
}

function toRows(tally: Map<string, StageTally>): ChannelRow[] {
  return [...tally.entries()]
    .map(([key, value]) => ({
      key,
      ...value,
      // Rows recorded before awareness tracking shipped have decisions but no
      // sessions to divide by. Reporting 0% there would read as a dead channel
      // rather than as missing data, so say nothing instead.
      conversion: value.awareness > 0 ? pct(value.decision, value.awareness) : null,
    }))
    .sort((a, b) =>
      b.awareness - a.awareness
      || b.decision - a.decision
      || b.interest - a.interest
      || a.key.localeCompare(b.key));
}

/**
 * Provider applications broken down by where the visitor came from.
 *
 * This is the number the audience growth playbook calls the only one that
 * decides anything. Campaigns are reported separately from channels so a
 * per-town flyer run ("flyer-wheaton") can be compared against its siblings
 * without splitting the channel total it belongs to.
 */
async function channelsSince(sinceValue: string | null) {
  const db = getDb();
  const eventFilter = inArray(analyticsEvents.event, Object.keys(STAGE_OF_EVENT));
  const rows = await db
    .select({ event: analyticsEvents.event, props: analyticsEvents.props })
    .from(analyticsEvents)
    .where(sinceValue ? and(gte(analyticsEvents.createdAt, sinceValue), eventFilter) : eventFilter);

  const byChannel = new Map<string, StageTally>();
  const byCampaign = new Map<string, StageTally>();
  const blank = (source: string, medium: string): StageTally => ({
    source,
    medium,
    awareness: 0,
    interest: 0,
    consideration: 0,
    decision: 0,
  });

  for (const row of rows) {
    const stage = STAGE_OF_EVENT[row.event];
    if (!stage) continue;
    const from = readFrom(row.props);
    const source = from?.source ?? UNLABELED;
    const medium = from?.medium ?? "";

    const channelKey = medium ? `${source} · ${medium}` : source;
    const channel = byChannel.get(channelKey) ?? blank(source, medium);
    channel[stage] += 1;
    byChannel.set(channelKey, channel);

    if (!from?.campaign) continue;
    const campaign = byCampaign.get(from.campaign) ?? blank(source, medium);
    campaign[stage] += 1;
    byCampaign.set(from.campaign, campaign);
  }

  return { channels: toRows(byChannel), campaigns: toRows(byCampaign) };
}

function windowPayload(
  counts: Map<string, number>,
  experiments: Record<string, ExperimentRow[]>,
  attribution: { channels: ChannelRow[]; campaigns: ChannelRow[] },
) {
  return {
    stages: buildFunnel(PROVIDER_STAGES, counts),
    provider: buildFunnel(PROVIDER_FUNNEL, counts),
    customer: buildFunnel(CUSTOMER_FUNNEL, counts),
    context: {
      // Step 2 is conditional — see note above.
      requirementsStepCompleted: counts.get("provider_step2_completed") ?? 0,
      requirementsStepAbandoned: counts.get("provider_step2_abandoned") ?? 0,
      providerFirstQuoteSent: counts.get("provider_first_quote_sent") ?? 0,
    },
    experiments,
    channels: attribution.channels,
    campaigns: attribution.campaigns,
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
    const since30 = threshold(30, now);
    const since7 = threshold(7, now);
    const [allTime, last30, last7, expAll, exp30, exp7, chanAll, chan30, chan7] = await Promise.all([
      countsSince(null),
      countsSince(since30),
      countsSince(since7),
      experimentsSince(null),
      experimentsSince(since30),
      experimentsSince(since7),
      channelsSince(null),
      channelsSince(since30),
      channelsSince(since7),
    ]);
    return Response.json(
      {
        generatedAt: new Date(now).toISOString(),
        note: "First-party funnel from analytics_events. Step 2 (Requirements) is conditional and shown as context, not a mainline stage, because the form skips it when selected services need no proof or legal documents.",
        windows: {
          allTime: windowPayload(allTime, expAll, chanAll),
          last30: windowPayload(last30, exp30, chan30),
          last7: windowPayload(last7, exp7, chan7),
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
