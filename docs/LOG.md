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

## 2026-08-07 — Public pages no longer look like a sign-out to a signed-in visitor

**What happened.** A signed-in customer who clicked "Customer launch status" in
their workspace landed on `/post-job` and saw "Sign in", "Save my spot — free"
in the header, and a second "Save my spot — free" in the launch banner, with no
link back to their account. It read as being signed out.

**No session was ever destroyed.** Verified in a browser against a real seeded
session: the cookie survives, `/api/account` keeps returning 200, and the
workspace is still there on the way back. Cookies are cleared only by
`/api/auth/logout`. The whole thing was wording. Before chasing an auth bug
here, check whether the page simply never asks who is looking at it.

**Reproduce it the same way.** Put `AUTH_CODE_SECRET` in `.dev.vars`, run
`npm run db:migrate:local` and `npm run dev`, insert an `account_credentials`
row plus an `auth_sessions` row whose `token_hash` is
`HMAC-SHA256("session:" + token)` under that secret, then drive the site with
that token as the `tuveloz_session` cookie. Reading the source was what produced
the wrong answer twice; the browser produced the right one in minutes.

**What changed.** Four public surfaces asked nothing about the session and have
been made to ask, all sharing one lookup in
`app/components/account-header-state.ts`: `PublicSiteHeader`, the site-wide
`JobPostingPauseNotice` banner (which was inviting people to create an account
on the signed-in dashboard itself), every "Save my spot — free" call to action
via the new `SaveMySpotButton`, and a `SignedInReturnNote` at the top of the
launch status page giving an explicit route back. Signed-out visitors and
crawlers see exactly what they saw before.

**Two things worth knowing about the shared lookup.** It is a
`useSyncExternalStore` store with one in-flight request, because the naive
version fired five `/api/account` requests per page — one per component. And it
caches in `sessionStorage`, primed by the customer and provider workspaces and
retired on sign-out, which is what removes the visible flash of signed-out
wording when arriving from a workspace. A cold load in a fresh tab still shows
the signed-out header for the length of one request; that is the correct default
for the visitor who is actually signed out.

**A second, real sign-out is fixed as a side effect.** Sessions carry a
30-minute idle timeout refreshed only when a route calls `getAccountSession`.
Public pages called nothing, so reading them for half an hour genuinely expired
the session. The header lookup now touches it on every public page load.

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
