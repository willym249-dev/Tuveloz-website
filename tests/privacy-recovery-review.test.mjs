import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { build } from 'esbuild';

const intent = index => ({ requestId: `synthetic-${index}`, email: `person-${index}@example.invalid`,
  snapshotDigest: String(index % 10).repeat(64), approvedBy: 'owner@example.invalid',
  caseReference: 'SYNTHETIC-CASE', recoveryReference: 'SYNTHETIC-RESTORE',
  closureCaseReference: 'SYNTHETIC-CLOSURE', closedAt: '2026-10-09 12:00:00', reviewAfter: '2099-01-01' });

test('read-only recovery review distinguishes incomplete evidence without resolving it', async t => {
  const repo = resolve(import.meta.dirname, '..'), scratch = mkdtempSync(join(tmpdir(), 'tuveloz-recovery-review-'));
  const oldFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw Error('External calls forbidden'); };
  t.after(() => { globalThis.fetch = oldFetch; rmSync(scratch, { recursive: true, force: true }); });
  const bundle = join(scratch, 'review.cjs');
  await build({ absWorkingDir: repo, stdin: { contents: 'export * from "./lib/privacy-erasure-recovery"; export * from "./lib/privacy-recovery-review";', resolveDir: repo, loader: 'ts' }, bundle: true, platform: 'node', format: 'cjs', outfile: bundle, logLevel: 'silent' });
  const api = createRequire(import.meta.url)(bundle);
  const fixture = subtest => {
    const database = new DatabaseSync(':memory:');
    subtest.after(() => database.close());
    database.exec(`CREATE TABLE privacy_auth_erasure_records (request_id TEXT PRIMARY KEY, snapshot_digest TEXT,
      approved_by TEXT, case_reference TEXT, recovery_reference TEXT, scope TEXT);
      CREATE TABLE account_closures (privacy_request_id TEXT, email TEXT PRIMARY KEY, case_reference TEXT,
      closed_at TEXT, review_after TEXT);`);
    const objects = new Map();
    const state = { locked: false, gets: 0, lists: 0, reads: 0, writes: 0, onList: null, onRead: null, pageSize: 100 };
    const store = {
      async get(key) { state.gets++; return objects.has(key) ? { text: async () => objects.get(key) } : null; },
      async put(key, value) {
        state.writes++;
        assert.equal(state.locked, false, 'review must never write recovery storage');
        if (!objects.has(key)) objects.set(key, value);
        return {};
      },
      async list({ prefix, cursor }) {
        state.lists++;
        if (state.onList) await state.onList(state.lists);
        const keys = [...objects.keys()].filter(key => key.startsWith(prefix));
        const offset = Number(cursor || 0), end = offset + state.pageSize;
        return { objects: keys.slice(offset, end).map(key => ({ key })), truncated: end < keys.length, cursor: String(end) };
      },
    };
    const journal = new api.AuthErasureRecoveryJournal(store, 'synthetic-tests', 'test-key', { 'test-key': 'synthetic-recovery-secret-minimum-thirty-two-characters' });
    const source = { prepare(sql) {
      assert.match(sql.trim(), /^SELECT\b/i, 'only source SELECTs allowed');
      return { async all() {
        state.reads++;
        if (state.onRead) await state.onRead(state.reads);
        return { success: true, results: database.prepare(sql).all() };
      } };
    } };
    const addReceipt = row => {
      database.prepare('INSERT INTO privacy_auth_erasure_records VALUES (?,?,?,?,?,?)').run(row.requestId, row.snapshotDigest, row.approvedBy, row.caseReference, row.recoveryReference, 'authentication-records');
      database.prepare('INSERT INTO account_closures VALUES (?,?,?,?,?)').run(row.requestId, row.email, row.closureCaseReference, row.closedAt, row.reviewAfter);
    };
    const lock = () => { state.locked = true; state.gets = state.lists = state.reads = state.writes = 0; database.exec('PRAGMA query_only=ON'); };
    const review = async () => {
      lock();
      try { return await api.reviewAuthenticationRecovery(source, journal); }
      finally { assert.equal(state.writes, 0); assert.ok(state.gets + state.lists + state.reads <= 50, 'bounded remote calls'); }
    };
    return { database, objects, state, store, journal, source, addReceipt, review };
  };

  await t.test('empty catalogs remain disabled and require operational review', async subtest => {
    const f = fixture(subtest);
    assert.deepEqual(await f.review(), { cases: [], unresolved: 0, deletionEnabled: false, trafficMayOpen: false, requiresOperationalReview: true });
  });

  await t.test('reports all three evidence states using actual signed records and SQL', async subtest => {
    const f = fixture(subtest), rows = [intent(1), intent(2), intent(3)];
    for (const row of rows) await f.journal.prepare(row);
    f.addReceipt(rows[1]); f.addReceipt(rows[2]); await f.journal.confirm(rows[2]);
    const before = JSON.stringify([...f.objects]);
    const report = await f.review();
    assert.deepEqual(report.cases, [
      { requestId: rows[0].requestId, state: 'no-source-receipt' },
      { requestId: rows[1].requestId, state: 'receipt-present-completion-missing' },
      { requestId: rows[2].requestId, state: 'matched-completion' },
    ]);
    assert.equal(report.unresolved, 2);
    assert.equal(report.deletionEnabled, false); assert.equal(report.trafficMayOpen, false);
    assert.doesNotMatch(JSON.stringify(report), /example.invalid|snapshotDigest|SYNTHETIC-CASE|secret/);
    assert.equal(JSON.stringify([...f.objects]), before);
    // Existing replay/status readers must still reject unresolved attempts.
    await assert.rejects(() => f.journal.completedIntents(), /missing, incomplete or invalid/);
  });

  for (const defect of ['missing-source', 'extra-source', 'metadata', 'missing-closure', 'scope', 'ambiguous-attempt']) {
    await t.test(`rejects ${defect} rather than guessing a recovery outcome`, async subtest => {
      const f = fixture(subtest), row = intent(1);
      await f.journal.prepare(row);
      if (defect === 'missing-source') await f.journal.confirm(row);
      else f.addReceipt(row);
      if (defect === 'extra-source') f.addReceipt(intent(2));
      if (defect === 'metadata') f.database.exec("UPDATE privacy_auth_erasure_records SET case_reference='CHANGED-CASE'");
      if (defect === 'missing-closure') f.database.exec('DELETE FROM account_closures');
      if (defect === 'scope') f.database.exec("UPDATE privacy_auth_erasure_records SET scope='other'");
      if (defect === 'ambiguous-attempt') await f.journal.prepare({ ...row, snapshotDigest: 'a'.repeat(64) });
      await assert.rejects(() => f.review());
    });
  }

  for (const defect of ['signature', 'path', 'orphan-completion', 'completion-hash', 'listing-misses-completion', 'listed-object-missing']) {
    await t.test(`rejects journal ${defect}`, async subtest => {
      const f = fixture(subtest), row = intent(1);
      await f.journal.prepare(row); await f.journal.confirm(row); f.addReceipt(row);
      const intentKey = [...f.objects.keys()].find(key => key.endsWith('/intent.json'));
      const completeKey = intentKey.replace('intent.json', 'complete.json');
      if (defect === 'signature') {
        const parsed = JSON.parse(f.objects.get(intentKey)); parsed.signature = '0'.repeat(64); f.objects.set(intentKey, JSON.stringify(parsed));
      }
      if (defect === 'path') { f.objects.set(f.journal.prefix + 'a'.repeat(64) + '/intent.json', f.objects.get(intentKey)); f.objects.delete(intentKey); }
      if (defect === 'orphan-completion') f.objects.delete(intentKey);
      if (defect === 'completion-hash') {
        await f.journal.prepare(intent(2)); await f.journal.confirm(intent(2));
        const other = [...f.objects.keys()].find(key => key.endsWith('/complete.json') && key !== completeKey);
        f.objects.set(completeKey, f.objects.get(other));
      }
      if (defect === 'listing-misses-completion') f.store.list = async () => { f.state.lists++; return { objects: [{ key: intentKey }], truncated: false }; };
      if (defect === 'listed-object-missing') {
        const get = f.store.get; f.store.get = async key => key === completeKey ? null : get(key);
      }
      await assert.rejects(() => f.review(), /missing, incomplete or invalid/);
    });
  }

  for (const movement of ['source', 'new-intent', 'completion']) {
    await t.test(`discards report when ${movement} changes between reads`, async subtest => {
      const f = fixture(subtest), row = intent(1);
      await f.journal.prepare(row); f.addReceipt(row);
      // Pre-create correctly signed fixture records, then reveal them mid-read.
      if (movement !== 'source') {
        if (movement === 'completion') await f.journal.confirm(row); else await f.journal.prepare(intent(2));
        const key = [...f.objects.keys()].at(-1), body = f.objects.get(key); f.objects.delete(key);
        f.state.onList = count => { if (count === 2) f.objects.set(key, body); };
      } else {
        f.state.onRead = count => {
          if (count === 2) { f.database.exec("PRAGMA query_only=OFF; UPDATE privacy_auth_erasure_records SET case_reference='CHANGED-CASE'; PRAGMA query_only=ON;"); }
        };
      }
      await assert.rejects(() => f.review());
    });
  }

  await t.test('ten completed cases with four pages per pass fit the fifty-read budget', async subtest => {
    const f = fixture(subtest);
    for (let index = 0; index < 10; index++) { const row = intent(index); await f.journal.prepare(row); await f.journal.confirm(row); f.addReceipt(row); }
    f.state.pageSize = 5;
    assert.equal((await f.review()).cases.length, 10);
    assert.equal(f.state.gets + f.state.lists + f.state.reads, 50);
  });
  await t.test('overflow rejects before fetching journal contents', async subtest => {
    const f = fixture(subtest);
    for (let index = 0; index < 11; index++) await f.journal.prepare(intent(index));
    await assert.rejects(() => f.review()); assert.equal(f.state.gets, 0);
  });
  await t.test('pagination cannot consume unbounded calls even with empty pages', async subtest => {
    const f = fixture(subtest);
    f.store.list = async () => ({ objects: [], truncated: true, cursor: String(++f.state.lists) });
    await assert.rejects(() => f.review()); assert.equal(f.state.lists, 4);
  });
  await t.test('repeated pagination cursor is rejected', async subtest => {
    const f = fixture(subtest);
    f.store.list = async () => { f.state.lists++; return { objects: [], truncated: true, cursor: 'same' }; };
    await assert.rejects(() => f.review()); assert.equal(f.state.lists, 2);
  });
  await t.test('storage and database failures do not produce a successful empty report', async subtest => {
    const f = fixture(subtest);
    for (const result of [{ success: false, results: [] }, { success: true }]) {
      await assert.rejects(() => api.reviewAuthenticationRecovery({ prepare: () => ({ all: async () => result }) }, f.journal));
    }
    f.store.get = async () => { throw Error('Storage outage'); };
    // Listing itself must fail even when no records can be fetched.
    f.store.list = async () => { throw Error('Storage outage'); };
    await assert.rejects(() => f.review(), /Storage outage/);
  });
});
