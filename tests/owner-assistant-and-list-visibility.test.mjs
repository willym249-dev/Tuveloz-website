import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

// The hedge guard used to fire into console.warn, where nobody would ever see
// it, and the pre-launch email list had no owner view at all. Both are on the
// owner's analytics page now.
test("the assistant records the shape of an answer and never its content", async () => {
  const telemetry = await read("lib/ai/assistant-telemetry.ts");

  // Shape only: audience, which vetted topics matched, and whether the guard held.
  assert.match(telemetry, /audience: PolicyAudience/);
  assert.match(telemetry, /topics: entries\.map\(\(entry\) => entry\.id\)/);
  assert.match(telemetry, /guard: entries\.some\(\(entry\) => entry\.hedged\)/);

  // Nothing that could carry a person's words or identity may be persisted.
  for (const forbidden of [/\bmessage\b/, /\breply\b/, /\banswer\b/, /\bemail\b/, /session/i, /\bip\b/]) {
    assert.doesNotMatch(
      telemetry.slice(telemetry.indexOf("export async function recordAssistantAnswer")),
      forbidden,
      `telemetry must not persist ${forbidden}`,
    );
  }
});

test("telemetry can never break or delay an answer", async () => {
  const [telemetry, route] = await Promise.all([
    read("lib/ai/assistant-telemetry.ts"),
    read("app/api/ai/route.ts"),
  ]);

  // Swallows its own failure...
  assert.match(telemetry, /catch \(error\) \{[\s\S]*console\.error\("Unable to record Tuveloz AI telemetry"/);
  // ...and the response path does not await it.
  assert.match(route, /void recordAssistantAnswer\(audience, policyEntries, hedgesHeld\)/);
});

test("the owner can see assistant health and the launch list", async () => {
  const [route, page, adminHome] = await Promise.all([
    read("app/api/admin/analytics-funnel/route.ts"),
    read("app/admin/analytics-funnel/page.tsx"),
    read("app/admin/page.tsx"),
  ]);

  // Owner-gated like the rest of the funnel data.
  assert.match(route, /verifyOwnerRequest/);
  assert.match(route, /assistant: \{ allTime: assistantAll, last7: assistant7 \}/);
  assert.match(route, /launchList,/);

  // A guard replacement is surfaced as something to look at, not buried.
  assert.match(page, /allTime\.guardReplaced > 0/);
  assert.match(page, /stated a provisional design/);
  assert.match(page, /Customers were not shown a wrong answer/);

  // The list panel reports size and shape, never an address.
  assert.match(page, /Addresses are not shown/);
  assert.doesNotMatch(page, /subscriber\.email|list\.emails/);

  // Reachable from the control center, and the label says what is there now.
  assert.match(adminHome, /href="\/admin\/analytics-funnel">Funnel, launch list &amp; AI</);
});

test("the assistant event name is shared, not retyped in two places", async () => {
  const [telemetry, route] = await Promise.all([
    read("lib/ai/assistant-telemetry.ts"),
    read("app/api/admin/analytics-funnel/route.ts"),
  ]);

  assert.match(telemetry, /export const ASSISTANT_EVENT = "ai_answer_served"/);
  assert.match(route, /import \{ ASSISTANT_EVENT/);
  // The reader must not hardcode the string the writer owns.
  assert.doesNotMatch(route.replace(/import[\s\S]*?;\n/, ""), /"ai_answer_served"/);
});
