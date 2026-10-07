import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { build } from 'esbuild';

test('scoped authentication erasure uses migrated synthetic records only', async t => {
  const repo = resolve(import.meta.dirname, '..'), scratch = mkdtempSync(join(tmpdir(), 'tuveloz-auth-erasure-'));
  const database = new DatabaseSync(':memory:');
  const state = { owner: true, beforeWrite: null, queries: 0 };
  const oldFetch = globalThis.fetch;
  globalThis.__erasureFixture = state;
  const db = { prepare(sql) {
    state.queries++;
    let values = [];
    return { bind(...params) { values = params; return this; },
      async first() { return database.prepare(sql).get(...values) ?? null; },
      async run() { if (state.beforeWrite) { const fn = state.beforeWrite; state.beforeWrite = null; fn(); }
        return { meta: { changes: Number(database.prepare(sql).run(...values).changes) } }; } };
  } };
  const seed = (table, values) => {
    for (const column of database.prepare(`PRAGMA table_info(${table})`).all()) {
      if ((column.notnull || column.pk) && column.dflt_value === null && !(column.name in values)) {
        values[column.name] = /INT/.test(column.type) ? 1 : `SECRET-${column.name}-${values.id || values.email}`;
      }
    }
    const names = Object.keys(values);
    database.prepare(`INSERT INTO ${table} (${names.join(',')}) VALUES (${names.map(() => '?').join(',')})`).run(...Object.values(values));
  };
  try {
    globalThis.fetch = async () => { throw Error('External requests forbidden'); };
    for (const entry of JSON.parse(readFileSync(join(repo, 'drizzle/meta/_journal.json'), 'utf8')).entries) database.exec(readFileSync(join(repo, 'drizzle', entry.tag + '.sql'), 'utf8'));
    const bundle = join(scratch, 'engine.cjs');
    await build({ absWorkingDir: repo, stdin: { contents: 'export * from "./lib/privacy-auth-erasure";', resolveDir: repo, loader: 'ts' }, bundle: true, platform: 'node', format: 'cjs', outfile: bundle, logLevel: 'silent', plugins: [{ name: 'owner-fixture', setup(builder) {
      builder.onResolve({ filter: /\/owner-auth$/ }, args => ({ path: args.path, namespace: 'fixture' }));
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ loader: 'js', contents: 'export const verifyOwnerRequest=async()=>globalThis.__erasureFixture.owner?{ok:true,email:"owner@example.invalid"}:{ok:false};' }));
    } }] });
    const api = createRequire(import.meta.url)(bundle);
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
    const erase = approval => api.eraseReviewedAuthenticationData(request(), db, approval);
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
      assert.equal((await api.eraseReviewedAuthenticationData(request('https://other.invalid'), db, closed.approval)).status, 'forbidden');
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
  } finally { globalThis.fetch = oldFetch; delete globalThis.__erasureFixture; database.close(); rmSync(scratch, { recursive: true, force: true }); }
});
