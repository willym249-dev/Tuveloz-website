# Tuveloz staging and owner Test Lab

Tuveloz has two separate testing layers:

1. `/admin/test-lab` is an owner-only browser simulation. It uses fake records stored only in the owner's browser and never writes to D1, Stripe, Resend, customer records, provider records, or notification systems.
2. `staging.tuveloz.com` is the planned full application staging Worker. It is generated and deployed only through the manual **Deploy Tuveloz Staging** GitHub Actions workflow.

## Safety boundaries

- Staging uses the separate Worker name `tuveloz-staging`.
- Staging requires a separate D1 database named `tuveloz-staging-db`.
- Staging requires a separate private R2 bucket.
- The generated staging configuration sets `APP_ENVIRONMENT=staging`, `STRIPE_ALLOW_LIVE_MODE=false`, and does not configure a Resend sender or API key.
- The Worker denies every staging page and API request unless Cloudflare Access supplies a valid signed owner token.
- Staging responses are private, non-cacheable, and carry `X-Robots-Tag: noindex, nofollow, noarchive`.
- Provider reminders and background email delivery do not run in staging.
- Never copy the production D1 database ID, production R2 bucket, live Stripe key, production webhook secret, or Resend API key into the staging environment.

## One-time Cloudflare setup

Create these isolated resources in the same Cloudflare account:

- D1 database: `tuveloz-staging-db`
- Private R2 bucket, for example: `tuveloz-staging-uploads`
- Cloudflare Access application protecting `staging.tuveloz.com`, allowing only the Tuveloz owner

The Access application audience must be different from production unless Cloudflare explicitly reuses the same protected application and policy.

## GitHub environment

Create a GitHub Actions environment named `staging` and add:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `STAGING_D1_DATABASE_ID`
- `STAGING_R2_BUCKET_NAME`
- `STAGING_OWNER_EMAIL`
- `STAGING_OWNER_ACCESS_AUD`
- `STAGING_TEAM_DOMAIN`

The generated configuration is ignored by Git and deleted after every workflow run.

## Deploy

Run **Actions → Deploy Tuveloz Staging → Run workflow**.

The workflow installs dependencies, runs lint, runs the full build and test suite, applies migrations only to the staging D1 database, and deploys only the `tuveloz-staging` Worker to `staging.tuveloz.com`.

## Resetting tests

- Use **Reset fake test** inside `/admin/test-lab` to clear the browser-only simulation.
- For a full staging reset, delete and recreate only the staging D1 database and staging R2 bucket, update the staging GitHub environment values, and rerun the staging workflow. Never reset production resources.
