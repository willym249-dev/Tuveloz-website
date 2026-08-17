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

const DICTIONARY = readFileSync(new URL("../lib/spanish-dictionary.ts", import.meta.url), "utf8");
const GUARD = readFileSync(
  new URL("../scripts/check-spanish-coverage.mjs", import.meta.url),
  "utf8",
);

test("the dictionary is shared with the browser, never copied", () => {
  // Two dictionaries drift, and a page half-translated by a stale copy is the
  // failure the per-path switch exists to prevent.
  assert.match(SOURCE, /import \{ spanishText \} from "\.\/spanish-dictionary"/);
  assert.ok(
    !/^\s*(const|export const)\s+\w*[Ss]panish\w*\s*(:|=)\s*\{/m.test(SOURCE),
    "spanish-html.ts must not define a dictionary of its own",
  );
});

test("the server half never reaches the client component", () => {
  // site-language.tsx is "use client" and imports React. Reaching it from here
  // would pull a client component into the Cloudflare Worker bundle as soon as
  // a Worker route used any of this.
  assert.ok(
    !/site-language/.test(SOURCE.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")),
    "spanish-html.ts must not import site-language.tsx",
  );
  assert.ok(!/from "react"/.test(DICTIONARY), "the dictionary module must stay React-free");
});

test("the browser still reads the same strings", () => {
  // Re-exported rather than duplicated, so every existing importer is unchanged.
  assert.match(LANGUAGE, /export \{ spanishText, spanishPlaceholders \} from "\.\.\/\.\.\/lib\/spanish-dictionary"/);
  assert.ok(
    !/^export const spanish\w+: Record/m.test(LANGUAGE),
    "the component must not define a dictionary of its own again",
  );
});

test("the build guard reads the dictionary where it now lives", () => {
  // The guard parses entries with a line-anchored regex and fails the build on
  // an untranslated string. Moving the dictionary without moving the guard
  // leaves it matching nothing, which passes every page rather than checking it.
  assert.match(GUARD, /lib\/spanish-dictionary\.ts/);
  assert.match(GUARD, /known\.size === 0/, "a zero-entry parse must fail loudly");
  assert.match(DICTIONARY, /^ {2}"/m, "entries must stay two-space indented for that regex");
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
