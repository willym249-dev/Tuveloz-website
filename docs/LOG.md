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

## 2026-08-07 — Put the whole site on the brand palette, fixed the logo, and named the policy documents correctly in signup

**The brand of record.** `brand/social-media-kit/README.md` is the authority:
the badge interior is brand **navy `#07182D`**, the page canvas is brand
**black `#050505`**, the accent is orange `#FF6A00`. Navy belongs to the badge
and to printed artwork — never to a page background. Read that file before
changing any colour.

**The logo was drawing itself twice.** `public/brand-badge.png` already contains
the orange keyline, the navy interior, and transparent rounded corners.
`.brand-mark` — the 40px mark in the header of every page — also painted a navy
fill and a second 2px inset orange keyline behind it, so the container's square
corners showed through the artwork's rounded ones and the two keylines sat at
different radii. `.mini-mark` had been corrected before; `.brand-mark` had not,
and `tests/brand-mark-consistency.test.mjs` only checked `.mini-mark`. The
container now contributes only the box and the outer glow, and that test covers
both marks.

**Everything off-brand navy is now brand black.** About 60 declarations across
`/account` (sign-in and the account dashboards), `.policy-shell` — which is all
seven legal pages — the customer workspace panels, the job-posting pause banner,
the staging banner, and the admin test lab. Also cleared the last pre-rebrand
pale-blue leftovers: the `.difference-icon` and `.pitch-icon` tiles on the
marketing pages, `.repeat-badge`, `.repeat-booking-banner`, and `--ink-2`.
A provider no longer crosses a colour seam going from `/join` to signing in to
reading the Terms.

**Still navy on purpose:** `.provider-business-card` and its QR panel,
`app/repair-records/repair-records.css`, and the printed job-authorization
document. Navy ink on white paper is correct brand usage; leave them.

**The signup consent row named the documents three different ways.** It
hand-wrote "Payment Policy", "Conduct Policy", and "Provider Pathway Policy",
while the acceptance record stores "Payment, Cancellation and Refund Policy",
"Marketplace Conduct and Review Policy", and "Provisional Provider and Trainee
Policy" — and the pages themselves carry a third set of titles. The row is now
generated from `PROVIDER_ACCEPTANCE_DOCUMENTS`, so each document appears under
the exact title and version the acceptance record stores, and it cannot drift
again. Providers can see they are accepting **Terms of Use version
2026-08-07-r2** — the courts-based version from the arbitration decision below.

**A consent bug went with it.** Those policy links sat *inside* the `<label>`
of the checkbox they belonged to, so clicking a policy to read it toggled the
agreement. The documents now sit outside the label. The two acceptance texts
themselves are untouched, and the visible checkbox label is now exactly the
`presentedText` that gets recorded — it used to carry an extra "Review the …"
sentence that the record never contained.

**Verified about the terms change.** The arbitration decision (PR #103) is fully
propagated: `TERMS_VERSION` is `2026-08-07-r2`, the hash-bound release
`terms-2026-08-07-r2` is active, the clause is preserved in
`docs/ARBITRATION_CLAUSE_RESERVE.md`, and nothing outside the Terms page and
that reserve file mentions arbitration. Privacy and Payment show a version
older than their release id; that is the convention, not a gap — the version
tracks content and both were bumped when their content last changed.

**Two things left for a human with the legal context.** The acceptance record's
title for two documents does not match the page it opens: the record says
"Marketplace Conduct and Review Policy" where the page is titled "Marketplace
Conduct Policy", and "Payment, Cancellation and Refund Policy" where the page
is "Payment, Cancellation, and Refund Policy". Both are recorded in immutable
acceptance evidence and the pages are hash-pinned, so aligning them is a
release process, not an edit. Nothing blocks signup meanwhile — the checkbox
text and the document list now agree with each other.

## 2026-08-07 — Redesigned the provider signup and the quote composer

**What happened.** The two screens a provider judges us by — applying to join,
and quoting a job — were the last places still wearing the pre-rebrand light
theme, and several structural classes had never been styled at all. Visual
only: nothing about what is asked, required, gated, or disclosed changed, and
no guard was touched.

**What was actually wrong.** `.step-indicator`, `.hint`, and `.form-nav` had no
CSS in the stylesheet, so the progress steps rendered as three runs of plain
text, every piece of helper text rendered at body size, and Back and Continue
stacked as two full-width blocks. The service picker, fieldsets, business
disclosure, legal-help bubble, and requirement `select`s were still white,
slate, and navy on a near-black form; the badge for the provider mode and the
focus ring on every input on the site were still the old blue. The requirements
step had no heading when a selection produced legal questions but no documents,
and the step error rendered above the heading instead of next to the control it
blocked.

**What replaced it.** A numbered progress track with done/current states; the
whole provider path rethemed to the black-and-orange system; selected services
visibly selected with a running "3 services selected" chip strip you can remove
from; a 12–13px floor on helper text that was 9–10px; two-column grids dropped
to one where the form column is only ~500px wide. The quote composer is now a
framed panel with a heading, real labels on the availability and scope fields
(they were placeholder-only), a `$`-prefixed money field, and a live restatement
of what the provider is paid versus what the customer is shown, computed from
`lib/customer-fee.ts`. That last panel reads only the provider's own entry — it
does not propose, cap, or suggest an amount, which the never-build list forbids.

**Left alone, worth knowing.** `/account` — the sign-in page in the middle of
the provider journey — is still on its own navy palette rather than the site
theme, so a provider moving from `/join` to signing in crosses a visible seam.
The customer request form shares the classes rethemed here and improves with
them, but it cannot be seen while job posting is paused.

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
