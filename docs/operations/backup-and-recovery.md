# Backup and recovery

Database records and uploaded files are separate stores. A D1 recovery does not restore an R2 object. Treat recovery as incomplete until both stores agree, including each document's recorded SHA-256 and private metadata.

## Non-production rehearsal

Run `node --experimental-strip-types --test tests/provider-upload-recovery.test.mjs` from the repository root.

The rehearsal applies the full migration history to an isolated SQLite database, submits a synthetic document through the actual provider upload route, snapshots the database and document bytes/metadata separately, discards the working stores, and restores fresh copies. It checks all table contents, database integrity, foreign keys, document hashes, audit/history preservation, unchanged pending eligibility, and an identical upload retry. Deliberately missing and corrupted files must fail validation. Temporary files are removed at completion.

This proves the local recovery procedure with synthetic data. It does not prove that a production export exists, that automatic R2 backups are configured, or that a cloud disaster recovery has succeeded. No production binding, secret, real applicant or outbound delivery is used.

The separate [production backup activation runbook](./production-backup-activation.md) describes the reviewed daily D1 export and content-addressed R2 copy. Its source and local tests do not prove that the private bucket, secret, schedule, first production backup, or isolated cloud restore exists. Record each of those facts only after checking the live Cloudflare account and the stored results.

## Production database recovery

### Preparing a D1 export for an isolated restore

Keep the downloaded dump and every prepared output outside all Git checkouts.
Run the offline helper against the private copy:

```text
python scripts/prepare-d1-restore.py PRIVATE_BACKUP.sql PRIVATE_PREPARED.sql
```

The helper creates all tables before inserting records, retains deferred foreign
keys, and verifies the original and prepared schema, every record, indexes,
triggers, automatic ID sequences, integrity, and foreign keys in local SQLite.
It refuses unsupported SQL, an existing output file, or paths inside a checkout.
Only an aggregate verification report is printed. This does not upload anything.

Use a new isolated D1 database with no application bindings. In Cloudflare D1
Studio, paste the complete prepared script and choose **Run all in transaction**
from the Run menu. The ordinary **Run** button executes only the statement at
the cursor; it is not a full import. Do not add SQL `BEGIN` or `COMMIT` wrappers
to D1 Studio. Confirm every statement succeeded, then compare every table's row
count and the schema-object count against the backup. Run `PRAGMA quick_check`
and `PRAGMA foreign_key_check` separately and retain their results privately.
Do not repeat a full import into a database that already contains restored data.

The September 26 rehearsal restored 78 tables, 355 records, and 383 schema
objects into a separate D1 database. Every table count matched, quick check
returned `ok`, and foreign-key check returned no violations. Both expected R2
objects were restored at their original paths and downloaded with matching
hashes and metadata. Actual application routes passed local smoke checks using
recovered data with no live credentials, writes, or outbound calls. A hosted
application cutover was not performed. See the
[activation record](./production-backup-activation.md).

Cloudflare documents the need to create referenced tables before importing
their data in its [D1 import guidance](https://developers.cloudflare.com/d1/best-practices/import-export-data/).

### Before changing a production destination

[D1 Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/) is always enabled on production-storage databases. The documented window is seven days on Workers Free and thirty days on Workers Paid. Inspect the actual database's Time Travel screen and record a current bookmark before a risky maintenance operation. A bookmark identifies a recovery point; it is not an independent copy and expires with the recovery window.

Restoring Time Travel overwrites the database and cancels in-flight queries. Wrangler's remote export also warns that the database cannot serve queries during the export. Do not run either casually against the live site. A production recovery needs a planned maintenance window and explicit approval for its exact target and effect.

Before a real recovery:

1. Record the deployed source revision, migration history, chosen recovery time, current bookmark, and protected storage/secret configuration. Preserve a separate protected current copy where possible.
2. Pause customer writes and outbound processes. Keep the restored environment isolated from production credentials, email, Stripe, scanner callbacks and scheduled work until reconciliation completes.
3. Restore into an isolated destination where supported. Validate schema, counts, constraints, audit chains and required objects before changing the production destination.
4. Reconcile events after the recovery point, including new applications, uploads, deletion requests, identity callbacks and delivery receipts. An older database may contain stale sessions, eligibility or unsent-looking notifications; do not replay them automatically. A vendor idempotency key is not an indefinite guarantee against duplicate delivery.
5. Reopen only the operations allowed by the current launch state after verification. A restored database is not authorization to activate a service or reopen payments.

## Document copies

A recoverable document backup needs the object key, exact bytes, size, SHA-256, content type and private metadata, matched to the database snapshot. Keep backup access restricted and encryption/recovery-key custody separate from the same failed device. A copy only on the website owner's PC does not protect against loss of that PC. Retention and deletion must cover backup copies as well as the primary bucket.

R2 multipart-abort lifecycle rules clean unfinished uploads; they do not back up completed documents. Bucket locks protect against deletion/overwrite for a chosen period; they are not a separate backup. Do not enable broad retention locks without checking deletion obligations and approving a retention policy.

## Failure handling and alerts

The upload route commits the evidence row, scan request, reminders and audit event in one D1 batch. A definite rollback can remove the unreferenced object. A lost commit acknowledgement must be resolved from the saved record before cleanup. If database state cannot be checked, the file stays private for reconciliation. Notification errors cannot delete a committed document. An identical pending upload retry returns its existing receipt; changed file contents or evidence details require the existing correction workflow. A database trigger prevents concurrent pending document inserts for the same application/person/service/requirement/jurisdiction.

The actual outbox rehearsal also verifies that five failed email attempts record one owner incident, that incident failures do not create an infinite loop, and that a retry after an ambiguous delivery uses the same idempotency key. This verifies persisted state and attempted delivery, not arrival in an owner's inbox. The protected control center displays failed/exhausted email records; delivery through an unavailable owner mailbox is not a reliable independent alert channel.

The self-hosted scanner's offline retry/lease checks are covered by `tests/self-hosted-scans.test.mjs`. An offline runner leaves documents quarantined. Successful retries do not establish continuous scanner uptime or an independent owner alert for every outage. Review operational logs and overdue quarantined documents separately.

The [production health monitor](./production-health-monitor.md) provides an independent, read-only check from GitHub Actions. It verifies the public site, D1 schema, required database guards, and closed customer transaction gates once an hour without using Tuveloz credentials or customer data. It detects service and launch-state failures; it does not prove that a current D1 export or separate R2 document backup exists.
