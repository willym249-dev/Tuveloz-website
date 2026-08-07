// Guards for defects a person hit on the live site: text they could not read,
// card art that covered its own content, and markup shipped only to be hidden.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

// The provider business card is a 3.5in x 2in physical artifact, not a screen.
// Its footer and QR caption are set smaller on purpose and are excluded from
// the screen floor below.
const PRINT_CARD_RULE = /\.provider-business-card/;

test("no stylesheet rule renders on-screen text below 11px", async () => {
  const css = await source("app/globals.css");
  const tooSmall = [...css.matchAll(/([^{}]*)\{([^}]*font-size:\s*(\d+(?:\.\d+)?)px[^}]*)\}/g)]
    .filter((match) => !PRINT_CARD_RULE.test(match[1]))
    .flatMap((match) =>
      [...match[2].matchAll(/font-size:\s*(\d+(?:\.\d+)?)px/g)].map((size) => Number(size[1])),
    )
    .filter((size) => size < 11);

  assert.deepEqual(
    tooSmall,
    [],
    `found ${tooSmall.length} rule(s) under 11px: ${[...new Set(tooSmall)].join(", ")}px. ` +
      "Sub-11px text was unreadable on a phone, including the county-registration links " +
      "a provider has to read before applying.",
  );
});

test("the assistant input sets its own colors instead of --white and --ink", async () => {
  const css = await source("app/globals.css");
  const rule = css.match(/\.ai-input \{[^}]*\}/);
  assert.ok(rule, ".ai-input rule is missing");

  // The brand theme redefines --white to #050505, so a field using
  // `background: var(--white); color: var(--ink)` renders black on black and
  // the person typing cannot see their own words.
  assert.doesNotMatch(rule[0], /background:\s*var\(--white\)/);
  assert.doesNotMatch(rule[0], /color:\s*var\(--ink\)/);
  assert.match(rule[0], /color:\s*#f7f3ef/i);
  assert.match(css, /\.ai-input::placeholder \{[^}]*color:/);
});

test("the quote preview cards cannot cover each other's text", async () => {
  const css = await source("app/globals.css");
  const board = css.match(/\.quote-board \{[^}]*\}/);
  const ticket = css.match(/\.quote-ticket \{[^}]*\}/);
  assert.ok(board && ticket);

  // The cards used to be absolutely positioned at fixed offsets, so each one
  // sat on top of the previous card's shop name and the stamp sat on the
  // third one's. Laying them out in flow makes that impossible at any size.
  assert.doesNotMatch(ticket[0], /position:\s*absolute/);
  assert.doesNotMatch(board[0], /height:\s*\d+px/);
  assert.match(board[0], /display:\s*grid/);

  const stamp = css.match(/\.qt-stamp \{[^}]*\}/);
  if (stamp) assert.doesNotMatch(stamp[0], /position:\s*absolute/);
});

test("the quote preview shows three different shops and three different prices", async () => {
  const board = await source("app/components/quote-board.tsx");
  const shops = [...board.matchAll(/shop:\s*"([^"]+)"/g)].map((match) => match[1]);
  const prices = [...board.matchAll(/price:\s*"([^"]+)"/g)].map((match) => match[1]);

  assert.equal(shops.length, 3);
  assert.equal(new Set(shops).size, 3, `duplicate shop in the preview: ${shops.join(", ")}`);
  assert.equal(new Set(prices).size, 3, `duplicate price in the preview: ${prices.join(", ")}`);
});

test("both hero previews render the one shared quote board", async () => {
  const [homepage, postJob] = await Promise.all([
    source("app/page.tsx"),
    source("app/post-job/page.tsx"),
  ]);

  // Two hand-maintained copies had already drifted into showing the same shop
  // twice at the same price.
  for (const file of [homepage, postJob]) {
    assert.match(file, /<QuoteBoard\b/);
    assert.doesNotMatch(file, /className="quote-ticket/);
  }
});

test("views leave sections out of the markup rather than hiding them with CSS", async () => {
  const [page, css] = await Promise.all([source("app/page.tsx"), source("app/globals.css")]);

  assert.match(page, /const HIDDEN_SECTIONS/);
  assert.match(page, /shows\("request"\)/);
  assert.match(page, /shows\("reviews"\)/);

  // A visitor used to download a whole customer request form and review board
  // they could never see, and assistive tech had to walk past both.
  const hidingRules = [...css.matchAll(/\.public-view-[a-z]+\s*>\s*\.[a-z-]+[^{]*\{([^}]*)\}/g)]
    .filter((match) => /display:\s*none/.test(match[1]));
  assert.deepEqual(hidingRules.map((match) => match[0].split("{")[0].trim()), []);
});

test("the application step indicator separates its steps", async () => {
  const css = await source("app/globals.css");
  const form = await source("app/components/provider-signup-form.tsx");

  assert.match(form, /className="step-indicator"/);
  // With no rule at all the three spans ran together on one line and read as
  // "1. Your services2. Requirements3. Your business".
  const rule = css.match(/\.step-indicator \{[^}]*\}/);
  assert.ok(rule, ".step-indicator has no CSS, so its steps render as one run-on line");
  assert.match(rule[0], /display:\s*flex/);
  assert.match(rule[0], /gap:/);
  assert.match(css, /\.step-indicator > span\.on \{/);
});

test("the assistant still answers policy questions with no model key configured", async () => {
  const route = await source("app/api/ai/route.ts");
  const unconfigured = route.slice(route.indexOf("if (!councilConfigured())"));

  // The live site showed a flat "not available right now" for every question,
  // including ones whose answers are written down and need no model at all.
  assert.match(unconfigured.slice(0, 900), /policyEntries\.length > 0/);
  assert.match(unconfigured.slice(0, 900), /vettedAnswer\(policyEntries\)/);
  assert.doesNotMatch(route, /Tuveloz AI is not available right now/);
});
