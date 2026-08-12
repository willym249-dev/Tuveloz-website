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

**Check for concurrent work before starting anything small.** The log records
finished work; work in flight lives in open pull requests, and nothing else
points you at it. Run `gh pr list` and skim the last few commits on `main`
first. Sessions run in parallel and cannot see each other, so the small,
obvious, self-contained job — a doc block, a log entry, a one-file salvage — is
exactly the one two sessions pick independently. This is not hypothetical:
on 2026-08-11 it happened three times in one afternoon, and one of those pull
requests merged with an entirely empty diff because the other had landed the
identical text first. If you find someone already on it, extend their branch or
pick something else rather than opening a second pull request.

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

Three independent locks hold the marketplace closed. Never flip one to ship a
feature:

| Lock | File | State |
| --- | --- | --- |
| `CUSTOMER_JOB_POSTING_PAUSED` | `lib/launch-status.ts` | paused |
| `STRIPE_LIVE_MODE_ENABLED` | `lib/stripe.ts` | false |
| `PHONE_SMS_LIVE_MODE_ENABLED` | `lib/phone-auth.ts` | false |

`marketplaceActionAllowed()` requires all of: not paused, `MARKETPLACE_MODE`
set to `live`, and a fresh launch-readiness approval passed in by the caller.
`testOnly: true` short-circuits the whole check — test records are isolated
from real providers, customers, alerts, payments, and public profiles, so never
reach for that flag to make a real path work.

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

### Fee-copy invariant

The customer service fee is 5% of the provider's quoted subtotal, and providers
keep 100% of what they quote. The fee is added to the customer's total; it is
not deducted from the provider quote. Never revive the legacy 10% customer-fee
copy, and never express the customer fee as a deduction from provider earnings.
Any such wording is a defect even if it appears in an old screenshot, search
result, branch, or conversation. Before changing pricing, checkout, policy,
marketing, or AI copy, verify `lib/customer-fee.ts` and run
`node --test tests/customer-fee-consistency.test.mjs`.

**Never commit secrets or personal data.** `.env.example` holds placeholders
only; real values go through `wrangler secret put`. Customer and provider
personal data, identity documents, and database exports do not belong in this
repository under any circumstances.

## Constraints that must not be violated

### Providers are independent contractors — the never-build list

That classification holds because of specific product facts, not because of a
label. Maryland's ABC test (Md. Code, Lab. & Empl. § 8-205) has a disjunctive
third prong — work outside the usual course of business **or** performed away
from any place of business — and the second clause is satisfied because the work
happens at the customer's location.

Never add any of these. Each trades away a prong currently satisfied:

1. **Never set or cap the price a provider quotes.** Guidance drawn from that
   provider's own completed jobs is fine; a platform-set price is not.
2. **Never assign a job.** `lib/automatic-job-routing.ts` decides whether a
   request may skip per-job owner review; it must never become dispatch, pick a
   provider, or penalize declining.
3. **Never require exclusivity** or penalize providers for competing work.
4. **Never mandate schedules or minimum acceptance rates.**
5. **Never mandate uniforms, branded vehicles, or vehicle specifications.**
6. **Never require providers to buy tools, phones, or fuel from the platform.**
7. **Never let the platform supply, source, or price parts.**
8. **Never control repair method.** Scope limits and safety gates are fine;
   telling a provider how to perform a repair is control.

Anything touching pricing, routing, or the Provider Agreement should be checked
against this list before it is built, and legal questions go to counsel rather
than being settled in a document.

### Legal and evidence machinery

- `lib/maryland-repair-records.ts` implements Md. Comm. Law § 14-1001: the
  Customer's Rights text, the consent rule for exceeding an estimate, return of
  replaced parts, itemized lines with part condition and labor, and test-drive
  certification.
- Every provider holds their own county registration, general liability
  certificate, and business auto coverage. That is consumer safety first, and it
  doubles as evidence for the classification prong above.
- The owner evidence pre-screen in `lib/evidence-review-assistant.ts` can never
  auto-accept. Its only automatic action is a reversible, bilingual correction
  request for a provably expired document.

## Verifying your work

```bash
npm run lint
npm test        # full production build, then 62 test files
```

`npm test` builds before it tests, so it is slower than it looks but catches
build breakage.

To see what the business still needs rather than what the code does:

```bash
npm run readiness
```

It reads and never writes. One report covering the three marketplace locks, the
18 launch gates in `lib/launch-readiness.ts` against the decisions actually
recorded in production D1, `.env.example` against the deployed Worker's vars and
secrets, and the deadline table in `docs/OPEN-ITEMS.md`. Add `--offline` to skip
the two Cloudflare reads, `--json` for machine-readable output, or `--strict` to
exit non-zero when something required is outstanding. Gates are answered by the
owner in `/admin/launch-readiness`; this command cannot record a decision and
nothing it reports is a reason to flip a lock. Deployment happens through GitHub Actions on push to `main`;
running `npm run deploy` by hand skips the release stamping and health
verification and is documented as emergency-only in `DEPLOYMENT.md`.

## Traps that have already cost pull requests

Three separate branches have been lost to the migration tooling. Verified
against `main` on 2026-08-06:

- **Migration numbers collide.** `drizzle/` runs to `0053` across 54 files, and
  two branches that each add "the next" migration produce the same number. Check
  the highest number on `main` immediately before generating, and rebase rather
  than renumbering by hand after the fact.
- **The generated snapshots are stale past `0047`.** There are 35 snapshots in
  `drizzle/meta/` for 54 migrations, so `drizzle-kit generate` reconstructs
  state from `0047` and emits a migration that does not match what the database
  actually looks like. Write the SQL by hand rather than trusting a generated
  diff, unless you are also refreshing the snapshots deliberately.
- **Never assert on the newest journal entry.** `drizzle/meta/_journal.json` has
  54 entries and its last tag changes whenever anyone adds a migration. A test
  pinned to the newest entry passes on the branch that wrote it and fails for
  everyone after. Assert on the entry you care about by tag.

The lint suite reports one pre-existing warning in
`app/components/tuveloz-icons.tsx` about `<img>` versus `next/image`. It is not
yours; compare against `main` before assuming a warning is new.

## Conventions

Existing code style is the guide — match the file you are editing. New
documentation files use lowercase-hyphenated names and start with the status
header described in the filing guide. Prefer editing an existing document over
adding a near-duplicate, and add a row to `docs/README.md` for anything new so
it can be found again.
