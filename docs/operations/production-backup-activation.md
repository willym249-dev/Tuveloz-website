# Production backup activation

Tuveloz production uses two separate stores: D1 for records and a private R2 bucket for uploaded documents and images. D1 Time Travel is always on, but it is a short recovery window and does not copy R2 files. The separate `backup-worker` closes that gap without giving the public website access to the backup bucket.

## What the backup does

Every day at 09:07 UTC, the private Cloudflare Workflow:

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

Cloudflare Workflows are available on both Workers Free and Workers Paid. The current design runs once per day and stays far below the Free plan's daily Workflow step allowance at its reviewed capacity. R2 Standard includes 10 GB-month of storage and one million Class A operations per month at no charge. Cloudflare counts the primary and backup buckets together for the account, so the actual account usage must be checked before activation and monitored as files grow. No paid plan or billing change is required merely to prepare this code.

## One-time account setup

These live actions remain intentionally separate from source code:

1. Confirm current R2 Standard storage and Workers/Workflows plan usage in the signed-in Tuveloz Cloudflare account.
2. Create the private Standard-storage bucket `tuveloz-backups`. Do not enable public access.
3. Create a least-privilege Cloudflare API token that can export only the production D1 database, then store it as the `D1_BACKUP_API_TOKEN` secret on `tuveloz-production-backup`. Never paste the token into chat, a command transcript, a repository file, or a GitHub issue.
4. Deploy with `wrangler deploy --config backup-worker/wrangler.jsonc` only after the bucket and secret exist.
5. Trigger one backup and confirm a non-empty `d1/` export, a current `manifests/` record, the expected `objects/` copies, matching sizes and SHA-256 values, and a successful Workflow instance.
6. Restore that export and its referenced files into isolated non-production D1/R2 destinations. Verify schema, record counts, document hashes, access controls, and that no email, Stripe, scanner, or scheduled production action can run there.

The first successful Workflow run proves a stored production copy. The isolated restore rehearsal proves recoverability. Neither should be described as complete before its own evidence exists.
