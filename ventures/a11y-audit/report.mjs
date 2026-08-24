#!/usr/bin/env node
/**
 * Renders a scan JSON into the two things a buyer actually reads:
 *
 *   --teaser   a short outreach summary. Names the problem, withholds the fix list.
 *   (default)  the full audit: prioritised findings, evidence, remediation notes.
 *
 *   node report.mjs reports/site.json --html --out reports/
 *
 * Deliberately never uses the words "compliant", "certified" or "guaranteed".
 * No vendor can promise those, and writing them into a deliverable transfers
 * the client's legal risk onto you.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, join, basename } from 'node:path';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const REMEDIATION = {
  'image-alt': 'Add descriptive `alt` text to informative images; `alt=""` for decorative ones.',
  'link-name': 'Give every link discernible text. Icon-only links need visually-hidden text or `aria-label`.',
  'button-name': 'Give every button an accessible name — text content, `aria-label`, or `aria-labelledby`.',
  'label': 'Associate each input with a `<label for>`, or give it `aria-label` / `aria-labelledby`.',
  'color-contrast': 'Adjust foreground or background so body text reaches 4.5:1 (3:1 for large text). Usually a design-token change, not a per-page fix.',
  'document-title': 'Give each page a unique, descriptive `<title>`.',
  'html-has-lang': 'Add `lang` to the `<html>` element.',
  'meta-viewport': 'Remove `user-scalable=no` and any `maximum-scale` below 2.',
  'frame-title': 'Add a descriptive `title` to every iframe.',
  'heading-order': 'Use heading levels in sequence; do not skip levels for visual sizing.',
  'bypass': 'Add a skip link, or wrap primary content in a `<main>` landmark.',
  'video-caption': 'Supply synchronised captions for pre-recorded video.',
  'aria-hidden-focus': 'Remove `aria-hidden` from focusable elements, or take them out of the tab order.',
  'scrollable-region-focusable': 'Give scrollable containers `tabindex="0"` so keyboard users can reach them.',
  'link-in-text-block': 'Distinguish inline links by more than colour — underline is the usual fix.',
};

const fixFor = (id) => REMEDIATION[id] ?? 'See the linked axe-core rule for the recommended fix.';

const BADGE = { blocker: '#b3261e', major: '#a15c00', minor: '#4a5568' };

function markdown(r, { teaser }) {
  const L = [];
  const host = new URL(r.target).hostname;
  L.push(`# Accessibility findings — ${host}`, '');
  L.push(`**Scanned** ${new Date(r.scannedAt).toISOString().slice(0, 10)} · ` +
         `**Standard** ${r.standard} · **Pages** ${r.pagesScanned}`, '');

  if (teaser) {
    const top = r.findings.slice(0, 3);
    L.push(`An automated pass over ${r.pagesScanned} pages found **${r.summary.rulesFailing} failing rule types** ` +
           `across **${r.summary.totalInstances} elements**, including **${r.summary.blockers}** that stop a ` +
           `screen-reader or keyboard user from finishing a task.`, '');
    L.push('The three highest-priority ones:', '');
    for (const f of top) L.push(`- **${f.help}** — ${f.plain} _(WCAG ${f.sc.join(', ') || 'n/a'}, ${f.pagesAffected} page(s))_`);
    L.push('', `_${r.coverageCaveat}_`);
    return L.join('\n');
  }

  L.push('## Summary', '');
  L.push('| | |', '|---|---|');
  L.push(`| Failing rule types | ${r.summary.rulesFailing} |`);
  L.push(`| Affected elements | ${r.summary.totalInstances} |`);
  L.push(`| Task-blocking rules | ${r.summary.blockers} |`);
  L.push(`| Commonly cited in complaints | ${r.summary.highSalience} |`);
  L.push(`| Pages with no automated findings | ${r.summary.cleanPages} of ${r.pagesScanned} |`, '');
  L.push(`> ${r.coverageCaveat}`, '');

  L.push('## Findings, highest priority first', '');
  r.findings.forEach((f, i) => {
    L.push(`### ${i + 1}. ${f.help}`, '');
    L.push(`\`${f.ruleId}\` · **${f.severity}** · WCAG ${f.sc.join(', ') || 'n/a'} · ` +
           `${f.instances} element(s) on ${f.pagesAffected} page(s)`, '');
    L.push(f.plain, '');
    L.push(`**Fix.** ${fixFor(f.ruleId)}`, '');
    if (f.samples.length) {
      L.push('<details><summary>Evidence</summary>', '');
      for (const s of f.samples.slice(0, 3)) {
        L.push(`- \`${s.target}\` on ${s.page}`, '', '  ```html', '  ' + s.html.replace(/\n/g, ' '), '  ```', '');
      }
      L.push('</details>', '');
    }
  });

  L.push('## Pages scanned', '');
  for (const p of r.pages) {
    L.push(p.error ? `- ${p.url} — not scanned (${p.error})` : `- ${p.url} — ${p.rulesFailing} rule(s), ${p.instances} element(s)`);
  }
  return L.join('\n');
}

function html(r) {
  const host = new URL(r.target).hostname;
  const rows = r.findings.map((f, i) => `
    <article class="finding">
      <header>
        <span class="rank">${i + 1}</span>
        <div>
          <h3>${esc(f.help)}</h3>
          <p class="meta">
            <span class="badge" style="background:${BADGE[f.severity]}">${esc(f.severity)}</span>
            <code>${esc(f.ruleId)}</code>
            <span>WCAG ${esc(f.sc.join(', ') || 'n/a')}</span>
            <span>${f.instances} element(s) · ${f.pagesAffected} page(s)</span>
          </p>
        </div>
      </header>
      <p>${esc(f.plain)}</p>
      <p class="fix"><strong>Fix.</strong> ${esc(fixFor(f.ruleId))}</p>
      ${f.samples.length ? `<details><summary>Evidence (${f.samples.length})</summary>${
        f.samples.slice(0, 3).map((s) => `<div class="sample"><code class="sel">${esc(s.target)}</code>
          <span class="on">${esc(s.page)}</span><pre>${esc(s.html)}</pre></div>`).join('')
      }</details>` : ''}
    </article>`).join('');

  return `<title>Accessibility findings — ${esc(host)}</title>
<style>
  :root{--ink:#14171f;--dim:#5b6472;--line:#e2e6ec;--bg:#fff;--panel:#f7f9fc}
  *{box-sizing:border-box}
  body{margin:0;padding:48px 24px;background:var(--bg);color:var(--ink);
       font:16px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
  .wrap{max-width:820px;margin:0 auto}
  h1{font-size:28px;margin:0 0 4px}
  .sub{color:var(--dim);margin:0 0 32px}
  .cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:24px}
  .card{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:14px}
  .card .n{font-size:26px;font-weight:650;line-height:1.1}
  .card .l{font-size:13px;color:var(--dim);margin-top:2px}
  .caveat{border-left:3px solid #a15c00;background:#fdf8f0;padding:12px 16px;
          border-radius:0 8px 8px 0;font-size:14px;color:#4a3a1e;margin-bottom:32px}
  h2{font-size:19px;margin:32px 0 12px;padding-bottom:8px;border-bottom:1px solid var(--line)}
  .finding{border:1px solid var(--line);border-radius:10px;padding:18px;margin-bottom:14px}
  .finding header{display:flex;gap:14px;align-items:flex-start}
  .rank{flex:none;width:28px;height:28px;border-radius:50%;background:var(--panel);
        border:1px solid var(--line);display:grid;place-items:center;font-size:13px;font-weight:650}
  .finding h3{font-size:17px;margin:2px 0 6px}
  .meta{display:flex;flex-wrap:wrap;gap:8px;align-items:center;font-size:12.5px;color:var(--dim);margin:0}
  .badge{color:#fff;padding:2px 8px;border-radius:20px;font-size:11px;
         font-weight:650;text-transform:uppercase;letter-spacing:.04em}
  code{background:var(--panel);padding:1px 5px;border-radius:4px;font-size:12.5px}
  .fix{background:var(--panel);border-radius:8px;padding:10px 14px;font-size:14.5px}
  details{margin-top:10px;font-size:14px}
  summary{cursor:pointer;color:var(--dim)}
  .sample{margin:10px 0;padding-left:12px;border-left:2px solid var(--line)}
  .sel{font-weight:600}.on{color:var(--dim);font-size:12.5px;margin-left:6px}
  pre{background:#0f1420;color:#dbe3f0;padding:10px 12px;border-radius:6px;
      overflow-x:auto;font-size:12.5px;margin:6px 0 0}
  ul{padding-left:20px}li{margin:3px 0;font-size:14.5px}
  .foot{margin-top:40px;padding-top:16px;border-top:1px solid var(--line);
        font-size:13px;color:var(--dim)}
  @media print{body{padding:0}.finding{break-inside:avoid}}
</style>
<div class="wrap">
  <h1>Accessibility findings</h1>
  <p class="sub">${esc(host)} · ${esc(new Date(r.scannedAt).toISOString().slice(0, 10))} ·
     ${esc(r.standard)} · ${r.pagesScanned} pages · ${esc(r.engine)}</p>

  <div class="cards">
    <div class="card"><div class="n">${r.summary.rulesFailing}</div><div class="l">failing rule types</div></div>
    <div class="card"><div class="n">${r.summary.totalInstances}</div><div class="l">affected elements</div></div>
    <div class="card"><div class="n">${r.summary.blockers}</div><div class="l">task-blocking</div></div>
    <div class="card"><div class="n">${r.summary.cleanPages}/${r.pagesScanned}</div><div class="l">pages with no findings</div></div>
  </div>

  <div class="caveat"><strong>Scope of this scan.</strong> ${esc(r.coverageCaveat)}</div>

  <h2>Findings, highest priority first</h2>
  ${rows || '<p>No automated findings. Manual testing is still required.</p>'}

  <h2>Pages scanned</h2>
  <ul>${r.pages.map((p) => `<li>${esc(p.url)} — ${p.error
      ? `not scanned (${esc(p.error)})`
      : `${p.rulesFailing} rule(s), ${p.instances} element(s)`}</li>`).join('')}</ul>

  <p class="foot">Prepared from an automated conformance scan. This document reports observed
     failures against ${esc(r.standard)}; it is not a legal opinion and not a determination of
     compliance.</p>
</div>`;
}

async function main() {
  const argv = process.argv.slice(2);
  const teaser = argv.includes('--teaser');
  const wantHtml = argv.includes('--html');
  const outIdx = argv.indexOf('--out');
  const outDir = outIdx > -1 ? argv[outIdx + 1] : null;
  const input = argv.find((a) => !a.startsWith('--') && a !== outDir);
  if (!input) { console.error('usage: node report.mjs <scan.json> [--teaser] [--html] [--out DIR]'); process.exit(2); }

  const r = JSON.parse(await readFile(resolve(input), 'utf8'));
  const md = markdown(r, { teaser });

  if (!outDir) { console.log(md); return; }
  await mkdir(resolve(outDir), { recursive: true });
  const stem = basename(input).replace(/\.json$/, '') + (teaser ? '-teaser' : '-audit');
  const mdPath = join(resolve(outDir), `${stem}.md`);
  await writeFile(mdPath, md);
  const written = [mdPath];
  if (wantHtml && !teaser) {
    const hPath = join(resolve(outDir), `${stem}.html`);
    await writeFile(hPath, html(r));
    written.push(hPath);
  }
  written.forEach((w) => console.log(w));
}

main().catch((e) => { console.error(e); process.exit(1); });
