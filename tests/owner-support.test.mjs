import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";
import { emailEventAllowedByReleaseState, PROTECTIVE_EMAIL_EVENT_SQL_PATTERNS } from "../lib/email-event-policy.ts";

let moduleId = 0;
async function loadRoute({ saved = true, rateAllowed = true } = {}) {
  const stub = `export const queued = []; export const limits = [];
    export async function queueOwnerSupportMessage(input) { ${saved ? "queued.push(input);" : 'throw new Error("private database detail");'} }
    export async function consumeFixedWindow(...input) { limits.push(input); return ${rateAllowed}; }
    export async function rateLimitKeyHash(value) { return "hash:" + value; }
    // ${moduleId++}`;
  const stubUrl = `data:text/javascript,${encodeURIComponent(stub)}`;
  let source = await readFile(new URL("../app/api/support/route.ts", import.meta.url), "utf8");
  for (const [from, to] of Object.entries({
    "../../../lib/email-notifications": stubUrl,
    "../../../lib/public-write-rate-limit": stubUrl,
    "../../../lib/request-security": new URL("../lib/request-security.ts", import.meta.url).href,
    "../../../lib/limited-json": new URL("../lib/limited-json.ts", import.meta.url).href,
  })) source = source.replaceAll(`"${from}"`, JSON.stringify(to));
  return { ...await import(`data:text/javascript,${encodeURIComponent(stripTypeScriptTypes(source))}`), ...await import(stubUrl) };
}
const valid = { email: "visitor@example.invalid", message: "I need help applying.", audience: "provider", language: "en", consent: true, requestId: "01234567-89ab-4cde-8fab-0123456789ab" };
function request(body = valid, origin = "https://tuveloz.invalid") {
  return new Request("https://tuveloz.invalid/api/support", {
    method: "POST", headers: { "content-type": "application/json", ...(origin ? { origin } : {}) }, body: JSON.stringify(body),
  });
}

test("owner support acknowledges only a saved message, with an honest queued status", async () => {
  const route = await loadRoute();
  const response = await route.POST(request({ ...valid, recipientEmail: "attacker@example.invalid", history: [{ content: "private chat" }] }));
  assert.equal(response.status, 202);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), { ok: true, status: "queued", reference: valid.requestId });
  assert.equal(route.queued.length, 1);
  assert.equal(route.queued[0].message, valid.message);
  assert.equal(route.queued[0].recipientEmail, undefined);
  assert.equal(route.queued[0].history, undefined);
  assert.equal(route.limits.length, 3);
});

test("cross-origin and missing-origin writes cannot send owner support", async () => {
  const route = await loadRoute();
  for (const origin of ["https://other.invalid", ""]) assert.equal((await route.POST(request(valid, origin))).status, 403);
  assert.equal(route.queued.length, 0);
});

test("missing consent, malformed contacts, and oversized messages do not enter the outbox", async () => {
  const route = await loadRoute();
  for (const body of [null, [], { ...valid, consent: false }, { ...valid, email: "bad" }, { ...valid, message: " " }, { ...valid, message: "a".repeat(3001) }, { ...valid, requestId: "not-a-uuid" }]) {
    assert.equal((await route.POST(request(body))).status, 400);
  }
  assert.equal((await route.POST(request({ ...valid, message: "a".repeat(17000) }))).status, 413);
  assert.equal(route.queued.length, 0);
});

test("database or configuration failure never claims that the owner got a message", async () => {
  const route = await loadRoute({ saved: false });
  const response = await route.POST(request({ ...valid, language: "es" }));
  assert.equal(response.status, 503);
  const data = await response.json();
  assert.match(data.error, /No pudimos guardar/);
  assert.equal(data.ok, undefined);
  assert.doesNotMatch(JSON.stringify(data), /private database detail/);
});

test("rate limited requests cannot queue mail", async () => {
  const route = await loadRoute({ rateAllowed: false });
  assert.equal((await route.POST(request())).status, 429);
  assert.equal(route.queued.length, 0);
});

test("requested support is deliverable during onboarding without opening transaction mail", () => {
  assert.equal(emailEventAllowedByReleaseState("owner:support:reference:fingerprint", false), true);
  assert.ok(PROTECTIVE_EMAIL_EVENT_SQL_PATTERNS.includes("owner:support:%"));
  for (const event of ["owner:new-request:123", "marketplace:payment:123", "owner:unknown:123"]) {
    assert.equal(emailEventAllowedByReleaseState(event, false), false);
  }
});
