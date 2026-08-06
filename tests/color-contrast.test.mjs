import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

const channel = (value) => {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
};

const luminance = (hex) => {
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? [...clean].map((c) => c + c).join("") : clean;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
};

const contrast = (a, b) => {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};

// Reads the value of `property` out of a specific rule, so a colour can be
// checked against the surface it actually sits on.
const declared = (selector, property) => {
  // A selector can head several rules (one may only set layout), so scan every
  // occurrence and take the one that actually declares the property.
  let found = null;
  let at = css.indexOf(`${selector} {`);
  assert.notEqual(at, -1, `expected to find the ${selector} rule`);
  while (at !== -1) {
    const body = css.slice(at, css.indexOf("}", at));
    const match = body.match(new RegExp(`(?:^|[;{]\\s*)${property}:\\s*([^;]+);`));
    if (match) { found = match[1].trim(); break; }
    at = css.indexOf(`${selector} {`, at + 1);
  }
  assert.ok(found, `expected ${selector} to declare ${property}`);
  return found;
};

// The brand theme is dark, but a few surfaces stay deliberately light — the
// hero quote tickets read as paper receipts, and the provider service picker
// is a light form panel. Text on those must use light-surface ink; text on the
// dark surfaces must not. Getting this backwards is invisible to a reader of
// the CSS but renders as same-on-same colour, so pin the actual ratios.
// selector, property, the surface it renders against, label, and the minimum
// ratio — 4.5 for body text, 3 where the text is large enough to qualify.
const CASES = [
  [".quote-ticket strong", "color", "#ffffff", "quote ticket service name"],
  [".qt-head", "color", "#ffffff", "quote ticket job number"],
  [".quote-ticket small", "color", "#ffffff", "quote ticket footnote"],
  [".qt-stamp", "color", "#ffffff", "quote ticket stamp"],
  [".service-options strong", "color", "#f7f9fb", "service option name"],
  [".service-options small", "color", "#f7f9fb", "service option detail"],
  [".service-scope small", "color", "#f7f9fb", "service scope detail"],
  [".service-group > summary small", "color", "#ffffff", "service group detail"],
  [".customer-service-note", "color", "#111111", "customer service note"],
  [".expansion-form > small", "color", "#111111", "expansion form footnote"],
  [".account-welcome small", "color", "#07182d", "account welcome footnote"],
  // Light cards whose text would otherwise inherit the page's orange.
  [".repeat-booking-banner > strong", "color", "#eef5ff", "repeat booking heading"],
  [".repeat-vehicle-fieldset > strong", "color", "#f7f9fb", "repeat vehicle summary"],
  [".price-guidance-heading strong", "color", "#f7fbf4", "price guidance heading"],
  [".price-guidance-list article > strong", "color", "#f7fbf4", "price guidance item"],
  [".vin-result-heading small", "color", "#ffffff", "VIN result note"],
  [".vin-result-summary small", "color", "#f3f6f8", "VIN summary label"],
  [".header-sign-in:hover", "color", "#fff6ef", "header sign-in hover"],
  [".success-message > span", "color", "#e8f7f0", "success badge glyph", 3],
];

test("body text keeps a readable contrast against the surface it sits on", () => {
  for (const [selector, property, surface, label, minimum = 4.5] of CASES) {
    const value = declared(selector, property);
    assert.match(value, /^#[0-9a-f]{3,6}$/i, `${label} should use a literal colour, not an inherited token`);
    const ratio = contrast(value, surface);
    assert.ok(
      ratio >= minimum,
      `${label} (${selector}) is ${ratio.toFixed(2)}:1 against ${surface}; WCAG AA needs ${minimum}:1`,
    );
  }
});

test("assistant surfaces never take their text colour from a background token", () => {
  const block = css.slice(css.indexOf(".ai-safety-note {"), css.indexOf(".ai-composer .button.ai"));

  // --ink and --white are near-black in the brand theme, so using them as a
  // text colour on a dark surface renders black-on-black.
  assert.doesNotMatch(block, /color:\s*var\(--ink\)/);
  assert.doesNotMatch(block, /color:\s*var\(--white\)/);
});
