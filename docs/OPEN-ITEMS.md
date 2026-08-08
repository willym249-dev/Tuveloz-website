# Open items and deadlines

- **Status:** active
- **Owner:** hello@tuveloz.com
- **Last reviewed:** 2026-08-06

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

**Two kinds of date live in this table, and the difference matters when one
slips.** A few are *external* — someone else set them and they do not move: a
license window, a policy expiration, a renewal. The rest are *self-set targets*,
chosen so the Monday check has something to bite on. Missing a self-set target
costs nothing but a re-plan; missing an external one costs money or blocks a
launch gate. External deadlines are marked **(external)** in the item text.
Anything without that marker is a target you can move — but move it
deliberately, rather than letting it go quietly overdue.

When you close something significant, write a matching entry in
[`LOG.md`](LOG.md) so the reasoning survives.

## Items

| Due | Item | Owner | Status |
| --- | --- | --- | --- |
| 2026-08-09 | **(external)** Epidemic Sound license window closes. Ad 01's track "On My Way (Instrumental Version)" was downloaded under a canceled Pro plan; publish before this date or reactivate the subscription. See `brand/ads/HANDOFF.md` | hello@tuveloz.com | open |
| 2026-08-07 | Merge the documentation branch (PR #98) into `main` so the structure is reachable from a fresh clone | hello@tuveloz.com | done |
| 2026-08-14 | Reconcile PR #97 against the `CLAUDE.md` now on `main` — #98 merged first, so #97 drops its own `CLAUDE.md` and index and folds its constraint sections in | hello@tuveloz.com | open |
| 2026-08-14 | Reword the homepage founding banner. It promises "first pick of jobs," which the founding program refuses in writing and `lib/founding-cohort.ts` bars in code. Must land before any paid provider traffic points at it | hello@tuveloz.com | open |
| 2026-08-14 | When PR #97 lands, add its pitch, competitive landscape, and provider classification documents to `README.md`, and add its jurisdiction-scoped compliance rules to `CLAUDE.md` | hello@tuveloz.com | open |
| 2026-08-31 | Take stock of which business documents already exist — insurance, LLC formation, EIN, Maryland registrations, licenses — and file a record card for each in `records/` | hello@tuveloz.com | open |
| 2026-09-07 | Add renewal dates to this table once the record cards exist, so expirations are actually tracked | hello@tuveloz.com | open |
| 2026-08-21 | Confirm the current state of the 18 launch gates in the owner dashboard; the decisions live in the database, not in this repository | hello@tuveloz.com | open |

## Pull requests in flight

Merge order matters here and is not visible from the pull request list.

| Due | Item | Owner | Status |
| --- | --- | --- | --- |
| 2026-08-14 | Merge PR #95 **before** PR #96 — #96 is stacked on #95's branch, not on `main` | hello@tuveloz.com | open |
| — | **Never merge PR #93.** Create the `tuveloz-app` repository, move `mobile/` there following `mobile/docs/EXTRACTION.md`, then close #93, delete its branch, and remove the temporary "Related project" pointer from the root `README.md` | hello@tuveloz.com | open |
| — | Repository creation for `tuveloz-app` previously failed with `403 Resource not accessible by integration` — it needs owner permissions, not another attempt from a session | hello@tuveloz.com | open |
| 2026-08-21 | Re-release Terms of Use and the Payment, Cancellation and Refund Policy so they carry the renamed Customer Service Fee; both are SHA-pinned, so this is an owner-approved release, not an edit (tracked by a test in #95 that fails once they are re-released) | hello@tuveloz.com | open |
| — | Re-cut the features stranded on PR #33's unmergeable branch, and PR #46 | hello@tuveloz.com | open |

## Blocked on something outside the code

| Due | Item | Owner | Status |
| --- | --- | --- | --- |
| 2026-08-21 | `LAUNCH_UPDATES_POSTAL_ADDRESS` is empty, which keeps the launch-update email sequence inert. Marketing email cannot send without a physical postal address | hello@tuveloz.com | open |
| — | SMS sign-in is code-locked behind `PHONE_SMS_LIVE_MODE_ENABLED = false` in addition to its environment configuration | hello@tuveloz.com | open |

## Recurring reviews

These come around again rather than being finished once. When you complete one,
update the date to the next occurrence rather than marking it done.

| Due | Item | Owner | Status |
| --- | --- | --- | --- |
| 2026-08-31 | Establish the real date of the last legal review of the seven published policies and put it here as a dated annual row. Launch gates fail when a legal review is more than a year old, so an undated row here is a gate that fails without warning | hello@tuveloz.com | open |
| — | Annual legal review of the seven published policies — undated until the row above establishes when the clock started | hello@tuveloz.com | open |
| 2026-08-31 | Establish the insurance renewal date from the policy documents and replace the row below with a dated annual one | hello@tuveloz.com | open |
| — | Review insurance coverage against the services actually being offered | hello@tuveloz.com | open |

## What belongs here versus elsewhere

This file holds commitments and deadlines. It is not a task list for code work,
and it is not a record of what happened — that is [`LOG.md`](LOG.md). A document
describing a real-world paper goes in [`records/`](records/), and its renewal
date gets a row here.
