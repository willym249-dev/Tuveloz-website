# Privacy fulfillment: execution plan and acceptance criteria

Status: review preview implemented and locally tested October 6, 2026;
not published. Account closure/deletion execution is not implemented or approved.
Last reviewed: October 6, 2026.
Owner: Tuveloz owner. No real subject is selected. No retention period or
deletion authority is established by this document.

This fills the execution gap identified in task
`outputs/privacy-document-review-20261006.md`. The existing review queues save
decisions; they do not close accounts or erase data. Keep those requests in
review until the specifically approved work and verification are complete.
Free accounts and provider applications are already open, so fulfillment is
also an operating need before paid bookings. This review did not inspect the
live request queue or establish that it is empty. Handle any actual request
through its verified case and applicable review process while implementation
remains pending; a closed paid-booking gate is not a reason to ignore it.

## Implemented review preview

The owner privacy queue now offers **Preview account records** for open
account-closure requests. The owner-authenticated GET route at
`/api/admin/privacy-requests/closure-preview` derives the subject from the
saved request ID, never from a supplied email. One read-only SQL statement
returns a consistent request state and related-record counts. Final or
withdrawn requests are rejected. Responses are private/no-store, and failures
return a retry message rather than a falsely empty report or database details.

`lib/privacy-closure-preview.ts` classifies the 77 migrated application tables:
70 have explicit count predicates and seven remain explicitly listed for
manual review. A schema test makes new, unclassified tables fail validation.
This is a review inventory, **not a complete fulfillment manifest or deletion
allowlist**. Matching a job, provider business or employer relationship does
not establish that every associated person's data belongs to the requester.
Free text, embedded records, files, vendors, backups and external holds still
need separate scoped review. No automatic retention period is invented.

The preview includes both roles because they share authentication. It flags
recorded legal/unclassified holds and open incidents/payment holds; zero
counts do not clear outside dependencies. It returns no passwords, tokens,
email addresses, file keys or document contents. It sends no email, updates
no status, revokes no sessions and deletes nothing. No real request queue was
inspected during validation. `canExecute` and `coverageComplete` are always
false. An execution engine must not treat this count report as authority.

Validation: build and full suite (1,102 tests) passed, followed by an additional
shared-job isolation case in the focused suite (8 passing tests including its
parent). TypeScript passed. Full lint has zero errors and one existing
`site-language.tsx` navigation warning, also present on main. Chromium and
WebKit passed at 320px and 1280px: explicit loading, no automatic scan,
no duplicate pending request, hold warnings, accessible controls, a failed
refresh clearing stale counts, withdrawn-request rejection, no horizontal
overflow and no mutations/outbound requests. Fixtures use synthetic data;
SQLite query-only mode enforces the read boundary. No schema, public policy,
launch setting, production account or vendor was changed.

Next: scoped disposition/approval records and a persistent whole-account
closure guard across every authentication/recovery method, followed by the
authorized, retry-safe data/file/vendor executor and restore replay. These
are outstanding; the acceptance matrix below is not declared complete.

## 1. Establish an exact scope before producing a deletion plan

Use a restricted case record for identity verification and the subject's email,
application/person IDs and object keys. Store only its reference here. Record:

- Which request and which person/business it covers; a provider business may
  have personnel whose data cannot be included solely by matching the business.
- Whether it asks for access, correction, withdrawal of consent, closure of
  the whole account, or deletion of particular records. These are different
  actions. The customer/provider roles share authentication by email.
- For each category below: erase, de-identify, retain, or awaiting review;
  the approved reason, approver/reference, and next review trigger for retained
  data. An unresolved hold or scope leaves that category pending.
- Any open job, payment, refund, dispute, safety report or legal hold that the
  selected change would affect. Check current references, not a stale export.

There is no blanket instruction to keep everything forever or delete every
matching email. Approved retention reasons and applicable periods belong in
the case-specific review, not an invented global default.

## 2. Source-backed dependencies

| Category | Current source/storage | Implementation constraint |
| --- | --- | --- |
| Sessions and passwords | `auth_sessions`, `account_credentials`; `lib/account-auth.ts` | `/api/admin/users` only revokes sessions. Credentials remain usable. Do not label that operation account closure. Both account roles share credentials. |
| Other sign-in/recovery methods | `login_codes`, `password_verification_codes`, `account_phone_numbers`, `phone_login_codes`, `passkey_credentials`; `app/api/auth/` | A whole-account closure must cover unused codes, recovery and passkeys as well as active sessions. Phone associations need exact ownership checks. |
| Role eligibility | `eligibleAccountRoles`, `providerApplicationOwnershipFor`, `getPrivacyAccountSession` in `lib/account-auth.ts` | Retained customer requests/provider applications can still establish a role even without a password row. A persistent closure mechanism must block fresh sign-in without destroying required records. Preserve an identity-verified way to exercise privacy rights. |
| Customer/provider profile information | `db/schema.ts`, scoped queries in `/api/privacy-center/export` | Export queries are a starting inventory, not a deletion list. Separate shared business/personnel data and another account's records. |
| Provider evidence | `provider_evidence_submissions`, scan jobs/results, private provider-evidence objects, eligibility and reminders | A clean scan does not authorize deletion or prove authenticity. A retained file and its metadata/scan/audit references must stay consistent. Cancel obsolete pending work when its approved source is removed. |
| Private job records | authorizations, evidence, invoices, changes, incidents, cancellations, audit events | Determine lawful disposition separately; deleting a provider profile must not silently destroy a customer's required record. No paid jobs are opened by this work. |
| Non-session image access | `/api/job-images` accepts the matching job access token; public provider media has separate publication/content/eligibility checks | A whole-account closure must inventory permitted token links and public images, not only login sessions. Revoke or retain each access path according to the approved subject/data scope; preserve another participant's justified access. |
| Privacy review records | `privacy_requests`, `data_rights_requests`, restricted completion/audit references | Preserve only the reviewed evidence needed to explain fulfillment or retention. Do not claim completion merely because a queue update succeeded. |
| Communications | preferences, `launch_update_subscribers`, `email_notification_outbox`, marketplace notices/messages | Apply approved opt-outs to queued as well as future optional sends. Separate minimal suppression evidence from marketing content. Required case correspondence is reviewed separately. |
| Vendor copies | Stripe Identity/payment references, email delivery services and any other vendor actually used in this case | Vendor acknowledgment/event evidence is separate from local database changes. A received redaction event is not an instruction to redact a different session. Do not submit private documents to a new service. |
| Backups and recovery | `lib/production-backup.ts`, backup Worker config | Source config is 35-day backup expiry. Retained source data will keep being backed up. Record the approved backup treatment and reapply completed deletions before a restored copy becomes accessible. |

The inventory is based on the published PR #294 source, unchanged by PR #295's
privacy-status race repair. It is a map for a scoped implementation, not a
claim that every database field or vendor contract has been reviewed.

An offline schema discovery run has applied all 70 existing migrations to an
empty in-memory SQLite database. It found 77 tables, 72 with candidate subject
reference columns and seven with candidate file-reference columns. The complete
column inventory is task `outputs/privacy-schema-inventory-20261006.json`,
generated by the adjacent `.mjs` script. No actual account records were loaded;
every disposition remains unclassified. Name-based discovery does not identify
all personal data in free text/JSON or infer which shared records may be erased.
For example, `provider_invoice_items` and `repair_authorization_items` need
parent-record mapping; they do not appear in the direct subject-column count.
Public provider images currently return a five-minute public cache lifetime,
while private image responses use no-store. An approved removal needs to account
for cache visibility rather than claim every previously shared copy disappears.

The scanner source also uses a temporary directory inside a disposable,
network-disabled container with a tmpfs mount and read-only signature volume.
Its normal output is a bounded verdict rather than document contents. Sources:
`scanner/scan_file.py` and `scanner/runner.py`. This is source evidence, not
forensic proof about the owner's device, crash dumps or every past scan. Preserve
the existing dated canary; do not rerun it as a substitute for privacy review.

## 3. Required execution behavior

The next implementation should prepare a read-only manifest first, identifying
the selected records/objects, their ownership, disposition and holds. An
unclassified dependency stops execution. The manifest belongs in restricted
storage and must not embed credentials, document bytes or unnecessary personal
details. No generic bulk deletion command is approved here.

Before a write, recheck the subject, original record versions, any withdrawal
and current holds. Abort a stale plan rather than delete based on an earlier
snapshot. Database work should be transactional where supported. Object/vendor
actions need durable per-item progress: an interruption or timeout must be
reconcilable without duplicating work or marking it complete prematurely.

Do not restore erased data to undo a partially completed request. Preserve a
failure record, stop the remaining work and reconcile it against the approved
plan. Recoverability means knowing what happened, not retaining a new personal
copy without an approved reason.

For an approved whole-account closure, block new authentication as well as
revoke existing sessions. Deleting only passwords or sessions is insufficient.
An intentional future re-registration policy and links to any retained records
must be reviewed before reopening account access.

## 4. Synthetic acceptance matrix before activation

Use isolated synthetic records and file fixtures only; do not reuse a real
application, ID, private document or production backup.

| Case | Required observable result |
| --- | --- |
| Two unrelated accounts plus a dual-role account | Only the exact approved subject/category changes; closing one role does not silently destroy the other role's shared authentication |
| Withdrawn request, active hold or missing disposition | No deletion occurs; a useful pending/conflict result is recorded |
| Request or hold changes after plan creation | Stale execution is rejected before destructive work |
| Whole-account closure | Old sessions, password, passkey, phone/email codes and password recovery cannot restore access; retained historical rows do not recreate a role |
| Selected private file deletion | Exact approved object becomes inaccessible and related work is reconciled; another provider's file remains available under its normal permissions |
| Old token links and public profile media | An access path selected for revocation no longer works, including without a session; any intended retained/public access is documented explicitly |
| Partial storage/vendor failure and retry | Only outstanding items retry; status stays incomplete and the same request cannot create duplicate side effects |
| Repeat an already completed plan | No additional destructive action and no contradictory completion record |
| Restore a copy made before deletion | Restricted replay removes/restricts the approved subject data before customer/provider access is enabled; unrelated data still works |
| Customer-facing completion | Response lists the actions actually verified and categories retained with reasons; no claim that unverified vendor/backup copies are gone |

These cases are acceptance criteria, not reported passing tests. Existing
privacy session-isolation/export tests, PR #295 withdrawal tests, and completed
backup recovery checks remain valid for their original scope and should not be
repeated as a substitute for the missing fulfillment proof.

## 5. Vendor and backup execution boundaries

Official technical documentation checked October 6; no account setting or
vendor action was changed. These describe service behavior, not Tuveloz's
legal retention obligations or a completed deletion.

- **Stripe Identity:** the [session redaction API](https://docs.stripe.com/api/identity/verification_sessions/redact)
  is irreversible and may take up to four days. Its immediate response can
  still show `redaction.status=processing`; completion is `redacted` with the
  corresponding event. Bind the exact account, mode, session and subject,
  recheck eligibility/holds, and reconcile terminal status before recording
  completion. A successful request alone is insufficient. No redaction was run.
- **Cloudflare D1:** [Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/)
  is always enabled for supported databases, with a documented 7-day window on
  Free or 30 days on Paid. This is separate from Tuveloz's own 35-day backup
  configuration. A restore does not remove older bookmarks. The deletion replay
  plan therefore needs to cover both recovery paths. Current account tier and
  database restore window were not re-inspected, and no restore was requested.
- **Resend:** its [security documentation](https://www.resend.com/security)
  states 30-day email/log retention for Free, Pro and Scale, and seven-day
  backups. Do not treat removal of a local outbox row or contact as proof that
  sent-message logs and vendor backups were erased. Verify any applicable
  earlier deletion procedure and the actual account terms before promising
  completion. This does not authorize closing Tuveloz's email account.

Do not include emails, document bytes or identifiers in general support chats
to explore these options. A case-specific vendor request needs exact scoped
authorization and a verified private channel.

## 6. Completion record

Record the approved plan reference, exact executed version, completion/failure
references, verified dispositions, remaining vendor/backup work, and the
response actually delivered. Keep personal details in the restricted case.
Only then finalize the corresponding review queue. The existing privacy launch
gate remains open until the process and its evidence receive the required review.
