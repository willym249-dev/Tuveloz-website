# Tuveloz prelaunch reconciliation — September 25, 2026

- **Status:** active
- **Customer launch:** closed
- **Provider applications:** open
- **Owner provider application:** intentionally last
- **Last reconciled:** 2026-09-26

This is the current handoff. It separates published code, observed production
behavior, services awaiting activation, and real-world evidence that code cannot
create. Follow-up verification used GitHub's deployment and monitor results;
earlier browser observations below are dated evidence, not perpetual guarantees.

## Verified in production

- Last confirmed release at this record update:
  `312b63bb43211ae6d88b0adaae6020dc76be90d5` (PR #235), built September 26 at
  10:53:14 UTC. Its release workflow passed and public health at 10:55:08 UTC
  confirmed the exact commit, ready application/database/schema, and closed
  customer-launch gates. Consult the current pull-request/release result for
  subsequent changes; a source update alone does not establish deployment.
- Customer accounts and provider applications are open. Customer requests,
  quotes, bookings, and payments remain closed.
- The business Gmail inbox loads. Activation and payment receipts are present.
  Exact Google Admin subscription details still require a fresh account
  verification; an old suspension warning is not current proof of a problem.
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
The reports were seeded fixtures. Real evidence attachment, insurer/notification
handling, an actual payout, and complete process review remain outside these
results. All eighteen live review controls still showed Pending. See the
[incident plan](../operations/vehicle-incident-claims-and-stop-work-plan.md)
for exact scope; its launch review remains pending.

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
