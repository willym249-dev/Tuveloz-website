# Production backup activation

Tuveloz production uses two separate stores: D1 for records and a private R2 bucket for uploaded documents and images. D1 Time Travel is always on, but it is a short recovery window and does not copy R2 files. The separate `backup-worker` closes that gap without giving the public website access to the backup bucket. The first real backup and isolated local recovery passed on September 26. The native Workflow schedule required a paid plan; the replacement uses a standard Worker Cron Trigger and still needs activation after publication.

## Account check — September 25, 2026

- Signed into the existing Tuveloz Cloudflare account through its business Google login.
- R2 lists three existing buckets and no `tuveloz-backups` bucket. Total account
  storage is 51.64 MB. `tuveloz-uploads` holds two objects totaling 682 bytes.
  No private object was opened or downloaded for this inventory.
- R2 shows $0.00 billable usage for August 27–September 27, with 17 Class A and
  103 Class B operations. This is observed usage, not a permanent spending cap.
- Production D1 size is 2.02 MB. Its Time Travel screen confirms a seven-day
  restore window. No restore, bookmark change, or production export was triggered.
- The existing CLI login can list Workflows and reports none deployed. It lacks
  D1/R2 API permissions, so those read-only inventory calls failed authentication;
  the dashboard supplied the inventory instead. Do not broaden the login to all
  Wrangler permissions merely to dismiss its warning.
- The separate Worker builds successfully in a local `wrangler deploy --dry-run`.
  This does not create a Worker, secret, bucket, or backup.
- A local regression exposed a retention failure above R2's 1,000-key delete
  limit. The prepared fix batches deletions while retaining referenced files;
  it must be reviewed and published before activation.
- The unsubmitted token review shows **D1:Read** for the Tuveloz account and an
  October 25, 2026 expiration. This permission covers the account's D1 databases,
  not just production. No token has been created. Owner approval was requested
  for creating/storing that credential, publishing the tested fix, and activating
  nightly backups with an isolated recovery test. Read-only export compatibility
  still needs the first real API check; do not silently switch to Edit if denied.

## September 26 approved setup

The owner approved the exact read-only credential scope and October 25 expiry,
publication, activation, 35-day retention, and the isolated restore test. The
token and private `tuveloz-backups` bucket are created; public access is disabled.
No paid plan was selected. The current local CLI cannot operate Workflows.

Use **Deploy private backups** (`deploy-backups.yml`) from `main`, with the
existing GitHub production deployment secret. Run `bootstrap` first: it omits
all schedules. Install `D1_BACKUP_API_TOKEN` directly in that Worker's Cloudflare
secret settings, then run `activate`. Activation checks the secret's name and
type without exposing its value. Both public Worker and preview URLs are off.
The backup key itself must never enter GitHub Actions or a command transcript.
PRs #229/#230 are merged. Bootstrap run `36223729484` succeeded and the
dashboard confirms no public Worker URLs. `D1_BACKUP_API_TOKEN` is saved as an
encrypted production secret. Bootstrap did not enable a schedule.

The first instance, `owner-approved-recovery-20260926`, returned HTTP 401
Authentication error at export initiation on September 26 at 06:31 UTC. It was
terminated after two retries. No SQL export, object copy, or manifest was
produced. The owner subsequently approved D1 Edit, including its broader
account-level database write/delete capability. The saved permission is now
D1 Edit for the Tuveloz account, with the same October 25 expiry and existing
encrypted Worker secret. No new credential value was generated or exposed.

Instance `owner-approved-recovery-20260926-edit` completed all seven steps at
07:26:06 UTC. It stored a 251,632-byte SQL export, a manifest, and both source
objects (a zero-byte folder marker and a 605-byte existing synthetic scanner
fixture). The exported SQL restored to a separate local SQLite database at
07:33:53 UTC: integrity check passed, foreign-key violations were zero, and
both restored objects matched their manifest sizes and SHA-256 values.
Production data stayed outside every source checkout; no application, mail,
Stripe, or scanner integration was connected to the recovery copy. This proves
local recovery, not a restore into Cloudflare D1/R2 or a production cutover.

Activation run `36227181038` uploaded the Worker but rejected native Workflow
`schedules` because they require Workers Paid. No paid plan was selected.
Use the replacement top-level `triggers.crons` with a short `scheduled` handler
that creates the durable Workflow through its binding. It retains the 09:07 UTC
daily time and all existing backup behavior. Bootstrap deploys an empty Cron
list; activate installs the reviewed Cron only after checking the secret.
Confirm the successful activation run and remote trigger before calling nightly
backups enabled. The first automatic run remains a separate verification.

## What the backup does

Once activated, every day at 09:07 UTC, a standard Worker Cron Trigger starts
the private Cloudflare Workflow, which:

1. exports the production D1 database through Cloudflare's authenticated export API;
2. saves the SQL export in the private `tuveloz-backups` R2 bucket;
3. inventories every object in the private `tuveloz-uploads` bucket;
4. reads each exact file, verifies its size and SHA-256, and keeps one content-addressed copy of each file version;
5. writes a manifest joining the database bookmark and export to every source object, metadata field, SHA-256, and backup key; and
6. removes database exports, manifests, and unreferenced file versions after the approved 35-day recovery window.

The workflow stops before writing a partial manifest if the source inventory exceeds its reviewed 250-object capacity. Capacity must be raised deliberately as Tuveloz grows.

Only one backup instance runs at a time, so a second scheduled or manual run cannot remove an object while the first run is still building its manifest. Successful Workflow history is kept for one day and failed history for three days, which stays within the current Workers Free retention limit.

The backup bucket has no public route. The backup Worker returns only `404` to web requests. Its D1 export credential is a Cloudflare secret and is never stored in Git, GitHub Actions, the application database, or a public response.

## Cost boundary

Cloudflare Workflows and standard Worker Cron Triggers are available on Workers Free. Native Workflow schedules are a separate Paid-only feature and must not be used here. The current design runs once per day and stays below the Free plan's Workflow step allowance at its reviewed capacity. R2 Standard includes 10 GB-month of storage and one million Class A operations per month at no charge. Cloudflare counts the primary and backup buckets together for the account, so account usage must be monitored as files grow. No paid plan or billing change was made.

## One-time account setup

These live actions remain intentionally separate from source code:

1. Confirm current R2 Standard storage and Workers/Workflows plan usage in the signed-in Tuveloz Cloudflare account.
2. Create the private Standard-storage bucket `tuveloz-backups`. Do not enable public access.
3. Review the exact D1 permission and resource scope Cloudflare offers before creating a credential. Prefer read-only export access if supported; do not claim a token is limited to one database unless Cloudflare enforces that restriction. Obtain approval for the actual scope and lifetime, then store the approved token as the `D1_BACKUP_API_TOKEN` secret on `tuveloz-production-backup`. Never paste the token into chat, a command transcript, a repository file, or a GitHub issue.
4. Deploy with `wrangler deploy --config backup-worker/wrangler.jsonc` only after the bucket and secret exist and the activation is approved. If an initial Worker deployment is needed to provision its secret, omit the schedule until the secret is installed; the scheduled configuration is not the bootstrap step.
5. Agree the first export's timing and brief service-impact risk: Cloudflare warns that D1 cannot serve queries during export. Trigger one approved backup and confirm a non-empty `d1/` export, a current `manifests/` record, the expected `objects/` copies, matching sizes and SHA-256 values, and a successful Workflow instance.
6. Restore that export and its referenced files into an isolated local SQLite/file destination to prove basic recoverability. Verify schema, record counts, document hashes, and that no application integration runs there. A full Cloudflare recovery exercise additionally requires isolated non-production D1/R2 destinations, access-control checks, and application smoke tests; that exercise is still outstanding.

The first successful Workflow run proves a stored production copy. The isolated restore rehearsal proves recoverability. Neither should be described as complete before its own evidence exists.

Official references: [R2 pricing](https://developers.cloudflare.com/r2/pricing/),
[Workflows pricing](https://developers.cloudflare.com/workflows/reference/pricing/),
[D1 export behavior](https://developers.cloudflare.com/api/resources/d1/subresources/database/methods/export/),
[R2 binding limits](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/),
and [Worker Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/).
