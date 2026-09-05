import { getDb } from "../../../db";
import { analyticsEvents } from "../../../db/schema";

import { CLIENT_ANALYTICS_EVENTS, cleanAnalyticsProps } from "../../../lib/analytics-policy";
import { readLimitedJsonObject, RequestBodyTooLargeError } from "../../../lib/limited-json";
import { isStrictSameOriginWriteRequest } from "../../../lib/request-security";
import { consumeFixedWindow, rateLimitKeyHash } from "../../../lib/public-write-rate-limit";

const reply = (body: unknown, status: number) => Response.json(body, {
  status, headers: { "cache-control": "no-store" },
});

export async function POST(request: Request) {
  if (!isStrictSameOriginWriteRequest(request)) return reply({ error: "Origin required." }, 403);
  let body: Record<string, unknown>;
  try {
    body = await readLimitedJsonObject(request, 4096);
  } catch (error) {
    return reply({ error: "Invalid event body." }, error instanceof RequestBodyTooLargeError ? 413 : 400);
  }
  const event = typeof body.event === "string" ? body.event : "";
  if (!CLIENT_ANALYTICS_EVENTS.has(event)) return reply({ error: "Unknown event." }, 400);
  try {
    const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
    if (!await consumeFixedWindow("analytics-ip", await rateLimitKeyHash(ip), 120, 60_000)) {
      return reply({ error: "Too many events." }, 429);
    }
    await getDb().insert(analyticsEvents).values({
      id: crypto.randomUUID(),
      event,
      props: JSON.stringify(cleanAnalyticsProps(body.props)),
    });
    return reply({ ok: true }, 202);
  } catch {
    return reply({ error: "Could not record event." }, 503);
  }
}
