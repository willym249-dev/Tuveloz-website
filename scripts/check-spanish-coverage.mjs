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
const source = readFileSync(new URL("../app/components/site-language.tsx", import.meta.url), "utf8");

const readyPaths = [...source.slice(
  source.indexOf("export const SPANISH_READY_PATHS"),
  source.indexOf("export function pathHasSpanish"),
).matchAll(/"([^"]+)"/g)].map((match) => match[1]);

const known = new Set(
  [...source.matchAll(/^ {2}"((?:[^"\\]|\\.)*)":\s*"/gm)]
    .map((match) => match[1].replace(/\\"/g, '"').replace(/\\\\/g, "\\")),
);

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
