/**
 * Walks the running site the way the runtime translator does and reports any
 * visible string on a Spanish-ready page that has no dictionary entry.
 *
 * The unit tests can only check the dictionary file. This checks the actual
 * rendered pages, which is the only way to catch "someone added a paragraph and
 * the Spanish page now has an English sentence in the middle of it".
 *
 * Usage:  node scripts/check-spanish-coverage.mjs [baseUrl]
 *         npm run i18n:check
 *
 * Requires a running site (npm run dev) and Playwright. Exits 1 if any ready
 * page has untranslated copy.
 */
import { readFileSync } from "node:fs";
import { chromium } from "playwright";

const baseUrl = (process.argv[2] || process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, "");
// Two files now. The paths stay beside the switch that reads them, and the
// dictionaries moved to a plain module so server-side code can import them
// without pulling a "use client" component into the Worker bundle. Both are
// read here, because this check is the only thing standing between a
// half-translated page and production.
const dictionary = readFileSync(new URL("../lib/spanish-dictionary.ts", import.meta.url), "utf8");

const routes = readFileSync(new URL("../lib/spanish-routes.ts", import.meta.url), "utf8");

const readyPaths = [...routes.slice(
  routes.indexOf("export const SPANISH_READY_PATHS"),
  routes.indexOf("export const SPANISH_PREFIX"),
).matchAll(/"([^"]+)"/g)].map((match) => match[1]);

if (readyPaths.length === 0) {
  console.error("No Spanish-ready paths found in lib/spanish-routes.ts.");
  process.exit(1);
}

const known = new Set(
  [...dictionary.matchAll(/^ {2}"((?:[^"\\]|\\.)*)":\s*"/gm)]
    .map((match) => match[1].replace(/\\"/g, '"').replace(/\\\\/g, "\\")),
);

// A silent zero here would pass every page rather than check it, which is
// exactly how this guard stops working without anyone noticing.
if (known.size === 0) {
  console.error("No dictionary entries found in lib/spanish-dictionary.ts.");
  console.error("If the dictionaries moved again, this script has to move with them.");
  process.exit(1);
}

// Brand tokens and sample data that are the same in both languages.
const SKIP = new Set(["Tuveloz", "FAQ", "Tuveloz AI", "JOB #4471", "hello@tuveloz.com",
  "you@example.com", "Maryland", "Washington, DC"]);
const PUNCTUATION_ONLY = /^[\d\s$€.,:%•·—–→✦✓✕✱★☆|]+$/;

const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM || undefined,
});
let untranslated = 0;

for (const path of readyPaths) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  await page.goto(baseUrl + path, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);

  const strings = await page.evaluate(() => {
    const found = [];
    const skip = "script, style, [data-language-control], [data-no-interface-translation], [data-manual-language]";
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      if (node.nodeValue?.trim() && !node.parentElement?.closest(skip)) found.push(node.nodeValue.trim());
      node = walker.nextNode();
    }
    for (const element of document.querySelectorAll("[placeholder], [aria-label], [title]")) {
      // The runtime translator skips attributes inside the same containers it
      // skips for text, so the language button's own Spanish label is not a gap.
      if (element.closest(skip)) continue;
      for (const attribute of ["placeholder", "aria-label", "title"]) {
        const value = element.getAttribute(attribute);
        if (value?.trim()) found.push(value.trim());
      }
    }
    return [...new Set(found)];
  });

  const missing = strings.filter((text) => (
    !known.has(text) && !SKIP.has(text) && !PUNCTUATION_ONLY.test(text) && text.length > 1
  ));

  if (missing.length) {
    untranslated += missing.length;
    console.error(`\n✗ ${path} — ${missing.length} string(s) with no Spanish:`);
    for (const text of missing.slice(0, 12)) console.error(`    ${JSON.stringify(text.slice(0, 100))}`);
    if (missing.length > 12) console.error(`    …and ${missing.length - 12} more`);
  } else {
    console.log(`✓ ${path} — fully translated (${strings.length} strings)`);
  }
  await page.close();
}

await browser.close();

if (untranslated) {
  console.error(`\n${untranslated} untranslated string(s) on Spanish-ready pages.`);
  console.error("Either add the Spanish, or remove the page from SPANISH_READY_PATHS.");
  process.exit(1);
}
console.log(`\nEvery Spanish-ready page is fully translated (${readyPaths.length} pages).`);
