import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * The server half of the Spanish substitution.
 *
 * Spanish is swapped into the DOM after paint, so the server emits English on
 * every request and a crawler has never seen a word of the eight translated
 * pages. These pin the properties that make a server-side pass safe to build on:
 * one shared dictionary, exact matching only, and an honest report of what it
 * cannot translate.
 */

const SOURCE = readFileSync(new URL("../lib/spanish-html.ts", import.meta.url), "utf8");
const LANGUAGE = readFileSync(
  new URL("../app/components/site-language.tsx", import.meta.url),
  "utf8",
);

test("the dictionary is shared with the browser, never copied", () => {
  // Two dictionaries drift, and a page half-translated by a stale copy is the
  // failure the per-path switch exists to prevent.
  assert.match(SOURCE, /import \{ spanishText \} from "\.\.\/app\/components\/site-language"/);
  assert.ok(
    !/^\s*(const|export const)\s+\w*[Ss]panish\w*\s*(:|=)\s*\{/m.test(SOURCE),
    "spanish-html.ts must not define a dictionary of its own",
  );
});

test("the dictionary is exported in place, so the build guard still sees it", () => {
  // scripts/check-spanish-coverage.mjs parses these entries out of the source
  // with a line-anchored regex. Moving them to another module would disarm the
  // check that fails the build on an untranslated string.
  assert.match(LANGUAGE, /export const spanishText: Record<string, string> = \{/);
  assert.match(LANGUAGE, /export const spanishPlaceholders: Record<string, string> = \{/);
  assert.match(LANGUAGE, /^ {2}"/m, "entries must stay two-space indented for the guard's regex");
});

test("matching is exact, because looser matching would translate unreviewed text", () => {
  // Substring or fuzzy matching is the one thing this must never do: it would
  // put Spanish nobody approved in front of a reader.
  assert.ok(
    !/includes\(|indexOf\(|replaceAll\(|RegExp\(/.test(
      SOURCE.slice(SOURCE.indexOf("export function translateText")),
    ),
    "translateText must not match loosely",
  );
});

test("an unknown string comes back in English rather than guessed at", () => {
  assert.match(SOURCE, /translated === undefined \? value : /);
});

test("whitespace around a phrase survives translation", () => {
  assert.match(SOURCE, /\$\{leading\}\$\{translated\}\$\{trailing\}/);
});

test("punctuation and numbers are left alone", () => {
  assert.match(SOURCE, /NOTHING_TO_TRANSLATE/);
  assert.match(SOURCE, /if \(!value \|\| NOTHING_TO_TRANSLATE\.test\(value\)\) return value;/);
});

test("coverage is reported, not assumed", () => {
  // A page that is 60% translated is worse than an English one, because the
  // reader cannot tell which half was reviewed.
  assert.match(SOURCE, /export function coverage\(/);
  assert.match(SOURCE, /untranslated: string\[\]/);
});

test("it does not decide which pages get Spanish", () => {
  // That stays SPANISH_READY_PATHS, which the build check guards. The rule is
  // about code, not prose: the docstring names the constant to explain the
  // boundary, and forbidding the mention would only push that explanation out
  // of the file that needs it. So strip comments, then check.
  const code = SOURCE.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  assert.ok(
    !/\bpathHasSpanish\s*\(/.test(code),
    "spanish-html.ts must not decide which paths are translated",
  );
  assert.ok(
    !/import[^;]*SPANISH_READY_PATHS/.test(code),
    "spanish-html.ts must not import the path list",
  );
});
