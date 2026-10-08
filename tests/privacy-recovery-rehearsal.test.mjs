import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import test from 'node:test';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { buildPrivacyRehearsal } from '../rehearsal-worker/build-privacy-recovery.mjs';

test('prepared recovery rehearsal requires private access and refuses existing resources', { timeout: 120000 }, async t => {
  const script = await buildPrivacyRehearsal();
  async function fixture(expiry = new Date(Date.now() + 1800000).toISOString()) {
    const token = randomBytes(32).toString('hex');
    const runtime = new Miniflare(convertV4MiniflareOptions({ host: '127.0.0.1', port: 0, workers: [{ name: 'private-rehearsal-fixture', modules: true, script, compatibilityDate: '2026-07-27',
      d1Databases: { SOURCE: 'SOURCE', RESTORE: 'RESTORE' }, r2Buckets: ['JOURNAL'],
      bindings: { REHEARSAL_TOKEN: token, JOURNAL_SIGNING_KEY: randomBytes(32).toString('hex'), EXPIRES_AT: expiry },
      outboundService: () => { throw Error('External traffic prohibited'); } }] }));
    return { runtime, call: (authorized = true) => runtime.dispatchFetch('https://rehearsal.invalid/run', { method: 'POST', headers: authorized ? { authorization: `Bearer ${token}` } : {} }) };
  }
  await t.test('denies anonymous callers, completes synthetic rehearsal, then rejects reuse', async () => {
    const f = await fixture();
    try {
      assert.equal((await f.call(false)).status, 403);
      assert.equal((await (await f.runtime.getR2Bucket('JOURNAL')).list()).objects.length, 0);
      const result = await f.call(), body = await result.json();
      assert.equal(result.status, 200, JSON.stringify(body));
      assert.equal(body.passed.length, 5); assert.equal(body.trafficMayOpen, false);
      const again = await f.call();
      assert.equal(again.status, 409); assert.equal((await again.json()).failedStage, 'empty-resources');
    } finally { await f.runtime.dispose(); }
  });
  for (const occupied of ['SOURCE', 'RESTORE', 'JOURNAL']) await t.test(`refuses occupied ${occupied} before changing either database`, async () => {
    const f = await fixture();
    try {
      if (occupied === 'JOURNAL') await (await f.runtime.getR2Bucket('JOURNAL')).put('existing', 'leave-alone');
      else await (await f.runtime.getD1Database(occupied)).prepare('CREATE TABLE existing_record (id TEXT)').run();
      const response = await f.call();
      assert.equal(response.status, 409);
      assert.equal((await response.json()).failedStage, 'empty-resources');
      for (const name of ['SOURCE', 'RESTORE']) {
        const count = await (await f.runtime.getD1Database(name)).prepare("SELECT count(*) n FROM sqlite_schema WHERE name='account_credentials'").first();
        assert.equal(count.n, 0);
      }
      if (occupied === 'JOURNAL') assert.equal(await (await (await f.runtime.getR2Bucket('JOURNAL')).get('existing')).text(), 'leave-alone');
    } finally { await f.runtime.dispose(); }
  });
  for (const expiry of [new Date(Date.now() - 1000).toISOString(), new Date(Date.now() + 7200000).toISOString(), 'invalid']) await t.test('refuses expired or excessive access window', async () => {
    const f = await fixture(expiry);
    try { assert.equal((await f.call()).status, 403); }
    finally { await f.runtime.dispose(); }
  });
});
