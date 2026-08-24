/**
 * Serves fixtures/ carrying known, deliberate WCAG failures and asserts the
 * scanner finds exactly those. Guards the parts most likely to rot silently:
 * the axe injection, the crawl, and the rule map.
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const run = promisify(execFile);
const HERE = fileURLToPath(new URL('.', import.meta.url));
const FIXTURES = join(HERE, 'fixtures');
const OUT = join(HERE, 'reports', 'test');

let server, origin;

before(async () => {
  server = createServer(async (req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p === '/') p = '/index.html';
    if (!extname(p)) p += '.html';
    try {
      const body = await readFile(join(FIXTURES, p));
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(body);
    } catch {
      res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' });
      res.end('<!doctype html><title>404</title><p>Not found');
    }
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  origin = `http://127.0.0.1:${server.address().port}/`;
});

after(() => server?.close());

test('finds the violations planted in the fixture home page', async () => {
  const { stdout } = await run('node', [join(HERE, 'scan.mjs'), origin, '--pages', '5', '--out', OUT],
    { cwd: HERE, timeout: 180000 });
  const report = JSON.parse(await readFile(stdout.trim(), 'utf8'));
  const ids = new Set(report.findings.map((f) => f.ruleId));

  // Each of these is deliberately broken in fixtures/index.html.
  for (const expected of ['image-alt', 'link-name', 'button-name', 'label',
                          'document-title', 'html-has-lang', 'color-contrast',
                          'meta-viewport', 'frame-title']) {
    assert.ok(ids.has(expected), `expected the scan to flag ${expected}`);
  }

  assert.equal(report.standard, 'WCAG 2.1 Level AA');
  assert.ok(report.pagesScanned >= 2, 'should have crawled past the entry page');
  assert.ok(report.summary.blockers > 0, 'should classify some failures as task-blocking');
});

test('leaves the accessible fixture page clean', async () => {
  const { stdout } = await run('node', [join(HERE, 'scan.mjs'), `${origin}permits.html`,
    '--pages', '1', '--out', OUT], { cwd: HERE, timeout: 120000 });
  const report = JSON.parse(await readFile(stdout.trim(), 'utf8'));
  assert.equal(report.findings.length, 0,
    `permits.html should be clean, got: ${report.findings.map((f) => f.ruleId).join(', ')}`);
});

test('ranks task-blocking failures above cosmetic ones', async () => {
  const { priority } = await import('./rules.mjs');
  const blocker = priority({ ruleId: 'label', instances: 1, pagesAffected: 1 });
  const cosmetic = priority({ ruleId: 'region', instances: 50, pagesAffected: 5 });
  assert.ok(blocker > cosmetic,
    `an unlabelled form field (${blocker}) should outrank landmark nits (${cosmetic})`);
});

test('every mapped rule carries the fields the report depends on', async () => {
  const { RULE_MAP, SEVERITY, SALIENCE } = await import('./rules.mjs');
  for (const [id, r] of Object.entries(RULE_MAP)) {
    assert.ok(Array.isArray(r.sc), `${id}: sc must be an array`);
    assert.ok(r.severity in SEVERITY, `${id}: bad severity ${r.severity}`);
    assert.ok(r.litigationSalience in SALIENCE, `${id}: bad salience ${r.litigationSalience}`);
    assert.ok(r.plain?.length > 20, `${id}: needs a plain-language explanation`);
  }
});

test('no artifact claims compliance', async () => {
  const src = await readFile(join(HERE, 'report.mjs'), 'utf8');
  const rendered = src.slice(src.indexOf('function markdown'));
  for (const banned of ['is compliant', 'fully compliant', 'certified', 'guaranteed',
                        'lawsuit-proof', 'ADA compliant']) {
    assert.ok(!new RegExp(banned, 'i').test(rendered.replace(/never uses[^\n]*/g, '')),
      `report output must not use the phrase "${banned}"`);
  }
});
