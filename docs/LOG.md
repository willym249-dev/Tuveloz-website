# Working log

- **Status:** active
- **Owner:** hello@tuveloz.com
- **Last reviewed:** 2026-10-09

This is the shared memory between every chat session, tool, and person working
on Tuveloz. A conversation ends and takes its context with it; this file is what
survives.

**Newest entry goes at the top**, directly under this line. Read the top few
entries to catch up. Write one before you finish.

## 2026-10-09 - Fixed test access and completed isolated Cloudflare recovery

Explicit owner approval resolved the expired OAuth request. Corrected broad
Workers Write with its explicit Workers Scripts Write scope after Cloudflare
rejected subdomain access. Verified existing free allowances before provisioning.
Split the synthetic rehearsal into 50 ordered single-use steps to fit the free
plan's per-request limit; local tests enforce at most 40 individual D1 statements.
Build/all 1,155 tests, typecheck and lint passed (existing navigation warning).

Actual Cloudflare D1/R2 rehearsal passed all five checks, including signed erasure
and retry, tamper rejection, rollback, incomplete-deletion rejection and restored
account isolation. Independent database readbacks verified eight categories on
both synthetic databases. Temporary-secret propagation returned pre-storage 403s;
only those denials were retried, with saved step evidence. No failed mutation was
retried. A compound SELECT in the independent readback was replaced by scalar
subqueries to fit D1; this diagnostic did not modify data or application code.

Removed the test Worker and two secrets, 103 synthetic objects, private bucket
and both test databases. Original resource inventories preserved; test URL 404.
Live health still reports c5c5fe1 and the existing onboarding-only launch state.
No paid upgrade, production deployment or real account operation. No need to
repeat this completed rehearsal or authorization. Private production journal
integration, operational catalog/source-pause review and case-specific retention
remain unfinished. See operations/privacy-fulfillment.md and task evidence
outputs/privacy-recovery-{remote-results,cleanup}-20261009.json.

## 2026-10-08 - Prepared isolated recovery rehearsal; cloud access pending

Preserved b3b3e69 and live PR #297; refreshed main and found no open PRs.
Existing business Wrangler OAuth works but lacks D1 administration. No new
credential scope or cloud resource was created. Built a separate single-use
synthetic Worker with fixed data and current schema/engine, one-hour token
access, separate signing key, empty-resource preflight, atomic storage claim
and no public URL enabled in its placeholder example configuration.

Local workerd/D1/R2 verification completed signed erasure/retry, conditional
writes, corrupt-journal denial, rollback, incomplete-deletion denial, restore
readback and unrelated-account preservation. It also denies anonymous/expired
access and refuses any occupied source, restore or bucket before mutation.
Production build/all 1,154 tests and typecheck passed. Full lint had its existing
site-language warning plus a new anonymous-export warning; removed the new
warning, reran all eight package checks and targeted lint successfully, then
rebuilt the bundle. Evidence: task outputs/privacy-recovery-package-*-20261008.

The operator plan is in operations/privacy-fulfillment.md. Requested permission
for broader Cloudflare database/storage administration and a one-hour isolated
rehearsal using two empty databases, one private bucket and one protected Worker,
only if existing included quota covers it, followed by cleanup of those exact
new resources/secrets. Approval remains pending. No production deployment,
real records, live deletion, paid upgrade or launch change occurred. Local
success does not establish production journal integration or recovery readiness.

## 2026-10-07 - Verify restored authentication data before recovery success

Integrated published PR #297 into the preserved private recovery branch. Found
that replay trusted database command success without checking its postconditions.
It now reads back closure and absence of all seven authentication categories.
An unexpected trigger using RAISE(IGNORE) is caught. Associations remain while
anonymous phone codes remain, preserving retry's ability to remove those codes.
Verification failure leaves the restore isolated; committed changes are not
described as rolled back. Source-write pause and journal completeness still
require separate operational verification.

Actual local workerd/D1/R2 fault injection confirms silent passkey and phone-code
failures are rejected, unrelated credentials survive, and retry succeeds after
removing the injected failure. Nineteen focused tests and production build/all
1,146 tests passed. Typecheck passed; lint has zero errors and the one existing
site-language navigation warning. Evidence: task outputs/auth-erasure-readback-*
logs dated 20261007. No push, deployment, real record action, secret, binding or
launch change. Remote private storage/recovery integration remains unfinished.

## 2026-10-07 - Integrate completed PR #297 into private recovery work

PR #297 is deployed as c5c5fe1 and independently verified. Its release record
supersedes dated pre-release wording below. No open PRs were found before this
continuation. Merged current main into the preserved erasure branch, retaining
both working-log histories. The source merge was automatic. Recovery work is
still local: no live records, credentials, bindings or launch settings changed.

## 2026-10-07 - Signed recovery journal and isolated restore replay validated

Continued the existing local authentication-erasure branch; PR #296 remains the
verified live release. The internal erasure engine now requires a separately
stored, signed intent and a verified read before its atomic database mutation.
It verifies a signed completion afterward. Interrupted storage/database replies
are reconciled without repeating deletion; incomplete evidence returns pending
or blocks execution. A retry cannot invent a missing original intent.

Added owner/origin-protected internal replay for an isolated, migrated restore.
It validates the entire signed catalog before one transactional batch reapplies
closure and removes authentication records. It never opens traffic or treats a
supplied catalog as proof of current authoritative completeness. The operational
runbook records actual binding/key setup, source-write pause, catalog review,
isolated Cloudflare rehearsal and owner controls as unfinished prerequisites.
No route, production binding, secret, deployment or real deletion was added.

Fourteen focused checks passed, including a snapshot captured before closure,
unrelated-account preservation, rollback, interrupted intent/completion/DB
writes, tampering, missing signing keys, key rotation and pagination failures.
Final review found and fixed non-string signing-key lookup acceptance; a forged
prototype-key envelope is now rejected before any database write. Production
build/all 1,140 tests and TypeScript passed. Lint: zero errors, one existing
site-language navigation warning. Log: task
outputs/auth-erasure-recovery-full-20261007.log. All fixtures are synthetic and
network calls are prohibited in these tests. Broader file/vendor disposition,
case-specific retention and production/operator integration remain unfinished.

## 2026-10-07 - Internal authentication erasure engine validated

PR #296 is published as fe8ecbee94a5274f98ec40766b6d914960152162; its dated
pre-release notes below are superseded by the independently verified task
release record. Continued from that exact main on
feat/privacy-auth-erasure-20261007 without changing the deployed site.

Added an internal, owner-verified authentication erasure engine, scoped to seven
sources for a reviewed closed unused account. The plan returns counts/digest,
not private identifiers or credentials. One guarded insert rechecks request,
record versions and unused-account conditions; its trigger atomically removes
only approved authentication records and creates the audit receipt. Mid-delete
failure rolls everything back. Same-case retries confirm existing removal;
new holds, withdrawal or stale records conflict. Another account's explicitly
addressed phone codes and all provider documents remain. No privacy request is
marked fulfilled. Migration 0072 is empty on installation; health requires the
receipt table/trigger and the inventory explicitly classifies the new table.

Build/all 1,134 tests passed, including eight focused migrated-SQLite checks.
TypeScript passed; lint has zero errors and the existing navigation warning.
Log: task outputs/auth-erasure-full-20261007.log. No real case, account, private
queue, object or backup was read or changed. No route/button invokes the engine;
no push, migration deployment or real deletion. Do not expose execution until
durable recovery instructions and restore replay are ready. Backup source review
shows a separate private backup bucket and scoped retention prefixes; current
backup proof does not establish preservation of later deletions after a restore.
General file/vendor disposition and actual-case retention review remain open.
## 2026-10-07 - Repair account review and closure on Cloudflare D1

PR #296 remains the verified published release. During separate recovery work,
the local Cloudflare runtime reproduced two defects not caught by the prior
Node SQLite fixtures: the owner preview exceeded the compound-SELECT limit,
and trigger-inclusive D1 change counts could report a conflict after closure.

Prepared a focused branch from current main, excluding the unfinished erasure
engine, migration 0072, journal bindings and deletion controls. The preview now
uses bounded JSON row groups for its inventory and a small flags CTE, preserving
one consistent snapshot and all existing subject predicates. The closure action
accepts trigger-inclusive counts for the closure insert while still requiring
the exact separate audit insert and SQL changes() direct-insert guard.

The new ephemeral workerd/D1 test executes both actual routes using synthetic
owner identity and accounts: complete preview, both-role session revocation,
code invalidation, unrelated-account preservation, saved audit, safe retry and
different-review conflict pass. No external calls, deployment or real account
access occurs. Production Access authentication remains separately tested.
Production build/all 1,127 tests, typecheck and lint passed (one existing
site-language navigation warning). Log: task
outputs/privacy-closure-d1-full-20261007.log. Publication remains pending.
The first GitHub browser job timed out before tests: apt was still using the
Azure mirror through /etc/apt/apt-mirrors.txt. The existing official-Ubuntu
mirror replacement now includes that runner file in both verification jobs;
Ubuntu signing checks, suites and packages remain unchanged. No checks skipped.
Separate authentication/recovery work is safely retained on
feat/privacy-auth-erasure-20261007 at c72aa5a; its new D1/R2 focused runtime
checks pass, but production storage/recovery integration is still unfinished.

## 2026-10-07 - Verify review-field recovery and final closure build

A browser failure/retry check exposed an unstable accessible label when retained
notes were repopulated. The notes label now uses an explicit field association.
Chromium/WebKit at 320/1280 confirm retained case/notes, removal of stale action
controls, required fresh preview and no automatic retry. Only intentional
synthetic requests occur; external traffic is blocked. Production build/all
1,126 tests passed; TypeScript passed. The full-test log is task
outputs/closure-release-full-20261007.log. No real account or release changed.
Await the specifically requested publication approval and GitHub checks; general
privacy disposition/deletion remains unfinished, not hidden by these results.

## 2026-10-07 - Complete the unused-account closure race review

Completed the previously outstanding race checks: new payment, legal hold,
personnel, published profile, sponsorship and competing closure introduced
between preview and write all reject closure without a false audit. Combined
closure/access/preview suite: 31 passing checks. Corrected the fulfillment
status document, which had incorrectly still described the owner action as
unimplemented; historical test totals remain dated rather than overwritten.
The local feature is ready for release checks; no real account was selected,
push/deployment performed or general deletion completed. Publication approval
was requested for the concrete tested change and migrations. Keep every launch
lock unchanged. No open PR was found in the current GitHub read; fetched main
remains 9d898c8.

## 2026-10-07 - Reviewed access closure for unused accounts

Added an owner-only, same-origin closure action and deliberate form. The action
requires a verified case, confirmation of both roles, retention notes, a future
review date and a current snapshot. Closure and the verified-owner audit write
share one transaction; privacy fulfillment remains open. Job/payment history,
holds, published profiles and shared staffing require a separate process.
Migration 0071 adds the private review record and blocks new jobs/quotes against
closed accounts. No real account was read or closed. No deletion or email occurs.

Local verification: build and 1,119 tests passed, plus an additional passing
job-creation race case; TypeScript passed. Real form interactions passed Chromium
and WebKit at 320 and 1280 pixels using synthetic loopback responses. Not pushed,
published or deployed. Remaining: broader closure races and retention execution,
data/files/vendors/backups, and release review before publication. Launch locks
remain unchanged.

## 2026-10-07 - Prevent closed accounts from regaining sign-in access

Added an empty-on-installation closure table and transactional session/code
revocation. Application checks cover shared customer/provider eligibility,
password create/reset and step-up, phone changes and retained passkeys, including
the provider privacy-session fallback. Database triggers prevent stale session,
credential and access-method writes after closure. Runtime failures remain
closed. Health verification requires the table and twelve guarded triggers.
The privacy preview now explicitly classifies the additional closure table.

Eleven focused tests use real authentication/HMAC/password code and fully
migrated in-memory SQLite, with intercepted synthetic email. They prove atomic
rollback, unrelated-account preservation, refusal of an obsolete stored session,
all sign-in/recovery paths, stale writes and concurrent closure, plus rejection
of missing/ineffective health guards. Full build/all 1,114 tests and typecheck
passed; lint has zero errors and the existing navigation warning. The historical
migration test was bounded to its known range while keeping global index/tag
checks, so valid new migrations do not falsely fail it.

Local only; no account closed, real record read, vendor contacted or launch
setting changed. No closure-action endpoint, data deletion or reopening flow is
enabled. Reviewed scope/authority, provider media/eligibility handling,
retention/disposition, file/vendor execution and backup replay remain. See the
updated `operations/privacy-fulfillment.md` before continuing.

## 2026-10-06 - Add a read-only account-closure review preview

Open closure requests now offer an owner-only preview of records linked to
the shared customer/provider login. One SQL snapshot derives the subject from
the saved request and returns counts, recorded holds and explicit manual-review
gaps. It classifies all 77 application tables: 70 count sources and seven
manual sources. Shared records are review candidates, never deletion authority.
No credentials, tokens, file keys or document contents appear in the response.
Final/withdrawn requests are rejected, failures do not leak database details,
and refreshing a failed preview removes stale counts from the screen.

Build/full suite passed (1,102 tests); an additional shared-job/counterparty
isolation check then passed in the eight-test focused run. Typecheck passed.
Full lint has no errors and one existing navigation warning in
`site-language.tsx`, verified on main. Chromium and WebKit each passed phone
320px and desktop 1280px UI checks. Tests use real migrated in-memory SQLite
with query-only reads, real route/component code and synthetic accounts;
all external calls and mutations are prohibited in the browser fixture.

Local implementation only, not published. No real accounts, files, vendors,
policies, schema or launch switches changed. Account disabling and deletion
execution remain unimplemented; neither the preview nor a saved review decision
is completion proof. See `operations/privacy-fulfillment.md` for explicit gaps
and the remaining acceptance criteria.

## 2026-10-06 - Preserve withdrawn privacy requests during owner review

A local runtime test reproduced a concurrent-update bug in the general privacy
review route: an account-holder withdrawal between the owner's read and write
was overwritten with `completed`, and the route sent completion notifications.
The update now requires the saved status to match the status read for review.
If it changed, the route returns a private, non-cacheable 409 with a refresh
instruction before any notification is sent. Normal review decisions, owner
verification, same-origin validation and explanation requirements are preserved.

Validation: the regression failed with 200 instead of 409 before the repair.
The real route and an in-memory SQLite database now verify preservation of a
withdrawal and a competing review decision, correct normal completion, existing
withdrawal rejection, invalid notes, and owner/origin rejection. Build and all
1,095 tests, TypeScript and targeted lint passed. Authentication and transports
are isolated test adapters; no real request, account, email or deletion was used.
No schema, dependency, public policy, page layout or launch setting changed.
Publication is tracked separately; this entry is not deployment proof.

## 2026-10-06 - Bound provider multipart uploads before parsing

The existing 3.5 MB document validation ran after the complete multipart body
was parsed. A local runtime regression submitted a valid synthetic document
plus 3.6 MB of unused form data and received 201 instead of rejecting the total
request. No live endpoint, applicant or private document was used.

Provider evidence now reads at most 3,500,000 bytes plus 64 KiB for multipart
boundaries and small form fields before parsing. Both declared and actual
streamed sizes are checked; missing or understated Content-Length cannot bypass
the cap. Authentication and same-origin checks still precede body reading.
Oversized requests return 413; malformed or interrupted bodies return a useful
400. Both messages have Spanish translations. The per-document maximum remains
3.5 MB, and a full-size PDF still saves with normal metadata.

Validation: the original regression failed on the prior source, then passed
with no database writes, stored object or notification. Ten added checks cover
stream cancellation, absent/understated size headers, exact boundaries, malformed
uploads, localized errors and actual route persistence. Full build/all 1,090
tests, application/Worker typecheck and targeted lint passed. Existing Chromium
and WebKit upload checks passed five scenarios each, including photo resizing.
The route fixture supplies encoded HTTP bytes to avoid Node's outgoing FormData
encoder producing an asynchronous stream-close error when cancelled mid-field.

Local repair only; publication is pending. No schema, application requirement,
document acceptance, payment, booking or promotional-email control changed.

## 2026-10-06 - Preserve launch-email spacing after pauses and delivery outages

During PR #293 verification, the required security audit identified the newly
listed Sharp/librsvg advisory
[GHSA-wq5f-xc86-pv6w](https://github.com/lovell/sharp/security/advisories/GHSA-wq5f-xc86-pv6w).
Updated only the existing Sharp override from 0.35.4 to the maintainer's 0.35.5
patch and its platform packages; no Cloudflare tooling downgrade or forced
audit fix. Native loading reports librsvg 2.63.2. The security check now reports
zero vulnerabilities, and the full build/all 1,080 tests and typecheck passed
again with the patched dependency. The release still requires GitHub checks;
no failed security gate was bypassed and no production deployment occurred
while it was failing.

Reproduced three overdue launch emails across three simulated cron ticks in
30 minutes. Queue selection and outbox delivery now share a receipt-based
spacing check: the second email waits at least seven days after service
acceptance of the welcome, and the third waits at least 23 days after acceptance
of the second. Nominal consent-based due dates still apply. Pending, failed,
missing, malformed, legacy and superseded receipts cannot unlock a follow-up.
This uses existing outbox history without changing consent, cursors or schema.

The check runs before batch limits and again before transport. Already queued
follow-ups therefore wait without consuming attempts or blocking security mail.
The receipt is email-service acceptance, not proof of inbox delivery. Corrected
setup guidance so a registered-agent address is not automatically treated as a
qualifying commercial-email address; linked the FTC guidance in DEPLOYMENT.md.

Validation: the new regression failed against the previous source (three sends
instead of one) and passed after the repair. Nine added runtime scenarios cover
normal and delayed 0/7/30-day timing, exact boundaries, outages, old queued mail,
invalid receipts, batch fairness, a pre-transport recheck and renewed consent/
opt-out. The focused suite passed 42 tests. Full build/all 1,080 tests, the
repository typecheck and lint passed (zero errors, one pre-existing language
navigation warning). All email transports in the new scenarios are local
fixtures. No live email, subscriber write, configuration change or activation.
Publication is separate; existing postal, booking and payment controls remain.

## 2026-10-06 - Launch-update queue reliability and consent isolation

Reproduced lost sequence steps after a failed outbox save, new welcomes blocked
by older not-yet-due subscribers, stale cursor writes, and old pending mail
revived by a later signup. Queueing now saves a unique consent/step message
before conditionally advancing the same subscriber snapshot. Due filtering
happens before the batch limit. Retry selection and final delivery both require
current consent; legacy unbound messages remain preserved but suppressed.
The Worker now awaits queueing before flushing. Long delivery keys are hashed
to fit Resend's 256-character limit; existing valid keys remain unchanged.

Simplified the English and Spanish sequence wording without changing opt-in
wording, the 0/7/30-day schedule, or the customer fee/provider-price rules.
Build and all 1,071 tests passed, including 14 new local runtime scenarios covering
database interruptions, concurrency, renewed consent, opt-out, retry receipts,
batch starvation and long keys. TypeScript passed. Lint had no errors and the
existing language-navigation warning. Test email transport was intercepted;
only synthetic subscribers and a migrated in-memory database were used.

This is prepared local source, not a published or activated email sequence.
Postal-address configuration, bookings and payment locks remain unchanged.
Before enabling launch emails, separately verify the current opt-in audience,
usable mailing address, cadence/backlog and any legacy outbox delivery history.
No cursor rewind or automatic resend of historical mail is authorized here.

## 2026-10-06 - Make invoice receipt browser verification deterministic

PR #290's production check exposed an ambiguous status locator while the
confirmed invoice receipt and two loading notices coexisted. The fixture now
holds the saved-copy refresh to reproduce that exact transition. The old
locator failed all four English/Spanish Chromium/WebKit cases. The corrected
locator requires the exact invoice success notice, then a settled refresh and
removal of the signing form. It retains exact receipt/document checks, blocks
duplicate signature submission, confirms one write and two reads, and requires
the confirmation to remain without an error after the refresh.

All 68 repair-record browser cases passed after correction. Targeted ESLint,
JavaScript syntax and diff checks passed. Only the browser test and this log
changed; application code, policies, account settings and launch locks did not.
Evidence is retained privately in task outputs/repair-receipt-status-20261006.
This work does not complete the separate tax process or launch reviews.

## 2026-10-05 - Patch the source-map dependency blocking verification

The required dependency audit for draft PR #290 identified
`GHSA-68fv-2mgg-jv7q` in the existing `source-map-js` 1.2.1 dependency.
Update only that lockfile entry to the upstream 1.2.2 security release,
within the ranges already required by PostCSS and Tailwind. Package manifests,
other resolved dependencies and the reviewed local `braces` patch are unchanged.
The fix addresses denial of service from malicious indexed source maps; it
does not change Tuveloz's policy text, payment behavior or launch settings.

Validation after the patch: dependency audit reports zero vulnerabilities,
all six existing dependency-patch checks pass, production build and all 1,056
tests pass, TypeScript passes, and lint reports only the existing navigation
warning. The draft still requires passing GitHub checks and approval of the
exact Provider Agreement revision before publication.

Sources: [upstream security release](https://github.com/7rulnik/source-map-js/releases/tag/v1.2.2)
and [reviewed advisory](https://github.com/advisories/GHSA-68fv-2mgg-jv7q).

## 2026-10-05 - Align provider tax setup with the initial application

The Provider Agreement incorrectly required a W-9 at signup, while the
application has no tax-form upload and says tax details come later. Update
section 12 and its Spanish translation to require accurate tax information
and required setup before receiving payments. Explain in both signup languages
that no tax-form upload is needed with this application. Keep the provider's
own tax responsibility and Tuveloz's applicable reporting obligations, without
selecting a tax form or claiming that Stripe automatically files it.

Prepare Provider Agreement version `2026-10-05.1` with a distinct release ID,
matching English/Spanish hashes and current consent fixtures. Preserve the
earlier October 5 fixtures and verify that old consent cannot stand in for
acceptance of this revision; all other policy documents remain byte-compatible.
No Stripe capability, collection workflow, application field, payment behavior,
fee, database schema or launch setting changes. Correct the public EIN record's
unsupported claim that W-9 collection was already built; company originals
remain private and the tax review remains open.

Validation: production build and all 1,056 tests pass, including the new
historical-acceptance case. TypeScript passes; lint has no errors and one
existing navigation warning. Local 390px browser checks cover the actual
signup checklist and agreement in both languages, English/Spanish switches
in both directions, no horizontal overflow and no console errors. Used only
a reserved example.com address and advanced to the checklist; no application,
email, tax information or payment was submitted. This is a prepared candidate;
approval and publication of the exact revision remain pending.

The local preview used an unmigrated D1 database, whose background email-outbox
query reported a missing table; no message was sent. The browser checks above
verify rendered copy and navigation only. Full automated tests passed
separately; the preview is not a backend or email-delivery rehearsal.

## 2026-10-05 - Reconcile provider document requirements in both policy languages

Terms section 4 and Provider Agreement section 9 incorrectly promised that
Tuveloz requests only documents required by law. Explain the existing legal,
platform, insurer and payment-processor requirements, scoped to the selected
services, location and owner/employee role. Update the complete Spanish pages
and remove one unused dictionary entry containing the old promise. No new
application requirement, credential standard, service activation or payment
behavior is introduced.

Prepare new October 5 Terms and Provider Agreement releases with matching
source hashes, translation hashes and current acceptance fixtures. Preserve
the prior fixtures separately and test that old provider consent and customer
request consent cannot qualify as acceptance of the new Terms, while original
records remain readable. Keep legacy English consent format compatibility for
records that reference the current policies.

Validation: production build and all 1,055 tests pass. TypeScript passes; lint
has no errors and one existing navigation warning. Local browser checks verify
both updated pages in English and Spanish, both language-switch directions,
the October 5 dates, no horizontal overflow at 390px, and no browser console
errors. The first sandboxed test attempt could not resolve some project paths;
the complete rerun with the required local access passed. Publication and
approval of these exact policy revisions are pending; customer bookings and
live payments remain closed. Remaining legal, insurance, tax and refund review
is recorded in `docs/legal/provider-service-requirements-review.md`.

## 2026-10-05 - Bind repair records to the reviewed job and document

The repair-record workspace previously handled only test jobs and let a
signature request omit the identity and hash of the document displayed to the
customer. Its provider forms also required editing raw line-item JSON. Connect
the workspace to accepted jobs, use ordinary itemized fields, and bind each
save or signature to the reviewed quote, scope and document. Real writes still
require the existing launch, service and current provider-readiness checks.
Saved participant copies remain readable while new actions are paused.

Guard document and acceptance writes together against concurrent changes. A
customer may explicitly acknowledge a missing secure-account copy only for an
unchanged invoice with a matching existing signature acceptance; original
signature and nonblank delivery evidence remain immutable. No record action
charges, refunds or releases money, changes policy consent text, or opens the
marketplace. New frozen records retain the existing provider certification
wording; older signed records and hashes are preserved.

Validation: the production build, all 1,053 tests, TypeScript and lint pass
(one pre-existing navigation lint warning remains). The new browser suite
passes 68 cases across English/Spanish in Chromium/WebKit at a 320px phone
width. Migrated-SQL tests exercise real authentication, ownership, stale
drafts, concurrent signatures, rollback, missing signature evidence, copy
recovery and zero financial or external-network activity. Independent review
is clear after fixing draft revision resets, consent/evidence validation and
uncertain-save messaging. Publication is recorded separately.

## 2026-10-04 - Recover provider checklists and clear completed certificate drafts

Incomplete successful checklist responses could crash the provider page or leave
it loading indefinitely. Validate the displayed record structure, bound reads,
and offer an English/Spanish retry that preserves the last readable checklist
and typed drafts. Ignore superseded reads and refresh current state after a
confirmed agreement update so a delayed response cannot replace newer evidence.
Failed follow-up reads preserve confirmed write receipts.

A completed application's optional certificate list and opt-in also survived
starting another application. Clear both only after confirmed submission so a
second applicant does not inherit the first applicant's certificate details.

The old behavior was reproduced in local Chromium and WebKit fixtures. Browser
regressions cover both languages, malformed and stalled responses, retries,
draft preservation, delayed reads, and success followed by a new applicant.
The provider-form suite passes 40 cases and checklist suite passes 120 cases.
Full build and all 1,040 tests pass; independent source review is clean after
correcting the concurrent-update ordering. No policy, eligibility, API write,
payment, schema or launch-setting change. Publication is recorded separately.

## 2026-10-04 - Check signed invoice evidence before reserving a provider transfer

The payment route could request a Stripe transfer before the database's final-
invoice release trigger checked the customer signature and delivered/retained
copies. Read those existing migrated fields, validate the exact invoice and
payment binding before processor access, and atomically match/capture the
reviewed invoice when reserving a new transfer. The existing database trigger
remains a backstop; uncertain and legacy transfers retain their recovery path.

Migrated-SQL regressions reproduced transfer-before-rejection on the old code.
All 35 focused cases now pass, including missing evidence, mismatched invoice
bindings, stale snapshots and existing lost-reply/idempotency behavior. The
build, all 1,040 tests, TypeScript, targeted lint and independent review pass.
No new policy, deadline, signature substitute, schema migration, financial
operation or launch setting is included. Publication is recorded separately.

## 2026-10-04 - Clarify owner readiness configuration labels

The owner readiness page described live Stripe configuration as sandboxed
and declared inbox delivery testing unfinished even though its email check
only reads configuration. Use a neutral Stripe mode/permission heading and
configuration-context badge, and explain that delivery evidence is reviewed
separately. The configuration predicates, evidence requirements, owner access
and every launch/payment control are unchanged.

Nine existing owner-workplan and integrated-review checks passed. This is a
wording-only correction; publication is recorded separately. No new test,
provider record, financial operation or policy version was introduced.

## 2026-10-04 - Read-only owner refund estimate

Reuse the existing proportional refund calculator inside a collapsed section
of the owner review. The owner enters a hypothetical labor amount; the result
separates labor, the matching Customer Service Fee return and the customer
total. The estimate does not decide the justified amount, confirm Stripe funds,
save an approval, send a refund or recover money from a provider.

Only undecided customer cancellations/no-shows with matching paid labor-only
scope and recorded authorized work may be estimated. Prior adjustments,
refunds, transfers, disputes, holds and uncertain records block this limited
calculation. Provider cancellations and before-work cases retain the full
refund rule. Direct payment-ID history is included even when a saved row's
request/quote references disagree. Quote and start evidence remain private.

The initial detail request can no longer replace a newer explicit refresh:
request generations discard delayed successes and failures. Estimates clear
on input, case, snapshot or refresh changes, and stay disabled after failures.

Build, all 1,029 tests, TypeScript, targeted zero-warning ESLint and actual
Chromium/WebKit phone checks passed, including 320px layout, exact $40 + $2
calculation, delayed responses, malformed refreshes and no calculation writes
or network requests. Signed-owner/migrated-database integration checks prove
GET does not write or call Stripe and partial-amount POSTs stay rejected.
Independent review found no remaining issue after the loading-race repair.
The existing full-refund workflow, policies and launch locks are preserved.
This validation is local; publication is recorded separately.

## 2026-10-04 - Keep reversed provider transfers visibly under review

A matching transfer that Stripe later reversed could remain displayed as
released. The owner status check now saves a permanent, zero-impact review
marker for a verified full or partial reversal. The signed payment webhook
also handles `transfer.reversed` by reading Stripe's current transfer and
checking the exact original job, payment, account, charge, amount, currency,
mode and execution reference. Missing local records remain retryable;
conflicting records cannot be adopted. No refund or reversal is initiated.

The marker and original transfer reference are saved in one conditional D1
batch. Duplicate observations produce one marker; interrupted writes retry
safely. Historical release, refund, dispute and reservation records remain
intact. Later stale success responses cannot clear the warning or confirm
another transfer. Owner refreshes display the warning independently of later
refund/dispute status changes; failed or malformed responses preserve the
last good view and disable actions. This is review evidence, not a complete
recovery ledger, provider debt decision or collection authorization.

Local validation: 1,001 tests, TypeScript, targeted zero-warning lint, full
application build, and 52 Chromium/WebKit phone cases passed. Independent
backend review found no actionable issue. No schema, payment policy, timing
rule, live key gate or marketplace launch setting changed. Required release
checks and live verification are separate. The existing Stripe destination
must include `transfer.reversed` before automatic delivery can be claimed;
previously ignored receipts require the owner status-check fallback.

## 2026-10-04 - Compare paid scope and provider invoice in refund review

The collapsed owner evidence section now shows the saved scope attached to the
original payment and the same provider's invoice for that version. It does not
substitute a newer scope or another provider's record. Missing, mismatched,
malformed and unavailable evidence is explicit; draft/final invoices remain
distinct. Valid records show service codes, itemized prices and a plain-text
work summary. Equal saved amounts do not establish completed work or a refund
entitlement. Contradictory amount-match claims cannot replace the last valid
view or permit approval.

These read facts are included in the review token and atomic approval recheck,
including a row inserted after the review showed it missing. Changes require
fresh review. Existing authentication, no-store responses, eligibility rules,
payment submission confirmations and launch locks are preserved. No schema,
processor call, policy deadline or provider-recovery execution is added.

Prepared source passed 40 focused signed-owner/SQL/response tests, TypeScript,
targeted zero-warning lint, full build, phone checks in Chromium/WebKit (down
to 320px), and independent review. Source/test files are carried unchanged into
this focused release branch; the separate unused recovery calculator stays
outside this change. Full required release checks and live verification remain
separate from this local evidence.

## 2026-10-03 - Read-only evidence in cancellation refund review

The owner screen now expands the work, incident hold, saved payment/transfer,
and adjustment records already read for its current cancellation. Original
labor, customer fee and total labels no longer imply that an undecided or
blocked case has an approved full refund. The evidence section is collapsed
initially, separates decisions from confirmed movement, and retains the last
valid view while blocking approval after malformed responses.

The response projection omits raw notes, contacts and processor payloads.
Signed-owner route tests use query-only SQLite and verify no database writes
or Stripe calls, unchanged holds and refusal of blocked approvals. Review
eligibility, mutation paths, schema, policies and launch controls are unchanged.
This is a review aid, not provider recovery or partial-refund execution.

Validation: build and 977 tests passed, TypeScript passed, lint has only the
existing language-navigation warning, and npm audit found zero vulnerabilities.
Chromium/WebKit synthetic phone checks passed, including 320px wrapping,
keyboard disclosure, malformed-evidence recovery and unchanged submission
controls. Independent code review found no actionable issue. No real provider,
payment, refund, recovery, notice or public policy was created by these tests.

## 2026-10-03 - Atomic refund rehearsal requests and decisions

Reproduced three failures in the separate test-refund workflow: an initial
request survived a failed audit write, an approval survived a failed audit
write, and a request amount changed during review could receive the stale
allocation. Requests and decisions now save with their audit event in one
conditional D1 batch. The commit rechecks the captured adjustment, quote,
latest authorized price, assignment, test flags and audit history, and rejects
Stripe payment bindings. Conflicts save nothing; interrupted batches roll back.
Uncertain responses direct the user to refresh saved records before retrying.

Price calculations and commit comparisons use the same captured source rows,
including the existing cancellation rehearsal. Eleven new regression groups
exercise actual migrated SQLite and the route with synthetic authentication:
both write failures, forced simultaneous requests/decisions, lost committed
responses and safe retries, changed evidence/assignment/test flags, current
change-order prices, Stripe bindings and preserved incident holds. The focused
file passes 27 tests. The production build and all 972 tests pass locally;
TypeScript, lint (one existing site-language warning), and the dependency
source checks/high-severity audit also pass. Independent source review found
no remaining actionable issue after the insert-select correction.
An insert-select field mismatch found in the first focused run was corrected
before these passing results. Hosted release checks remain pending here.

This repair adds no real refund execution, partial-refund policy, provider
recovery, schema change or launch setting. Existing fee allocation rules are
unchanged. It starts from released PR #279; unpublished business notes and
proportional-refund preparation remain outside the release branch.

## 2026-10-03 - Dependency patch file-count clarification

The provenance comparison confirms five changed runtime library files plus
separate package metadata changes. The prior entry's count of six runtime
files was incorrect. index.js, lib/utils.js and LICENSE are unchanged from the
verified npm archive. The patch README and PR description now use the verified
count; implementation and tests are unchanged.

## 2026-10-03 - Explicit private fork identity for the dependency patch

The first hosted run passed all six patch integrity/behavior groups, but npm
10.9.2 still flagged the unchanged upstream name/version; local npm 12 had
omitted that local package. Both audits use package metadata, not source
analysis. Corrected the private copy's identity to
@tuveloz/braces@3.0.3-tuveloz.1 and its repository links. The original API alias,
authors, MIT license, upstream archive/version and exact runtime patch remain;
the provenance hash explicitly records the metadata change. This is a local
fork, not an official upstream fixed release or an advisory suppression.

Downloaded the exact official npm 10.9.2 into the private test-output folder
without replacing the machine's npm. A fresh independent install, all six
source/resolution/behavior checks and its unchanged high-severity audit pass.
Unrelated lockfile metadata rewrites were excluded. The earlier 961-test/build
result covers the identical runtime code; required GitHub application checks
will validate the final fork metadata before merge and deployment.

## 2026-10-03 - Pinned build dependency depth protection

PR #279's security gate found GHSA-vfj7-8cjw-p6xm in the transitive build/lint
dependency braces 3.0.3. The npm registry still has no patched release. Added
a private local copy from the integrity-verified 3.0.3 archive with only the
six runtime-file changes proposed in upstream PR #72 at immutable commit
d0d575e55e74a4e0218e5248fafb79efc3e54ebb. That proposal is not merged or
maintainer-released; Tuveloz maintains this temporary copy. Original version
and MIT license remain. Source provenance and replacement instructions live
in vendor/braces/TUVELOZ-PATCH.md; no other dependency changed.

The patch caps parser and direct-AST recursion at 100. A bounded-stack run of
the original package reproduced compile/expand stack exhaustion; the patched
copy rejects deep inputs before recursion, while ordinary matching and allowed
boundary patterns pass. The root override routes all installed consumers to
the checked-in source. npm audit does not inspect local package source, so the
existing security command now requires pinned hashes, consumer resolution,
lock constraints and six executable regression groups before the unchanged
high-severity audit. No advisory ignore or reduced threshold was added.

A fresh independent npm ci succeeded. Production build and all 961 tests,
security checks, TypeScript and lint pass locally (one existing site-language
warning). An initial relative-link install failed and was replaced by the
root dependency reference before the clean successful install. The original
worktree's dependency directory was preserved. Required GitHub checks and
production verification are still pending at this entry. This changes build
dependencies and the already documented cancellation rehearsal repair only;
no real transaction, schema, policy or launch/payment switch changed.

Review the upstream replacement again by October 17; do not remove the local
source checks until a reviewed official replacement passes the full suite.

## 2026-10-03 - Atomic cancellation rehearsal decisions

Reproduced two defects in the persisted-test cancellation route: a competing
decision could be overwritten, and failure between separate writes could leave
an orphan refund adjustment. The decision, test adjustment, job status and
lifecycle audit now share one conditional D1 batch. Its unique event claim
requires unchanged cancellation/quote/authorized-price history, assignment,
test flags and audit history, and rejects any Stripe payment on the job.
Conflicts save nothing; write failures roll back the batch. An uncertain
response instructs the owner to refresh saved records before trying again.

Seven added regression groups exercise real migrated SQLite and the actual
route with fixture authentication: competing decisions, every write failure,
lost committed responses, simultaneous approval/denial, zero-refund/denial,
changed price/assignment/test flags, latest authorized prices and retained
incident holds. Both original defects failed before the fix. Local production
build and all 955 tests pass, as do TypeScript and lint (one pre-existing warning
in unchanged site-language.tsx). A sandbox directory-access error and a test
fixture column typo were corrected before the final passing run.

This is test-accounting consistency only: no real refund, partial-refund rule,
provider recovery, active policy, schema, account, credential or launch switch
changed. Prepared on an isolated branch from released 7bd07ce; unpublished
business notes and proportional-refund preparation are excluded. Publishing
under the owner's standing instruction to publish fixes and continue; PR and
production verification still pending at this entry.

## 2026-10-02 - Receipt language preparation repair

Source review found that Checkout received the selected `locale` while Stripe
Customers had no corresponding `preferred_locales`. Stripe's current
[customer localization guidance](https://docs.stripe.com/billing/customer#localization)
documents that separate email/PDF setting. The local repair sets and confirms
that preference before creating a new Checkout Session.

Signed-in customers retain the existing verified account mapping and saved-card
option. Guest/token-only payments use a separate payment-scoped Customer and
never look up saved cards by email or write an account mapping. Stable customer
creation parameters and a payment-scoped idempotency key permit retry after an
interrupted preference update. Every new mutation checks the existing runtime
checkout gates; a final recheck still precedes opening Checkout. Failure or a
mismatched Stripe response prevents session creation. No fee, policy, migration,
package, invoice creation feature or launch-control setting changed.

The actual customer-preparation/session-creation route segment reproduced the
missing preference for English/Spanish account and guest flows before repair.
Sixteen isolated behavior cases now pass, including guest isolation, retries,
update failures and a pause arriving during preparation. The complete local
production build and all 948 tests pass; TypeScript and lint pass with one
unchanged language-navigation warning. Earlier sandbox esbuild access errors
were resolved with approved normal filesystem access, not a code workaround.
The existing saved-card source assertion now follows the new receipt binding.

This proves request preparation with synthetic clients, not actual Stripe
receipt rendering or inbox delivery. Hosted receipt-language confirmation is
still required. Existing open sessions retain their original presentation;
the repair does not resend receipts or rewrite historical payments. Required
GitHub checks and publication remain pending at this entry. Prior local
refund/mailbox notes are preserved on `review/payment-case-proposal-20261001`;
they are not included in this repair branch.

## 2026-10-01 - Verification runner mirror repair candidate

PR #276 is already published as `2e19545`. Its first production verification
attempt exhausted the 25-minute limit after browser dependency installation
took 8 minutes 24 seconds. The public log shows repeated Azure Ubuntu mirror
retries: apt fetched 125 MB in 7 minutes 50 seconds; browser binaries then
downloaded in roughly 13 seconds. A same-commit retry completed the release.

This candidate changes only the disposable verification runners' exact Azure
Ubuntu mirror URL to the primary HTTPS Ubuntu archive. Suites, components,
signing keyrings, other package sources, job names, permissions, timeouts and
all prior checks remain unchanged. No production deployment logic, website,
policy, launch control or package version changes. Ubuntu's
[package guidance](https://ubuntu.com/server/docs/package-management/) documents
the primary archive and its [integrity guidance](https://documentation.ubuntu.com/security/software-integrity/archive-verification/)
describes the retained archive-signature verification.

Local YAML comparison preserves all 44 prior steps exactly. GNU sed fixtures
verify exact-host replacement, preservation of security/signing sources and
unrelated hosts, and idempotence; Bash syntax and diff checks pass. Hosted
installation and the complete GitHub checks remain pending at this entry.
No speed guarantee or additional package/cache is introduced.

## 2026-10-01 - Provider transfer recovery candidate

Isolated tests reproduced three defects after PR #275: a lost Stripe reply
could allow a later retry to create another transfer after processor key
expiry, an incorrect transfer receipt could be saved as success, and a
late reply could overwrite a newer payment dispute. This candidate reserves
one permanent execution in the existing payment-adjustment ledger before
submission, validates the settled charge and exact transfer receipt, and
preserves newer refund/dispute statuses when recording the money movement.
The reservation checks current payment, job, quote, scope and hold records
atomically. No migration or new financial policy is included.

An uncertain attempt can only look up the existing Stripe transfer; it never
automatically sends a replacement. Missing, conflicting, reversed or changed
receipts remain under review, including a reservation interrupted before any
send. The owner screen offers Check transfer status, bounds requests, prevents
duplicate clicks, validates confirmations and keeps the last valid list after
a failed refresh. A confirmed Stripe transfer is explicitly distinct from
arrival in the provider's bank. The existing API still returns canRelease=false.

Validation: build and 932 tests passed, including 15 new migrated-SQL/route
checks. Twenty-four isolated mobile cases pass on Chromium at 390 pixels and
WebKit at 320 pixels. TypeScript passes; lint has only the existing
site-language navigation warning. Test Stripe calls, eligibility and owner
identity are explicitly synthetic; external network is forbidden in the
route fixture. This is not live Stripe, bank settlement or real-provider proof.
Evidence logs are retained in ignored task outputs. Required hosted checks,
publication and exact live verification remain pending at this entry.

All onboarding, booking, Stripe, SMS, eligibility, legal-version and schema
controls remain unchanged. No real account, payment, transfer, refund or
message was created. Partial refunds, provider recovery rights, operating
transfer terms and genuine launch evidence remain separate; preserve the
completed PR #275 release and keep the owner's real application last.

## 2026-10-01 - PR #275 published and independently verified

Continuing the owner's authorized website fixes, PR #275 merged the exact
tested head `617693d9fcbe1d101e5144103c298137cda426cf` at
`2026-10-01T05:11:30Z` as `86ae047a6186629b459934c70df28d6abf92a603`.
Required Verify run `36817189778` passed both jobs, including all mobile
recovery, migration, Spanish and real local signup checks. The separate PR
deployment rehearsal `36817190076` passed. Eleven protected source files also
match the prior release at the merged commit, including backend routes, legal
release metadata, eligibility, schema and launch/payment controls.

All three jobs in production run `36818597435` passed. Independent verification
at `2026-10-01T05:31:11.537Z` passed **37 live HTTP checks**: exact deployed
commit, healthy application/database/schema, English/Spanish pages, protected
quote decisions, unavailable public review submissions and closed customer
requests/payments. This completes the scoped decline/restore/review recovery
release. Its isolated evidence is **917 tests/build, 50 new mobile recovery
cases and 26 existing mobile consent cases**, with TypeScript passing and one
pre-existing lint warning. Live checks did not create a quote, review, message,
booking, payment or application; valid private interaction is proved in the
isolated browser/route fixtures, not through a real transaction.

Task evidence: `pr275-passed-pr-checks-20261001.json`,
`pr275-merged-release-20261001.json`, `pr275-local-validation-20261001.json`,
`pr275-preserved-boundaries-20261001.json`, `pr275-production-release-20261001.json`
and `pr275-live-release-20261001.json`. The earlier candidate below is historical;
do not repeat implementation, approval or publication. Corrected the recurring
legal-review row to preserve PR #274's already completed request/selection
consent. Partial refunds/provider recovery, real delivery/settlement, required
business/reviewer evidence and genuine provider verification remain separate;
the owner's real provider application stays last.

## 2026-10-01 - Customer quote and review recovery candidate

The separate decline/restore-quote and review follow-up is implemented on
`review/customer-quote-review-recovery-20261001`, not published yet. Six mobile
baseline cases reproduced stuck controls, uncaught network errors and duplicate
writes before repair. Bounded responses, a synchronous shared write guard and
validated saved receipts now recover these failures. An uncertain result keeps
the review draft/rating and requires a read-only saved-status check before any
deliberate retry; it never automatically repeats the write. Missing/corrupt
saved review state cannot unlock publishing. A failed secondary completion
lookup no longer discards otherwise valid quote/review state.

The existing language selector explicitly scopes authorizations and messages;
new recovery messages and review confirmations support EN/ES. This does not
claim full translation of the private request page. Private test-review wording
now describes its actual visibility. No legal text/version, backend route,
schema, eligibility, launch/payment switch or real record changed.

Validation on the final candidate: production build and **917/917 tests**,
TypeScript, lint (one existing language-navigation warning), **50/50** new
Chromium/WebKit mobile recovery scenarios and **26/26** existing mobile consent
scenarios passed. Actual route tests use migrated SQLite and verify returned
snapshots after decline/restore. Browser fixtures intercept every API request;
no real quote, review, message, booking or payment was submitted. The new suite
is wired into required release verification. Evidence is in ignored
`outputs/customer-request-recovery-*` logs/reports; publication must be recorded
separately with the exact release and independent live checks.

## 2026-10-01 - PR #274 published and independently verified

The owner said "continue" after the concrete PR #274 publication request. All
required PR checks passed on `204f5daba58eeb780dd672c600676c4134cd65b1`:
Verify Tuveloz `36810874305` (both jobs) and deployment rehearsal `36810874897`.
PR #274 merged at `2026-10-01T03:59:23Z` as
`2c455a599207e5f906b668857443ac091ae3299d`. All three jobs in production
workflow `36813021145` passed. Independent verification at
`2026-10-01T04:18:49.396Z` passed **33 live HTTP checks**: exact release,
healthy application/database/schema, bilingual account and policy pages,
paused request forms, rejected request submissions, private quote reads and
decisions, protected APIs, and closed checkout. Do not repeat publication,
request approval again, or describe the prior candidate state as current.

The isolated new-consent evidence remains 914 full regressions and 26 mobile
browser scenarios. Live request/selection interaction remains deliberately
closed; the release is not proof of an actual provider or transaction. Git blob
comparison confirms unchanged launch/payment controls, policy manifest, database
schema, legacy customer consent and provider acceptance helpers. No real
application, acceptance, booking, payment or message was created by this work.
Evidence: task outputs `pr274-merged-release-20261001.json`,
`pr274-production-release-20261001.json`, `pr274-live-release-20261001.json`,
`pr274-preserved-boundaries-20261001.json`, and the ignored production watch log.

Also completed the existing October 1 address-law checkpoint using the official
Chapter 247 page, current SDAT forms directory and statutory filing-fee source.
The law is effective; the qualifying mailbox operator and actual reviewed
principal-office-only filing remain unfinished. No filing, purchase or address
change was made. See operations/business-address-review.md. Existing public and
Stripe support address corrections remain complete.

The Gmail connector still identifies the personal account and browser inventory
exposes no connected Chrome or business tabs. No mailbox was searched or email
sent. This access boundary does not undo completed business-email activation.

Separate source follow-up: decline/restore-quote and publish-review handlers in
the private request page still use unbounded fetch/JSON awaits without recovery
guards. Recorded a focused reproduce-first item in OPEN-ITEMS; no production
failure was observed and this release makes no claim about those untouched
controls. Existing owner, coverage, tax, processor-delivery and actual-provider
requirements remain open. The owner's real provider application stays last.

## 2026-09-30 - Request and provider-selection bilingual consent candidate

Continued only the separate request/privacy/provider-selection work after the
completed PR #273 release. Branch `review/customer-request-selection-consent-20261001`
starts from that deployed commit plus its local verification notes. This is a
new candidate, not a second checkout release and not a customer launch.

- New explicit EN/ES request-scope, separate privacy and provider-selection
  presentations bind exact text, scope, released policy URLs/hashes and language
  to new `request-scope:4`, `request-privacy:3` and `provider-quote-selection:5`
  versions. The legacy helpers stay unchanged; existing records remain readable
  without mutation or relabeling. No migration or published policy-page change.
- Request consent clears after language/field changes, preserving the draft.
  Selection binds consent to the current request, quote, scope, price, language
  and evidence hash. Delayed responses cannot replace a newer language. Failed
  decisions require a read-only status refresh before a fresh approval, with a
  bounded wait and no automatic repeat booking.
- Separate native policy links open in another tab. Request receipts and quote
  authorization downloads retain the exact evidence string and hash. Dynamic
  names, service identifiers, timestamps and provider warranties stay literal.
  The private request page offers a clearly labeled authorization-language
  selector; this does not claim translation of every private-workspace screen.
- A blank confirmed-credential list no longer implies that no license or
  insurance is legally required. New EN/ES text states only that this quote
  shows no confirmed credential. The actual provider eligibility gates remain.
- Phone testing found long operation identifiers overflowing the consent label;
  targeted wrapping, readable body typography and language-select contrast fix
  it without changing the accepted text.

Local verification: production build and **914 tests passed**, TypeScript
passed, lint has only the existing `site-language.tsx:144` warning, and **26/26
Chromium/WebKit phone cases passed**. Eleven new module/real-route tests use
synthetic data and actual migrated SQLite: exact saved/returned consent, stale
or mismatched language/hash rejection, separate privacy consent, old-reader
compatibility, changed provider promises and duplicate approval rejection.
Eligibility is deliberately stubbed in the persistence harness; this is not a
real provider approval, external credential check or live booking/payment.

Evidence is in ignored `outputs/customer-consent-{suite,focused,routes,browser,
typecheck,lint}-20261001.log`, `outputs/customer-job-consent-browser.json`, and
phone layout previews. All marketplace, booking, payment and SMS locks remain
unchanged. Publication approval and required GitHub release checks remain; do
not report this candidate live. Remaining launch, coverage, tax and actual
provider evidence in the reconciliation checklist stays open.

## 2026-09-30 - PR #273 published and independently verified

The owner said "continue" after the concrete publication request and prepared
PR #273 summary. Continued with that prepared release after all required checks
passed on `1eaca2896f4ec23c93dfdb45b9c99da075527ce3`: Verify Tuveloz
`36803681406` (both jobs), and the deployment rehearsal `36803681570`.
The full verification includes all 903 regressions, migration/build/security
checks and the required browser suites, including 48 checkout cases. The earlier
Node 22.13 test-adapter failure is corrected; no application code changed for it.

PR #273 merged at `2026-10-01T02:16:55Z` as
`152639cdd7c12e2bb218be6a4c95d0b300b370d4`. Automatic production workflow
`36805092363` completed successfully in all three jobs. Independent verification
at `2026-10-01T02:35:45.175Z` passed **23 live HTTP checks**: exact release,
healthy application/database/schema, six EN/ES account/home surfaces, six policy
pages with canonical URLs and released wording, private APIs, and closed checkout
for English, Spanish and missing language. No account, application or payment
was created. Live checkout interaction remains deliberately unavailable; exact
consent behavior has isolated route/SQLite and 48 browser-scenario evidence.
No launch/payment lock changed. Do not repeat this merge or deployment.

Evidence: task outputs `pr273-merged-release-20260930.json`,
`pr273-production-release-20260930.json`, `pr273-live-release-20260930.json`,
and the repository's ignored final verification/production watch logs.
The new checkout version is published. This does not mark the whole marketplace
ready: the separate request-scope/privacy and provider-selection helpers still
need exact language-bound consent before customer jobs open. That source finding
and the specific unchanged paths are recorded in the existing payment review
and OPEN-ITEMS. Keep old records intact; do not repeat the completed provider
translations, PR #272 policies or PR #273 checkout integration.

The business-mail follow-up could not be refreshed: browser inventory exposes
only the empty in-app/MCP surfaces, with no connected Chrome tab; the Gmail
connector profile still identifies the personal account. No inbox was searched,
no email was sent and no new login was initiated. Prior county/broker inquiries
and completed business-email setup remain intact; a missing current connection
does not mean the business mailbox is broken.

## 2026-09-30 - Bilingual checkout consent implemented and locally verified

Continued from the verified PR #272 release without repeating its publication.
Remote main remains `e6fceca7`; no open PR or concurrent change was found. The
new branch `review/bilingual-checkout-consent-20260930` preserves the two local
release-record commits and adds exact customer checkout consent in English and
Spanish. Nothing from this branch is deployed yet.

New `checkout:6|lang:en` / `checkout:6|lang:es` evidence uses the published policy
bundle, exact translated URLs/titles and Spanish release IDs, dates and paired
hashes. Missing/stale/future translations fail closed. The approved merchant
sentence is included in both complete authorizations. Provider names, IDs,
scope, amounts and warranty text stay literal. The checkbox, download and stored
evidence agree; the download now includes the full stored evidence string/hash.
Policy links preserve the quote in a separate tab. A partial/stale response
shows a retry instead of crashing the card or enabling payment.

Validation: production build and all **903 tests pass**; **48 mobile Chromium/
WebKit scenarios pass**, including both warranty branches in both languages,
exact accessible checkbox text/download/hash/POST equality, translated links,
in-flight language changes, malformed presentation recovery and existing timeout
and retry safeguards. TypeScript passes; lint has only its existing navigation
warning. The real checkout route's acceptance insert/reread executes against
the actual SQLite migration and unique index: EN/ES records coexist, retries
preserve IDs/timestamps/evidence, a frozen published-v5 fixture remains intact,
and a conflicting record is rejected without overwrite. All data are synthetic;
the database test stops on an already-paid synthetic record before any Stripe
session operation. No external payment, account, email or provider record exists.

Evidence: ignored `outputs/bilingual-checkout-{tests,browser,typecheck,lint}-20260930.log`;
tracked `tests/fixtures/customer-checkout-v5-en.json` identifies its published
source commit. A test-fixture initialization ordering error was corrected before
the successful suite. GitHub's first rehearsal then caught a test-only Node
version difference: its pinned 22.13 runtime lacks `setReturnArrays`, available
in local Node 24. The acceptance test now uses the repository's compatible
object-to-array adapter and rethrows unexpected fixture errors for clear
diagnostics. Application code did not change for this correction. Required
checks must pass on the corrected PR #273 head before publication.

Next: required GitHub checks, owner publication approval for the new exact
authorization version, then normal deployment and independent verification.
The published policy pages/provider acceptance logic and all launch/live-payment
locks are unchanged. Full-refund allocation and payment timing are settled;
do not ask them again. Remaining launch reviews, genuine provider evidence,
receipt-language experiment and production settlement are still separate.

## 2026-09-30 - PR #272 published and independently verified

The owner-approved English/Spanish policy update is live as `e6fceca7aaf93553e54c3fac25c4828ae8483084`.
Production workflow `36797697298` completed successfully in all three jobs after
both required PR workflows passed. The exact production release, healthy
application/database/schema and launch locks were independently checked at
`2026-10-01T01:06:17.728Z`. Twenty-three HTTP checks passed: six updated
English/Spanish policy pages and their dates/collection wording/canonical URLs,
account pages, private API protection and closed checkout in both languages.
An initial probe used a lowercase sentence fragment against the capitalized
Spanish Payment Policy. The reviewed source was correct; only the probe's
case-sensitive comparison changed. No site edit or redeployment was needed.

Twelve additional live Chromium/WebKit checks at `2026-10-01T01:05:36.758Z`
clicked all five Spanish policy navigation links, checked mobile width, full
customer section/paragraph counts and canonical URLs, and switched the customer
page both ways. No page errors or missing Spanish routes occurred. Browser
requests were read-only. No account, application, email, payment or provider
record was created by these checks.

The release includes the complete Spanish Customer Agreement, clear payment
recipient/collection/transfer wording and the owner's full-refund allocation.
Historical provider acceptances are preserved; revised shared Terms/Payments
require fresh acceptance. The production site remains onboarding-only with
customer accounts/provider applications open and customer requests/payments
closed. Exact bilingual checkout consent remains unfinished; its current
English-only language guard is deliberately intact. This release does not
approve tax, coverage, legal duties, service launch or genuine provider evidence.

Evidence: task outputs `pr272-production-release-20260930.json`,
`pr272-live-release-20260930.json`, `customer-policy-release-state-20260930.json`,
and repo ignored `outputs/policy-live-browser-20260930.json`. Local build,
896 regressions, TypeScript and six isolated browser scenarios passed; lint
retains only the pre-existing language-navigation warning. Do not repeat this
completed publication or the earlier PR #271 repair.

The available Gmail connector identifies a personal account. Its inbox was
not searched; this turn did not refresh the business county/insurance replies.
Use the business account for that separate follow-up. Keep the pending owner
ownership/contributor clarification and the genuine provider application last.

## 2026-09-30 - PR #272 approved and merged; production verification pending

Owner explicitly approved: "Yes, publish after the checks pass." Both required
PR workflows passed on `e560e1fcae40d21850493f3e5c8012a5c86c26bc`:
Verify `36796197378` (account browser and full regression/migration/provider
signup/Spanish coverage jobs) and deployment rehearsal `36796197673`.
The complete server/browser test confirms the Spanish policy navigation repair,
all fifteen translated routes, signup and persisted drafts. Local production
build/all 896 tests, TypeScript, six Chromium/WebKit policy scenarios and lint
with its one pre-existing warning also pass on this final implementation.

Merged PR #272 at `2026-10-01T00:44:47Z` as
`e6fceca7aaf93553e54c3fac25c4828ae8483084`. Normal production workflow
`36797697298` is queued/running; this is not yet proof that the update is live.
Do not re-merge or trigger another deploy. The approved scope includes the three
revised policy versions, complete Spanish customer page and native Spanish
policy navigation. Live customer bookings/payments and the Spanish checkout
consent guard remain closed. Fresh consent is required for the revised shared
policies; old acceptance records are preserved.

Prepared independent post-release checks: task output
`verify-pr272-release-20260930.mjs` and repo ignored
`outputs/verify-policy-live-browser-20260930.mjs`. Run only after production
success against the exact merge SHA. The first checks health, six policy pages,
accounts and closed/private APIs; the second clicks all Spanish policy navigation
links and both language directions in Chromium/WebKit without submitting forms.
Continuity state is in task output `customer-policy-release-state-20260930.json`.
Record verified live results before reporting publication complete.

## 2026-09-30 - Complete bilingual customer policy candidate; publication pending

Prepared `review/customer-payment-policies-20260930` from the verified PR #271
release plus its two retained local handoff commits. No other open PR was found.
The owner previously chose payment at checkout and a full refund including the
5% customer fee for provider cancellation/no-show or pre-work customer
cancellation; these settled choices were not asked again.

Terms, Customer Agreement and Payment Policy now state the payment recipient,
collection versus provider-transfer timing and the approved refund allocation,
with matching Spanish wording. The complete customer translation is integrated
into the existing renderer, switch, policy navigation and metadata. It has all
11 sections and 17 paragraphs. Three English policy versions and paired Spanish
source hashes are prepared for September 30. No legal, tax, insurance or launch
review is claimed by this change.

Provider shared Terms/Payments get new versions; stale browser presentations
are rejected, dated historical fixtures remain intact, and the other four
provider policies retain their existing evidence. The new customer translation
has no provider acceptance hash and does not enable Spanish checkout consent.
No database writes, credentials, launch locks, payment logic or live charges
changed. PR #271's checkout-language boundary remains in force.

Validation: production build and all 896 regression tests pass; TypeScript
passes; lint has only the existing site-language navigation warning. The old
built-output assertions expected the retired merchant uncertainty wording;
they now assert the specific payment-recipient explanation. A sandbox-only
esbuild access error was resolved by rerunning with normal local filesystem
access. Six actual-component browser scenarios pass in Chromium/WebKit at
320/390/1280px: complete Spanish text, links, both language-switch directions,
persisted language, no page errors and no overflow. Existing full-server account
CI now also checks customer-policy navigation and Spanish metadata/hydration.
Required remote CI and owner approval of this exact policy publication remain.

Draft PR #272 is attached: https://github.com/willym249-dev/Tuveloz-website/pull/272.
Its initial deployment rehearsal passed, and the full-server account check
passed all fifteen direct Spanish routes including the new customer policy,
but caught a 404 on `/es/customer-agreement.rsc` during client-side navigation.
The Spanish policy links now use native document navigation because the Spanish
mirrors serve HTML, not vinext client routes. English links keep their existing
behavior. The account browser test now clicks all five Spanish policy navigation
links and fails on any missing client route. This is a real navigation fix, not
an ignored error or a relaxed test. Final-head checks must be rerun.

Private evidence: `outputs/customer-policy-{tests,regression,typecheck,lint,browser}-20260930.log`
and `outputs/customer-policy-browser-20260930/`. Update the same legal review and
prelaunch checklist after remote checks; do not report this candidate as live.

## 2026-09-30 - PR #271 published and independently verified

PR #271 is live as `61a2e4a65251d60a615f5eb9fe75d082ac0a1e88`. Both required
PR workflows and all three production jobs in `36670375767` passed, including
the full 894-test build, TypeScript, mobile browser, scanner, migration,
Spanish coverage and complete customer/provider signup checks. The focused
local checkout run passed all 36 Chromium/WebKit cases; lint retains only its
existing language-navigation warning.

Seventeen independent live HTTP checks passed at `2026-09-30T05:06:35.643Z`:
exact commit; ready application/database/schema; English/Spanish home and
account-signup routes; absent unsupported public account alias; protected
participant APIs; and closed checkout GET/POST for English, Spanish and missing
language. The first verification script incorrectly expected `/es/account`;
source confirmed private accounts translate through `?lang=es`. Corrected only
the probe and verified the intended alias absence; no website repair or repeat
deployment was needed. Evidence is in private task outputs
`pr271-production-release-20260930.json` and `pr271-live-release-20260930.json`.

New English consent now explicitly records its language and has a distinct
immutable version. Missing/mismatched or unavailable Spanish consent cannot
enable payment. Historical acceptances, active policy sources, provider
translations, fees and current launch locks are preserved. No real payment,
signup, email or reviewer approval was created by verification. This scoped
repair is complete; do not repeat its approval, merge, tests or release without
a new relevant change. Complete reviewed Spanish customer consent/policy
adoption remains separate. The owner's collection timing is settled; the
owner/contributor facts requested below remain unanswered.

## 2026-09-30 - PR #271 merged; production verification running

PR #271 tested head `556504ec9d8548b195732bcefb62200cd7c41911` passed both
required workflows (`36669213298`, `36669213457`), including the complete
customer/provider signup, mobile, language, scanner and fresh-migration checks.
The standard automatic approval review approved the requested merge/deploy.
It merged as `61a2e4a65251d60a615f5eb9fe75d082ac0a1e88` at
`2026-09-30T04:46:40Z`. Production workflow `36670375767` is running its
mandatory verification. Do not repeat merge approval or the merge itself.
The local checkout fast-forwarded cleanly to that merge. Live publication is
not yet independently confirmed. After workflow success, run the prepared
private `outputs/verify-pr271-release-20260930.mjs` with that exact merge SHA.

The separate owner question about LLC ownership and any outside human/company
code or asset contributions remains unanswered. Do not infer those facts from
Git author labels or a generic permission to continue work.

## 2026-09-30 - Checkout language boundary tested; collection timing confirmed

The owner explicitly chose payment at checkout, with provider transfer after
completion checks. That choice and the earlier full-refund amount are settled;
do not ask again. Updated the existing payment-policy reconciliation draft.
No active policy, hash, reviewer decision, charge strategy or launch lock changed.

Found a distinct consent gap: POST used `language` for Stripe labels while exact
authorization remained English, and readiness GET did not request a language.
The local fix requires explicit language, denies unavailable Spanish consent,
rejects missing/mismatched browser responses, and records English in both the
new `checkout:5|lang:en` immutable version and hashed evidence. Older records
stay untouched. Existing authorized payment status remains readable. Provider
translations are unchanged. This is a boundary repair, not completed Spanish
customer consent or policy adoption.

All 894 tests and the production build passed, including six behavioral route
tests with synthetic records: invalid/unavailable languages, current English,
old/tampered consent, launch lock and authorized status access. All 36 mobile
Chromium/WebKit scenarios passed, including wrong-language responses, the
Spanish explanation, fresh acceptance on switching back, literal text/download
equality and existing timeout/recovery controls. TypeScript passed. Lint has
only the existing `site-language.tsx:144` warning. Private ignored logs are
`outputs/checkout-language-{tests,browser,typecheck,lint}-20260930.log`.

The signed-in business Gmail search
`after:2026/09/27 {from:foundershield.com from:montgomerycountymd.gov}` showed
no matching messages. No inquiry was resent. No real payment, participant
record, external message, account setting, paid service or deployment changed.
This work is local and not yet published; preserve completed PR #270.

## 2026-09-30 - PR #270 published and independently verified

PR #270's tested head `90d6879` merged as
`c44c1ffda6e59dd038a4b0959b535442b629adb7`. Both required PR workflows
(`36664679771`, `36664679936`) and all three production jobs in
`36666328492` passed. This publishes the scoped full-refund booking-pause
exception and three compatible dependency patch updates described below.
Production build/all 888 tests, TypeScript, mobile Chromium/WebKit refund
workflows and the full release checks passed. Lint retains only the existing
language-navigation warning; the patched dependency audit reports zero findings.

Fourteen independent live HTTP checks passed at
`2026-09-30T04:10:31.663Z` (12:10 a.m. Maryland time). They confirm the exact
deployed commit, ready application/database/schema, English/Spanish homepages
and both account-signup pages, protected refund/payout and private participant routes, and
default-closed checkout. No real approval, refund, payout, customer submission
or email was created. Future live-mode refunds during a booking pause have
isolated real-gate route/SQL/Stripe proof, not a real-money transaction.

Private task outputs: `pr270-production-release-20260930.json` and
`pr270-live-release-20260929.json` (the latter retains its preparation-date name;
the recorded verification timestamp is September 30). This publication is
complete: do not repeat approval, tests, merge or deployment without a new
relevant change. Current onboarding, customer-pause, Stripe-live and SMS-live
locks remain unchanged. Remaining work includes policy adoption, exact
bilingual customer consent, partial/provider recovery and real launch evidence;
the owner's genuine provider application stays last.

## 2026-09-29 - PR #270 approved merge completed; production verification running

The owner directly replied "contniue" to the specific "May I merge and deploy
PR #270?" request, which described the refund-only exception, dependency patches
and unchanged current payment locks. With that new response, the standard
automatic approval review accepted the same merge action. The unchanged tested
head `90d6879` and both successful required workflows were rechecked first.
PR #270 merged as `c44c1ffda6e59dd038a4b0959b535442b629adb7` at
`2026-09-30T03:52:09Z` (September 29 Maryland time). Production workflow
`36666328492` is running its mandatory verification before deployment.
Do not ask for the settled merge approval again. Publication/live verification
is not yet confirmed. The one unpublished handoff commit was safely replayed
onto merged main; it was not pushed and did not trigger another release.

## 2026-09-29 - PR #270 ready; merge blocked pending explicit owner approval

PR #270 is OPEN and CLEAN at tested head
`90d6879e45bcdf21560be2d4305e3143eddd4385`. Both corrected-head workflows
completed successfully: Verify Tuveloz `36664679771` (account signup and full
verification) and Deploy Tuveloz PR rehearsal `36664679936`. Local production
build/all 888 tests and lint passed after the three dependency patches; npm
audit reports zero vulnerabilities. TypeScript and both mobile refund browser
checks also passed. The initial failed security run is retained, not bypassed.

Automatic approval review rejected the merge command before execution. It
requires explicit owner approval for this exact booking-pause refund behavior
and production deployment; the owner's preceding "continue" was insufficient
for that action. The specific question is now pending: "May I merge and deploy
PR #270?" Do not retry through another tool or change the tested head merely to
restart checks. No merge or production deployment occurred. PR #269 / `e2a8466`
remains the latest verified production release; current launch/payment locks
remain closed. Do not claim PR #270 is published.

Once explicitly approved, recheck the PR's exact head and required successful
workflows, merge with `--match-head-commit`, monitor the production workflow,
then independently verify the resulting merge commit. The prepared private
script `verify-pr270-release-20260929.mjs` checks fourteen live HTTP outcomes,
including default-closed checkout and protected refund/payout routes, without
creating a real transaction. It has not run against a new release yet.
Keep this handoff commit local until the next real code release, rather than
pushing it now and invalidating the already-tested PR head.

## 2026-09-29 - PR #270 security gate caught newly reported dependency advisories

The first Verify Tuveloz run (`36664273111`) failed the required npm security
check before application tests. Its separate account-signup job and the PR
deployment rehearsal (`36664273467`) passed; no merge or deployment occurred.
The audit identified the existing development dependencies brace-expansion and
fast-uri. The targeted update changes only three lockfile package entries:
brace-expansion 1.1.18 -> 1.1.21 and 5.0.9 -> 5.0.12, plus fast-uri 3.1.7 ->
3.1.8. The manifest and all other package versions remain unchanged; install
scripts were disabled. The resulting npm audit reports zero vulnerabilities.
Production build, all 888 tests and lint passed again on the patched dependencies
(lint retains only the existing language-navigation warning).
Do not bypass the security gate or merge the failed head.

## 2026-09-29 - Scoped booking-pause refund change implemented and tested

After the refund-only exception and preserved safeguards were presented, the
owner instructed "continue." The review and execution paths now use a separate
`refund` action, which omits only the booking-pause restriction. Live marketplace
mode, fresh database-backed release approval, Stripe live-key controls, owner
authentication, exact payment/approval facts and separate confirmation remain.
Transactions and provider payouts stay pause-blocked. Current onboarding-only,
customer-pause, Stripe-live and SMS-live defaults are unchanged.

The isolated migrated-SQL/Stripe route tests now run the actual gate with only
future marketplace mode and readiness simulated. They failed with the prior
payout coupling and pass after the change, including revoked readiness at the
last approval/submission recheck. Current default denial, every paused
transaction action and existing refund/duplicate/hold checks remain covered.
Production build and all 888 tests, TypeScript and mobile Chromium/WebKit refund
flows passed locally. No real transaction, credential, email, active policy or
launch review changed. This is not deployed yet; required PR/production checks
and exact-release verification follow. Preserve prior PR #269 fixes and proof.

## 2026-09-29 - Booking-pause refund boundary prepared; owner decision pending

Read-only inspection confirms that full-refund review/execution currently use
the payout action, so a booking pause blocks new refunds for already-paid jobs.
The pending owner question concerns a narrow future booking-pause exception;
the full amount including the 5% fee remains the already-settled decision.
The existing payment-policy reconciliation now specifies the proposed separate
refund action, unchanged mode/readiness/Stripe/owner/eligibility protections and
isolated behavioral checks. Protective refund notifications already have their
own classification and need no broader email permission.

No runtime code, live setting, payment, message or deployment changed. No tests
were rerun for this documentation-only preparation. The answer is required
before changing the refund gate. PR #269 remains complete; preserve the local
release-verification notes and do not push a documentation-only deployment.

## 2026-09-29 - PR #269 published and independently verified

PR #269 merged tested head `bad6672` as
`e2a84661a0ab717e53f79e258606371be15d806b`. Both PR workflows
(`36647748308`, `36647748642`) and all three production jobs in
`36649186327` passed. This publishes the refund-screen response validation and
confirmation repair described below, preserving the completed PR #268 work.
Production build, all 885 tests, TypeScript, lint (one existing navigation
warning), mobile Chromium/WebKit refund workflows and the full release gates
passed. No policy, fee, refund eligibility or live-release control changed.

Independent checks at `2026-09-30T00:32:37.807Z` (September 29 Maryland time)
passed twelve HTTP checks: exact release, healthy application/database/schema,
the published refund module, public account shells, protected owner refund APIs,
private participant APIs and closed checkout. The production asset filename
differs from the local build; its actual `/assets/page-HyzWGMiu.js` reference was
read from the live owner page and the new validation/recovery text verified.
The signed-in owner Payments screen and Refresh list control both load the
actual empty cancellation queue. No Tuveloz page error was captured; an earlier
Cloudflare sign-in transition message belongs to the vendor's page, not Tuveloz.
The public status screen independently shows Operational and release
`e2a84661a0ab`, with accounts/applications open and requests/payments closed.

No real refund, approval, application, email or customer record was created.
Malformed-response and money-action tests are isolated synthetic proof, not
production transactions. Private task-output proof:
`pr269-live-release-20260929.json`, `pr269-live-owner-refunds-20260929.png`,
and `pr269-live-status-20260929.png`. Complete: do not repeat this release.
Policy adoption, bilingual customer consent, future paused-refund operation,
partial/provider recovery and the remaining launch evidence stay unfinished;
the owner's genuine provider application remains last.

## 2026-09-29 - Refund screen reply validation prepared and tested

The owner refund screen accepted an empty HTTP-success approval reply and could
display "Approval saved" without an approval identifier. Its existing list and
detail checks also accepted incomplete nested rows that could crash rendering.
The new mobile browser regression failed against the previous component at the
missing approval-error check. The repair validates complete list/detail fields,
safe itemized amounts, the approval acknowledgment and its matching saved
decision before displaying success. A failed response preserves the prior case,
typed reason and status-only recovery; mutation controls require a fresh review
and confirmation. No automatic retry is added.

Production build, 885 tests, TypeScript and lint passed (the existing navigation
warning remains). Chromium and WebKit mobile tests passed for malformed approval,
nested detail and list replies, retained drafts/selection, paused read-only
recovery, explicit retry, amounts, sign-in recovery and no duplicate sends.
Tests use synthetic loopback responses; the signed-owner/migrated-SQL tests also
confirm that real route response shapes pass the screen's validator. Initial
sandbox test resolution was denied by Windows; the full suite passed with
normal filesystem access. No live refund, customer record, policy or gate changed.

Published and verified in PR #269; see the release entry above. Keep PR #268
complete. Refund initiation during a future
pause remains a separate reviewed operating rule; this repair does not loosen
the current payout or live-key gates. Local proof is in the ignored
`outputs/refund-response-*20260929.log` files and `refund-recovery-webkit.png`.

## 2026-09-29 - PR #268 published and independently verified

PR #268 merged tested head `68d99f6` as
`3748f7a5f6a72d29859ef51cd586c38410a7e570`. Both PR workflows passed, and all
three production jobs in run `36643894475` completed successfully. The release
includes complete existing checkout consent text, readable mobile metadata,
the narrow undici 7.29.1 security patch, and the preserved completed hosted
sandbox rehearsal helper/record. Full build and 881 tests passed; 32 mobile
Chromium/WebKit checkout cases passed, including new label/download equality
and clipping checks. npm audit reported zero vulnerabilities. Existing lint
navigation warning is unchanged; TypeScript passed.

Independent live verification at `2026-09-29T23:29:48.201Z` passed thirteen HTTP
checks: exact release, healthy application/database/schema, English/Spanish
public and account route shells, the published wrapping CSS, private API
authentication, closed checkout and unsigned/forged Stripe callback rejection.
Accounts and provider applications remain open; customer requests/payments
remain closed. No real account, quote, provider decision or payment was created.
Public browser confirmation is retained with the proof. Local evidence:
`outputs/checkout-consent-final-tests-20260929.log` and
`outputs/checkout-consent-browser-tests-20260929.log` in the repository;
`pr268-live-release-20260929.json` and `pr268-live-status-20260929.png` in the
task output directory.

Complete: do not repeat PR #268, its security patch, or the completed hosted
sandbox/refund rehearsals. The closed checkout's behavior is proved through
isolated local/CI browser and evidence tests; this release is not a live charge,
provider settlement, full Spanish customer policy adoption or launch approval.
No new broker/county reply was found in this turn's scoped business-inbox check.
Keep the genuine owner-provider application last.

## 2026-09-29 - PR #268 dependency audit repaired before publication

The first PR verification stopped at npm's high/critical security audit.
The existing Cloudflare build-tool chain resolved `undici@7.29.0`. The
[maintainer advisory](https://github.com/nodejs/undici/security/advisories/GHSA-rfgv-xxqx-mfg5)
and [7.29.1 release](https://github.com/nodejs/undici/releases/tag/v7.29.1)
identify the patched 7.x version. Added an exact `undici: 7.29.1` override;
the lockfile changes only that installed package's version, URL and integrity.
No audit threshold was weakened or broad Cloudflare/Next.js upgrade made.
The resulting npm audit reports zero vulnerabilities. Publication still must
wait for the new commit's required checks and exact deployed verification.

## 2026-09-29 - Exact checkout record repaired locally; no new broker/county reply

No open PR or newer main release was found before starting. The completed
hosted sandbox test and cleanup remain recorded below. The scoped business
Gmail search for broker/county replies since September 27 returned no matches;
no email was sent and the pending inquiries were not repeated.

Found a concrete mismatch in the closed customer checkout: its checkbox
included the labor-only sentence outside `presentedText`, while the download
and immutable evidence saved only `presentedText`. A new browser regression
failed on the extra, unrecorded checkbox text before the repair. Moved the
unchanged sentence into the server-generated text and the policy-reference
links outside the checkbox label. New acceptance keys use `checkout:4`, so
version 3 records are not overwritten or relabeled. Existing server comparison
rejects stale versions/hashes. English consent and literal provider values are
excluded from interface/browser translation. This does not adopt the proposed
merchant/refund wording or complete reviewed Spanish customer consent.

The subsequent visual phone check caught a second defect: the amount-style
two-column layout squeezed metadata labels to a few pixels while long names,
identifiers and warranty values overflowed their row. Long-text authorization
details now use full-width labels and wrapping values; prices retain their
compact columns. A regression failed before the CSS repair and now checks
readable label width and unclipped values on both mobile browser engines.

Validation: production build passed; all 881 tests passed after updating the
existing labor-only source assertion to its new shared location. Both warranty
branches, exact saved text/hash, changed provider/price hashes, checkbox label
and download equality, unchecked consent after downloads/language changes,
late-response recovery and unchanged launch locks are covered. All 32 mobile
Chromium/WebKit cases passed. TypeScript passed; lint passes with the existing
site-language navigation warning. Lint now ignores the disposable bundled
output from the completed isolated rehearsal, without excluding its source.
The first broad test attempt hit sandbox esbuild filesystem restrictions;
normal-permission rerun resolved them. No dependency upgrade, external API
transaction, active policy release or live-site change was made.

Status at preparation: local and tested. Proceeding under the owner's existing
authorization to publish fixes; publication and deployed verification must be
recorded separately when completed. Preserve the prior local rehearsal/helper
commits and all launch locks, and distinguish this accuracy fix from the
still-pending customer policy release.
Evidence is in local `outputs/checkout-consent-final-tests-20260929.log`,
`outputs/checkout-consent-browser-tests-20260929.log`, and the synthetic
`outputs/checkout-consent-{chromium,webkit}.png` screenshots. Earlier failing
regressions are diagnostic history, not unresolved launch defects.

## 2026-09-29 - Hosted sandbox Stripe delivery and duplicate handling verified; cleanup complete

The live payment destination still shows no event deliveries. Its setup and
the two prior local sandbox refund rehearsals remain complete; do not repeat
them. Private staging's owner-token gate correctly prevents direct Stripe
callbacks and was not changed.

After specific owner approval, deployed the separate guarded Worker and new
receipt-only D1, with an Events Read-only sandbox key and separate signing
secret. Created one unpaid sandbox checkout without customer/payment metadata
and expired it without opening Checkout or paying. Stripe's real deliveries at
22:21:03 and 22:21:25 UTC both returned 200; the second returned `duplicate:true`.
D1 retained one processed test-mode receipt, attempt_count=1, with unchanged
processed_at. The unchanged real payment route handled both deliveries.

Missing/forged hosted signatures returned 400 without a receipt. Six focused
tests, TypeScript, targeted lint, Wrangler build and a real local Cloudflare/D1
runtime check passed. The helper allows only the selected event/session and
platform context within its fixed one-hour window. No production code or
configuration, private staging, launch locks, or payment records changed.

Cleanup completed: disabled receiver confirmed 404; temporary Stripe key
revoked and destination deleted; Worker and receipt-only D1 removed; synthetic
inline price confirmed inactive. Stripe's immutable ad-hoc product remains
with the expired unpaid session/event as sandbox audit history. Original
databases/Workers and Stripe destinations remain. Wrangler's Worker delete reported a later missing
KV scope; independent Cloudflare UI confirmed the Worker was already gone.
No broader access or paid upgrade was added. Private proof:
task outputs/stripe-hosted-delivery-result-20260929.json
and the matching delivery/receipt/cleanup screenshots.

This closes the isolated **hosted sandbox transport** gap. Production-hostname
delivery with production secrets, live transactions/settlement and actual
provider/launch decisions remain separate; do not call this a live-payment pass.
Follow the indexed [rehearsal runbook](operations/stripe-hosted-delivery-rehearsal.md).

## 2026-09-29 - Checkout recovery published and independently verified

PR #267's tested head 9a310f7a0dc77f33d3077dcc01968e003fd7b951 passed both
required workflows 36538538486 and 36538538944. It merged as
676e6199cb18a1b6e044fd2d53eef543dd022eaa. All three jobs in production workflow
36539973097 passed, including the complete provider signup and 872-test build.
Thirteen independent live HTTP checks confirmed the exact healthy release,
English/Spanish signup pages, missing/forged Stripe signature rejection and
preserved onboarding-only controls. Accounts and provider applications remain
open; requests and payments remain closed. The stalled/lost-response recovery
has 28 actual mobile Chromium/WebKit scenario results using isolated responses;
no real checkout, charge, refund, provider record or valid callback was created.

Evidence: task outputs/pr267-verification-20260929.json,
pr267-build-check-20260929.json, pr267-production-release-20260929.json,
pr267-live-release-20260929.json and checkout-recovery-validation-20260929.json.
This repair is complete; do not repeat its tests, merge or deployment without
a new change or failure. The Stripe destination and secret installation remain
complete; actual Stripe-originated production delivery is still unproven.

The existing staging Worker requires owner verification for every request,
including webhook endpoints (worker/index.ts). A future hosted sandbox test
needs a separately reviewed receiver or forwarding design with isolated data;
do not disable owner protection or replace the live signing secret. The completed
local sandbox refund remains valid within its recorded scope. Private boundary
record: stripe-hosted-verification-boundary-20260929.json. Other remaining launch
decisions and the owner's last-step provider application are unchanged.

## 2026-09-29 - Stalled checkout recovery prepared and tested

No open PRs or competing repair existed before this work. Reproduced two failures
in the actual quote card with isolated browser requests: a stalled checkout POST
never leaves Opening Stripe, and a lost response leaves the previous acceptance
selected and the payment button available without a fresh status read.

The quote card now stops waiting after twenty seconds, cancels its browser
request, clears the old consent and offers an explicit quote/status refresh.
Network failures and unsuccessful server responses also require fresh review.
The refresh sends only GET; another POST needs new consent and an explicit click.
A late response cannot redirect, and already-paid status removes the payment
action. The new recovery explanation and action are available in English and
Spanish. Timer cleanup preserves unmount/scope-change protections. No server
guard, Stripe operation, policy text or launch switch changed.

All 872 tests and the production build pass, plus 28 mobile Chromium/WebKit
scenarios and 26 focused contract/fee checks. TypeScript passes; lint has only the
existing site-language.tsx warning. The two new failures were observed before the
repair. The first sandboxed full-suite run hit esbuild directory permissions;
the approved normal-context rerun passed. Private logs:
checkout-recovery-full-tests-20260929.log, checkout-recovery-browser-20260929.log,
checkout-recovery-lint-20260929.log. Publication and release verification are
still pending at this entry; no checkout or charge was opened.

Stripe's webhook guide (https://docs.stripe.com/webhooks#test-your-handler),
checked September 29, recommends sandbox/CLI events for tests. Preserve the
completed local Stripe refund rehearsal; the newly saved live destination has no
actual delivery evidence yet. Do not open bookings, send a live charge or replace
the live signing secret to manufacture test evidence. A hosted sandbox rehearsal
is a separate scope from live-originated delivery and eventual settlement.

## 2026-09-29 - Stripe payment connection created and matching secret installed

The owner continued after the exact request to create Tuveloz payment status and
store its matching secret in the existing Tuveloz Worker. Creation was accepted
and Stripe now shows this live destination Active at
https://tuveloz.com/api/stripe/webhooks/payments. It uses Your account / Snapshot /
2026-06-24.dahlia; all fourteen saved subscriptions match the receiver's handlers.
The existing Identity and Connect destinations were preserved. Do not recreate
this payment destination or repeat either completed sandbox refund rehearsal.

Official Wrangler 4.129.0 confirmed upload of STRIPE_PAYMENT_WEBHOOK_SECRET to
the existing tuveloz Worker. Only that secret was changed. A restricted temporary
handoff initially needed the PC owner's file permission; installation then
succeeded, the file and empty directory were removed, and in-memory secret
bindings were cleared. No secret value was printed or retained in project files.
The Stripe screen has the secret hidden again.

Independent production checks at 07:16:54 UTC confirmed the same d61bd13 release,
healthy application/database/schema, no missing tables or guarded triggers,
accounts/provider applications open, and customer requests/payments closed.
Both missing and forged payment signatures returned HTTP 400. No valid event,
production test receipt, payment, refund or transfer was created. Stripe displays
zero deliveries so far: configuration is complete, actual vendor delivery and
settlement are still separate pending evidence, not inferred from Active status.
Private evidence: stripe-payment-destination-prepared-20260929.json,
stripe-payment-connection-verification-20260929.json and
stripe-payment-connection-active-20260929.png. No code or launch gate changed.

## 2026-09-29 - Payment connection blocked by automatic approval review

Fresh Stripe inventory still shows four existing live destinations and no payment
destination. Attempted the prepared creation after the owner's "contnue" reply;
automatic approval review rejected the click because that reply did not explicitly
authorize this exact ongoing live payment-data connection. No workaround or second
attempt was made. A precise approval question now names Tuveloz payment status,
https://tuveloz.com/api/stripe/webhooks/payments, checkout/refund/dispute events,
and storage of its matching secret in the existing Tuveloz Worker. Wait for that
answer; do not interpret the failed attempt as creation. The form remains unsaved
and retained for handoff. No secret was read or changed.

Read-only public health at 06:31:03 UTC confirms d61bd13 remains healthy, with
application/database/schema ready, no missing guarded triggers or tables, accounts
and provider applications open, and customer requests/payments closed. This is a
health check, not new transaction or vendor-delivery proof. Private evidence:
stripe-connection-pending-health-20260929.json and
stripe-payment-connection-pending-20260929.png. No code or live settings changed.

## 2026-09-29 - Payment authentication repair published; connection awaiting approval

PR #266's tested head de8bd8d4fcbedd1bdb8ba543ea031b6c89ce05ee passed required
workflows 36528083779 and 36528084050. Merged as
d61bd13ae6ddbcf71dd754e4dffd1e97f996d58b. All three production jobs in
36529405266 passed, including the complete provider signup and 872-test build.
Thirteen independent live HTTP checks at 06:22:38 UTC confirmed the exact
healthy release, missing/invalid signature rejection, English/Spanish signup
pages and preserved onboarding-only locks. In particular, the forged payment
signature now returns 400 before payment API access is checked. No valid
event, production test record, real payment or refund was created by the probe.
Duplicate and retry behavior has isolated signed-route/migrated-SQL proof.
Evidence: task outputs/pr266-verification-20260929.json,
pr266-build-check-20260929.json, pr266-production-release-20260929.json and
pr266-live-release-20260929.json. This repair is complete; do not repeat it.

Prepared, but did not save, the missing live destination named Tuveloz payment
status: Your account / Snapshot / 2026-06-24.dahlia, fourteen selected events
matching the fourteen existing receiver handlers, endpoint
https://tuveloz.com/api/stripe/webhooks/payments. Cloudflare's read-only secret
name listing confirms the existing tuveloz Worker has STRIPE_PAYMENT_WEBHOOK_SECRET;
no value was read, changed or retained. The pending specific owner question asks
to create this connection and replace only its matching signing secret there.
Browser rules require confirmation because the connection grants ongoing access
to payment-event data. No approval response has arrived at this entry. Check
subsequent owner messages before asking again. The prepared tab is retained;
the original Stripe user tab is restored to Sandbox/Refunded.

Private handoff: stripe-payment-destination-prepared-20260929.json and
stripe-payment-destination-preview-20260929.png. Recheck for an intervening
owner-created destination before saving, so no duplicate is created. Creation,
secret installation and real vendor delivery remain unfinished. Per Stripe's
https://docs.stripe.com/webhooks#view-event-deliveries, inspect an actual delivery
record and corresponding receiver receipt; Active alone is not delivery proof.
Keep test/live modes separate and preserve both completed refund rehearsals.

The existing hello@tuveloz.com Gmail search was refreshed for broker/county
senders after September 26 and still displayed no matches. This is that scoped
search result, not a claim about all mail. No message was sent or inquiry
repeated. Evidence: launch-reply-check-20260929.json. No paid plan, policy,
launch approval, live-payment/SMS lock or real participant record changed.

## 2026-09-29 - Payment delivery configuration checked; authentication repair prepared

Continued from clean c7894bc; remote main remains the verified PR #265 release,
and there were no open PRs. Read-only live Stripe Dashboard inspection confirms
four active destinations, none pointing to /api/stripe/webhooks/payments.
The previous Import entry is **Import from test mode**, offering only the
six-event test Identity destination. It is not a hidden legacy payment endpoint.
Canceled that preview and restored the existing tab to Sandbox/Refunded. No
destination, key, event, transaction or setting changed. Private evidence:
task outputs/stripe-payment-destination-audit-20260929.json.

The receiving route also tried to construct the guarded payment client before
authenticating signatures or checking a completed receipt. Three regressions
reproduced with real signatures, actual route code and migrated isolated SQL:
forgeries returned a configuration failure instead of signature rejection;
completed duplicates failed after API access became unavailable; and blocked
authenticated attempts had no durable failure receipt.

Signature verification now uses the static Stripe verifier. Only a newly
acquired authenticated attempt constructs the payment client. Completed
duplicates acknowledge without reapplying; a new event with absent, invalid or
locked API access remains 503/retryable, records its own failed attempt, and
does not change payments. Every existing client/release check remains intact.
No handler or fee/policy rule changed. All 872 tests and build, 36 focused tests,
TypeScript and lint passed (the existing site-language warning remains).
Evidence: payment-webhook-auth-before-20260929.log,
payment-webhook-auth-focused-20260929.log, payment-webhook-auth-full-tests-20260929.log,
payment-webhook-auth-typecheck-20260929.log and payment-webhook-auth-lint-20260929.log.

Required remote checks and publication are next. Missing live payment-destination
configuration, its matching signing secret, reviewed mode and actual vendor
delivery remain separate. Do not create a duplicate Identity endpoint, import
test configuration into live, remove launch locks, or repeat completed refunds.

## 2026-09-28 - Stripe attempt protection published; pilot finish line reconciled

PR #265's tested head 193905bb1106fcdfc47d6eb6e070f929bd828dff passed both
required workflows (36515750327 and 36515750449), including all 869 tests/build
and required browser checks. Merged as 48c8ba947c10d2bce68e1637f5e9d401561c7cc8.
All three production jobs in 36516985448 passed. Thirteen independent live
HTTP checks at 2026-09-29 03:41:15 UTC confirmed that exact deployed release,
ready application/database/schema, rejection of missing/invalid Stripe
signatures on all four routes, and English/Spanish account and provider pages.
Accounts/applications remain open; customer requests/payments remain closed.
Stale-attempt behavior is proven by isolated migrated-SQL and signed-route
tests, not by introducing a race or signed test event into production.

Private evidence: task outputs/pr265-verification-20260929.json,
pr265-build-check-20260929.json, pr265-production-release-20260929.json and
pr265-live-release-20260929.json. No real participant record, payment, refund,
email, credential, paid service, policy or launch control changed. Do not repeat
this release or either completed Stripe sandbox refund rehearsal.

Read-only Stripe review found four active destinations; the payout-safety
destination's displayed week had zero deliveries. That does not establish
processor-originated delivery. One importable legacy entry remains uninspected;
do not infer a missing payment endpoint or create a duplicate. The existing
Stripe tab was restored to its original Sandbox/Refunded payment view.

The authenticated launch page at September 28 11:25 p.m. Maryland time showed
seventeen required Pending review records and one optional employee/trainee
lane, real transactions OFF and zero activated services. The retained scanner
operational proof passes; genuine provider Identity remains unproven. These
review records do not erase completed implementation or testing. No decision
was entered. The temporary review tab was closed. Private evidence:
stripe-delivery-inventory-20260929.json and launch-review-status-20260929.json.

The existing prelaunch reconciliation now groups the first-pilot finish line
into payment/consent, business/service/insurance/tax, privacy/operations,
genuine provider verification, and final pilot release. Optional features and
routine maintenance are separate. There is no verified full-launch date;
outside answers and evidence-backed decisions remain necessary. Keep the
owner's genuine provider application last and preserve completed setup.

## 2026-09-28 - Fence Stripe notification receipts by processing attempt

Continued from the clean, verified PR #264 release plus its local evidence
commit c38fbe4. Remote main remained bafe9a7 and no open PR was present.
Production-delivery review exposed a separate receipt race: once a five-minute
lease was reclaimed, the older Worker could still complete or fail the newer
attempt because receipt writes matched only the event ID and processing status.
Three isolated regressions reproduced this before the fix.

The shared receipt helper now returns the attempt number acquired atomically
with INSERT/UPDATE RETURNING. Completion and failure require that exact attempt;
busy/terminal duplicates receive no processing authority. All four signed
routes retain their own claim through success and error handling. Failed thin
event retrieval still marks its own attempt retryable. This fences receipt
state only; the existing domain-specific idempotency and safety holds remain
necessary when an expired handler resumes. No migration is needed.

All 869 tests and the production build passed, including 55 focused Stripe
checks. New tests run real receipt SQL against the migrated isolated schema,
exercise stale completion/failure and competing retries, and verify the actual
signed payment, Identity, thin Connect and connected-account snapshot routes
cannot clobber a replacement attempt. Outbound reads use synthetic fixtures;
participant/payment/adjustment/email tables stay empty in the new route test.
TypeScript passed; lint passed with only the pre-existing site-language warning.
Evidence: task outputs/stripe-webhook-claims-before-20260929.log,
stripe-webhook-claims-focused-20260929.log, stripe-webhook-claims-full-tests-20260929.log,
stripe-webhook-claims-lint-20260929.log and stripe-webhook-claims-typecheck-20260929.log.

Required remote checks and publication are next. This does not establish
Stripe-originated production delivery, change a launch/payment/SMS lock, adopt
policy text, create real records, send email or move money. Preserve both
completed refund rehearsals and PR #264; do not repeat them.

## 2026-09-28 - Refund recovery published and independently verified

PR #264's tested head 0a12f5ad39491f2ffa4b02ce09e8bf0228a98d24 passed
both required workflows (36511932734 and 36511933088), including the full
863-test build, TypeScript, migrations and mobile browser checks. Merged as
bafe9a7fee67a1ff7ceeb32fa79feab47ad18297. All three production jobs in
36513271223 passed. No release check was skipped to publish this change.

Nineteen independent HTTP checks confirmed the exact deployed commit, ready
application/database/schema, open accounts/provider applications and closed
customer requests/payments. Unsigned and forged-email refund, retry and review
requests still require Cloudflare owner sign-in. The authenticated live Payments
screen loaded the accurate empty cancellation queue; Refresh list worked, with
no captured Tuveloz page errors. No production record or money movement was
created for verification. Local Chromium/WebKit screenshots were inspected at
390px; the cancellation selector has readable contrast and the retry confirmation
does not overflow. The existing unrelated site-language lint warning remains.

Private release evidence: task outputs/pr264-verification-20260929.json,
pr264-build-check-20260929.json, pr264-production-release-20260929.json,
pr264-live-release-20260929.json and pr264-owner-ui-verification-20260929.json.
Do not repeat this release or the two completed Stripe refund rehearsals.

The built-in Gmail connector was identified as the personal account and was not
used to search mail. The existing signed-in hello@tuveloz.com Chrome inbox was
used instead; a focused sender/date search found no new insurer/county reply.
No email was sent. The temporary release-check tab was closed.

Completed: paused status-only recovery, explicit retry of proven-unsent attempts,
unchanged duplicate/hold safeguards, concrete unknown-result guidance and mobile
contrast. Still separate: permission to start a refund while paused, a reviewed
resolution for a genuinely ambiguous absent Stripe result, partial/provider
recovery, effective policy/customer consent and production processor delivery.
Live payment/booking/SMS locks and published policies remain unchanged.

## 2026-09-28 - Refund recovery repair prepared for release

Continued from clean 30c1923 and unchanged main e2112b5, with no other open PR.
Preserved both completed Stripe rehearsals and their revoked temporary access.
Four behavior regressions were reproduced against the published baseline before
the repair: paused status recovery, explicit unsent retry, absent Stripe-result
guidance and concurrent retry handling. No additional payment was created.

Owner-authenticated GET recovery can now reconcile an existing saved attempt
while marketplace approvals/submissions are closed. It cannot create a refund
or a reservation, and the existing Stripe client still rejects a live key while
live mode is code-disabled. POST approvals, sends and retries keep all original
marketplace/policy, identity, amount, prior-refund, transfer, work and hold checks.

A refund_not_sent_review record proves execution stopped before a Stripe POST.
After explicit owner reconfirmation, retry_not_sent repeats all eligibility
checks and conditionally reclaims the same permanent reservation and key using
its exact row version. Versions also advance on stopped attempts, preventing
stale/concurrent retries from reclaiming an intervening attempt. Unknown/pending
submissions never use this retry branch; they only read Stripe. No matching
result now supplies concrete review guidance and the owner-only Stripe payment
reference rather than implying success. A success state without its Stripe
reference fails closed. D1 parameter limits are asserted for every test query.

Mobile Chromium/WebKit checks cover paused read-only checks, missing results,
disabled sends during a pause, explicit retry confirmation, no automatic
resubmission, stale sign-in and mobile layout. The cancellation selector now
has readable light text on its dark background. Full build and 863 tests pass;
lint has only the existing site-language navigation warning. Required remote
checks and production verification are still pending at this entry. No policy,
launch/payment/SMS lock, migration, credential or real provider record changed.

Starting a new refund while the marketplace is paused remains deliberately
blocked; this repair enables status recovery only during a pause. Resolving a
truly ambiguous no-result attempt, partial/provider recovery, effective policy
adoption/customer consent and production processor-delivery proof remain open.

## 2026-09-28 - Application-initiated Stripe sandbox refund verified and cleaned up

Continued from clean 99271e1 with no other open PR. Used the published e2112b5
owner component, approval/status/refund routes, signed-owner validation, Stripe
SDK serialization and payment webhook handler in a private loopback fixture.
Cloudflare bindings, the owner issuer, migrated SQLite records and the future
marketplace-release decision were local fixtures. The unmodified release gate
was separately asserted closed; no production switch, database or policy changed.

The official Stripe CLI used an explicitly authorized one-hour OAuth session
with exactly one Tuveloz sandbox context. A strict transport adapter allowed
reads for this synthetic payment and one full refund POST only. No API secret
was extracted or exposed to the browser. The owner clicked the final test Pay
button and the actual Tuveloz component's Confirm and send refund button.

Stripe succeeded for all 10500 USD cents: $100 provider portion plus $5 Customer
Service Fee. The real signed refund.created, charge.refunded, refund.updated and
charge.refund.updated events reached the local actual handler through Stripe's
CLI listener; all four durable receipts are processed and the local payment is
refunded for 10500 cents. The UI says Stripe confirmed the refund. Its Check
Stripe refund status button retained that result without another POST. A
separate Stripe read confirmed exactly one matching refund, succeeded, and a
fully refunded test charge. No browser errors were captured. Prior offline
checks also verified duplicate-event handling and the closed unmodified gate.

Cleanup independently verified at 2026-09-29 01:58:45 UTC: the scoped CLI login
is unauthenticated, its temporary config is removed, the local server port is
closed and no rehearsal CLI process remains. The two temporary browser tabs
were closed. Private proof is in task outputs/stripe-owner-refund-integration-
20260928.json; the fixture, migrated synthetic database and detailed receipts
remain outside the repository. No real money, customer/provider data or paid
upgrade was used. No runtime repair or deployment was needed for this test.

Do not repeat either completed sandbox refund. This verifies the isolated
application-to-Stripe full-refund path, not production Cloudflare webhook
delivery, real settlement or launch readiness. Paused-marketplace refund access,
uncertain/no-send reservation resolution, partial/provider recovery rules,
effective policy adoption and customer consent remain separate unfinished work.

## 2026-09-28 - Existing Stripe sandbox payment fully refunded by owner

Continued from clean b7ce070; remote main is still published e2112b5 and no
other PR was open. Reused the existing English hosted-checkout rehearsal
payment rather than creating another charge or credential. The signed-in Stripe
Dashboard explicitly showed Test mode/Sandbox, the synthetic customer, $100
service plus $5 Customer Service Fee, and the original successful payment.

Prepared a full $105 refund with an explicit TEST ONLY note. The owner performed
the final Refund click and confirmed it in chat. At September 28, 9:10:23 p.m.
EDT, Stripe recorded the refund. Its actual refund.updated event identifies the
original Charge/PaymentIntent, amount 10500 USD cents and status succeeded.
The payment page shows Refunded and a $105 refunded amount. Its test ledger
retains the original $3.35 processor fee, leaving net -$3.35. This is simulated
money and does not charge a real card or establish a universal processing rate.

The test refund and its current status are verified. This was a Dashboard
refund of the standalone rehearsal, not a refund initiated through Tuveloz's
owner API. It does not prove deployed webhook delivery, application accounting,
real-bank settlement or provider-transfer recovery. No real payment/provider
record, launch switch, policy, credential, API key or deployment changed.
Do not repeat this standalone refund; the separate application-to-Stripe
integration rehearsal and policy/consent decisions remain open.

Source review confirms the existing receiver re-reads Stripe's refund/charge,
keeps pending/failed results under review and ignores unrelated payments without
a matching Tuveloz record. No speculative code change or repeated full suite.
Private synthetic references and verified amounts are retained in task
outputs/stripe-dashboard-test-refund-20260928.json. The user-owned Stripe tab
remains on the completed result, with the developer panel closed.

## 2026-09-28 - Owner refund review published and independently verified

PR #263's corrected head 53d78f0350a5a12c752eae69995eaa60ba3cb831 passed
both required workflows (36501426972 and 36501427345), including 858 tests/build
and the new mobile refund browser checks. Merged as
e2112b598bab3112def493c08cb5c78236cd40a7. All three production jobs in
36502823353 passed; no release check was bypassed.

Independent verification at 2026-09-29 00:41:22 UTC (September 28 in Maryland)
confirmed the exact live release, ready application/database/schema and all
seventeen public/authentication/origin checks. Accounts and provider applications
remain open; customer requests and payments remain closed. Signed-out and
forged-email refund/review requests require Cloudflare owner sign-in.

The authenticated live owner Payments view now displays Cancellation refunds.
Its empty queue is accurate, Refresh list works, and no Tuveloz page errors
were captured after deployment. The rendered desktop layout was inspected;
mobile Chromium/WebKit behavior was covered by the isolated required tests.
No production record, approval, charge or refund was created for verification.

The owner's GitHub email referred to the earlier failed run 36500989419 at
3291eb4, before the corrected concurrency test. That failed run did not deploy;
the corrected head and production workflow subsequently passed. Business Gmail
also contained the already-recorded September 28 Stripe reply, not a new
approval or request. No email or outside inquiry was sent.

Evidence is in task outputs/pr263-production-release-20260928.json,
pr263-live-release-20260928.json and pr263-owner-ui-verification-20260928.json.
Actual Stripe sandbox refund rehearsal, policy adoption/customer consent,
paused-marketplace access, uncertain/no-send resolution and partial/provider
recovery rules remain unfinished. Do not repeat this completed publication or
mistake the deployed closed workflow for a completed Stripe refund.

## 2026-09-28 - Owner cancellation refund review implementation and test evidence

Continued from clean local 0c34c82 / published 907bf5e, preserving the completed
PR #262 backend and its postrelease evidence. Added a Cancellation refunds
section in the owner's Payments view. It shows the saved customer/provider,
cancellation reason, payment and full refund breakdown. Saving an approval and
submitting to Stripe require separate explicit actions; no customer/provider
refund button or automatic money movement was added.

The owner-only review API validates signed authentication, origin, exact input,
the current review token and the existing real-marketplace gate. One D1 batch
conditionally inserts an immutable full-payment approval and updates the
cancellation/job together. Complete saved-row comparisons plus current work,
incident, payment and adjustment checks reject changes between reading and
saving. A permanent cancellation key prevents duplicate decisions. Simulation
records, partial/post-start cases, ambiguous payments, prior refunds/transfers
and incident holds cannot enter this approval path. The shared payment snapshot
now also binds the provider, connected account and customer identity.

The existing executor rechecks incident holds before submission and in its
conditional payment reservation. A new owner-only status endpoint can reconcile
an existing execution but cannot create one. The screen preserves the reason
after a conflict, requires refresh/reconfirmation, and treats a lost response
as uncertain. Status checks never resubmit the refund. No migration, credential,
production record, adopted policy, live key or launch/payment gate changed.

Local validation passed: 858 tests with the production build, TypeScript and
lint (only the existing site-language.tsx navigation warning). Final identity
race and fee-copy checks also passed. Isolated signed-owner, migrated SQLite and actual Stripe
SDK tests cover approval-to-execution, exact $105 total/$100 provider/$5 fee,
stale facts, repeated/concurrent approval, rollback, incident races and read-only
reconciliation. Mobile Chromium/WebKit tests cover confirmation, preserved draft,
uncertain submission, reload/status-only recovery, malformed and sign-in replies,
and horizontal fit; both engines passed and the mobile screenshot was inspected.
All network responses in these tests are intercepted;
this is not an actual Stripe sandbox transaction or production refund.

Remaining: actual Stripe sandbox rehearsal, policy adoption and complete
bilingual customer consent, paused-marketplace refund access, operator recovery
of unconfirmed/no-send reservations, and partial/provider-recovery rules.
Publication is not yet verified in this entry; see the next release evidence.

PR #263's first CI run exposed a scheduling assumption in the concurrency test:
JWT verification could serialize the requests, so the second safely returned
the existing approval instead of racing its insert. The test now explicitly
holds both requests before their transactions, verifies both arrived, and then
requires one saved decision and one conflict. The sequential idempotent retry
case remains tested separately. No runtime guard was relaxed to fix the test.
Scoped business Gmail search refreshed around 8:03 p.m. Maryland time found
no new matching insurance/county replies since September 26; no email was sent.

## 2026-09-28 - Guarded full-refund backend published; live path remains closed

Continued from clean 2cfd068 / production 3b7ae69 with no open PRs. Preserved
PR #261's completed simulation repair and the owner's settled full-refund rule.
Added an owner-authenticated endpoint and full-refund executor for the narrow
pre-work, approved real cancellation case. It validates the immutable approved
payment snapshot, the settled charge and its current Stripe state, prior
refunds and the payment-specific transfer group. Test jobs/providers and
approved_test_only decisions cannot use it. No live key or launch gate changed.

A permanent execution reservation uses the existing unique idempotency index;
no migration is required. Concurrent or different approvals cannot submit
twice. A lost response or process interruption leaves a durable hold, and later
requests only retrieve the original refund by ID/metadata, never resubmit it
after Stripe's key-retention window. Pending/failed/canceled/unknown results do
not claim success. Conditional payment writes preserve concurrent changes;
versioned execution writes preserve newer reconciliation. The original decision
owns the provider/customer accounting impacts; the execution row does not
double-book them or create a transfer reversal.

The endpoint remains closed by the existing real-marketplace release gate.
Its future operator decision UI, reviewed approval/snapshot creation, policy
adoption, paused-marketplace refund access, no-send/uncertain recovery and real
Stripe sandbox rehearsal are still unfinished. Do not present this backend
implementation as a live refund service. No real record, remote Stripe request,
email, payment or active policy was changed during local verification.
All 852 tests and the production build passed, including eleven new behavioral
scenarios using actual signed owner tokens, migrated SQLite and Stripe SDK
transport intercepted entirely inside the test process. The real production
gate was separately verified closed. Full-total/fee binding, different/repeated
approvals, simultaneous clicks, lost responses, retries beyond 24 hours,
pending/failure states, transfers, changed evidence and reconciliation races
passed. TypeScript and lint passed (one existing site-language.tsx warning).
Private proof: outputs/stripe-full-refund-full-tests-20260928.log and
outputs/stripe-full-refund-lint-20260928.log.

Published under the owner's standing instruction to publish fixes and continue.
PR #262 merged head fd99d3ae3e866f294fdb56f14266c7e48f95f5b7 as
907bf5e4775ed2e07d350452b688d26b6338c6bd at 23:05:43 UTC, after both PR workflows
36494640443 and 36494640976 passed. Production workflow 36496136066 completed
all three jobs successfully. Independent verification at 23:24:50.430 UTC
confirmed that exact healthy release, ready application/database/schema and
thirteen HTTP safeguards. Accounts/applications remain open; customer requests
and payments remain closed. The new refund endpoint is intercepted by
Cloudflare owner login for both signed-out and forged-email requests (302,
no-store); application-level signed-owner checks have isolated behavioral proof.
The first probe followed that login redirect and saw HTTP 200, so its expected
403 was wrong. Corrected the probe to inspect the real 302 without following or
retaining the login query. This was a verifier correction, not an application
authentication bypass. Private proof: outputs/pr262-production-release-20260928.json
and outputs/pr262-live-release-20260928.json. No production test record or actual
Stripe refund was created. Do not repeat this publication or PR #261's repair.

At about 6:53 p.m. Maryland time, refreshed the existing scoped business Gmail
search for messages after September 26 addressed to hello@tuveloz.com from
foundershield.com, baldwin.com or montgomerycountymd.gov. It still showed no
matching messages. This is a scoped search result, not an exhaustive inbox
claim. No new inquiry or other message was sent.

## 2026-09-28 - Test refund total and fee allocation published and verified

Continued from clean ecd20e3 and production b916a4e with no open PRs. Preserved
the owner's full-refund choice and all active policy/launch/payment controls.
Five route scenarios reproduced baseline failures using migrated in-memory
SQLite and synthetic participants; authentication identities and Cloudflare
bindings are fixtures, and every outbound call is forbidden.

The test-only refund/cancellation paths now validate the saved customer price
and include the Customer Service Fee in the ceiling. A full $105 refund records
$100 as provider impact and $5 as the fee returned by Tuveloz; it does not assign
the fee to provider earnings. Requests bind the accepted quote, scope and price;
approval rejects missing/stale snapshots. Authorized changes use their saved
price without falling back to an older quote. Invoice/payout subtotal logic is
unchanged. Full allocations include the complete fee automatically; a partial
test approval requires an explicit fee amount within both saved components,
without defining a new partial-refund policy. The owner form and returned
records show that distinction. Existing denied/history records stay intact;
legacy requests without a price snapshot can be denied, but need a new test
review before approval. An already-decided refund cannot append a second audit.

All 41 focused checks passed, then the production build and all 840 tests with
zero failures. Lint passed with the existing warning in unchanged
site-language.tsx. Eight new behavior cases cover real route/SQL persistence,
full refunds and cancellations, explicit partial allocations, rounding, maximum
amounts, authorized changes, stale/missing prices, repeat approval and persisted
test/access restrictions. No Stripe/email/network call, real account record,
refund, migration, key, active policy or launch flag changed.
Private logs: outputs/refund-allocation-full-tests-20260928.log and
outputs/refund-allocation-lint-20260928.log. Published under the owner's standing
instruction to publish fixes and continue. PR #261 merged tested head
72846f2639561ea1e334c2845e1ef4135d0edb91 as
3b7ae69fbcae3d737430ecfa9ccf389a0357ab3b after both required PR workflows passed.
Production workflow 36489545629 completed all three jobs successfully at
22:15:58 UTC, including its separate browser, bilingual, signup, migration,
build and deployment checks. Independent verification at
2026-09-28T22:17:14.585Z passed all eleven targeted HTTP checks and confirmed
that exact release with ready application/database/schema. Private operations
reject signed-out GET/POST with 401 and cross-origin POST with 403, all no-store;
checkout remains closed. No test records were created in production. Accounts
and provider applications remain open; customer jobs and payments remain closed.
Private proof: outputs/pr261-production-release-20260928.json and
outputs/pr261-live-release-20260928.json. Do not repeat the merge or deployment.
Real refund initiation, cumulative settled-payment limits,
eligibility/policy adoption and permitted transfer recovery remain unfinished;
this test accounting repair must not be presented as live refund execution.

## 2026-09-28 - Owner full-refund decision and remaining implementation boundary

Continued from clean 0b738be and verified production b916a4e with no open PRs.
The owner explicitly chose full refunds including the 5% Customer Service Fee
for provider cancellation/no-show or customer cancellation before work starts.
The question disclosed Tuveloz would cover original Stripe processing fees that
are not returned. This business choice is settled; do not ask it again. Added
matching English/Spanish candidate clauses and a $100 + $5 = $105 refund example
to the existing payment-policy-reconciliation.md, with remaining partial-refund,
provider-recovery and policy-adoption decisions kept separate.

Source review found the current job-operation refund/cancellation path is
restricted to persisted test jobs/providers and never creates a Stripe refund.
Its authorizedJobTotal ceiling is the provider subtotal, excluding the customer
fee; its decision handlers also attribute the entire refund to provider impact.
The draft now identifies both accounting gaps and exact verification cases.
Do not globally increase authorizedJobTotal, since invoice/payout checks need
the provider subtotal. A future real refund must bind the settled payment and
remaining refundable amount, separately account for the Customer Service Fee,
and distinguish decision/request/pending/succeeded/failed states. Signed Stripe
refund callbacks and prior concurrency repairs remain completed separate work;
they do not establish refund initiation or provider recovery.

The scoped hello@tuveloz.com inbox search, refreshed September 28 at about
5:15 p.m. Maryland time, found no messages after September 26 addressed to the
business inbox from foundershield.com, baldwin.com or montgomerycountymd.gov.
This is not an exhaustive mailbox assertion. No duplicate inquiry was sent.
Corrected one stale draft sentence that still called PR #258's published
Spanish line-item repair local. No runtime, active policy, release hash,
credential, payment or launch control changed; these are local review records.
All 15 existing customer-fee consistency checks pass after using the canonical
fee name throughout the new draft. Git whitespace validation passes. No full
build or deployment was repeated for these documentation-only changes.

## 2026-09-28 - Restricted live payment-key guard published and verified

Continued from clean local 00376fb and remote production b20d524; no open PRs
were present. The remaining thin-event delivery path intentionally still uses
the guarded payment client. No separate live credential or release bypass was
introduced to make that path appear operational during prelaunch.

While reviewing that boundary, found getStripeClient rejected sk_live_ but
accepted rk_live_ without checking the payment release lock. Stripe's official
[key documentation](https://docs.stripe.com/keys), checked September 28,
confirms restricted keys also have live/test modes and configurable permissions.
A real-factory/SDK test with synthetic credentials reproduced the failure before
the change. The repair applies the existing live lock to both key types and
rejects public, webhook, organization, missing-mode and unknown key formats.
Standard and restricted sandbox keys still work. No secret values were read,
created, changed or transmitted, and Identity's separate client is unchanged.

The focused guard/launch/webhook checks passed, followed by the production build
and all 831 tests with zero failures. Lint passed with the existing warning in
unchanged site-language.tsx. The suite includes the prior local sender/retry
coverage; neither it nor this repair proves actual provider inbox delivery.
Private build/test log: outputs/stripe-key-guard-full-tests-20260928.log.
Published under the owner's standing instruction to publish fixes and continue.
PR #260 merged tested head 72d9077 as
b916a4ef4420002703310996c81be5090a9064f7 after all required PR checks passed.
Production workflow 36481473413 completed successfully, including the separate
bilingual browser/signup checks, migration rehearsal, build, Cloudflare deploy
and exact-release check. Independent verification at
2026-09-28T21:02:17.303Z passed all eight targeted HTTP checks and confirmed that
exact commit with ready application/database/schema. Customer accounts and
provider applications remain open; job requests and payments remain closed.
Private proof: outputs/pr260-production-release-20260928.json and
outputs/pr260-live-release-20260928.json. The reusable HTTP script now accepts a
PR number so it does not relabel this proof as PR #259 or overwrite its record.
No launch/payment/SMS flag changed. The published safeguard does not establish
real provider inbox delivery, receipt localization, or business launch approval.
Do not repeat this merge, acceptance or release.

## 2026-09-28 - Existing receipt test resolved; provider alert sender checked locally

Continued from published b20d524 and the completed seller-compliance acceptance,
with no open PRs or newer remote release at inspection. The signed-in Test-mode
Stripe Dashboard shows No payments on the existing synthetic receipt-language
Customer and Spanish (Spain) in its expanded details. This experiment produced
no receipt; the Customer page does not establish the exact Session status enum.
No new Checkout, credential, payment, invoice or settings change was made.
Recorded the current observation in the private experiment summary and updated
the existing checklist. Only prepare a replacement when the owner is ready for
the required final Pay step; do not repeat the completed hosted tests.

The business-inbox search addressed to hello@tuveloz.com after September 26 from
the existing broker/Baldwin/county domains returned no matches. This is a scoped
observation, not an exhaustive mailbox claim; no inquiry was resent. Corrected
stale launch-briefing and policy-draft text that still called the September 28
Stripe reply and acknowledgment pending. No released policy or hash changed.

Extended tests/stripe-account-notifications.test.mjs through the real
flushPendingEmailNotifications implementation and migrated local SQLite, using
intercepted synthetic email-service responses. All 15 focused checks pass:
English/Spanish payloads reach the sender while payment locks remain closed;
service failure and a missing message receipt remain retryable; the same
idempotency key and content survive retries; a successful acceptance and replay
do not resend. The initial sandbox run failed before executing tests because
esbuild could not read a parent directory; the approved local rerun passed.

Only tests and documentation changed, saved locally for the next reviewed
release. No runtime change or deployment is needed for these checks. Service
acceptance in a fixture is not an actual provider inbox delivery. The live
thin-event route still uses the guarded payment client; actual Stripe-originated
delivery remains separate and unproven. No real provider message, vendor call,
charge, identity document, paid service or launch/payment/SMS unlock occurred.

## 2026-09-28 - Stripe acknowledgment accepted; PR 259 published and verified

The owner explicitly approved both publication and the exact seller-compliance
acknowledgment. Submitted the reviewed acknowledgment; Stripe replaced the
action with View acknowledgement and displayed September 28, 2026 as accepted.
Saved proof privately in outputs/stripe-seller-compliance-accepted-20260928.png.
Do not ask for acceptance again or confuse this with the July 29 loss-liability
acknowledgment, a new paid plan, or approval to open customer payments.

PR #259 merged tested head a4c02c6 as b20d524b96240d6e5971483ddb0cc040a5a6ba9f.
All required PR checks and production workflow 36474134777 passed, including
825 tests/build, bilingual browser flows and the migration rehearsal.
Independent live verification at 2026-09-28T20:04:07.610Z passed all eight
targeted HTTP checks, confirmed that exact release and ready application,
database and schema, and preserved closed/private routes and launch controls.
The initial raw-HTML sign-in-text assertion was incorrect for this client page;
source/browser inspection confirmed hydration and the provider sign-in redirect.
HTTP assertions now cover the route shell, with separate live browser proof of
provider sign-in and the supported Spanish account page. The private workspace
lang query is not a supported translation switch; no new bilingual-workspace
claim or production runtime change was made during verification.
The provider alert/update-button fix is published. Actual Stripe-originated
delivery and provider inbox receipt are still separate operational evidence.
No real provider notice, payment, identity document or settlement was used.

The older Spanish receipt test window ended at 3:42 p.m. Maryland time. A
refresh returned Stripe's combined completed-or-timed-out page; no receipt or
payment completion was independently confirmed. Saved that observation and
closed the unusable tab. The last API result at preparation was open/unpaid.
Temporary CLI credentials remain revoked; no replacement checkout or indirect
payment was attempted. Inspect the existing Session through authorized test
access before preparing another. The prior owner-only Pay restriction remains.

Remaining scope: actual provider delivery evidence, the isolated receipt-language
experiment, customer consent/policy reconciliation, and supported service,
insurance and tax decisions. This acceptance/release clears none of those gates.
Earlier releases and completed business setup are preserved; do not repeat them.

## 2026-09-28 - Stripe reply verified; provider account notices repaired locally

Read the new September 28 2:49 p.m. Stripe Support reply in the business inbox.
Expanded details confirm support@stripe.com, stripe.com signing and TLS.
The general Connect approval remains complete, but the reply does not approve
every service category. Recorded the distinction between its holding guidance
and the linked public US reserve ceiling; no arbitrary payout deadline added.
Opened only the seller-compliance preview, expanded both duties and saved the
exact text privately. It requires seller communication and collection of further
information through secure onboarding. Nothing was accepted; checkbox unchecked.

Source review found V2 requirements/capability webhooks only logged status.
The local repair atomically queues account/email notices for the uniquely mapped
real provider, uses the provider's English/Spanish preference, suppresses test and
staging events, rechecks ownership, and deduplicates signed retries. A failed
notification write leaves the Stripe receipt retryable. Messages contain no
private requirement descriptions, identity or bank details and link to the
signed-in Stripe panel. The existing outbox handles delivery/retries. No message
was sent as a test. The update button now also appears when requirements exist
while Stripe transfers are still active.

Validation: 13 new behavioral/rendered-panel checks pass; full build and all
825 tests pass, TypeScript passes, lint has no errors and one existing
site-language.tsx navigation warning. The first full test run was blocked by
Windows sandbox parent-directory permissions; the same suite passed with normal
local filesystem access. Logs are outside the repo in outputs/stripe-account-
notifications-tests-20260928-verified.log and the matching lint log.

No competing PR was open; remote main remains 03f92dd. Existing local handoff
commits preserved on fix/stripe-account-notifications-20260928. This repair is
local, not published. Payment-client/live-mode guards remain unchanged, so this
is not proof of production live webhook delivery, provider inbox receipt or
complete operational seller compliance. No account terms, legal policy, payment
setting, provider approval or launch switch changed.

The separate Spanish receipt-language Checkout still displays its test form;
no completion was observed. Its owner-only Pay click remains outstanding and
the prior CLI session remains revoked. Do not create a duplicate or bypass that
handoff. Business browser IDs changed again; identify the tuveloz.com profile
rather than trusting a saved numeric browser ID. Connected Gmail MCP is the
personal account, so no personal mail was searched.

## 2026-09-28 - Receipt-language test prepared; owner payment click required

Continued from published PR #258 without republishing it. Main remains 03f92dd,
no competing PR is open, and the earlier local handoff commit is preserved.
Read the actual existing Spanish test receipt: fee text is Spanish, surrounding
headings remain English. Rechecked Stripe's current documentation; customer
preferred locales remain a hypothesis for these standard charge receipts.

Restored the previously authorized one-hour CLI session for only TUVELOZ LLC
test mode, using an isolated configuration. Created one clearly synthetic
Customer with preferred_locales=[es] and one Spanish hosted Checkout Session
for $100 simulated service plus $5 fee. Invoice creation is disabled, with no
provider transfer configured. No real customer, card or money was used. The
browser form is filled with Stripe's documented synthetic card and accurately
identified the operator as an AI agent.

Automatic approval review rejected the final Pay click and expressly requires
the owner to perform it, even in test mode. Did not retry through a different
tool or API. Asked the owner to click Pagar; the prepared browser tab is retained.
The read-only API check still reports open/unpaid, no PaymentIntent or receipt.
Do not call this receipt-language verification complete or publish a speculative
customer-preference change. If the prepared Session expires, inspect its state
before preparing another; do not overwrite the existing evidence.

Revoked the temporary CLI session, independently confirmed Authenticated:false,
and removed its isolated configuration. The one-hour Checkout remains available
for the owner; CLI logout does not complete or cancel the test payment. Private
test objects, expiry and cleanup evidence are in
work/stripe-receipt-language-20260928; the ready screenshot is
outputs/stripe-receipt-language-ready-20260928.png. No application code, policy,
payment setting, launch control or production release changed. No new automated
tests were needed for this documentation-only handoff.

The September 28 scoped business-inbox refresh still shows the September 27
Stripe reply/acknowledgment only, with no new broker/county answer. No message
was sent. Current business Chrome is browser 3 (tuveloz.com); browser 4 is Edge,
so do not reuse the old browser-4 assumption from prior sessions.

## 2026-09-28 - PR 258 published and independently verified

Completed the owner's authorized combined release without repeating approval.
PR #258 merged tested head 348f4bf as 03f92dd155157190bee559729631b1aa83557780.
Both required PR workflows passed. All three jobs in production workflow
36375909647 passed, including the full 812-test build, browser checks, fresh
migration rehearsal, deployment and exact release verification. GitHub's
tuveloz/production-deployment status is success for that same merge commit.

Independent public verification at 2026-09-28T04:19:17.531Z passed all 52 HTTP
checks. The exact release and application/database/schema are ready; all 41
unique notice files, both manifests and the README match their expected bytes.
That includes the new official MIT notice supplied by the maintainer and every
one of the 40 earlier files. Closed checkout, unknown-session privacy,
signed-out provider denial and public payment-result routes also passed.
Accounts and provider applications remain open; requests and payments closed.

The first independent pass detected different hashes for two metadata files
after the local Git fast-forward converted their working-copy line endings.
Both live files exactly matched their committed Git blobs; only Windows CRLF
conversion differed. Corrected the private verifier to compare metadata with
the exact release's Git bytes, retaining all original notice hash checks. The
full rerun passed. No website repair or second deployment was needed. The
comparison evidence is pr258-manifest-line-endings-20260928.json.

Spanish fee and quote labels are published. Their earlier actual Stripe test
Checkout/receipt proof remains separate from production payment integration.
Stripe's surrounding receipt headings still need verified language handling;
the processor record now records the ownership and idempotency requirements for
that follow-up. No new Stripe Customer, invoice, test payment or live charge was
created. No dependency upgrade, paid license or launch/policy decision changed.

The scoped business-inbox refresh found only the existing Stripe answer and
acknowledgment, with no new broker/county answer in the inspected scope. Nothing
was resent. Preserve pending processor, insurance, county and policy reviews.

Evidence outside the repository: pr258-merged-checks-20260928.json,
pr258-production-release-20260928.json, pr258-production-status-20260928.json,
pr258-live-release-20260927.json and verify-pr258-release-20260927.mjs.
Publication is complete; do not repeat approval, notice collection, hosted tests
or deployment. This status handoff is retained locally for the next useful PR.

## 2026-09-27 - Upstream notice resolved and combined release prepared

The owner supplied the GitHub reply, then asked us to complete the check and
continue. Upstream issue #276 is Closed with the repository owner's direct
answer, and PR #277 merged as 978a54938a661c389d7fe80b457eef2c2441ff08. That PR
explicitly closes our question about the missing MIT notice for utils 1.7.0.
Our installed plugin is still 0.5.26 and still contains the 1.7.0 source marker;
the maintainer's note about removal in a newer plugin does not change our copy.

Preserved the official 1,070-byte MIT notice exactly, with its source commit,
Git blob, SHA-256 and linked maintainer response. Added it to the public notice
collection and moved the specific component to the manifest's resolved list.
No license text, attribution or date was invented. The original archive's
missing-file history is preserved. No package upgrade or paid license is needed
for this notice update; package-lock.json remains unchanged.

All 41 unique notice files, both manifests and the README match the production
build byte-for-byte, including every one of the 40 previously published files.
The combined Spanish checkout-label repair and notice addition pass build and
all 812 tests. Earlier TypeScript/lint checks remain valid for the unchanged
application repair; remote release checks will run again. No competing PR was
open and main remained 59c7815 before publication. Continue the authorized
combined release without requesting the same publication permission again.

Private source/validation evidence: hiogawa-license-source-20260927.json,
hiogawa-notice-validation-20260927.json and checkout-notice-fulltests-20260927.log.
The specific upstream response task is complete. Publication is still pending
at this entry; overall ownership/reviewer evidence and launch controls remain
separate. No reply or new inquiry was sent.

## 2026-09-27 - Hosted Stripe test payments and Spanish line-item repair

Continued from PR #257 without repeating its release. No competing PR was open
and main remained 59c7815. The scoped business-inbox refresh still showed the
existing Stripe reply and acknowledgment only; no new Stripe/broker/county
answer in that scope and no inquiry resent.

Using the previously authorized official CLI test scope, restored a temporary
one-hour session for only the existing TUVELOZ LLC test environment. Two
standalone hosted Checkout rehearsals completed: English and Spanish, each
with a clearly synthetic $100 labor item plus a separate $5 Customer Service
Fee. Stripe reported each Session complete/paid and its PaymentIntent succeeded,
with exactly one successful test charge each and no provider transfer. The
Spanish flow first rejected Stripe's documented decline card, displayed a
Spanish error, remained unpaid, then successfully retried the same Session.
Both actual Stripe receipts show TUVELOZ LLC and the correct itemized total.

The first Spanish preview exposed English merchant-supplied fee and quote
descriptions. Added a shared bilingual fee-label helper and translated the
fixed quote-description prefix in the checkout route. Both payment branches use
their existing authorized rate; amounts, provider names, charge strategy,
policies, accepted evidence and launch locks are unchanged. The replacement
Spanish sandbox Session used the actual helper and showed the corrected wording
on Checkout and the fee label on its receipt. The unused original preview was
expired. The receipt's surrounding Stripe headings still render in English;
customer receipt-language propagation needs a separate verified change. Test
receipt branding also does not establish current live receipt styling.

All 812 tests and the build passed. TypeScript passed; lint has only the existing
site-language.tsx warning. Sandbox module-resolution restrictions required the
usual approved normal-permission test run; no code check was bypassed. Thirty
focused checkout/fee tests also passed. The code repair is local, not deployed.
Publication is a separate next step; do not repeat the completed hosted tests.

CLI logout explicitly reported all contexts logged out and session revoked;
whoami independently returned Authenticated: false. Removed the dedicated local
config and closed only the three temporary auth/checkout tabs. Private test IDs,
receipt links, screenshots, API responses and the non-secret summary stay outside
the repository in work/stripe-checkout-rehearsal and outputs. These are standalone
Stripe presentation/receipt checks, not the production application payment flow,
actual provider settlement, a real bank statement, inbox delivery or launch
approval. No real card, identity document, live charge or gate override was used.

## 2026-09-27 - PR 257 published and independently verified

The owner asked to continue after the concrete publication request for 8268dcf.
Confirmed the checkout was clean, no competing PR was open and main was still
299fd4c. Pushed the reviewed branch, opened PR #257, and attached it to the task.
Both PR workflows passed against exact head
8268dcf09ed104eff85ce8b9daef3e64d084b102: verification 36369995415 and deployment
validation 36369995760. Merged with an explicit matching-head check at
2026-09-28 02:45:34 UTC as 59c7815022827a3b2a7696110d204611d177d3fd.

Production workflow 36371052324 passed all three jobs, including required
verification, account signup, deployment and its exact-release/database check.
The independent public check at 03:03:22 UTC confirmed the same live commit,
healthy application/database/schema, no missing guarded tables/triggers,
accounts and provider applications open, and customer requests/payments closed.
Eight public HTTP checks passed: health, three payment-result URLs, private
unknown-payment rejection, closed quote-readiness response, unauthenticated
provider rejection and the absent public Spanish payment-result alias. Relevant
private responses remain non-cacheable. No real submission, Stripe session,
charge, provider settlement, legal adoption or launch decision was created.

The new twenty-two synthetic checkout browser cases also passed in both GitHub
verification runs. They verify the component before future launch, not an active
production checkout. The earlier full Spanish Customer Agreement and payment
wording drafts are now in repository history but remain drafts. Provider
acceptance evidence, legal release manifests and launch locks are unchanged.
Do not republish PR #256 or #257 or redo the completed stale-consent repair.

During release, refreshed the existing business Gmail search scoped to Stripe,
Founder Shield/Baldwin and Montgomery County senders. It still showed only the
existing Stripe response thread and acknowledgment. No new reply in that scope
and no inquiry resent. Remaining processor answers, final policy/Spanish
customer integration and actual hosted Stripe receipt proof remain separate.

Evidence outside the repository: pr257-production-release-20260927.json,
pr257-live-release-20260927.json and verify-quote-checkout-release-20260927.mjs.
Fast-forwarded this checkout to the merge; retain this handoff locally for the
next substantive release rather than causing a status-only deployment.

## 2026-09-27 - Repair stale quote consent and checkout response handling locally

Continued from the preserved local Spanish/reconciliation drafts; no open PRs
and remote main still 299fd4c at the initial check. Reproduced a concrete bug in
the private active quote-payment component: updating scope on the same quote
kept the prior checkbox checked and did not fetch the current authorization.
The production wrapper remains closed, so this was an isolated prelaunch test,
not evidence of a live customer charge or a production consent incident.

The active card now remounts its consent state when quote, scope, shown price,
provider name, access token or language changes. It cancels/ignores superseded
readiness and checkout responses, checks the returned scope and amounts against
the displayed quote, and refuses duplicate checkout starts. Readiness requests
time out after twenty seconds with a retry action. A mismatched quote offers a
full page refresh; a server conflict removes stale consent and its download
until a fresh review. Aborting a browser request does not reverse server work.
Existing server authorization checks, exact agreement text, versions, hashes,
provider evidence, fees and all launch locks are unchanged.

Added `test:e2e:quote-checkout` to required verification. The isolated Vite fixture
exposes the private component in its in-memory bundle only; it never alters a
launch constant, contacts Stripe, or writes a real record. Twenty-two Chromium/
WebKit cases passed at 390px/320px: changed scope, late reads, price/access/
language resets, network retry, mismatched scope and refresh, timeout recovery,
409 recovery, exact authorization download, late POST after leaving or changing
scope, successful synthetic redirect and the unchanged production closed panel.
No captured page errors, unexpected external requests or horizontal overflow.
Language-context reset is tested on a fixture route; the real quote route is
still English-only and customer Spanish policy adoption remains unfinished.

Validation: the new scope-change test failed against the original component,
then passed with the repair. All 812 existing tests and the production build
passed. Type generation and TypeScript completed; the sandbox prevented only
Wrangler's optional external log-file write. Lint passed with one existing
`site-language.tsx` navigation warning. Kept the existing policy-gate assertion
unchanged by preserving its button-condition order. Whitespace check passed.
Private full-suite log: quote-checkout-fulltests-20260927.log. These changes and
the preceding three documentation commits are local, not pushed or deployed.
Do not repeat PR #256 publication or describe this as completed Spanish consent,
hosted Stripe verification, policy adoption, or marketplace launch.

## 2026-09-27 - Complete Spanish customer drafts and narrow the consent gap

Prepared the full Spanish Customer Agreement against the unchanged English
source hash 76ba8743bc4665b0e2e5acf50be58db1558524483562c88b61e06041953e36d2.
All eleven sections and fourteen paragraphs are covered, with both Spanish
policy links, original policy date and fee retained. Added the complete proposed
Spanish checkout authorization, both warranty alternatives and exact customer
integration boundaries to the existing payment reconciliation. These are drafts,
not new effective agreements or evidence of customer acceptance.

Corrected an overly broad finding from the preceding entry: six existing Spanish
legal pages are complete `lib/policy-spanish/` sources, with a separate release
manifest and an already language-bound provider acceptance path. They are not
merely dictionary replacements. The customer path lacks this integration. Updated
the current review, processor card, briefing and checkpoint so future work reuses
the completed provider system instead of rebuilding it.

The customer-acceptance unique index has no language/hash field; a future
presentation-specific version or reviewed schema design must allow distinct
immutable records. The readiness GET currently omits language while POST carries
it; future translated consent needs both, stale-response handling and immediate
checkbox reset. The hashed Spanish Terms source labels its customer-agreement
link English-only, so publication needs coordinated translation versioning and
preservation of prior provider acceptances. No policy hash was quietly changed.

Built an isolated static local comparison preview from the draft and original
English markup, with the existing site stylesheet. Both switch directions and
390px/320px mobile widths passed visual/DOM inspection without overflow or captured
console errors. This is a review preview, not production routing, React hydration
or persisted consent proof. Reset the viewport and closed the temporary preview.

Validation: twenty existing fee/provider-Spanish tests passed. Structural checks
confirmed all sections, paragraphs and links, and all seven English plus six
Spanish policy source hashes remain unchanged. Whitespace check passed. Private
evidence: customer-spanish-draft-validation-20260927.json,
customer-spanish-preservation-checks-20260927.log,
customer-agreement-preview-browser-20260927.json and
customer-agreement-spanish-mobile-20260927.png. The standalone HTML is also saved.
No runtime, active policy, migration, account, message, payment or launch setting
changed. No new inbox check was needed immediately after the prior scoped check.
Keep this local with acc6e40 and f612b0f; no status-only deployment is needed.

## 2026-09-27 - Prepare exact payment-policy and consent reconciliation

Continued after the completed PR #256 release. GitHub shows no open pull
requests and main remains 299fd4c; the prior local handoff f612b0f is preserved.
The business Chrome profile is now exposed as browser 4, while browser 3 is
a different profile. Recovered the existing hello@tuveloz.com Gmail tab through
the supported browser inventory. The scoped Stripe/Founder Shield/Baldwin/county
search still shows only Stripe's existing acknowledgment and substantive reply;
the thread ends with our already-sent 8:05 p.m. follow-up. No new answer found
in that scope and no message resent. This is not a check of every possible sender.

Prepared `legal/payment-policy-reconciliation.md` with candidate English/Spanish
paragraphs and a concrete release/verification sequence. Source review found
that Terms section 7 can imply charging only after completion, while the planned
Checkout uses payment mode without manual capture and holds the later provider
transfer. The exact saved authorization lacks the new merchant sentence and a
language field; the Customer Agreement and quote route are not Spanish-ready.
Existing canonical policy hashes bind English source pages, not the Spanish
dictionary or a presented language. These limitations are now explicit rather
than treating PR #256's bilingual result page as full contract-flow proof.

Rechecked official Stripe merchant, dispute and manual-capture documentation.
Kept legal/tax conclusions, transfer timing limits, fee-refund decisions and
binding acknowledgment acceptance pending their actual evidence. Corrected the
processor card's stale pre-PR #256 interface rows so future work will not repeat
the completed implementation. Linked the draft from the index and launch packet,
and updated the existing September 30 policy review checkpoint.

Validation: 21 existing fee, policy-release-integrity and customer-policy-gate
checks passed; whitespace check passed. Private test output is
`outputs/payment-policy-review-checks-20260927.log`. No runtime file, policy page,
hash/version, accepted record, credential, Stripe setting or launch lock changed.
This is local review preparation, not a publication or legal approval. Preserve
it with the prior handoff for the next substantive release; do not create a
status-only deployment or repeat the completed PR #256 release.

## 2026-09-27 - Publish and independently verify PR #256

The owner continued the explicit publication request for tested head 04cb36b.
Created PR #256 and merged that exact head only after both required PR workflows
passed. Merge 299fd4c598fb082422660ae5cbab731de5f4bb81 landed at September 28
00:54:03 UTC (September 27 Maryland time). Production run 36363910803 passed all
three jobs, including the full verification workflow, before deployment.

Independent live verification at 01:11:33 UTC confirmed the exact merge commit,
ready application/database/schema, accounts/applications open and customer
requests/payments closed. The new result-page header is served. Unknown payment
reads return 404/private-no-store/error-only; new quote readiness returns the
closed-marketplace response; signed-out provider access returns 401/no-store.
There is no public /es/success alias.

Live mobile browser verification at 390px and 320px confirmed both language-switch
directions, the Spanish provider link opening the actual application form, the
Spanish payment-policy link, and the customer link reaching Spanish customer
sign-in. The missing-record message presents recovery guidance without displaying
a payment merchant or paid claim. Cancellation text works in both languages.
No horizontal overflow or captured console errors were observed. No form,
account, provider, real payment or new email was submitted during verification.
Temporary viewport overrides were reset after screenshots and evidence were saved.

This completes the approved publication. Do not repeat the approval, repair or
deployment. All 812 tests/build, TypeScript and 32 synthetic mobile browser cases
passed locally and the required GitHub workflows passed. Authenticated paid,
pending, failed and refunded states were exercised with isolated synthetic data;
actual hosted Checkout/receipt proof and reviewed policy/acceptance evidence
remain separate. No Stripe terms, fee, payment strategy, policy release or launch
lock changed. Stripe's already-sent follow-up still awaits the remaining answers.

Private proof: pr256-premerge-checks-20260927.json,
pr256-pr-verification-result-20260927.json, pr256-pr-build-result-20260927.json,
pr256-merge-result-20260927.json, pr256-production-result-20260927.json,
pr256-live-release-20260927.json and pr256-live-browser-20260927.json.
This post-release handoff stays local for the next substantive release; it does
not require another status-only deployment.

## 2026-09-27 - Send approved Stripe reply and prepare payment-disclosure repair

Sent the exact owner-approved same-thread reply to support@stripe.com from
hello@tuveloz.com. Gmail displayed Message sent; expanded sent-message details
and body confirm September 27 at 8:05 p.m. Maryland time, the intended recipient,
subject and approved text. The existing processor card, deadline row and private
checklist now distinguish the completed send from the unanswered questions.
Private proof: stripe-followup-sent-20260927.png. Do not resend or ask for this
send approval again. No Stripe acknowledgment, setting or paid service changed.

Prepared a local fix identifying TUVELOZ LLC as payment merchant beside the
quote total, in hosted Checkout submit text, and on authenticated payment records.
The short wording keeps independent-provider service responsibility explicit
without duplicating the price/fee breakdown. Supported English/Spanish locale is
carried into Checkout and its return links. The result page translates in place
with an obvious language button and localized policy/application links; it does
not add a public /es/success route or translate original service names.

The same review found failed record lookups silently showing the closed-checkout
message. They now show an unavailable-record message and a support/sign-in next
step. Readable bilingual statuses distinguish paid, pending, failed, refunded and
disputed records. Unknown status values remain under review. A canceled URL no
longer asserts that no payment occurred. The existing authenticated/private-token
checks remain intact; no private token enters the return URLs or Stripe metadata.

Validation: production build and all 812 tests pass; TypeScript passes; lint has
zero errors and the one unchanged language-navigation warning. Thirty-two local
mobile Chromium/WebKit cases pass across both languages, paid/pending/failed/
refunded states, missing records, network failure, cancellation and closed
checkout. They verify no overflow, readable labels, correct links, language
switching without a second lookup, private-header access and no outbound calls.
The browser check is included in the existing verification workflow. The first
full-suite attempt hit local sandbox ancestor-directory access errors; the same
suite passed with the required read access. A missing request-body language type
was corrected before the passing TypeScript/full-suite run. Deadline parsing and
whitespace checks pass. Private test logs/screenshots use payment-disclosure-20260927.

This is prepared locally, not pushed or deployed. No released policy/hash,
acceptance evidence, fee, payment strategy, transfer, provider record, dependency,
service activation or launch lock changed. Real Stripe hosted-receipt proof and
the separate policy/acceptance review remain outstanding. The owner must approve
this new publication; earlier publication approvals and the reply-send approval
are not reused for it. Keep the remaining Stripe/broker/county checkpoints.

## 2026-09-27 - Reconcile Stripe's written response and prepare remaining questions

The scoped business-inbox search found a substantive Stripe Support response
dated September 27 at 5:24 p.m. Maryland time. Expanded sender details show
stripe.com signing and TLS. It confirms Tuveloz as the payment merchant for the
described separate-charge/transfer flow, Tuveloz's responsibility for Stripe
costs, refunds, disputes and losses, and a separate onboarding acknowledgment by an
authorized representative. The earlier July 29 approval and loss acknowledgment
remain complete. No broker/county reply appeared in the scoped search.

Compared the reply to official Stripe documentation and released source
`b5c67a9`. Current Stripe public business name and statement descriptor already
show TUVELOZ LLC; no correction was needed. Platform setup still exposes the
separate onboarding acknowledgment. It was not clicked or accepted. Support's
reference to a live quote flow conflicts with the closed application state; it
does not authorize activation. Transfer time limits, specific service restrictions
and account-specific reserve conditions remain unanswered.

Updated the existing processor record and launch briefing with a surface-by-surface
disclosure review and English/Spanish wording drafts. Prepared one same-thread
Gmail reply covering only the missing questions, acknowledgment text and closed
launch state. The body was read back, a screenshot saved, and the unsent reply
left open for owner review. It has not been sent; the earlier approval covered
the original inquiry. No runtime, policy release, account setting, launch gate,
payment or paid service changed.

Private evidence: stripe-written-response-review-20260927.json,
stripe-support-followup-20260927.md and stripe-followup-draft-20260927.png.
The independent upstream issue check still shows #276 Open with zero comments.
All 15 fee-consistency checks pass after clarifying the processor-cost wording
in this record; deadline parsing and the whitespace check also pass. Only
documentation changed, so the completed application/browser release tests were
not repeated. Preserve these local records for the next authorized release.
Keep September 30/October 2/October 4 response checkpoints. Do not repeat the
published PR #255 release, known-correct Stripe fields or original inquiries.

## 2026-09-27 - Publish and independently verify PR #255

PR #255 merged tested head 1821c39 as b5c67a9. Both PR workflows and all three production jobs in 36355757574 passed. Independent live verification at 22:52:46 UTC confirmed the exact release, ready application/database/schema, both notice manifests and README, and every byte/hash of all 40 unique notice files (31 added plus nine original). The bundled inventory covers 36 installations and 39 references. Signed-out provider access remains 401/no-store/error-only. Accounts/applications are open; customer requests/payments remain closed.

The owner approved the prepared push, pull request, conditional merge and
normal deployment by continuing the explicit publication request. The exact
approved head was merged only after the required checks passed. No application
code, dependency, policy release, migration or launch setting changed.

This completes publication of the additional software notices and the saved
Stripe/insurance/release records. Do not repeat this release or its approval.
The upstream helper attribution question in issue #276 remains pending, along
with owner contribution records, brand provenance and launch-review evidence.

Private proof: pr255-pr-verification-result-20260927.json,
pr255-pr-build-result-20260927.json, pr255-merge-result-20260927.json,
pr255-production-result-20260927.json and pr255-live-release-20260927.json.
This post-release handoff stays local until the next authorized substantive
release; it does not need a separate deployment.

## 2026-09-27 - Post approved attribution inquiry and complete local release checks

Verified the existing GitHub identity, exact upstream repository and absence of
an existing license issue, then posted the exact owner-reviewed question as
[hi-ogawa/js-utils #276](https://github.com/hi-ogawa/js-utils/issues/276) at
21:52:09 UTC. A separate read confirmed title, full body, author and Open status,
with zero comments at that check. The message is sent; do not repeat approval or
posting. No private identifiers, source bundle or attachments were transmitted.
The October 4 checkpoint is an internal review date, not a promised answer.

Preserved notice preparation commit `f8dadfc` and all earlier documentation
commits. The same existing suite passed all 809 tests after the restricted
attempt could not resolve project files because of Windows directory access.
No code change was needed. TypeScript/Worker validation passed; lint reported
zero errors and the unchanged `site-language.tsx` navigation warning. The prior
fresh build and all 39 notice-reference byte checks remain applicable; only
record cards changed after that build. Private logs are
`notices-release-tests-20260927.log`, `notices-release-typecheck-20260927.log`
and `notices-release-lint-20260927.log`.

The prepared branch changes notices, Git attributes and evidence documents;
application code, dependencies, policy releases, migrations and launch controls
are unchanged. No push, PR, deployment, paid service or launch approval occurred.
Publishing remains a separate final step; the unresolved helper notice remains
explicitly recorded pending an authoritative answer.

## 2026-09-27 - Prepare the remaining collected software notices

Fresh GitHub inspection found no open PR and main unchanged at `a1f9ace`.
Preserved the completed Stripe correction and earlier documentation commits.
Validated the saved notice inventory against the unchanged lockfile, installed
package names/versions and source bytes before preparing 31 additional files
(40,076 bytes) under `public/third-party-notices/bundled/`. A separate bundled
manifest covers 36 observed package installations and 39 notice references,
reusing eight existing direct files. All nine original direct notices and their
manifest remain byte-identical. Git attributes preserve upstream notice bytes.

The fresh local production build at `e2ff632` succeeded. Its observer found the
same 36 installed package locations across 172 chunks. All notice references,
both manifests and the README were verified byte-for-byte in `dist/client`.
No package installation, dependency upgrade, application/policy change, send,
paid service or deployment occurred. This is notice packaging proof, not a
blanket license or ownership determination.

The manifest explicitly records the unresolved `@hiogawa/utils@1.7.0` attribution;
no copyright owner or license text was invented. The prepared public upstream
question was shown for specific send approval and remains unsent. Existing
owner-authority and asset-source requirements remain in the same record card.
Private proof: `bundled-notices-preparation-20260927.json`,
`distributed-packages-current-20260927.json`, `bundled-notices-build-20260927.log`
and `bundled-notices-validation-20260927.json`. Collection is ready for a future
approved release; do not repeat this completed preparation.

## 2026-09-27 - Correct Stripe's business description and verify receipt email

Following the exact replacement presented for owner review and the instruction
to continue, updated only Stripe's Business details product-description field.
Reopened the saved record and verified the complete replacement: Montgomery
County marketplace, independent providers, labor-only quotes and separately
purchased parts, accounts/applications open, bookings/payments closed, and a 5%
Customer Service Fee added to the quote with the full quote going to providers.
The earlier legacy 10% description is corrected. Legal, address, tax, bank,
terms and payment controls were not edited. No website change or deployment.

Checked the existing business inbox with a bounded sender/date query covering
Stripe, Founder Shield/Baldwin and Montgomery County. It returned only Stripe's
"We've received your message" acknowledgment from support@stripe.com, displayed
at 4:20 p.m. September 27 with Gmail's Verified Sender indicator. The body
confirms receipt and a future response, not approval. No substantive reply from
the three inquiries appeared in that search. Nothing was resent. The existing
September 30 and October 2 review checkpoints remain.

Private evidence preserves the exact saved text and receipt observation. Two
cropped dashboard screenshot attempts timed out; they are not claimed as proof.
Persistence was verified from the reopened field. The business-mail screenshot
`stripe-support-acknowledgment-20260927.png` succeeded. Fresh GitHub inspection
found no open PR and main unchanged at `a1f9ace`; prior documentation commits
were preserved.

## 2026-09-27 - Submit approved Stripe clarification and prepare the transaction map

Preserved the three existing documentation commits and released runtime. The
owner approved the prepared Stripe inquiry. Submitted its complete body through
the authenticated TUVELOZ LLC support page, requested human Connect review and
selected Platform account / Send us an email. The page confirmed Email received;
private screenshot `stripe-support-email-received-20260927.png` preserves it.
No case number or human answer was shown. The displayed 24-hour estimate is not
a promised deadline; the existing September 30 checkpoint remains.

The initial automated response incorrectly associated approval with the account
creation date and mentioned legacy fee wording. The July 29 business-inbox
approval remains the primary evidence. A targeted read of the product-description
field independently confirmed stale 10% copy in Stripe. Prepared a replacement
with the actual 5% Customer Service Fee, full provider quote and closed-booking
state; no account setting was saved. Automatic review rejected an overbroad
business-page read, so the field-only check was used without exposing unrelated
private identifiers. No terms, payment lock or live transaction changed.

Extended the existing launch briefing with a source-backed transaction map for
the tax reviewer. It separates quote charges, held amounts, full-quote transfers,
processor costs, refund/dispute events and the different storefront branch.
Highlighted checkout's zero-tax code restriction as an assumption requiring
review, not evidence of tax exemption. No CPA opinion or gate approval claimed.

Validation: all 15 fee-consistency checks pass. Their first run caught two
ambiguous responsibility phrases in the prior documentation; both now clearly
say the platform is responsible for Stripe costs and negative balances. Runtime
source, reviewed policies and release history are unchanged.

## 2026-09-27 - Recover existing Stripe approval; narrow remaining processor review

Preserved local commits `a87f938` and `7e259cb`; fresh GitHub inspection found no
open PR and main still `a1f9ace`. A scoped business-Gmail search found Stripe's
July 29 "Your Connect application is approved" email. It explicitly approves
TUVELOZ LLC to create live connected accounts and charges. Gmail displays the
verified sender, stripe.com signature and expected business recipient. This is
existing processor approval, not merely bank-linking evidence; earlier summaries
that failed to recognize it were incomplete.

Signed-in Stripe Platform profile and Platform setup agree: buyers purchase from
the platform, individual seller payouts, platform responsibility for Stripe costs
and negative balances, Express
and Stripe-hosted/embedded onboarding. The refund/loss acknowledgment is dated
July 29. Current source matches those responsibility/dashboard settings. Both
pages also show an onboarding-compliance acknowledgment action; it was not
accepted and its account effect is not yet established.

Created the indexed processor approval record card, corrected the register/vendor
card/launch packet, and prepared a narrowly scoped support clarification instead
of repeating the Connect application. Questions cover exact services, transfer
delay/reserves, receipt/statement disclosures and the displayed acknowledgment.
Stripe's current documentation identifies the platform as merchant of record for
the implemented indirect charge shape without `on_behalf_of`; the CPA/legal review
and final policy wording still need reconciliation. No gate, runtime source,
account setting, provider, charge, transfer, paid service or outgoing message
changed. The personal Gmail connector was not used to read business mail; the
existing business browser session supplied this evidence.

## 2026-09-27 - Prepare insurer decisions from the actual provider checklist

Preserved completed PR #254 and local release-evidence commit `a87f938`; fresh
GitHub checks found no open PR and main still `a1f9ace`. Instead of repeating
release work, executed the unchanged jurisdiction-aware policy resolver and
insurance classifier locally for all 25 services and 47 configured pathways.
The new indexed `business/provider-insurance-review-matrix.md` records exact
coverage selections, location boundaries and questions for the insurance review.

Only two of 23 independent-provider combinations select named insurance
evidence: towing/storage and lockout. The other 21 do not; all 24 employee/trainee
combinations select workers' compensation. No resolved combination selects the
defined broker coverage determination type. Empty coverage selections are not
evidence that insurance is unnecessary; package evidence and the written insurer
decision remain separate. All 25 services stay disabled. Do not mark the provider
insurance matrix gate complete or invent a universal requirement from older
prose. The platform policy and each provider's coverage need separate evidence.

Private inventory `outputs/provider-insurance-inventory-20260927.json` retains
all requirements, exact service/pathway/scope/location identifiers, source hashes
and generation time. The local helper uses the real resolver without duplicating
its policy logic. No application source, policy release, provider record, paid
service or outgoing message changed. The existing Founder Shield inquiry and
September 30 checkpoint remain in place; no duplicate inquiry was sent.

## 2026-09-27 - PR #254 published; provider validity repair verified live

Continued the owner's standing instruction to fix and finish Tuveloz. PR #254
merged tested head `2a0373b` as `a1f9ace7f1777170702e43213dace33638d6ee84` at
16:35:55 UTC after all required checks passed and the reviewed head/base were
reconfirmed unchanged. Both PR workflows passed; production workflow
`36333832839` then passed all three jobs, including 809 tests/build, required
browser checks, the migration rehearsal and end-to-end provider signup.

Independent live verification at 16:52:43 UTC matched that exact release and
confirmed ready application/database/schema, no missing tables or guarded
triggers, and signed-out provider onboarding returning 401/no-store/error-only.
Accounts/applications remain open; customer requests/payments remain closed.
The document-start and recorded pathway-validity checks are published under
eligibility rules `0.14.2`. No real provider, document, email or payment was
changed as a test. The runtime simulations below establish the date/replacement
behavior; deployment/health do not grant provider approval or finish the
real-channel reminder and operational launch review.

Private evidence: `outputs/pr254-merge-result-20260927.json`, both PR result
files, `outputs/pr254-production-result-20260927.json`, and
`outputs/pr254-live-release-20260927.json`. Preserved PR #253 and its release
record. The completion checklist and launch handoff now mark this repair
published; do not repeat its approval, repair or deployment. Follow-up evidence
notes are committed locally without triggering another documentation-only release.

## 2026-09-27 - Verify expiration blocking; repair ignored validity starts and pathway dates

After PR #253, a fresh concurrent-work check found no open PR and main still
`ed6c593`. Preserved its completed release notes (`b707d53`) and continued on
`test/provider-evidence-validity-20260927`. This follow-up tests actual eligibility
decisions rather than repeating the reminder release or sending another email.

A new in-memory, fully migrated SQLite test executes the real stage engine,
policy resolver, acceptance checks and external-authenticity validator. Only
database/environment bindings are substituted; every outbound call throws.
Synthetic provider, personnel, registration and acceptance records remain local.
The unchanged service catalog stays closed even in the fixture; assertions
isolate the document decisions and retain that denial rather than treating the
simulation as authorization to work. The initial fixture incorrectly chose an
insurance requirement absent from the selected service's resolver; correcting
the fixture to its actual county-registration requirement reached the engine.

Existing protections passed: inclusive expiration cutoff, all seven work-stage
rechecks, the later of work/recheck time, pending/quarantined/rejected or
wrong-scope replacements, valid replacement selection, external-authenticity
expiry and real-mode launch denial. Three behavioral assertions then failed:
future or invalid evidence start dates were ignored, and recorded pathway
validity dates did not add a denial after expiry or before their start.

The targeted repair checks supplied evidence start dates and recorded pathway
start/end bounds against the work/recheck time, preserving unspecified optional
dates and the existing end-of-date convention. Eligibility rules advance to
`0.14.2` so cached results from the older rules cannot satisfy version checks.
No policy matrix, reviewed legal text, launch/payment/SMS switch, schema or
dependency changed. No real provider, credential, email or payment was written.

All 809 tests and the production build pass; TypeScript passes; lint has zero
errors and the same existing navigation warning. The focused run passes 26
checks. Before/after and full validation logs are retained privately as
`outputs/provider-evidence-validity-*-20260927.log`. This is local behavior
proof; publication is tracked separately below and real-channel reminder
delivery and the launch-review decision remain incomplete.

## 2026-09-27 - PR #253 published; expiration reminder repair verified live

The owner explicitly approved publishing the tested reminder repair. That
approval covered the PR, normal release checks, merge, deployment and valid
queued reminder delivery; do not request it again. Tested head `6a36c51`
merged in PR #253 as `ed6c5930214a33bb0dff4048398e266410da2e89` at 15:20:50 UTC.
Both PR workflows passed. One local GitHub check-monitor connection was
interrupted; resuming the monitor completed normally, without rerunning tests
or bypassing checks. The merge verified the reviewed head and unchanged base.

Production workflow `36329213779` passed all three jobs, including all 800
tests/build, required browser checks, the fresh-database migration rehearsal
and end-to-end provider signup. Independent live verification at 15:37:58 UTC
confirmed the exact merge commit, ready application/database/schema and no
missing tables or guarded triggers. Signed-out provider onboarding returns
401 with no-store, error-only output. Accounts/applications remain open;
customer job requests and payments remain closed.

Before release, a read-only aggregate query in the signed-in Cloudflare D1
console found zero compliance reminders and zero expiration-family outbox
rows. The CLI read had failed authentication; the browser check required no
new credential or record changes. Those counts describe that check, not future
traffic. No real reminder was sent as a verification test. The isolated SQL
and intercepted-transport tests establish delivery/retry behavior; health and
release checks do not establish real inbox delivery or approve a launch gate.
Real-channel evidence and automatic-expiration-blocking review remain pending.

Private evidence: `outputs/pr253-merge-result-20260927.json`, the PR and
production result files, `outputs/pr253-live-release-20260927.json`, and
`outputs/pr253-reminder-counts-browser-20260927.json`. The launch packet and
completion checklist now distinguish this completed release from the remaining
real-world review. No policy, provider eligibility, payment/SMS switch or paid
plan changed. Follow-up documentation is preserved locally; no second
deployment is needed just to publish these evidence notes.

## 2026-09-27 - Repair blocked expiration reminders; reconcile remaining scope

Fresh GitHub review found no open PR and main unchanged at `0d6fc3d`.
Preserved the local PR #252 release record and continued on
`fix/provider-expiration-reminder-delivery-20260927`. The launch packet still
listed expiration-reminder delivery as unverified. Following the real scheduler
and outbox found a mismatch: uploads persist `provider-evidence-expiration:`
events, but neither the protective event classifier nor retry query recognized
the resulting `marketplace:provider-evidence-expiration:` family.

An isolated migrated-SQL test reproduced six due reminders being retried without
any transport attempt and an already queued reminder remaining pending. It
executes the real sweep, email queue, policy, SQL and provider audit; only runtime
bindings and transport are fixtures. The initial sandbox bundler permission
failure was environmental, not the reproduction; the subsequent run reached
and failed three behavioral assertions before the repair.

The local repair recognizes this exact event family. Before each send,
including outbox-only retries, it requires a due, non-cancelled reminder bound
to the same non-test provider, recipient, accepted evidence, service and
original expiration. Missing/mismatched/revoked records and staging stay
blocked; test-prefixed, unknown and transaction messages remain quarantined.
Existing event keys are retained for idempotency. All six lead-time/window
notices send once through the intercepted transport, failures recover with
the same key, and already accepted mail is not resent. Eligibility/evidence
records are unchanged by the tests.

All 800 tests and the production build pass. TypeScript passes; lint has no
errors and the same existing navigation warning. Evidence:
`outputs/reminder-delivery-before-20260927.log`,
`outputs/reminder-delivery-after-20260927.log` and the full test/type/lint logs.
No real email, production record, paid call, approval or launch switch changed.
The repair remains local pending scoped publication approval and normal release
checks; production is still PR #252. This does not complete the real-channel
reminder or automatic-expiration-blocking launch review.

Reconciled the existing launch handoff instead of starting optional features.
It now distinguishes open signup flows, provider activation, customer launch,
reproducible repairs, optional product work and dated follow-ups. Closed the
generic reminder-setup row using existing recorded deadlines and corrected
the stale sitemap count. Outside replies, owner evidence and reviewer decisions
remain open; the owner's application remains last. No old feature was restored,
no outside inquiry resent, and the separate license inquiry remains unsent.

## 2026-09-27 - Publish and independently verify PR 252

After the owner continued the scoped publication request, automatic approval
review allowed the exact-head gated release. All required PR checks passed for
`71238f94c82b48404a5ffa6a9c4b45b527813cc0`, including the new twelve-case provider
tools browser regression. PR #252 merged as
`0d6fc3d08b46626e30a8cc70d96c69bd5976a813` at 14:26:36 UTC. Normal production
workflow `36325931216` passed all three jobs at 14:42:49 UTC, including the
793-test suite, both browser engines, Spanish coverage, provider signup,
fresh-database migrations, production build and exact-release readiness.
Lint retains one existing language-navigation warning and no errors.
No further publication approval or repeat release is needed for this repair.
A fresh concurrent-work check found no open pull requests.

Independent public verification at 14:45:25 UTC confirmed the exact merge,
ready application/database/schema, no missing tables or guarded triggers and
unchanged onboarding-only state. Accounts/applications remain open; requests
and payments remain closed. The signed-out provider-tools API returned 401,
no-store and an error-only response.

The initial local bundle filename returned 404. The actual live page references
`/assets/page-B41cR2t_.js`; its SHA-256 is
`8d32ee93c74e1c069221285ab41f7e3119781517f78737c8386d20157d72d335`.
Its bytes exactly match the originally hashed tested module except for the
single generated link import filename (`link-C7x9CXCy.js` locally versus
`link-C3TwM0-s.js` live). All four direct imports return 200. This is scoped
component comparison, not a claim that the whole dependency graph is byte
identical. No website change was needed to resolve the verification mismatch.

Evidence: `outputs/pr252-production-result-20260927.json`,
`outputs/pr252-production-checks-20260927.log`,
`outputs/pr252-live-release-20260927.json` and the retained browser regressions.
Behavioral proof uses isolated synthetic fixtures; no real provider account,
credential, message, payment or launch decision was written. The separate
upstream license inquiry remains unsent pending explicit approval. The final
release record is saved locally after publication; it is not another deployment.

## 2026-09-27 - Preserve provider tool drafts after rejected saves

Fresh review found no open PR and GitHub main still at `643a143`. Preserved
the prior local release/notice record commit and continued on
`fix/provider-tool-draft-retention-20260927`. While reconciling the older
PR #33/#46 checklist entry, found that both forms in `/provider-services`
unconditionally reset after their shared save helper handled an error.

Reproduced lost service and credential drafts with the real page in isolated
Chromium and WebKit fixtures: all twelve validation, unavailable-server and
network-failure cases lost entered values before the fix. The save helper now
returns its success result and each caller resets only after success. Re-ran
all twelve scenarios successfully, including exact retained fields, no
automatic resubmission, deliberate retry with the same payload, clearing
after success and credentials remaining pending/private. Corrected the test
fixture to serve the existing local badge asset; it permits no external calls.
Added the regression to the normal release workflow. This is a narrow failed-
save draft repair, not a claim that every malformed-response or timeout path
on that page has been reviewed.

Production build and all 793 tests pass; TypeScript passes; lint has no errors
and the same existing language-navigation warning. No API, database, policy,
provider approval, live transaction, signup flow or launch switch changed.
No paid call or real provider record was used. Evidence:
`outputs/provider-tools-before-20260927/`,
`outputs/provider-tools-after-20260927/`, and the full test/lint/typecheck logs.
The source fix is local and awaits publication approval and normal release
checks; production remains PR #251.

The upstream notice review found no existing license issue or license file
on the current `hi-ogawa/js-utils` main tree. Prepared a short public inquiry
requesting the official attribution for the embedded 1.7.0 helper; owner
approval to post it is pending, so nothing was sent. The retained 39-file
collection remains private. The older closed PRs were inspected, not restored:
PR #33's reminder/range additions are absent, and its old migration number is
already occupied. PR #46's exact owner-only draft tool is absent, while the
current bilingual `/ai` policy/help route exists independently. No claim of
feature equivalence or reason to reactivate a paid API was inferred.

## 2026-09-27 - Publish PR 251 and preserve build-output notice evidence

The owner explicitly approved merging PR #251 and deploying it. Fresh review
confirmed the unchanged tested head `19e56e7`, the expected base `546e60a`,
clean merge status and successful required checks. Merged through the normal
workflow as `643a1437add35efbb579a95ec4a9f7e5fedd1d09`; the earlier automatic
approval block is resolved. Production workflow `36322688451` passed all jobs,
including 793 tests/build, both browser engines, Spanish coverage, the complete
provider signup, fresh-database migration rehearsal and exact-release checks.
The existing language-navigation lint warning remains unchanged.

At 13:46:49 UTC an independent public check confirmed the exact release,
ready application/database/schema and unchanged onboarding-only state.
All nine live direct-dependency notices matched their recorded SHA-256 values;
the previously served unused font returned 404. Four actual clicks from the
bottom mobile homepage opened the customer creation form and provider
application in English and Spanish. Both provider links scrolled to the form;
all four pages fit the 390-pixel viewport and no page errors were captured.
No account, application, email or payment was submitted. Language and viewport
were restored after checking. Evidence: `outputs/pr251-live-release-20260927.json`,
`outputs/pr251-live-mobile-navigation-20260927.json`,
`outputs/pr251-live-spanish-provider-mobile-20260927.png` and the saved
production-check log. This release is complete; do not repeat its approval
or publication steps.

Continued the existing ownership/notice review with a separate local build
observer, without changing application files or dependencies. It identified
36 installed package/version locations across 172 emitted chunks. Preserved
39 exact-source notice files privately and recorded the missing official
notice for the bundled `@hiogawa/utils@1.7.0` helper. The Vite plugin's own
missing packaged notice was recovered from its pinned official release.
See `records/code-ownership-and-contributors.md` for sources and limits.
The additional collection and this follow-up record are local only; they are
not part of PR #251's published nine-notice collection. No upstream inquiry,
purchase or launch approval occurred. County and broker inquiries remain
sent once, with their existing response checkpoints; the owner's application
remains the final step.

## 2026-09-27 - Remove unused font cache and preserve dependency notices

Fresh GitHub read found no open PR and main remained `546e60a`. Preserved all
four local documentation commits and continued on
`fix/remove-unused-font-cache-20260927`. The prior asset review identified
eleven old font files and two generated stylesheets; the existing build
actually copied all eleven into client assets although the current layout/CSS
uses system fonts and no page imports them. The installed vinext font plugin
copies cached fonts without checking whether a page references them.

Extended the existing rendered-asset regression to reject that stale cache.
It failed against the previous build as expected. Removed only the thirteen
tracked `.vinext/fonts` files, keeping them recoverable in Git history, and
ignored generated `.vinext` output. No app component, page, style, dependency
version, database, legal policy or launch/payment control changed.

Preserved all nine direct dependency notices in `public/third-party-notices`
with exact versions, source references and SHA-256 hashes. Eight came from the
matching installed packages. Drizzle ORM's missing package notice was obtained
from its official 0.45.2 tag, pinned to commit
`273c78071d4841b497f5144734b38294df7ec64b`; upstream Git blob and saved bytes
were checked. This scoped collection does not clear every transitive package,
brand asset or owner contribution record. No paid service was used.

The first full run exposed restricted-filesystem bundler failures and one
real documentation issue: the saved county-email transcript used a retired
fee name. Kept that sent transcript verbatim outside the repository and
replaced the repeated body with a clearly labeled summary using the canonical
Customer Service Fee name. The sent email was not edited or resent, and the
fee-copy guard was not relaxed. Its fifteen checks pass. Re-ran the full suite
with the filesystem access required by the existing bundler: production build
and all 793 tests pass. TypeScript passes; lint reports zero errors and the
same `site-language.tsx` warning as the unchanged source on main.

Private evidence: `outputs/unused-font-cache-before-20260927.log`,
`outputs/font-cleanup-tests-20260927.log`, `outputs/font-cleanup-lint-20260927.log`,
`outputs/font-cleanup-types-20260927.log`, and
`outputs/county-inquiry-sent-20260927.txt`. Publication remains pending owner
approval and normal PR/production verification; no push or deploy occurred.

## 2026-09-27 - Send the approved county inquiry and refresh asset records

The owner's "Yes and continue" approved the prepared OCP inquiry. A refreshed
business Gmail Sent search was empty before sending. Sent the exact approved
message once from hello@tuveloz.com to OCP.Licensing@montgomerycountymd.gov at
7:20 a.m. Maryland time. Gmail confirmed sending; a refreshed Sent search
contained one matching message, whose complete body, sender, recipient and
timestamp were verified. Do not resend. Private screenshot:
`outputs/county-inquiry-sent-20260927.png`. No receipt, answer or agency
determination is claimed. No attachment, application, fee or paid work was
authorized. Updated the source review, launch briefing and October 2 answer
checkpoint to distinguish the completed send from pending written guidance.

Fresh GitHub checks found no open PR and main still at `546e60a`. Preserved
the three local documentation commits and completed live release. Refreshed
the company-authority contribution card: main has 503 commits (434 under the
willym249-dev label and 69 under Claude), not evidence of legal authorship.
All nine installed direct dependency versions match the lockfile. The private
inventory contains 741 package entries and hashes of 28 tracked assets and
available direct-dependency license files. `jose`'s missing lockfile license
field is resolved by its installed MIT license. Drizzle's root notice absence,
older tracked font provenance, distributed third-party notices, and master
logo/contributor source records remain review items, not findings of unlawful
use. Development/optional packages are not automatically deployed artifacts.

Found contradictory historical ad instructions: the handoff recorded an
expired music window but later told readers to reuse that track; another plan
called surviving visuals already licensed. Corrected those statements and
marked four ad plans as historical proposals requiring current rights/claims
review. The old music and two Ad 01 renders remain absent locally; no media
was restored, deleted, replaced or published. No subscription or billing
setting was inspected or changed. Asked the owner who contributed material;
the answer and private records are still pending.

Private audit evidence: `outputs/ownership-asset-evidence-20260927.json`.
This continuation changes documentation only; no dependency, application,
eligibility rule, launch/payment control or live website changed. Validation
uses the existing deadline parser, local evidence/relative-link checks and
`git diff --check`; a production rebuild is not needed for these records.

## 2026-09-27 - Compare provider requirements with official service definitions

No open PR at start; main remains `546e60a`. Preserved the two local completion/
email evidence commits. This pass addresses the previously unconfirmed legal-
category mapping in the launch briefing rather than repeating the live release
or inbox tests. Read the county registration guidance, current online 31A-1,
municipal applicability table, DEP wash-water guidance, and Maryland 14-1001.

Executed the existing policy, compliance, and signup-document modules for all
25 codes. Sixteen eligible-pathway entries request county repair registration,
towing has its own certificate, seven county-scope categories need an agency
answer, and the broad repair category remains prohibited. All 25 stay disabled
or prohibited. The seven existing document checks pass, including every
independently selectable service pair and removal/deduplication behavior.

Filed and indexed `legal/provider-service-requirements-review.md` with the
all-code inventory, sourced conclusions and explicit inferences. Important
remaining questions are photo-only versus vehicle examination, cleaning scope,
overlapping specialty credentials, municipality boundaries, and the different
state/county repair definitions. No unsupported exemption or new document
requirement was put into the signup flow. Updated the launch briefing and added
an October 2 follow-up checkpoint. The exact one-message OCP inquiry is prepared
for owner review, not sent; no agency determination or paid service is claimed.

Private inspection proof: `outputs/provider-requirements-snapshot-20260927.json`;
existing checks: `outputs/provider-requirements-checks-20260927.log`.
No application, payment, legal-release text, eligibility configuration, or live
website change was made. The next action is owner approval of the prepared
agency email; a county reply cannot itself approve a provider or launch gate.

Validation confirms every matrix code appears exactly once in the review, the
deadline parser includes the new October 2 checkpoint without malformed dates,
and diff whitespace checks pass. Business Gmail's focused Sent search found no
mail to the OCP licensing recipient. Documentation is saved locally; no PR,
push, deployment, or message send occurred.

## 2026-09-27 - Verify the received sign-in header and read one new mail report

Preserved PR #250's completed release and its local evidence commit `d43188c`.
No open PR was found at the start of this pass; main remained `546e60a`.
Used the signed-in Tuveloz business inbox to inspect the original message from
the completed hosted staging sign-in. Google's received summary reports SPF,
Tuveloz-aligned DKIM, and DMARC PASS, with delivery after one second. Message
time is September 27, 00:51:36 UTC. This closes the missing sign-in-header
evidence without another send or staging credential. Full message content and
sign-in codes are not retained in the repository.

One new Google report arrived at 6:18 a.m. Maryland time. The supported Gmail
download and private local XML parser produced three rows and five observations
for September 26 UTC: three aligned passes (one website, two business Google)
and two failures signed for another domain with a local-policy ARC override.
The latter is consistent with relaying, not established legitimate mail or fraud.
The reporting period predates the recorded staging message and broker inquiry;
do not use it as delivery confirmation for either. The report identity was
compared with the earlier analysis and is new. The previous eight files were
not reread or reparsed.

Updated the email runbook and open sender-inventory checkpoint, keeping the
earlier three unexplained unsigned failures and recurring-reader assignment
open. Asked the owner to confirm any additional sending apps. Private evidence
is `outputs/email-delivery-evidence-20260927.json` and
`outputs/dmarc-reports-20260927.private/analysis.json`; raw report and hash stay
outside the repository. Documentation/evidence only: no code, DNS, account
setting, external message, paid service, or launch/payment decision changed.
The website remains at the already-verified PR #250 release.

Validation: the existing deadline parser includes the updated open email item
with no malformed dates; the reduced private proof matches the parsed report
totals; `git diff --check` passes. Saved as a local documentation commit, with
no PR, push, or deployment needed for this inbox-evidence pass.

## 2026-09-27 - Finish Spanish privacy controls and preserve form state

The private privacy center now has published Spanish interface coverage for the
request form, communication preferences, history/statuses, consent provenance,
service/validation errors, notices and accessible labels. It uses the existing
React translation boundary and translates in place, without a public
`/es/privacy-center` alias. User-entered details, owner response notes, email,
request identifiers and API values stay unchanged. Dates follow the selected
language. Language hints survive reload and blocked browser storage; sign-in
and return navigation preserve the selected language.

The mobile review also found oversized checkboxes and a low-contrast native
request dropdown. A long Spanish selected value in WebKit overflowed the
320px page after the contrast adjustment; a focused reproduction confirmed the
native control behavior and passed after scoped appearance/width corrections.
The overflow assertion remains enforced. These styles do not change other
forms. Synthetic Chromium/WebKit coverage expanded from eighteen to
sixty-four scenarios across English/Spanish at 390px/320px, including all
request states, draft/checkbox retention, successful writes with original
values, failed/stalled requests, validation and expired-session redirects.
The dictionary/error and private-route checks bring the regression suite to
793 passing tests. Build, TypeScript and lint pass with the existing navigation
warning. No real account, privacy request, data export, email or payment changed.

Published as PR #250: tested head `ee79648` merged as
`546e60adeac216c4b99822d6e6af709ab74ea24c`. Required PR verification
`36310792569` and all three jobs in production workflow `36311546784` passed.
The release was built at 10:23:50 UTC; independent public health at 10:29:18 UTC
confirmed the exact version, ready application/database/schema, and no missing
tables or guarded triggers. Accounts/applications remain open; customer
requests/payments remain closed. Four unsigned/invalid-scope privacy API checks
returned private, no-store rejections, and `/es/privacy-center` correctly
remains a 404. Four live mobile Chromium/WebKit English/Spanish checks followed
the private-page sign-in redirect, retained language and privacy context, fit
320px/390px, and finished with no page errors. No account was submitted.

The first live WebKit harness intercepted speculative RSC GET preloads while
the document redirected and reported access-control warnings. Direct account
loading was clean. Letting those same-origin GET preloads use the normal
browser network path made the actual redirect checks pass with the zero-error
assertion retained; no production workaround or access control was changed.
Evidence is retained privately in `pr250-live-release-20260927.json` and its
workflow/browser logs. Authenticated form proof remains synthetic. No policy
release or launch control changed; translation is not a full privacy/retention
launch review. Preserve PR #249 and do not repeat either completed repair.

## 2026-09-27 - Verify privacy isolation and recover from privacy-service failures

A focused review exercised real signed account sessions and privacy API queries
against migrated in-memory SQLite with synthetic customer/provider records.
The account-isolation checks already passed: forged/revoked sessions, unrelated
application IDs, cross-account withdrawals and cross-origin writes are rejected;
blocked/declined applicants retain only their own privacy access. Exported data
does not include the seeded password, document-hash or storage-key secrets.

Five recovery cases failed before repair: authentication/storage errors escaped
the API handlers, writes could return internal errors, failed confirmation reads
misrepresented a saved choice, and malformed bodies lacked a useful private
response. The APIs now return private, retryable service errors and separate
validation errors; raw database details are excluded from responses and logs.
The page has bounded read/write waits, rejects malformed success responses,
offers an explicit refresh that reads rather than repeats a write, and preserves
the requested customer/provider scope. A direct provider-privacy link now loads
that view instead of silently defaulting to the current customer role.

All 789 tests/build, TypeScript and lint pass (one existing navigation warning).
Thirteen added test counts cover actual authentication and SQL; eighteen mobile
Chromium/WebKit scenarios pass, and the browser checks are added to required CI.
All data and network responses are synthetic; no live export, privacy request,
email, provider approval or payment occurred. The private privacy center remains
English-only under the existing reviewed-language routing rules; this repair
does not claim a Spanish version or create a public alias. No policy text or
launch gate changed.

Published as PR #249: tested head `9a99f97` merged as
`f78d76a45e33e1105d7c83d565047e217fd41a5d`. Required PR verification
`36305955945` and all three jobs in production workflow `36306743015` passed,
including the browser suite and end-to-end provider signup. The release was
built at 08:52:13 UTC. Independent public health at 08:54:23 UTC confirmed the
exact version, ready application/database/schema, and no missing tables or
guarded triggers. Accounts/applications remain open; customer requests/payments
remain closed. Four read-only live API checks confirmed unsigned access and
invalid privacy scopes are rejected with private, no-store error responses.
Authenticated isolation/recovery proof remains synthetic, not a live export or
privacy submission. Private evidence is retained outside the public repository
in `pr249-live-release-20260927.json` and the corresponding workflow records.
Full privacy/retention review, reviewed Spanish privacy controls, and owner
decisions remain separate. Do not repeat this completed repair or PR #248.

## 2026-09-27 - Preserve concurrent refund, dispute and launch holds

The next bounded reconciliation review reproduced overlapping refund/dispute
writes that replaced a newer hold, replaced a newer refund total, or cleared an
adverse result with an equally timed success. These were isolated synthetic
failures, not real transactions. PR #247's completed checkout repair is preserved.

Refund writers now read the local version before reading the Stripe Charge,
check that version in the SQL write, and reread on contention (three attempts;
continued contention throws so the webhook remains retryable). This preserves
current totals without treating the largest observed amount as permanent: a
genuine later refund failure can still correct the total. SQL evaluates dispute
and launch holds against the row being written. Equal-second refund successes
cannot erase adverse refund fields hidden by a dispute; equal-second dispute
wins cannot replace an adverse dispute. Newer authoritative updates still work,
and PaymentIntent matching before checkout stores a Charge ID is retained.

Ten added behavior cases execute migrated in-memory SQL, including deterministic
interleavings, retry exhaustion, reverse arrival order and positive controls.
Outbound calls are blocked and Stripe reads are synthetic. All 776 tests, the
production build and TypeScript pass. Lint has no errors and its existing single
navigation warning. Private before/after logs are retained outside the public
repository. No schema, fee, UI, credential, provider approval or launch/payment
switch changed. PR #248 passed both PR workflows; tested head
`e1c2b86d1a20be0759af8c70dc2e8ac30241418e` merged as
`59b9e91f7f56b051888f6aab74732a4b5ec809fc`. Production workflow `36302540175`
passed all three jobs, including the complete browser signup, rendered Spanish
and fresh-database checks. Independent public health at 07:31:55 UTC confirmed
that exact release (built 07:29:50 UTC), ready application/database/schema and
no missing tables/triggers. Accounts/applications remain open; requests/payments
remain closed. Private test and release proof is retained outside the repository.
Do not repeat this completed repair. No real charge/refund/provider record was
changed; this is not proof of real money movement or Stripe-originated financial
delivery. The broker-response checkpoint and genuine-provider evidence remain
separate launch work.

## 2026-09-27 - Prevent checkout notifications from overwriting newer payment states

The next isolated payment/refund review reproduced three failure-path defects:
an unrelated checkout Session could fail/expire the payment named in metadata;
a completed payment could be overwritten between the failure handler's read
and write; and a replacement Session could be expired by the older attempt.
The reverse completion path also overwrote a concurrent refund/dispute/launch
hold or rebound a replacement Session. These are local synthetic reproductions,
not observations of a real customer payment. Live money movement remains locked.

Failure/expiry now uses one conditional SQL update matching the stored Session
and an allowed pending status. Completion also conditions its final write on
the same Session and the status it originally read, preserving newer decisions.
No payment operation, credential, schema, fee or launch switch changed.

Ten added tests execute the actual payment route/helpers and migrated in-memory
SQL, with signed synthetic requests, deterministic concurrent writes and blocked
outbound calls. They demonstrate failures before the repairs and success after,
including matching positive controls, duplicate handling, refund/dispute holds
and preservation of launch holds. The obsolete assertion requiring a warning
string was replaced by this behavior coverage. All 766 tests, the production
build and TypeScript pass; lint has no errors and its one existing navigation
warning. PR #247 passed both PR workflows, including the browser signup and
bilingual flow checks. Tested head `b4058bf031b760df3faf4e0cb95246eca69facdd`
merged as `27c1fe73f86443dcfa9dcddac950eeea442e0ac4`. Production workflow
`36299174143` passed all three jobs. A separate read-only public health check
at 06:22:43 UTC verified that exact release (built 06:20:45 UTC), ready
application/database/schema, no missing tables/triggers, accounts/applications
open and requests/payments closed. Private before/after test logs and release
proof are retained outside the public repository. No live charges, refunds or
provider records were created or changed. This does not prove real Stripe
checkout/refund/dispute/payout delivery or approve launch. The focused business
inbox search found no Founder Shield reply; no duplicate inquiry was sent.
Do not repeat the completed repair or the preceding PR #246 connection setup.

## 2026-09-27 - Enable approved payout-status feed and fix its payment-client dependency

The owner approved the prepared connection, encrypted signing-secret storage,
and synthetic testing. Stripe created `Tuveloz provider payout safety` as an
Active, Connected accounts, Snapshot destination on API `2026-06-24.dahlia`
with exactly the nine reviewed events. Cloudflare production now shows
`STRIPE_CONNECTED_ACCOUNT_WEBHOOK_SECRET` as Value encrypted. The existing
Identity/thin Connect destinations and other credentials were preserved;
`STRIPE_ALLOW_LIVE_MODE` remains false. No purchase or real payment occurred.
Private masked setup screenshots are retained outside the repository.

The deployed synthetic probe caught a real configuration-dependent defect:
with a live payment key present but payments code-locked, this snapshot route
constructed the payment client before verifying a webhook. It returned 503
even for an invalid signature. No synthetic event reached a database write.
Public health remained ready at release `f31f85c`, with bookings/payments closed.

The targeted fix calls Stripe's existing static webhook verifier directly.
It requires the dedicated signing secret and uses the same cryptographic
provider; it creates no API client, makes no vendor request and changes no
payment lock or payout decision. A real-route/migrated-SQL regression reproduced
the 503 before the fix. Nine new local tests exercise locked/absent API keys,
bad signatures, unmapped providers, duplicates, failed/canceled payouts,
deleted/expired payout accounts, stale/equal-time events, wrong-mode snapshots,
storage retries and abandoned processing claims. Synthetic tests create no
payment, email or provider approval.

Validation: all 756 tests and the production build pass; TypeScript passes;
lint has no errors and one existing site-language navigation warning. PR #246
passed both PR workflows, including the browser and bilingual signup checks.
Tested head `82a371f` merged as `31980998846d1f749fce7bcca539a39edb2e2711`.
Production workflow `36297054968` passed all three jobs and verified the exact
healthy Cloudflare release. No local deployment bypass was used.

At 05:39:09 UTC, six checks against the deployed receiver passed: missing,
wrong, expired and altered-body signatures returned 400; the correctly signed
synthetic event returned 200, and repeating it returned the durable duplicate
acknowledgment. The event names an unmapped synthetic account, so it cannot
change a provider's snapshot, approval or payment. This is a direct synthetic
endpoint check, not a Stripe-originated delivery or a bank settlement. Public
health before/after confirms the exact commit, ready application/database/schema,
accounts/applications open, and requests/payments closed. The expiring request
file was removed; the signing secret was never written to disk and its temporary
in-memory copy was cleared. Private results and masked setup screenshots are
retained outside the repository. Do not repeat the completed setup or release.

The authenticated owner launch-review page was also refreshed read-only on
September 27: all eighteen controls Pending, transactions OFF and zero services
activated. No review decision was made. The business inbox search for replies
from the contacted broker returned no messages; the September 30 follow-up
checkpoint remains, and no duplicate inquiry was sent. Genuine provider and
external review evidence remain separate from these completed technical checks.

## 2026-09-27 - Confirm the missing provider payout-status connection

Continued after the insurance explanation without repeating completed releases.
Remote main remains `f31f85c` with no open PRs. The approved broker inquiry has
no reply in its business Gmail thread at this check; do not resend it.

The read-only readiness report confirms the source onboarding/payment/SMS
locks remain closed, `LAUNCH_UPDATES_POSTAL_ADDRESS` remains intentionally
unset, and `STRIPE_CONNECTED_ACCOUNT_WEBHOOK_SECRET` is absent from the
deployed secret-name list and checked configuration. Gate decisions were
**unknown** in this CLI run: Cloudflare rejected the D1 read with API error
7403. This is a credential/account authorization limitation, not evidence of
missing tables or a changed gate decision. The September 26 authenticated
owner-page review remains the most recent verified gate snapshot. No
credential scope was expanded.

Read the actual Stripe Workbench lists. Live mode has the existing six-event
Identity destination and two two-event thin Connect destinations; the original
account's Test mode has the existing six-event Identity destination. Neither
list contains the standard connected-account snapshot destination. The
separate named Tuveloz sandbox has no destinations; it is not the original
Test mode and must not be mistaken for lost configuration.

Prepared, but did not submit, one live-account destination named
`Tuveloz provider payout safety`: Connected accounts scope, Snapshot payload,
API version `2026-06-24.dahlia`, endpoint
`https://tuveloz.com/api/stripe/webhooks/connected-accounts`, and exactly the
nine bank-account/payout events already listed in `DEPLOYMENT.md`. It needs
its own signing secret in `STRIPE_CONNECTED_ACCOUNT_WEBHOOK_SECRET`; neither
the Identity nor thin Connect secret can substitute. Existing code holds
payouts without a signed snapshot and rejects snapshots from the wrong
payment mode at the payout-safety check.

The owner confirmation request covers enabling this ongoing financial-data
feed, storing the dedicated secret in encrypted Cloudflare settings, and
synthetic testing with launch/payment locks retained. Confirmation remains
pending; no endpoint or credential was created, no production setting was
changed, and no payment was attempted. The unsubmitted review is retained
privately as `outputs/stripe-payout-connection-review-20260927.png`.

Validation: all three existing `stripe-webhook-hardening.test.mjs` checks
passed. These source-contract checks do not prove Stripe delivery or a
successful provider payout. Stripe's current Connect documentation confirms
separate event scopes and that live Connect destinations can also receive
test events: <https://docs.stripe.com/connect/webhooks>. Delivery, duplicate
handling and failure/recovery behavior still need a scoped synthetic test
after setup. No paid upgrade, publication or launch approval occurred.

## 2026-09-27 - Check Maryland agency records and send the approved broker inquiry

Reconciled the completed release before continuing: remote main remains
`f31f85c` and there are no open PRs. Extended the existing insurance section in
`business/launch-gate-briefing.md`; did not repeat the website release or open
another insurance application. Founder Shield's own terms name both The
Baldwin Group Specialty Solutions, LLC and Foundershield LLC. After resolving
the initial browser-panel interruption with the owner's instruction, the
official Maryland agency search showed Foundershield LLC license 2192404
Inactive, The Baldwin Group Specialty Solutions, LLC license 3002989862
Active, and Marsh USA LLC license 1280 Active. Public result snapshots are
saved as outputs/broker-{foundershield,baldwin,marsh}-mia-20260927.txt.

These are preliminary agency listings, not proof of Tuveloz coverage or the
assigned producer's authority. The older inactive name must not be confused
with the active Baldwin entity. Maryland warns its status data can lag and
links to SBS for current details; SBS terms were not accepted, and no SBS
search was submitted. Exact contracting entity/individual, authorized lines,
dates, orders, eligibility and pricing still need confirmation. No further
owner action is needed to close the initial browser panel.

Prepared the exact initial inquiry to Founder Shield's published
`info@foundershield.com` address. The owner specifically approved this body,
recipient and business sender. Sent from `hello@tuveloz.com` on September 27
at 12:31 a.m. Maryland time; Gmail's Sent folder and expanded headers confirm
the sender, recipient, subject and matching body. Screenshot evidence is
`outputs/broker-inquiry-sent-20260927.png`; recipient delivery/read/response
is not yet confirmed. Do not resend. The Gmail connector was linked to a
personal account, so no send was made through it; the verified Tuveloz Chrome
profile supplied the business mailbox.

The inquiry asks about prelaunch marketplace fit, exact agency/license and
fees, excludes private records, and authorizes no paid work, broker appointment
or coverage. No quote form or insurance application was submitted, no costs
incurred, and no application code or launch controls changed. Updated the
existing September 30 insurance review to await a reply. Documentation diff
checked; no code tests were needed for this record update.

## 2026-09-27 - Publish PR #245 and verify live Spanish account controls

The owner explicitly approved publishing the Spanish account fix. Confirmed
the clean checkout, passing required checks and unchanged head `a186d1d`, then
merged PR #245 as `f31f85c588b9745f6e2dc10cf18002185a53f9f8` at September 27
03:49:01 UTC (September 26 in Maryland). Every production job in workflow
`36292505581` passed, including browser account signup, 747 tests/build, all
form recovery suites, Spanish rendering/navigation, provider signup,
migrations and deployment. The release was built at 04:04:01 UTC on September
27. Public health at 04:07:04 UTC confirmed the exact merge commit and ready
application/database/schema. Accounts/applications remain open; customer
requests/payments remain closed.

Actual Chrome checks on tuveloz.com clicked the bottom Spanish homepage
customer button and opened the Spanish create-account form. Reload retained
Spanish; English/Spanish switching worked, and the entered synthetic email
was visually retained after switching before being cleared. Sign-in and
password-reset screens showed their Spanish controls. The form fits 390px and
320px widths without horizontal overflow; the 320px screenshot was saved and
visually reviewed. The bottom provider button opened the Spanish application
at step 1, with the form settled about 100px below the viewport top. Browser
error logs were empty. No account, verification email, provider application,
password change, legal consent or payment was submitted. Restored English,
reset the viewport and closed the verification tab.

Evidence: outputs/pr245-health-20260927.json,
outputs/pr245-live-release-20260927.json and
outputs/pr245-live-spanish-mobile-20260927.png in the task workspace. This
closes the Spanish account release item; it does not approve real-provider
credentials, insurance or customer launch. No paid upgrade was added.

## 2026-09-26 - Prepare complete Spanish account controls

Reproduced the customer-language gap with four failing fresh-entry checks
(customer/provider in Chromium and WebKit). Enabled translation in the existing
private `/account` interface, wrapped the rendered account controls and code
hint in the existing React translation boundary, and completed missing UI/API
messages. An explicit Spanish public URL now retains the visitor's preference
for the full navigation into account creation. Translation changes labels,
validation and status messages; submitted values and API routes are unchanged.
The public Spanish-route list is separate from account interface availability:
no `/es/account` route, sitemap addition or Worker cache change was introduced.
Existing legal releases, consent choices, launch/payment/SMS locks, and account
authentication rules remain unchanged.

All 60 account-form mobile scenarios passed across Chromium/WebKit and both
account roles. They cover existing English failure recovery plus Spanish
entry/reload, language switching, local validation, request throttling, code
verification errors, and preserved form values/consent/request payloads. A
320px screenshot exposed one untranslated consent conjunction; corrected it
and added a consent-label assertion. All 24 affected Spanish scenarios passed
again, and the screenshot was visually checked. The production build and all
745 tests pass; typecheck passes; lint has the one existing language-navigation
warning. An initial sandboxed suite run could not resolve esbuild dependencies;
the permitted filesystem-access rerun passed. Two old tests assuming account
translation was forbidden were updated while retaining public-route denial.

Extended the existing full-site navigation and Spanish rendering checks to
verify the customer CTA, hydration, reload, language switch and retained
preference across an English-only legal page. Those run in the required PR
workflow. This entry records prepared source work, not publication. The last
verified live release remains PR #244 at `40d9234`; do not call this account
translation live until a separately approved release is verified.

The first PR #245 Verify run (`36288242807`) caught a remaining early-click
race in the actual homepage path: clicking before hydration saved Spanish
opened an English account. Reproduced locally with homepage scripts withheld.
Spanish account links now include an explicit `lang=es` hint on the same
private path; changing language replaces only that hint, preserving role,
return destination, anchor, history state and entered form data. Both browser
engines pass all eight actual homepage navigation cases, including the
unhydrated Spanish page and reload after switching. All 24 affected account
language scenarios and 31 focused unit checks passed again. No production
change was made by the failed workflow. The corrected version passes the
production build, all 747 tests, typecheck and lint (one existing warning).

## 2026-09-26 - Publish PR #244 and verify the live release

The owner explicitly approved publication after automatic approval review
blocked the earlier attempt. PR #244 merged the exact tested head `5028f8d`
as `40d92341b05dc1cbf19ae1835a9a8bdc26d4a663`. All required jobs in production
workflow `36286456127` passed, including account creation/sign-in, the full
provider signup, bilingual browser/recovery checks, migrations, and deployment.
The build retains one pre-existing language-navigation lint warning.

Public health at September 27 02:01:41 UTC (September 26 in Maryland) confirms
that exact commit, built at 01:56:08 UTC, with application/database/schema ready.
Accounts and provider applications remain open; customer requests and payments
remain closed. Homepage, customer account creation, and both provider signup
URLs return 200. The updated official county destination returns 200 with
registration/towing content. No new paid service, applicant, email, payment,
credential or launch decision was created during publication verification.

Fresh Chrome checks at 390x844 clicked both bottom homepage signup buttons:
customer creation and the provider application open correctly. Neither form
had horizontal overflow; the provider language switch works both ways, and
captured browser error logs were empty. Restored English, reset the temporary
viewport and closed the verification tab.

Found a separate pre-existing gap: the Spanish homepage's customer signup
button opens the working English-only `/account` screen without a language
switch. `lib/spanish-routes.ts` excludes `/account`; a directly probed
`/es/account` returns 404, but that invented probe is not a link offered by the
site. Record the actual language-continuity problem, not a broken signup CTA.
The next website fix must cover account creation, sign-in, code/reset states,
validation and consent text without changing reviewed legal content. It was
not fixed or included in PR #244. The earlier provider-language checks do not
establish complete customer-account translation.

Private release evidence is in `outputs/pr244-live-release-20260926.json` and
`outputs/pr244-production-workflow-20260926.log` under the task workspace.
This release record is a local follow-up; do not deploy again solely to publish
documentation. Existing real-provider, insurance, incident fallback and launch
reviews remain outstanding; the owner's application stays last.

## 2026-09-26 - Correct moved county guidance and reconcile completed launch checks

Read-only continuation found the old OCP registration URL now redirects to the
general department homepage. Direct HTTP verification returned 200 for both,
but only the current repair/maintenance/towing page contains the registration
guidance. Updated the credential links, evidence-acceptance guidance, and legal
review source suggestions. Exact legacy references remain accepted as the
same source without rewriting stored evidence. Generic county homepages,
lookalike domains, modified URLs and incomplete reviews remain rejected.
No service classification, required document, evidence acceptance or launch
decision changed. The current county page still leaves service-specific
interpretations to the required confirmation; this is not a blanket legal
or provider-compliance approval.

Added three behavioral regression tests covering saved-reference compatibility,
unrelated-source rejection, and actual launch-gate validation. The production
build and all 743 tests pass; typecheck passes; lint has no errors and the one
pre-existing site-language warning. An initial test-local variable name violated
the Next.js lint rule and was renamed; the lint rerun passed. Reconciled stale
briefing, incident-plan and deadline text which still described the completed
hosted upload or Google Admin inspection as unfinished. Historical LOG entries
remain dated history. This source update is prepared for review and is not yet
deployed to staging or production; earlier deployed upload proof applies to
`7348f7d`, and production remains `2bdab8b` at the last verified check.

## 2026-09-26 - Complete hosted customer image upload and temporary-access cleanup

The owner specifically approved staging deployment, a one-hour owner-only code
email window, a synthetic image upload, and key cleanup. Staging workflow
`36283229583` passed at `7348f7d`; main and production stayed `2bdab8b`. Created
one sending-only Resend key restricted to updates.tuveloz.com and stored it only
in the private staging Worker. Added a temporary auth signing secret because
that Worker previously had none. No production credential was copied.

Preserved all earlier fixtures; validated the two new job/quote inserts against
in-memory migrated SQLite before adding them to staging. One email code reached
the business inbox and normal customer sign-in consumed it. The actual form
saved the clearly labeled test PNG and note at 01:00:13 UTC September 27
(September 26 evening locally). D1 confirmed one customer-condition record and
private R2 key; refresh retained the same record and the 600-by-260 image loaded.
The browser's read-only file-list inspection did not expose the selected file;
the completed upload, D1 key, and loaded image provide the actual result.
Do not resubmit based only on that inspection.

Earlier evidence and both incident hold decisions remained unchanged. No
payments, provider messages, notification outbox entries, Identity sessions or
credential reviews were created. The test provider remains unapproved with
alerts disabled. Direct signed-out image navigation returned a Chrome client
block, so it is not recorded as an application HTTP-denial assertion.

Cleanup verified: normal sign-out left zero account sessions and the evidence
workspace returned to sign-in; the temporary Resend key was revoked; temporary
Resend and auth Worker secrets removed; email flag false and expiry/from blank.
Normal sender stayed empty and both Stripe live-mode flags stayed false. The
original Resend key and owner Access remained. Private screenshots and JSON
proof stay outside git. Closed the hosted-upload checkpoint; retained the
synthetic records instead of destroying the audit evidence. No paid upgrade,
production deployment, real provider approval, or launch decision occurred.
Final production health read reports application/database/schema ready and
onboarding-only with customer jobs/payments closed.

## 2026-09-26 - Complete account regression and verify Workspace billing

The existing account browser regression passed on local commit `770008e` using
its own temporary worktree, synthetic credentials, local D1 and mail catcher.
Account creation/sign-in, throttling, Spanish routes and mobile widths, language
switching, saved drafts, and provider form/document guidance checks passed. No
message left the machine. This complements the 740-test/build, lint, and type
checks; it does not complete the hosted upload. Prepared a Resend key form with
Sending access restricted to updates.tuveloz.com, without submitting it, and
asked for the specific one-hour owner-only rehearsal and cleanup approval.

The existing Google Admin tab became accessible. Read-only inspection confirmed
Business Plus Active, Flexible Plan, one assigned license, $19.80/user/month
through the displayed November 5 discount period and $26.40 afterward. The
estimated monthly bill is $19.80 and next billing date October 1. Closed the
password-blocked billing inspection and added a November 1 cost-review
checkpoint. No billing, subscription, payment method, or plan changed. Updated
the private vendor-cost summary without retaining payment IDs or credentials.

## 2026-09-26 - Prepare restricted staging authentication for the remaining upload test

No open PR and main remains `2bdab8b`; preserved earlier handoff commits and
completed rehearsal fixtures. The outstanding hosted participant upload needs
an ordinary account session, but staging intentionally lacks email delivery.
Prepared a disabled-by-default authentication sender using a separate key,
the exact owner recipient, the canonical private staging origin, and an expiry
no more than 24 hours away. Normal Resend settings must remain empty in staging;
the separate key cannot turn on support/marketing/provider notification mail.
No session bypass, password change, production secret, provider approval, or
launch-setting change was introduced. The staging banner now describes the
possible temporary owner-code exception accurately.

Added executable tests for recipient denial, missing/expired configuration,
single-use code verification, unchanged production settings, and support-mail
isolation. All 740 tests and the production build pass; typecheck passes; lint
has no errors and one existing site-language navigation warning. The first full
run hit sandbox directory permissions in eight existing/new bundled tests;
the permitted unsandboxed local rerun passed. Updated the existing staging
runbook, email runbook, and September 28 checkpoint with activation and cleanup
steps. No credential has been created, no real email sent, and no deployment
or hosted participant upload has occurred. Scoped owner approval is needed to
activate the prepared rehearsal.

## 2026-09-26 - Prepare specific insurance inquiry options and clarify the TikTok draft

Preserved the local handoff commits, with no open PR and remote main still
`2bdab8b`. Added two official-source broker candidates to the existing launch
briefing and insurance review checkpoint: Founder Shield and Marsh Sharing
Economy. Both describe relevant marketplace work; eligibility, Maryland
licenses, fees, and service-specific coverage are unverified. Included the
published contact routes and the questions needed before a quote application.
No broker message, application, private-document upload, policy selection,
purchase, or launch approval occurred. Documentation only; checked the diff
without rerunning application tests or deploying the site.

The owner's TikTok question referred to a composer owned by the separate
"Plan realistic Tuveloz ads" task. Its latest saved September 26 10:02 a.m.
checkpoint records the three-image tire-pressure draft as unsubmitted, with
no new publication, schedule, campaign, or spend. The browser refused a claim
because that task already owns the tab; left it untouched and reported the
dated checkpoint rather than asserting a fresh live composer inspection.

## 2026-09-26 - Verify free vendor plans and isolate the remaining billing check

No open PRs and main still `2bdab8b`; preserved existing local handoff commits.
Cloudmersive's already authorized business login required an emailed security
verification. Completed that login through its vendor-domain link without
recording the token, and observed Free Tier. The subscription-management link
redirected to an upgrade offer, so no historical-charge conclusion is claimed.
Resend's Billing tab lists Transactional and Marketing at $0/month each, with
no payment method and no invoices. Free transactional limits display 3,000
monthly / 100 daily emails; paid overage controls are disabled. No API scan,
document upload, test send, purchase, payment retry, cancellation, or plan change.

Google Admin requires the owner's fresh password check before showing billing.
Asked for that specific step and left only its page ready for the owner. Mailbox
availability is already established; subscription details remain unverified.
Added the September 28 follow-up, corrected the vendor card's obsolete blanket
payment-method reminder, and reconciled the document register with the already
verified domain expiry and LLC annual-report checkpoint. No production code,
launch decision, test suite, or deployment changed. Private summary retained as
`outputs/vendor-cost-review-20260926.json`.

## 2026-09-26 - Close the old redirect check and verify search coverage

No open PRs; remote main remains `2bdab8b`. Preserved the existing local handoff
commits. Search Console's three redirect examples are expected HTTP/www homepage
variants, not QR links; public GETs confirm single 308 redirects to the HTTPS
apex. The public robots response disallows `/q/`. Closed only that overdue
checkpoint and corrected its old assumption that a report entry proves a failed
deployment. The homepage and both signup languages remain individually indexed
with successful Google fetches and matching canonicals. Sitemap status is
Success with 51 discovered pages. All 51 public URLs passed the scoped HTTP,
title, canonical, and noindex check at 23:49:14 UTC; this is not a repeated
interactive signup test.

The founding-provider page's stored Google record still reports an August 8
404, while current HTTP returns 200 and Google's September 26 live test passes.
Validation started September 5 remains pending; no request was restarted.
Updated the existing profile audit and October 2 follow-up. Saved the two
scoped evidence JSON files outside the repo. No site/account/Maps settings,
messages, costs, or launch controls changed; no application deployment or
full test suite was needed for this read-only review.

## 2026-09-26 - Inspect Resend settings and correct enforcement guidance

Preserved the completed checks and clean local handoff branch; no open PRs,
remote main still `2bdab8b`. Automatic approval review initially blocked the
Resend Google sign-in. The owner then explicitly approved that account/settings
inspection, and sign-in succeeded without an account change. The existing
Tuveloz domain has sending enabled and verified DKIM, SPF TXT, and sending MX.
No key-size or rotation option was exposed by its Records, Configuration, or
domain menus, or by the reviewed public domain-update documentation. No keys,
DNS records, TLS/tracking settings, subscription, or delivery configuration
changed; no message or support inquiry was sent.

Google's current sender guidance requires at least 1024-bit DKIM and recommends
2048 where supported. Recorded that the current website key is not itself a
delivery failure or a reason to buy a plan. Prepared an unsent provider question
about a supported migration, cost, overlap, and rollback. Rotation stays open.
Also corrected the future DMARC rollout instructions: RFC 9989 removed `pct`,
so fractional enforcement is not a reliable way to limit affected messages.
The owner sender-inventory answer and recurring reader remain pending; retain
`p=none`. These are maintenance-document corrections only. No application tests,
deployment, previous report parsing, or delivery tests were repeated.

## 2026-09-26 - Complete the approved eight-report authentication review

The owner's continuation approved the pending scoped attachment review. Used
Gmail's normal download buttons and the supported browser download event/path
API to retrieve exactly the eight selected files. The previously blocked Chrome
download-manager page was not used. Parsed seven ZIP reports and one GZIP report
locally with external XML resolution/DTDs disabled and bounded content size;
raw reports, hashes, and analysis remain outside the repository. No third-party
analysis upload, mail send, subscription, DNS change, or production deployment.

The eight reporter/report-ID pairs are unique: eleven rows describe fifteen
message observations, with three aligned passes and twelve failures. Nine
failures on August 27, August 31, and September 4 have Google's historical
unaligned default signature, consistent with the earlier configuration issue.
Two of those observations involve a different envelope domain and may reflect
forwarding/rewriting. The passing samples are two Tuveloz-signed Google messages
and one website/Resend message. Three newer rows (September 22, 23, and 24)
each show one unsigned message from a different unrecognized source with SPF
softfail. These are possible spoofing; neither fraud nor account compromise nor
inbox delivery is established. The sparse report set is not an overall delivery
rate. Its mixed September 4 UTC report cannot place a message before/after the
exact repair time.

Updated the existing runbook and closed only the eight-file review checkpoint.
Asked whether the owner uses any Tuveloz sender beyond business Gmail and the
website; confirmation, new-report review, and recurring monitoring ownership
remain pending. Added a September 28 checkpoint and kept p=none. Preserve the
previous DNS value for any later reviewed enforcement rollout, and do not add
unknown source IPs to SPF just to eliminate failures. No code tests/release were
rerun for this documentation-only update. Save this local handoff with the
existing unpublished doc commits for the next substantive authorized release.

## 2026-09-26 - Check sender configuration and locate aggregate reports

Continued from the completed incident-alert release and production follow-up;
neither was repeated. No open PRs were present and remote main remained
`2bdab8b`. Existing local handoff commits were preserved.

Public DNS and key inspection confirmed Google's 2048-bit Workspace key,
the website sender's existing 1024-bit Resend key and SES SPF, and monitoring-only
DMARC. Source inspection identified the shared Resend sending configuration and
confirmed staging remains intentionally unable to send. Closed the staging
email decision checkpoint by retaining that configuration. No key, DNS, account,
credential, launch, or payment setting changed; no email was sent or new service
purchased.

The business inbox has eight matching DMARC report messages in the prior-month
search: seven Google and one Microsoft. This establishes report receipt only.
Their aggregate contents were not parsed. One download was requested, but no
file was successfully located; Gmail's archive preview exposed a filename only.
Browser policy blocked Chrome's download manager and automatic approval review
blocked the alternate download-interface check. Asked for scoped owner permission
to download/read those eight attachments locally and stopped that work pending
the answer. No workaround or external analysis upload was used.

Updated the existing email-authentication runbook with current evidence,
configuration-based sender inventory, and explicit limits. Corrected old wording
that every sign-in needs an email code, that p=none means receivers cannot filter,
and that no support-message authentication header had been checked. The aggregate
review, recurring reader, provider-coordinated DKIM rotation, and later staged
DMARC enforcement remain open. Supporting summary is private local output
`email-authentication-review-20260926.json`; code tests/deployment were not
repeated for documentation-only changes.

Keep this handoff local with the preceding doc commits; do not trigger another
production release solely to publish status notes. Include it with the next
substantive authorized release.

## 2026-09-26 - Verify production mail queue and the post-release schedule

Read-only production D1 queries found zero incident reports and zero incident
alerts. There is no missed incident email to replay. All seven existing outbox
rows are recorded as sent, with one attempt each and no pending/failed rows:
four account-security messages, one owner support alert, and two other messages.
These database states record service acceptance, not universal inbox delivery.

Cloudflare shows the existing fifteen-minute trigger and a successful run at
22:45:27 UTC, after PR #243 deployed. Its preceding nine displayed runs were
also successful. The last-24-hour Worker error metric was zero. Logs and traces
are disabled; a successful cron invocation and aggregate error metric do not
prove every caught subtask succeeded. No monitoring setting was changed.

Re-read the existing automatic website support test in the business Inbox,
matching its subject and September 5 00:59:20 UTC outbox timestamp. Gmail's
original-message view confirms receipt at 00:59:21 UTC, the configured website
sender, business recipient, and SPF/DKIM/DMARC pass. This preserves the already
completed September 4 local-date proof in
`operations/2026-09-04-support-reliability.md`; it was not a new test or send.
The separate September 26 manual mailbox round trip also remains complete.

Incident-specific production inbox delivery remains unproven. Do not create a
fake live incident, reclassify a test record, or enable customer transactions
to clear that item. The current route and test-mail quarantine remain intact.
Sanitized observations are retained outside the repo in
`incident-alert-production-followup-20260926.json`. No code, production data,
credential, subscription, payment, deployment, or launch decision changed.
This documentation handoff stays local for the next authorized code release.

## 2026-09-26 - Verify published owner incident alerts and record responder availability

PR #243 merged as `2bdab8b940748f137b495c7c131f9044bf57b3b8` after both
required PR workflows passed (`36275390201` and `36275390430`). All three jobs
in the normal production workflow `36276226206` passed. Public verification
at 22:42:41 UTC confirmed that exact release, built at 22:40:23 UTC, with ready
application/database/schema, English and Spanish signup pages returning 200,
and signed-out job operations returning 401. Accounts and applications remain
open; customer requests and payments remain closed. Local validation includes
733 passing tests plus twelve Chromium/WebKit incident scenarios, lint,
typecheck, and the production build.
The test-only incident route, test-alert quarantine, and customer-launch and
payment locks remain unchanged. No real incident email was sent; production
incident-triggered inbox delivery remains unproven. The separately completed
manual mailbox round trip is not that proof.

Sanitized release evidence is retained outside the repo as
`incident-alert-release-20260926.json`,
`incident-alert-production-run-20260926.json`, and
`incident-alert-validation-20260926.json`.

The owner answered "anytime" to the question about checking hello@tuveloz.com.
The existing incident runbook now names the owner as primary responder with
that self-reported availability. No backup contact was supplied. The remaining
checkpoint is a practical fallback and process review, not another request
for the already-answered primary-responder question. No public promise of
24/7 staffing or a guaranteed response deadline was added.

Keep this factual handoff local until the next authorized code release rather
than redeploying solely to publish a release receipt. The earlier manual
mailbox proof, scanner results, backups, and staged incident evidence are
preserved; do not rerun them without a specific new verification need.

## 2026-09-26 - Prepare durable automatic owner incident alerts

Saved incident reports now queue a bilingual owner alert with a protected
review link and report reference. Recipients come only from owner configuration;
private narratives, locations, photos, and participant contacts stay out of
the email. No participant, insurer, or emergency-service message is automatic.
The existing test-only route remains locked to persisted test assignments.
Test/mixed/unknown-flag records and staging alerts are quarantined, with zero
delivery attempts. A deterministic primary key and event key preserve the first
classification and prevent duplicate queueing under concurrency or retries.

An interrupted enqueue leaves the saved incident/hold intact and returns a
truthful pending notice. The existing fifteen-minute Worker schedule recovers
missing alerts from open reports before flushing email. Closed historical
reports are not backfilled. Delivery uses the existing receipt requirement,
bounded retries, and exhaustion reporting. The report response and Spanish
dictionary distinguish saved, queued, and quarantined states.

All 733 tests and production build passed. Typecheck and lint passed (the
existing language-navigation warning remains). Twelve Chromium/WebKit incident
scenarios passed, including saved form clearing and retained success when an
alert is pending. New tests use actual migrated SQLite, notification code,
event policy, and intercepted transport; no real email was sent. The route
test also proves a missing owner address cannot erase a saved report and that
recovery queues its alert without resubmission. Two existing evidence checks
now locate their incident by ID rather than assuming it is first in the list.

Proof logs: `incident-alert-focused-20260926.log`,
`incident-alert-suite-20260926.log`, `incident-alert-browser-20260926.log`,
`incident-alert-lint-20260926.log`, and `incident-alert-typecheck-20260926.log`.
No migration, launch flag, live payment, provider approval, policy release,
paid service, or production change was made during local implementation.
The completed mailbox rehearsal and earlier local handoff commits are preserved.
Release review is next; automatic owner-alert inbox delivery is not yet proven.

## 2026-09-26 - Verify the manual support email round trip

After the owner restored business Google sign-in, sent one owner-authorized
TEST ONLY bilingual sample from the business mailbox to the established
owner-controlled test inbox. Independent receipt inspection confirmed the
expected sender, recipient, subject, and complete English/Spanish text. The
received message was in Inbox, not Spam, at 21:49:08 UTC; its authentication
headers reported SPF, DKIM, and DMARC pass. A same-thread test acknowledgement
was sent at 21:50:17 UTC, then opened and checked in the business Inbox.

Private message identifiers, headers, receipt details, and a screenshot stay
outside Git in `incident-mailbox-roundtrip-20260926.private.json` and the matching
PNG. Only the sample and its reply were sent. No customer, provider, insurer,
real incident, attachment, payment, or launch action was involved. Existing
drafts were preserved. This completes the manual mailbox test; it does not
implement automatic incident notifications, guarantee delivery to all mail
providers, or establish incident staffing or insurance coverage.

Updated the existing runbook, reconciliation, deadline row, and local checklist
to prevent repeating the completed test. Responder/coverage/fallback decisions
remain open. GitHub showed no open PRs and main remains the verified PR #242
release. This handoff changes documentation only; no deploy or full code-test
rerun is needed. Earlier local handoff commits were preserved.

## 2026-09-26 - Require an email-service receipt before recording a send

The incident-message delivery follow-up found that the shared email outbox
marked any HTTP-success response sent, even an empty or malformed body without
a message ID. The new real-SQLite regression reproduced that false success.
The sender now requires a nonempty string receipt ID. An uncertain response
leaves the record failed/retryable with no sent timestamp; the retry keeps the
same idempotency key. A later valid receipt records acceptance once. This is
service acceptance, not proof of delivery to an inbox.

All 726 tests and the production build passed, plus lint (one existing unrelated
warning) and typecheck. The focused checks cover six malformed-success response
shapes, recovery, unchanged keys, and no resend after confirmation, alongside
the existing test-mail quarantine and exhausted-delivery controls. No real mail
was sent by these tests and no database schema or launch lock changed.

The business Gmail session requires fresh Google password verification. The
sign-in tab was retained and the owner was asked to complete it. No new message
was sent; the actual mailbox round trip remains unverified. The existing
incident runbook now gives the exact bilingual test, receipt/reply checks,
private evidence requirements, and manual-response handoff. It does not imply
automatic incident alerts, insurer notice, staffing coverage, or a launch
approval. Existing completed releases and rehearsals were preserved.

PR #242 passed verification `36263773859` and PR build `36263773996`, then
merged as `39431aa1e1a599de9dad9157ee640fd0a9066700`. All three production jobs
in `36264460936` passed. Public verification at 19:16:20 UTC confirmed that
exact release, built 19:14:18 UTC, with application/database/schema ready,
both `/ai` and `/es/ai` returning 200, and signed-out notifications returning
401. Accounts/applications remain open; customer requests/payments remain
closed. The initial verification script mistakenly requested nonexistent
`/help`; corrected it to the actual linked routes, without changing the site.
Proof: `email-receipt-release-20260926.json`.

The next independent item now has a prepared, unsent broker inquiry in the
existing launch briefing. It separates platform/provider coverage and asks
for comparable full costs, exclusions, claims duties, and requirements now
versus before bookings. Maryland's official commercial-insurance FAQ and
licensing-search instructions were checked. No broker was contacted, private
application submitted, or coverage purchased. The owner still needs to choose
a broker and confirm the intended first services. The existing September 30
review checkpoint was clarified; September 28 tracks the pending mailbox
round trip and named incident responder. These are review checkpoints, not
launch promises. Both drafts and all earlier completed work are preserved.

## 2026-09-26 - Honor emergency-contact and safety-stop incident signals

The unfinished incident-process review found that checking emergency services
contacted on an otherwise low/moderate report left work running. An incident
typed `safety_stop` through the report API had the same gap unless severity or
another flag independently stopped it. The route now treats either as a stop
signal, keeping the automatic payment hold. Ordinary low-severity claims still
hold payment without claiming a work stoppage. Both form guidance and the
incident page describe the actual triggers.

The added actual-route/SQLite regression failed before the code change with
`workStopped:false` for an emergency-contact report, then passed. Six positive
customer/provider cases and three negative controls verify persisted stop time,
timer clearing, preserved tracked/billable time, correct audit, payment hold,
and isolation of another job. Synthetic signed-authorization fixtures satisfy
the existing database guards; no trigger was disabled. All 725 tests and build,
lint (one existing warning), and typecheck passed. Twelve Chromium/WebKit
scenarios passed, including the real report form sending its emergency checkbox
with low severity for each participant role. These are isolated local tests;
no real incident, message, insurance notice, or payment was created.

The existing runbook now includes a scoped check of official Maryland repair
authorization, county registration, insurer/agent lookup, and emergency guidance,
with links and limits. English/Spanish response drafts remain unsent and require
confirmed status and a realistic owner follow-up time. Removed unsupported
claims that every provider already has insurance, that every incident stops work,
or that incident details can never reach anyone beyond the chosen provider.
The owner reports no platform insurance; owner/insurer review, hosted participant
upload, and real notification delivery remain unfinished. No launch gate changed.
PR #241 passed verification `36260481075` and PR build `36260481377`, then
merged as `a0d3920ac9762d8adf00a5a0841c04bd2136372d`. All production jobs in
`36261358204` succeeded. Public health at 18:22:15 UTC confirmed that exact
release, built 18:20:29 UTC, with application/database/schema ready and customer
requests/payments closed. The updated incident page returned 200 and signed-out
incident API access returned 401. Proof: `incident-safety-release-20260926.json`.
No production incident was created to repeat the isolated regression test.

## 2026-09-26 - Correct account notices and recover from notification errors

Follow-up review found that welcome notifications still invited customers to
request work and providers to request appointments during onboarding-only mode.
They now link directly to the appropriate workspace with truthful account and
application wording. Existing welcome rows are corrected in place, preserving
their ID, date, and read state; no duplicate welcome or email is created. Other
accounts, roles, and event types stay untouched.

The notifications page now recovers from failed, malformed, or stalled reads
with a refresh button. A confirmed read-state update stays successful if the
follow-up list refresh fails. Rejected or unconfirmed updates do not claim
success. Opening a notice still navigates if read tracking fails, with a named
accessible link and best-effort keepalive request. Expired sessions return to
sign-in. The existing account page does not support an arbitrary return-path
parameter, so this change does not introduce or promise one.

All 723 tests and the production build passed locally, along with typecheck and
lint (one existing unrelated warning). Twenty mobile browser scenarios passed
in Chromium and WebKit, covering recovery, timeout, write receipts, both account
destinations, and sign-in redirect. The SQLite route fixture verifies welcome
history preservation, idempotence, account/role isolation, and invalid input.
It stubs session verification and mail delivery; no real account or email was
used. PR #240 passed verification `36256544587` and the pull-request build
`36256544804`, then merged as `61c4c071b7fc1a1ee28a27016fa2cde50c81a169`.
All three jobs in production release `36257408571` passed. At 17:15:29 UTC,
public health confirmed that exact release, built 17:13:54 UTC, with application,
database, and schema ready. The live notifications shell returned 200 with the
corrected wording; signed-out notification access returned 401/no-store.
Accounts/applications remain open; customer requests/payments remain closed.
Private account changes and error scenarios were tested in synthetic fixtures,
not against real customer records. Proof: `notification-release-20260926.json`;
mobile fixture screenshots: `notifications-20260926/`. Do not repeat completed
incident or account-notification repairs to satisfy the remaining business reviews.

The incident runbook no longer calls completed evidence linking missing. It
now states explicitly that the test-only incident route sends no notifications;
the full communication process and insurer review are still pending. This
account-notification repair does not complete those separate launch requirements.

## 2026-09-26 - Correct evidence timestamp display before publication

The hosted link/read screenshot exposed a four-hour display error: SQLite
CURRENT_TIMESTAMP is UTC without a timezone suffix, but both job-evidence and
job-operations pages parsed it as browser-local time. A shared, client-safe
parser now adds the UTC marker only to SQLite timestamp strings, leaving
explicit ISO timestamps and offsets intact. No stored record or authentication
timestamp parser changed. Both browser fixtures now use real SQLite-shaped
timestamps and a fixed America/New_York timezone; the incident test first failed
with noon instead of 8 AM, then passed with the correction.

The production build, all 716 tests, lint (one existing warning), typecheck,
and fourteen incident/upload browser scenarios passed locally after the fix.
Staging run `36253800061` passed at `f5e1556`; reloading the existing owner
page confirmed the correct 11:44:54 AM Maryland display with the link and hold
intact. No fixture was rewritten. The proof artifact records both deployments.

PR #238 merged as `d4ae855`, but production run `36253516796` was cancelled
before deployment while correcting this finding. PR #239 merged as
`36e93760215ae051a6da8282c0a2920eda1091c6`; required verification run
`36253795576` and all three jobs in production release `36254642943` succeeded.
Public health at 16:28:35 UTC matched that exact commit with application,
database, and schema ready. Both fixes are now published together. The English
and Spanish home/provider pages and both evidence/incident pages returned 200;
unauthenticated private-evidence access returned 401. Customer accounts and
provider applications stay open; customer requests and payments stay closed.
Proof: `incident-evidence-release-20260926.json`. Hosted owner linking already
passed; its record below remains valid and must not be recreated. A hosted
participant upload, insurer/source review, and launch decisions remain separate.

## 2026-09-26 - Link saved private job evidence to incidents

Added the missing incident control for linking existing job photos and notes.
The customer, assigned provider, or verified owner can append records only from
that same job and current party pair. Earlier references remain intact. The
server rechecks the current assignment and test flags when it atomically writes
the link and actor audit, rejecting races without partial writes. Duplicate
retries are idempotent; closed incidents and malformed legacy references are
blocked. The incident's hold, resolution, stop-work record, and insurer notice
are never changed. Authenticated image reads use private no-store responses.

The UI shows linked notes and a private photo-opening control. Rejected links
retain the selection. Browser inspection found the selector's accessible name
correct; the initial test used an incompatible exact label-text selector. The
test now uses the actual named combobox, and a duplicate empty option was removed.

The new test executes real account and signed-owner authentication, upload,
incident creation, linking, and image-read routes with migrated SQLite/in-memory
R2. It covers cross-account/job/assignment rejection, transaction rollback,
concurrent changes, lost acknowledgements, byte-for-byte images, and unchanged
holds. All 716 tests and production build passed, along with lint (one existing
warning), typecheck, and eight browser scenarios across Chromium and WebKit.

This is still a persisted-test-job/provider console. No provider approval,
customer launch, live payment, insurer notice, or paid service is enabled.
Private staging run `36252778621` succeeded at branch head `262bfae`. One labeled
synthetic PNG and one fixture evidence row were added to the existing test job.
At 15:45:31 UTC the actual owner UI linked it to open incident B and opened the
private R2 image. Independent D1 queries confirmed the appended reference and
one verified-owner audit, while B's hold and A's earlier resolution/timestamp/
hold stayed unchanged. Payments, notifications, outbox, and Identity sessions
remained zero; the provider remains new/not reviewed. A signed-out image request
redirected to Access. This is a hosted owner link/read check, not a participant
upload or real claim. The original fixtures were preserved. Local evidence:
`incident-evidence-staging-20260926.json` plus screenshots. Published together
with the timestamp correction in PR #239; exact live verification is recorded
above.

## 2026-09-26 - Saved job photos survive a failed follow-up read

The unfinished evidence rehearsal reproduced a real data-loss defect: after
`job_evidence_items` was inserted, a failed notification or list refresh entered
the same cleanup path as a failed insert and deleted the stored image. The route
now tracks the committed record and returns a saved receipt requiring refresh
instead of deleting its file or reporting that the upload failed. Pre-insert
failures still clean up orphan files. The page preserves its existing list,
clears only the successfully submitted form, and offers a read-only refresh
when the saved record cannot yet be displayed. A rejected upload retains the
photo and note; refreshing a saved record never submits it again. A lost database
acknowledgement is reconciled against the new record before cleanup; if the
database cannot answer, the private file is retained and the response states
that the save could not yet be confirmed. The existing provider-document flow
already handles this case and was left unchanged.

`tests/job-evidence-storage.test.mjs` first failed on the deleted-image
assertion, then passed with the fix. It executes real account authentication,
multipart validation, route code, and migrated SQL with local in-memory D1/R2
bindings. A synthetic PNG survives save/readback byte-for-byte; unrelated and
unauthenticated accounts cannot read it; invalid/oversized uploads, foreign
origins, and role spoofing cannot write. Real jobs remain locked despite a
caller-supplied test flag. No notifications or payments are created.

The actual page passed six browser scenarios across Chromium and WebKit, with
file bytes verified by a loopback HTTP server: normal save, a failed refresh
after save, and retry after a rejected upload. Added this check to pull-request
verification. The production build, all 708 tests, lint (one existing warning),
and application/Worker typecheck passed locally. These are isolated technical
tests, not a hosted customer/provider upload, insurer review, or launch approval.

Code inspection also confirmed a separate unfinished step: incident creation
still writes an empty `evidenceReferences` list and the incident console has no
attachment/link control. The existing private job-photo workspace is not proof
of linking evidence to an incident. Preserve that distinction in readiness
claims. Existing staging incident fixtures and production records were untouched.

Published as PR #237, merged `df23b2ea025748794c01e08c95092f8f56337484`.
Final PR verification `36249862087` and production run `36250759910` succeeded,
including the full verification workflow on the merged release. Public health
at 15:21:22 UTC matched that exact commit with application/database/schema ready.
Customer accounts and provider applications remain open; customer requests and
payments remain closed. No real participant upload was submitted. Staging was
not redeployed during this change and still needs a current release before a
future hosted attachment rehearsal. Local artifact: `job-evidence-release-20260926.json`.

## 2026-09-26 - Existing staging reused for actual owner incident decisions

Found that staging was already deployed and configured in August despite older
notes describing it as planned. Reused the existing private Worker, staging
D1/R2, Access policy, and GitHub environment. No new account, credential, paid
service, or security permission was needed. Staging run `36247963177` succeeded
at main commit `3eb287197f5d854d3dc1ab1c7036a0aa5c85fc65`, applying the current
migrations and passing its build/tests. Production was not redeployed.

Validated a synthetic fixture locally, confirmed empty staging fixture tables
and unused IDs, then inserted one test job, one unapproved test provider, one
synthetic quote, and two clearly labeled test incidents in one transaction.
The provider stays new/not reviewed with alerts disabled; no person, insurer,
identity proof, service approval, or real payment is represented. The reports
and initial stop time were seeded, so this hosted check is not a report-creation
or evidence-upload test.

Through the real signed owner session on staging, resolved incident A while
retaining its hold, checked the required release confirmation, then released
only A's hold. The UI and an independent D1 query confirmed that B stayed open
and held, A's original resolution/timestamp stayed intact, and both lifecycle
events recorded the verified owner. No payment, notification, email-outbox, or
Identity-session records were added. The test provider was not approved.
Retain `rehearsal-owner-job-20260926` and incidents `rehearsal-a-20260926` and
`rehearsal-b-20260926` as synthetic staging evidence; do not recreate them.

Unauthenticated staging access still redirects to Cloudflare Access. Production
health at 14:26:26 UTC remained on the previous exact commit, all health checks
ready, customer requests/payments closed. Updated the existing staging and
incident runbooks and readiness packet. Owner/insurer review, real evidence
attachment, notification delivery, and any actual payout remain outside this
technical result; no launch decision changed.

## 2026-09-26 - Deployed owner access verified without changing review decisions

PR #236 merged as `3eb287197f5d854d3dc1ab1c7036a0aa5c85fc65` and
production run `36246209425` completed successfully. Public health at
14:00:26 UTC matched that commit with application, database, and schema ready.
The 700 tests and required browser/release checks passed. The final comparison
preserved signup, scanner, backup, policy, migration, and launch-lock code.

Used the existing Tuveloz business-browser Cloudflare sign-in to open the live
owner dashboard. The integrated review at 14:06 UTC explicitly reported that
this request passed signed-token verification; owner data and review tables
loaded. The compliance-operations workspace also loaded. A read-only lookup
from the job-operations console with an explicitly nonexistent synthetic ID
reached "Accepted job assignment not found" instead of the unauthenticated
sign-in error. This verifies the live owner-session access path, not an incident
write, resolution, or payout. No persisted production test job was available,
and none was created. A separate direct navigation to the diagnostic JSON route
was blocked by the browser client and is not counted as a passing check.

All eighteen evidence review controls remain Pending: seventeen required and
one optional lane. The scanner's existing operational proof passes; live
provider Identity evidence, named reviewer decisions, launch-update postal
address, exact-service activation, and customer/payment release remain separate
unfinished items. No review decision, approval, provider record, mailing
configuration, live payment, or launch setting changed. Do not repeat completed
owner-access setup or treat this read-only pass as the full incident rehearsal.

## 2026-09-26 - Owner incident simulation found and repaired two workflow defects

Added local behavioral coverage that executes the real owner-token verifier,
incident route, SQL, and audit writes with temporary in-memory RSA keys, a
synthetic public-key response, and an isolated migrated database. External
requests are intercepted; no Cloudflare credential, identity document, insurer,
or live payment is used. Invalid owner tokens and forged headers are rejected.
Valid header/cookie simulations exercise resolution, retained holds, explicit
release, reserve release, job isolation, recorded notice requirements, and
duplicate-action rejection.

The tests reproduced a missing audit identity: a valid token without the separate
email header recorded `verified-owner` instead of the signed token's email.
The operations route now uses the verifier's canonical email directly. Access
requirements were not relaxed.

The review also found a dead end: resolving an incident with its hold retained
removed the only release control. Added an owner-only `release-incident-hold`
action for resolved, still-held incidents, with a reason and affirmative
confirmation. It requires any insurer-notice record, checks the incident's job,
guards the update against changed state, preserves the original resolution,
and audits the verified owner/reason. It clears no other hold and creates no
transfer. The whole operations route remains limited to persisted test records.

The owner console control passed local Chromium and WebKit checks, including
required confirmation, retained drafts after denial, successful removal, and
absence from customer controls. Added that check to release verification. The
existing internal console remains English-only; no public language behavior was
changed. The claims plan distinguishes these simulations from deployed Access,
real evidence/notification handling, and insurer or legal approval. Consult the
pull request and exact release result before calling this change deployed.

## 2026-09-26 - Domain contact inspected and incident hold simulation passed

Read the Tuveloz-specific Porkbun contact editor without submitting changes.
Address and email fields are populated but differ from the verified business
mailbox/Stripe support record; company/unit fields are empty. A separate owner
contact can be valid. Confirmation of its accuracy and reachability remains an
owner fact, not a technical error or evidence of public exposure. Closed the
form without saving; no exact address, private email, or contact values were
retained. Updated the existing contact record and deadline rather than asking
for the completed renewal/privacy inspection again.

The existing `test:e2e:incident` simulation initially hit its 30-second command
timeout while applying the fresh local database migrations. Raised only that
setup timeout to 180 seconds and reran successfully against application commit
`312b63b`. Real routes and local D1 confirmed automatic incident payment holds,
stop-work recording, refusal of both customer/provider resolution and release,
and unchanged hold state after those attempts. All accounts and jobs were
synthetic local fixtures; email used the local catcher. Owner-authenticated
release, real evidence attachment, insurer handling, and a real payout remain
outside this result. The claims plan now records these limits and requires
private incident evidence custody instead of copying case details into Git.

Corrected a remaining stale paragraph in the launch briefing that still called
the scanner's first file test missing, despite its completed September 6 proof
and September 26 recheck. Updated the active scanner, public formation check,
private incident-contact requirements, and latest confirmed release reference.
PR #235's release `36236454444` passed; health at 10:55:08 UTC confirmed
`312b63bb43211ae6d88b0adaae6020dc76be90d5`, with application/database/schema ready
and customer requests/payments closed. No account, billing, domain setting,
production data, or launch decision changed in this follow-up.

## 2026-09-26 - Dependency advisories patched and incident guidance corrected

An npm audit found seven affected package entries: one critical and six high,
including transitive entries caused by shared image dependencies. Updated Next.js
and eslint-config-next to 16.3.6, image-size to 2.0.4, and the existing sharp
override to 0.35.4. A shared image-size override also patches vinext's otherwise
pinned 2.0.2 dependency. The vinext, Cloudflare plugin, and Wrangler versions
were retained. The unused-format image parser restrictions remain enabled.

The patched lockfile reports zero known vulnerabilities across both application
and development dependencies. Added `npm run security:check` to the reusable
verification workflow; high/critical findings or an unsuccessful audit now stop
that verification before release. The Next.js Windows-server advisory does not
describe Tuveloz's Cloudflare hosting; an audit finding is not evidence of a
compromise. Upstream details:
[Next.js Windows advisory](https://github.com/vercel/next.js/security/advisories/GHSA-p293-qw3h-jr36),
[Next.js image advisory](https://github.com/vercel/next.js/security/advisories/GHSA-2xp9-vwfh-vxw4),
[sharp advisory](https://github.com/lovell/sharp/security/advisories/GHSA-rgj7-g3m4-5g8c),
and [image-size parser advisory](https://github.com/advisories/GHSA-5p2g-fcmc-qvqq).

Local build and all 693 tests passed, as did TypeScript/Worker checking. Lint
passed with one new non-blocking framework warning about the existing full-page
Spanish-to-English navigation; its behavior was preserved. The first restricted
test attempt failed on esbuild filesystem access; rerunning with normal checkout
access passed. CI browser verification and deployment must be checked against
this change's pull request and release; local results alone do not prove release.

Corrected the draft security incident plan to include the active owner-PC
scanner, private backups/recovery copies, Stripe-held Identity documents, and
private contact/evidence custody. It no longer claims that a password throttle
revokes existing sessions or disables other sign-in methods. Exposed credentials
should be contained promptly while recording identifiers and context, not kept
active until evidence collection is complete. Linked the existing vehicle
incident plan. These technical corrections do not approve any launch-review gate
or substitute for owner/security/insurer sign-off. No production account,
credential, customer-payment switch, or private record was modified.

## 2026-09-26 - Signed-in domain renewal review and release confirmed

After the owner completed Porkbun sign-in, reviewed tuveloz.com's own renewal
and WHOIS controls. Auto-renew is on, Use Privacy Service is selected, and the
registrar shows expiry July 22, 2027. Account billing reports a saved payment
method using Link via Stripe. No card expiry is displayed in that summary and
no charge was attempted, so this does not guarantee a future renewal payment.
The June 22, 2027 renewal checkpoint remains. Private registrant-contact address
accuracy remains unreviewed. No purchase, subscription, DNS, privacy, or billing
setting was changed; no private addresses, card identifiers, or unrelated domain
names are retained in this record.

PR #234's release `36233899430` completed successfully, including verification,
browser account signup, migration, and deployment. At 10:08:37 UTC public health
confirmed exact commit `921bccd54eded70aaffeaced1815595eee457e52`, built at
10:01:36 UTC, with application, database, and schema ready. Customer accounts and
provider applications remain open; customer requests and payments remain closed.

## 2026-09-26 - Existing scanner proof reconciled and company standing refreshed

Corrected an operational handoff error: an empty September 25 scan queue was
incorrectly described as a missing first complete file test. Retained September 6
evidence already proved a clean manual production scan and an independently
scheduled Windows-task scan. September 26 a read-only production D1 query
confirmed the synthetic fixture's four request/result rows, two receipts, and
two authenticated audit records. No new fixture or production write was needed.

At 09:38:34 UTC those live rows exactly matched the recovered production snapshot.
The current application `runtimeLaunchReadiness()` accepted their retained proof
with read-only SQLite, placeholder configuration, no live credentials, and all
outbound calls blocked. The latest accepted scan remains September 6 at 15:49:24
UTC; this is a proof recheck, not a new scan. Evidence remains pending and the
synthetic provider is unapproved. The October 4 checkpoint precedes the existing
30-day proof limit on October 6. The owner-PC task's 09:29 UTC run and latest
signature refresh succeeded, with an empty queue and no retry/unavailable errors.

Updated all current scanner handoffs, the activation runbook, vendor card, launch
briefing, and deadlines so completed tests are not requested again. Genuine
provider Identity, document authenticity, security review, and other launch
decisions remain separate; no launch gate or customer payment lock was changed.

PR #233's release `36232450529` completed successfully. Public health confirms
`4e4184f`, built at 09:33:54 UTC, with application/database/schema ready and
customer requests/payments closed.

The official Maryland Business Express lookup now confirms TUVELOZ LLC,
W27472109, domestic LLC, formed July 24, 2026, Active and in Good Standing.
Filled the previously blank formation record with public facts only. Ownership
authority and private originals are not inferred from registration. The first
annual-report deadline is tracked for April 15, 2027 under Maryland's published
next-year rule. Chapter 247's October 1 effective date was rechecked and the
principal-office review checkpoint recorded; no filing, fee, or address change
was submitted. Exact addresses and resident-agent details are not retained here.
Porkbun's remaining private renewal/contact review reached its sign-in page;
owner sign-in was requested. No registrar setting, renewal, or plan changed.

## 2026-09-26 - Automatic backup, file recovery, and Stripe support address verified

The first scheduled backup `scheduled-backup-1790413652000` completed all
seven Cloudflare Workflow steps at 09:07:38 UTC: D1 export, both object copies,
manifest, and retention processing (zero deletions). Daily 09:07 UTC operation
is now observed, not merely configured. No paid upgrade was added.

The owner enabled Chrome's required file permission. Both expected files now
exist at their exact keys in the separate private R2 recovery bucket. Their
downloaded SHA-256s, sizes, content types, and empty custom metadata match the
backup. The cloud database checks below already passed. One extra unreferenced
605-byte synthetic fixture remains only in the recovery bucket, with cleanup
tracked separately; production and backup objects were not changed.

At 08:54:53 UTC actual application health and document routes passed local
recovered-data checks: schema ready, both files readable through the storage
adapter, anonymous document access denied with 401, and zero outbound calls.
Recovered SQLite was read-only with no live credentials. This proves local
application recovery behavior, not a hosted application cutover.

PR #232 merged as `273e1aa`; release `36231162715` passed all required checks
and finished at 09:07:36 UTC. Public health at 09:13:13 UTC confirmed that
exact commit with application/database/schema ready. Customer accounts and
provider applications remain open; requests and payments remain closed.

Reconciled earlier address work instead of reopening it: September 12 mailbox
activation and Google Payments update, and September 25 public-profile
corrections retain their dated evidence. The owner signed into Stripe and
Anytime Mailbox. Direct private comparison found a Stripe support-address
mismatch. After specific owner approval, saved only the customer-facing
support address with the verified mailbox and unit. Every address component
was present in the saved result; private business and owner address fields
were unchanged. No exact address or private account screenshot is retained
here. Remaining registrar and legal/tax/bank records are listed separately in
the new indexed business-address review.

Official registry RDAP confirms Porkbun as registrar and July 22, 2027 expiry.
The June 22, 2027 renewal checkpoint is recorded. Private registrar auto-renew,
contact, and billing settings have not been inspected. The current handoff and
checklist now distinguish these remaining checks from the completed backups,
recovery, support correction, and published website work.

## 2026-09-26 - Isolated Cloudflare database recovery verified

PR #231's application release `36227791081` and PR verification `36227430360`
both succeeded. Public health at 08:01 UTC reported `0b61ccd`, built at 08:00
UTC, with application/database/schema ready, onboarding open, and customer
requests/payments closed. This supersedes the earlier pending-release note.

The approved recovery rehearsal created a separate unbound D1 database named
`tuveloz-recovery-20260926` and a private Standard R2 bucket with the same name.
Cloudflare D1 Studio's default Run executes only the current statement; a full
import requires Run all in transaction. The offline helper
`scripts/prepare-d1-restore.py` also puts every table definition before data,
verifies schema/records/automatic IDs against the original dump in SQLite with
foreign keys enforced, and refuses to place backup data in a Git checkout.
Its two regression tests pass, and CI now runs them.

The actual isolated cloud import completed: 78 tables, 355 records, and 383
schema objects, with every table count matching the backup. D1 quick check
returned `ok`; foreign-key check returned no rows. No live database or
application binding was changed. The original dump, prepared SQL, and local
recovery copies remain private and outside source control.

R2 cloud restore is still incomplete: the bucket is empty with public access
disabled. The ChatGPT Chrome extension requires Allow access to file URLs to
upload the existing 605-byte fixture. The owner authorized enabling it, but
browser security policy blocks access to chrome://extension settings; the
owner must change this switch directly. Do not route around that restriction
or call the file restore complete. The empty folder marker, exact object paths,
hashes/metadata, and isolated application checks still need verification.
The first automatic backup is due at 09:07 UTC and has not yet been observed.
No plan, billing, launch, credential scope, or live integration was changed.

## 2026-09-26 - Free nightly backup schedule activated

PR #231 merged as `0b61ccd`. The reviewed backup tests, lint, TypeScript check,
and both deployment configuration dry runs passed. Manual activation run
`36227836343` succeeded at 07:47 UTC and deployed backup Worker version
`5a4621b4-9aa3-4f2d-b470-2ee9ddb5f8ae`. Cloudflare's settings screen confirms
the daily Cron Trigger and its next firing at September 26, 09:07 UTC. No paid
plan, billing change, public route, or launch switch was added. This confirms
the installed schedule; it does not yet prove the first automatic firing.

The real manual backup and separate local recovery are already proved below:
78 database tables, integrity OK, zero foreign-key violations, and both stored
objects restored with matching hashes. A full Cloudflare D1/R2 restore remains
a separate open item. All four original downloads were moved out of Downloads
into the private recovery folder outside the source repository.

At 07:49 UTC, the public website still reports application/database/schema ready
on `093822e`, with onboarding open and customer requests/payments closed. The
independent application release run `36227791081` is still running its gated
checks; do not describe that application release as deployed yet. The backup
deployment above is separate and complete. Credential renewal is tracked for
October 18, before the October 25 expiration.

## 2026-09-26 - First real backup and local recovery passed

The owner explicitly approved expanding the existing Tuveloz backup token to
D1 Edit. The saved scope remains the Tuveloz account through October 25. The
existing encrypted Worker secret worked without generating or exposing a key.
Instance `owner-approved-recovery-20260926-edit` completed all seven steps at
07:26:06 UTC. The 251,632-byte database export restored into separate local
SQLite with integrity OK and zero foreign-key violations. Both stored objects
(one empty folder marker and one 605-byte scanner fixture) matched their
manifest sizes and SHA-256 values after recovery. Downloads and the restored
database remain outside all source checkouts; no private records are in this
log. No production data, integration, or launch setting was changed.

Activation run `36227181038` rejected native Workflow schedules because that
feature requires Workers Paid. No upgrade was purchased. The replacement uses
a standard Worker Cron Trigger at the same 09:07 UTC time to create the same
durable backup through its binding. A stable per-firing instance ID prevents
duplicate exports from retried deliveries, and launch failures propagate to
scheduled invocation status. Bootstrap removes all Worker Cron triggers.
Publication, activation, and observation of the first automatic run remain to
be verified; actual Cloudflare D1/R2 recovery is separate from the passed local
rehearsal. The application release `093822e` succeeded and public health was
ready at 07:24 UTC with customer requests/payments still closed.

## 2026-09-26 - Approved private backup setup (earlier state)

The owner approved publication, a D1 Read credential scoped to the Tuveloz
account through October 25, 35-day private backup retention, and an isolated
recovery rehearsal including the first export's brief signup interruption risk.
Created that token and the Standard-storage `tuveloz-backups` bucket; the
dashboard confirms public access is disabled. No plan or billing setting changed.
PR #229 contains the retention fix. The local OAuth login cannot operate
Workflows, so a main-only manual deployment workflow uses the existing release
credential in GitHub's production environment. Bootstrap removes schedules;
activation requires the separately installed D1 secret. Public Worker and preview
URLs are disabled. No credential value is stored in source or CI.

PR #229 merged as `a016c1c`. Initial bootstrap run `36223470918` stopped
before upload because Wrangler rejects an empty Workflow schedules array.
Bootstrap now omits that optional field entirely and validates the generated
configuration with a dry run before deployment. No export or scheduled run
occurred during that failed setup attempt.

PR #230 merged as `093822e`; bootstrap run `36223729484` successfully
deployed the private Worker/Workflow (initial version `f10eaf06`) without a
schedule. The approved D1 Read key was saved as the encrypted
`D1_BACKUP_API_TOKEN` Worker secret. The token display page was closed and no
credential value was written to source, shell commands, logs, or CI.

The first approved instance `owner-approved-recovery-20260926` at 06:31 UTC
failed at export initiation with HTTP 401 Authentication error. It was
terminated after two retries, before any database export, object copy, or
manifest. The nightly schedule remains off. The token editor confirms D1 Read,
the Tuveloz account only, September 25 start, October 25 expiry, and no IP
filter. A separate approval request is pending before trying D1 Edit, which
would allow account-level database writes/deletion as well as reads. No
permission expansion was applied. Do not claim that the error proves Edit will
resolve it; a successful export still needs verification.

The main application release from PR #229 passed all release gates and is live:
`a016c1c16f398643a19adacb19ec973cb4bade59`. At 06:36 UTC, public health reports
application/database/schema ready with onboarding-only launch boundaries.
The follow-up `093822e` application release is still running its independent
verification; its separate backup bootstrap has already succeeded.
First backup, scheduling, and isolated recovery are unfinished. The owner's
application remains last. No paid upgrade or launch switch was applied.

## 2026-09-25 - Public-profile completion and backup activation review

Reconciled the handoff with owner-approved browser work: Facebook's public
street address and map link were removed while all ten service areas and the
provider signup link remained; the two misleading August TikTok videos are
Only me, and the accurate September video remains public. Search Console
accepted recrawl requests for the homepage and both signup languages. The
Google Maps Not open to the public correction is submitted and still pending
review. See the existing dated public-profile audit for the evidence limits.

GitHub reports PR #228's release `8ae3dd1` deployed successfully and the latest
three reviewed health-monitor runs passed; no PRs were open. Published backup
source is not an activated backup. The signed-in Cloudflare dashboard shows
production D1 at 2.02 MB with seven days of Time Travel, total R2 storage at
51.64 MB with $0 current billable usage, and no backup bucket. The existing CLI
reports no deployed Workflows and lacks D1/R2 permissions. No export, restore,
credential, paid upgrade, bucket, or deployment was created in this review.

Before activation, a new regression reproduced cleanup failure with 1,005
obsolete file versions because R2 accepts only 1,000 keys per delete call.
`enforceBackupRetention` now batches those calls and preserves referenced files.
Validation: the regression failed before the fix and passed afterward; all
seven backup tests, lint, the production build, and all 691 repository tests
passed. The backup Worker also passed a local deployment dry run. These checks
do not prove a production backup or isolated restore. The fix and these notes
remain local pending publication; the live customer-launch locks are unchanged.

Next: obtain approval for the precise backup credential scope/lifetime and
activation, publish the reviewed fix, then prove a stored backup and an isolated
restore. The owner's truthful provider application remains last. Credential,
insurance, legal, and provider-evidence review gaps cannot be cleared by tests.

## 2026-09-08 - Provider sign-in redirect preloading

The live follow-up to the review-form release found two unhandled WebKit
prefetch errors while `/provider-onboarding` redirected a signed-out visitor
to `/account?role=provider`. The email sign-in form still opened. The errors
reproduced with and without test request interception; this was not a blocked
form submission or a failed identity check.

The two onboarding header links now disable automatic prefetching so their
background requests do not race with the session check and redirect. Link
destinations and access rules are unchanged. A browser regression against the
actual built Worker preserves its real 401 response, delays that local response
briefly to expose the race, and checks the visible provider sign-in form,
premature route requests, page errors and mobile layout. The old build failed;
the fixed build passed in Chromium and WebKit. CI runs this check before release.
Local build, lint, typecheck and 626 unit checks also passed. No production
provider record was created or changed during this verification.

## 2026-09-08 - Provider review receipts and a clearer next step

The actual browser appeal form reproduced a false failure after a successful
save: React cleared `event.currentTarget` while the request was awaiting its
response, so resetting the form threw. Appeals, privacy requests and agreement
acceptance now retain the form reference, require an explicit successful API
receipt, and preserve entered text when a response is rejected or unconfirmed.
Confirmed appeals and privacy requests remain successful even when the follow-up
status refresh fails. Their receipt stays in the parent page when the original
form is removed by the updated checklist.

The page starts with the next step, places the selected-service document
checklist directly after identity verification, and omits empty expiration and
appeal panels. Application-review details remain available in an expandable
section. Clearer copy distinguishes document review from ID verification and
explains how to resume an unsuccessful Stripe check. Appeal/privacy forms and
submission receipts use the saved applicant language. The surrounding private
page and agreement presentation remain English-only; this is not a fully
translated onboarding page. Reviewed
consents, evidence requirements, issuer-verification controls and launch locks
remain unchanged.

Browser regression coverage uses the real React page, delayed local API fixtures,
Chromium and WebKit, and English/Spanish applicant preferences. It checks 44 combinations of
successful submissions, rejected/unconfirmed responses and refresh failures,
including retained drafts, one request, confirmation visibility and mobile
overflow. The test is part of required CI. No real provider document, approval,
message, identity check or payment is created by these browser tests. Deployment
is tracked separately through the pull request and production release workflow.

## 2026-09-05 - Provider welcome and consistent public identity

The provider page now explains the application to applicants instead of
reusing customer hiring advice. Cleaning-water and used-battery plans have
plain-language checklist names with the official names retained. The tax setup
note is shorter; required documents, acceptance text and approval rules remain
unchanged.

Google-facing metadata now names Tuveloz's vehicle-service market and location,
declares the WebSite name and connects the Organization to the same four social
profiles used by the footer. Existing master logos, favicons and preview artwork
remain the source of truth. Updated English/Spanish copy and the profile-copy
guide preserve the distinction between free applications and unavailable
customer bookings. Public listing eligibility and Google processing remain
separate from a successful website deployment.

## 2026-09-05 - Provider signup clarity and mobile step navigation

Provider signup now starts with everyday service choices, followed by the
checklist for those choices and the applicant's details. Removed internal tier
badges, shortened the surrounding copy in English and Spanish, and moved county
registration guidance into an expandable detail beside the applicable question.
The reviewed acceptance text, required identity/consent fields, tax information,
policy matrix, approval engine, and launch/payment/SMS controls are unchanged.

The checklist now groups each document by the exact services requiring it.
The actual policy resolver and original grouping function reproduced six rows
for battery plus A/C work; the revised helper produces four unique rows without
losing county registration, the owner-operator attestation, battery handling,
or the Section 609 certificate. Tests execute the real policy and service-tier
modules, including relationship requirements above the raw matrix arrays.
Neutral bullets replace checkmarks on documents that have not been verified.

Manual phone checks found two additional problems: photo-only work could show
an empty legal-question section because background review flags were counted as
visible questions, and moving to a shorter step could leave the viewport below
the form. The section now appears only for the six questions actually rendered;
each step change moves keyboard focus and scrolls below the fixed navigation.
An incomplete application still fails required-field validation, and applicants
with paperwork marked "Not yet" can continue while approval remains pending.

Local validation passed: 581 tests with zero skips, lint, typecheck, and the
production build. Browser checks covered English and Spanish, 390px phone and
929px tablet widths, mixed and photo-only selections, saved progress, back/next
navigation, and required-field validation. A fresh load had no browser errors.
The existing isolated browser CI now checks focused step navigation and both
checklists as well. No real application, identity check, or payment was created.
The product note records current Taskrabbit and Wrench reference points without
claiming measured conversion gains or competitor superiority.

## 2026-09-05 - Remote setup progress and current launch evidence

The owner is away from the home computer; continue available work without
requiring desktop sign-ins. Cloudmersive still shows Free Tier after the earlier
declined Basic purchase. Its API key already existed. The missing random
64-character callback secret was generated in memory and stored as an encrypted
Worker secret, without printing or saving its value. The active deployment
contains both secret names; all other bindings and the deployed application
release were unchanged, and application/database/schema health passed. Scanner
processing remains `unconfigured`; no vendor scan or further purchase occurred.

The owner dashboard was refreshed: all eighteen launch review controls remain
Pending, with no active exact services or current provider-bound Identity canary.
The review packet now distinguishes completed integration setup from missing
operational results, identifies the actual reviewer evidence, and directs a
genuine applicant through their own Identity check. The two incident plans
already exist and need their remaining contacts and review evidence. Corrected
the contribution card's unsupported inference that Git author names establish
ownership or absence of outside contributions.

Google Admin still requires the owner's password check. Business Gmail remains
accessible and still warns of a September 7 service-continuity deadline; the
existing dated follow-up was refreshed. A limited search did not locate company
formation or insurance correspondence, which does not prove those records do
not exist elsewhere. No messages were sent or reviewer decisions invented.

Zeo's current BrainGateway chat check returned `route_not_ready`, with both the
general checkpoint and attested runtime unavailable. Its connection remains
blocked; Tuveloz's existing policy answers and consented owner support remain
the available path. No legacy model was relabeled as Zeo, no Zeo source was
changed, and no new Claude review is claimed. Website copy, application logic,
legal-policy hashes, marketplace, payment, SMS, and provider-activation guards
were not changed by this documentation update.

## 2026-09-05 - Provider application adapts to the available column width

A visual check at a 929px browser width found the provider form squeezed into a
278px column, leaving a service-category label only about 23px wide. The provider
panel now fits columns to the space available, keeping each at least 420px wide
when room permits and stacking the form below the introduction otherwise. The
existing phone layout stays in place. This changes layout only; application
state, requirements, actions, wording and launch guards are unchanged.

At the same 929px width, local Chrome now shows a 671px form with a readable
283px category-label area, no horizontal overflow and no browser warnings or
errors. The application anchor also opens the form correctly. Required CI and
live verification remain prerequisites for publication.

## 2026-09-05 - Full TypeScript checking and executable guarded-query regressions

The required verification workflow now generates Cloudflare runtime and binding
types from the installed Wrangler configuration, then checks the entire project
with strict TypeScript. The generated declaration file is ignored by Git and
ESLint and is regenerated by `npm run typecheck`; no source files are excluded
from the compiler. Corrected annotations cover awaited agreements, privacy
preferences, internal JSON responses, reminder days, immutable evidence lists,
nullable payment identifiers and the browser language helper's DOM methods.

This exposed two real SQL defects in the guarded test-job workflow. The checkout
invalidation audit and change-order acceptance queries treated literal text as
SQL, including an empty expression. They now bind those strings as parameters.
Computed insert-select fields also have explicit aliases in those queries, the
scope-version query and the scanner-result query. Conditional writes keep their
existing prerequisite and transactional boundaries. Missing payment identifiers
cannot satisfy the final checkout update.

Four regressions extract the actual production query expressions, generate SQL
through Drizzle and execute it against isolated in-memory SQLite. They verify
stored values, authorization/version/file bindings and zero writes after a
prerequisite changes. The audit and acceptance checks failed on the prior source
with SQL syntax errors and pass on this repair. These checks exercise query
behavior, not complete authenticated request handlers.

The production build and all 574 tests passed locally with zero skips, and the
full TypeScript check passes. The previous log entry's TypeScript limitation is
resolved in this candidate. Required CI, deployment and live verification must
still pass before treating this entry as release evidence. Customer jobs, live
payments, SMS, provider activation and document quarantine remain locked.

## 2026-09-05 - Spanish pages render consistently before and after browser initialization

Spanish body text previously changed after React rendered its HTML, so hydration
compared Spanish HTML with English components and discarded the rendered page.
The Worker now supplies the initial Spanish language to the layout and language
provider. Shared React render boundaries translate reviewed body copy before
rendering on both sides. Request-aware metadata also resolves reviewed Spanish
before React renders the head; rewriting English head tags alone made React add
duplicate tags during hydration. The HTML rewriter retains the reciprocal
language links and defensive head normalization. The
customer lander renders inside a client component so streamed server children
cannot escape that translation. Its copy and launch gate are unchanged.

Translation preserves button handlers, element keys, form values and manual or
legal exclusions. Placeholder copy falls back to the existing reviewed text
dictionary. Language changes also follow client navigation, so a retained launch
banner returns to English on legal pages. Spanish public links use their reviewed
Worker-served document URLs rather than requesting an unregistered RSC route.
The launch-update form sends the language actually selected on the page.

Build and all 570 tests passed locally. Nine new behavior checks cover rendered
copy, placeholders, handlers, form values, exclusions, navigation and metadata.
Cold-browser checks passed all eight Spanish routes with exactly one title,
description, canonical, social URL and locale. The account
browser fixture now checks all eight Spanish pages, complete reviewed copy,
metadata, mobile width, legal-page transitions and provider draft preservation.
Its former hydration-warning exception and overlay dismissal are removed: any
browser error fails the fixture. Full release gates and live verification are
required before this entry can be treated as production evidence.

The standalone whole-project TypeScript command still reports diagnostics,
including missing Cloudflare runtime types; it is not a passing check. No
customer, live-payment, SMS, provider-activation or document-scanning lock changes.

## 2026-09-05 - Browser fixture separates authenticated and signed-out scenarios

PR #194 passed its PR checks and merged as `4c2dd24`, but the production gate
caught a timing race in the account browser fixture. After confirming the
signed-in workspace URL, the fixture cleared cookies while that page's session
check was still in flight. Its redirect aborted navigation to the next test
scenario with `net::ERR_ABORTED`. Production correctly stayed on PR #193.

The fixture now closes the authenticated page and creates a fresh browser
context for the signed-out throttle scenario. No assertions, retries, website
behavior or launch locks were relaxed. This release also carries PR #194's
previously tested rendered-Spanish-metadata correction through the same gates.

## 2026-09-05 - Rendered Spanish search metadata stays on its Spanish URL

PR #193 deployed as `56237ea`, with 556 tests, the mobile/account browser
fixture, provider signup, 20 independent live checks, 325 links across 24
public pages, and 16 settled EN/ES browser pages passing. Google can now fetch
`/es/join`, but its live inspection exposed a second metadata issue: JavaScript
restored `/join` as the canonical and social URL with `en_US`, despite correct
raw Spanish HTML. Browser inspection reproduced the mismatch.

The language observer now also watches the document head. For reviewed explicit
Spanish paths it restores the Spanish canonical, social URL/locale and reviewed
metadata translations after client updates. English and unreviewed/legal paths
are untouched. Mutation work is coalesced, idempotent and cancelled on cleanup.
Five behavioral regressions and the real-browser fixture cover the mismatch,
repeated reconciliation, missing optional tags, route boundaries and switching
back to English. Google indexing remains unproven until its separate retest.
The first CI browser attempt passed its metadata assertions, then hit the
existing development error overlay while clicking English. The fixture now
records that identified hydration warning and dismisses its developer-only
overlay through the Dismiss control; other browser errors remain failures.
The earlier development hydration-recovery warning remains a broader design
follow-up. No customer, payment, SMS or provider/service launch lock is changed.

## 2026-09-05 - Spanish browser language and crawler routing corrected

PR #192 is deployed as `1fce795`, with 551 tests and 20 live release checks
passing. Its warmer copy and punctuation repair are published. Subsequent
Google live inspection exposed a separate 404 on `/es/join`. Direct HTTP
reproduction returned 200 only with `Accept: text/html`; wildcard, missing
Accept and HEAD requests returned 404. The Worker now routes Spanish GET/HEAD
requests by their reviewed path and checks the returned content type instead
of requiring a browser-specific Accept header. Non-HTML responses are untouched.

The browser also reverted explicit `/es` URLs to English after hydration,
hid the language switch there and replaced every page title with the homepage
title. The language snapshot now honors reviewed Spanish URLs. The English
switch returns to the corresponding English path with query/anchor intact;
blocked storage no longer breaks the switch. Page-specific titles are retained.
Five behavioral regression checks were added. Lint, production build and all
556 tests pass without skips. Local browser checks show Spanish persists after
initialization and the English switch works. The existing development warning
from translating SSR text before React hydration still appears; this change
repairs the resulting language selection, not the broader localization design.
Record the production and Google retest outcomes separately.

The owner also requested all-button testing. A read-only navigation audit found
325 internal links across 24 public pages resolved successfully, including
their destination anchors. Manual purpose checks found the homepage's account
buttons took visitors to another marketing page. They now use the shared
account-aware button: guests reach account creation directly, while signed-in
visitors return to their workspace. No real application or email was submitted.
The existing browser account-signup fixture is now a separate release-check
job. It uses only local D1 and a loopback mail catcher to exercise role/mode
buttons, password feedback, code delivery, account creation and throttling.
Its result must pass before production deployment; record the actual run result.
Manual checks also found that sign-in offered SMS while delivery was locked
off. A public capability endpoint now exposes only the sender's readiness
boolean; the account page offers phone sign-in only when it is true. The SMS
lock and server delivery checks remain unchanged. The browser fixture now
also exercises the mobile menu, direct guest signup, signed-in workspace
return, and hiding unavailable SMS while email sign-in stays available.

The first browser report for PR #192 incorrectly passed without asserting that
Spanish URLs remained Spanish. It has been corrected to failed with the actual
language mismatches retained. Future browser verification must assert final
language and page title after client initialization as well as raw HTTP output.

Google reports no security issues and no manual actions. The owner-approved
Cloudmersive Basic $19.99/month purchase was attempted once using the checkout's
saved payment option. The vendor could not charge it; no subscription is
confirmed. The owner must change the payment method or resolve it with the
bank before a further attempt. Scanner processing remains off. All customer,
payment, SMS and provider/service launch locks remain in place.

## 2026-09-05 - Warmer public copy and escaped Spanish text repair

The owner asked for research and more appealing, warm, human wording. Reviewed
Taskrabbit, Thumbtack and YourMechanic's own pages; the sources and original
Tuveloz adaptations are recorded in `business/2026-09-05-public-voice.md`.
The homepage, provider and customer introductions, shared account buttons,
help invitation and founding-program introduction now use direct, welcoming
language. Unsupported first-in-line priority, current signup activity, blanket
free-service language and unconditional price/payment promises were removed.
Example quote cards identify example providers instead of invented businesses.
Founding benefits and acceptance rules stay unchanged. The owner analytics
labels identify that existing A/B totals include the earlier wording; they are
not proof of conversion for this rewrite. English and Spanish copy match.

Browser review also reproduced a production defect on `/es/join`: escaped
apostrophes reached dictionary matching as raw HTML entities, then were escaped
again. Those paragraphs stayed English and visibly printed `&#x27;`. The Worker
now decodes rendered punctuation once for exact dictionary lookup, emits
reviewed translations as text, and preserves the original escaped bytes for
unknown text. It does not turn encoded markup into elements. Five behavioral
regressions cover chunk splits, fallback bytes, encoded markup, single decoding
and opaque script/style text. Local browser review confirmed translated provider
copy without entity leaks. Lint, the production build and all 551 tests passed,
with no failures or skips. All eight reviewed public pages were checked in the
browser for dictionary coverage; the new account-link translation was added.
CI and production deployment remain separate release checks.

PR #191 is deployed as `9fbca2f`, with 546 tests, 20 live checks and rendered
English/Spanish preview checks passing. Google can fetch the English application;
indexing is not yet proven. The historical founding-page 404 validation started.
Cloudmersive Basic at $19.99/month is approved but its checkout still needs a card;
no paid subscription or production scanning is confirmed. Genuine provider ID
verification remains for an actual applicant. Customer jobs, payments, SMS and
provider/service activation locks remain; logos/icons and outreach sends are
unchanged.

## 2026-09-05 - Provider search previews and reciprocal language links corrected

The owner's Search Console domain property is accessible. Its sitemap report
shows Success, 46 discovered URLs and a September 1 read. The August 27 indexing
report lists four indexed pages and 46 exclusions, including 42 discovered but
not indexed. URL inspection specifically reports `/join` as discovered but not
indexed. Google's September 5 smartphone live test can fetch the page, permits
indexing and recognizes its correct canonical. These are different states;
neither a successful sitemap nor a live test proves search inclusion.

Live HTML exposed concrete preview errors: `/join` inherited the homepage's
social title and URL, every shared page claimed providers were joining "right
now" without evidence, and Spanish previews retained English descriptions and
the English social URL. Homepage copy now states applications are open and
bookings are closed. The application gets its own title, description and URL,
with matching Spanish copy and the existing image. Spanish social URLs and
locale match the Spanish page. Reviewed English pages now link back to their
Spanish twins, completing the previously one-way language relationship.
No Spanish URL is created for an unreviewed page.

Lint, the production build and all 546 tests passed. Actual local rendered
HTML passed checks for canonical/social URLs, reciprocal language links,
translated descriptions and unchanged preview images. Two source-check
mismatches during development were resolved without weakening their intended
guards: the original response remains immutable and canonical-removal ordering
is checked within the Spanish handler. Production publication and Google's
indexing response must be recorded separately from this local verification.

PR #190 is already deployed as `79aa093`, with 20 live checks passing. The owner
approved Cloudmersive Basic at $19.99/month, but its checkout still requires a
payment card; no purchase is confirmed and production scanning remains off.
All customer-job, payment, SMS and provider/service activation locks remain.

## 2026-09-05 - Scanner response deadlines repaired; capacity decision pending

Both Cloudmersive callers cleared their 45-second timer when fetch returned
headers, before reading the response body. A vendor stall after headers could
therefore hold a scan indefinitely. The deadline now covers the bounded body
read; unread HTTP error bodies are aborted, and transport failures remain
retryable without recording a clean verdict. Default AbortError reasons also
preserve the evidence scanner's existing timeout classification.

Twelve behavioral tests execute the actual scanner functions with synthetic
streams and isolated network/timer/storage/recording boundaries. Before the
repair, four failed: stalled-body deadlines and HTTP error-body release in each
scanner. All twelve now pass, along with the production build, lint and all
546 tests (zero failures or skips). No real files were sent for these tests.
This entry records a locally verified repair; publication is a separate step.

The activation runbook now reflects the existing free account and encrypted
API key, the free plan's 3.5 MB limit versus the site's 10 MB uploads, and the
current $19.99/month Basic option requiring owner purchase approval. Production
scanning stays off. Live Identity configuration from PR #189 is deployed, but
its genuine provider-bound verification remains outstanding; Stripe account
owner verification must not be repeated as a substitute. Customer jobs, live
payments, SMS and provider/service activation remain locked.

## 2026-09-05 - Owner approved and connected dedicated live Identity credentials

The owner approved the exact live Identity key scope and completed Stripe's
authenticator challenge. The dedicated website key has Identity verification
write and recent sensitive-results read access only; all unrelated permissions
are None. A read-only request for a nonexistent session confirmed authentication
and read scope without accessing a person's record. A separate live snapshot
webhook uses the six handled Identity events and SDK-matching API version.
The two credentials were stored as encrypted Worker secrets.

The local storage wrapper initially mishandled Wrangler's Unicode output on
Windows after the secret update completed. Deployment history confirmed secret
versions were created; the wrapper now uses explicit UTF-8 and persists its
sanitized result before printing. An attempted activation-secret update was
rejected because those two names already exist as plaintext Worker bindings.
The runbook is corrected and this change sets the two approved Identity values
in `wrangler.jsonc` through the tested deployment path. No payment, customer-job,
SMS, scanner or service-activation switch is enabled by the change. A genuine
provider-bound live canary remains outstanding.

## 2026-09-05 - Additional Stripe owner verification accepted

The owner completed the phone handoff for Stripe Identity product access.
Stripe's dashboard now shows Create verification enabled and the additional
owner identity step without its Required status. This updates the prior log's
pending-owner state. It does not prove a genuine provider-bound live canary.

The live key list contains no dedicated website Identity key. Its configuration
form is prepared, but automatic approval review stopped selecting live Identity
write and recent sensitive-results read permissions pending the owner's specific
approval. The requested scope includes DOB access for the existing adult check
and encrypted Worker-secret storage, with no payment permissions. No new key or
Identity activation switch was applied. Continue the existing setup after that
approval; do not ask the owner to repeat the completed access verification.
The live destination inventory shows two Connect destinations and no Identity
destination; the import dialog offers the existing six-event test Identity
webhook. It was inspected and canceled without importing or editing anything.
The activation runbook records the exact separate live destination to prepare.

## 2026-09-05 - Guarded scanner pipeline verified in isolated workerd

PR #188 is live as `c58a141`, with deployment run 33944641724 successful and
19 independent live checks passing. The owner clarified that their completed
Stripe verification was from the original payment-account setup. The additional
check required to access Stripe Identity remains at the phone handoff; do not
represent it as complete or restart it without a reason.

The free scanner was then exercised through the actual storage/scanner/recorder
modules in local workerd, fresh D1 with all 66 migrations, and isolated R2. A
real clean PNG result, a prohibited text file seeded into quarantine after
upload validation rejected it, and a hash mismatch all followed the intended
guarded transitions. Results consumed exactly one pending request, duplicate
replays were idempotent, changed hashes returned 409, and two protective emails
were caught locally. Provider/evidence review and service activation stayed
blocked. The final run made two real Cloudmersive calls with synthetic files;
earlier diagnostic runs made four more. No production data, real identity,
outbound email, charge or payout was used.

Two initial failures were test-fixture errors: multipart encoding across Fetch
implementations and zone-less SQLite timestamps parsed as local EDT. Both were
corrected to match the real application. Cloudmersive also accepted a truncated
PNG header as malware-clean, so do not equate malware clearance with file
usability or genuine evidence. Temporary key copies were deleted after testing.
The 3.5 MB free-plan limit versus 10 MB uploads, production scanner configuration
and canary, additional Stripe owner verification and launch reviews remain open.

## 2026-09-05 - Real Cloudmersive response repaired; free account evaluated

The owner approved and received PR #187: merge `3a7c28c`, deployment run
33943718850, both jobs successful and 19 independent live release checks passed.
Stripe's additional owner verification, live canary and launch reviews remain
outstanding; temporary test CLI access is revoked and the test webhook restored.

Owner-authorized Google sign-in created an email-verified free Cloudmersive
account and API key, with marketing email and sales-demo options off. The key
is stored as an encrypted Worker secret, with scanner selection and its required
callback secret still unconfigured. No paid plan or real provider document was
involved. Real advanced
API calls using the application's exact header policy returned a clean PNG
with `FoundViruses: null`. The classifier had required an array, so a valid
clean response remained pending. Cloudmersive's official example documents null
when no viruses are found. The classifier now accepts explicit null or an empty
array while retaining every required false threat flag and verified-format
check. Missing and malformed values remain blocked. The shared repair covers
provider evidence and message-image classification.

Validation: the regression failed before the fix and passed afterward; all
534 tests, build and lint passed with zero skips. Repeated real advanced-API
checks correctly classified a harmless PNG as clean and prohibited harmless
text as failed. This is direct vendor contract proof, not a guarded production
scan or provider approval. The free plan's published 3.5 MB file limit is below
Tuveloz's 10 MB upload limit, and its one-call-per-second limit also needs capacity
planning before production use. The activation runbook records the mismatch.
Customer jobs, live payments, SMS and provider activation settings are unchanged.

## 2026-09-04 - Real Stripe tests found and repaired two Identity contract errors

The owner authorized official Stripe CLI access limited to test mode. The
Identity account application was submitted; the dashboard still requires the
owner's separate real Identity verification before live use. No live key,
payment, payout, real person's documents, or production provider record was used.

A real hosted reusable-flow test returned `options: null` even when verified.
Tuveloz's mandatory settings comparison therefore rejected the session before
releasing its URL. Stripe also rejects explicit options alongside a flow ID.
Creation now uses `type: document` with explicit document types, live capture,
matching selfie, and no ID-number check. The returned settings and all immutable
applicant/session bindings remain mandatory; unverifiable old flows stay rejected.
The obsolete flow-ID configuration requirement is removed, with deployment and
vendor instructions updated in the activation runbook.

The first signed success then exposed another contract error: expanding only
`verified_outputs` returns names but omits DOB. The existing adult check blocked
that result. The verified-event handler now explicitly expands
`verified_outputs.dob`; no ID number or images are requested, and no raw DOB or
verified name is persisted. The test key already had the required permission.
The blocked terminal record was preserved; final proof used a fresh applicant.

Validation: lint, build and all 533 tests passed with zero skips, including
fail-before/pass-after behavioral regressions for both contracts. The isolated
local-D1 signup fixture verified applications, email-code handling, campaign
idempotence, customer signup and provider sign-in using a local mail catcher.
Real Stripe-hosted synthetic failure remained pending without identity evidence.
Real synthetic success reached the app through the official CLI's signed callback
and atomically bound identity and age evidence to the correct local test person.
The authenticated return reported complete; replaying the same event was a no-op
and a bad signature was rejected. Application review remained outstanding.

The account's existing test webhook was temporarily disabled to keep these QA
events away from production, then restored to Active with its original settings.
The temporary CLI login was logged out and its session revoked; temporary copied
secrets were removed without revoking the owner's existing restricted test key. Scanner access, genuine live
Identity proof and the owner launch reviews remain unfinished. Customer jobs,
live payments, SMS and provider activation guards retain their existing settings.

## 2026-09-04 - Owner measurements and accurate public launch status

PR #185 deployed successfully as `a67ad41`. All 15 independent live HTTP checks
passed, including exact-release/schema checks and rejection of claimed completion
events. The authenticated dashboard loaded its saved-application total and new
email-code stage. Live review caught an older introductory paragraph still
describing events as people and omitting the API's measurement note. The page now
describes records and events accurately and displays the existing note about
repeats, historical coverage, and missing telemetry. This is a display-only
follow-up; event storage, signup, and all release gates remain as tested in #185.

The public launch banner and customer FAQ also claimed that local providers
were signing up "right now" and launch would be "very soon," without measured
support for those statements. English and Spanish now state that applications
are open, customer bookings are closed, and a launch date has not been announced.
The signed-in banner no longer claims an account reserves a place in line.
The canonical 5% fee definition and all 15 fee-consistency checks were verified
before editing marketing copy. No branding assets or legal policy text changed.

## 2026-09-04 - Saved provider applications and email authentication

Provider completion previously came from a browser beacon after a generic 202,
so repeating an existing application could inflate recruitment results. New
completion events now originate only after a new application transaction commits;
the event ID is idempotent and telemetry errors cannot fail the application.
Tagged campaign labels and A/B assignments travel separately from verified
application evidence. The public analytics endpoint rejects claimed completions,
bounds JSON, checks same origin, rate limits, and drops unrecognized properties.
Tracking survives blocked beacons and preserves landing attribution through
navigation. The email-code stage is now measured.

The owner dashboard separately counts actual non-test application records and
uses server-confirmed completion events for campaigns. It calls browser totals
events, removes unsupported abandonment/winner claims, and explains historical
coverage, repeated visits, and telemetry loss. Legacy browser completions stay
visible only as raw historical counts. Submission is not provider approval.

Workspace DNS and one outgoing message are now verified: Google SPF include,
2048-bit Google DKIM, and SPF/DKIM/DMARC pass at the receiving inbox. The `www`
hostname now redirects permanently to the apex while preserving path and query.
Account-administration details and recipient information remain private. The
email runbook and completed deadline record are updated.

Scanner and identity configuration still need the steps recorded in the
provider activation runbook. No live vendor canary is claimed. Provider
applications remain open; marketplace/payment/SMS locks and deferred branding
work retain their existing state.

Validation: lint, production build and all 527 tests passed, including focused
scanner/Identity checks and new behavioral tracking checks. The isolated local
signup test passed with fresh migrations, a saved campaign attribution, repeat
application deduplication, forged-event rejection, provider sign-in, customer
signup, and local notification delivery. Deployment is verified separately.

The first Linux CI run reached a saved application, then failed with
`UND_ERR_SOCKET` on the next request after synchronous D1 assertions. The
fixture now requests fresh HTTP connections to avoid reusing an idle socket
while its close event is queued. This change is confined to the local test
transport; write requests are never automatically retried and every application
assertion remains required. CI must pass on this revision before release.

## 2026-09-04 - Provider Spanish coverage and production support receipt

PR #183 deployed as `c508a95`; 12 live HTTP checks and browser checks passed.
The labeled owner-support test was received in the monitored owner inbox,
with Gmail displaying `updates.tuveloz.com` as the signing domain. This proves
that support handoff, not the separate Workspace reply path.

The provider introduction was unintentionally inside the manual-translation
barrier, leaving it English in Spanish mode. The barrier now covers only the
form; the introduction uses the shared dictionary, while the form explicitly
translates service descriptions and its step label. All 25 catalog descriptions
have translations; the rendered check switches the panel and 23 offered
descriptions to Spanish and back. Legal acknowledgments keep their existing
barriers. Lint, build, and 522 tests passed, as did rendered coverage for eight
marketing routes. Logo, social profile, Gmail appearance, and Google Search
branding changes remain deferred by the owner.

The Workspace sender still needs its Google SPF include and verified DKIM
setup; DNS and Admin changes await account access. See
[email authentication](operations/email-authentication.md). Owner-only account
administration details are retained privately.

---

## 2026-09-04 - Available policy answers and an owner support handoff

The live assistant returned `AI_UNCONFIGURED` for basic Tuveloz questions.
Published answers now work independently of AI in English and Spanish. Added
an explicit, editable owner-help submission using the durable email outbox,
origin validation, request limits, and honest queued/error states. Corrected
mobile provider categories, the duplicate H1, signup requirements, and provider
flow copy. Local browser delivery was verified using synthetic data and a local
mail catcher. This remains an undeployed working copy; production signup and
email delivery were not tested. Zeo chat reported `route_not_ready`; Claude's
availability probe was denied (403), so no independent Claude review is claimed.
See [support reliability](operations/2026-09-04-support-reliability.md).

---

## 2026-08-22 — A seal that could not be verified on the machine that matters

**Why this is here.** Nothing Tuveloz-side changed. It is recorded because the
failure is the same shape this log keeps meeting from new directions, and
because sessions work in both repositories. The work is in the Zeo repository
on branch `claude/holdout-seal-line-endings`.

**What happened.** Zeo's owner-hosted nightly on `main` failed on 2026-08-22
(run 32561102320): 3,512 tests, one error. `load_suite("holdout")` raised
`Coding holdout seal mismatch: source_sha256`. That seal is the evidence
machinery behind the sealed, exactly-once model runs — the thing that makes
"this suite was frozen before the model saw it" checkable by someone else.

The suite had not drifted. All three manifests record the LF-byte digest of
their source, the check hashed the raw bytes of the working copy, and the
repository had no `.gitattributes` — so the Windows runner checks the same
commit out as CRLF and hashes bytes that were never committed. The seal failed
on the one machine where the runs actually happen and passed everywhere else.
It was the first nightly to include those files; they had landed the previous
morning, so it had never been true before.

**The lesson worth keeping.** The failure named the field that disagreed and
nothing about how, and those are not the same information. A line-ending
difference and a tampered suite produce the identical message, the second
reading is the alarming one, and the alarming reading is the one a person acts
on. This log already holds two versions of that mistake — a search that
reported an empty feed as an unlucky question, and a video stage verified
everywhere except the artifact the owner receives. Here it arrives as a check
that could not say whether the environment moved the bytes or someone moved the
tasks.

The second half is narrower and worth carrying anyway: **a digest of a
checked-out file is a claim about a checkout, not about a commit.** The same
run claims also record controller and local-brain hashes taken the same way, so
identical code currently produces different provenance depending on who checked
it out. Pinning line endings in `.gitattributes` is what makes any of those
digests mean something to a second person.

**And check the whole class before pinning anything.** A sweep of every
committed digest of a committed file in the Zeo repository found ten, and they
do not agree. The three holdout manifests pin their source as LF. The three
`*_search_designs.json` files pin `zeo_holdout_universe_2020_2024.json` as
CRLF, which makes `zeo_alpha_nightly`'s snapshot check the same defect pointing
the other way — it verifies on the owner's machine and fails on every LF
checkout. The obvious repair, pinning everything to LF, would have moved which
machine is broken rather than fixing it, and it would have been shipped as a
fix. Two conventions in one repository is the finding; the JSON half is left
alone deliberately, because re-recording a frozen design is a decision about
evidence and not a bug fix.

---

## 2026-08-17 — Zeo's search failed, and the diagnosis was wrong for most of a day

> **Corrected the same evening. Read this first.** This entry originally said
> Microsoft had retired Bing's `&format=rss` feed on 2025-08-11 and that it
> answered every query with an empty channel. **That is false.** Measured from a
> GitHub runner that evening, with Zeo's own User-Agent, its `_HTML_ACCEPT`
> header and its 20,000-byte cap, the feed returned ten results for every query
> tried — including the three the owner had just watched Zeo fail on. The claim
> came from a search result describing other people's reports, written up as
> settled fact by a session that could not reach a single search host to check
> it. Bing's feed is not dead; the original text is kept below with this notice
> because the shape of the error is worth more than a tidy page.
>
> Why searching actually failed on `zeo-home` is **still unknown**. It is a
> question about that machine, not about the backend.

**Why this is here.** Nothing Tuveloz-side changed. It is recorded because the
mistake is the same one as the entry below it, arriving from the other
direction, and because a session that reads either should read both. The work is
in the Zeo repository: `dbdbf82` (#6), then the correction in `7f3270e` (#17).

**What happened.** The owner asked Zeo whether any games were on. Zeo replied
that it had searched the web and "the search returned nothing usable, so I have
no answer for you." Asked to narrow it to the NBA, it answered from memory that
no games were scheduled for "today, June 27, 2024".

Both halves were broken, in different ways.

The lookup's default backend reads Bing's `&format=rss` feed. Microsoft retired
the Bing Search APIs on 2025-08-11; the URL still answers 200 and the channel
comes back with no items in it, for every query. Zeo's code could not tell that
apart from a question nobody has written about, so a search service that had
stopped answering was reported, every time, as a run of unlucky questions. The
sentence was honest and pointed in exactly the wrong direction: the only repair
it suggests is asking again in different words, and no wording gets past a dead
feed. Roughly a year of lookups.

The date was a separate hole. No request Zeo sends the local model has ever
carried one, so the only "today" the model has is wherever its training data
stops — and every judgement that turns on recency was being made against that
date, not just the one visible wrong answer.

**The lesson worth keeping.** An honest failure message is not automatically a
useful one. "Nothing came back" was true about the feed and false about the
question, and because it named the wrong subject it sent the owner to the one
place the fix could not be. When a component can fail for two reasons that look
identical from outside, the check that tells them apart is the feature — Zeo now
spends one control query on a failed search and, if that also comes back empty,
names the search host and the setting to change instead of the question.

This is the 2026-08-15 video mistake in reverse. That one verified the stage it
had changed and never looked at what the owner receives. This one looked only at
what the owner receives, saw a well-formed honest sentence, and never asked
whether the machinery behind it was running at all. Both are answered the same
way: assert on the artifact, and make the artifact say which failure it is.

**The bigger lesson, added with the correction above.** Everything up to here
was written about a cause that was never checked. The session could not reach
any search host, searched the web *about* the feed instead, found other people
describing empty responses, and promoted that into a fact — then shipped four
changes on it, one of which put four dead hosts ahead of the working one and
made searching worse than it found it.

Three habits that would have caught it, none of them clever:

- **A second-hand report is evidence about reports, not about the thing.** "I
  read that this is broken" and "I asked it and it is broken" are different
  claims, and only one of them justifies a fix.
- **When you cannot reach the thing, say so in the artifact.** The pull requests
  said "I could not verify this" in the body while the code, the comments and
  the commit messages asserted the retirement flatly. The caveat has to live
  where the claim lives.
- **Find the compute that can check.** A GitHub runner has ordinary internet and
  was available the entire time. Nine minutes of using it settled what a day of
  reasoning had got backwards. When a container cannot see something, the
  question is which reachable machine can — not how confidently the gap can be
  argued across.

**Update, same day: the config edit was removed rather than documented.** The
paragraph that used to sit here said searching stayed broken until the owner
hand-edited `runtime.web_lookup.backend` and `runtime.web_learning.backend` on
`zeo-home`. That was true when it was written and it should not have been the
answer. The dead host was a *default in the code*, so the place to fix it was
the code, and writing up someone else's JSON edit was a way of not noticing
that. `rss` now means an ordered list of feed URLs instead of one host: the
first that returns results wins, and a machine whose config was never touched
searches again after a pull and a restart. Merged as `804b95e`, with the
`search status` command in `061b604` reporting which host is actually
answering.

Two things that came out of it are worth more than the fix:

- **The first draft defeated the guard it was working around.** It merged the
  new candidate hosts into the `search_hosts` allowlist, which made the
  allowlist stop restricting anything. The existing test proving a
  non-allowlisted host is refused went red, and it was right to. The fix was to
  make the allowlist *filter* the candidate chain instead — the guard decides
  what may be contacted, exactly as before. A test going red because you
  loosened something is the test doing its job; the move is to redesign, never
  to edit the test until it agrees.
- **A fix for silent failure nearly shipped as slow failure.** Five candidates
  at the full 15-second timeout is a 75-second search, and the health check
  behind it makes it 150. That is worse than the silence, because the owner
  feels it on every query. The chain now runs against a wall-clock budget of
  twice the single-host timeout. Checking the cost of a change is part of the
  change.

**Now open — and this is the part a later session should act on.** Nothing
Tuveloz-side is blocked, and nothing is owed on `zeo-home` beyond `git pull` and
a restart, or the word `selfupdate` typed to Zeo.

**The original fault is still undiagnosed.** Bing's feed answers normally from
outside, with Zeo's exact headers, byte cap and queries, so whatever made
searching fail on `zeo-home` is specific to that machine — its network, its
`agent_config.json`, or something not yet guessed. Nothing in this repository
can see it. `search status` run on that machine reports which host answered and
with what, and that output is the missing evidence; anyone picking this up
should start by asking for it rather than by theorising, which is precisely the
trap the correction at the top of this entry records.

---

## 2026-08-17 — Zeo's "same video every time" was the renderer, not the premise

**Why this is here.** Nothing Tuveloz-side changed. It is recorded because the
shape of the mistake is the useful part, and because a session reading the
2026-08-10 Zeo entry should know the story continued. The work is in the Zeo
repository on `claude/video-generation-issue-2fqtzc`.

**What happened.** On 2026-08-15 Zeo was fixed so that a video request naming no
scene invents an original premise instead of reusing a hard-coded constant. That
fix worked and was verified live — three consecutive inventions, three different
stories. On 2026-08-17 the owner reported the identical original complaint,
having seen no change at all.

Both were true. The premise varied; the picture did not. Zeo's procedural
renderer recognised so few words that nearly any story collapsed to the same
defaults — an anonymous "Hero", walking, in front of the same backdrop, because
each of those three was a literal constant reached whenever the vocabulary
missed. Measured by rendering one frame per premise: a rooftop gardener, a pearl
diver, and a clockmaker differed by under one greyscale level per pixel. Even
two stories that did agree on a setting drew the same skyline, since each
backdrop's layout was hardcoded too.

**The lesson worth keeping.** The 2026-08-15 fix was verified at the layer it
changed. It generated three different premises and that was checked and true.
Nothing measured the artifact the owner actually receives, so a fix that changed
nothing the owner could see looked complete for two days. When a complaint is
about output, the test has to assert on the output — not on the stage believed
to be at fault. The new test in Zeo compares rendered frames for that reason;
ten of its fifteen cases fail on the code that was thought to be fixed.

Second-order: the same session found that "make a video yourself" was making a
video *about Zeo* — the word survived into the scene description and resolved to
the character. A request that says who chooses is not a request for a subject.

---

## 2026-08-16 — The failing DMARC sender is real, and the rua mailbox is not a black hole

Two open questions about email authentication closed in the same sitting, both
from evidence outside this repository.

**The Workspace sender is live.** `2274534` (earlier the same day) worked out
from DNS that mail sent as `hello@tuveloz.com` fails DMARC on both legs — the
root SPF authorises the registrar's forwarders and not Google, and no Workspace
DKIM selector is published — but recorded honestly that the repository could not
say whether that mailbox actually *sends* or only receives. It sends. The sent
folder holds ordinary correspondence to recipients outside the domain, the most
recent on 2026-08-08, alongside a few self-addressed tests. So the broken sender
is in current use, and the Workspace SPF include plus a published DKIM selector
moved from "confirm or rule out" to a prerequisite for enforcement. It now has
its own dated row (2026-10-05), ahead of the `p=quarantine` move on 2026-10-19,
and that row was rewritten to depend on it. The recipient addresses are personal
data and were deliberately not written down anywhere in this repository; that
external recipients exist is the whole finding.

**The `rua` address receives.** `dmarc@tuveloz.com` is a working mailbox with
three Google aggregate reports in it, dated 2026-08-08 through 2026-08-12. That
retires the receipt half of the 2026-08-24 item; naming a reader is still open,
and pointedly so, because most of those reports are unread — the exact state
`email-authentication.md` calls decorative. Worth knowing for the inventory:
Google is so far the only submitter, so what the reports show is one receiver's
view, and a sender that never mails Gmail addresses would not appear in it at
all.

Nothing in the DNS changed today. Both findings are evidence, and the fixes they
imply are owner actions in the registrar and in Workspace, not code.

## 2026-08-13 — Hero copy test refreshed from real funnel data; step events now variant-stamped

Production funnel read (D1 `analytics_events`, all-time): 76 provider signup
landings → 10 step-1 completions → 4 step-2 → 1 submitted. The cliff is
landing → step 1, so the wording work went there. Two changes:

**The measurement bug first.** `provider_step1_completed` and
`provider_step2_completed` fired with empty props, so no A/B experiment could
ever be read at the step that actually loses people — only the start and the
single completion carried variants. Both events now stamp
`variants: activeVariants()`. Every read of the experiments before 2026-08-13
is unattributable at the step level; treat the tests as starting fresh from
this date.

**`provider_hero` B replaced.** The old B ("Do great work. Get paid.") was
generic. Competitor survey (Thumbtack pro lander, TaskRabbit, YourMechanic,
Wrench, Angi) shows the converging pattern for pro recruiting: name the
visitor's place and the thing they want — Thumbtack literally renders "Get
jobs in Germantown." for a Montgomery County visitor. New B, kept
launch-honest (first in line, not jobs today): "Be first in line for car jobs
in Montgomery County." A ("Your wrench. Your rules.") stays the control.
Spanish dictionary, admin funnel labels, `tests/hero-experiment.test.mjs`, and
`tests/spanish-coverage.test.mjs` updated together. Losing the old B's data
cost nothing — see the measurement bug above.

The paused-mode customer hero paragraph was also warmed (quotes "come right to
your driveway"), with its dictionary entry replaced in the same commit. The
customer side has too little traffic to test, so that one is a judgment edit,
not an experiment. Owner reads results at `/admin/analytics-funnel`; the page
itself says to wait for ~30 visitors per variant.

**Same-day follow-up: two signup friction fixes.** A successful application now
writes the verified email to the shared remembered-email key
(`lib/remembered-email.ts`, extracted from `/account`), so the sign-in that the
success screen points to arrives prefilled instead of asking the applicant to
retype the address they just proved control of. And step errors ("pick at
least one service", invalid email, legal confirmation) now scroll into view
when raised — they rendered at the top of the form while the buttons sit at
the bottom, so on a phone the tap looked like it did nothing. Verified by the
full suite and `npm run test:e2e` (provider application, provider sign-in,
customer signup all green against a real local server and D1).

## 2026-08-11 — Terms and the Payment Policy re-released; the open-PR queue cleared

**The release, because this one is a legal act rather than an edit.** Both pages
carried retired fee names, two occurrences each — one of Terms' sitting **inside
the liability cap in section 15**, and one of the Payment Policy's being a
section heading. The retired names themselves are not repeated here: they are the
banned patterns in `tests/customer-fee-consistency.test.mjs`, which scans `docs/`,
so writing one into this log re-introduces the thing the release removed. That is
not hypothetical — the first draft of this entry named both and failed the guard.
#95 had already established one canonical name in
`lib/customer-fee.ts`, but these two pages are SHA-pinned, so renaming them meant
following the `DEPLOYMENT.md` procedure: owner approval of the exact page,
incremented versions, new release ids, and hashes recomputed as sha256 of the
page source with CRLF normalised to LF.

Released as `terms-2026-08-11-r3` and `payment-policy-2026-08-11` in #160.
`TERMS_VERSION` went to `2026-08-11-r3` and `PAYMENT_POLICY_VERSION` to
`2026-08-11`. Done now deliberately: bumping `TERMS_VERSION` changes
`CUSTOMER_POLICY_BUNDLE_VERSION`, which is recorded on acceptance records, and
with customer job posting paused there are no real acceptances to invalidate.
Waiting would have made the same change expensive.

**`PENDING_LEGAL_RELEASE` in the fee test is now empty.** That list existed only
to let those two pages serve retired wording while a release was pending. An
entry appearing there again means a page is knowingly serving retired wording —
say which release fixes it and when.

**Two capitalisations were reverted on purpose.** Two lines already read
"customer service fee" in lowercase prose. Capitalising them broke the guard
asserting the agreements and the Stripe receipt describe the same fee. Reverting
kept the change minimal and left the guard alone; loosening its pattern to
accommodate a cosmetic edit would have been the wrong trade in legal text.

**The queue.** Eleven open pull requests down to one. #93 stays — it is the
`[DO NOT MERGE]` preservation branch and goes away when `tuveloz-app` exists.
#100 was closed unmerged: its headline change was an arbitration clause the owner
shelved on 2026-08-07, and merging it would have silently reinstated a clause
removed on purpose. Its salvageable work was extracted into four separate pull
requests instead — #155, #156, #157, #158 — leaving behind the arbitration
clause, a parallel `docs/STATUS.md`, and local-search work #95 had superseded.

**The pattern across all of it, worth carrying.** Every stale branch hid at least
one regression behind a small-looking conflict. Resolving with `--ours` or
`--theirs` on a whole file is not conflict resolution — it discards one side's
entire work, and it only looks safe when the visible hunk is short. Twice that
reverted `main`'s corrected fee copy. The reliable method is to take `main`'s
file and apply the branch's own diff on top with `git apply --3way`, resolving
only the hunk that genuinely conflicts.

---

## 2026-08-11 — The homepage founding banner promised two things we refuse

**Why this mattered.** The banner told providers *"The first pros into Montgomery
County get first pick of jobs"* under the heading *"Be first. Own your corner of
the county."* Both are perks the founding program refuses in writing, and the
first is barred in code: `lib/founding-cohort.ts` says outright that nothing in
that module may influence what a customer is shown or the order providers appear
in. `founding-provider-program.md` refuses territory locks by name.

So this was not a wording preference. It was the one claim on the site that could
not have been delivered if a provider had asked us to honour it — and it sat on
the page a paid provider campaign was about to point at.

**What it says now.** Only perks that exist: the first 20 accepted are never
charged a provider membership fee if one is ever introduced, and the first 10 are
invited to a spotlight post. Both numbers match `FOUNDING_COHORT_SIZE` and
`FOUNDING_SPOTLIGHT_LIMIT`, and the membership-fee wording matches the published
`/founding-providers` page — which already said it correctly. The site contradicted
its own published program page, not just its code.

**The Spanish carried both claims too**, and would have been missed by reading the
homepage alone: `site-language.tsx` had *"escogen trabajos antes que nadie"*
(they choose jobs before anyone else) and *"Adueñese de su zona del condado"*
(take ownership of your zone of the county). The dictionary keys on the English
string, so both key and value had to change together. Anything that edits
customer- or provider-facing copy has to check the dictionary in the same change,
or the English gets fixed and the Spanish keeps making the promise.

**Left the copy as one contiguous string on purpose.** Interpolating the cohort
constants into the JSX would tie the numbers to the source of truth, but it splits
the sentence into separate text nodes and the dictionary would no longer match —
the translation would fail silently. Literal numbers, verified against the
constants by hand, is the safer trade here.

**Both brand documents already flagged this** — `SALES_PITCH.md` listed it as one
of two live contradictions, and the morning-ads campaign doc told writers never to
say it. The rule was written down and the site said it anyway. Written guidance
does not remove copy that is already shipped; someone has to go and change it.

---

## 2026-08-11 — Check open pull requests before starting anything small (#147)

**New rule in `CLAUDE.md`, next to the existing "read the log first".** The log
records finished work. Work in flight lives in open pull requests, and nothing
sent anyone there — so run `gh pr list` and skim recent `main` before starting.

**Why it earned a rule.** Sessions run in parallel and cannot see each other,
and the collisions are not random: the small, obvious, self-contained job is the
one two sessions pick independently. The big messy ones never collide. Three
times in one afternoon — #137/#138 (the same eight-line doc block, and **#138
merged with an entirely empty diff** because git read the byte-identical
addition as agreement rather than a conflict), #145/#146 (the same deletion
entry, reconciled by hand), and the tag audit itself, run twice in parallel.

All three were minutes to hours apart, so the check would have caught every one.
If someone is already on it, extend their branch rather than opening a second
pull request.

---

## 2026-08-11 — `archive/got-this-series-wip` is audited empty and deleted

**This supersedes the two "the tag must stay" notes below.** Both were correct
when written. Neither is now: the ad half landed in #132/#134, and the last
thing the tag held that `main` did not landed in #143. The tag pointed at
`858b2d1` (annotated object `76f3a25`) and is gone from local and `origin`.
Both archive refs from `ads/got-this-series` are now gone; nothing points at
those commits, so git will collect them.

**Where everything ended up**, so nobody has to reconstruct this:

| From the tag | Landed as |
| --- | --- |
| the 21 ad-pipeline and document files | #132 and #134 |
| the `lib/launch-status.ts` doc block | #137 (and #138, an empty duplicate) |
| the e2e customer-signup and provider-sign-in coverage | #140 |
| the Reel 2 retirement note | #143 |

**How it was audited, since "delete an archive" deserves showing the work.**
Three questions, in order:

1. *Files only in the tag?* `git diff --diff-filter=A origin/main <tag>` → **0**.
   Every path in the tag exists on `main`. The "18 files never committed to any
   branch" line below was already stale.
2. *Files whose content differs?* **109.** For code and tests `main` is ahead by
   the whole lineage — that is the subject of the entry below, and losing those
   older versions is the point, not a cost.
3. *Any file with lines in the tag that never reached `main`?* Seven had some.
   Each was read rather than counted:

| File | Verdict |
| --- | --- |
| `brand/outreach/reel-provider-recruitment.md` | **tag ahead — salvaged in #143** |
| `scripts/generate-brand-assets.mjs` | `main` ahead: tag is the old PNG-master/`favicon-v2` generator, before the vector master |
| `brand/social-media-kit/README.md` | `main` ahead: tag drops the served-assets table and the `brand-mark-consistency` test note |
| `brand/outreach/moco-outreach-worklist.md` | `main` ahead: tag lacks Tier 1b and the `montgomery.craigslist.org`-is-Alabama warning |
| `.env.example` | `main` ahead: same AI-key block plus the `/ai` page and its fail-closed behaviour |
| `brand/outreach/provider-outreach-kit.md` | **tag is the old fee copy** — it framed the provider share as 95%. `main`'s fuller wording stands |
| `brand/ads/HANDOFF.md` | same old fee line. Left dead deliberately |

**#143 — the only thing that needed rescuing.** `main` still listed Reel 2
("dead battery documentary stare") as a live spec to produce. It was retired on
2026-08-07 and folded into Episode 1 of the "I've Got This" series, because it
duplicated Episode 1's joke and CTA and shipping both would split one gag across
two posts. What survived is the documentary stare and the forehead on the horn,
now clip D of Episode 1. Anyone working from that file would have produced a
retired reel.

**The lesson worth keeping.** Two of the three "tag ahead?" candidates that
looked promising were the *older fee copy*, and one was the retired logo
pipeline. On a tag from a superseded lineage, "content `main` does not have" is
usually content `main` deliberately moved past. Read every candidate; do not
salvage on a line count.

**One idea died with it, deliberately.** The tag's owner-side new-account alert,
keyed `security:owner-new-account:`, does not exist on `main` and was not ported
— adding it is a product change, not test coverage. If that notification is ever
wanted, it has to be rebuilt from scratch; there is no longer a copy to read.

---

## 2026-08-11 — `archive/got-this-series-wip` is not landable; two pieces salvaged

**Why this is here.** The tag looks like unfinished work waiting to be landed.
It is not. It is a snapshot of an older lineage, so applying it to `main`
*removes* newer work rather than adding to it — and some of what it removes is
launch guarding. Anyone who finds the tag and tries to cherry-pick or merge it
will weaken the marketplace locks without meaning to. Read this before touching
it. The entry directly below covers the same tag from the ad-asset side and
concludes it must stay; both conclusions point the same way — **keep the tag,
never merge it.**

**What replaying it would delete.** Not a merge conflict to resolve — a silent
revert. Among other things: `pausedCustomerRequestResponse()`, the entire
fail-closed 503 handler for customer requests; the comment pinning that gate
ahead of origin checks, body parsing, and every database read; the
`status: "blocked"` eligibility reasons and the "Real job operations remain
disabled" copy; and the customer-facing "jobs closed" text on the account and
post-job pages. Applied file by file, the tag nets out as
`email-notifications.ts` +35/−62 and `account-auth.ts` +15/−74. The two real
conflicts, `post-job/page.tsx` and `job-posting-pause.test.mjs`, both resolve to
`main`'s side: one would have deleted imports `main` still uses, the other
replaced 14 assertions with 4.

**What was salvaged.** Two pull requests, both additive:

- **#137** — the `lib/launch-status.ts` doc block. Eight lines, no deletions,
  lock value untouched. It records that `CUSTOMER_JOB_POSTING_PAUSED` governs
  marketplace *transactions* only and must never be read as a gate on account
  creation or on a provider submitting an application. The
  `CUSTOMER_JOB_POSTING_PAUSED_SUMMARY` constant that sits beside it in the tag
  was deliberately left out — nothing on `main` renders it.

  **#138 is the same block again and its diff is empty.** Two sessions salvaged
  it from the tag in parallel, and because the added text was byte-identical git
  treated it as agreement rather than a conflict, so #138 merged changing
  nothing (`git diff 496a05b 1d9d02a` is blank). The file carries exactly one
  copy. Cite #137 as where the block came from, and check `main` for concurrent
  work before salvaging from this tag — it is small enough that two sessions
  will pick the same piece.
- **#140** — the e2e signup coverage, ported by hand onto `main`'s version of
  `tests/e2e/provider-signup.e2e.mjs` rather than copied. Adds customer account
  signup, provider sign-in, post-signup application state, and the queued
  notifications. `main`'s newer work in that file is preserved: the `maxBuffer`
  raise, the per-repo/per-branch worktree namespacing, and the `.wrangler/state`
  reset before migrating.

**The trap inside the port, worth knowing on its own.** Three of the tag's
assertions did not hold against `main`, and running the suite is what exposed
them — two of the three passed review by eye:

| | tag | `main` |
| --- | --- | --- |
| `status` on a fresh application | `"approved"` | `"new"` |
| `verification_status` | `"self-enrolled"` | `"not reviewed"` |
| customer signup alert | `security:owner-new-account:customer:` | no such event exists |

The first two are the tag's lineage advancing an application *further* on signup
than `main` does. Asserting the tag's values would have pinned the looser
posture into a test — a guard regression wearing the costume of new coverage.
The assertions pin `main`'s stricter values instead. The third would have meant
porting a new owner-notification feature out of the old lineage, which is a
product change and not test coverage, so the assertion covers the
`security:account_created:` notice `main` does queue.

**Where that leaves the tag.** Intact and unmerged, which is correct. It still
holds the only copy of everything not listed above. Treat it as a reference to
read, not a branch to land: anything wanted out of it should be ported by hand
onto `main`'s current version and then actually run, the same way #140 was.

*Superseded 2026-08-11: the tag was deleted once the salvage finished. The
port-by-hand advice still applies to any old ref; the tag itself is gone.*

---

## 2026-08-11 — The archived ad work is on main, and one archive tag is gone

**Why this happened.** Deleting `ads/got-this-series` left 21 files reachable
only through a git tag. That is safe but not discoverable: nobody browsing the
repository would find the ad build pipeline, and the whole set sat one lost tag
away from gone. Both halves have now landed on main.

**#132 — the build pipeline.** The three ffmpeg build scripts, the ep1-battery
source audio, the shared lockups and tagline VO, `R2-MANIFEST.json`, and
`scripts/r2-video-manifest.mjs` that regenerates it. Twelve files, about 324KB.
These are the pipeline's *inputs*; the 57 rendered MP4s stay out of git under
the ignore rules from #127, with the private `tuveloz-brand-video` bucket as
the durable copy.

**A regression that was caught in the restore.** Checking out `brand/ads` from
the tag also overwrote `brand/ads/HANDOFF.md`, whose tagged version carries an
older fee line that framed the provider share as 95% — while main already had the
fuller wording about never expressing the customer fee as a provider deduction.
That file was reverted so main's version stands. Restoring a directory from an
old ref silently reverts every file in it that has moved on since; check the
modified list, not just the added one.

**#134 — the documents and remaining assets.** The counterweight-clip shoot
script and its how-to, the "I've Got This" creative spec, the Higgsfield
runbook, the no-strap lockup, a favicon variant, and the three cross-assistant
handoff documents from 2026-08-08. Restored verbatim rather than renamed:
three of them break the lowercase-hyphenated convention and none carry a status
header, but the runbook links to the ideas file by its URL-encoded name and
both briefs point at `SESSION-HANDOFF.md`, so renaming breaks the set.
Normalizing names and adding headers is still open, as its own pass.
`docs/README.md` gained a row for `docs/marketing/` and a **Historical**
heading for the three handoff documents, which are a record of how work was
split that day and not current instruction.

**`archive/got-this-series` is deleted.** Nothing was orphaned by that, for a
structural reason worth remembering: `archive/got-this-series-wip` points at
`858b2d1`, whose parent *is* `0808b9b`, so the old branch tip stays reachable
through the surviving tag. Files unique to that tag versus main are now zero.

**`archive/got-this-series-wip` was kept for this reason at the time.** It held 18
files of working-tree state that were never committed to any branch.

*Superseded 2026-08-11: the salvage finished and the tag was deleted. See the
entry at the top of this log. There is no recovery command any more, and the
audit found nothing left in it that `main` did not already have.*

**Fee copy was checked before landing**, since these are marketing documents.
Every mention states the rule correctly or forbids the 95% framing; no legacy 10%
copy survived anywhere in the set.

---

## 2026-08-10 — Closed three silent dead ends in account creation

**What happened.** Audited both signup paths end to end after asking whether
customers and providers can actually get accounts without trouble. Nothing was
broken, but three failures were silent — the visitor was told a code was on its
way and no email was ever sent, with no error to act on.

1. A provider picking the Provider tab and "Create account" without having
   applied. `eligibleAccountRoles()` only returns `provider` once an
   application row exists, so the server correctly refused and the generic
   response read as success. The provider create tab now says applications come
   first and links to `/join`.
2. The emailed-code throttle (3 per 15 minutes) was never surfaced. Both
   request routes returned the generic success text even when throttled, so
   anyone whose first code went to spam burned all three retries blind. Both
   routes now answer 429 with a real message.
3. No code entry step mentioned spam folders, the 10-minute expiry, or the send
   limit. All three now do.

**Decisions made.** Surfacing the 429 is only safe because the throttle now
runs *before* the eligibility lookup. The previous row-counting throttle could
only count rows it had written, so a 429 would itself have confirmed that an
address was real — an enumeration oracle, and the exact thing the generic "if
that email is eligible" wording exists to prevent. Throttling is now consumed
first, keyed by a hash of email+role+purpose, via the existing
`consumeFixedWindow` helper in `lib/public-write-rate-limit.ts` (no migration
needed). `issuePasswordChallenge` no longer throttles internally: its two
callers have to consume the window at different points — before the eligibility
lookup for a self-service request, after the password check for a sign-in — and
one shared throttle fired at the wrong moment for one of them.

Refusals stay generic. Naming which emails have applications would enumerate
providers; the fix is to state the rule up front, not to explain the refusal.

`tests/account-code-delivery.test.mjs` guards all of it, including the
throttle-before-eligibility ordering. That ordering assertion was
mutation-tested: reversing the two blocks fails it.

**Email authentication, checked the same day.** SPF, DKIM, and DMARC were
verified for `updates.tuveloz.com` by direct DNS query. DKIM aligns exactly and
SPF aligns under relaxed via Resend's `send.updates.tuveloz.com` bounce domain,
so alignment is correct. The gap is policy: `_dmarc.updates.tuveloz.com` does
not exist, so discovery falls back to `_dmarc.tuveloz.com`, which is `p=none`
with no `sp=` tag — monitoring only, no enforcement. Findings and the deliberate
tightening sequence are in
[`operations/email-authentication.md`](operations/email-authentication.md), with
dated rows in [`OPEN-ITEMS.md`](OPEN-ITEMS.md). The decision recorded: stay at
`p=none` until someone is actually reading `dmarc@tuveloz.com`, then move to
`p=quarantine` deliberately, and rotate the 1024-bit DKIM key to 2048.

**No end-to-end email test was possible before merge.** There is no preview
deployment for a pull request — every deploy step in `deploy-cloudflare.yml` is
gated on `github.event_name != 'pull_request'` — and staging cannot send at all:
`scripts/generate-staging-wrangler.mjs` sets `RESEND_FROM_EMAIL` to an empty
string and the staging Worker holds no `RESEND_API_KEY`, which `STAGING.md`
documents as intentional.

Verification was done locally instead, and is now committed as
`tests/e2e/account-signup.e2e.mjs` (`npm run test:e2e:account`). It runs in a
throwaway worktree against a real dev server, a real local D1, and a real
browser, with delivery pointed at `scripts/dev-mail-catcher.mjs` on loopback —
no production credential, no staging email, nothing leaving the machine. It
proves the property that matters: an eligible and an ineligible address are
indistinguishable across all four requests — same statuses, same response text
— while the catcher shows the two paths really did different work underneath,
three codes sent versus none. Reversing the throttle ordering makes it fail, so
it is a real guard.

What is still unproven is anything about **delivery**: nobody has watched a
code arrive in a real inbox, and the `Authentication-Results` header that would
turn the DNS analysis above into evidence has not been captured. Enabling
staging mail needs a separate Resend key and a `STAGING.md` update; whether to
do that at all is an open item.

**Now open.** Two friction points were left alone deliberately, as security
posture that is the owner's call rather than an assistant's:

- Password sign-in always requires an emailed code — mandatory 2FA on every
  sign-in, not optional. Passkey enrollment right after first sign-in is what
  softens this for repeat users.
- Sessions expire after 30 minutes idle and 12 hours absolute, so a provider
  working jobs will be signed out during the day.

Also unaddressed and structural: every entry path depends on Resend delivering
within 10 minutes, and phone/SMS is off (`PHONE_SMS_LIVE_MODE_ENABLED`). A
Resend incident or a domain-reputation dip locks everyone out with no fallback.

---

## 2026-08-10 — Zeo was answering without most of its own rules

**Why this is here.** Zeo is the owner's local assistant and it reads Tuveloz
under a read-only workspace. Its answers about this project were being produced
without most of its behaviour policy, so anything it said today or earlier is
worth re-checking rather than trusted. The work itself is in the Zeo repository
(`C:\Users\Torta Pounder\Zeo`), sixteen commits, written up in
`ZEO_LOCAL_MODEL_BEHAVIOUR.md` there.

**What happened.** The local runner keeps roughly 2k tokens of context by
default and discards the overflow without an error. Zeo's system prompt is
about 4805 tokens, so a question carrying project excerpts arrived with most of
the policy removed — measured directly: `prompt_eval_count` 2050 against a
4805-token prompt. Not only formatting rules were lost but never invent facts,
owner corrections outrank older memory, and the security boundaries. The symptom
that exposed it was two different system prompts producing byte-identical
replies. `num_ctx` is now always sent.

**What else that uncovered.** The Tuveloz project-context path had its own
standalone prompt and so never carried the general answering rules at all; it
now does, and its reply cap moved from 850 to 1200 characters. A reply to a
question with no project context attached ended "Checked read-only project
context: None applicable." — a claim to have run a file check that never ran,
copied from the shape of earlier replies. Model-authored versions of that
footer are now stripped; only code may state which files were read.

**Decisions made.** Answers that must follow a format are no longer requested
as prose. The runner constrains generation to a JSON schema, the model fills in
fields, and code writes the format — for choice lists and for code edits alike.
The model's indentation is discarded outright rather than validated, because
one measured edit was valid Python that quietly lifted a statement out of its
loop, which a syntax check passes. No hardware was needed; the constraint was
never the model's instruction-following.

**Now open.** Nothing Tuveloz-side is blocked. Worth knowing when Zeo is used
for project questions: it reads only the approved excerpt list, and its answer
is only as current as those files.

**Update 2026-08-11.** Zeo's safety suite passes (295 tests), including coverage
of the honesty and correction boundaries that the truncation bug was removing.
The specific defect is confirmed fixed. Zeo is also backed up to a private
GitHub repository and the `zeo-home` clone is fully synchronized with it, so the
single-disk exposure implied above no longer applies. The caution above still
stands on its own terms: verified safeguards are not verified answers, and Zeo's
replies remain only as current as the excerpt list it reads. Reported by the
owner from the `zeo-home` machine, which this session could not reach; the suite
was not run from here.

---

## 2026-08-10 — Signup step 1 shows the document count, and the ads branch is archived and gone

**What shipped.** Step 1 of the provider application now names how many
documents the selected services require, before the form asks for an email.
Previously that only appeared on step 2. The count is **distinct documents**,
not rendered checklist rows: two services can require the same document and
step 2 draws it once per group, so summing the per-service lists overstates
what actually gets uploaded. The copy reads "unique documents" so the smaller
number does not look like a contradiction of those repeated rows. Live at
`/join`, English and Spanish. Merged as #126, with #127 alongside it.

**Deliberately not shipped: a time estimate.** An earlier draft paired the
count with "about 10–15 minutes." That was dropped because the flow has never
been measured. The same reasoning removed an unmeasured "set it up in minutes"
line from provider toolkit copy on the old branch, though main had already
deleted that copy independently. If the duration is ever measured, the step 1
note is where it belongs.

**`ads/got-this-series` is deleted.** It was 121 commits behind main and
already superseded by #119, and a dry-run merge conflicted in ~28 files
including `drizzle/meta/_journal.json`. Its code features had all reached main
separately, but **21 files existed nowhere else** — the `brand/ads` build
pipeline and ep1-battery audio, `scripts/r2-video-manifest.mjs`, the Higgsfield
runbook and marketing docs, two brand SVGs. Nothing was lost; two tags hold it:

| Tag | Commit | Holds |
| --- | --- | --- |
| `archive/got-this-series` | `0808b9b` | the branch tip, all 21 unique files |
| `archive/got-this-series-wip` | `858b2d1` | that tip plus 18 uncommitted working-tree files (+299/−101) committed at deletion |

**Superseded 2026-08-11 — do not use the table above as a recovery path.** All
21 files are on main, and `archive/got-this-series` has been deleted. Only
`archive/got-this-series-wip` still exists; it descends from `0808b9b`, so the
old branch tip is still reachable through it. See the entry at the top of this
log.

**A trap that nearly cost the ad videos.** The deleted branch's `.gitignore`
ignored `brand/ads/*.mp4` and `brand/ads/got-this-assets/**/*.mp4`; main never
had those rules. Switching a checkout to main therefore left all 57 rendered
MP4s untracked and stageable, one `git add -A` away from committing ~50MB of
build output into permanent history and reversing the move to private R2. #127
ports the rules. The videos remain on disk and in the `tuveloz-brand-video`
bucket, with checksums in `brand/ads/R2-MANIFEST.json`.

**Two verification traps worth remembering.** `npm run i18n:check` reports on
whatever dev server is listening, not your checkout — it was run against a
server started from the branch's own worktree on a dedicated port, after
confirming the lineage. And `git merge-base --is-ancestor` called both merged
PR branches *unmerged*, because GitHub squash-merges: the branch tips never
become ancestors of main. Deleting them safely meant diffing content against
main instead, which is the check to use here.

**Production.** Both merges deployed clean. `wrangler d1 migrations apply`
reported "No migrations to apply!", so production D1 was untouched. Health
reports application, database, and schema ready, and the launch locks are
unchanged: `onboarding_only`, accounts and provider applications open,
customer job requests and payments closed.

---

## 2026-08-10 — Phone-to-Zeo remote access, and why the Tailscale invite failed

**What happened.** The Tailscale "share a device" invite for `zeo-home` kept
returning `Failed to accept invite`. Cause: the invite was sent from
hello@tuveloz.com to hello@tuveloz.com. Device sharing crosses accounts; you
cannot share a device with the account that already owns it. The phone does not
need a share at all — signing it in to Tailscale with the same account puts it
in the same tailnet and `zeo-home` appears on its own.

**Written up** in
[`operations/zeo-remote-access-tailscale.md`](operations/zeo-remote-access-tailscale.md):
the working procedure, an ordered fault list (the usual real cause is a service
bound to `127.0.0.1` rather than anything to do with Tailscale), and the rule
that Zeo stays inside the tailnet — `tailscale serve`, never `tailscale funnel`.

Nothing in the Tuveloz application depends on any of this.

---

## 2026-08-11 — Gave the open items real dates, so the weekly check can work

**What happened.** Every row in `OPEN-ITEMS.md` was undated, which meant the
Monday deadline workflow had nothing to report and the readiness command's
deadline section always came back clean. Dated 14 of the 16 rows and corrected
the ones that had gone stale against the actual pull-request state: PR #98
merged on 2026-08-07 and is now marked done, PR #33 and PR #46 are both closed
so their stranded work only exists on their branches, and the launch-gate row
now says what `npm run readiness` found rather than asking someone to go look.
The `tuveloz-app` repository creation was split out as its own `blocked` row,
because the move of `mobile/` cannot start until it exists.

**Decisions made.** The dates are self-set targets, and the file now says so —
they are there to make the automated check function, not because an outside
party imposed them. Two exceptions are called out: the recurring reviews are
dated against launch gates that fail once a legal review is over a year old,
and the insurance row carries a placeholder to be replaced with the carrier's
real renewal date once a record card exists. The SMS sign-in row stays undated
on purpose — it describes a deliberate lock, not a commitment to unlock it.

**Now open.** Eight items now fall inside the 30-day window, so the Monday
workflow will start opening a GitHub issue where it previously found nothing.
That is the intended behaviour, not a regression.

---

## 2026-08-10 — One command that reports what Tuveloz still needs

**What happened.** Added `npm run readiness` (`scripts/check-readiness.mjs`),
which collects into a single report the four things that previously had to be
checked in four places: the three marketplace locks read from source, the 18
launch gates read from the catalogue in `lib/launch-readiness.ts` against the
decisions recorded in production D1, `.env.example` compared against the
deployed Worker's vars and secrets, and the deadline table, by running the
existing `scripts/check-deadlines.mjs`. Flags: `--offline` skips the two
Cloudflare reads, `--json` emits the same data as JSON, `--strict` exits 1 when
something required is outstanding.

**What the first run found.** Production has **zero** launch-gate decisions
recorded, so all 18 gates are pending — including the ones only an outside
authority can answer (insurance carrier, CPA, payment processor). Three
required configuration values are unset: `LAUNCH_UPDATES_POSTAL_ADDRESS` and
`IDENTITY_VERIFICATION_PROVIDERS` are declared empty in `wrangler.jsonc`, and
`STRIPE_CONNECTED_ACCOUNT_WEBHOOK_SECRET` has neither a var nor a secret.
Nothing is overdue in `OPEN-ITEMS.md`, but every row there is undated, so that
is not reassurance.

**Decisions made.** The report reads and never writes. Gates are answered by
the owner in `/admin/launch-readiness` and nowhere else; the script cannot
record a decision, and the marketplace locks are printed as context with a note
that nothing in the report is a reason to change one. Keys that are only needed
once a related subsystem is switched on — the two evidence-scanner secrets,
while `EVIDENCE_SCAN_PROVIDER` is `unconfigured` — are reported as not yet
needed rather than counted as gaps, so a deliberately fail-closed subsystem
does not read as broken.

**Now open.** The gate decisions and the postal address are owner and
third-party work, not code. Adding real dates to `OPEN-ITEMS.md` would make the
deadline section of this report meaningful rather than always clean.

---

## 2026-08-09 — Locked the 5% customer-fee copy against regression

**What happened.** Audited the current production release and the source on
`main` after stale indexed pages exposed older 10% fee language. Cache-bypassed
production responses for the homepage, payment policy, provider agreement,
terms, customer agreement, provider signup, and post-job page contained no 10%
customer-fee claims. Production was serving the same commit as `main`.

**Decisions made.** The invariant is explicit for every assistant and every
copy surface: customers pay a 5% service fee, providers keep 100% of what they
quote, legacy 10% language is a defect, and the customer fee must never be
expressed as a deduction from provider earnings. A focused test now fails the
build if either forbidden claim returns in application, brand, AI-policy, or
assistant-handoff copy.

**Now open.** Search-engine and crawler snapshots may continue showing an old
version until they recrawl; production itself is current.

---

## 2026-08-08 — Search Console "Page with redirect": the QR short links

**What happened.** Search Console emailed a new indexing exclusion for
tuveloz.com: *Page with redirect*. Traced it to the only two redirects the site
serves. The whole app contains exactly two: `app/q/[slug]/route.ts` and
`app/api/stripe/connect/refresh/route.ts`. The second is already behind the
`/api/` disallow. The first was not.

**Why it happened.** `/q/<slug>` is the QR short link printed on provider
materials. It 302s to `/providers/<slug>?source=qr`, counting the scan on the
way through. Nothing excluded it from crawling, so Googlebot followed the links
and reported each one as a page that redirects.

**The important part: this was never an error.** The redirect is doing exactly
what it was built to do, and "Page with redirect" is an exclusion, not a
failure — Google is saying it indexed the destination instead of the wrapper.
Nothing was broken and nothing needed unbreaking. The fix is only to stop
spending crawl budget on a wrapper whose destination is directly reachable.

**What changed.** `app/robots.ts` disallows `/q/`. The storefront it points at
stays fully crawlable; only the redirector is excluded.

**What did not, in the end.** This work originally added its own
`app/providers/[slug]/layout.tsx` to set the canonical, because the storefront
page is a client component and cannot export metadata itself. By the time it
landed on 2026-08-11, #150 had already created that file with a better version —
same canonical, plus slug sanitisation and a fail-closed `noindex` while
`MARKETPLACE_MODE` is not live. Main's version stands; only the robots rule came
from here.

**Also true, and left alone.** `ai.tuveloz.com/` 302s to `/ai` in
`worker/index.ts`. If the Search Console property is a domain property rather
than a URL-prefix one, that root will be reported the same way, and it is
equally intentional. The comment there explains why it is deliberately
temporary rather than permanent; do not "fix" it either.

**Worth knowing for later.** The sitemap lists 19 static pages and no provider
storefronts at all. That is defensible while onboarding is the only thing open,
but once storefronts are public and worth finding, `app/sitemap.ts` is where
they need to appear. Not done here — it is a launch decision, not a redirect
fix.

---

## 2026-08-08 — Homepage made launch-honest and shorter

**What happened.** Reworked the customer-facing hero on the homepage and customer lander so it no longer implies that live customer quotes are available today. Both now say that accounts are open while requests wait for adequate provider coverage. Added a clear “Need help today?” route to local shops, mobile mechanics, or licensed towing while dispatch is unavailable. Added a planned-fee example that labels final launch pricing and tax treatment as under review.

**Decisions made.** The homepage no longer uses provider counts, invented traction, or review substitutes as startup proof. It now focuses on customer choice, provider independence, documented service-specific requirements, and an honest launch state. The long provider-application, review, request, expansion, and feedback sections remain available on their dedicated pages or the About page instead of competing on the homepage.

**Now open.** Decide which first-wave local SEO pages to publish while customer requests remain closed. Any service page must be informational and collect launch interest rather than imply a live booking or quote turnaround.

---

## 2026-08-06 — Captured what the five open pull requests settle

**What happened.** Recorded the state of every open pull request in one place,
so the context survives when the chat sessions that produced them are deleted.
Deleting a conversation does not delete a branch, a pull request, or its
description — the work and the reasoning behind it are in Git and on GitHub, not
in the chat window. What was missing was a single place to see it together.

**The five open pull requests, oldest first.**

- **#90 — email exhaustion alerts and an open-work handoff.** A queued
  notification that used all five delivery attempts was dropped from every later
  retry batch silently, which for verification and compliance mail meant
  protective messages could go quietly undelivered. Now raises an owner incident
  on the exhausting attempt, deduplicated per event, inserted rather than sent
  inline, with a guard so an incident never raises an incident about itself. The
  dashboard counts `exhausted` separately from `failed` because the first never
  recovers on its own. Also adds `docs/OPEN_WORK_HANDOFF.md`.
- **#93 — the mobile app foundation. Must never be merged.** A complete Expo /
  React Native Phase 1 foundation under `mobile/`, sharing no code with the
  website. It belongs in a separate `tuveloz-app` repository; creating that
  repository returned `403 Resource not accessible by integration`, so the code
  was preserved here rather than discarded. Extraction is documented and was
  rehearsed in `mobile/docs/EXTRACTION.md`.
- **#95 — local-search pages and one name for the Customer Service Fee.** The
  fee had five different labels across the site, the agreements, and the Stripe
  receipt line; the economics never differed but nobody comparing two surfaces
  could know that. One name now, defined once, with a test that fails the build
  if a second name reappears. Adds 17 local-search URLs behind an explicit
  allowlist rather than a cross product, because two lists multiplied together
  produce doorway pages.
- **#96 — the `/providers` directory.** Stacked on #95 and based on its branch,
  so #95 must merge first. The directory is gated on the same `discovery` action
  that closes customer requests, because a directory listing providers while
  discovery is closed would be a way around that control.
- **#97 — jurisdiction-scoped compliance requirements, plus strategy
  documents.** Requirements now resolve from where the work happens rather than
  applying uniformly, failing closed in both directions.

**Also recorded.** Added the three migration traps to `CLAUDE.md` after
verifying them against `main`: numbers collide at `0053`, the generated
snapshots are stale past `0047` (35 snapshots for 54 migrations), and tests must
never pin the newest journal entry. Three branches have already been lost to
these.

**Now open.** Merge order matters and is not obvious from the pull request list:
#95 before #96, and #93 never. Both are in `OPEN-ITEMS.md`, along with the
launch blockers #90 surfaced.

---

## 2026-08-06 — Two documentation efforts collided; constraints consolidated

**What happened.** Opened PR #98 for the documentation structure and found PR
#97 already adds a root `CLAUDE.md` and its own `docs/INDEX.md`. Merging both
untouched would put two orientation files and two competing indexes on `main` —
the exact confusion this work exists to prevent.

**Decisions made.** The two sets of content are complementary, not duplicative,
so nothing is being discarded. #97 carries constraint knowledge — the three
fail-closed locks, the provider-classification never-build list, the Maryland
§ 8-205 and § 14-1001 detail. This branch carries filing infrastructure — the
filing guide, the records register, this log, the deadline register and its
automation. Folded #97's constraints into `CLAUDE.md` here after verifying each
claim against `main`: `PHONE_SMS_LIVE_MODE_ENABLED`, `automatic-job-routing.ts`,
`maryland-repair-records.ts`, `evidence-review-assistant.ts`, and the `testOnly`
short-circuit all exist as described.

Deliberately left out #97's jurisdiction-scoped compliance section. It describes
`imposed_by` and `local_requirements_reviewed` fields that #97 introduces and
that are not in `config/provider-eligibility-matrix.json` on `main` yet. That
section belongs in `CLAUDE.md` once #97 lands, not before.

**Now open.** Whichever PR merges second should drop its own `CLAUDE.md` and
index rather than adding a parallel one, so a single orientation file and a
single index survive. #97's three strategy documents — pitch, competitive
landscape, provider classification design — should get rows in `docs/README.md`
when they land. Both are tracked in `OPEN-ITEMS.md`.

---

## 2026-08-06 — Document organization system created

**What happened.** Set up the documentation structure: an index (`README.md`),
a portable project brief (`AI-HANDOFF.md`), filing rules (`FILING-GUIDE.md`),
category folders for business, legal, operations, and product documents, and a
register for real-world documents (`records/`). Added `CLAUDE.md` so Claude Code
sessions pick up the conventions automatically.

**Decisions made.** Originals of insurance, formation, tax, and license
documents stay outside this repository; only record cards describing them get
committed. Confirmed the repository is public, which makes that rule mandatory
rather than tidy. Existing docs stayed at their old paths because
`tests/admin-staging-test-lab.test.mjs` reads `docs/STAGING.md` by path.

**Also established.** External assistants read these documents through public
raw GitHub links rather than pasting. Added this log and `OPEN-ITEMS.md` as the
shared memory between sessions, plus a weekly workflow that opens a GitHub issue
when something in the register comes due.

**Now open.** The branch `claude/document-storage-organization-066mie` is not
merged, so none of this is reachable from `main` yet. The document register is
empty — no real business documents have been filed. See `OPEN-ITEMS.md`.

---

## How to write an entry

Add yours at the top, under the horizontal rule, using this shape:

```markdown
## YYYY-MM-DD — Short title of what happened

**What happened.** A few sentences. Enough that someone who was not here
understands what changed and why.

**Decisions made.** What was decided and what forced the answer. Skip if
nothing was decided.

**Now open.** What is unfinished, and what the next person should pick up.
Anything with a deadline goes in `OPEN-ITEMS.md` as well, not only here.

---
```

Write an entry when something changed that a future session would be wrong not
to know: a decision, a launch step, a policy change, a vendor approval, an
incident, a change of direction. Do not write one for routine edits — a log
nobody trusts to be significant is a log nobody reads.

Never rewrite or delete an old entry. If an entry turns out to be wrong, add a
new one at the top saying so. The record of what you believed at the time is
often the useful part.
