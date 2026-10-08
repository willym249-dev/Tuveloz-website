import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { build } from 'esbuild';

// Offline preparation only. Does not create resources, authenticate or deploy.
export async function buildPrivacyRehearsal() {
  const repo = resolve(import.meta.dirname, '..'), db = new DatabaseSync(':memory:');
  try {
    for (const entry of JSON.parse(readFileSync(join(repo, 'drizzle/meta/_journal.json'), 'utf8')).entries) db.exec(readFileSync(join(repo, 'drizzle', entry.tag + '.sql'), 'utf8'));
    const schema = db.prepare("SELECT sql FROM sqlite_schema WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' ORDER BY CASE type WHEN 'table' THEN 0 WHEN 'index' THEN 1 ELSE 2 END, name").all().map(row => row.sql);
    const common = [], source = [];
    function seed(destination, table, data) {
      const row = { ...data };
      for (const column of db.prepare(`PRAGMA table_info(${table})`).all()) if ((column.notnull || column.pk) && column.dflt_value === null && !(column.name in row)) row[column.name] = /INT/.test(column.type) ? 1 : `SYNTHETIC-${column.name}-${row.id || row.email}`;
      const names = Object.keys(row);
      destination.push({ sql: `INSERT INTO ${table} (${names.join(',')}) VALUES (${names.map(() => '?').join(',')})`, values: Object.values(row) });
    }
    for (const [email, phone] of [['rehearsal-erased@example.invalid', '+12025550101'], ['rehearsal-other@example.invalid', '+12025550102']]) {
      seed(common, 'account_credentials', { email });
      seed(common, 'account_phone_numbers', { email, phone_e164: phone });
      seed(common, 'phone_login_codes', { id: email, email: '', phone_e164: phone, purpose: 'signin' });
      seed(common, 'password_verification_codes', { id: email, email, role: 'customer', purpose: 'reset' });
      for (const role of ['customer', 'provider']) for (const table of ['auth_sessions', 'login_codes', 'passkey_credentials']) seed(common, table, { id: email + role, email, role });
    }
    const id = 'synthetic-recovery-20261008', email = 'rehearsal-erased@example.invalid';
    seed(source, 'privacy_requests', { id, email, role: 'customer', request_type: 'account-closure', identity_source: 'signed-in-account' });
    seed(source, 'account_closures', { email, privacy_request_id: id, case_reference: 'SYNTHETIC-CLOSURE', review_after: '2099-01-01' });
    seed(source, 'privacy_access_closure_reviews', { request_id: id, reviewed_by: 'owner@example.invalid', scope: 'whole-account-access', case_reference: 'SYNTHETIC-CLOSURE', review_after: '2099-01-01', retention_notes: 'Synthetic rehearsal only.', snapshot_digest: 'a'.repeat(64) });
    const result = await build({ absWorkingDir: repo, entryPoints: ['rehearsal-worker/privacy-recovery.ts'], bundle: true, platform: 'browser', format: 'esm', write: false, logLevel: 'silent',
      define: { REHEARSAL_SCHEMA: JSON.stringify(schema), REHEARSAL_ROWS: JSON.stringify({ common, source }) },
      plugins: [{ name: 'isolated-synthetic-owner-only', setup(builder) {
        builder.onResolve({ filter: /\/owner-auth$/ }, args => ({ path: args.path, namespace: 'fixture' }));
        builder.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ loader: 'js', contents: "export const verifyOwnerRequest=async()=>({ok:true,email:'owner@example.invalid'});" }));
      } }] });
    return result.outputFiles[0].text;
  } finally { db.close(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const destination = resolve(import.meta.dirname, 'outputs/privacy-recovery.mjs');
  mkdirSync(resolve(import.meta.dirname, 'outputs'), { recursive: true });
  writeFileSync(destination, await buildPrivacyRehearsal());
  process.stdout.write('Prepared synthetic recovery Worker locally; no deployment performed.\n');
}
