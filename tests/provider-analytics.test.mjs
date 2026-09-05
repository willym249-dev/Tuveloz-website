import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import { runInNewContext } from "node:vm";
import test from "node:test";
import { ATTRIBUTION_KEYS, CLIENT_ANALYTICS_EVENTS, cleanAnalyticsProps } from "../lib/analytics-policy.ts";

let moduleId = 0;
async function load(relativePath, { saved = true, rateAllowed = true } = {}) {
  const stubUrl = `data:text/javascript,${encodeURIComponent(`
    export const rows = [];
    export const analyticsEvents = {};
    export const getDb = () => ({ insert: () => ({ values: row => {
      const save = () => { ${saved ? 'if (!rows.some(r => r.id === row.id)) rows.push(row);' : 'throw new Error("private database detail");'} };
      return { then: (resolve, reject) => Promise.resolve().then(save).then(resolve, reject), onConflictDoNothing: async () => save() };
    } }) });
    export const consumeFixedWindow = async () => ${rateAllowed};
    export const rateLimitKeyHash = async () => "hashed-ip";
    // ${moduleId++}
  `)}`;
  let source = await readFile(new URL(relativePath, import.meta.url), "utf8");
  source = source.replace(/from "([^"]+)"/g, (_, specifier) => {
    const basename = specifier.split("/").at(-1);
    const target = ["analytics-policy", "limited-json", "request-security"].includes(basename)
      ? new URL(`../lib/${basename}.ts`, import.meta.url).href : stubUrl;
    return `from ${JSON.stringify(target)}`;
  });
  return { ...await import(`data:text/javascript,${encodeURIComponent(stripTypeScriptTypes(source))}`), ...await import(stubUrl) };
}

function request(body, origin = "https://tuveloz.invalid") {
  return new Request("https://tuveloz.invalid/api/analytics", {
    method: "POST", headers: { "content-type": "application/json", ...(origin ? { origin } : {}) }, body: JSON.stringify(body),
  });
}

test("analytics cannot accept a forged server completion or a legacy browser completion", async () => {
  const route = await load("../app/api/analytics/route.ts");
  for (const event of ["provider_application_submitted", "provider_signup_completed", "provider_step2_abandoned"]) {
    assert.equal(CLIENT_ANALYTICS_EVENTS.has(event), false);
    assert.equal((await route.POST(request({ event }))).status, 400);
  }
  assert.equal(route.rows.length, 0);
});

test("analytics limits origin, body size and rate before saving", async () => {
  const route = await load("../app/api/analytics/route.ts");
  const body = { event: "provider_signup_started" };
  for (const origin of ["", "https://other.invalid"]) assert.equal((await route.POST(request(body, origin))).status, 403);
  assert.equal((await route.POST(request({ ...body, props: "x".repeat(5000) }))).status, 413);
  for (const invalid of [null, [], "event"]) assert.equal((await route.POST(request(invalid))).status, 400);
  assert.equal(route.rows.length, 0);
  const limited = await load("../app/api/analytics/route.ts", { rateAllowed: false });
  assert.equal((await limited.POST(request(body))).status, 429);
  assert.equal(limited.rows.length, 0);
});

test("only bounded campaign labels and known variants reach analytics storage", async () => {
  const route = await load("../app/api/analytics/route.ts");
  const response = await route.POST(request({ event: "provider_signup_started", props: {
    utm_source: "email", utm_campaign: "provider_first_5", utm_content: "person@example.invalid",
    utm_term: "https://example.invalid/?token=secret", utm_medium: "x".repeat(121),
    email: "person@example.invalid", name: "Private Person", verified: true,
    variants: { provider_hero: "A", provider_pitch: "invalid", secret: "value" },
  } }));
  assert.equal(response.status, 202);
  assert.deepEqual(JSON.parse(route.rows[0].props), {
    utm_source: "email", utm_campaign: "provider_first_5", variants: { provider_hero: "A" },
  });
});

test("server completion is idempotent and a telemetry failure cannot fail the saved application", async () => {
  const tracker = await load("../lib/provider-application-analytics.ts");
  await tracker.recordProviderApplicationSubmitted("synthetic-provider", { utm_source: "email" });
  await tracker.recordProviderApplicationSubmitted("synthetic-provider", { utm_source: "repeat" });
  assert.equal(tracker.rows.length, 1);
  assert.equal(tracker.rows[0].event, "provider_application_submitted");
  assert.equal(JSON.parse(tracker.rows[0].props).utm_source, "email");
  const unavailable = await load("../lib/provider-application-analytics.ts", { saved: false });
  await assert.doesNotReject(unavailable.recordProviderApplicationSubmitted("synthetic-provider", {}));
});

test("campaign labels survive landing-page navigation and blocked beacons never interrupt signup", async () => {
  const source = stripTypeScriptTypes(await readFile(new URL("../lib/analytics.ts", import.meta.url), "utf8"))
    .replace(/^import .*;$/m, "").replaceAll("export ", "");
  const storage = new Map();
  const requests = [];
  const window = { location: { search: "?utm_source=email&utm_campaign=first_5&email=private" }, sessionStorage: {
    getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value),
  } };
  const api = runInNewContext(`${source}; ({ track, campaignAttribution });`, {
    ATTRIBUTION_KEYS, cleanAnalyticsProps, window, URLSearchParams, Blob,
    navigator: { sendBeacon: () => { throw new Error("blocked"); } },
    fetch: (_url, options) => { requests.push(JSON.parse(options.body)); return Promise.reject(new Error("offline")); },
  });
  api.campaignAttribution();
  window.location.search = "";
  assert.doesNotThrow(() => api.track("provider_step1_completed"));
  assert.deepEqual(requests[0].props, { utm_source: "email", utm_campaign: "first_5" });
  window.sessionStorage.getItem = () => { throw new Error("blocked storage"); };
  assert.doesNotThrow(() => api.track("provider_step1_completed"));
  await new Promise(resolve => setImmediate(resolve));
});
