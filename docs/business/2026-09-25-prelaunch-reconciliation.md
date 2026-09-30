# Tuveloz prelaunch reconciliation — September 25, 2026

- **Status:** active
- **Customer launch:** closed
- **Provider applications:** open
- **Owner provider application:** intentionally last
- **Last reconciled:** 2026-09-30

This is the current handoff. It separates published code, observed production
behavior, services awaiting activation, and real-world evidence that code cannot
create. Follow-up verification used GitHub's deployment and monitor results;
earlier browser observations below are dated evidence, not perpetual guarantees.

## Remaining work for the first customer pilot

This is the existing launch scope grouped by who can finish it, not a new
feature list or a promise that all work ends after a fixed number of hours.
Accounts and provider applications are already open. The seventeen required
review gates remain the acceptance criteria; the signed owner-page refresh
on September 28 at 11:25 p.m. Maryland time showed all seventeen still pending,
plus the optional lane. These are review records, not seventeen new code bugs.
The scanner operational check passed; genuine provider Identity remains unproven.
Code checks cannot approve those gates.

| Work group | What is complete | What still closes the group |
| --- | --- | --- |
| Payment, refund and customer consent | Stripe's model approval/acknowledgment, hosted checkout presentation, both full-$105 sandbox refunds, PR #264 recovery repair and PR #270's scoped booking-pause refund exception are verified. | Finish reviewed policy adoption and exact English/Spanish customer consent; resolve partial/provider recovery; verify production Stripe delivery and eventual settlement. The receipt-language experiment remains separate from the completed Spanish checkout labels. |
| Business, service, insurance and tax decisions | Public entity/domain/vendor checks, provider requirement inventory, and the already-sent county/broker inquiries are recorded. | Owner authority/contribution records, applicable county/service answers, an actual platform/provider coverage decision, and tax/ledger review. Do not resend answered or pending inquiries or treat a generic approval as service-specific clearance. |
| Privacy, security and operational response | Scanner, backup/recovery, private upload/access and incident-hold tests are recorded. | Complete the required source/reviewer decisions, identify an incident fallback, and prove actual incident/provider-reminder inbox delivery. Routine proof renewal is maintenance, not a reason to rerun completed setup. |
| Genuine provider verification | Application, document upload and isolated Identity integration tests are recorded. | A truthful applicant completes matching ID/selfie, service-specific issuer/registry/insurance checks and payout readiness. Keep the owner's application last; owner-only testing cannot stand in for a real service provider. |
| Final pilot release | Existing locks and eligibility checks keep the current site onboarding-only. | Record supported dated decisions, enable only approved services through the existing reviewed release process, and verify the small customer pilot before widening it. Do not mark launch approval from test counts. |

Optional mobile-app extraction, employee/trainee pathways, new paid AI features,
old abandoned feature branches and future marketing improvements are outside
this first-pilot finish line. Scheduled billing/domain reviews, future filings
and optional DNS hardening remain maintenance or separately reviewed work.
The still-unset launch-update email postal footer is a distinct delivery setting;
business Gmail activation and its completed mailbox tests stay complete.

September 30: the owner confirmed customer payment at checkout, with provider
transfer after completion checks. Do not ask for that timing or the settled
full-refund amount again. The scoped business-Gmail search for county/broker
senders returned no matching reply. PR #271's published checkout-language repair binds
new English consent, rejects missing/mismatched language and prevents Spanish
checkout from silently using English consent. All 894 tests/build, TypeScript,
lint (one existing warning) and 36 mobile browser checks passed. Required PR
checks and all three production jobs passed. Seventeen independent live checks
at `2026-09-30T05:06:35.643Z` confirmed the exact `61a2e4a` release, healthy
schema, bilingual signup routes, private controls and closed payments. Complete
Spanish customer policies/acceptance and policy adoption remain separate.
The owner/contributor facts requested September 30 are still unanswered.
See `legal/payment-policy-reconciliation.md`; do not repeat the completed release.

The owner answered the specific PR #270 merge/deploy request, and automatic
approval review accepted the action. The separate refund action is now published
and independently verified as `c44c1ff` on September 30. The exact boundary and
isolated proof are in `legal/payment-policy-reconciliation.md` under "Booking
pause and existing full refunds." Do not repeat this approval, the completed
release or the settled refund-amount question. This exception does not bypass
onboarding mode, readiness review, Stripe live-key locks or an individual
refund's owner confirmation and eligibility.

The September 28 Stripe Dashboard inspection found the payout-safety destination
Active but **zero deliveries in its displayed This week history**. Its zero error
rate is not delivery proof. The September 29 read-only follow-up resolved the
Import entry: it offers only the test-mode Identity destination, not a hidden
legacy payment endpoint. The four existing live destinations were preserved.

The owner-approved fourteen-event **Tuveloz payment status** destination is now
saved and Active at https://tuveloz.com/api/stripe/webhooks/payments, using Your
account / Snapshot / 2026-06-24.dahlia. The saved subscriptions match all fourteen
receiver handlers. Its matching STRIPE_PAYMENT_WEBHOOK_SECRET was installed by
official Wrangler in the existing tuveloz Worker; temporary signing material was
removed. Creation and secret installation are complete: do not repeat them.
Production checks at 07:16:54 UTC confirm the same healthy d61bd13 release,
unsigned/forged notification rejection and preserved closed request/payment
controls. Stripe still shows zero deliveries; no valid event or real transaction
was created. Actual vendor delivery, settlement and the reviewed live-payment
release remain unfinished. Private evidence:
stripe-payment-destination-prepared-20260929.json,
stripe-payment-connection-verification-20260929.json and
stripe-payment-connection-active-20260929.png.

A fresh September 29 Stripe inspection still shows no payment deliveries.
The owner-approved [isolated hosted sandbox test](../operations/stripe-hosted-delivery-rehearsal.md)
is now **complete**: two actual Stripe deliveries returned 200, the second
acknowledged the duplicate, and separate D1 stored one processed receipt with
attempt_count=1. Forged/missing signatures were rejected. Temporary key,
destination, Worker and receipt database were removed after verification;
production and private staging were preserved. This proves hosted sandbox
transport, not production delivery or live settlement. Do not repeat this
completed test, the refund rehearsals or PR #267 without a new relevant change.

## Verified in production

**Published in PR #270, September 30:** reviewed full refunds have a separate
booking-pause action while transactions/provider payouts remain pause-blocked.
Current onboarding/live-payment locks and every existing refund safeguard stay
in place. Three compatible development-dependency patches clear the new audit
findings. All 888 tests/build, TypeScript, both mobile refund engines, both PR
workflows and all production jobs passed. Fourteen independent live HTTP checks
confirmed exact release `c44c1ff`, healthy application/database/schema, account
pages, protected refund/payout routes and closed checkout at 04:10:31 UTC.
No real transaction or active policy changed. Complete; do not repeat.

**Published in PR #269, September 29:** incomplete refund-list and nested review
replies now preserve the last good screen and show recovery guidance. Approval
success requires a valid acknowledgment and matching saved decision; failures
retain the owner's draft and require a fresh review before another mutation.
All 885 tests/build, TypeScript, mobile Chromium/WebKit refund checks, both PR
workflows and all production jobs passed. Twelve independent live HTTP checks
verified `e2a8466` at 00:32:37 UTC September 30 (September 29 Maryland time),
including the published code, protected refund APIs and closed checkout. The
authenticated owner refund list and Refresh control work; the current real
queue is empty. No real refund, policy adoption or launch switch changed.
Complete; do not repeat. Existing unfinished launch decisions above remain.

**Published in PR #268, September 29:** checkout exact-record repair
includes the existing labor-only checkbox sentence in the shared displayed,
downloaded and hashed text, and separates policy-reference links from the label.
New presentations use `checkout:4`; older stored records are not rewritten.
Literal provider details and English evidence remain outside translation.
Long metadata now wraps beneath full-width labels instead of squeezing labels
and clipping values on phones; itemized prices retain their compact columns.
Production build, 881 tests, TypeScript, lint (one existing navigation warning)
and 32 mobile Chromium/WebKit cases passed. All PR/production checks and thirteen
independent live checks passed for `3748f7a` at 23:29:48 UTC. The narrow undici
7.29.1 patch clears the npm audit without changing other package versions.
No active legal policy or launch switch changed. Full Spanish customer consent
is still awaiting its reviewed release. Scoped business-inbox review found no
new broker/county reply. Do not repeat the completed release.

- Latest verified production release: PR #270,
  `c44c1ffda6e59dd038a4b0959b535442b629adb7`, verified September 30 Maryland time.
- Prior verified production release: PR #269,
  `e2a84661a0ab717e53f79e258606371be15d806b`, verified September 29 Maryland time.
- Prior verified production release: PR #268,
  `3748f7a5f6a72d29859ef51cd586c38410a7e570`, verified September 29; details above.
- Prior verified production release: PR #267,
  `676e6199cb18a1b6e044fd2d53eef543dd022eaa`, verified September 29.
  Stalled checkout requests now stop after twenty seconds and require a fresh
  status read and consent. Lost or unsuccessful replies also clear the prior
  authorization; no automatic checkout retry is sent. Late replies cannot
  redirect. English/Spanish recovery guidance, 28 mobile Chromium/WebKit cases,
  all 872 tests/build, both required PR workflows and all three production jobs
  passed. Thirteen independent live checks confirmed the exact healthy release,
  signup pages, signature protections and closed requests/payments. No real
  transaction was created. Evidence: pr267-live-release-20260929.json and
  checkout-recovery-validation-20260929.json. Do not repeat this completed repair.

- Earlier verified production release: PR #266,
  `d61bd13ae6ddbcf71dd754e4dffd1e97f996d58b`, verified September 29 at 06:22:38 UTC.
  All 872 tests/build, both required PR workflows and all three production jobs
  passed. Thirteen independent live HTTP checks verified the exact healthy
  release, payment signature rejection before API access, other signature
  boundaries, bilingual signup pages and preserved launch locks. Completed
  notifications can acknowledge a genuine duplicate after API access becomes
  unavailable; applying a new event still requires every original client/release
  check and remains retryable when blocked. Isolated signed-route/SQL tests prove
  those retry behaviors without live data. Evidence: pr266-production-release-20260929.json
  and pr266-live-release-20260929.json. Do not repeat this repair or its release.

- Earlier completed release: PR #265,
  `48c8ba947c10d2bce68e1637f5e9d401561c7cc8`, verified September 28 Maryland time.
  All 869 tests/build, both required PR workflows and all three production jobs
  passed. Thirteen independent live HTTP checks at 2026-09-29 03:41:15 UTC
  confirmed the exact healthy release, four Stripe routes rejecting missing or
  invalid signatures, English/Spanish signup pages and preserved launch locks.
  Old notification attempts cannot overwrite a newer receipt attempt; that
  behavior has isolated migrated-SQL and signed-route proof. Production
  vendor-originated delivery remains separate. No real event or transaction
  was created. Evidence: pr265-production-release-20260929.json and
  pr265-live-release-20260929.json. Do not repeat this release.

- Earlier completed release: PR #264,
  `bafe9a7fee67a1ff7ceeb32fa79feab47ad18297`, verified September 28 Maryland time.
  All 863 tests/build and required PR/production jobs passed. Nineteen live HTTP
  checks and the authenticated owner queue/Refresh control passed. Existing
  refund status can be checked during a pause; confirmed-unsent retry requires
  fresh eligibility and explicit confirmation. Both real Stripe sandbox refund
  rehearsals are complete, temporary access revoked and local listeners stopped.
  Preserve the completed PR #255–#264 work in LOG; do not repeat those releases.

- Earlier completed release: PR #254, `a1f9ace7f1777170702e43213dace33638d6ee84`.
  Both PR workflows and all three production jobs in `36333832839` passed,
  including 809 tests/build, required browser/migration checks and complete
  provider signup. Independent live verification at September 27 16:52:43 UTC
  confirms the exact release, ready application/database/schema, signed-out
  provider access denial and preserved launch locks. Recorded evidence start
  dates and pathway start/end bounds now participate in eligibility decisions
  under rules `0.14.2`. Isolated SQL tests also confirm existing expiration
  cutoffs, all-stage rechecks and replacement protections. No real provider,
  document or message was changed as a test; launch review remains separate.
  See `LOG.md`; do not repeat this completed repair or deployment.
- Earlier completed release: PR #253, `ed6c5930214a33bb0dff4048398e266410da2e89`.
  The owner explicitly approved this publication. Both PR workflows and all
  three production jobs in `36329213779` passed, including 800 tests/build and
  required browser/migration checks. Independent live verification at September
  27 15:37:58 UTC confirms the exact release, ready application/database/schema,
  protected signed-out provider access and preserved launch locks. The repair
  restores the recognized expiration-reminder delivery/retry path with current
  provider/evidence checks. Pre-release read-only counts found zero reminders
  and zero expiration-family queued emails. No real reminder was sent as a
  test; real inbox evidence and automatic-expiration-blocking review remain
  separate. See `LOG.md`; do not repeat this approval, repair or deployment.
- Earlier completed release: PR #252, `0d6fc3d08b46626e30a8cc70d96c69bd5976a813`.
  Production workflow `36325931216` and independent live verification at
  September 27 14:45:25 UTC passed. Provider service and credential forms retain
  drafts after rejected saves; twelve isolated browser scenarios cover failure,
  deliberate retry and successful clearing. All 793 tests and required release
  checks passed. PR #251's unused-font removal and nine dependency notices are
  also published. See the latest `LOG.md` entries for exact scope and artifacts;
  do not repeat these completed releases.
- Earlier confirmed release (superseded by the releases above):
  `546e60adeac216c4b99822d6e6af709ab74ea24c` (PR #250), built September 27 at
  10:23:50 UTC. Every job in production workflow `36311546784` passed, including
  793 tests/build, required Spanish navigation and end-to-end provider signup.
  Public health at 10:29:18 UTC confirmed the exact commit, ready
  application/database/schema, accounts/applications open, and customer
  requests/payments closed. The earlier county guidance and saved-reference
  fixes remain published. This does not approve provider credentials or launch.
  The approved nine-event payout-status destination is Active with its dedicated
  secret encrypted in production. PR #246's six deployed signature/duplicate
  checks passed on `3198099` using an unmapped synthetic event; this is not Stripe-originated delivery or
  settlement proof. The temporary signing material was cleared. Do not repeat
  the completed setup. PR #247 also repairs wrong-session and concurrent
  checkout updates with conditional SQL that preserves newer payment and hold
  states. Ten added actual-route/helper and migrated-SQL tests demonstrate the
  failures before the repairs and success afterward. No real Stripe operation
  was performed; release proof does not satisfy payment/insurance launch review.
  PR #248 adds ten behavior cases for overlapping refund/dispute reconciliation:
  current dispute/launch holds survive, equally timed adverse results remain
  recorded, and conflicting refund writes reread Stripe before saving. A genuine
  failed-refund correction can still update the amount. Retry exhaustion stays
  retryable. No real transaction was performed; do not repeat either repair.
- The Spanish customer account gap is closed. Live mobile clicks of the bottom
  Spanish homepage buttons reached the customer creation and provider forms.
  Account creation, sign-in and reset controls are translated; reload retains
  Spanish, switching works both ways, and the synthetic unsubmitted email was
  visually retained before clearing it. The account fits 320px and 390px phone
  widths. Spanish links carry a language hint so a click before hydration also
  works; the private route stays `/account`, with no `/es/account` public alias.
  No account, code, provider application, password change or consent was
  submitted. Browser error logs were empty; English and normal viewport were
  restored and the verification tab closed. Do not repeat this completed fix.
- PR #243 adds automatic **owner** incident alerts, quarantined test previews,
  and scheduled recovery. All 733 local tests, production build, typecheck,
  lint, twelve Chromium/WebKit incident scenarios, and required release gates
  passed. The incident route remains test-only. No real incident alert was
  sent, so production incident-triggered inbox delivery remains unproven.
  The owner reports availability "anytime" to check the business inbox; a
  fallback contact is still unspecified, and no guaranteed response deadline
  was promised. Participant/insurer notices and launch approval remain separate.
- September 26 production follow-up found no incident reports or incident
  alerts, no pending/failed email rows, and seven existing service-accepted
  emails. The 22:45:27 UTC scheduled invocation succeeded after PR #243.
  The existing September 4 local-date automatic website support message was
  re-read in the business Inbox with SPF/DKIM/DMARC pass. This preserves
  completed support-delivery proof without a new send; it does not establish
  current incident-triggered inbox delivery. No production data or settings
  changed. Detailed results and limits are in the incident runbook.
- PR #242 requires an email-service receipt before the outbox records a send
  as accepted. Six malformed-success response cases now remain retryable with
  the same key; later acceptance stops repeat sends. All 726 tests, build,
  lint/typecheck, PR gates, and production release passed. This does not prove
  inbox delivery. A separate owner-authorized manual mailbox test passed
  September 26 at 21:49–21:50 UTC: the English/Spanish sample reached the
  owner's test Inbox, passed SPF/DKIM/DMARC, and its reply was opened in the
  business Inbox. Private receipt evidence is retained outside the repository.
  That manual test does not prove automatic incident delivery or staffing.
  The specifically approved broker inquiry was sent September 27 at 12:31 a.m.
  Maryland time. There is no reply in the latest focused business-inbox search;
  keep the September 30 review checkpoint and do not resend it. No coverage or
  launch approval was recorded.
- Customer accounts and provider applications are open. Customer requests,
  quotes, bookings, and payments remain closed.
- September 26 local review of all eight approved authentication-report
  attachments is complete: fifteen message observations, three aligned passes,
  nine historical Google-related failures, and three recent unsigned failures.
  The newer failures are possible spoofing, not confirmed fraud or compromise.
  Files and hashes remain private. Sender completeness, new-report monitoring,
  and any DMARC enforcement change remain pending; no DNS was changed. See the
  [email-authentication runbook](../operations/email-authentication.md).
- The business Gmail inbox loads. September 26 Google Admin inspection confirmed
  Business Plus Active, Flexible Plan, one license, a displayed $19.80 monthly
  estimate and $26.40/user/month after the November 5 discount ends. Billing
  inspection is complete; November 1 is the cost-review checkpoint. No plan changed.
- The owner-approved hosted customer upload passed on isolated staging at
  `7348f7d`: one normal email code/sign-in, one actual image/note submission,
  private-image read and refresh persistence, with no changes to earlier holds,
  provider approval, payments or provider messages. Temporary credentials were
  revoked/removed, the customer signed out, and no-send defaults restored.
  See [`../STAGING.md`](../STAGING.md); do not repeat it as an unfinished upload.
- The owner-operated ClamAV task is scheduled and its September 26 09:29 UTC
  run completed without errors after a successful signature refresh. The earlier
  "missing complete file scan" statement was incorrect: September 6 manual and
  automatic synthetic-file scans both passed. September 26 live rows matched
  the recovered snapshot and current application proof validation passed.
  Evidence/provider approval remained pending; no new scan was run. The proof
  needs refreshing before October 6 under the existing 30-day rule.
- The website and the reviewed Instagram, TikTok, Facebook, and X profiles use
  the same Tuveloz mark.
- September 26 official Maryland Business Express lookup confirms TUVELOZ LLC
  is Active and in Good Standing, formed July 24, 2026. The public formation
  record is complete; ownership authority, private originals, insurance, and
  service licensing remain separate evidence. The first annual-report deadline
  is tracked for April 15, 2027 using Maryland's published next-year rule.
- September 26 signed-in Porkbun review confirms auto-renew and contact privacy
  enabled for tuveloz.com, with July 22, 2027 expiry and a saved Link via Stripe
  payment method. No charge was attempted; the June 22 renewal checkpoint remains.
  The Tuveloz-specific contact form was subsequently inspected without changes:
  its populated address/email differ from the verified business mailbox/support
  record. Owner confirmation of accuracy/reachability remains; a difference alone
  does not make an owner contact invalid. See the domain record for scope.

## Published code and its activation limits

The September 27 privacy-isolation/recovery check uses real signed sessions and
migrated synthetic account records. Isolation passed; API outage handling,
bounded browser waits, explicit refresh and provider-view preservation are now
published and verified as PR #249. All 789 tests/build and eighteen added mobile
browser cases pass, as do required PR and production checks. Four read-only live
requests confirm unsigned/invalid-scope access is rejected with private,
no-store responses; authenticated behavior remains synthetic proof. No real
privacy request or export was submitted. This does not approve the
privacy/retention gate. The page was English-only at PR #249; its separate
language follow-up is completed below.

That language follow-up is published and verified as PR #250: Spanish privacy controls,
messages and status history, preserved original user content, language-aware
sign-in/return links, and scoped mobile checkbox/select fixes. All 793 tests
and sixty-four synthetic browser scenarios pass, as do required PR/production
checks. Four live mobile English/Spanish sign-in redirects preserve language
and privacy context with no page errors/overflow. Unsigned API requests remain
rejected and no public Spanish privacy alias exists. Authenticated form proof
remains synthetic; no real privacy request or export was submitted. This does
not change PR #249's dated evidence or approve the privacy/retention launch gate.

- PR #241 makes emergency-contact and safety-stop incident reports stop the job
  timer regardless of a low/moderate severity selection, preserving the payment
  hold. Ordinary low-severity claims do not claim a work stoppage. The actual-route
  regression failed before the fix, then all 725 tests and twelve incident browser
  scenarios passed. Production release `36261358204` and exact live health are
  verified. The incident runbook has a scoped official-source check and unsent
  bilingual response drafts. Insurer review, actual
  notification delivery, and launch approvals remain separate.

- PR #240 corrects misleading account welcome notices and their workspace
  destinations without resetting saved notice history. Notification reads and
  writes now recover from failures and stalls; a saved read-state update remains
  successful when its follow-up refresh fails. All 723 tests and twenty focused
  mobile browser scenarios passed, followed by the full PR and production
  verification. Release `36257408571` and the live notifications page are
  confirmed. Private interactions were checked with synthetic fixtures, not real
  customer records; this does not complete incident-notification delivery.

- PR #235 patched seven affected dependency entries; the resulting npm audit
  reported zero vulnerabilities. High/critical dependency findings now block
  verification. Its production workflow passed, including all 693 tests and
  browser checks. The English/Spanish home and provider pages and eight referenced
  assets returned 200 in the September 26 10:55 UTC release smoke check.
- The hourly production health workflow is published and its recent scheduled
  runs passed. Owner notification delivery still depends on GitHub notification
  settings; a passing run does not prove that a failure alert reached the owner.
- The private daily D1-and-R2 backup Worker is deployed, with a standard free
  Cron Trigger at 09:07 UTC and 35-day retention. A real manual backup passed.
  Its database restored into separate Cloudflare D1 with all 78 table counts
  matching, 355 records, 383 schema objects, quick check OK, and no foreign-key
  violations. Both expected R2 objects restored at their original paths;
  downloaded bytes and metadata match the backup. Actual application routes
  passed local smoke checks using recovered data with writes/outbound calls
  disabled. The first automatic instance completed all seven steps September 26
  at 09:07:38 UTC. This was not a hosted application cutover. PR #232's application
  release also passed; public health at 09:13 UTC confirms `273e1aa` ready with
  customer requests/payments closed. See the activation runbook for evidence.
- A private multi-AI workspace with preview-only defaults, file-boundary checks,
  provider-call caps, output caps, and current model overrides. No API key,
  provider account, paid credit, or live AI API call was created.
- Warm English and Spanish provider-recruitment copy that states the actual
  phase and does not promise approval, queue position, jobs, income, or a launch
  date.
- The public-profile audit records completed Facebook and TikTok corrections,
  accepted Search Console requests, and the pending Google Maps correction.

The backup deployment and restore are verified operational work. The private AI
workspace still has no new paid provider activation. No paid upgrade was made.

## What can proceed and what must wait

| Work | Current boundary |
| --- | --- |
| Customer accounts and provider applications | Already open. Pending customer-launch reviews do not close these flows. Existing tests and dated production evidence above remain completed work. |
| Provider activation | The genuine applicant still needs matching Identity, service-specific evidence and official/issuer checks. Keep the owner's application last as requested. A scanner result cannot approve credentials. |
| Customer bookings and payments | Require the existing seventeen required launch gates, real-world evidence and supported recorded approvals. The optional employee/trainee lane is separate. No gate has been approved by these tests. |
| Website repairs that remain reproducible | Finish each scoped repair and verify its release. The September 27 reminder-delivery repair (PR #253) and evidence-start/pathway-validity repair (PR #254) are published and independently verified, with isolated runtime/SQL proof. Real reminder inbox delivery and the associated operational launch review remain pending. |
| Optional product ideas | The separate mobile repository, historical reminder/range features, and additional paid-AI integrations are not prerequisites for this website's current account/application flows. Scope them separately instead of restoring old branches. |
| Dated maintenance and outside responses | Use the existing deadlines for the county and broker replies, search processing, scanner freshness, credentials, billing and annual filings. A future maintenance checkpoint is not unfinished setup. |

The record-card renewal task is complete for known dates: domain renewal,
annual report, scanner proof, credential expiry and Workspace cost review have
dated rows. New insurance or license dates belong there only when those records
exist; do not invent expirations or treat the missing policy as a missing reminder.

## Still required before the owner application

1. Finish the remaining private address checks listed in
   [`business-address-review.md`](../operations/business-address-review.md).
   The mailbox activation, Google Payments address update, and public-profile
   corrections already have dated evidence. The Stripe support-address mismatch
   was corrected to the verified mailbox September 26 with specific owner
   approval; private business and owner fields stayed unchanged. Do not infer
   changes to legal, tax, or bank records. Other unverified fields are not proof
   of wrong addresses.
2. Keep real-world launch evidence separate from website repairs and provider
   applications. Google Maps processing and refreshed snippets are external
   follow-ups, not reasons to repeat the accepted submissions.

Backup activation, the first automatic run, isolated cloud data restoration,
and local application recovery checks are complete. Do not restart them; use
the [activation record](../operations/production-backup-activation.md).

The September 26 local incident rehearsal also passed automatic payment holds,
stop-work recording, and rejection of customer/provider hold-release attempts.
It used synthetic local records and a local mail catcher against `312b63b`.
The subsequent owner simulation exercises real token verification, SQL, and
auditing with temporary keys and synthetic public-key transport. It covers
owner decisions and later release of retained incident holds, with separate
Chromium/WebKit control checks. PR #236 is confirmed live as `3eb2871` after
700 tests and release run `36246209425` passed. The real deployed Cloudflare
owner sign-in and read-only dashboard, compliance, and job-lookup access were
separately verified September 26. The existing private staging environment was
then refreshed to the same main commit through successful run `36247963177`.
Actual owner UI/API resolution and later hold release passed against synthetic
staging D1 records; the original resolution and other incident's hold were
preserved, with verified owner audit and no payment or notification records.
The reports were seeded fixtures. The later link/read check is recorded below;
The later hosted participant upload is complete as recorded above. Insurer/notification handling, an actual payout, and complete process review remain outside these
results. All eighteen live review controls still showed Pending. See the
[incident plan](../operations/vehicle-incident-claims-and-stop-work-plan.md)
for exact scope; its launch review remains pending.

The published incident-evidence increment adds an authenticated control to link saved
job photos/notes without altering a hold or resolution. All 716 tests, production
build, lint, typecheck, and owner/customer/provider browser checks passed locally.
The new tests execute actual upload, incident, link, and private-image routes
with synthetic bindings, including rollback and wrong-account rejection. The
existing private staging deployment `36252778621` also passed actual owner
linking and opening of a seeded synthetic image from R2. Independent D1 checks
confirmed preserved references/resolution/holds and one new owner audit, with
no payment, notification, or provider approval. The later hosted participant
upload is complete as recorded above; insurer/source review and launch approval
remain separate. PRs #238 and #239
are published together as `36e9376`; production run `36254642943` passed and
public health at 16:28:35 UTC confirmed that exact release with all health checks
ready and customer requests/payments closed. A staging screenshot also exposed
and verified the correction of SQLite UTC/local-time display on both evidence
screens. No stored evidence or prior incident decision was overwritten.

## Owner application — last step

A live provider application must name a real provider business, real personnel,
and only services that business honestly intends to offer. Stripe hosts the ID
and selfie check; no identity document belongs in this repository or chat. A
test-only owner who does not plan to offer vehicle services must use test mode
rather than creating a misleading live provider application.

The scanner's synthetic operational test is complete. The first truthful
provider upload still needs its own scan and review, and can refresh the dated
operational proof. A clean malware scan does not prove that a license,
registration, certificate, or insurance policy is authentic. Authenticity
requires matching the applicant and service to the issuer, insurer, or official
registry and recording the source and date of that check.

## Separate customer-launch blockers

These do not prevent provider applications from remaining open, but customer
requests and payments must stay closed until they are resolved:

- Tuveloz currently has no platform insurance policy on record.
- The launch-readiness decisions still need dated evidence from the owner and
  the named legal, tax, insurance, security, and vendor reviewers.
- Stripe's approval of the marketplace payment model is separate from the
  owner's Stripe business verification and from a provider's Identity result.
- Service-specific licensing, registration, insurance, competency, incident
  response, refunds, taxes, and evidence-review procedures need final recorded
  decisions.

Cloudmersive is a retained fallback. No paid upgrade was needed for the verified
owner-operated scanner. Keep its task health and dated proof current.
