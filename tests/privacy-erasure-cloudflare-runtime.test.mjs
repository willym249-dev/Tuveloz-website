import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';

// Local workerd only: ephemeral D1/R2, no Cloudflare account, remote bindings,
// deploy config, external requests or real records. Owner identity is a fixture;
// production Access authentication is covered separately.
test('authentication erasure and recovery run through local Cloudflare D1 and R2', { timeout: 120000 }, async t => {
  const repo = resolve(import.meta.dirname, '..'), schema = new DatabaseSync(':memory:');
  let runtime;
  try {
    for (const entry of JSON.parse(readFileSync(join(repo, 'drizzle/meta/_journal.json'), 'utf8')).entries) schema.exec(readFileSync(join(repo, 'drizzle', entry.tag + '.sql'), 'utf8'));
    const definitions = schema.prepare("SELECT sql FROM sqlite_schema WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' ORDER BY CASE type WHEN 'table' THEN 0 WHEN 'index' THEN 1 ELSE 2 END, name").all();
    const compiled = await build({ absWorkingDir: repo, stdin: { resolveDir: repo, loader: 'ts', contents: `
      import { previewAuthenticationErasure, eraseReviewedAuthenticationData, confirmExistingAuthenticationErasure } from './lib/privacy-auth-erasure';
      import { AuthErasureRecoveryJournal } from './lib/privacy-erasure-recovery';
      import { replayAuthenticationErasures } from './lib/privacy-erasure-replay';
      import { POST as closeAccess } from './app/api/admin/privacy-requests/close-access/route';
      import { PRIVACY_CLOSURE_PREVIEW_SQL } from './lib/privacy-closure-preview';
      import { privacyReviewToken } from './lib/privacy-access-closure';
      export default { async fetch(request, env) {
        try {
          const path = new URL(request.url).pathname;
          if (path === '/close-access') return closeAccess(request);
          const input = await request.json();
          const journal = new AuthErasureRecoveryJournal(env.JOURNAL, 'local-runtime-only', 'fixture-key', { 'fixture-key': env.FIXTURE_KEY });
          let result;
          if (path === '/preview') result = await previewAuthenticationErasure(env.SOURCE, input.requestId);
          else if (path === '/closure-preview') result = { token: await privacyReviewToken((await env.SOURCE.prepare(PRIVACY_CLOSURE_PREVIEW_SQL).bind(input.requestId).all()).results) };
          else if (path === '/erase') result = await eraseReviewedAuthenticationData(request, env.SOURCE, input, journal);
          else if (path === '/confirm-existing') result = await confirmExistingAuthenticationErasure(request, env.SOURCE, input, journal);
          else if (path === '/replay') result = await replayAuthenticationErasures(request, env.RESTORE, journal, input, env.SOURCE);
          else if (path === '/catalog') result = { count: (await journal.completedIntents()).length };
          else return new Response('Unknown fixture operation', { status: 404 });
          return Response.json(result);
        } catch (error) { return Response.json({ error: String(error.message) }, { status: 409 }); }
      } };
    ` }, bundle: true, platform: 'browser', format: 'esm', external: ['cloudflare:workers'], write: false, logLevel: 'silent', plugins: [{ name: 'synthetic-owner', setup(builder) {
      builder.onResolve({ filter: /\/owner-auth$/ }, args => ({ path: args.path, namespace: 'fixture' }));
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ loader: 'js', contents: `export const verifyOwnerRequest=async request=>request.headers.get('x-fixture-owner')==='yes'?{ok:true,email:'owner@example.invalid'}:{ok:false};` }));
    } }] });
    runtime = new Miniflare(convertV4MiniflareOptions({ host: '127.0.0.1', port: 0, workers: [{ name: 'local-recovery-fixture', modules: true, script: compiled.outputFiles[0].text, compatibilityDate: '2026-07-27',
      d1Databases: { SOURCE: 'SOURCE', DB: 'SOURCE', RESTORE: 'RESTORE' }, r2Buckets: ['JOURNAL'],
      bindings: { FIXTURE_KEY: randomBytes(32).toString('hex') },
      outboundService: () => { throw Error('External traffic forbidden in recovery test'); } }] }));
    const source = await runtime.getD1Database('SOURCE'), restore = await runtime.getD1Database('RESTORE'), bucket = await runtime.getR2Bucket('JOURNAL');
    for (const connection of [source, restore]) {
      for (let i = 0; i < definitions.length; i += 25) await connection.batch(definitions.slice(i, i + 25).map(row => connection.prepare(row.sql)));
    }
    const seed = async (connection, table, data) => {
      const values = { ...data };
      for (const column of schema.prepare(`PRAGMA table_info(${table})`).all()) if ((column.notnull || column.pk) && column.dflt_value === null && !(column.name in values)) values[column.name] = /INT/.test(column.type) ? 1 : `SYNTHETIC-${column.name}-${values.id || values.email}`;
      const names = Object.keys(values);
      await connection.prepare(`INSERT INTO ${table} (${names.join(',')}) VALUES (${names.map(() => '?').join(',')})`).bind(...Object.values(values)).run();
    };
    const call = async (path, data = {}, headers = {}) => {
      const response = await runtime.dispatchFetch('https://tuveloz.invalid' + path, { method: 'POST', headers: { origin: 'https://tuveloz.invalid', 'content-type': 'application/json', 'x-fixture-owner': 'yes', ...headers }, body: JSON.stringify(data) });
      return { status: response.status, body: await response.json() };
    };
    const count = async (connection, table, email) => (await connection.prepare(`SELECT count(*) n FROM ${table} WHERE email=?`).bind(email).first()).n;
    const target = 'runtime-erased@example.invalid', other = 'runtime-other@example.invalid', id = 'runtime-privacy-request';
    // The restore snapshot predates the privacy request and closure.
    for (const connection of [source, restore]) for (const [email, phone] of [[target, '+12025550101'], [other, '+12025550102']]) {
      await seed(connection, 'account_credentials', { email });
      await seed(connection, 'account_phone_numbers', { email, phone_e164: phone });
      await seed(connection, 'phone_login_codes', { id: email, email: '', phone_e164: phone, purpose: 'signin' });
      await seed(connection, 'password_verification_codes', { id: email, email, role: 'customer', purpose: 'reset' });
      for (const role of ['customer', 'provider']) for (const table of ['auth_sessions', 'login_codes', 'passkey_credentials']) await seed(connection, table, { id: email + role, email, role });
    }
    await seed(source, 'privacy_requests', { id, email: target, role: 'customer', request_type: 'account-closure', identity_source: 'signed-in-account' });
    await seed(source, 'account_closures', { email: target, privacy_request_id: id, case_reference: 'RUNTIME-CLOSURE', review_after: '2099-01-01' });
    await seed(source, 'privacy_access_closure_reviews', { request_id: id, reviewed_by: 'owner@example.invalid', scope: 'whole-account-access', case_reference: 'RUNTIME-CLOSURE', review_after: '2099-01-01', retention_notes: 'Synthetic runtime test only.', snapshot_digest: 'a'.repeat(64) });
    const preview = await call('/preview', { requestId: id });
    assert.equal(preview.status, 200); assert.equal(preview.body.eligible, true);
    const approval = { requestId: id, reviewToken: preview.body.reviewToken, caseReference: 'RUNTIME-ERASURE', recoveryReference: 'RUNTIME-RECOVERY', confirmAuthenticationOnly: true, confirmRetentionReviewed: true, confirmRecoveryRecorded: true };
    const review = { isolatedRestoreConfirmed: true, sourceWritesPausedConfirmed: true, recoveryCaseReference: 'RUNTIME-RESTORE' };

    await t.test('published closure action reports success when revocation triggers remove sessions', async () => {
      const closureId = 'runtime-access-closure', email = 'runtime-closure@example.invalid';
      await seed(source, 'privacy_requests', { id: closureId, email, role: 'customer', request_type: 'account-closure', identity_source: 'signed-in-account' });
      await seed(source, 'auth_sessions', { id: closureId, email, role: 'customer' });
      await seed(source, 'login_codes', { id: closureId, email, role: 'customer' });
      const closurePreview = await call('/closure-preview', { requestId: closureId });
      assert.equal(closurePreview.status, 200, JSON.stringify(closurePreview.body));
      const { token } = closurePreview.body;
      assert.match(token, /^[a-f0-9]{64}$/);
      const input = { id: closureId, caseReference: 'RUNTIME-ACCESS-CLOSURE', reviewAfter: '2099-01-01', retentionNotes: 'Synthetic closure retention review only.', reviewToken: token, confirmWholeAccount: true, confirmIdentityAndAuthority: true, confirmRetainedDataReview: true };
      const closed = await call('/close-access', input);
      assert.equal(closed.status, 200, JSON.stringify(closed.body));
      assert.equal(closed.body.accessClosed, true); assert.equal(closed.body.alreadyClosed, false);
      assert.equal(await count(source, 'auth_sessions', email), 0);
      assert.ok((await source.prepare('SELECT used_at FROM login_codes WHERE email=?').bind(email).first()).used_at);
      assert.equal((await source.prepare('SELECT count(*) n FROM privacy_access_closure_reviews WHERE request_id=?').bind(closureId).first()).n, 1);
      assert.equal((await call('/close-access', input)).body.alreadyClosed, true);
    });
    await t.test('D1 deletion and R2 journal completion agree on success', async () => {
      const missing = await call('/confirm-existing', { ...approval, confirmCompletionOnly: true });
      assert.equal(missing.body.status, 'receipt-missing');
      assert.equal(await count(source, 'account_credentials', target), 1);
      assert.equal((await bucket.list()).objects.length, 0);
      assert.equal((await call('/erase', approval, { 'x-fixture-owner': 'no' })).body.status, 'forbidden');
      const erased = await call('/erase', approval);
      assert.equal(erased.status, 200); assert.equal(erased.body.status, 'erased');
      assert.equal(await count(source, 'account_credentials', target), 0);
      assert.equal(await count(source, 'account_credentials', other), 1);
      assert.equal((await call('/catalog')).body.count, 1);
      assert.equal((await call('/erase', approval)).body.status, 'already-erased');
    });
    await t.test('confirmation-only recovery restores only the missing R2 acknowledgement', async () => {
      const objects = (await bucket.list()).objects;
      const completeKey = objects.find(object => object.key.endsWith('/complete.json')).key;
      const intentKey = objects.find(object => object.key.endsWith('/intent.json')).key;
      const intentBefore = await (await bucket.get(intentKey)).text();
      const sourceBefore = await source.prepare('SELECT * FROM privacy_auth_erasure_records ORDER BY request_id').all();
      await bucket.delete(completeKey);
      assert.equal((await call('/catalog')).status, 409);
      const confirmed = await call('/confirm-existing', { ...approval, confirmCompletionOnly: true });
      assert.deepEqual(confirmed.body, { status: 'completion-confirmed', completesPrivacyRequest: false, trafficMayOpen: false });
      assert.equal((await call('/catalog')).body.count, 1);
      assert.equal(await (await bucket.get(intentKey)).text(), intentBefore);
      assert.deepEqual((await source.prepare('SELECT * FROM privacy_auth_erasure_records ORDER BY request_id').all()).results, sourceBefore.results);
      assert.equal(await count(source, 'account_credentials', target), 0);
      assert.equal(await count(source, 'account_credentials', other), 1);
      assert.equal((await call('/confirm-existing', { ...approval, confirmCompletionOnly: true })).body.status, 'completion-confirmed');
    });
    await t.test('missing R2 catalog cannot hide a completed source deletion', async () => {
      const objects = (await bucket.list()).objects;
      const saved = await Promise.all(objects.map(async object => [object.key, await (await bucket.get(object.key)).text()]));
      try {
        await bucket.delete(objects.map(object => object.key));
        const response = await call('/replay', review);
        assert.equal(response.status, 409);
        assert.match(response.body.error, /source and recovery catalog/);
        assert.equal(await count(restore, 'account_credentials', target), 1);
        assert.equal(await count(restore, 'account_closures', target), 0);
      } finally { for (const [key, body] of saved) await bucket.put(key, body); }
    });
    await t.test('R2 conditional writes preserve existing signed evidence', async () => {
      const objects = (await bucket.list()).objects;
      assert.equal(objects.length, 2);
      const key = objects.find(object => object.key.endsWith('/intent.json')).key;
      const original = await (await bucket.get(key)).text();
      const overwrite = await bucket.put(key, 'replacement rejected', { onlyIf: { etagDoesNotMatch: '*' } });
      assert.equal(overwrite, null);
      assert.equal(await (await bucket.get(key)).text(), original);
      await bucket.put(key, 'corrupt synthetic record');
      assert.equal((await call('/replay', review)).status, 409);
      assert.equal(await count(restore, 'account_credentials', target), 1);
      assert.equal(await count(restore, 'account_closures', target), 0);
      await bucket.put(key, original);
    });
    await t.test('D1 batch rollback and successful replay keep account isolation', async () => {
      await restore.prepare("CREATE TRIGGER synthetic_runtime_failure BEFORE DELETE ON passkey_credentials BEGIN SELECT RAISE(ABORT, 'synthetic runtime failure'); END").run();
      assert.equal((await call('/replay', review)).status, 409);
      assert.equal(await count(restore, 'auth_sessions', target), 2);
      assert.equal(await count(restore, 'account_closures', target), 0);
      await restore.prepare('DROP TRIGGER synthetic_runtime_failure').run();
      await restore.prepare("CREATE TRIGGER synthetic_ignore_passkey BEFORE DELETE ON passkey_credentials BEGIN SELECT RAISE(IGNORE); END").run();
      await restore.prepare("CREATE TRIGGER synthetic_ignore_phone BEFORE DELETE ON phone_login_codes BEGIN SELECT RAISE(IGNORE); END").run();
      const incomplete = await call('/replay', review);
      assert.equal(incomplete.status, 409);
      assert.match(incomplete.body.error, /Recovery verification failed/);
      assert.equal(await count(restore, 'passkey_credentials', target), 2);
      assert.equal(await count(restore, 'account_phone_numbers', target), 1, 'retain association so retry can remove anonymous codes');
      assert.equal((await restore.prepare('SELECT count(*) n FROM phone_login_codes WHERE phone_e164=?').bind('+12025550101').first()).n, 1);
      assert.equal(await count(restore, 'account_credentials', other), 1);
      await restore.prepare('DROP TRIGGER synthetic_ignore_passkey').run();
      const phoneOnly = await call('/replay', review);
      assert.equal(phoneOnly.status, 409, 'remaining anonymous codes alone must prevent success');
      assert.match(phoneOnly.body.error, /Recovery verification failed/);
      assert.equal(await count(restore, 'passkey_credentials', target), 0);
      await restore.prepare('DROP TRIGGER synthetic_ignore_phone').run();
      const replayed = await call('/replay', review);
      assert.equal(replayed.status, 200); assert.equal(replayed.body.replayed, 1); assert.equal(replayed.body.trafficMayOpen, false);
      for (const table of ['auth_sessions', 'login_codes', 'passkey_credentials', 'password_verification_codes', 'account_credentials', 'account_phone_numbers']) assert.equal(await count(restore, table, target), 0, table);
      assert.equal((await restore.prepare('SELECT count(*) n FROM phone_login_codes WHERE phone_e164=?').bind('+12025550101').first()).n, 0);
      assert.equal(await count(restore, 'account_credentials', other), 1);
      await assert.rejects(() => seed(restore, 'account_credentials', { email: target }), /Account access is closed/);
      assert.equal((await call('/replay', review)).body.replayed, 1);
    });
  } finally { if (runtime) await runtime.dispose(); schema.close(); }
});
