import { getDb } from "../../../db";
import { analyticsEvents } from "../../../db/schema";
import { normalizeTag } from "../../../lib/attribution";
import {
  InvalidJsonBodyError,
  RequestBodyTooLargeError,
  readLimitedJsonObject,
} from "../../../lib/limited-json";
import { consumeFixedWindow, rateLimitKeyHash } from "../../../lib/public-write-rate-limit";
import { isSameOriginRequest } from "../../../lib/request-security";

const KNOWN_EVENTS = new Set([
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
  "social_follow_clicked",
]);

// A funnel event is a few short tags. Anything larger is not a visitor.
const MAX_BODY_BYTES = 2048;

// Generous for a person — a provider filling in the application fires four
// events, and a whole repair shop can share one address — while still bounding
// how many rows a single source can push into the owner's decision metric.
const EVENTS_PER_HOUR_PER_IP = 120;

const MAX_PROP_KEYS = 12;
const MAX_PROP_LENGTH = 80;

/**
 * Re-normalize the attribution block server-side.
 *
 * The client already normalizes, but these values start life in the visitor's
 * URL bar and this endpoint is public. Trusting the browser's cleanup would
 * let anyone write arbitrary strings into the report the owner uses to decide
 * where the marketing budget goes.
 */
function cleanAttribution(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const from = value as Record<string, unknown>;
  const source = normalizeTag(typeof from.source === "string" ? from.source : "");
  if (!source) return null;
  return {
    source,
    medium: normalizeTag(typeof from.medium === "string" ? from.medium : "") || "unknown",
    campaign: normalizeTag(typeof from.campaign === "string" ? from.campaign : ""),
    landing: normalizeTag(typeof from.landing === "string" ? from.landing : "", 60),
  };
}

// Props stay open-ended so a new event can add a field without a server change,
// but bounded: scalars only, short values, few keys. `variants` (the A/B map)
// and `from` (attribution) have known shapes and are handled explicitly.
function cleanProps(value: unknown) {
  const props: Record<string, unknown> = {};
  if (!value || typeof value !== "object") return props;
  const input = value as Record<string, unknown>;

  const from = cleanAttribution(input.from);
  if (from) props.from = from;

  if (input.variants && typeof input.variants === "object") {
    const variants: Record<string, string> = {};
    for (const [name, variant] of Object.entries(input.variants as Record<string, unknown>)) {
      if (typeof variant !== "string") continue;
      variants[normalizeTag(name)] = variant.slice(0, MAX_PROP_LENGTH);
    }
    if (Object.keys(variants).length > 0) props.variants = variants;
  }

  for (const [key, entry] of Object.entries(input)) {
    if (key === "from" || key === "variants") continue;
    if (Object.keys(props).length >= MAX_PROP_KEYS) break;
    const name = normalizeTag(key);
    if (!name) continue;
    if (typeof entry === "string") props[name] = entry.slice(0, MAX_PROP_LENGTH);
    else if (typeof entry === "number" || typeof entry === "boolean") props[name] = entry;
  }
  return props;
}

export async function POST(request: Request) {
  // Funnel rows drive real spending decisions, so they have to come from this
  // site's own pages rather than from anything that can reach the URL.
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "Unknown event." }, { status: 403 });
  }

  try {
    const body = await readLimitedJsonObject(request, MAX_BODY_BYTES);
    const event = typeof body.event === "string" ? body.event : "";
    if (!KNOWN_EVENTS.has(event)) {
      return Response.json({ error: "Unknown event." }, { status: 400 });
    }

    const allowed = await consumeFixedWindow(
      "analytics:event:ip",
      await rateLimitKeyHash(request.headers.get("cf-connecting-ip") ?? "unknown"),
      EVENTS_PER_HOUR_PER_IP,
      60 * 60 * 1000,
    );
    if (!allowed) {
      return Response.json({ error: "Too many events just now." }, { status: 429 });
    }

    await getDb().insert(analyticsEvents).values({
      id: crypto.randomUUID(),
      event,
      props: JSON.stringify(cleanProps(body.props)),
    });
    return Response.json({ ok: true }, { status: 202 });
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError || error instanceof InvalidJsonBodyError) {
      return Response.json({ error: "Could not record event." }, { status: 400 });
    }
    console.error("Unable to record analytics event", error);
    return Response.json({ error: "Could not record event." }, { status: 400 });
  }
}
