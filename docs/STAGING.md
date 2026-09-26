# Tuveloz staging and owner Test Lab

Tuveloz has two separate testing layers:

1. `/admin/test-lab` is an owner-only browser simulation. It uses fake records stored only in the owner's browser and never writes to D1, Stripe, Resend, customer records, provider records, or notification systems.
2. `staging.tuveloz.com` is the existing private application staging Worker, originally deployed August 9 and refreshed September 26, 2026. It is generated and deployed only through the manual **Deploy Tuveloz Staging** GitHub Actions workflow.

## September 26 verified state — reuse this setup

The separate `tuveloz-staging-db`, private upload bucket, owner Access policy,
and GitHub staging environment already existed. Do not recreate them because
older notes called staging planned. Workflow
[`36247963177`](https://github.com/willym249-dev/Tuveloz-website/actions/runs/36247963177)
successfully tested, migrated, and deployed main commit
`3eb287197f5d854d3dc1ab1c7036a0aa5c85fc65`. The database includes migration
`0068_provider_document_pending_guard.sql`. An unauthenticated request redirects
to Cloudflare Access; the signed owner session loaded the actual test console.

The owner incident controls were exercised through the deployed UI/API and
checked independently in staging D1. See the
[incident rehearsal record](operations/vehicle-incident-claims-and-stop-work-plan.md#hosted-staging-owner-rehearsal).
Only synthetic fixtures were added. Production records, recovery copies,
customer-launch controls, and payment settings were not changed. No new paid
service or expanded credential was required.

Retain the clearly labeled `rehearsal-owner-job-20260926` fixture and its two
incident records as test evidence. They are not real provider approval,
insurance, Identity, service, or payment records. Do not recreate them or reset
staging merely to repeat this completed check.

The September 26 incident-evidence increment was deployed by successful run
`36252778621` at branch commit `262bfae1d55fcd0bd2a6b10d6d2656a562c00442`.
An additional synthetic image/row, `rehearsal-photo-20260926`, was linked to the
existing open incident through the owner UI and opened from private R2. The
earlier incident decisions and all holds were preserved, and D1 recorded one
new verified-owner audit with no payment or notifications. This was a seeded
fixture link/read test, not a hosted participant upload. See the incident plan
for scope and retain the fixtures; do not recreate them.

Run `36253800061` then successfully deployed the timestamp correction at
`f5e1556da0e4b2c5291b39ed386b33bed89bdd8f`. Reloading the existing owner page
confirmed the saved UTC evidence time displays as 11:44:54 AM in Maryland,
with its link and hold intact. This follow-up was read-only.

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
