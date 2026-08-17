import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * The crawlable Spanish twins.
 *
 * Spanish is applied in the browser after paint, so the server emits English and
 * search engines have only ever indexed English. `/es/<path>` is the half a
 * crawler can read. These pin the fail-closed rule, the pairing, and that the
 * Worker never reaches the client component to do it.
 */

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const ROUTES = read("lib/spanish-routes.ts");
const PAGE = read("worker/spanish-page.ts");
const WORKER = read("worker/index.ts");
const SITEMAP = read("app/sitemap.ts");
const LANGUAGE = read("app/components/site-language.tsx");
const GUARD = read("scripts/check-spanish-coverage.mjs");

const readyPaths = [...ROUTES.slice(
  ROUTES.indexOf("export const SPANISH_READY_PATHS"),
  ROUTES.indexOf("export const SPANISH_PREFIX"),
).matchAll(/"([^"]+)"/g)].map((match) => match[1]);

test("the path list is the browser's list, not a second copy", () => {
  // Two lists drift, and a page could be Spanish in the browser and absent from
  // search, or listed for search without reviewed Spanish behind it.
  assert.ok(readyPaths.length >= 8, `expected the ready paths, saw ${readyPaths.length}`);
  assert.match(
    LANGUAGE,
    /export \{ SPANISH_READY_PATHS, pathHasSpanish \} from "\.\.\/\.\.\/lib\/spanish-routes"/,
  );
  assert.ok(
    !/^export const SPANISH_READY_PATHS/m.test(LANGUAGE),
    "the component must not define its own list again",
  );
});

test("only reviewed paths get a Spanish URL", () => {
  // An /es/ URL for a page without reviewed Spanish promises a translation that
  // does not exist — worse than having no Spanish URL at all.
  assert.match(PAGE, /englishPathFor/);
  assert.match(ROUTES, /return pathHasSpanish\(english\) \? english : null;/);
});

test("an unreviewed /es path is a 404, never an untranslated page", () => {
  assert.match(PAGE, /new Response\("Not found", \{ status: 404 \}\)/);
});

test("the legal pages have no Spanish twin", () => {
  for (const legal of ["/terms", "/privacy", "/provider-agreement", "/customer-agreement"]) {
    assert.ok(!readyPaths.includes(legal), `${legal} must not have a Spanish URL`);
  }
});

test("text is buffered before it is matched", () => {
  // HTMLRewriter splits a text node into chunks wherever it likes, so matching a
  // chunk would miss any phrase straddling a boundary and translate half a page.
  assert.match(PAGE, /lastInTextNode/);
  assert.match(PAGE, /this\.buffer \+= chunk\.text/);
});

test("script and style contents are never translated", () => {
  // Matching the browser's ignored(): their contents are not language.
  assert.match(PAGE, /script, style, noscript/);
  assert.match(PAGE, /enterOpaque|leaveOpaque/);
});

test("both languages point at each other and at themselves", () => {
  // A one-way hreflang declaration is ignored, and x-default belongs on the
  // English side because that is where an unmatched locale should land.
  for (const rel of ['hreflang="es"', 'hreflang="en"', 'hreflang="x-default"', 'rel="canonical"']) {
    assert.ok(PAGE.includes(rel), `missing ${rel}`);
  }
});

test("the document declares itself Spanish", () => {
  assert.match(PAGE, /setAttribute\("lang", "es"\)/);
});

test("the English canonical is removed, not merely outnumbered", () => {
  // Next emits a canonical from page metadata and it survives into the twin,
  // because the twin is that page. Appending a second left two, the English one
  // won, and every Spanish URL declared itself a duplicate asking not to be
  // indexed. Seen in production before this was fixed.
  assert.match(PAGE, /link\[rel="canonical"\]/);
  assert.match(PAGE, /class DropInheritedCanonical[\s\S]*?element\.remove\(\)/);
  // Removal must be registered before the head append, or the appended one is
  // removed along with the inherited one.
  assert.ok(
    PAGE.indexOf('.on(\'link[rel="canonical"]\'') < PAGE.indexOf('.on("head"'),
    "the canonical must be dropped before the Spanish one is appended",
  );
});

test("the Worker never reaches the client component", () => {
  // site-language.tsx is "use client" and imports React; pulling it into the
  // Worker bundle is the thing this whole split exists to avoid.
  const code = PAGE.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  assert.ok(!/site-language/.test(code), "worker/spanish-page.ts must not import the component");
  assert.match(PAGE, /from "\.\.\/lib\/spanish-html"/);
  assert.match(PAGE, /from "\.\.\/lib\/spanish-routes"/);
});

test("the Worker only offers it for HTML page views", () => {
  // An API call or an asset must not be routed through a translator.
  assert.match(WORKER, /request\.method === "GET" && acceptsHtml/);
  assert.match(WORKER, /spanishPageResponse\(url, request,/);
});

test("the Spanish URLs are in the sitemap, derived not typed", () => {
  // A URL a crawler is never told about is one it may never fetch — and these
  // exist for exactly one audience.
  assert.match(SITEMAP, /spanishPagePaths\(\)/);
  assert.ok(!/"\/es\//.test(SITEMAP), "Spanish paths must not be hand-listed");
});

test("the coverage guard reads the path list where it now lives", () => {
  assert.match(GUARD, /lib\/spanish-routes\.ts/);
  assert.match(GUARD, /readyPaths\.length === 0/, "an empty parse must fail loudly");
});
