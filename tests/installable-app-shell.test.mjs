import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const readJson = async (path) => JSON.parse(await read(path));

/**
 * The site is meant to be installable to a phone home screen. Everything here
 * is a thing that looks fine in a desktop browser and is only wrong once the
 * app is installed — a mismatched status bar, an icon cropped by Android's
 * mask, a page that hides under the notch, or a form that zooms on iOS and
 * never zooms back.
 */

test("the manifest describes an installable app, not just a bookmark", async () => {
  const manifest = await readJson("public/manifest.webmanifest");

  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.scope, "/");
  assert.ok(manifest.id, "an explicit id keeps identity stable if start_url changes");
  assert.ok(manifest.start_url.startsWith("/"));

  // The installed status bar and splash are painted with these, so they have to
  // match the real site chrome. `.site-header` is rgba(5, 5, 5, 0.94).
  assert.equal(manifest.theme_color, "#050505");
  assert.equal(manifest.background_color, "#050505");

  const sizes = (purpose) => manifest.icons
    .filter((icon) => icon.purpose === purpose)
    .map((icon) => icon.sizes)
    .sort();
  assert.deepEqual(sizes("any"), ["192x192", "512x512"]);
  // Without a maskable icon Android shrinks the artwork inside a white circle.
  assert.deepEqual(sizes("maskable"), ["192x192", "512x512"]);

  assert.ok(manifest.shortcuts?.length >= 1, "long-press shortcuts are the app-like entry points");
  for (const shortcut of manifest.shortcuts) {
    assert.ok(shortcut.url.startsWith("/"), `${shortcut.name} must be an in-scope path`);
  }
});

test("the maskable icons come from the brand master and fit the safe zone", async () => {
  const generator = await read("scripts/generate-brand-assets.mjs");

  // They are generated from the same badge master as every other icon, not
  // hand-exported — that is the invariant tests/brand-mark-consistency.test.mjs
  // exists to protect.
  assert.match(generator, /"icon-maskable-192\.png"/);
  assert.match(generator, /"icon-maskable-512\.png"/);

  // Android crops to its own shape, so the field is opaque and full-bleed.
  assert.match(generator, /channels: 3, background: MASKABLE_BACKGROUND/);

  // The badge is square, so its corners decide the fit: the largest square
  // inside the 0.8 safe circle has side 0.8/sqrt(2). Sizing by width instead
  // would let a circular launcher mask slice the keyline's corners off.
  assert.match(generator, /const MASKABLE_SAFE_SCALE = 0\.8 \/ Math\.SQRT2;/);
});

test("the app shell opts into the notch and matches its own chrome", async () => {
  const layout = await read("app/layout.tsx");

  assert.match(layout, /themeColor: "#050505"/);
  // vinext's viewport builder has no viewportFit branch and drops the field, so
  // the directive rides inside `width`. If this regresses, every safe-area
  // inset silently reads 0px on iOS.
  assert.match(layout, /width: "device-width, viewport-fit=cover"/);
  assert.doesNotMatch(layout, /viewportFit:/);

  // iOS reads only the vendor-prefixed name; without it "Add to Home Screen"
  // opens a Safari tab instead of launching standalone.
  assert.match(layout, /"apple-mobile-web-app-capable": "yes"/);
  assert.match(layout, /statusBarStyle: "black-translucent"/);

  // metadata.manifest resolves against metadataBase and hard-codes the
  // production origin, which is not installable from staging or a preview.
  assert.match(layout, /<link rel="manifest" href="\/manifest\.webmanifest" \/>/);
  assert.doesNotMatch(layout, /manifest: "\/manifest\.webmanifest"/);

  // Pinch-zoom must stay available; locking it is an accessibility regression.
  assert.doesNotMatch(layout, /userScalable/);
  assert.doesNotMatch(layout, /maximumScale/);
});

test("edges and touch targets survive being an installed app", async () => {
  const css = await read("app/globals.css");

  // viewport-fit=cover paints under the notch and home indicator; anything
  // touching an edge has to pad itself back out.
  assert.match(css, /height: calc\(78px \+ env\(safe-area-inset-top, 0px\)\)/);
  assert.match(css, /height: calc\(68px \+ env\(safe-area-inset-top, 0px\)\)/);
  assert.match(css, /padding-left: env\(safe-area-inset-left, 0px\)/);

  // iOS zooms the page in and never back out when a focused control is under
  // 16px. Every field on the site was 12px.
  const coarse = css.slice(css.indexOf("@media (pointer: coarse)"));
  assert.ok(coarse.length > 0, "the touch-only block must exist");
  assert.match(coarse.slice(0, 400), /font-size: 16px/);
  // Desktop must keep the dense 12px type, so the rule stays inside the
  // coarse-pointer query rather than a width breakpoint.
  assert.doesNotMatch(css, /@media \(max-width: \d+px\) \{\s*input,\s*select,\s*textarea \{\s*font-size: 16px/);
});

test("the service worker never caches a page or an API response", async () => {
  const sw = await read("public/sw.js");

  // This is a marketplace with signed-in customer, provider, and owner
  // surfaces. A cached page is a cached page for the next person holding the
  // phone, and a cached API response is a stale price or job status.
  assert.match(sw, /if \(request\.method !== "GET"\) return;/);
  assert.match(sw, /if \(url\.pathname\.startsWith\("\/api\/"\)\) return;/);

  // Navigations are network-only with a static fallback — the real response is
  // never put in the cache.
  const navigate = sw.slice(sw.indexOf('request.mode === "navigate"'), sw.indexOf("if (!isCacheableAsset"));
  assert.match(navigate, /caches\.match\(OFFLINE_URL\)/);
  assert.doesNotMatch(navigate, /cache\.put\(/);

  assert.match(sw, /const CACHE_VERSION = "/);
  assert.match(sw, /"UNREGISTER"/, "there has to be a way to switch it off");

  // Registering in dev fights Vite's module graph and HMR.
  const registration = await read("app/components/service-worker-registration.tsx");
  assert.match(registration, /process\.env\.NODE_ENV !== "production"/);
});

test("the offline page stands alone", async () => {
  const offline = await read("public/offline.html");

  // It renders when the network is gone, so it cannot pull in globals.css, a
  // font, or any other request.
  assert.doesNotMatch(offline, /<link[^>]+stylesheet/);
  assert.doesNotMatch(offline, /https?:\/\//);
  assert.match(offline, /viewport-fit=cover/);
  assert.match(offline, /addEventListener\("online"/);
});
