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

When you close something significant, write a matching entry in
[`LOG.md`](LOG.md) so the reasoning survives.

## Items

| Due | Item | Owner | Status |
| --- | --- | --- | --- |
| — | Merge the documentation branch into `main` so the structure is reachable from a fresh clone | hello@tuveloz.com | open |
| — | Take stock of which business documents already exist — insurance, LLC formation, EIN, Maryland registrations, licenses — and file a record card for each in `records/` | hello@tuveloz.com | open |
| — | Add renewal dates to this table once the record cards exist, so expirations are actually tracked | hello@tuveloz.com | open |
| — | Confirm the current state of the 18 launch gates in the owner dashboard; the decisions live in the database, not in this repository | hello@tuveloz.com | open |

## Recurring reviews

These come around again rather than being finished once. When you complete one,
update the date to the next occurrence rather than marking it done.

| Due | Item | Owner | Status |
| --- | --- | --- | --- |
| — | Annual legal review of the seven published policies — launch gates fail when a legal review is more than a year old | hello@tuveloz.com | open |
| — | Review insurance coverage against the services actually being offered | hello@tuveloz.com | open |

## What belongs here versus elsewhere

This file holds commitments and deadlines. It is not a task list for code work,
and it is not a record of what happened — that is [`LOG.md`](LOG.md). A document
describing a real-world paper goes in [`records/`](records/), and its renewal
date gets a row here.
