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
