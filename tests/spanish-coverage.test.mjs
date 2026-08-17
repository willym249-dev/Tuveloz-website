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

  // The list moved to lib/spanish-routes.ts, which the Worker also imports to
  // serve the crawlable /es twins — one list, so a page cannot be Spanish in the
  // browser and absent from search. The component re-exports it, so the switch
  // below is unchanged.
  assert.match(
    language,
    /export \{ SPANISH_READY_PATHS, pathHasSpanish \} from "\.\.\/\.\.\/lib\/spanish-routes"/,
  );

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
  const routes = await read("lib/spanish-routes.ts");
  const list = routes.slice(
    routes.indexOf("export const SPANISH_READY_PATHS"),
    routes.indexOf("export const SPANISH_PREFIX"),
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
  // The dictionaries moved to lib/spanish-dictionary.ts so server-side code can
  // read them without pulling a "use client" component into the Worker bundle.
  // This test reads them there; site-language.tsx re-exports them for callers.
  const dictionary = await read("lib/spanish-dictionary.ts");
  const body = dictionary.slice(
    dictionary.indexOf("const spanishText"),
    dictionary.indexOf("const spanishPlaceholders"),
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
  const language = await read("lib/spanish-dictionary.ts");

  // Spot-check one load-bearing string per ready page. If a rewrite drops these,
  // the page is no longer fully translated and should not claim to be.
  for (const english of [
    "Any car issue.", // homepage hero
    "Car trouble shouldn't leave you guessing.", // customer lander hero
    "Be first in line for car jobs in Montgomery County.", // provider lander hero
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
