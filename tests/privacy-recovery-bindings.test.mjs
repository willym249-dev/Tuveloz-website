import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';

const repo = resolve(import.meta.dirname, '..');
function config(path) {
  const parsed = ts.parseConfigFileTextToJson(path, readFileSync(join(repo, path), 'utf8'));
  assert.equal(parsed.error, undefined);
  return parsed.config;
}

test('private recovery storage is separate from uploads and automated backup storage', () => {
  const production = config('wrangler.jsonc'), backup = config('backup-worker/wrangler.jsonc');
  const journal = production.r2_buckets.find(bucket => bucket.binding === 'PRIVACY_ERASURE_JOURNAL');
  assert.ok(journal);
  for (const bucket of production.r2_buckets.filter(bucket => bucket !== journal)) assert.notEqual(bucket.bucket_name, journal.bucket_name);
  assert.ok(!backup.r2_buckets.some(bucket => bucket.bucket_name === journal.bucket_name), 'backup expiry must not govern the authoritative journal');
  assert.equal(production.vars.PRIVACY_ERASURE_KEYS_JSON, undefined, 'signing ring must never be a plain-text config var');
  assert.equal(production.vars.STRIPE_ALLOW_LIVE_MODE, 'false');
});

test('actual staging generator cannot inherit the production recovery binding or key identifiers', () => {
  const scratch = mkdtempSync(join(tmpdir(), 'tuveloz-private-binding-'));
  try {
    const path = join(scratch, 'staging.json');
    execFileSync(process.execPath, [join(repo, 'scripts/generate-staging-wrangler.mjs'), path], {
      cwd: repo, env: { ...process.env, STAGING_D1_DATABASE_ID: '11111111-1111-4111-8111-111111111111',
        STAGING_R2_BUCKET_NAME: 'synthetic-staging-uploads', STAGING_OWNER_EMAIL: 'owner@example.invalid',
        STAGING_OWNER_ACCESS_AUD: 'synthetic-audience', STAGING_TEAM_DOMAIN: 'https://synthetic.cloudflareaccess.com' },
    });
    const staging = JSON.parse(readFileSync(path, 'utf8'));
    assert.equal(staging.r2_buckets.length, 1);
    assert.equal(staging.r2_buckets[0].bucket_name, 'synthetic-staging-uploads');
    assert.doesNotMatch(JSON.stringify(staging), /tuveloz-privacy-journal|PRIVACY_ERASURE/);
    assert.equal(staging.vars.SITE_URL, 'https://staging.tuveloz.com');
  } finally { rmSync(scratch, { recursive: true, force: true }); }
});
