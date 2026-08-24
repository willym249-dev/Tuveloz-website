#!/usr/bin/env node
/**
 * Bulk home-page triage across a list of domains, to build a ranked call list.
 *
 *   node prospect.mjs domains.txt --out prospects
 *
 * Scans one page per domain and records two things that matter commercially:
 *
 *   1. How badly it fails automated WCAG 2.1 AA checks.
 *   2. Whether it is running an accessibility overlay widget.
 *
 * The second is the stronger buying signal. An overlay means the organisation
 * has already decided accessibility is a problem worth paying for, already has a
 * budget line, and — after the FTC's January 2025 action against accessiBe over
 * claims that its widget made sites WCAG-conformant — has reason to doubt the
 * thing it bought. A site with an overlay AND a high violation count is a
 * customer whose current vendor is visibly not working.
 */

import { chromium } from 'playwright';
import { createRequire } from 'node:module';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { describe } from './rules.mjs';

const require = createRequire(import.meta.url);

/** Script-host fingerprints for the widgets that dominate the overlay market. */
const OVERLAYS = [
  { name: 'accessiBe',  match: /acsbapp\.com|accessibe\.com/i,        global: 'acsbJS' },
  { name: 'UserWay',    match: /userway\.org/i,                        global: 'UserWay' },
  { name: 'AudioEye',   match: /audioeye\.com|ae-cdn/i,                global: '__AudioEyeSettingsOverride' },
  { name: 'EqualWeb',   match: /equalweb\.com|nagich\.co/i,            global: 'eqAPI' },
  { name: 'Accessibly', match: /accessibly(app)?\.com/i,               global: null },
  { name: 'MaxAccess',  match: /maxaccess\.io/i,                       global: null },
  { name: 'allyable',   match: /allyable\.com/i,                       global: null },
  { name: 'Recite Me',  match: /reciteme\.com/i,                       global: null },
];

function resolveChrome() {
  const fs = require('node:fs');
  if (process.env.A11Y_CHROME_PATH) return process.env.A11Y_CHROME_PATH;
  try { const p = chromium.executablePath(); if (p && fs.existsSync(p)) return undefined; } catch {}
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  try {
    const c = fs.readdirSync(root).filter((d) => d.startsWith('chromium-'))
      .map((d) => join(root, d, 'chrome-linux', 'chrome')).filter((f) => fs.existsSync(f)).sort();
    if (c.length) return c[c.length - 1];
  } catch {}
  return undefined;
}

const toUrl = (line) => {
  const t = line.trim();
  if (!t || t.startsWith('#')) return null;
  try { return new URL(/^https?:\/\//i.test(t) ? t : `https://${t}`).toString(); } catch { return null; }
};

async function triage(context, url, axeSource) {
  const page = await context.newPage();
  try {
    const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    if (!resp || resp.status() >= 400) return { url, error: resp ? `HTTP ${resp.status()}` : 'no response' };
    await page.waitForTimeout(1500);

    const scripts = await page.$$eval('script[src]', (ss) => ss.map((s) => s.src)).catch(() => []);
    const overlays = [];
    for (const o of OVERLAYS) {
      let hit = scripts.some((s) => o.match.test(s));
      if (!hit && o.global) {
        hit = await page.evaluate((g) => typeof window[g] !== 'undefined', o.global).catch(() => false);
      }
      if (hit) overlays.push(o.name);
    }

    await page.addScriptTag({ content: axeSource });
    const violations = await page.evaluate(async () => {
      const r = await window.axe.run(document, {
        runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
        resultTypes: ['violations'],
      });
      return r.violations.map((v) => ({ id: v.id, nodeCount: v.nodes.length }));
    });

    const title = await page.title().catch(() => '');
    const instances = violations.reduce((n, v) => n + v.nodeCount, 0);
    const blockers = violations.filter((v) => describe(v.id).severity === 'blocker').length;
    const topRules = violations
      .sort((a, b) => b.nodeCount - a.nodeCount).slice(0, 5)
      .map((v) => `${v.id}(${v.nodeCount})`);

    return { url, title, finalUrl: page.url(), overlays, rulesFailing: violations.length,
             instances, blockers, topRules };
  } catch (err) {
    return { url, error: err.message.split('\n')[0].slice(0, 160) };
  } finally {
    await page.close().catch(() => {});
  }
}

/**
 * Ranks the call list. Blockers dominate because they are the failures that both
 * stop a real user and read badly in a complaint. An overlay adds a flat bonus:
 * it is a budget signal, not a severity signal, so it should not swamp the
 * technical score.
 */
function score(row) {
  if (row.error) return 0;
  const base = row.blockers * 10 + row.rulesFailing * 3 + Math.min(row.instances, 200) * 0.15;
  return Number((base + (row.overlays.length ? 25 : 0)).toFixed(1));
}

async function main() {
  const argv = process.argv.slice(2);
  const outIdx = argv.indexOf('--out');
  const outDir = outIdx > -1 ? argv[outIdx + 1] : './prospects';
  const concIdx = argv.indexOf('--concurrency');
  const concurrency = concIdx > -1 ? Number(argv[concIdx + 1]) : 3;
  const listPath = argv.find((a) => !a.startsWith('--') && a !== outDir && a !== String(concurrency));
  if (!listPath) { console.error('usage: node prospect.mjs <domains.txt> [--out DIR] [--concurrency N]'); process.exit(2); }

  const urls = (await readFile(resolve(listPath), 'utf8')).split('\n').map(toUrl).filter(Boolean);
  if (!urls.length) { console.error('No usable domains in list.'); process.exit(2); }

  const axeSource = require('node:fs').readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
  const browser = await chromium.launch({ executablePath: resolveChrome(), args: ['--no-sandbox'] });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (compatible; a11y-audit/0.1; accessibility conformance scan)',
    viewport: { width: 1280, height: 900 },
  });

  const rows = [];
  process.stderr.write(`Triaging ${urls.length} domains\n`);
  for (let i = 0; i < urls.length; i += concurrency) {
    const batch = urls.slice(i, i + concurrency);
    const out = await Promise.all(batch.map((u) => triage(context, u, axeSource)));
    for (const r of out) {
      rows.push(r);
      process.stderr.write(r.error
        ? `  ${r.url} — skip (${r.error})\n`
        : `  ${r.url} — ${r.blockers} blocker(s), ${r.instances} element(s)` +
          `${r.overlays.length ? ` [overlay: ${r.overlays.join(', ')}]` : ''}\n`);
    }
  }
  await browser.close();

  const ranked = rows.map((r) => ({ ...r, score: score(r) })).sort((a, b) => b.score - a.score);
  await mkdir(resolve(outDir), { recursive: true });
  await writeFile(join(resolve(outDir), 'prospects.json'), JSON.stringify(ranked, null, 2));

  const csv = ['score,url,title,blockers,rules_failing,instances,overlay,top_rules,error']
    .concat(ranked.map((r) => [
      r.score, r.url, JSON.stringify(r.title ?? ''), r.blockers ?? '', r.rulesFailing ?? '',
      r.instances ?? '', JSON.stringify((r.overlays || []).join('; ')),
      JSON.stringify((r.topRules || []).join('; ')), JSON.stringify(r.error ?? ''),
    ].join(','))).join('\n');
  await writeFile(join(resolve(outDir), 'prospects.csv'), csv);

  const withOverlay = ranked.filter((r) => r.overlays?.length).length;
  process.stderr.write(`\n${ranked.length} triaged · ${withOverlay} running an overlay · ` +
    `${ranked.filter((r) => !r.error && r.blockers > 0).length} with task-blocking failures\n`);
  console.log(join(resolve(outDir), 'prospects.csv'));
}

main().catch((e) => { console.error(e); process.exit(1); });
