import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("public health endpoint reports release and required schema without private records", async () => {
  const api = await source("app/api/health/route.ts");

  assert.match(api, /DEPLOYMENT_COMMIT/);
  assert.match(api, /DEPLOYMENT_BUILT_AT/);
  assert.match(api, /sqlite_master/);
  assert.match(api, /account_credentials/);
  assert.match(api, /customer_requests/);
  assert.match(api, /provider_applications/);
  assert.match(api, /email_notification_outbox/);
  assert.match(api, /job_authorizations/);
  assert.match(api, /privacy_requests/);
  assert.match(api, /job_evidence_items/);
  assert.match(api, /"cache-control": "no-store, max-age=0"/);
  assert.match(api, /does not expose credentials, private records, user counts, payment details, or internal security controls/);
  assert.doesNotMatch(api, /SELECT \*/);
});

test("production workflow stamps and verifies the exact deployed commit", async () => {
  const workflow = await source(".github/workflows/deploy-cloudflare.yml");

  assert.match(workflow, /Stamp deployment metadata/);
  assert.match(workflow, /DEPLOYMENT_COMMIT/);
  assert.match(workflow, /DEPLOYMENT_BUILT_AT/);
  assert.match(workflow, /npm run db:migrate:remote/);
  assert.match(workflow, /npm run deploy/);
  assert.match(workflow, /Verify exact live release and database readiness/);
  assert.match(workflow, /EXPECTED_COMMIT: \$\{\{ github\.sha \}\}/);
  assert.match(workflow, /payload\?\.release\?\.commit === expected/);
  assert.match(workflow, /payload\?\.checks\?\.database === "ready"/);
  assert.match(workflow, /payload\?\.checks\?\.schema === "ready"/);
  assert.match(workflow, /payload\.missingTables\.length === 0/);
  assert.match(workflow, /Cloudflare did not serve the exact healthy release/);
});

test("production result is published as a signed commit status", async () => {
  const workflow = await source(".github/workflows/deploy-cloudflare.yml");

  assert.match(workflow, /statuses: write/);
  assert.match(workflow, /Publish production deployment commit status/);
  assert.match(workflow, /always\(\) && github\.event_name != 'pull_request'/);
  assert.match(workflow, /GH_TOKEN: \$\{\{ github\.token \}\}/);
  assert.match(workflow, /JOB_STATUS: \$\{\{ job\.status \}\}/);
  assert.match(workflow, /tuveloz\/production-deployment/);
  assert.match(workflow, /Exact Cloudflare release and required D1 schema verified/);
  assert.match(workflow, /Production migration, deployment, or live verification failed/);
  assert.match(workflow, /api\.github\.com\/repos\/\$\{repository\}\/statuses\/\$\{commit\}/);
});

test("public system status explains the operational and privacy boundary", async () => {
  const [page, privacy] = await Promise.all([
    source("app/system-status/page.tsx"),
    source("app/privacy/page.tsx"),
  ]);

  assert.match(page, /Tuveloz system status/);
  assert.match(page, /Public operational check/);
  assert.match(page, /Application/);
  assert.match(page, /Database/);
  assert.match(page, /Required schema/);
  assert.match(page, /Verified deployment/);
  assert.match(page, /A stale release or missing migration causes the/);
  assert.match(page, /No passwords, verification codes, authentication tokens/);
  assert.match(privacy, /href="\/system-status"/);
  assert.match(privacy, /Tuveloz System Status/);
});
