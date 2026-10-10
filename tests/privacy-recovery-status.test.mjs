import assert from 'node:assert/strict';
import test from 'node:test';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { createRequire } from 'node:module';
import { build } from 'esbuild';

test('owner recovery check reads private evidence without enabling deletion or exposing secrets', async t => {
  const scratch = mkdtempSync(join(tmpdir(), 'tuveloz-recovery-status-'));
  const state = { env: {}, owner: true, reads: 0, writes: 0, rows: [], dbFailure: false };
  globalThis.__recoveryStatus = state;
  const oldFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw Error('External traffic forbidden'); };
  try {
    const repo = resolve(import.meta.dirname, '..'), bundle = join(scratch, 'route.cjs');
    await build({ absWorkingDir: repo, stdin: { resolveDir: repo, loader: 'ts', contents: `
      export { GET } from './app/api/admin/privacy-requests/recovery-status/route';
      export { configuredPrivacyRecoveryJournal } from './lib/privacy-recovery-config';
    ` }, bundle: true, platform: 'node', format: 'cjs', outfile: bundle, logLevel: 'silent', plugins: [{ name: 'isolated-owner', setup(builder) {
      builder.onResolve({ filter: /^(cloudflare:workers)$|\/owner-auth$/ }, args => ({ path: args.path, namespace: 'fixture' }));
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ loader: 'js', contents: args.path === 'cloudflare:workers'
        ? 'export const env=globalThis.__recoveryStatus.env;'
        : 'export const isVerifiedOwnerRequest=async()=>globalThis.__recoveryStatus.owner;' }));
    } }] });
    const api = createRequire(import.meta.url)(bundle), objects = new Map();
    const store = {
      async get(key) { state.reads++; return objects.has(key) ? { text: async () => objects.get(key) } : null; },
      async put(key, body) { state.writes++; if (!objects.has(key)) objects.set(key, body); return {}; },
      async list({ prefix }) { state.reads++; return { objects: [...objects.keys()].filter(key => key.startsWith(prefix)).map(key => ({ key })), truncated: false }; },
    };
    const db = { prepare() { state.reads++; if (state.dbFailure) throw Error('PRIVATE database details must not escape');
      return { async all() { return { success: true, results: state.rows }; } }; } };
    const key = randomBytes(32).toString('hex');
    const configured = { DB: db, SITE_URL: 'https://tuveloz.com', BUCKET: {},
      PRIVACY_ERASURE_JOURNAL: store, PRIVACY_ERASURE_CONTEXT: 'tuveloz-production',
      PRIVACY_ERASURE_SIGNING_KEY_ID: 'current', PRIVACY_ERASURE_KEYS_JSON: JSON.stringify({ current: key }) };
    const reset = config => { for (const name of Object.keys(state.env)) delete state.env[name]; Object.assign(state.env, config); state.reads = 0; state.writes = 0; state.rows = []; objects.clear(); state.owner = true; state.dbFailure = false; };
    const get = (origin = 'https://tuveloz.com') => api.GET(new Request('https://tuveloz.com/api/admin/privacy-requests/recovery-status', { headers: { origin } }));
    const checkResponse = async (expectedStatus, expectedState) => {
      const response = await get(); assert.equal(response.status, expectedStatus);
      assert.equal(response.headers.get('cache-control'), 'private, no-store');
      const body = await response.json(); assert.equal(body.state, expectedState); assert.equal(body.deletionEnabled, false);
      assert.doesNotMatch(JSON.stringify(body), /PRIVATE|example.invalid|snapshotDigest|PRIVACY_ERASURE|tuveloz-production/);
      assert.ok(!JSON.stringify(body).includes(key)); assert.equal(state.writes, 0);
      return body;
    };
    await t.test('unauthorized and cross-origin reads stop before touching configuration or storage', async () => {
      reset(configured); state.owner = false;
      assert.equal((await get()).status, 403);
      state.owner = true; assert.equal((await get('https://elsewhere.invalid')).status, 403);
      assert.equal(state.reads, 0); assert.equal(state.writes, 0);
    });
    await t.test('missing configuration is explicit and does not scan accounts', async () => {
      for (const name of ['PRIVACY_ERASURE_JOURNAL', 'PRIVACY_ERASURE_CONTEXT', 'PRIVACY_ERASURE_SIGNING_KEY_ID', 'PRIVACY_ERASURE_KEYS_JSON']) {
        reset(configured); delete state.env[name]; await checkResponse(200, 'not-configured'); assert.equal(state.reads, 0);
      }
    });
    await t.test('unsafe bindings, cross-environment reuse and malformed key rings are denied', async () => {
      const invalid = [
        { BUCKET: store }, { BACKUP_BUCKET: store }, { SITE_URL: 'https://staging.invalid' },
        { PRIVACY_ERASURE_CONTEXT: 'tuveloz-staging' }, { PRIVACY_ERASURE_JOURNAL: {} },
        { PRIVACY_ERASURE_SIGNING_KEY_ID: 'missing' },
        ...['PRIVATE malformed JSON', '[]', 'null', '{}', JSON.stringify({ current: 'too-short' }),
          JSON.stringify({ current: key, old: key }), JSON.stringify({ constructor: key }),
          JSON.stringify({ current: key, previous: 123 }), ' '.repeat(4097),
          JSON.stringify(Object.fromEntries(Array.from({ length: 6 }, (_, i) => ['key' + i, randomBytes(32).toString('hex')])))]
          .map(PRIVACY_ERASURE_KEYS_JSON => ({ PRIVACY_ERASURE_KEYS_JSON })),
      ];
      for (const changes of invalid) { reset({ ...configured, ...changes }); await checkResponse(503, 'needs-review'); assert.equal(state.reads, 0); }
    });
    await t.test('empty matching stores pass only the read check', async () => {
      reset(configured); const body = await checkResponse(200, 'read-check-passed');
      assert.match(body.message, /Write access.*still need verification/); assert.ok(state.reads > 0);
    });
    const intent = { requestId: 'synthetic-request', email: 'person@example.invalid', snapshotDigest: 'a'.repeat(64),
      approvedBy: 'owner@example.invalid', caseReference: 'PRIVATE-CASE', recoveryReference: 'PRIVATE-RECOVERY',
      closureCaseReference: 'PRIVATE-CLOSURE', closedAt: '2026-10-09 12:00:00', reviewAfter: '2099-01-01' };
    await t.test('valid signed records match the source and verify through key rotation without revealing details', async () => {
      reset(configured);
      const { journal } = api.configuredPrivacyRecoveryJournal(state.env);
      await journal.prepare(intent); await journal.confirm(intent);
      state.rows = [{ ...intent, scope: 'authentication-records' }]; state.writes = 0;
      await checkResponse(200, 'read-check-passed');
      state.env.PRIVACY_ERASURE_KEYS_JSON = JSON.stringify({ current: key, next: randomBytes(32).toString('hex') });
      state.env.PRIVACY_ERASURE_SIGNING_KEY_ID = 'next'; await checkResponse(200, 'read-check-passed');
      state.env.PRIVACY_ERASURE_KEYS_JSON = JSON.stringify({ next: randomBytes(32).toString('hex') });
      await checkResponse(503, 'needs-review');
    });
    await t.test('missing journal records and storage/database failures return safe review messages', async () => {
      reset(configured); state.rows = [{ ...intent, scope: 'authentication-records' }];
      await checkResponse(503, 'needs-review');
      reset(configured); state.dbFailure = true; await checkResponse(503, 'needs-review');
      reset({ ...configured, PRIVACY_ERASURE_JOURNAL: { ...store, async list() { throw Error('PRIVATE storage credential'); } } });
      await checkResponse(503, 'needs-review');
    });
  } finally { globalThis.fetch = oldFetch; delete globalThis.__recoveryStatus; rmSync(scratch, { recursive: true, force: true }); }
});
