/**
 * Apply the reviewed Spanish to server-rendered HTML, so a crawler can read it.
 *
 * Spanish is live for people and invisible to search, because it is swapped into
 * the DOM after paint: `translateInterface` walks text nodes in the browser, the
 * language lives in `localStorage`, and the server therefore emits English on
 * every request. A crawler is exactly a request with no `window`, so it has
 * never seen a word of the eight translated pages. The full finding, and why no
 * metadata change fixes it, is in
 * `docs/product/spanish-is-invisible-to-search.md`.
 *
 * This is the server half of the same substitution, and deliberately nothing
 * more. It shares one dictionary with the browser — `spanishText` is exported
 * from `app/components/site-language.tsx` rather than copied — because two
 * dictionaries drift, and a page half-translated by a stale copy is the failure
 * the per-path switch exists to prevent.
 *
 * What it does not do: decide which pages get Spanish. That stays
 * `SPANISH_READY_PATHS`, which is guarded by a build check, and a caller must
 * consult it before calling any of this.
 */

// From the plain module, never from `site-language.tsx`. That file is
// `"use client"` and imports React, so reaching it from here would pull a client
// component into the Cloudflare Worker bundle the moment a Worker route uses
// any of this. A test asserts this import stays pointed here.
import { spanishText } from "./spanish-dictionary";

/** Text that is punctuation, digits, or whitespace carries no language. */
const NOTHING_TO_TRANSLATE = /^[\s\d$€.,:%•·—–→✦✓✕✱★☆|/\\()[\]{}#@!?'"-]*$/;

/** Decode the escaped text emitted by React for dictionary lookup, once only. */
export function decodeRenderedText(value: string): string {
  const named: Record<string, string> = {
    amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: "\u00a0",
  };
  return value.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (entity, name: string) => {
    if (!name.startsWith("#")) return named[name.toLowerCase()] ?? entity;
    const hex = name[1].toLowerCase() === "x";
    const point = Number.parseInt(name.slice(hex ? 2 : 1), hex ? 16 : 10);
    // Only normalize the characters escaped in rendered copy. Other entities
    // retain their original bytes in the untranslated fallback.
    return [34, 38, 39, 60, 62, 160].includes(point) ? String.fromCodePoint(point) : entity;
  });
}

/**
 * Translate one run of text exactly as the browser would.
 *
 * Exact match only, on the trimmed string, with the surrounding whitespace put
 * back. The browser dictionary is exact-match too, so anything looser would
 * translate strings nobody reviewed — which is the one thing this must never do.
 * An unknown string comes back untouched, in English, which is the honest
 * failure and the same one the client makes.
 */
export function translateText(value: string): string {
  if (!value || NOTHING_TO_TRANSLATE.test(value)) return value;
  const leading = value.match(/^\s*/)?.[0] ?? "";
  const trailing = value.match(/\s*$/)?.[0] ?? "";
  const core = value.slice(leading.length, value.length - trailing.length);
  const translated = spanishText[core];
  return translated === undefined ? value : `${leading}${translated}${trailing}`;
}

/** Every string the dictionary knows, longest first. */
export function knownPhrases(): string[] {
  return Object.keys(spanishText).sort((a, b) => b.length - a.length);
}

/**
 * How much of a page's visible text this dictionary can actually carry.
 *
 * Reported rather than assumed, because a page that is 60% translated is worse
 * than an English one: the reader cannot tell which half was reviewed. A caller
 * that cannot reach full coverage should serve English and say so, exactly as
 * the client-side switch does today.
 */
export function coverage(texts: readonly string[]): {
  total: number;
  translated: number;
  untranslated: string[];
} {
  const meaningful = texts.filter((text) => text.trim() && !NOTHING_TO_TRANSLATE.test(text));
  const untranslated = meaningful.filter((text) => spanishText[text.trim()] === undefined);
  return {
    total: meaningful.length,
    translated: meaningful.length - untranslated.length,
    untranslated,
  };
}
