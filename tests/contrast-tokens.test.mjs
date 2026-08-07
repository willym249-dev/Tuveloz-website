import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const channel = (c) => {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
const luminance = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * channel((n >> 16) & 255)
    + 0.7152 * channel((n >> 8) & 255)
    + 0.0722 * channel(n & 255);
};
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

/** Every light card surface the site actually paints small text on. */
const LIGHT_SURFACES = ["#ffffff", "#f7f9fb", "#f5f8fb", "#f2f4f6", "#edf3f8"];
/** The near-black page and form backgrounds. */
const DARK_SURFACES = ["#111111", "#080808", "#050505"];

const tokenValue = (css, name) => {
  const match = css.match(new RegExp(`--${name}: (#[0-9a-f]{6});`));
  assert.ok(match, `--${name} must be defined`);
  return match[1];
};

/**
 * The site puts small text on two very different surfaces — white cards sitting
 * on a near-black page — and a single muted grey cannot pass WCAG AA on both.
 * Clearing 4.5:1 against white caps luminance at 0.183; clearing it against the
 * near-black page floors it at 0.202. The ranges do not overlap, which is why
 * there are separate tokens and why picking one by eye kept going wrong.
 */
test("the muted tokens clear WCAG AA on every surface they are used on", async () => {
  const css = await read("app/globals.css");

  const onLight = tokenValue(css, "muted-on-light");
  for (const surface of LIGHT_SURFACES) {
    const ratio = contrast(onLight, surface);
    assert.ok(ratio >= 4.5, `--muted-on-light ${onLight} on ${surface} is ${ratio.toFixed(2)}:1`);
  }

  for (const name of ["muted-on-dark", "muted-on-dark-warm"]) {
    const value = tokenValue(css, name);
    for (const surface of DARK_SURFACES) {
      const ratio = contrast(value, surface);
      assert.ok(ratio >= 4.5, `--${name} ${value} on ${surface} is ${ratio.toFixed(2)}:1`);
    }
  }
});

test("no single token is used against both kinds of surface", async () => {
  const css = await read("app/globals.css");
  const onLight = tokenValue(css, "muted-on-light");
  const onDark = tokenValue(css, "muted-on-dark");

  // If these ever converge, one of the two surfaces is failing silently.
  assert.notEqual(onLight, onDark);
  assert.ok(
    contrast(onLight, "#111111") < 4.5,
    "the light-surface token would pass on dark too, so the split is no longer needed — recheck",
  );
});

test("service names inside the white cards are ink, not the theme's orange label colour", async () => {
  const css = await read("app/globals.css");

  // The dark theme sets `label { color: #ff9a55 }`, which is right on the
  // near-black form and lands at 1.98:1 inside the service picker's white
  // cards — where the labels are the service names themselves.
  assert.match(css, /label \{\s*color: #ff9a55;/);
  const override = css.slice(css.indexOf(".service-group label,"));
  assert.match(override.slice(0, 200), /\.service-option label/);
  assert.match(override.slice(0, 260), /color: #172b3c;/);
  assert.ok(contrast("#172b3c", "#f7f9fb") >= 4.5);
});

test("the collapsed business-details summary is readable", async () => {
  const css = await read("app/globals.css");

  // Its ink text only had a light background when open, so the control you
  // must find in order to open it sat on the near-black form at 1.3:1.
  const rule = css.slice(
    css.indexOf(".business-details-disclosure > summary {"),
    css.indexOf(".business-details-disclosure > summary::"),
  );
  assert.match(rule, /background: #f5f8fb;/);
  assert.ok(contrast("#172b3c", "#f5f8fb") >= 4.5);

  // The open state must no longer redeclare the background it now inherits.
  const openRule = css.slice(
    css.indexOf(".business-details-disclosure[open] > summary {"),
    css.indexOf("}", css.indexOf(".business-details-disclosure[open] > summary {")),
  );
  assert.doesNotMatch(openRule, /background:/);
});
