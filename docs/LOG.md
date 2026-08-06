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
