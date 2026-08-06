import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { attribution, normalizeTag, resolveAttribution } from "../lib/attribution.ts";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

const at = (search, referrer = "", pathname = "/join") =>
  resolveAttribution({ search, pathname, host: "tuveloz.com" }, referrer);

// Stand in for a browser so the first-touch rule can be exercised for real
// rather than asserted against source text.
function fakeBrowser({ search = "", pathname = "/", referrer = "", stored = null, blocked = false } = {}) {
  const store = new Map();
  if (stored) store.set("tuveloz-attribution", JSON.stringify(stored));
  globalThis.window = {
    location: { search, pathname, host: "tuveloz.com" },
    localStorage: {
      getItem: (key) => (store.has(key) ? store.get(key) : null),
      setItem: (key, value) => {
        if (blocked) throw new Error("storage blocked");
        store.set(key, value);
      },
    },
  };
  globalThis.document = { referrer };
  return store;
}

test.afterEach(() => {
  delete globalThis.window;
  delete globalThis.document;
});

test("tags we put on our own links are read exactly as written", () => {
  const utm = at("?utm_source=Instagram&utm_medium=Social&utm_campaign=Reel_V3");
  assert.deepEqual(utm, {
    source: "instagram",
    medium: "social",
    campaign: "reel_v3",
    landing: "/join",
  });
  // A source with no medium is still a usable row, not a discarded one.
  assert.equal(at("?utm_source=newsletter").medium, "unknown");
});

test("short codes carry the channels that cannot hold a utm string", () => {
  // Nobody retypes a utm string off a printed flyer.
  assert.partialDeepStrictEqual(at("?r=flyer"), {
    source: "flyer",
    medium: "print",
    campaign: "flyer",
  });
  assert.partialDeepStrictEqual(at("?r=dm"), { source: "dm", medium: "outreach" });
  assert.partialDeepStrictEqual(at("?r=gbp"), { source: "google", medium: "profile" });
});

test("a per-town code stays in its channel but counts on its own", () => {
  // This is what makes "which town converts cheapest" answerable: both rows
  // are the flyer channel, but the campaign tag separates the two runs.
  const wheaton = at("?r=flyer-wheaton");
  const rockville = at("?r=flyer-rockville");
  assert.equal(wheaton.source, "flyer");
  assert.equal(rockville.source, "flyer");
  assert.equal(wheaton.campaign, "flyer-wheaton");
  assert.equal(rockville.campaign, "flyer-rockville");
});

test("an unrecognized code is kept rather than thrown away", () => {
  // Somebody deliberately printed it; losing it would lose the only label the
  // visit carried.
  assert.partialDeepStrictEqual(at("?r=Radio-Spot!"), {
    source: "tagged",
    campaign: "radio-spot",
  });
});

test("untagged traffic is still classified by referrer", () => {
  assert.partialDeepStrictEqual(at("", "https://www.instagram.com/"), {
    source: "instagram",
    medium: "social",
  });
  // Link-shim subdomains are the same channel, not a separate one.
  assert.equal(at("", "https://l.instagram.com/?u=x").source, "instagram");
  assert.equal(at("", "https://lm.facebook.com/").source, "facebook");
  assert.equal(at("", "https://out.reddit.com/").source, "reddit");
  assert.equal(at("", "https://t.co/abc").source, "x");
  assert.partialDeepStrictEqual(at("", "https://www.google.com/search?q=x"), {
    source: "google",
    medium: "organic",
  });
});

test("a surprise referrer shows up as itself instead of vanishing", () => {
  // An unexpected channel is a finding worth seeing, not noise to bucket away.
  assert.partialDeepStrictEqual(at("", "https://www.montgomerycountymd.gov/x"), {
    source: "montgomerycountymd-gov",
    medium: "referral",
  });
});

test("our own pages are navigation, not a source", () => {
  assert.equal(at("", "https://tuveloz.com/").source, "direct");
  assert.equal(at("", "").source, "direct");
  assert.equal(at("", "not-a-url").source, "direct");
});

test("a deliberate tag outranks whatever the browser reported", () => {
  const both = at("?utm_source=flyer", "https://www.instagram.com/");
  assert.equal(both.source, "flyer");
  const code = at("?r=ig", "https://www.google.com/");
  assert.equal(code.source, "instagram");
});

test("the QR redirect already in the app lands in the same report", () => {
  // app/q/<slug> redirects to /providers/<slug>?source=qr.
  assert.partialDeepStrictEqual(
    resolveAttribution({ search: "?source=qr", pathname: "/providers/luis", host: "tuveloz.com" }, ""),
    { source: "qr", medium: "print", campaign: "qr", landing: "/providers/luis" },
  );
});

test("values from the URL bar are normalized before they are stored", () => {
  assert.equal(normalizeTag("  Flyer Wheaton  "), "flyer-wheaton");
  assert.equal(normalizeTag("<script>alert(1)</script>"), "script-alert-1-script");
  assert.equal(normalizeTag("a".repeat(200)).length, 40);
  // A cap that lands mid-separator must not leave a dangling dash.
  assert.equal(normalizeTag(`${"a".repeat(39)}!!!tail`), "a".repeat(39));
  assert.equal(normalizeTag("!!!"), "");
});

test("the channel that found someone keeps the credit when they return", () => {
  fakeBrowser({ search: "?r=flyer-wheaton", pathname: "/join" });
  assert.equal(attribution().campaign, "flyer-wheaton");

  // Two days later they type the address in directly. Crediting this visit to
  // "direct" would defund the flyer run that actually earned the application.
  fakeBrowser({ stored: { source: "flyer", medium: "print", campaign: "flyer-wheaton", landing: "/join" } });
  assert.equal(attribution().source, "flyer");
  assert.equal(attribution().campaign, "flyer-wheaton");
});

test("the first visit is written down once and then left alone", () => {
  const store = fakeBrowser({ search: "?utm_source=instagram", pathname: "/" });
  attribution();
  const first = store.get("tuveloz-attribution");
  attribution();
  assert.equal(store.get("tuveloz-attribution"), first);
});

test("a browser blocking storage still measures, and never throws at a visitor", () => {
  fakeBrowser({ search: "?r=flyer", blocked: true });
  assert.equal(attribution().source, "flyer");
});

test("attribution is never resolved on the server", () => {
  // No window: the module must not reach for browser globals during SSR.
  assert.deepEqual(attribution(), { source: "direct", medium: "none", campaign: "", landing: "" });
});

test("capture runs on the landing page, where the referrer still exists", async () => {
  const [layout, capture] = await Promise.all([
    source("app/layout.tsx"),
    source("app/components/attribution-capture.tsx"),
  ]);
  // Mounted in the root layout, not in the signup form: by the time a visitor
  // reaches /join from the homepage the real referrer is already our own domain.
  assert.match(layout, /import \{ AttributionCapture \}/);
  assert.match(layout, /<AttributionCapture \/>/);
  assert.match(capture, /"use client"/);
  assert.match(capture, /attribution\(\)/);
});

test("every funnel event carries its channel without the call site doing anything", async () => {
  const analytics = await source("lib/analytics.ts");
  assert.match(analytics, /import \{ attribution \} from "\.\/attribution"/);
  // Merged after the caller's props so a stray `from` cannot overwrite the
  // real attribution.
  assert.match(analytics, /props: \{ \.\.\.props, from: attribution\(\) \}/);
});

test("the public event endpoint cannot be used to poison the owner's numbers", async () => {
  const route = await source("app/api/analytics/route.ts");
  // These rows decide where money goes, so they have to come from our pages.
  assert.match(route, /isSameOriginRequest\(request\)/);
  assert.match(route, /status: 403/);
  assert.match(route, /consumeFixedWindow\(/);
  assert.match(route, /status: 429/);
  assert.match(route, /readLimitedJsonObject\(request, MAX_BODY_BYTES\)/);
  // The browser already normalizes; the server must not take its word for it.
  assert.match(route, /function cleanAttribution/);
  assert.match(route, /normalizeTag/);
  assert.match(route, /MAX_PROP_KEYS/);
});

test("the owner funnel reports applications by channel and by campaign", async () => {
  const [api, page] = await Promise.all([
    source("app/api/admin/analytics-funnel/route.ts"),
    source("app/admin/analytics-funnel/page.tsx"),
  ]);
  assert.match(api, /async function channelsSince/);
  assert.match(api, /conversion: pct\(value\.submitted, value\.started\)/);
  assert.match(api, /channels: attribution\.channels/);
  assert.match(api, /campaigns: attribution\.campaigns/);
  // Events from before this shipped must not be counted as "direct".
  assert.match(api, /const UNLABELED = "unlabeled"/);

  assert.match(page, /Where applications come from/);
  assert.match(page, /<Channels channels=/);
  assert.match(page, /Campaign tag/);
});
