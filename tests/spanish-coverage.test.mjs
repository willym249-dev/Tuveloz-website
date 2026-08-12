import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

/**
 * Spanish was switched off entirely because the dictionary had fallen behind
 * English-only rewrites, and a half-translated page — especially a legal one —
 * is worse than an English page. It is back on for the marketing paths only.
 *
 * These tests hold that line: the toggle must stay gated per path, and the
 * legal pages must stay out of the ready list. Whether every visible string on
 * a ready page is actually translated is checked against the running site by
 * scripts/check-spanish-coverage.mjs, which walks the real DOM the way the
 * runtime translator does.
 */
test("Spanish is offered per path, not site-wide", async () => {
  const language = await read("app/components/site-language.tsx");

  assert.match(language, /export const SPANISH_READY_PATHS/);
  assert.match(language, /export function pathHasSpanish/);

  // The stored preference cannot override a page without reviewed Spanish.
  assert.match(
    language,
    /if \(!pathHasSpanish\(window\.location\.pathname\)\) return "en";/,
  );
  // And the toggle itself is hidden there, so it never promises a translation
  // the page does not have.
  assert.match(language, /if \(!available\) return null;/);
});

test("no legal or account page is marked Spanish-ready", async () => {
  const language = await read("app/components/site-language.tsx");
  const list = language.slice(
    language.indexOf("export const SPANISH_READY_PATHS"),
    language.indexOf("export function pathHasSpanish"),
  );

  for (const legalPath of [
    "/terms",
    "/privacy",
    "/payments",
    "/customer-agreement",
    "/provider-agreement",
    "/marketplace-conduct",
    "/provisional-provider-policy",
    "/job-operations",
    "/account",
    "/admin",
  ]) {
    assert.ok(
      !list.includes(`"${legalPath}"`),
      `${legalPath} must not be marked Spanish-ready without reviewed translations`,
    );
  }
});

test("the dictionary has no duplicate keys silently overriding each other", async () => {
  const language = await read("app/components/site-language.tsx");
  const body = language.slice(
    language.indexOf("const spanishText"),
    language.indexOf("const spanishPlaceholders"),
  );

  const keys = [...body.matchAll(/^ {2}("(?:[^"\\]|\\.)*"):/gm)].map((match) => match[1]);
  const seen = new Set();
  const duplicates = [];
  for (const key of keys) {
    if (seen.has(key)) duplicates.push(key);
    seen.add(key);
  }

  // A repeated key means JavaScript keeps the last and the earlier translation
  // is dead text that nobody will ever see rendered.
  assert.deepEqual(duplicates, [], `duplicate dictionary keys: ${duplicates.join(", ")}`);
  assert.ok(keys.length > 900, `expected the marketing surface to be covered, saw ${keys.length}`);
});

test("the marketing copy people decide on is translated", async () => {
  const language = await read("app/components/site-language.tsx");

  // Spot-check one load-bearing string per ready page. If a rewrite drops these,
  // the page is no longer fully translated and should not claim to be.
  for (const english of [
    "Any car issue.", // homepage hero
    "Car trouble shouldn't leave you guessing.", // customer lander hero
    "Do great work. Get paid.", // provider lander hero
    "Ask once. Compare real prices. Pick who you like.", // how-it-works
    "Who is asking", // assistant
    "Frequently asked questions", // faq
    "Customer privacy", // safety
    "Save my spot — free", // the primary call to action
    "Apply free", // the provider call to action
  ]) {
    assert.ok(
      language.includes(`${JSON.stringify(english)}: "`),
      `"${english}" is on a Spanish-ready page but has no translation`,
    );
  }
});
