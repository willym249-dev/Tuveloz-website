# Tuveloz — working notes for AI assistants

Read [`docs/AI-HANDOFF.md`](docs/AI-HANDOFF.md) first. It explains the business,
the architecture, and the current launch state in one self-contained page, and
it works equally well pasted into ChatGPT or Gemini. This file covers only what
you need to know before changing anything.

For the full document index, see [`docs/README.md`](docs/README.md). To file a
new document, see [`docs/FILING-GUIDE.md`](docs/FILING-GUIDE.md).

## The short version

Tuveloz is a vehicle-service marketplace for Montgomery County, Maryland,
running as a single Cloudflare Worker (Next.js 16 on `vinext`), with Cloudflare
D1 for data, R2 for uploads, and Stripe for payments. It is in onboarding-only
mode: applications are open, customer job posting and live payments are switched
off in code.

## Shared memory between sessions

Chat sessions do not remember each other. Two files carry context across them,
and keeping them current is part of the work, not an extra:

- [`docs/LOG.md`](docs/LOG.md) — what happened and what was decided, newest
  entry at the top.
- [`docs/OPEN-ITEMS.md`](docs/OPEN-ITEMS.md) — commitments and deadlines. A
  weekly workflow reads it and opens a GitHub issue when something is overdue or
  due within 30 days.

**Read the top of the log before you start** anything substantial. It tells you
what recently changed and what was left unfinished, which is usually not
obvious from the code.

**Write an entry before you finish** if something happened a future session
would be wrong not to know — a decision, a launch step, a policy or vendor
change, an incident, a change of direction. Skip it for routine edits; a log
padded with trivia stops being read.

**Anything with a deadline goes in `OPEN-ITEMS.md` with a real date.** Undated
rows are invisible to the automated check, so nothing will chase them. If the
user mentions a renewal, an expiration, or something they must not forget, add
the row rather than only replying about it.

## When you are asked to write or save a document

Anything meant to last — a plan, spec, research summary, decision record,
runbook, or set of notes — belongs in this repository as a Markdown file, not
only in the conversation. A chat window is not storage; the next session cannot
read it.

When the user asks you to save, write up, or "keep" something:

1. Put it in the right folder from
   [`docs/FILING-GUIDE.md`](docs/FILING-GUIDE.md) — `business`, `legal`,
   `operations`, `product`, or `records`.
2. Name it lowercase-with-hyphens, ending in `.md`.
3. Start it with the status header: status, owner, last reviewed, and a
   sentence saying what it is for.
4. Add a row for it in [`docs/README.md`](docs/README.md) saying what question
   it answers. A document missing from the index will not be found again.
5. Commit it. Uncommitted work disappears when the session ends.

If the user pastes in text that came from ChatGPT, Gemini, or another
assistant, file it exactly the same way and note where it came from in the
header. If a document on the same topic already exists, edit that one instead
of creating a near-duplicate.

Never file a document containing government identifiers, bank or account
numbers, tax documents, identity scans, API keys, or customer and provider
personal data. Those get a record card in `docs/records/` describing the
document instead, with the original kept outside this repository.

## Before you change something

**This codebase is intentionally fail-closed.** Services are denied unless
explicitly permitted, live payments are locked behind multiple independent
switches, and provider evidence stays quarantined until a scanner clears it.
When something does not work, the first explanation to consider is that a guard
is doing its job — not that the guard is wrong. Do not disable a check, loosen a
default-deny rule, or flip a live-mode switch to make a feature work. Those
decisions belong to a human with the legal and compliance context.

**Some files carry legal weight.** The seven policy pages under `app/` are
pinned to reviewed content hashes in `config/policy-releases.json`, and the test
suite fails the build if a released page's text changes without a new recorded
release. If you need to edit policy text, that is a process, not an edit.

**Business rules live in configuration, not prose.**
`config/provider-eligibility-matrix.json` decides which provider may perform
which service; `lib/launch-readiness.ts` holds the 18 go-live gates;
`lib/launch-status.ts` says whether the marketplace is open;
`lib/customer-fee.ts` defines the 5% customer service fee in one place. Change
the source, not a copy.

**Never commit secrets or personal data.** `.env.example` holds placeholders
only; real values go through `wrangler secret put`. Customer and provider
personal data, identity documents, and database exports do not belong in this
repository under any circumstances.

## Verifying your work

```bash
npm run lint
npm test        # full production build, then 62 test files
```

`npm test` builds before it tests, so it is slower than it looks but catches
build breakage. Deployment happens through GitHub Actions on push to `main`;
running `npm run deploy` by hand skips the release stamping and health
verification and is documented as emergency-only in `DEPLOYMENT.md`.

## Conventions

Existing code style is the guide — match the file you are editing. New
documentation files use lowercase-hyphenated names and start with the status
header described in the filing guide. Prefer editing an existing document over
adding a near-duplicate, and add a row to `docs/README.md` for anything new so
it can be found again.
