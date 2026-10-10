# Privacy fulfillment: execution plan and acceptance criteria

Status: reviewed unused-account access closure published in PR #296, corrected
for Cloudflare D1 in published PR #297. The scoped
authentication-erasure engine and signed recovery journal/replay are implemented
and tested locally and in an isolated synthetic Cloudflare rehearsal, with no
real account action. Current-source catalog reconciliation is tested locally.
Production recovery integration,
operator controls and broader data/file/vendor fulfillment remain.
Last reviewed: October 10, 2026.
Owner: Tuveloz owner. No real subject is selected. No retention period or
deletion authority is established by this document.

This fills the execution gap identified in task
`outputs/privacy-document-review-20261006.md`. The published owner action can
close access for reviewed unused accounts; saving a review decision alone does
not erase data. Keep requests in review until the specifically approved work
and verification are complete.
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

## Implemented persistent access guard — October 7

Migration `0070_account_closure_access_guard` adds an initially empty
`account_closures` table. Installing it closes no account. A future reviewed
executor must derive the normalized account and record its request, restricted
case reference and review date. The date triggers review, not automatic access
restoration. There is no reopening route or default retention period.

Inserting a reviewed closure revokes both roles' sessions and invalidates unused
email/password/phone codes in the same transaction. Database triggers reject new
sessions, password creation/replacement, auth challenges, phone associations
and passkeys for that account, including case/whitespace variants and writes
already in flight. Authentication checks also reject retained credentials,
provider/customer role eligibility and the provider privacy-session fallback.
Password reset/create cannot recreate access after credential removal. A closed
account can still require an identity-verified support process for privacy
rights; restoring its normal login is not that process.

The guard retains job, document, personnel and credential records for separate
disposition review. It does not remove public provider media, disable business
service eligibility, fulfill a privacy request, send a completion notice or
erase files/vendor records. Those steps require their own approved scope.
No owner closure action or real closure row was created. Do not mark the
privacy gate complete on the strength of this guard.

The preview now classifies 78 tables: 71 count sources and seven manual sources;
the earlier 77-table evidence above remains a dated result. Deployment health
requires the closure table and twelve access triggers and rejects missing or
ineffective guards. A migration-history test now checks its historical range
without rejecting valid future migrations; contiguous indexes and unique tags
are still enforced.

Validation: eleven focused real-code/migrated-SQLite checks passed. They cover
transaction rollback on failed revocation, both roles and unrelated-account
isolation, an injected obsolete provider session, retained passwords/codes,
phone change/sign-in, passkey rejection using a real signed challenge, raw
stale-write guards, session/password-creation races, unavailable closure state
and health rejection of missing/ineffective guards. The passkey fixture has no
real authenticator and proves refusal of closed access, not a successful live
WebAuthn ceremony. Outbound mail is intercepted locally, with synthetic
addresses only. Build/all 1,114 tests and TypeScript passed; lint has no errors
and the existing navigation warning. No real account or vendor was touched.

Next: scoped disposition/approval records and the reviewed owner closure action,
followed by the authorized, retry-safe data/file/vendor executor and restore
replay. These are outstanding; the acceptance matrix below is not declared
complete.

## Reviewed unused-account access closure — October 7

The owner form and POST `/api/admin/privacy-requests/close-access` are now
implemented locally. They require verified owner access, strict same-origin,
a signed-in-account closure request, explicit identity/authority and both-role
confirmation, a private case reference, retention notes, a future review date
and an unchanged snapshot. Typed review fields survive a failed operation.
Closing access does not mark the privacy request fulfilled, delete records,
remove vendor copies or send a completion notice.

The write rechecks request state and refuses job/payment history, recorded
holds, personnel, published profiles and sponsorship/registration-holder
relationships. An existing audit cannot be attached to a newly created closure.
Closure, both-role session revocation and the verified-owner audit share a
transaction. Replaying the same recorded action returns the existing result;
a competing case is rejected without inventing a review record. Migration 0071
also prevents new requests or quotes against closed accounts. Health requires
the review table and both new guards.

Validation: 12 focused migrated-SQLite checks, including withdrawal, new job,
payment, legal hold, staff, published-profile, sponsorship and competing-closure
races; failed audit writes restore sessions and closure state. The prior full
build and 1,119-test suite passed, followed by seven additional passing cases.
Chromium/WebKit at 320 and 1280 pixels verified required fields, explicit
confirmations, one deliberate synthetic POST, no external requests and no
overflow. No real account or request queue was read or changed. This current
inventory has 79 tables (72 counted and seven manual); earlier totals above are
dated evidence. General data fulfillment remains unfinished.

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

## Internal authentication-record erasure engine — October 7

PR #296 is published and verified as `fe8ecbee94a5274f98ec40766b6d914960152162`.
Its earlier local-only status above is historical. The new engine described in
this section is local only and has no HTTP route or operator button.

`lib/privacy-auth-erasure.ts` prepares a category-specific snapshot and erases
only the seven authentication sources after a separately reviewed, unused-account
closure. The snapshot returned to a reviewer contains counts and a digest; no
email, phone number, credential, code or record identifier is returned. The
engine requires verified owner access, same origin, explicit authentication-only
scope and retention/recovery attestations. It now also requires the separate
signed journal described below. A typed recovery reference alone cannot allow
deletion or prove production durability.

Migration 0072 installs an initially empty receipt table and atomic erasure
trigger. The guarded insert rechecks the entire request/record snapshot and
unused-account conditions at execution. Receipt creation and authentication
record deletion succeed together or roll back together. Anonymous phone codes
are selected only through the subject's current phone association; codes with
another account's explicit email are preserved. Permanent account-closure state
remains so removed passwords cannot be recreated. Shared jobs, payment records,
provider documents and the general privacy-request status are untouched.

Do not expose this internal action until the recovery journal and restore replay
are integrated with verified private infrastructure. An older database must not
revive erased credentials or lose its closure restriction. This engine does not
erase objects/vendor copies, choose legal retention rules, notify the requester
or complete the general privacy request. No real case, account or backup was read
or erased during development.

Validation for the internal engine: production build/all 1,134 tests passed;
TypeScript passed; lint has no errors and the existing navigation warning.
Eight focused checks cover exact-account isolation, explicit-email phone-code
isolation, protected documents, owner/origin/scope checks, missing closure,
withdrawal/hold/version/job races, rollback and idempotent retry. The privacy
inventory now explicitly classifies 80 tables. All records were synthetic.

## Separate recovery journal and replay — October 7

Implemented locally in `lib/privacy-erasure-recovery.ts` and
`lib/privacy-erasure-replay.ts`. No storage binding, secret, route, operator
button or production restore was created. The original engine validation above
is historical; the current validation is recorded in the newest working log.

Before the guarded database mutation, the engine writes an immutable signed
intent outside the database and verifies it with a fresh read. After the
atomic deletion it writes and verifies the matching completion record. Lost
object-write responses are reconciled through authenticated reads. Missing
intent evidence prevents deletion; missing completion evidence returns
`recovery-pending`, never success. A retry reconciles the existing database
receipt without repeating deletion or inventing a missing intent. A stale
snapshot or uncertain database failure can leave an unresolved intent; review
the actual receipt and source state before reconciliation. Do not automatically
discard the intent, infer failure from a lost reply, or reopen recovery traffic.

The private journal includes normalized email, request/case references, closure
dates, approving owner and snapshot digest. It excludes passwords, token/code
material, phone numbers and document contents. Each intent/completion pair is
HMAC authenticated and bound to its environment context and storage key.
Retained keys support rotation; unknown, non-string or missing keys reject
verification. Malformed records, incomplete pairs and invalid/excessive
pagination stop replay. Authentication does **not** prove that an empty or
partial bucket is the authoritative, current catalog.

Replay first validates the entire supplied catalog, then uses one database
batch to reestablish closure and remove the seven authentication categories.
Synthetic SQLite tests restore records captured before the closure existed:
the erased account loses access, another account remains intact, and a failure
mid-batch rolls back both closure and deletion. Replay can safely repeat.
The result always says `trafficMayOpen: false`; it neither opens traffic nor
establishes that general privacy fulfillment is complete. More than 100 intents
requires a separately reviewed batching plan.

Replay also reads back closure and the seven authentication categories before
reporting success. An unexpected trigger that silently skips a deletion must
fail verification even if the batch itself succeeds. Phone associations remain
while their anonymous challenges remain, so a retry can still find those codes.
This check does not roll back an already committed batch: keep the restore
isolated, resolve the fault and retry. The readback is not proof that source
writes are paused, the journal is complete or unrelated data is unchanged.

The integrated branch includes released PR #297. Production build/all 1,146
tests, TypeScript and lint passed October 7 (one existing navigation warning).
Nineteen focused checks include actual local workerd/D1/R2 behavior: silent
passkey and phone-code deletion failures are rejected, the association survives,
and retry completes after the injected fault is removed. Fixtures are synthetic;
this is not a remote Cloudflare recovery rehearsal. Evidence: task
`outputs/auth-erasure-readback-full-20261007.log` and
`outputs/auth-erasure-readback-focused-20261007.log`.

Required before activating the feature:

1. Configure and verify a private, authoritative journal store separate from
   the database being restored and its old object snapshots. Retain its signing
   key ring in restricted secret storage. Never restore an older journal over
   newer records. Existing backup cleanup prefixes are not production proof.
2. Confirm the real source writes are paused, identify the current journal and
   resolve every pending intent. These are operational checks; boolean review
   fields alone cannot prove them. Reconcile catalog completeness separately.
3. Restore into an isolated database, apply all required migrations, and replay
   the current journal before considering any traffic switch. Test the actual
   Cloudflare storage/database path; local fixture results are insufficient.
4. Independently verify closure and absence of the approved authentication
   records, preservation of unrelated accounts, and other recovery checks.
   Keep traffic closed until the full recovery review is approved.
5. Add reviewed owner controls and define case-specific retention for the
   private journal and all remaining data/file/vendor categories. This code
   does not authorize retaining identity references forever or destroying
   records that still require retention.

## Isolated Cloudflare rehearsal package — October 8

`rehearsal-worker/build-privacy-recovery.mjs` builds the separate synthetic
Worker in `rehearsal-worker/privacy-recovery.ts`, using the current migrations
and actual erasure/journal/replay modules. The builder performs no network,
credential or deployment operation. The example configuration is
`rehearsal-worker/privacy-recovery.example.jsonc`; its database IDs are invalid
placeholders, expiry is empty and public Worker/preview URLs are disabled.
This package is not imported by the production application.

Proposed temporary resources (none created by preparation):

- Worker: `tuveloz-privacy-rehearsal-20261008`.
- Empty source D1: `tuveloz-privacy-source-20261008`.
- Empty restored-copy D1: `tuveloz-privacy-restore-20261008`.
- Private R2: `tuveloz-privacy-journal-test-20261008`.

Before deployment, verify the actual business account, included quota and each
new resource's identity. Never substitute a live/staging/backup binding or use
the example's placeholders. Prepare separate random access and signing secrets
through secret input, never source, command arguments or test evidence. Access
expires within one hour; missing/expired authorization denies before storage
access. The temporary endpoint must be approved before enabling a Worker URL.
The fixture substitutes synthetic owner verification only in this separate
bundle; it does not test production Access or authorize a real deletion.

The only operation is authenticated `POST /run` with `{ "step": 0 }`, followed
by each exact `nextStep` returned by a successful response. Records and SQL are
fixed; callers cannot select an account or supply SQL. Step zero refuses any
existing user table or bucket object before writing. Immutable per-step claims
and completion records prevent concurrent, repeated or out-of-order mutation.
A failed claimed step is never retried or reset automatically. An HTTP 403
denies before storage access and can be retried during secret propagation;
unknown outcomes and other errors require investigation. Preserve completed
step evidence before resuming after a denied request.

Schema creation uses batches of at most 20 statements in separate requests;
fixtures and each recovery check use separate steps. This avoids putting the
entire schema and rehearsal into one invocation on Workers Free, whose D1
limit is [50 queries per invocation](https://developers.cloudflare.com/d1/platform/limits/).
The local runtime test counts individual queries, including batch statements,
and fails above 40 per invocation. Retain sanitized responses and independently
inspect postconditions. Failures expose a fixed stage name, not SQL or secrets.
The checks cover signed completion/retry, conditional writes, journal tampering,
transaction rollback, ignored phone-code deletion, restored closure, exact
erasure and unrelated-account preservation. The result always keeps traffic
closed. Local tests cover access expiry and refusal of occupied resources.

After evidence is saved, disable the temporary endpoint and remove its secrets;
delete only the four newly identified rehearsal resources with authorized
cleanup. Failure or partial setup requires recording what remains. This remote
rehearsal does not establish the real journal's completeness, live source-write
pause, private journal production integration or a completed privacy request.

On October 8, the existing business Wrangler session was valid but lacked D1
administration. No broader authorization was silently requested. Remote setup
remains pending the required database/storage access and concrete test approval;
production PR #297 remains unchanged.

## Remote verification — October 9, 2026 (October 10 UTC)

Owner explicitly approved Account Read, User Read, Workers Write, D1 Write and
Background Access. Restarted expired OAuth; the broad Workers scope alone did
not authorize the subdomain API, so corrected the same Workers access with its
explicit `workers_scripts:write` scope. Business login and D1/R2 operations
worked. Do not restart this approval sequence or use every available scope.

Dashboard verified Workers Free, D1 2/10 databases and 3.97 MB/5 GB, with 1.65k
of 5M daily rows read and 0/100k written. R2 usage was 0.02/10 GB-months,
88/1M Class A operations and 309/10M Class B operations; displayed usage cost
was $0. No upgrade was made. Created only the named synthetic resources above.

All 50 remote steps completed, including all five recovery checks. Initial
HTTP 403 responses from temporary-secret propagation occurred before storage
access; only these denials were retried. Independent read-only D1 queries
verified all seven erased authentication categories, restored closure, and
expected other-account counts in both synthetic databases. An independent
journal-pair read verified the expected context/envelopes before cleanup.

Build/all 1,155 tests and typecheck passed; lint has zero errors and the existing
site-language warning. Nine focused checks include request-budget enforcement
and rejection of occupied resources, invalid order/reuse and expired access.
Evidence is in task outputs/privacy-recovery-remote-results-20261009.json,
privacy-recovery-{source,restore}-readback-20261009.json and
privacy-recovery-steps-{full,types,lint}-20261009.log. This confirms the synthetic
Cloudflare path, not production journal integration or a real privacy case.

Cleanup completed: removed the temporary Worker and both secrets, independently
read the journal pair and deleted its 103 known synthetic objects, then deleted
the empty bucket and both test databases. Resource inventories match the original
two D1 databases and four R2 buckets; the retired test endpoint returns 404.
Live health at 2026-10-10T02:46:56.357Z still reports c5c5fe1, ready application,
database/schema, open account/provider signup and closed bookings/payments.
The approved business Wrangler login remains available; the temporary Worker
secrets are gone. Evidence: task outputs/privacy-recovery-cleanup-20261009.json.

## Independent source reconciliation — October 9, 2026

`lib/privacy-erasure-catalog.ts` reads the current source's completed erasure
receipts and their closure evidence with one bounded read-only query. Replay
now requires a separate current-source database argument and exact agreement
between that inventory and the signed journal before changing the isolated
restore. Missing receipts, an empty/partial journal, extra entries, duplicate
requests, mismatched case metadata and orphan receipts all stop recovery.
Missing/failed source reads never become an empty inventory. The query reads
101 rows to detect overflow rather than silently accepting the first 100.

After restore readback, replay checks source agreement again and verifies that
the journal has not changed. Detected movement prevents a success result; it
does not undo an already committed restore batch. Traffic remains closed and
the operator must review the isolated copy. Source/journal contents stay in
memory and are not added to the response or logs.

This requires access to the current source, not its restored backup. If the
source is unavailable, stop: an independently preserved current inventory and
separately reviewed disaster-recovery path are still needed. Binding provenance,
actual source-write pause, in-flight intent reconciliation and journal retention
remain operational prerequisites. Comparing two empty or equally stale stores
cannot establish freshness. Object-identity rejection catches accidental reuse
of the same database handle but cannot prove two bindings identify different
remote resources. No public route, owner button, deployment binding or real
deletion is enabled. This remains a local change after the completed remote
rehearsal, not a new remote-verification claim.

Validation: build/all 1,162 tests and TypeScript passed; lint has zero errors and
the existing site-language warning. Synthetic SQLite tests cover exact membership,
all case fields, overflow/orphans, missing source and source/journal movement.
Local workerd/D1/R2 confirms an empty bucket cannot hide a source receipt, with
no restore mutation; the existing rollback/isolation/retry and request-budget
tests also pass. Evidence: task outputs/privacy-catalog-{full,types,lint}-20261009.log.

## Private storage adapter and owner read check — October 10, 2026

Implemented locally, not deployed. The private owner page now has a collapsed
**Account data deletion: recovery setup** section. Its explicit **Check recovery
setup** button calls GET `/api/admin/privacy-requests/recovery-status`. Opening
the page does not scan the journal. The route requires verified owner access,
rejects cross-origin reads, and uses private/no-store responses. It never writes
to the database or journal, sends email, enables deletion or selects a real case.
Loading disables duplicate checks; a failed refresh removes the old result.

The production-specific adapter in `lib/privacy-recovery-config.ts` accepts:

| Configuration | Required value or handling |
| --- | --- |
| `PRIVACY_ERASURE_JOURNAL` | R2 binding for the dedicated private `tuveloz-privacy-journal` bucket; created October 10, binding prepared locally and not yet deployed. Separate from uploads, backups, staging and restored snapshots. |
| `PRIVACY_ERASURE_CONTEXT` | Non-secret var `tuveloz-production`; cannot share a staging context. |
| `PRIVACY_ERASURE_SIGNING_KEY_ID` | Non-secret identifier of the current key in the restricted ring, such as `production-v1`. |
| `PRIVACY_ERASURE_KEYS_JSON` | Secret JSON object mapping 1–5 unique key IDs to independently generated 32-byte random secrets encoded as 64 lowercase hex characters. Set through restricted secret input, never command arguments or repository files. Keep old keys needed to verify retained records. |
| `SITE_URL` | Existing exact value `https://tuveloz.com`; this adapter refuses other environments. |

Missing required configuration returns **not configured** without accessing the
database. Invalid configuration, missing verification keys, storage/database
failures or catalog disagreements return a fixed **needs review** message with
no private values or raw exceptions. Valid reads and matching source receipts
return **read check passed**, not production readiness; `deletionEnabled` is
always false. Neither an empty catalog nor valid key formatting proves write
permission, real key entropy, actual bucket privacy/identity, freshness, source
pause or durable recovery. Confirm those independently during setup. A different
binding handle can still reference the same remote bucket, so the adapter's
alias check does not replace review of the deployed binding names/resources.

No `wrangler.jsonc` binding, secret, key or bucket was added by this implementation.
For the subsequent storage setup, first verify the business account and current
quota, create only the dedicated private bucket, verify public access remains
disabled, and store the new ring through secret input. Record only configuration
names and verification outcomes. Connect through the normal reviewed deployment
workflow. Do not change existing upload/backup bindings or expose an erasure
route. Owner approval for the earlier temporary rehearsal is not evidence that
permanent production configuration was performed.

Validation: build/all 1,169 tests and TypeScript passed; lint has zero errors and
the existing site-language warning. Synthetic route tests cover authorization,
cross-origin denial, missing/invalid configuration, upload/backup alias rejection,
cross-environment rejection, key rotation, missing source evidence and safe
errors; no write occurs during any read check. Chromium and WebKit at 320px and
1280px passed loading, clear errors, stale-result removal, missing setup and
rejection of an unexpected activation response. Existing closure interactions
still pass. Browser fixture writes are only the prior two deliberate synthetic
closure attempts; recovery adds four deliberate reads and zero mutations.
Evidence: task outputs/privacy-owner-recovery-{full,types,lint}-20261009.log and
outputs/privacy-owner-recovery-browser-20261009/report.json (names retain the
start-of-turn date; validation completed October 10).

## Permanent private storage provisioned — October 10, 2026

Created the empty `tuveloz-privacy-journal` bucket in the existing business
Cloudflare account after checking for duplicates. Verified disabled r2.dev
access, no custom domains, Standard storage and zero initial objects. Wrote one
clearly labeled synthetic file under a unique `setup-checks/` key, downloaded it,
verified identical SHA-256 hashes, and deleted only that probe. Subsequent
bucket information reports zero objects and zero bytes. This proves the CLI
storage path, not the still-undeployed application binding or signing operation.

Generated a fresh 32-byte random signing key in process memory and stored its
`production-v1` ring only in the new `PRIVACY_ERASURE_KEYS_JSON` Cloudflare
Worker secret through stdin. Verified that the name did not previously exist
and that all existing secret names were preserved. No key value was written to
source, evidence, command arguments or a local secret file. Do not regenerate or
replace the ring on a continuation. Secret installation updates the existing
Worker configuration; it did not publish this branch's code or enable deletion.

Prepared the dedicated R2 binding and non-secret context/key-ID vars in
`wrangler.jsonc`. Actual staging-generator output excludes this binding and
all erasure configuration; automated backup storage is separate, so its expiry
cannot remove this journal. No paid plan was changed. No lifecycle/retention
policy was invented for real records; the bucket remains empty and real
deletion unavailable pending the case-specific and operational review.

Live health after secret setup, at 2026-10-10T04:38:21.882Z, confirms unchanged
release c5c5fe1, ready application/database/schema, open signup and closed
bookings/payments. Build/all 1,171 tests, typecheck and lint passed (one existing
site-language warning). No UI changes since the prior phone/desktop checks.
Evidence: task outputs/privacy-production-storage-20261010.json,
privacy-production-storage-health-20261010.json and
privacy-storage-binding-{full,types,lint}-20261010.log.

Still required: publish the reviewed code/binding through the normal release
workflow, verify the actual owner read check and application storage access,
finish source-pause/provenance and pending-intent handling, and review deletion
controls/retention before exposing a real erasure action. This storage setup
does not mark privacy fulfillment or commercial launch ready.

## Released storage check and local interrupted-attempt review — October 10, 2026

The preceding publication requirement is complete: PRs #298/#299 deployed as
1c44c763f9b46cc323373c3e157f79ac7bbfe174 in successful production run 38028785155.
The owner button was verified against the deployed private binding. Migration
0072 passed after the narrow remote D1 parser correction. Preserve the existing
bucket, signing key and release evidence; do not repeat provisioning. The
remaining operational requirements below are still open.

`reviewAuthenticationRecovery` is a new internal diagnostic, **local only**,
with no HTTP route, UI caller or write operation. It authenticates each intent
and any completion, then compares exact receipt/closure metadata against the
current source database. Its returned case states mean only:

| State | Meaning and required follow-up |
| --- | --- |
| `no-source-receipt` | A signed intent exists but the supplied source returned no receipt. This does not prove deletion never happened; verify source identity/freshness and the case before deciding any next action. |
| `receipt-present-completion-missing` | Matching source evidence exists but its signed journal confirmation is absent. Independently check actual authentication records and the reviewed case before any explicit completion/retry procedure. |
| `matched-completion` | Both records exist and agree. This is evidence consistency only, not verification of account-data absence or permission to open restore traffic. |

The report always keeps `deletionEnabled` and `trafficMayOpen` false and requires
operational review. It includes case IDs/states only, not email addresses or
signed evidence. It rejects extra source receipts, missing closure metadata,
ambiguous attempts, damaged signatures, catalog/list-read disagreement and
observed changes during a second complete read. These reads do not create an
atomic snapshot or establish a write pause. Existing completed-only recovery
readers continue to reject unfinished intents.

The bounded diagnostic supports at most ten intents, four listing pages per
pass and fifty storage/database calls total. Overflow or excessive pagination
stops rather than returning a partial report. No unresolved record is removed,
ignored, confirmed or replayed by this check. Source-pause/provenance evidence,
an explicit reviewed resolution procedure and retention controls remain required
before real erasure can be exposed. No paid service or live configuration changed.
