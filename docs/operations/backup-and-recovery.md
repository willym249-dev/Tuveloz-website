# Backup and recovery

Database records and uploaded files are separate stores. A D1 recovery does not restore an R2 object. Treat recovery as incomplete until both stores agree, including each document's recorded SHA-256 and private metadata.

## Non-production rehearsal

Run `node --experimental-strip-types --test tests/provider-upload-recovery.test.mjs` from the repository root.

The rehearsal applies the full migration history to an isolated SQLite database, submits a synthetic document through the actual provider upload route, snapshots the database and document bytes/metadata separately, discards the working stores, and restores fresh copies. It checks all table contents, database integrity, foreign keys, document hashes, audit/history preservation, unchanged pending eligibility, and an identical upload retry. Deliberately missing and corrupted files must fail validation. Temporary files are removed at completion.

This proves the local recovery procedure with synthetic data. It does not prove that a production export exists, that automatic R2 backups are configured, or that a cloud disaster recovery has succeeded. No production binding, secret, real applicant or outbound delivery is used.

## Production database recovery

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
