# Open items and deadlines

- **Status:** active
- **Owner:** hello@tuveloz.com
- **Last reviewed:** 2026-08-27

The things that must not be forgotten. An expired insurance certificate, a
lapsed registration, or a legal review gone stale can block provider activation
outright — several launch gates in `lib/launch-readiness.ts` fail on expired
approvals and on a legal review older than one year.

This file is checked automatically. `.github/workflows/deadline-check.yml` runs
every Monday, reads the table below, and opens or updates a GitHub issue when
anything is overdue or due within 30 days. **An item with no date in the `Due`
column is invisible to that check** — if it matters and it has a deadline, give
it a real date.

## How to use this

Add a row when you take on something that has a deadline or that someone is
waiting on. Set `Status` to `open`, `blocked`, or `done`. Mark items `done`
rather than deleting them, and prune the done rows when the table gets long.

Dates are `YYYY-MM-DD`. Use `—` when there is genuinely no deadline, and accept
that nothing will remind you about that row.

Most of the dates below are self-set targets rather than deadlines imposed from
outside, and moving one is a normal thing to do. The exceptions are the two
recurring reviews, which are dated against launch gates that fail once a review
is more than a year old, and any renewal date copied from a real document.

When you close something significant, write a matching entry in
[`LOG.md`](LOG.md) so the reasoning survives.

## Items

| Due | Item | Owner | Status |
| --- | --- | --- | --- |
| 2026-08-24 | Name a person to monitor `dmarc@tuveloz.com`. Receipt is no longer in question — checked 2026-08-16, Google's aggregate reports do arrive (three on file, 08-08 through 08-12), and most are unread. Only the reader is missing, and until someone reads them the `rua` address is decorative and DMARC stays at `p=none` | hello@tuveloz.com | open |
| 2026-09-14 | Rotate the DKIM key for `updates.tuveloz.com` to 2048-bit; Resend issued the current 1024-bit default | hello@tuveloz.com | open |
| 2026-09-21 | Review a full month of DMARC aggregate reports and inventory every legitimate sender before any enforcement change | hello@tuveloz.com | open |
| 2026-10-05 | Fix the Workspace sender before any enforcement change: add a Google SPF include to the root `tuveloz.com` record and publish a Workspace DKIM selector. Mail sent from `hello@tuveloz.com` currently fails SPF and has no DKIM, so it fails DMARC on both. Confirmed 2026-08-16 that such mail really is sent to external recipients, which turns this from a contingency into a prerequisite for the row below | hello@tuveloz.com | open |
| 2026-10-19 | Move DMARC to `p=quarantine` — only after the report review above confirms every legitimate sender aligns **and** the Workspace sender fix has landed. Enforcing before that inventory sends real mail to spam, and enforcing before that fix sends the owner's own mail to spam | hello@tuveloz.com | open |
| 2026-09-21 | Decide whether staging should be able to send email at all. It cannot today by design, so no end-to-end email test is possible before merge. Enabling it needs a **separate** Resend key, never production's. The date is a review checkpoint alongside the DMARC report review, not a commitment to enable it | hello@tuveloz.com | open |
| 2026-08-09 | **(external)** Epidemic Sound licence window closed without Ad 01 being published. The renders and the track are deleted from the repository (2026-08-11); the visuals in `brand/ads/ad-01-assets/` are unaffected. To ship Ad 01, re-score it against a current licence and re-run `build-ad-01.ps1`. Do not restore the old audio from git history or R2 | hello@tuveloz.com | done |
| 2026-08-14 | Reword the homepage founding banner. It promised "first pick of jobs" and "own your corner of the county", which the founding program refuses in writing and `lib/founding-cohort.ts` bars in code. Fixed 2026-08-11 in English and Spanish | hello@tuveloz.com | done |
| 2026-08-07 | Merge the documentation branch (PR #98) into `main` so the structure is reachable from a fresh clone | hello@tuveloz.com | done |
| 2026-08-18 | Reconcile PR #97 against the merged #98 structure — #97 had to edit the existing `CLAUDE.md` and document index rather than add a parallel one. Done 2026-08-11 in #97: its parallel `CLAUDE.md`, `docs/INDEX.md`, and `docs/PITCH.md` were dropped and main's kept | hello@tuveloz.com | done |
| 2026-08-25 | When PR #97 lands, add its competitive landscape and provider classification documents to `README.md`, and its jurisdiction-scoped compliance rules to `CLAUDE.md`. Done 2026-08-11 in #97. The pitch row is satisfied by `brand/SALES_PITCH.md` from #104, which landed first and supersedes #97's own pitch draft | hello@tuveloz.com | done |
| 2026-09-08 | Take stock of which business documents already exist — insurance, LLC formation, EIN, Maryland registrations, licenses — and file a record card for each in `records/` | hello@tuveloz.com | open |
| 2026-09-15 | Add renewal dates to this table once the record cards exist, so expirations are actually tracked | hello@tuveloz.com | open |
| 2026-08-25 | Answer the 18 launch gates in `/admin/launch-readiness`. `npm run readiness` confirms production currently holds **zero** recorded decisions, so every gate is pending | hello@tuveloz.com | open |
| 2026-09-15 | Recheck the Search Console indexing report after Google recrawls `robots.txt` — the `/q/` short links should drop out of "Page with redirect". If they persist, the deploy did not carry the robots change | hello@tuveloz.com | open |
| 2026-09-15 | Add provider storefronts to `app/sitemap.ts` once they are public and worth finding; it currently lists 19 static pages and no `/providers/<slug>` at all. Date is a review checkpoint, not a commitment — the work is contingent on discovery opening | hello@tuveloz.com | open |
| 2026-09-03 | Run Zeo's real map sweep at home (`provider find` per trade and town) so the authoritative prospect store converges with the worklist's 11 web-sourced additions, and work Codex's falsification round from Zeo PR #105 (ZEO_CONSULT_LOG Challenge 003) | hello@tuveloz.com | open |
| 2026-09-05 | Contact the 11 storefront additions in `brand/outreach/moco-outreach-worklist.md` through each business's own contact form or phone, using the Zeo letter (`provider draft <id>` for each). Cold email stays off until the postal-address and Workspace SPF/DKIM rows above land | hello@tuveloz.com | open |
| 2026-09-10 | Send the first 25 personalized DMs from the refilled worklist — 5/day pacing per its anti-spam rules, with `docs/GPT-BRIEF-provider-outreach.md` pasted into ChatGPT as the personalization assistant | hello@tuveloz.com | open |

## Pull requests in flight

Merge order matters here and is not visible from the pull request list.

| Due | Item | Owner | Status |
| --- | --- | --- | --- |
| 2026-08-18 | Merge PR #95 **before** PR #96 — #96 is stacked on #95's branch, not on `main`. Done 2026-08-11: #95 landed as `27b551f`, then #96 as `a522de8`, in that order | hello@tuveloz.com | done |
| 2026-09-01 | Create the `tuveloz-app` repository. Done 2026-08-12: `willym249-dev/tuveloz-app` exists (private), with a new provider-first foundation merged as tuveloz-app#1 (`f379fd1`) — a replacement for #93's foundation, not an extraction of it; see the next row | hello@tuveloz.com | done |
| 2026-09-30 | **Never merge PR #93** — resolved 2026-08-27. Verified that `tuveloz-app`'s foundation is a replacement, not the planned extraction (0 of the 91 `mobile/` files exist there in any form); the head is preserved at branch `archive/firebase-supabase-app-foundation` (`fdbfc57`) and the record on #93 is corrected. The old `claude/tuveloz-project-foundation-k1rutr` ref remains as a harmless duplicate of the archive — sessions cannot delete branches (permission layer refuses destructive git, twice confirmed), nothing depends on removing it, and it needs no tracking; trash it from the branches page if it ever bothers anyone | hello@tuveloz.com | done |
| 2026-09-01 | Re-release Terms of Use and the Payment, Cancellation and Refund Policy so they carry the renamed Customer Service Fee. Done early, 2026-08-11 in #160: releases `terms-2026-08-11-r3` and `payment-policy-2026-08-11`, both hashes rebound to the deployed pages, and `PENDING_LEGAL_RELEASE` in the fee test is now empty | hello@tuveloz.com | done |
| 2026-09-30 | Re-cut the features stranded on PR #33 and PR #46. Done 2026-08-27 as three PRs re-authored from today's `main`: #179 maintenance reminders, #181 provider typical price ranges, #180 the owner AI request helper on the shared council. #33's catalog chunk was mostly superseded by the evolved eligibility matrix (tire, towing, and oil services already carry full evidence chains); the one remainder — a "minor repairs & maintenance" category — needs an owner decision on its evidence requirements before anyone builds it, so it is flagged in the row below, not built | hello@tuveloz.com | done |
| 2026-09-30 | Merge PR #179 **before** PR #181 — #181 is stacked on #179's branch so migrations 0066 and 0067 cannot hit the documented number-collision trap; #180 is independent of both | hello@tuveloz.com | open |
| — | Decide whether "minor repairs & maintenance" becomes a service category. It is the last piece of #33 and does not exist in `config/provider-eligibility-matrix.json`; adding a category means authoring its legal-evidence requirements, which is a reviewed compliance decision, not a config edit. Undated because it is optional scope, not a commitment | hello@tuveloz.com | open |

## Blocked on something outside the code

| Due | Item | Owner | Status |
| --- | --- | --- | --- |
| 2026-08-25 | `LAUNCH_UPDATES_POSTAL_ADDRESS` is empty, which keeps the launch-update sequence inert. Needed before the first real send, not sooner: as of 2026-08-11 the only subscriber is an owner test signup, so nobody real is waiting. A PO box or registered agent address is enough, and setting it delivers that test signup's first email — a free end-to-end check of a send path that has never run | hello@tuveloz.com | open |
| — | SMS sign-in is code-locked behind `PHONE_SMS_LIVE_MODE_ENABLED = false` in addition to its environment configuration. Undated on purpose: this describes a deliberate lock, not a commitment to unlock it | hello@tuveloz.com | open |

## Recurring reviews

These come around again rather than being finished once. When you complete one,
update the date to the next occurrence rather than marking it done.

| Due | Item | Owner | Status |
| --- | --- | --- | --- |
| 2026-09-30 | Annual legal review of the seven published policies — launch gates fail when a legal review is more than a year old, and no review is on record yet, so this is the first one rather than a renewal | hello@tuveloz.com | open |
| 2026-09-30 | Review insurance coverage against the services actually being offered. Replace this date with the carrier's real renewal date once the record card exists | hello@tuveloz.com | open |

## What belongs here versus elsewhere

This file holds commitments and deadlines. It is not a task list for code work,
and it is not a record of what happened — that is [`LOG.md`](LOG.md). A document
describing a real-world paper goes in [`records/`](records/), and its renewal
date gets a row here.
