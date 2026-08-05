import { sql } from "drizzle-orm";
import { getDb } from "../db";
import { publicWriteRateLimits } from "../db/schema";

/**
 * Fixed-window rate limit for unauthenticated writes.
 *
 * Extracted from provider-application-verification so more than one public
 * endpoint can use it. Returns true when the request is within the limit.
 */
export async function consumeFixedWindow(
  action: string,
  keyHash: string,
  limit: number,
  windowMs: number,
) {
  const now = Date.now();
  const cutoff = now - windowMs;
  const rows = await getDb().insert(publicWriteRateLimits).values({
    action,
    keyHash,
    windowStartedAt: now,
    requestCount: 1,
    updatedAt: new Date(now).toISOString(),
  }).onConflictDoUpdate({
    target: [publicWriteRateLimits.action, publicWriteRateLimits.keyHash],
    set: {
      windowStartedAt: sql<number>`CASE WHEN ${publicWriteRateLimits.windowStartedAt} <= ${cutoff} THEN ${now} ELSE ${publicWriteRateLimits.windowStartedAt} END`,
      requestCount: sql<number>`CASE WHEN ${publicWriteRateLimits.windowStartedAt} <= ${cutoff} THEN 1 ELSE ${publicWriteRateLimits.requestCount} + 1 END`,
      updatedAt: new Date(now).toISOString(),
    },
  }).returning({
    count: publicWriteRateLimits.requestCount,
    windowStartedAt: publicWriteRateLimits.windowStartedAt,
  });
  return Boolean(rows[0])
    && rows[0].windowStartedAt > cutoff
    && rows[0].count <= limit;
}

/** Rate-limit keys must never store a raw email or IP. */
export async function rateLimitKeyHash(value: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value.trim().toLowerCase()),
  );
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
