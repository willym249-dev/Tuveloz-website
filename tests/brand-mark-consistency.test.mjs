import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

async function tsxFiles(dir = "app") {
  const entries = await readdir(new URL(`../${dir}`, import.meta.url), {
    withFileTypes: true,
  });
  const found = [];
  for (const entry of entries) {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) found.push(...await tsxFiles(path));
    else if (entry.name.endsWith(".tsx")) found.push(path);
  }
  return found;
}

// The header/footer logo drifted once before: a hand-drawn SVG lookalike shipped
// alongside the real master badge, so different pages showed different marks.
// These tests keep one component as the only way to draw the logo, and keep it
// pointed at the master badge image.
test("every page draws the logo through the single BrandMark component", async () => {
  const files = await tsxFiles();
  const offenders = [];

  for (const path of files) {
    const source = await read(path);
    if (path === "app/components/tuveloz-icons.tsx") continue;

    // A page that renders the brand lockup must get its mark from BrandMark.
    if (/className="brand[ "]/.test(source) && !source.includes("BrandMark")) {
      offenders.push(`${path}: renders .brand without BrandMark`);
    }

    // Nothing outside tuveloz-icons.tsx may hand-roll a logo image or mark.
    if (/<img[^>]+src="\/(brand-badge|icon-\d+|apple-touch-icon|favicon)/.test(source)) {
      offenders.push(`${path}: hand-rolled logo <img> instead of BrandMark`);
    }
    if (/className="(brand-mark|mini-mark)"/.test(source)) {
      offenders.push(`${path}: hand-rolled brand-mark markup instead of BrandMark`);
    }
  }

  assert.deepEqual(offenders, []);
});

test("BrandMark renders the master badge image, not a redrawn lookalike", async () => {
  const icons = await read("app/components/tuveloz-icons.tsx");
  const brandMark = icons.slice(
    icons.indexOf("export function BrandMark"),
    icons.indexOf("export function TuvelozIcon"),
  );

  assert.ok(brandMark.includes('src="/brand-badge.png'));
  // Both sizes come from the same image; only the box around it differs.
  assert.match(brandMark, /compact \? "mini-mark" : "brand-mark"/);
  // No inline logo geometry: that is what produced the mismatched mark before.
  assert.doesNotMatch(brandMark, /<svg|<path|brand-funnel|brand-fuel-drop/);
});

test("the stylesheet keeps no leftovers of the deleted hand-drawn mark", async () => {
  const styles = await read("app/globals.css");

  // Styling for the old inline SVG. If these come back, so can the old mark.
  assert.doesNotMatch(styles, /brand-funnel|brand-fuel-drop/);
  assert.doesNotMatch(styles, /\.(brand|mini)-mark svg/);

  // The master badge already contains the navy fill and orange keyline, so the
  // container must not paint a second badge around it. This held for .mini-mark
  // while .brand-mark — the 40px mark in the header of every page — kept doing
  // exactly that, so both containers are checked now.
  const containers = styles.match(/\.(?:mini|brand)-mark \{[^}]*\}/g) ?? [];
  assert.ok(containers.length > 1, "expected both mark containers to be styled");
  for (const block of containers) {
    assert.doesNotMatch(block, /background: #07182d/);
    assert.doesNotMatch(block, /inset 0 0 0 2px/);
  }
});

// public/brand-badge.png — the logo on every page — was hand-exported and left
// out of the generator, so regenerating from the master updated every favicon
// and quietly skipped the header. Nothing caught it. This does.
test("every logo file the app serves is produced by the brand generator", async () => {
  const [generator, layout, icons, manifest, chrome] = await Promise.all([
    read("scripts/generate-brand-assets.mjs"),
    read("app/layout.tsx"),
    read("app/components/tuveloz-icons.tsx"),
    read("public/manifest.webmanifest"),
    read("app/components/public-chrome.tsx"),
  ]);

  const referenced = new Set(
    [layout, icons, manifest, chrome]
      .flatMap((source) => [...source.matchAll(/["'(]\/([a-z0-9-]+\.(?:png|ico|svg))/g)])
      .map((match) => match[1]),
  );
  assert.ok(referenced.has("brand-badge.png"), "expected the header mark to be referenced");

  const missing = [...referenced].filter((asset) => !generator.includes(`"${asset}"`));
  assert.deepEqual(
    missing,
    [],
    `these logo files are served but never generated from the master: ${missing.join(", ")}`,
  );
});

test("every installed icon points at the versioned master artwork", async () => {
  const [layout, manifest] = await Promise.all([
    read("app/layout.tsx"),
    read("public/manifest.webmanifest"),
  ]);

  for (const asset of [
    "/favicon.ico",
    "/tuveloz-favicon-v2.svg",
    "/apple-touch-icon.png",
    "/og-image.png",
    "/icon-512.png",
  ]) {
    assert.ok(layout.includes(asset), `${asset} missing from layout icons`);
  }

  // Cache-busting stays in lockstep so a logo change cannot ship half-applied.
  const versions = new Set(
    [...layout.matchAll(/\/(?:favicon|tuveloz-favicon-v2|apple-touch-icon|og-image|icon-\d+)[^"?]*\?v=(\d+)/g)]
      .map((match) => match[1]),
  );
  assert.equal(versions.size, 1, `icon cache versions disagree: ${[...versions]}`);

  for (const icon of JSON.parse(manifest).icons) {
    assert.match(icon.src, /^\/icon-\d+\.png\?v=\d+$/);
  }
});
