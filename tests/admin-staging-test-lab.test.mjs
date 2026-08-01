import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("owner Test Lab uses browser-only fake records behind signed owner verification", async () => {
  const [page, access, dock] = await Promise.all([
    source("app/admin/test-lab/page.tsx"),
    source("app/api/admin/test-lab/access/route.ts"),
    source("app/components/account-tools-dock.tsx"),
  ]);

  assert.match(page, /Tuveloz Test Lab/);
  assert.match(page, /fake information/);
  assert.match(page, /does not write to the Tuveloz database/);
  assert.match(page, /window\.localStorage/);
  assert.match(page, /Reset fake test/);
  assert.match(page, /Simulated a successful Stripe test-mode payment/);
  assert.match(page, /fetch\("\/api\/admin\/test-lab\/access"/);
  assert.doesNotMatch(page, /fetch\("\/api\/requests"/);
  assert.doesNotMatch(page, /fetch\("\/api\/stripe\/checkout"/);

  assert.match(access, /isVerifiedOwnerRequest/);
  assert.match(access, /databaseWrites: false/);
  assert.match(access, /realPayments: false/);
  assert.match(access, /outboundEmail: false/);
  assert.match(access, /providerNotifications: false/);
  assert.match(dock, /href="\/admin\/test-lab"/);
  assert.match(dock, /Open Test Lab/);
});

test("staging is owner-only, non-indexable, and skips background production actions", async () => {
  const [worker, banner, layout] = await Promise.all([
    source("worker/index.ts"),
    source("app/components/staging-environment-banner.tsx"),
    source("app/layout.tsx"),
  ]);

  assert.match(worker, /APP_ENVIRONMENT\?: string/);
  assert.match(worker, /configuredEnvironment === "staging"/);
  assert.match(worker, /staging && !\(await isVerifiedOwnerRequest\(request\)\)/);
  assert.match(worker, /X-Robots-Tag/);
  assert.match(worker, /noindex, nofollow, noarchive/);
  assert.match(worker, /if \(!staging && request\.method === "GET"/);
  assert.match(worker, /if \(!staging && env\.DB/);
  assert.match(worker, /Tuveloz staging requires signed owner verification/);

  assert.match(banner, /Test mode — admin staging site/);
  assert.match(banner, /No real payments, emails, customer jobs, or provider notifications/);
  assert.match(layout, /<StagingEnvironmentBanner \/>/);
});

test("manual staging deployment uses isolated Cloudflare resources", async () => {
  const [workflow, generator, documentation, ignore] = await Promise.all([
    source(".github/workflows/deploy-staging.yml"),
    source("scripts/generate-staging-wrangler.mjs"),
    source("docs/STAGING.md"),
    source(".gitignore"),
  ]);

  assert.match(workflow, /workflow_dispatch/);
  assert.match(workflow, /environment: staging/);
  assert.match(workflow, /generate-staging-wrangler\.mjs/);
  assert.match(workflow, /STAGING_D1_DATABASE_ID/);
  assert.match(workflow, /STAGING_R2_BUCKET_NAME/);
  assert.match(workflow, /d1 migrations apply tuveloz-staging-db/);
  assert.match(workflow, /wrangler deploy --config \.wrangler-staging\.generated\.json/);
  assert.doesNotMatch(workflow, /npm run db:migrate:remote/);
  assert.doesNotMatch(workflow, /npm run deploy/);

  assert.match(generator, /name: "tuveloz-staging"/);
  assert.match(generator, /pattern: "staging\.tuveloz\.com"/);
  assert.match(generator, /database_name: "tuveloz-staging-db"/);
  assert.match(generator, /APP_ENVIRONMENT: "staging"/);
  assert.match(generator, /STRIPE_ALLOW_LIVE_MODE: "false"/);
  assert.match(generator, /RESEND_FROM_EMAIL: ""/);
  assert.doesNotMatch(generator, /76a19869-f771-42ce-9bc9-f88605ea6f29/);
  assert.doesNotMatch(generator, /tuveloz-uploads/);

  assert.match(documentation, /Never copy the production D1 database ID/);
  assert.match(documentation, /Cloudflare Access application protecting `staging\.tuveloz\.com`/);
  assert.match(ignore, /\.wrangler-staging\.generated\.json/);
});
