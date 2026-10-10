import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createHmac } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { build } from 'esbuild';

test('scoped authentication erasure uses migrated synthetic records only', async t => {
  const repo = resolve(import.meta.dirname, '..'), scratch = mkdtempSync(join(tmpdir(), 'tuveloz-auth-erasure-'));
  const database = new DatabaseSync(':memory:');
  const state = { owner: true, beforeWrite: null, afterWrite: null, queries: 0 };
  const oldFetch = globalThis.fetch;
  globalThis.__erasureFixture = state;
  const db = { prepare(sql) {
    state.queries++;
    let values = [];
    return { bind(...params) { values = params; return this; },
      async first() { return database.prepare(sql).get(...values) ?? null; },
      async run() { if (state.beforeWrite) { const fn = state.beforeWrite; state.beforeWrite = null; fn(); }
        const result = { meta: { changes: Number(database.prepare(sql).run(...values).changes) } };
        if (state.afterWrite) { const fn = state.afterWrite; state.afterWrite = null; fn(); }
        return result; } };
  } };
  const seed = (table, values, connection = database) => {
    for (const column of connection.prepare(`PRAGMA table_info(${table})`).all()) {
      if ((column.notnull || column.pk) && column.dflt_value === null && !(column.name in values)) {
        values[column.name] = /INT/.test(column.type) ? 1 : `SECRET-${column.name}-${values.id || values.email}`;
      }
    }
    const names = Object.keys(values);
    connection.prepare(`INSERT INTO ${table} (${names.join(',')}) VALUES (${names.map(() => '?').join(',')})`).run(...Object.values(values));
  };
  try {
    globalThis.fetch = async () => { throw Error('External requests forbidden'); };
    for (const entry of JSON.parse(readFileSync(join(repo, 'drizzle/meta/_journal.json'), 'utf8')).entries) database.exec(readFileSync(join(repo, 'drizzle', entry.tag + '.sql'), 'utf8'));
    const bundle = join(scratch, 'engine.cjs');
    await build({ absWorkingDir: repo, stdin: { contents: 'export * from "./lib/privacy-auth-erasure"; export * from "./lib/privacy-erasure-recovery"; export * from "./lib/privacy-erasure-replay";', resolveDir: repo, loader: 'ts' }, bundle: true, platform: 'node', format: 'cjs', outfile: bundle, logLevel: 'silent', plugins: [{ name: 'owner-fixture', setup(builder) {
      builder.onResolve({ filter: /\/owner-auth$/ }, args => ({ path: args.path, namespace: 'fixture' }));
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ loader: 'js', contents: 'export const verifyOwnerRequest=async()=>globalThis.__erasureFixture.owner?{ok:true,email:"owner@example.invalid"}:{ok:false};' }));
    } }] });
    const api = createRequire(import.meta.url)(bundle);
    const createJournal = (context = 'synthetic-tests') => {
      const objects = new Map(), faults = { intent: false, complete: false, afterPut: false };
      const store = {
        async get(key) { return objects.has(key) ? { text: async () => objects.get(key) } : null; },
        async put(key, body, options) {
          assert.equal(options.onlyIf.etagDoesNotMatch, '*');
          if ((faults.intent && key.endsWith('/intent.json')) || (faults.complete && key.endsWith('/complete.json'))) throw Error('Synthetic storage outage');
          if (!objects.has(key)) objects.set(key, body);
          if (faults.afterPut) throw Error('Synthetic lost PUT reply');
          return {};
        },
        async list({ prefix }) { return { objects: [...objects.keys()].filter(key => key.startsWith(prefix)).map(key => ({ key })), truncated: false }; },
      };
      const keys = { 'test-key': 'synthetic-recovery-secret-minimum-thirty-two-characters' };
      return { objects, faults, store, keys, journal: new api.AuthErasureRecoveryJournal(store, context, 'test-key', keys) };
    };
    const recovery = createJournal();
    let sequence = 0;
    const make = async (id, close = true) => {
      const email = `${id}@example.invalid`, phone = `+1202555${String(++sequence).padStart(4, '0')}`;
      seed('privacy_requests', { id, email, role: 'customer', request_type: 'account-closure', identity_source: 'signed-in-account' });
      seed('account_credentials', { email });
      seed('account_phone_numbers', { email, phone_e164: phone });
      for (const role of ['customer', 'provider']) {
        seed('auth_sessions', { id: id + role, email, role });
        seed('passkey_credentials', { id: id + role, email, role });
        seed('login_codes', { id: id + role, email, role });
      }
      seed('password_verification_codes', { id, email, role: 'customer', purpose: 'reset' });
      seed('phone_login_codes', { id, email: '', phone_e164: phone, purpose: 'signin' });
      seed('provider_applications', { id: 'provider-' + id, email });
      seed('provider_evidence_submissions', { id: 'document-' + id, provider_id: 'provider-' + id });
      if (close) {
        seed('account_closures', { email, privacy_request_id: id, case_reference: 'CASE-' + id, review_after: '2099-01-01' });
        seed('privacy_access_closure_reviews', { request_id: id, reviewed_by: 'owner@example.invalid', scope: 'whole-account-access', case_reference: 'CASE-' + id, review_after: '2099-01-01', retention_notes: 'Separate privacy review remains pending.', snapshot_digest: 'a'.repeat(64) });
      }
      const preview = await api.previewAuthenticationErasure(db, id);
      return { email, phone, preview, approval: { requestId: id, reviewToken: preview.reviewToken, caseReference: 'ERASE-' + id, recoveryReference: 'RECOVERY-' + id, confirmAuthenticationOnly: true, confirmRetentionReviewed: true, confirmRecoveryRecorded: true } };
    };
    const request = (origin = 'https://tuveloz.invalid') => new Request('https://tuveloz.invalid/internal-erasure-test', { method: 'POST', headers: { origin } });
    const erase = approval => api.eraseReviewedAuthenticationData(request(), db, approval, recovery.journal);
    const count = (table, where, value) => database.prepare(`SELECT count(*) n FROM ${table} WHERE ${where}=?`).get(value).n;
    await t.test('only approved authentication records disappear; other account and documents remain', async () => {
      const alpha = await make('alpha'), bravo = await make('bravo', false);
      seed('phone_login_codes', { id: 'bravo-shared-phone', email: bravo.email, phone_e164: alpha.phone, purpose: 'signin' });
      assert.doesNotMatch(JSON.stringify(alpha.preview), /SECRET|example.invalid|1202555|password_hash|code_hash/);
      assert.equal((await erase(alpha.approval)).status, 'erased');
      const after = await api.previewAuthenticationErasure(db, 'alpha');
      assert.ok(Object.values(after.counts).every(value => value === 0));
      assert.equal(count('phone_login_codes', 'id', 'bravo-shared-phone'), 1);
      assert.equal(count('account_credentials', 'email', bravo.email), 1);
      assert.equal(count('provider_evidence_submissions', 'id', 'document-alpha'), 1);
      assert.equal(count('account_closures', 'email', alpha.email), 1);
      assert.equal(database.prepare('SELECT status FROM privacy_requests WHERE id=?').get('alpha').status, 'submitted');
      assert.equal(database.prepare('SELECT approved_by FROM privacy_auth_erasure_records WHERE request_id=?').get('alpha').approved_by, 'owner@example.invalid');
      assert.equal((await erase(alpha.approval)).status, 'already-erased');
      assert.equal((await erase({ ...alpha.approval, caseReference: 'DIFFERENT-CASE' })).status, 'conflict');
      assert.throws(() => seed('account_credentials', { email: alpha.email }), /Account access is closed/);
    });
    await t.test('owner, origin, explicit scope and reviewed closure are required', async () => {
      const row = await make('unclosed', false), closed = await make('guards');
      assert.equal(row.preview.eligible, false);
      assert.equal((await erase(row.approval)).status, 'conflict');
      const before = state.queries; state.owner = false;
      assert.equal((await erase(closed.approval)).status, 'forbidden'); state.owner = true;
      assert.equal((await api.eraseReviewedAuthenticationData(request('https://other.invalid'), db, closed.approval, recovery.journal)).status, 'forbidden');
      assert.equal(state.queries, before);
      assert.equal((await erase({ ...closed.approval, confirmAuthenticationOnly: false })).status, 'invalid');
      assert.equal(count('account_credentials', 'email', closed.email), 1);
    });
    for (const kind of ['withdrawal', 'hold', 'record-version', 'job']) await t.test(`${kind} after snapshot prevents all erasure`, async () => {
      const row = await make('race-' + kind);
      state.beforeWrite = () => {
        if (kind === 'withdrawal') database.prepare("UPDATE privacy_requests SET status='withdrawn' WHERE id=?").run(row.approval.requestId);
        if (kind === 'hold') seed('data_rights_requests', { id: 'hold-erasure', requester_email: row.email, requester_role: 'customer', request_type: 'deletion', legal_hold: 'yes' });
        if (kind === 'record-version') database.prepare("UPDATE account_credentials SET updated_at='2099-01-01' WHERE email=?").run(row.email);
        if (kind === 'job') { database.exec('DROP TRIGGER closed_account_customer_request_insert'); seed('customer_requests', { id: 'late-job', email: row.email, parts_source: 'No parts needed — labor only', parts_preference: 'No preference', labor_only_parts_acknowledged_at: '2026-10-07' }); }
      };
      assert.equal((await erase(row.approval)).status, 'conflict');
      assert.equal(count('account_credentials', 'email', row.email), 1);
      assert.equal(count('privacy_auth_erasure_records', 'request_id', row.approval.requestId), 0);
    });
    await t.test('mid-erasure failure rolls back removed codes and audit; retry succeeds', async () => {
      const row = await make('rollback');
      database.exec("CREATE TRIGGER synthetic_delete_failure BEFORE DELETE ON passkey_credentials WHEN OLD.email='rollback@example.invalid' BEGIN SELECT RAISE(ABORT,'synthetic failure'); END");
      await assert.rejects(() => erase(row.approval), /synthetic failure/);
      assert.equal(count('login_codes', 'email', row.email), 2);
      assert.equal(count('phone_login_codes', 'id', 'rollback'), 1);
      assert.equal(count('privacy_auth_erasure_records', 'request_id', 'rollback'), 0);
      database.exec('DROP TRIGGER synthetic_delete_failure');
      assert.equal((await erase(row.approval)).status, 'erased');
    });
    await t.test('missing journal or failed intent write preserves credentials', async () => {
      const row = await make('journal-outage'), isolated = createJournal('outage-test');
      assert.equal((await api.eraseReviewedAuthenticationData(request(), db, row.approval)).status, 'recovery-unavailable');
      isolated.faults.intent = true;
      await assert.rejects(() => api.eraseReviewedAuthenticationData(request(), db, row.approval, isolated.journal), /recovery evidence/);
      assert.equal(count('account_credentials', 'email', row.email), 1);
      assert.equal(count('privacy_auth_erasure_records', 'request_id', row.approval.requestId), 0);
    });
    await t.test('lost object write replies are reconciled by authenticated reads', async () => {
      const row = await make('lost-put'), isolated = createJournal('lost-put-test');
      isolated.faults.afterPut = true;
      assert.equal((await api.eraseReviewedAuthenticationData(request(), db, row.approval, isolated.journal)).status, 'erased');
      assert.equal((await isolated.journal.completedIntents()).length, 1);
      assert.doesNotMatch([...isolated.objects.values()].join(''), /SECRET|password_hash|code_hash|token_hash/);
      const rotated = new api.AuthErasureRecoveryJournal(isolated.store, 'lost-put-test', 'next-key', { ...isolated.keys, 'next-key': 'another-synthetic-secret-at-least-thirty-two-characters' });
      assert.equal((await rotated.completedIntents()).length, 1);
      const missingOldKey = new api.AuthErasureRecoveryJournal(isolated.store, 'lost-put-test', 'next-key', { 'next-key': 'another-synthetic-secret-at-least-thirty-two-characters' });
      await assert.rejects(() => missingOldKey.completedIntents(), /recovery evidence/);
    });
    await t.test('completion outage cannot report success; retry finishes without repeating deletion', async () => {
      const row = await make('completion-outage'), isolated = createJournal('completion-test');
      isolated.faults.complete = true;
      const perform = () => api.eraseReviewedAuthenticationData(request(), db, row.approval, isolated.journal);
      assert.equal((await perform()).status, 'recovery-pending');
      assert.equal(count('account_credentials', 'email', row.email), 0);
      await assert.rejects(() => isolated.journal.completedIntents(), /recovery evidence/);
      isolated.faults.complete = false;
      assert.equal((await perform()).status, 'already-erased');
      assert.equal((await isolated.journal.completedIntents()).length, 1);
      const intentKey = [...isolated.objects.keys()].find(key => key.endsWith('/intent.json'));
      isolated.objects.delete(intentKey);
      assert.equal((await perform()).status, 'recovery-pending');
      assert.equal(isolated.objects.has(intentKey), false, 'retry must not fabricate missing prior evidence');
    });
    await t.test('lost database acknowledgement reconciles the receipt on retry', async () => {
      const row = await make('lost-db-reply'), isolated = createJournal('lost-db-test');
      const perform = () => api.eraseReviewedAuthenticationData(request(), db, row.approval, isolated.journal);
      state.afterWrite = () => { throw Error('Synthetic lost database reply'); };
      await assert.rejects(perform, /lost database reply/);
      assert.equal(count('account_credentials', 'email', row.email), 0);
      await assert.rejects(() => isolated.journal.completedIntents(), /recovery evidence/);
      assert.equal((await perform()).status, 'already-erased');
      assert.equal((await isolated.journal.completedIntents()).length, 1);
      assert.equal(count('privacy_auth_erasure_records', 'request_id', row.approval.requestId), 1);
    });
    await t.test('old backup replay validates all evidence and atomically keeps erased accounts closed', async recoveryTest => {
      const target = await make('restore-target', false), other = await make('restore-other', false);
      const captured = new Map(api.AUTH_ERASURE_TABLES.map(table => [table, database.prepare(`SELECT * FROM ${table} WHERE email IN (?, ?)${table === 'phone_login_codes' ? ' OR phone_e164 IN (?, ?)' : ''}`).all(target.email, other.email, ...(table === 'phone_login_codes' ? [target.phone, other.phone] : []))]));
      seed('account_closures', { email: target.email, privacy_request_id: target.approval.requestId, case_reference: 'CASE-restore-target', review_after: '2099-01-01' });
      seed('privacy_access_closure_reviews', { request_id: target.approval.requestId, reviewed_by: 'owner@example.invalid', scope: 'whole-account-access', case_reference: 'CASE-restore-target', review_after: '2099-01-01', retention_notes: 'Synthetic separate review.', snapshot_digest: 'a'.repeat(64) });
      target.approval.reviewToken = (await api.previewAuthenticationErasure(db, target.approval.requestId)).reviewToken;
      const isolated = createJournal('restore-test');
      assert.equal((await api.eraseReviewedAuthenticationData(request(), db, target.approval, isolated.journal)).status, 'erased');
      const restored = new DatabaseSync(':memory:');
      const currentSource = new DatabaseSync(':memory:');
      try {
        for (const entry of JSON.parse(readFileSync(join(repo, 'drizzle/meta/_journal.json'), 'utf8')).entries) restored.exec(readFileSync(join(repo, 'drizzle', entry.tag + '.sql'), 'utf8'));
        for (const [table, rows] of captured) for (const row of rows) seed(table, { ...row }, restored);
        // A separate source snapshot for this synthetic catalog. It contains only
        // this isolated journal's actual receipt and matching closure.
        for (const table of ['privacy_auth_erasure_records', 'account_closures']) {
          currentSource.exec(database.prepare("SELECT sql FROM sqlite_schema WHERE type='table' AND name=?").get(table).sql);
          const column = table === 'account_closures' ? 'privacy_request_id' : 'request_id';
          seed(table, { ...database.prepare(`SELECT * FROM ${table} WHERE ${column}=?`).get(target.approval.requestId) }, currentSource);
        }
        const sourceDb = { prepare(sql) { return { async all() { return { success: true, results: currentSource.prepare(sql).all() }; } }; } };
        let writes = 0;
        const restoreDb = {
          prepare(sql) { let values = []; return { bind(...params) { values = params; return this; }, async first() { return restored.prepare(sql).get(...values) ?? null; }, execute() { writes++; return { meta: { changes: Number(restored.prepare(sql).run(...values).changes) } }; } }; },
          async batch(statements) { restored.exec('BEGIN'); try { const result = statements.map(statement => statement.execute()); restored.exec('COMMIT'); return result; } catch (error) { restored.exec('ROLLBACK'); throw error; } },
        };
        const review = { isolatedRestoreConfirmed: true, sourceWritesPausedConfirmed: true, recoveryCaseReference: 'RESTORE-SYNTHETIC-CASE' };
        const replay = () => api.replayAuthenticationErasures(request(), restoreDb, isolated.journal, review, sourceDb);
        await assert.rejects(() => api.replayAuthenticationErasures(request(), restoreDb, isolated.journal, { ...review, sourceWritesPausedConfirmed: false }, sourceDb), /paused source writes/);
        const intentKey = [...isolated.objects.keys()].find(key => key.endsWith('/intent.json'));
        const completeKey = [...isolated.objects.keys()].find(key => key.endsWith('/complete.json'));
        const original = isolated.objects.get(intentKey), completion = isolated.objects.get(completeKey);
        await recoveryTest.test('missing source, unavailable source and an empty journal cannot authorize replay', async () => {
          await assert.rejects(() => api.replayAuthenticationErasures(request(), restoreDb, isolated.journal, review), /separate current source/);
          await assert.rejects(() => api.replayAuthenticationErasures(request(), restoreDb, isolated.journal, review, restoreDb), /separate current source/);
          await assert.rejects(() => api.replayAuthenticationErasures(request(), restoreDb, isolated.journal, review, {
            prepare() { throw Error('Synthetic source unavailable'); },
          }), /source unavailable/);
          const list = isolated.store.list;
          isolated.store.list = async () => ({ objects: [], truncated: false });
          try { await assert.rejects(replay, /source and recovery catalog/); }
          finally { isolated.store.list = list; }
          assert.equal(writes, 0);
        });
        await recoveryTest.test('stale source metadata and missing closure evidence block all restore writes', async () => {
          currentSource.exec('BEGIN');
          currentSource.prepare('UPDATE privacy_auth_erasure_records SET case_reference=?').run('OTHER-REVIEW-CASE');
          await assert.rejects(replay, /source and recovery catalog/);
          currentSource.exec('ROLLBACK; BEGIN');
          currentSource.exec('DELETE FROM account_closures');
          await assert.rejects(replay, /source and recovery catalog/);
          currentSource.exec('ROLLBACK');
          assert.equal(writes, 0);
        });
        const tampered = JSON.parse(original); tampered.body.intent.email = other.email;
        isolated.objects.set(intentKey, JSON.stringify(tampered));
        await assert.rejects(replay, /recovery evidence/); assert.equal(writes, 0);
        tampered.keyId = '__proto__';
        tampered.signature = createHmac('sha256', '[object Object]').update(JSON.stringify(tampered.body)).digest('hex');
        isolated.objects.set(intentKey, JSON.stringify(tampered));
        await assert.rejects(replay, /recovery evidence/); assert.equal(writes, 0);
        isolated.objects.set(intentKey, original); isolated.objects.delete(completeKey);
        await assert.rejects(replay, /recovery evidence/); assert.equal(writes, 0);
        isolated.objects.set(completeKey, completion);
        restored.exec("CREATE TRIGGER synthetic_restore_failure BEFORE DELETE ON passkey_credentials BEGIN SELECT RAISE(ABORT,'synthetic restore failure'); END");
        await assert.rejects(replay, /synthetic restore failure/);
        assert.equal(restored.prepare('SELECT count(*) n FROM auth_sessions WHERE email=?').get(target.email).n, 2);
        assert.equal(restored.prepare('SELECT count(*) n FROM account_closures').get().n, 0);
        restored.exec('DROP TRIGGER synthetic_restore_failure');
        assert.equal((await replay()).trafficMayOpen, false);
        for (const table of api.AUTH_ERASURE_TABLES) assert.equal(restored.prepare(`SELECT count(*) n FROM ${table} WHERE email=?`).get(target.email).n, 0, table);
        assert.equal(restored.prepare('SELECT count(*) n FROM phone_login_codes WHERE phone_e164=?').get(target.phone).n, 0);
        assert.equal(restored.prepare('SELECT count(*) n FROM account_credentials WHERE email=?').get(other.email).n, 1);
        assert.equal(restored.prepare('SELECT count(*) n FROM auth_sessions WHERE email=?').get(other.email).n, 2);
        assert.equal(restored.prepare('SELECT count(*) n FROM account_closures WHERE email=?').get(target.email).n, 1);
        assert.throws(() => seed('account_credentials', { email: target.email }, restored), /Account access is closed/);
        assert.equal((await replay()).replayed, 1);
        await recoveryTest.test('source and journal changes during replay prevent a success result', async () => {
          const batch = restoreDb.batch;
          currentSource.exec('BEGIN');
          restoreDb.batch = async statements => {
            const result = await batch(statements);
            currentSource.prepare('UPDATE privacy_auth_erasure_records SET recovery_reference=?').run('CHANGED-DURING-REPLAY');
            return result;
          };
          try { await assert.rejects(replay, /source and recovery catalog/); }
          finally { currentSource.exec('ROLLBACK'); restoreDb.batch = batch; }
          restoreDb.batch = async statements => {
            const result = await batch(statements);
            isolated.objects.delete(intentKey); isolated.objects.delete(completeKey);
            return result;
          };
          try { await assert.rejects(replay, /source and recovery catalog/); }
          finally { isolated.objects.set(intentKey, original); isolated.objects.set(completeKey, completion); restoreDb.batch = batch; }
          assert.equal((await replay()).trafficMayOpen, false);
        });
      } finally { restored.close(); currentSource.close(); }
    });
    await t.test('catalog pagination loops and unresolved intents fail closed', async () => {
      await assert.rejects(() => recovery.journal.completedIntents(), /recovery evidence/, 'race intents remain unresolved');
      const isolated = createJournal('pagination-test');
      isolated.store.list = async () => ({ objects: [], truncated: true, cursor: 'same-page' });
      await assert.rejects(() => isolated.journal.completedIntents(), /recovery evidence/);
      let page = 0;
      isolated.store.list = async () => ({ objects: [], truncated: true, cursor: `page-${++page}` });
      await assert.rejects(() => isolated.journal.completedIntents(), /recovery evidence/);
      assert.equal(page, 100);
    });
  } finally { globalThis.fetch = oldFetch; delete globalThis.__erasureFixture; database.close(); rmSync(scratch, { recursive: true, force: true }); }
});
