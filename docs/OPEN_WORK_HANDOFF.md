# Tuveloz open-work handoff

Written 2026-08-05. This records work that is started, blocked, or decided but
not yet done, so it can be picked up later without re-deriving it. It is not a
launch approval and it does not change any launch gate.

## Where main stands

Main is at `407ed6a`. Lint is clean apart from one long-standing `<img>` warning
in `app/components/tuveloz-icons.tsx`. The migration journal holds 54 contiguous
entries ending `0053_launch_update_subscribers`. There are no open pull
requests.

Merged and deployed to production on 2026-08-05, each verified green through
migrations and the live-release check:

| PR | What it added |
| --- | --- |
| #81 | Per-service provider levels — a credential row is checked against the level its own service requires, not the profile's summary level |
| #85 | Provider recruitment copy, the Parts Checklist tool, and first-party A/B experiments |
| #89 | Pre-launch growth: audience playbook, founding provider cohort, spotlight kit, owned launch-update email list |
| #83 | MoCo provider outreach worklist (docs) |
| #84 | v3 provider-recruitment reel kit (docs) |
| #80 | Customer "requests open soon" notice, rendered behind the existing pause flag |

## In flight

### Owner alert for exhausted email deliveries

Branch `claude/work-priorities-wzooqm`, commit `ecd4841`. Lint clean, 324 tests
pass. Not merged.

A queued notification that used all five delivery attempts was dropped from
every later retry batch with nothing announcing it, so a protective message —
an account alert, a compliance notice — could stop retrying for good and the
only way to find out was to read the outbox by hand. The change raises an owner
incident on the attempt that exhausts a row, and separates `exhausted` from
`failed` in the owner dashboard because email is the wrong channel to report
broken email.

Deliberately left alone: mail suppressed while the marketplace is paused never
increments its attempt count, so it cannot raise these incidents. That
suppression is intended and out of scope here.

## Blocked on someone outside the codebase

### The launch-update email list sends nothing

`LAUNCH_UPDATES_POSTAL_ADDRESS` is deployed as an empty string in
`wrangler.jsonc`. US commercial email must carry the sender's physical mailing
address, so the sequence fails closed: while the value is empty it sends nothing
and logs why, rather than mailing without it. A PO box or registered agent
address is enough. Everything else about the list shipped in #89 and works.

This is the single step between the owned email list existing and it being
usable.

### SMS sign-in is code-locked off

Shipped in #88 and off by default: `PHONE_SMS_LIVE_MODE_ENABLED = false` in
`lib/phone-auth.ts`, plus four required secrets (`SMS_PROVIDER`, `SMS_API_URL`,
`SMS_API_KEY`, `SMS_SENDER_ID`). No text reaches anyone until both the lock is
released and every secret is present.

### Launch gates

`CUSTOMER_JOB_POSTING_PAUSED = true` and `MARKETPLACE_MODE = "onboarding_only"`.
Nothing merged on 2026-08-05 changed either. The remaining blockers are the
external approvals tracked in `PROVIDER_ACTIVATION_RUNBOOK.md` and
`INTEGRATED_REVIEW_CHECKLIST.md`. For #41 (Maryland invoice records, built via
merged PR #45) only an external provider-registration step remains.

## To be re-cut from main

These were closed rather than fixed, because their branches cannot be merged.
The features are still wanted; the branches are not recoverable.

### From #33

- Provider typical price ranges
- Private maintenance-reminder workspace
- Catalog gaps: oil-change, minor-repair, and tire matching

Closed for unrelated git history plus a collision on migration 0037.

### From #46 — owner-only AI request helper

Closed 2026-08-05. Its branch shares no merge base with main: it descends from
root commit `9d4e09f` while main descends from `d15b26d`, so
`git merge-base` returns nothing and rebasing cannot help.

Worth knowing before assuming it is redundant: main's `lib/ai/` is the AI
council dev tooling, and the customer assistant shipped in #87 at `/ai` is
customer-facing. Neither provides the owner-side request-drafting helper, so
this feature is genuinely unshipped. If it is re-cut, carry over the fail-closed
posture (`TUVELOZ_AI_ENABLED=false` by default, key stored only via
`wrangler secret put`), owner verification, same-origin enforcement, and the
no-write safety boundary.

## Two traps that have now bitten three times

**Migration numbers collide silently.** Any branch cut before a migration lands
on main will claim a number that is already taken, and nothing surfaces it until
the merge. This closed #33, and #89 arrived with the same defect — it claimed
`0051` while main had `0051_sms_phone_sign_in`, and was renumbered to 0052/0053
before merging. Before merging any older branch, check whether it adds anything
under `drizzle/` and compare against `drizzle/meta/_journal.json`. The
migration-history guard test must be updated in the same change.

**Generated snapshots past 0047 are worse than none.** Main deliberately keeps
no drizzle snapshots after `0047`. #89 shipped two that were generated before
#88 merged, so they omitted the phone/sms tables; as the newest lineage point
they would have made the next `drizzle-kit generate` try to re-create those
tables. They were dropped rather than renumbered. Migrations here are
hand-written — leave the snapshot drift alone.

**Assertions that pin "the newest entry" break the next migration.** #88 asserted
that `0051_sms_phone_sign_in` was the last journal entry, which any later
migration would have broken. It is now pinned by index instead. Prefer that.
