# Open items and deadlines

- **Status:** active
- **Owner:** hello@tuveloz.com
- **Last reviewed:** 2026-08-11

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
| 2026-08-07 | Merge the documentation branch (PR #98) into `main` so the structure is reachable from a fresh clone | hello@tuveloz.com | done |
| 2026-08-18 | Reconcile PR #97 against the merged #98 structure — #97 must edit the existing `CLAUDE.md` and document index rather than adding a parallel one | hello@tuveloz.com | open |
| 2026-08-25 | When PR #97 lands, add its pitch, competitive landscape, and provider classification documents to `README.md`, and add its jurisdiction-scoped compliance rules to `CLAUDE.md` | hello@tuveloz.com | open |
| 2026-09-08 | Take stock of which business documents already exist — insurance, LLC formation, EIN, Maryland registrations, licenses — and file a record card for each in `records/` | hello@tuveloz.com | open |
| 2026-09-15 | Add renewal dates to this table once the record cards exist, so expirations are actually tracked | hello@tuveloz.com | open |
| 2026-08-25 | Answer the 18 launch gates in `/admin/launch-readiness`. `npm run readiness` confirms production currently holds **zero** recorded decisions, so every gate is pending | hello@tuveloz.com | open |
| 2026-09-15 | Recheck the Search Console indexing report after Google recrawls `robots.txt` — the `/q/` short links should drop out of "Page with redirect". If they persist, the deploy did not carry the robots change | hello@tuveloz.com | open |
| 2026-09-15 | Add provider storefronts to `app/sitemap.ts` once they are public and worth finding; it currently lists 19 static pages and no `/providers/<slug>` at all. Date is a review checkpoint, not a commitment — the work is contingent on discovery opening | hello@tuveloz.com | open |

## Pull requests in flight

Merge order matters here and is not visible from the pull request list.

| Due | Item | Owner | Status |
| --- | --- | --- | --- |
| 2026-08-18 | Merge PR #95 **before** PR #96 — #96 is stacked on #95's branch, not on `main` | hello@tuveloz.com | open |
| 2026-09-01 | Create the `tuveloz-app` repository. The earlier attempt failed with `403 Resource not accessible by integration`, so it needs owner permissions rather than another attempt from a session | hello@tuveloz.com | blocked |
| 2026-09-30 | **Never merge PR #93.** Once `tuveloz-app` exists, move `mobile/` there following `mobile/docs/EXTRACTION.md`, then close #93, delete its branch, and remove the temporary "Related project" pointer from the root `README.md` | hello@tuveloz.com | open |
| 2026-09-01 | Re-release Terms of Use and the Payment, Cancellation and Refund Policy so they carry the renamed Customer Service Fee; both are SHA-pinned, so this is an owner-approved release, not an edit (tracked by a test in #95 that fails once they are re-released) | hello@tuveloz.com | open |
| 2026-09-30 | Re-cut the features stranded on PR #33 and PR #46. Both pull requests are now closed, so the work only exists as whatever survives on their branches | hello@tuveloz.com | open |

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
