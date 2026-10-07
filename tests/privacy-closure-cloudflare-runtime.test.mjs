import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';

test('owner closure preview and action work in local Cloudflare D1', { timeout: 120000 }, async () => {
  const repo = resolve(import.meta.dirname, '..'), schema = new DatabaseSync(':memory:');
  let runtime;
  try {
    for (const entry of JSON.parse(readFileSync(join(repo, 'drizzle/meta/_journal.json'), 'utf8')).entries) schema.exec(readFileSync(join(repo, 'drizzle', entry.tag + '.sql'), 'utf8'));
    const definitions = schema.prepare("SELECT sql FROM sqlite_schema WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' ORDER BY CASE type WHEN 'table' THEN 0 WHEN 'index' THEN 1 ELSE 2 END, name").all();
    const compiled = await build({ absWorkingDir: repo, stdin: { resolveDir: repo, loader: 'ts', contents: `
      import { POST } from './app/api/admin/privacy-requests/close-access/route';
      import { GET } from './app/api/admin/privacy-requests/closure-preview/route';
      export default { async fetch(request) {
        return request.method === 'GET' ? GET(request) : POST(request);
      } };
    ` }, bundle: true, platform: 'browser', format: 'esm', external: ['cloudflare:workers'], write: false, logLevel: 'silent', plugins: [{ name: 'synthetic-owner', setup(builder) {
      builder.onResolve({ filter: /\/owner-auth$/ }, args => ({ path: args.path, namespace: 'fixture' }));
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ loader: 'js', contents: `
        export const verifyOwnerRequest=async request=>request.headers.get('x-fixture-owner')==='yes'?{ok:true,email:'owner@example.invalid'}:{ok:false};
        export const isVerifiedOwnerRequest=async request=>(await verifyOwnerRequest(request)).ok;
      ` }));
    } }] });
    // Only ephemeral local storage. No remote bindings or deploy configuration.
    // Production Access identity is tested separately; this fixture supplies it.
    runtime = new Miniflare(convertV4MiniflareOptions({ host: '127.0.0.1', port: 0, workers: [{ name: 'local-closure-fixture', modules: true,
      script: compiled.outputFiles[0].text, compatibilityDate: '2026-07-27', d1Databases: ['DB'],
      outboundService: () => { throw Error('External traffic forbidden'); } }] }));
    const db = await runtime.getD1Database('DB');
    for (let i = 0; i < definitions.length; i += 25) await db.batch(definitions.slice(i, i + 25).map(row => db.prepare(row.sql)));
    const seed = async (table, data) => {
      const values = { ...data };
      for (const column of schema.prepare(`PRAGMA table_info(${table})`).all()) if ((column.notnull || column.pk) && column.dflt_value === null && !(column.name in values)) values[column.name] = /INT/.test(column.type) ? 1 : `SYNTHETIC-${column.name}-${values.id || values.email}`;
      const names = Object.keys(values);
      await db.prepare(`INSERT INTO ${table} (${names.join(',')}) VALUES (${names.map(() => '?').join(',')})`).bind(...Object.values(values)).run();
    };
    const count = async (table, email) => (await db.prepare(`SELECT count(*) n FROM ${table} WHERE email=?`).bind(email).first()).n;
    const read = id => runtime.dispatchFetch('https://tuveloz.invalid/api/admin/privacy-requests/closure-preview?id=' + id, { headers: { origin: 'https://tuveloz.invalid', 'x-fixture-owner': 'yes' } });
    const close = input => runtime.dispatchFetch('https://tuveloz.invalid/api/admin/privacy-requests/close-access', { method: 'POST', headers: { origin: 'https://tuveloz.invalid', 'content-type': 'application/json', 'x-fixture-owner': 'yes' }, body: JSON.stringify(input) });
    const id = 'runtime-closure', email = 'runtime-closure@example.invalid', other = 'other@example.invalid';
    await seed('privacy_requests', { id, email, role: 'customer', request_type: 'account-closure', identity_source: 'signed-in-account' });
    for (const who of [email, other]) for (const role of ['customer', 'provider']) {
      await seed('auth_sessions', { id: who + role, email: who, role });
      await seed('login_codes', { id: who + role, email: who, role });
    }
    const response = await read(id);
    assert.equal(response.status, 200, await response.clone().text());
    const { preview } = await response.json();
    assert.equal(preview.accessClosureAllowed, true);
    assert.equal(preview.groups.find(group => group.id === 'access').sources.find(source => source.table === 'auth_sessions').recordCount, 2);
    assert.doesNotMatch(JSON.stringify(preview), /SYNTHETIC|runtime-closure@example|other@example/);
    const input = { id, caseReference: 'RUNTIME-ACCESS-CLOSURE', reviewAfter: '2099-01-01', retentionNotes: 'Synthetic closure retention review only.', reviewToken: preview.reviewToken, confirmWholeAccount: true, confirmIdentityAndAuthority: true, confirmRetainedDataReview: true };
    const closed = await close(input);
    assert.equal(closed.status, 200, await closed.clone().text());
    assert.equal((await closed.json()).alreadyClosed, false);
    assert.equal(await count('auth_sessions', email), 0);
    assert.equal(await count('auth_sessions', other), 2);
    assert.equal((await db.prepare('SELECT count(*) n FROM login_codes WHERE email=? AND used_at IS NULL').bind(email).first()).n, 0);
    assert.equal((await db.prepare('SELECT count(*) n FROM privacy_access_closure_reviews WHERE request_id=?').bind(id).first()).n, 1);
    const repeated = await close(input);
    assert.equal(repeated.status, 200); assert.equal((await repeated.json()).alreadyClosed, true);
    const stale = await close({ ...input, caseReference: 'DIFFERENT-REVIEW' });
    assert.equal(stale.status, 409);
    assert.equal((await read(id)).status, 200);
  } finally { if (runtime) await runtime.dispose(); schema.close(); }
});
