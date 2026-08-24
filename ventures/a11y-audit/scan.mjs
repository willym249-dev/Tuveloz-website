#!/usr/bin/env node
/**
 * Crawls a site, runs axe-core against each page under the WCAG 2.1 AA rule set,
 * and writes an aggregated finding set to JSON.
 *
 *   node scan.mjs https://example.gov --pages 20 --out ./reports
 *
 * Automated rules catch a minority of WCAG failures. Nothing this emits is a
 * compliance determination; see the caveat carried through into every report.
 */

import { chromium } from 'playwright';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, priority } from './rules.mjs';

const require = createRequire(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));

const WCAG_AA_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const SKIP_EXT = /\.(pdf|jpe?g|png|gif|webp|svg|ico|zip|docx?|xlsx?|pptx?|mp[34]|mov|avi|css|js|json|xml|rss)$/i;
const SKIP_PROTO = /^(mailto:|tel:|javascript:|sms:|#)/i;

function parseArgs(argv) {
  const args = { pages: 15, out: './reports', timeout: 30000, bestPractice: false, concurrency: 3 };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--pages') args.pages = Number(argv[++i]);
    else if (a === '--out') args.out = argv[++i];
    else if (a === '--timeout') args.timeout = Number(argv[++i]);
    else if (a === '--concurrency') args.concurrency = Number(argv[++i]);
    else if (a === '--best-practice') args.bestPractice = true;
    else if (a.startsWith('--')) throw new Error(`Unknown flag: ${a}`);
    else rest.push(a);
  }
  args.target = rest[0];
  return args;
}

/** Drops the fragment and trailing slash so /about and /about#top are one page. */
function normalize(raw, base) {
  let u;
  try { u = new URL(raw, base); } catch { return null; }
  if (!/^https?:$/.test(u.protocol)) return null;
  u.hash = '';
  if (u.pathname !== '/' && u.pathname.endsWith('/')) u.pathname = u.pathname.slice(0, -1);
  return u.toString();
}

function sameSite(url, origin) {
  try {
    const a = new URL(url), b = new URL(origin);
    return a.hostname.replace(/^www\./, '') === b.hostname.replace(/^www\./, '');
  } catch { return false; }
}

async function scanPage(context, url, axeSource, opts) {
  const page = await context.newPage();
  try {
    const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: opts.timeout });
    if (!resp) return { url, error: 'no response' };
    const status = resp.status();
    if (status >= 400) return { url, error: `HTTP ${status}` };
    const ctype = (resp.headers()['content-type'] || '').toLowerCase();
    if (ctype && !ctype.includes('html')) return { url, error: `not HTML (${ctype.split(';')[0]})` };

    // Let client-rendered content settle; many public-sector sites hydrate late.
    await page.waitForTimeout(1200);
    await page.addScriptTag({ content: axeSource });

    const tags = opts.bestPractice ? [...WCAG_AA_TAGS, 'best-practice'] : WCAG_AA_TAGS;
    const result = await page.evaluate(async (runTags) => {
      const r = await window.axe.run(document, {
        runOnly: { type: 'tag', values: runTags },
        resultTypes: ['violations'],
      });
      return {
        violations: r.violations.map((v) => ({
          id: v.id, impact: v.impact, help: v.help, helpUrl: v.helpUrl,
          nodes: v.nodes.slice(0, 5).map((n) => ({
            target: Array.isArray(n.target) ? n.target.join(' ') : String(n.target),
            html: (n.html || '').slice(0, 400),
            failureSummary: (n.failureSummary || '').slice(0, 400),
          })),
          nodeCount: v.nodes.length,
        })),
      };
    }, tags);

    const title = await page.title().catch(() => '');
    const links = await page.$$eval('a[href]', (as) => as.map((a) => a.getAttribute('href')).filter(Boolean))
      .catch(() => []);

    return { url, title, violations: result.violations, links };
  } catch (err) {
    return { url, error: err.message.split('\n')[0].slice(0, 200) };
  } finally {
    await page.close().catch(() => {});
  }
}

/**
 * Resolves a Chromium binary.
 *
 * Prefers whatever Playwright installed for itself. Falls back to a browser
 * already present in the image (CI containers ship one and pin it to a build
 * number that rarely matches the npm package), so the scan does not stop to
 * download 150MB it already has. Override with A11Y_CHROME_PATH.
 */
function resolveChrome() {
  const fs = require('node:fs');
  if (process.env.A11Y_CHROME_PATH) return process.env.A11Y_CHROME_PATH;
  try {
    const p = chromium.executablePath();
    if (p && fs.existsSync(p)) return undefined; // Playwright's own copy is fine.
  } catch { /* not installed; fall through */ }
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  try {
    const candidates = fs.readdirSync(root)
      .filter((d) => d.startsWith('chromium-'))
      .map((d) => join(root, d, 'chrome-linux', 'chrome'))
      .filter((f) => fs.existsSync(f))
      .sort();
    if (candidates.length) return candidates[candidates.length - 1];
  } catch { /* no such directory */ }
  return undefined;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.target) {
    console.error('usage: node scan.mjs <url> [--pages N] [--out DIR] [--best-practice]');
    process.exit(2);
  }
  const start = normalize(opts.target, undefined);
  if (!start) { console.error(`Not a usable URL: ${opts.target}`); process.exit(2); }

  const axeSource = require('node:fs').readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');

  const executablePath = resolveChrome();
  if (executablePath) process.stderr.write(`Using browser: ${executablePath}\n`);
  const browser = await chromium.launch({ executablePath, args: ['--no-sandbox'] });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (compatible; a11y-audit/0.1; accessibility conformance scan)',
    viewport: { width: 1280, height: 900 },
  });

  const queue = [start];
  const seen = new Set([start]);
  const pages = [];

  process.stderr.write(`Scanning ${start} (up to ${opts.pages} pages)\n`);

  while (queue.length && pages.length < opts.pages) {
    const batch = queue.splice(0, Math.min(opts.concurrency, opts.pages - pages.length));
    const results = await Promise.all(batch.map((u) => scanPage(context, u, axeSource, opts)));

    for (const r of results) {
      pages.push(r);
      const label = r.error ? `skip (${r.error})` : `${r.violations.length} rule(s) failing`;
      process.stderr.write(`  [${pages.length}/${opts.pages}] ${r.url} — ${label}\n`);
      for (const href of r.links || []) {
        if (SKIP_PROTO.test(href)) continue;
        const abs = normalize(href, r.url);
        if (!abs || seen.has(abs) || !sameSite(abs, start) || SKIP_EXT.test(new URL(abs).pathname)) continue;
        seen.add(abs);
        queue.push(abs);
      }
    }
  }

  await browser.close();

  // --- Aggregate per rule across pages ------------------------------------
  const byRule = new Map();
  for (const p of pages) {
    if (p.error) continue;
    for (const v of p.violations) {
      let f = byRule.get(v.id);
      if (!f) {
        const meta = describe(v.id);
        f = { ruleId: v.id, impact: v.impact, help: v.help, helpUrl: v.helpUrl,
              ...meta, instances: 0, pagesAffected: 0, samples: [] };
        byRule.set(v.id, f);
      }
      f.instances += v.nodeCount;
      f.pagesAffected += 1;
      for (const n of v.nodes) {
        if (f.samples.length < 6) f.samples.push({ page: p.url, ...n });
      }
    }
  }

  const findings = [...byRule.values()]
    .map((f) => ({ ...f, priority: priority(f) }))
    .sort((a, b) => b.priority - a.priority);

  const scanned = pages.filter((p) => !p.error);
  const report = {
    target: start,
    scannedAt: new Date().toISOString(),
    standard: 'WCAG 2.1 Level AA',
    engine: `axe-core ${require('axe-core/package.json').version}`,
    coverageCaveat:
      'Automated rules detect only part of WCAG 2.1 AA. Keyboard operation, focus order, ' +
      'meaningful alt text quality, error recovery, and screen-reader comprehension require ' +
      'manual testing. Absence of findings here is not a finding of conformance.',
    pagesScanned: scanned.length,
    pagesSkipped: pages.length - scanned.length,
    pages: pages.map((p) => ({
      url: p.url, title: p.title ?? null, error: p.error ?? null,
      rulesFailing: p.error ? null : p.violations.length,
      instances: p.error ? null : p.violations.reduce((n, v) => n + v.nodeCount, 0),
    })),
    summary: {
      rulesFailing: findings.length,
      totalInstances: findings.reduce((n, f) => n + f.instances, 0),
      blockers: findings.filter((f) => f.severity === 'blocker').length,
      highSalience: findings.filter((f) => f.litigationSalience === 'high').length,
      cleanPages: scanned.filter((p) => p.violations.length === 0).length,
    },
    findings,
  };

  const outDir = resolve(process.cwd(), opts.out);
  await mkdir(outDir, { recursive: true });
  const slug = new URL(start).hostname.replace(/[^a-z0-9]+/gi, '-');
  const jsonPath = join(outDir, `${slug}.json`);
  await writeFile(jsonPath, JSON.stringify(report, null, 2));

  process.stderr.write(
    `\n${report.summary.rulesFailing} rules failing, ${report.summary.totalInstances} instances ` +
    `across ${report.pagesScanned} pages (${report.summary.blockers} blockers).\n` +
    `JSON: ${jsonPath}\n`);

  console.log(jsonPath);
}

main().catch((e) => { console.error(e); process.exit(1); });
