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

## 2026-08-11 — The archived ad work is on main, and one archive tag is gone

**Why this happened.** Deleting `ads/got-this-series` left 21 files reachable
only through a git tag. That is safe but not discoverable: nobody browsing the
repository would find the ad build pipeline, and the whole set sat one lost tag
away from gone. Both halves have now landed on main.

**#132 — the build pipeline.** The three ffmpeg build scripts, the ep1-battery
source audio, the shared lockups and tagline VO, `R2-MANIFEST.json`, and
`scripts/r2-video-manifest.mjs` that regenerates it. Twelve files, about 324KB.
These are the pipeline's *inputs*; the 57 rendered MP4s stay out of git under
the ignore rules from #127, with the private `tuveloz-brand-video` bucket as
the durable copy.

**A regression that was caught in the restore.** Checking out `brand/ads` from
the tag also overwrote `brand/ads/HANDOFF.md`, whose tagged version carries an
older fee line reading `NEVER say "keep 95%"` — while main already had the
fuller wording about never expressing the customer fee as a provider deduction.
That file was reverted so main's version stands. Restoring a directory from an
old ref silently reverts every file in it that has moved on since; check the
modified list, not just the added one.

**#134 — the documents and remaining assets.** The counterweight-clip shoot
script and its how-to, the "I've Got This" creative spec, the Higgsfield
runbook, the no-strap lockup, a favicon variant, and the three cross-assistant
handoff documents from 2026-08-08. Restored verbatim rather than renamed:
three of them break the lowercase-hyphenated convention and none carry a status
header, but the runbook links to the ideas file by its URL-encoded name and
both briefs point at `SESSION-HANDOFF.md`, so renaming breaks the set.
Normalizing names and adding headers is still open, as its own pass.
`docs/README.md` gained a row for `docs/marketing/` and a **Historical**
heading for the three handoff documents, which are a record of how work was
split that day and not current instruction.

**`archive/got-this-series` is deleted.** Nothing was orphaned by that, for a
structural reason worth remembering: `archive/got-this-series-wip` points at
`858b2d1`, whose parent *is* `0808b9b`, so the old branch tip stays reachable
through the surviving tag. Files unique to that tag versus main are now zero.

**`archive/got-this-series-wip` must stay.** It is the only thing holding 18
files of working-tree state that were never committed to any branch. Recover
with `git switch -c ads-restore archive/got-this-series-wip`.

**Fee copy was checked before landing**, since these are marketing documents.
Every mention states the rule correctly or forbids "keep 95%"; no legacy 10%
copy survived anywhere in the set.

---

## 2026-08-10 — Zeo was answering without most of its own rules

**Why this is here.** Zeo is the owner's local assistant and it reads Tuveloz
under a read-only workspace. Its answers about this project were being produced
without most of its behaviour policy, so anything it said today or earlier is
worth re-checking rather than trusted. The work itself is in the Zeo repository
(`C:\Users\Torta Pounder\Zeo`), sixteen commits, written up in
`ZEO_LOCAL_MODEL_BEHAVIOUR.md` there.

**What happened.** The local runner keeps roughly 2k tokens of context by
default and discards the overflow without an error. Zeo's system prompt is
about 4805 tokens, so a question carrying project excerpts arrived with most of
the policy removed — measured directly: `prompt_eval_count` 2050 against a
4805-token prompt. Not only formatting rules were lost but never invent facts,
owner corrections outrank older memory, and the security boundaries. The symptom
that exposed it was two different system prompts producing byte-identical
replies. `num_ctx` is now always sent.

**What else that uncovered.** The Tuveloz project-context path had its own
standalone prompt and so never carried the general answering rules at all; it
now does, and its reply cap moved from 850 to 1200 characters. A reply to a
question with no project context attached ended "Checked read-only project
context: None applicable." — a claim to have run a file check that never ran,
copied from the shape of earlier replies. Model-authored versions of that
footer are now stripped; only code may state which files were read.

**Decisions made.** Answers that must follow a format are no longer requested
as prose. The runner constrains generation to a JSON schema, the model fills in
fields, and code writes the format — for choice lists and for code edits alike.
The model's indentation is discarded outright rather than validated, because
one measured edit was valid Python that quietly lifted a statement out of its
loop, which a syntax check passes. No hardware was needed; the constraint was
never the model's instruction-following.

**Now open.** Nothing Tuveloz-side is blocked. Worth knowing when Zeo is used
for project questions: it reads only the approved excerpt list, and its answer
is only as current as those files.

---

## 2026-08-10 — Signup step 1 shows the document count, and the ads branch is archived and gone

**What shipped.** Step 1 of the provider application now names how many
documents the selected services require, before the form asks for an email.
Previously that only appeared on step 2. The count is **distinct documents**,
not rendered checklist rows: two services can require the same document and
step 2 draws it once per group, so summing the per-service lists overstates
what actually gets uploaded. The copy reads "unique documents" so the smaller
number does not look like a contradiction of those repeated rows. Live at
`/join`, English and Spanish. Merged as #126, with #127 alongside it.

**Deliberately not shipped: a time estimate.** An earlier draft paired the
count with "about 10–15 minutes." That was dropped because the flow has never
been measured. The same reasoning removed an unmeasured "set it up in minutes"
line from provider toolkit copy on the old branch, though main had already
deleted that copy independently. If the duration is ever measured, the step 1
note is where it belongs.

**`ads/got-this-series` is deleted.** It was 121 commits behind main and
already superseded by #119, and a dry-run merge conflicted in ~28 files
including `drizzle/meta/_journal.json`. Its code features had all reached main
separately, but **21 files existed nowhere else** — the `brand/ads` build
pipeline and ep1-battery audio, `scripts/r2-video-manifest.mjs`, the Higgsfield
runbook and marketing docs, two brand SVGs. Nothing was lost; two tags hold it:

| Tag | Commit | Holds |
| --- | --- | --- |
| `archive/got-this-series` | `0808b9b` | the branch tip, all 21 unique files |
| `archive/got-this-series-wip` | `858b2d1` | that tip plus 18 uncommitted working-tree files (+299/−101) committed at deletion |

**Superseded 2026-08-11 — do not use the table above as a recovery path.** All
21 files are on main, and `archive/got-this-series` has been deleted. Only
`archive/got-this-series-wip` still exists; it descends from `0808b9b`, so the
old branch tip is still reachable through it. See the entry at the top of this
log.

**A trap that nearly cost the ad videos.** The deleted branch's `.gitignore`
ignored `brand/ads/*.mp4` and `brand/ads/got-this-assets/**/*.mp4`; main never
had those rules. Switching a checkout to main therefore left all 57 rendered
MP4s untracked and stageable, one `git add -A` away from committing ~50MB of
build output into permanent history and reversing the move to private R2. #127
ports the rules. The videos remain on disk and in the `tuveloz-brand-video`
bucket, with checksums in `brand/ads/R2-MANIFEST.json`.

**Two verification traps worth remembering.** `npm run i18n:check` reports on
whatever dev server is listening, not your checkout — it was run against a
server started from the branch's own worktree on a dedicated port, after
confirming the lineage. And `git merge-base --is-ancestor` called both merged
PR branches *unmerged*, because GitHub squash-merges: the branch tips never
become ancestors of main. Deleting them safely meant diffing content against
main instead, which is the check to use here.

**Production.** Both merges deployed clean. `wrangler d1 migrations apply`
reported "No migrations to apply!", so production D1 was untouched. Health
reports application, database, and schema ready, and the launch locks are
unchanged: `onboarding_only`, accounts and provider applications open,
customer job requests and payments closed.

---

## 2026-08-10 — Phone-to-Zeo remote access, and why the Tailscale invite failed

**What happened.** The Tailscale "share a device" invite for `zeo-home` kept
returning `Failed to accept invite`. Cause: the invite was sent from
hello@tuveloz.com to hello@tuveloz.com. Device sharing crosses accounts; you
cannot share a device with the account that already owns it. The phone does not
need a share at all — signing it in to Tailscale with the same account puts it
in the same tailnet and `zeo-home` appears on its own.

**Written up** in
[`operations/zeo-remote-access-tailscale.md`](operations/zeo-remote-access-tailscale.md):
the working procedure, an ordered fault list (the usual real cause is a service
bound to `127.0.0.1` rather than anything to do with Tailscale), and the rule
that Zeo stays inside the tailnet — `tailscale serve`, never `tailscale funnel`.

Nothing in the Tuveloz application depends on any of this.

---

## 2026-08-11 — Gave the open items real dates, so the weekly check can work

**What happened.** Every row in `OPEN-ITEMS.md` was undated, which meant the
Monday deadline workflow had nothing to report and the readiness command's
deadline section always came back clean. Dated 14 of the 16 rows and corrected
the ones that had gone stale against the actual pull-request state: PR #98
merged on 2026-08-07 and is now marked done, PR #33 and PR #46 are both closed
so their stranded work only exists on their branches, and the launch-gate row
now says what `npm run readiness` found rather than asking someone to go look.
The `tuveloz-app` repository creation was split out as its own `blocked` row,
because the move of `mobile/` cannot start until it exists.

**Decisions made.** The dates are self-set targets, and the file now says so —
they are there to make the automated check function, not because an outside
party imposed them. Two exceptions are called out: the recurring reviews are
dated against launch gates that fail once a legal review is over a year old,
and the insurance row carries a placeholder to be replaced with the carrier's
real renewal date once a record card exists. The SMS sign-in row stays undated
on purpose — it describes a deliberate lock, not a commitment to unlock it.

**Now open.** Eight items now fall inside the 30-day window, so the Monday
workflow will start opening a GitHub issue where it previously found nothing.
That is the intended behaviour, not a regression.

---

## 2026-08-10 — One command that reports what Tuveloz still needs

**What happened.** Added `npm run readiness` (`scripts/check-readiness.mjs`),
which collects into a single report the four things that previously had to be
checked in four places: the three marketplace locks read from source, the 18
launch gates read from the catalogue in `lib/launch-readiness.ts` against the
decisions recorded in production D1, `.env.example` compared against the
deployed Worker's vars and secrets, and the deadline table, by running the
existing `scripts/check-deadlines.mjs`. Flags: `--offline` skips the two
Cloudflare reads, `--json` emits the same data as JSON, `--strict` exits 1 when
something required is outstanding.

**What the first run found.** Production has **zero** launch-gate decisions
recorded, so all 18 gates are pending — including the ones only an outside
authority can answer (insurance carrier, CPA, payment processor). Three
required configuration values are unset: `LAUNCH_UPDATES_POSTAL_ADDRESS` and
`IDENTITY_VERIFICATION_PROVIDERS` are declared empty in `wrangler.jsonc`, and
`STRIPE_CONNECTED_ACCOUNT_WEBHOOK_SECRET` has neither a var nor a secret.
Nothing is overdue in `OPEN-ITEMS.md`, but every row there is undated, so that
is not reassurance.

**Decisions made.** The report reads and never writes. Gates are answered by
the owner in `/admin/launch-readiness` and nowhere else; the script cannot
record a decision, and the marketplace locks are printed as context with a note
that nothing in the report is a reason to change one. Keys that are only needed
once a related subsystem is switched on — the two evidence-scanner secrets,
while `EVIDENCE_SCAN_PROVIDER` is `unconfigured` — are reported as not yet
needed rather than counted as gaps, so a deliberately fail-closed subsystem
does not read as broken.

**Now open.** The gate decisions and the postal address are owner and
third-party work, not code. Adding real dates to `OPEN-ITEMS.md` would make the
deadline section of this report meaningful rather than always clean.

---

## 2026-08-09 — Locked the 5% customer-fee copy against regression

**What happened.** Audited the current production release and the source on
`main` after stale indexed pages exposed older 10% fee language. Cache-bypassed
production responses for the homepage, payment policy, provider agreement,
terms, customer agreement, provider signup, and post-job page contained no 10%
customer-fee claims. Production was serving the same commit as `main`.

**Decisions made.** The invariant is explicit for every assistant and every
copy surface: customers pay a 5% service fee, providers keep 100% of what they
quote, legacy 10% language is a defect, and the customer fee must never be
expressed as a deduction from provider earnings. A focused test now fails the
build if either forbidden claim returns in application, brand, AI-policy, or
assistant-handoff copy.

**Now open.** Search-engine and crawler snapshots may continue showing an old
version until they recrawl; production itself is current.

---

## 2026-08-08 — Homepage made launch-honest and shorter

**What happened.** Reworked the customer-facing hero on the homepage and customer lander so it no longer implies that live customer quotes are available today. Both now say that accounts are open while requests wait for adequate provider coverage. Added a clear “Need help today?” route to local shops, mobile mechanics, or licensed towing while dispatch is unavailable. Added a planned-fee example that labels final launch pricing and tax treatment as under review.

**Decisions made.** The homepage no longer uses provider counts, invented traction, or review substitutes as startup proof. It now focuses on customer choice, provider independence, documented service-specific requirements, and an honest launch state. The long provider-application, review, request, expansion, and feedback sections remain available on their dedicated pages or the About page instead of competing on the homepage.

**Now open.** Decide which first-wave local SEO pages to publish while customer requests remain closed. Any service page must be informational and collect launch interest rather than imply a live booking or quote turnaround.

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
