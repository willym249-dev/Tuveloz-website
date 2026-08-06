import { eq, inArray } from "drizzle-orm";
import { getDb } from "../../../../db";
import { analyticsEvents, launchUpdateSubscribers } from "../../../../db/schema";
import { verifyOwnerRequest } from "../../../../lib/owner-auth";

// Owner-only, read-only marketing summary. It aggregates data other parts of
// the site already record — social_follow_clicked events, the provider-signup
// funnel endpoints, and the launch-updates email list — into the numbers the
// audience-growth playbook (brand/outreach/audience-growth-playbook.md §6)
// says to watch weekly. Nothing here writes anything, and the signup-funnel
// endpoint at /api/admin/analytics-funnel is left as the source of truth for
// stage-by-stage drop-off.

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

function pct(part: number, whole: number) {
  if (whole <= 0) return 0;
  return Math.round((part / whole) * 1000) / 10;
}

// D1 CURRENT_TIMESTAMP stores "YYYY-MM-DD HH:MM:SS" (UTC). Produce a threshold
// in the same shape so lexical comparison on the text column is correct.
function threshold(daysAgo: number, now: number) {
  return new Date(now - daysAgo * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 19)
    .replace("T", " ");
}

function sortedCounts(map: Map<string, number>): KeyCount[] {
  return [...map.entries()]
    .map(([key, value]) => ({ key, count: value }))
    .sort((first, second) => second.count - first.count || first.key.localeCompare(second.key));
}

function tally(map: Map<string, number>, key: string) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

type FollowClickRow = { props: string | null; createdAt: string };
type SubscriberRow = { source: string; createdAt: string; unsubscribedAt: string };
type SignupCountRow = { event: string; createdAt: string };

function windowPayload(
  sinceValue: string | null,
  followRows: FollowClickRow[],
  signupRows: SignupCountRow[],
  subscriberRows: SubscriberRow[],
): MarketingWindow {
  const inWindow = (createdAt: string) => !sinceValue || createdAt >= sinceValue;

  const byPlatform = new Map<string, number>();
  const byPlacement = new Map<string, number>();
  let followTotal = 0;
  for (const row of followRows) {
    if (!inWindow(row.createdAt)) continue;
    followTotal += 1;
    try {
      const parsed = JSON.parse(row.props ?? "{}") as { platform?: unknown; source?: unknown };
      tally(byPlatform, typeof parsed.platform === "string" && parsed.platform ? parsed.platform : "unknown");
      tally(byPlacement, typeof parsed.source === "string" && parsed.source ? parsed.source : "unknown");
    } catch {
      tally(byPlatform, "unknown");
      tally(byPlacement, "unknown");
    }
  }

  let started = 0;
  let submitted = 0;
  for (const row of signupRows) {
    if (!inWindow(row.createdAt)) continue;
    if (row.event === "provider_signup_started") started += 1;
    if (row.event === "provider_signup_completed") submitted += 1;
  }

  const signupsBySource = new Map<string, number>();
  let signupTotal = 0;
  for (const row of subscriberRows) {
    if (!inWindow(row.createdAt)) continue;
    signupTotal += 1;
    tally(signupsBySource, row.source || "unknown");
  }

  return {
    followClicks: {
      total: followTotal,
      byPlatform: sortedCounts(byPlatform),
      byPlacement: sortedCounts(byPlacement),
    },
    applications: { started, submitted, conversionPct: pct(submitted, started) },
    emailSignups: { total: signupTotal, bySource: sortedCounts(signupsBySource) },
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
          : "Signed owner verification is required to view marketing data.",
        reason: verification.reason,
      },
      { status, headers: { "cache-control": "no-store" } },
    );
  }

  try {
    const db = getDb();
    const now = Date.now();
    const since30 = threshold(30, now);
    const since7 = threshold(7, now);

    // One fetch per data set, filtered to the 30-day window in JS afterwards.
    // Pre-launch volumes are tiny, and reading rows once keeps the three
    // windows consistent with each other.
    const [followRows, signupRows, subscriberRows] = await Promise.all([
      db
        .select({ props: analyticsEvents.props, createdAt: analyticsEvents.createdAt })
        .from(analyticsEvents)
        .where(eq(analyticsEvents.event, "social_follow_clicked")),
      db
        .select({ event: analyticsEvents.event, createdAt: analyticsEvents.createdAt })
        .from(analyticsEvents)
        .where(inArray(analyticsEvents.event, [
          "provider_signup_started",
          "provider_signup_completed",
        ])),
      db
        .select({
          source: launchUpdateSubscribers.source,
          createdAt: launchUpdateSubscribers.createdAt,
          unsubscribedAt: launchUpdateSubscribers.unsubscribedAt,
        })
        .from(launchUpdateSubscribers),
    ]);

    const activeSubscribers = subscriberRows.filter((row) => row.unsubscribedAt === "");

    return Response.json(
      {
        generatedAt: new Date(now).toISOString(),
        note: "Read-only marketing summary from first-party data. Stage-by-stage signup drop-off stays on /admin/analytics-funnel; follower locality, saves, and shares live in each platform's own insights.",
        windows: {
          allTime: windowPayload(null, followRows, signupRows, subscriberRows),
          last30: windowPayload(since30, followRows, signupRows, subscriberRows),
          last7: windowPayload(since7, followRows, signupRows, subscriberRows),
        },
        emailList: {
          active: activeSubscribers.length,
          unsubscribed: subscriberRows.length - activeSubscribers.length,
        },
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    console.error("Unable to load marketing summary", error);
    return Response.json(
      { error: "Unable to load marketing data. Confirm the analytics_events and launch_update_subscribers tables exist in this database." },
      { status: 500, headers: { "cache-control": "no-store" } },
    );
  }
}
