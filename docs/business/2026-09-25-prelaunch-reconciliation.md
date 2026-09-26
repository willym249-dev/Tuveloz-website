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

- Release `8ae3dd1ffd83cc711c41c21a2a2756a85f60aeb6` (PR #228) deployed
  successfully through GitHub Actions on September 25 at 12:58 UTC. The three
  latest production-monitor runs reviewed passed, including September 26 at
  00:41 UTC. The monitor checks the application, D1, required schema, and closed
  customer-launch gates. No pull requests were open at this check.
- Customer accounts and provider applications are open. Customer requests,
  quotes, bookings, and payments remain closed.
- The business Gmail inbox loads. Activation and payment receipts are present.
  Exact Google Admin subscription details still require a fresh account
  verification; an old suspension warning is not current proof of a problem.
- The owner-operated ClamAV task is scheduled, its production claim connection
  is authenticated, and antivirus definitions were current during this review.
  The queue was empty, so this proves the runner connection and schedule, not a
  complete file scan.
- The website and the reviewed Instagram, TikTok, Facebook, and X profiles use
  the same Tuveloz mark.

## Published code and its activation limits

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

## Owner application — last step

A live provider application must name a real provider business, real personnel,
and only services that business honestly intends to offer. Stripe hosts the ID
and selfie check; no identity document belongs in this repository or chat. A
test-only owner who does not plan to offer vehicle services must use test mode
rather than creating a misleading live provider application.

The first truthful uploaded provider document can also serve as the missing
end-to-end scanner canary. A clean malware scan does not prove that a license,
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

Cloudmersive is a retained fallback. A paid upgrade is not needed while the
owner-operated scanner remains reliable and completes the real-file canary.
