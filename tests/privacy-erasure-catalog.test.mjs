import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { assertAuthenticationCatalogMatches, assertCurrentAuthenticationCatalog } from '../lib/privacy-erasure-catalog.ts';

const intent = index => ({ requestId: `synthetic-${index}`, email: `person-${index}@example.invalid`,
  snapshotDigest: String(index % 10).repeat(64), approvedBy: 'owner@example.invalid',
  caseReference: 'SYNTHETIC-CASE', recoveryReference: 'SYNTHETIC-RESTORE',
  closureCaseReference: 'SYNTHETIC-CLOSURE', closedAt: '2026-10-09 12:00:00', reviewAfter: '2099-01-01' });

test('independent catalog requires exact membership and case metadata regardless of list order', () => {
  const first = intent(1), second = intent(2);
  assertAuthenticationCatalogMatches([first, second], [second, first]);
  for (const rows of [[], [first], [first, first], [first, second, intent(3)]]) {
    assert.throws(() => assertAuthenticationCatalogMatches([first, second], rows), /source and recovery catalog/);
  }
  for (const field of Object.keys(first)) {
    assert.throws(() => assertAuthenticationCatalogMatches([first], [{ ...first, [field]: 'changed' }]), /source and recovery catalog/, field);
  }
});

test('actual SQL exposes missing closures and bounds the source catalog without hiding overflow', async () => {
  const database = new DatabaseSync(':memory:');
  database.exec(`CREATE TABLE privacy_auth_erasure_records (request_id TEXT PRIMARY KEY, snapshot_digest TEXT,
    approved_by TEXT, case_reference TEXT, recovery_reference TEXT, scope TEXT);
    CREATE TABLE account_closures (privacy_request_id TEXT, email TEXT PRIMARY KEY, case_reference TEXT,
    closed_at TEXT, review_after TEXT);`);
  const source = { prepare(sql) { return { async all() { return { success: true, results: database.prepare(sql).all() }; } }; } };
  const add = row => {
    database.prepare('INSERT INTO privacy_auth_erasure_records VALUES (?,?,?,?,?,?)').run(row.requestId, row.snapshotDigest, row.approvedBy, row.caseReference, row.recoveryReference, 'authentication-records');
    database.prepare('INSERT INTO account_closures VALUES (?,?,?,?,?)').run(row.requestId, row.email, row.closureCaseReference, row.closedAt, row.reviewAfter);
  };
  try {
    await assertCurrentAuthenticationCatalog(source, []);
    const rows = Array.from({ length: 100 }, (_, index) => intent(index)); rows.forEach(add);
    await assertCurrentAuthenticationCatalog(source, rows);
    await assert.rejects(() => assertCurrentAuthenticationCatalog(source, rows.slice(1)), /source and recovery catalog/);
    add(intent(100));
    await assert.rejects(() => assertCurrentAuthenticationCatalog(source, rows), /source and recovery catalog/);
    database.exec("DELETE FROM privacy_auth_erasure_records WHERE request_id='synthetic-100'; DELETE FROM account_closures WHERE privacy_request_id='synthetic-100';");
    database.exec("DELETE FROM account_closures WHERE privacy_request_id='synthetic-0';");
    await assert.rejects(() => assertCurrentAuthenticationCatalog(source, rows), /source and recovery catalog/);
  } finally { database.close(); }
});

test('failed or malformed source read never counts as an empty source', async () => {
  for (const result of [{ success: false, results: [] }, { success: true }, { success: true, results: [{ ...intent(1), scope: 'other' }] }]) {
    await assert.rejects(() => assertCurrentAuthenticationCatalog({ prepare: () => ({ all: async () => result }) }, []), /source and recovery catalog/);
  }
});
