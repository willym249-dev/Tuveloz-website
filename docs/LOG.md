# Working log

- **Status:** active
- **Owner:** hello@tuveloz.com
- **Last reviewed:** 2026-08-06

This is the shared memory between every chat session, tool, and person working
on Tuveloz. A conversation ends and takes its context with it; this file is what
survives.

**Newest entry goes at the top**, directly under this line. Read the top few
entries to catch up. Write one before you finish.

---

## 2026-08-07 — Campaign attribution, and an August posting queue

**What happened.** Asked what to post on Instagram and TikTok right now. Three
things came out of it.

**The playbook was asking for a number nothing produced.** The audience growth
playbook says to watch "provider applications, by source." That was not
measurable: `analytics_events.props` accepted arbitrary JSON and the A/B system
wrote copy variants into it, but nothing ever recorded where a visitor came
from, so every application looked identical no matter which post produced it.
Platform view counts cannot close that gap — they can say a reel was watched,
never that a watcher applied. Added `lib/campaign-source.ts` (reads `?src=` off
the inbound link, first-touch, localStorage, same shape as `lib/experiments.ts`),
stamped it onto `provider_signup_started` and `provider_signup_completed`, and
added a "Where applications came from" table to `/admin/analytics-funnel`
alongside the existing copy experiments. First touch wins deliberately: someone
who sees a reel, leaves, and returns directly a week later is still that reel's
application. Untagged visitors are shown as their own row rather than dropped,
so the numbers reconcile with the funnel above them.

**The posting queue is `brand/outreach/post-now-august-2026.md`.** Four posts,
two weeks, with a dated trend read and a two-week test design. The governing
constraint is that customer job posting is paused, so everything is aimed at
providers — a customer who taps through a great reel today finds a door that
does not open, and that is the hardest audience to win back at launch. Top pick
is the "Preparing for my Netflix documentary" format, because it is a confession
format and we have a real confession to make: we are not open yet, on purpose.
When these trends go stale, replace that file rather than adding a fourth one
next to it.

**Ad 03 is half-built and blocked on credits.** Generated the hero frame for the
"This could be your Tuesday" reel that `reel-provider-recruitment-v3.md` specced
but never rendered. It cost 130 credits and the plan only had 140 — down from
the 15,960 recorded on 2026-08-04 — leaving 10, which is not enough for the
image-to-video pass. Plan renews 2026-09-04. Recorded in
`brand/ads/tuesday-reel-ad-03.md` with the generation ID and prompt so it can be
finished rather than regenerated. Two lessons: generate hero frames at 1K on a
cheaper model and save the budget for the video pass, and note that this
environment's network policy denies `artlist.io` hosts (403 on CONNECT), so
generated files still have to be downloaded manually — the same manual step
`brand/ads/HANDOFF.md` already records for ad 01.

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
