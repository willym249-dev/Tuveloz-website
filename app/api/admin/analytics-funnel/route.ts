import { and, count, eq, gte, inArray } from "drizzle-orm";
import { getDb } from "../../../../db";
import { analyticsEvents, launchUpdateSubscribers, providerApplications } from "../../../../db/schema";
import { PROVIDER_APPLICATION_SUBMITTED } from "../../../../lib/analytics-policy";
import { verifyOwnerRequest } from "../../../../lib/owner-auth";
import { ASSISTANT_EVENT, type AssistantEventProps } from "../../../../lib/ai/assistant-telemetry";
import { POLICY_ENTRIES } from "../../../../lib/ai/policy-knowledge";

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
  { key: "verification", event: "provider_verification_requested", label: "Requested the email verification code" },
  { key: "submitted", event: PROVIDER_APPLICATION_SUBMITTED, label: "Saved a new application (server confirmed)" },
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
  "provider_verification_requested",
  PROVIDER_APPLICATION_SUBMITTED,
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

type CampaignRow = {
  source: string;
  medium: string;
  campaign: string;
  content: string;
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

// Event ratios per copy variant; repeated visits and unmatched time windows
// mean these are supporting data, not unique-visitor conversion or significance.
// Rows without a valid A/B variant are ignored rather than lumped into a
// misleading bucket.
async function experimentsSince(sinceValue: string | null): Promise<Record<string, ExperimentRow[]>> {
  const db = getDb();
  const events = ["provider_signup_started", PROVIDER_APPLICATION_SUBMITTED];
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

function readCampaign(props: string | null) {
  try {
    const parsed = JSON.parse(props ?? "{}") as Record<string, unknown>;
    const value = (key: string) => typeof parsed[key] === "string" ? parsed[key] : "";
    return {
      source: value("utm_source"),
      medium: value("utm_medium"),
      campaign: value("utm_campaign"),
      content: value("utm_content"),
    };
  } catch {
    return { source: "", medium: "", campaign: "", content: "" };
  }
}

async function campaignsSince(sinceValue: string | null): Promise<CampaignRow[]> {
  const eventFilter = inArray(analyticsEvents.event, [
    "provider_signup_started",
    PROVIDER_APPLICATION_SUBMITTED,
  ]);
  const rows = await getDb()
    .select({ event: analyticsEvents.event, props: analyticsEvents.props })
    .from(analyticsEvents)
    .where(sinceValue ? and(gte(analyticsEvents.createdAt, sinceValue), eventFilter) : eventFilter);

  const tally = new Map<string, Omit<CampaignRow, "conversion">>();
  for (const row of rows) {
    const campaign = readCampaign(row.props);
    if (!campaign.source || !campaign.campaign) continue;
    const key = JSON.stringify(campaign);
    const bucket = tally.get(key) ?? { ...campaign, started: 0, submitted: 0 };
    if (row.event === "provider_signup_started") bucket.started += 1;
    else bucket.submitted += 1;
    tally.set(key, bucket);
  }

  return [...tally.values()]
    .map((row) => ({ ...row, conversion: pct(row.submitted, row.started) }))
    .sort((a, b) => b.submitted - a.submitted || b.started - a.started);
}

function windowPayload(
  counts: Map<string, number>,
  experiments: Record<string, ExperimentRow[]>,
  campaigns: CampaignRow[],
  savedApplications: number,
) {
  return {
    savedApplications,
    provider: buildFunnel(PROVIDER_FUNNEL, counts),
    customer: buildFunnel(CUSTOMER_FUNNEL, counts),
    context: {
      // Step 2 is conditional — see note above.
      requirementsStepCompleted: counts.get("provider_step2_completed") ?? 0,
      providerFirstQuoteSent: counts.get("provider_first_quote_sent") ?? 0,
    },
    experiments,
    campaigns,
    rawCounts: ALL_EVENTS.map((event) => ({ event, count: counts.get(event) ?? 0 })),
  };
}

const TOPIC_LABELS = new Map(POLICY_ENTRIES.map((entry) => [entry.id, entry.question]));

// Authoritative counts include earlier applications and do not rely on beacons.
async function savedApplicationsSince(since: string | null) {
  const real = eq(providerApplications.isTestProvider, "no");
  const [row] = await getDb().select({ value: count() }).from(providerApplications)
    .where(since ? and(real, gte(providerApplications.createdAt, since)) : real);
  return Number(row?.value ?? 0);
}

/**
 * What the assistant has been asked and whether its money answers stayed
 * hedged. Reads the shape-only rows written by lib/ai/assistant-telemetry.ts —
 * there is no question or answer text in this table to read.
 */
async function assistantSummary(since: string | null) {
  const where = since
    ? and(eqEvent(), gte(analyticsEvents.createdAt, since))
    : eqEvent();
  const rows = await getDb()
    .select({ props: analyticsEvents.props })
    .from(analyticsEvents)
    .where(where);

  const topics = new Map<string, number>();
  let answered = 0;
  let grounded = 0;
  let guardReplaced = 0;
  const byAudience = { customer: 0, provider: 0 };

  for (const row of rows) {
    answered += 1;
    let props: Partial<AssistantEventProps> = {};
    try {
      props = JSON.parse(row.props) as Partial<AssistantEventProps>;
    } catch {
      continue;
    }
    if (props.audience === "provider") byAudience.provider += 1;
    else byAudience.customer += 1;
    if (props.grounded) grounded += 1;
    if (props.guard === "replaced") guardReplaced += 1;
    for (const topic of props.topics ?? []) {
      topics.set(topic, (topics.get(topic) ?? 0) + 1);
    }
  }

  return {
    answered,
    grounded,
    vehicleOnly: answered - grounded,
    byAudience,
    // A non-zero count means the model stated a provisional design as settled
    // fact and the vetted wording was served instead. Worth a look at the
    // prompt, not a customer-facing incident.
    guardReplaced,
    topTopics: [...topics.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([id, askCount]) => ({ id, label: TOPIC_LABELS.get(id) ?? id, count: askCount })),
  };
}

function eqEvent() {
  return inArray(analyticsEvents.event, [ASSISTANT_EVENT]);
}

/**
 * The pre-launch email list. Nothing here shows an address: the owner needs the
 * size and the shape of the list, and the addresses themselves live behind the
 * privacy tooling.
 */
async function launchListSummary(since: string | null) {
  const db = getDb();
  const rows = await db
    .select({
      source: launchUpdateSubscribers.source,
      unsubscribedAt: launchUpdateSubscribers.unsubscribedAt,
      consentedAt: launchUpdateSubscribers.consentedAt,
    })
    .from(launchUpdateSubscribers);

  const bySource = new Map<string, number>();
  let subscribed = 0;
  let unsubscribed = 0;
  let recent = 0;

  for (const row of rows) {
    if (row.unsubscribedAt) {
      unsubscribed += 1;
      continue;
    }
    subscribed += 1;
    const source = row.source || "unknown";
    bySource.set(source, (bySource.get(source) ?? 0) + 1);
    if (since && row.consentedAt && row.consentedAt >= since) recent += 1;
  }

  return {
    subscribed,
    unsubscribed,
    recent,
    bySource: [...bySource.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([source, subscriberCount]) => ({ source, count: subscriberCount })),
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
    const [
      allTime, last30, last7, expAll, exp30, exp7, campaignAll, campaign30, campaign7,
      assistantAll, assistant7, launchList,
      savedAll, saved30, saved7,
    ] = await Promise.all([
      countsSince(null),
      countsSince(since30),
      countsSince(since7),
      experimentsSince(null),
      experimentsSince(since30),
      experimentsSince(since7),
      campaignsSince(null),
      campaignsSince(since30),
      campaignsSince(since7),
      assistantSummary(null),
      assistantSummary(since7),
      launchListSummary(since7),
      savedApplicationsSince(null),
      savedApplicationsSince(since30),
      savedApplicationsSince(since7),
    ]);
    return Response.json(
      {
        generatedAt: new Date(now).toISOString(),
        note: "Saved application totals come from application records and exclude test providers. Funnel stages are event counts, not unique people or matched cohorts; repeat visits and different time windows can change the ratios. Email-code and server-confirmed submission events began with the tracking repair; older browser-reported completions remain only in raw counts. Blocked or failed telemetry can undercount. Requirements is a conditional step.",
        windows: {
          allTime: windowPayload(allTime, expAll, campaignAll, savedAll),
          last30: windowPayload(last30, exp30, campaign30, saved30),
          last7: windowPayload(last7, exp7, campaign7, saved7),
        },
        assistant: { allTime: assistantAll, last7: assistant7 },
        launchList,
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
