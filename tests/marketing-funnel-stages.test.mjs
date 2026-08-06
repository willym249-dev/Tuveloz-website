import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { firstTimeThisSession } from "../lib/once.ts";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

function fakeBrowser({ blocked = false } = {}) {
  const session = new Map();
  globalThis.window = {
    sessionStorage: {
      getItem: (key) => (session.has(key) ? session.get(key) : null),
      setItem: (key, value) => {
        if (blocked) throw new Error("storage blocked");
        session.set(key, value);
      },
    },
  };
}

test.afterEach(() => {
  delete globalThis.window;
});

test("awareness counts a session, not every page load", () => {
  fakeBrowser();
  // Awareness is the denominator for every rate below it. Counting refreshes
  // would sink those rates for reasons that have nothing to do with marketing.
  assert.equal(firstTimeThisSession("site_visited"), true);
  assert.equal(firstTimeThisSession("site_visited"), false);
  assert.equal(firstTimeThisSession("site_visited"), false);
});

test("distinct stages are deduplicated independently", () => {
  fakeBrowser();
  assert.equal(firstTimeThisSession("site_visited"), true);
  assert.equal(firstTimeThisSession("provider_form_engaged"), true);
  assert.equal(firstTimeThisSession("provider_form_engaged"), false);
});

test("a browser blocking session storage still reports the stage", () => {
  fakeBrowser({ blocked: true });
  // A slight over-count is visible and correctable; a silently missing stage
  // reads as "nobody came".
  assert.equal(firstTimeThisSession("site_visited"), true);
  assert.equal(firstTimeThisSession("site_visited"), true);
});

test("stages are never recorded on the server", () => {
  assert.equal(firstTimeThisSession("site_visited"), false);
});

test("trackOnce gates on the session and still attributes the event", async () => {
  const analytics = await source("lib/analytics.ts");
  assert.match(analytics, /if \(!firstTimeThisSession\(event\)\) return;/);
  // Awareness must carry attribution too, or the top of the funnel becomes the
  // one stage that cannot be broken down by where people came from.
  assert.match(analytics, /props: \{ \.\.\.props, from: attribution\(\) \}/);
});

test("the four stages are four different acts, each with its own event", async () => {
  const api = await source("app/api/admin/analytics-funnel/route.ts");
  assert.match(api, /const PROVIDER_STAGES: StepDef\[\]/);
  assert.match(api, /key: "awareness", event: "site_visited"/);
  assert.match(api, /key: "interest", event: "provider_signup_started"/);
  assert.match(api, /key: "consideration", event: "provider_form_engaged"/);
  assert.match(api, /key: "decision", event: "provider_signup_completed"/);
  // The form-level funnel answers a different question and stays intact, so
  // the copy experiments keep the denominator they have always used.
  assert.match(api, /const PROVIDER_FUNNEL: StepDef\[\]/);
  assert.match(api, /const EXPERIMENTS = \["provider_hero", "provider_pitch", "founding_cta"\]/);
});

test("awareness and consideration are actually fired by the app", async () => {
  const [capture, form] = await Promise.all([
    source("app/components/attribution-capture.tsx"),
    source("app/components/provider-signup-form.tsx"),
  ]);
  // Awareness rides the one component mounted on every page.
  assert.match(capture, /trackOnce\("site_visited"\)/);
  // Consideration is the first edit to the form, not the render of the page
  // the form sits on.
  assert.match(form, /trackOnce\("provider_form_engaged"/);
  assert.match(form, /import \{ track, trackOnce \}/);

  const ingest = await source("app/api/analytics/route.ts");
  assert.match(ingest, /"site_visited"/);
  assert.match(ingest, /"provider_form_engaged"/);
});

test("each channel is measured on the same four stages", async () => {
  const [api, page] = await Promise.all([
    source("app/api/admin/analytics-funnel/route.ts"),
    source("app/admin/analytics-funnel/page.tsx"),
  ]);
  assert.match(api, /const STAGE_OF_EVENT/);
  assert.match(api, /site_visited: "awareness"/);
  assert.match(api, /provider_signup_completed: "decision"/);
  // A channel with decisions but no sessions predates awareness tracking.
  // Showing 0% would read as a dead channel rather than as missing data.
  assert.match(api, /value\.awareness > 0 \? pct\(value\.decision, value\.awareness\) : null/);

  assert.match(page, /Awareness → Interest → Consideration → Decision/);
  assert.match(page, /row\.conversion === null \? "—"/);
});
