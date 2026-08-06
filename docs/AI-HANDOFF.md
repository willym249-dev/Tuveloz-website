# Tuveloz — AI handoff brief

- **Status:** active
- **Owner:** hello@tuveloz.com
- **Last reviewed:** 2026-08-06

**This is the file to open first.** It is written to be self-contained, so you
can paste it into a new Claude conversation, ChatGPT, or Gemini and that
assistant will understand the project without reading the rest of the
repository. Everything below is a summary of code and configuration that lives
in this repo; where a fact could go stale, the source file is named so it can be
re-checked rather than trusted forever.

---

## What Tuveloz is

Tuveloz is a vehicle-service marketplace for **Montgomery County, Maryland**.
Customers describe a repair they need, receive quotes from independent
providers, choose one, and manage the job in a private workspace. Providers
apply, pass compliance checks, quote on matching jobs, and get paid through
Stripe.

The business is **not fully open yet**. As of this writing the marketplace runs
in onboarding-only mode: provider applications and customer accounts are open,
while customer job posting and real payments are deliberately switched off in
code. See "Current launch state" below.

## Technology

Next.js 16 and React 19, built with `vinext` and Vite, deployed as a single
Cloudflare Worker. Data lives in Cloudflare D1 (SQLite) accessed through
Drizzle ORM, with uploaded files in Cloudflare R2. Payments run on Stripe
(Checkout, Connect, and Identity). Sign-in supports email codes, passwords,
SMS codes, and WebAuthn passkeys. Node 22.13 or newer is required.

Key config files: `package.json`, `wrangler.jsonc`, `drizzle.config.ts`.

## Who uses it

There are two **account roles**, `customer` and `provider`, defined in
`lib/account-auth.ts`. One person can hold both and switch between workspaces.
Sessions last 12 hours with a 30-minute idle timeout.

The **owner/admin** is not an account role. Owner access is infrastructure-level
authentication through Cloudflare Access, verified in `lib/owner-auth.ts`
against a JWT plus the `OWNER_EMAIL` secret. Admin pages and APIs check
`isVerifiedOwnerRequest()`.

Within the provider role there is a further taxonomy in `lib/provider-policy.ts`
— three pathways (independent startup, sponsored trainee employee, provider
business employee) and five levels (learning account, sponsored trainee,
provisional independent, standard provider, specialty provider). Level and
pathway together decide which services a provider may perform and whether they
can be paid directly.

## How the money works

The platform charge is a **5% customer service fee**, defined once in
`lib/customer-fee.ts` as `CUSTOMER_SERVICE_FEE_RATE_BPS = 500`. It is added on
top of the provider's quote and paid by the customer; provider quotes are
labor-only. Both amounts appear as separate line items at checkout.

There are two settlement strategies in `app/api/stripe/checkout/route.ts`:

- **Destination charge** — used for storefront product purchases. Stripe moves
  the provider's share immediately and the platform keeps the fee.
- **Separate transfer** — used for quote-based jobs. Funds stay on the platform
  until the job is complete and the owner explicitly releases the payout, which
  happens in `app/api/stripe/admin/payments/route.ts` after verifying the
  payment succeeded, the amount matches, and nothing was refunded or disputed.

Providers cannot be paid at all unless their Stripe connected account is
verified, approved, non-test, and payout-ready — enforced in
`lib/stripe-connected-account-snapshots.ts`.

## What governs who can do what

Two configuration files carry most of the business rules, and both are worth
knowing about before changing anything in provider or legal code.

**`config/provider-eligibility-matrix.json`** is the authoritative permission
matrix for which provider may perform which service. Its default policy is
`deny`. It defines universal baseline requirements, the pathway and level
system, roughly 33 evidence types with expiration and privacy flags, and
per-service policy blocks for 25 service codes — each carrying its launch
state, customer visibility, allowed pathways and levels, required evidence,
supervision rules, and job-control requirements such as written quotes and
authorization before work begins. It is loaded by `lib/provider-policy.ts` and
evaluated by `lib/provider-eligibility-engine.ts`.

**`config/policy-releases.json`** pins each of the seven published legal
documents to a reviewed content hash. A policy page cannot change without a new
reviewed release, and the test suite recomputes those hashes and fails the
build if a released page's text changed. The seven documents are Terms of
Service, Customer Agreement, Provider Agreement, Privacy Notice, Payment
Policy, Marketplace Conduct, and the Provisional Provider Policy — each a page
under `app/`.

## Current launch state

**Verify these before relying on them; they are switches that will flip.**

`lib/launch-status.ts` currently sets `MARKETPLACE_MODE = "onboarding_only"`
and `CUSTOMER_JOB_POSTING_PAUSED = true`, which pauses every transactional
action server-side. `lib/stripe.ts` sets `STRIPE_LIVE_MODE_ENABLED = false`.
Live payments additionally require environment switches that default to false
in `wrangler.jsonc`. The design is fail-closed throughout: a service is denied
unless something explicitly permits it.

Going live is gated by 18 recorded decisions in `lib/launch-readiness.ts`,
split across two stages — provider onboarding (7 gates) and transaction pilot
(11 gates). Each gate needs an evidence reference, an issuer, and a review
date, and approvals expire. Separately, `lib/runtime-launch-readiness.ts`
machine-verifies things no owner entry can substitute for, such as the auth
secret length, the R2 binding, a configured malware scanner, and a live Stripe
key. Both must pass before a service can be activated.

The runbook for actually doing this is `docs/PROVIDER_ACTIVATION_RUNBOOK.md`.

## How it ships

Production is the Cloudflare Worker `tuveloz` on `tuveloz.com`, deployed by
`.github/workflows/deploy-cloudflare.yml` on push to `main`. That workflow
stamps the commit SHA into the build, runs lint and tests, applies database
migrations, deploys, and then polls `/api/health` until the live release
matches the commit — refusing to report success otherwise. Deploying by hand
with `npm run deploy` skips those protections and `DEPLOYMENT.md` treats it as
emergency-only.

`verify.yml` runs lint, tests, migrations, and a build on every pull request
without deploying. Staging is a separate Worker with its own database, deployed
manually via `deploy-staging.yml`; see `docs/STAGING.md`.

`npm test` runs a full production build followed by 62 test files covering
Stripe hardening, provider lifecycle, launch gating, evidence handling, auth,
privacy, and policy-hash integrity.

## Secrets

Real secrets never live in this repository. `.env.example` documents the
required variables as placeholders only; actual values go into
`wrangler secret put` or an untracked local file. The categories are Cloudflare
deployment credentials, core runtime config, email delivery, marketing
compliance, evidence scanning, identity verification, optional AI assistant
keys, Stripe payments, Stripe Identity, Stripe Connect webhooks, live-mode
locks, and optional SMS sign-in.

## Where documents live

See [`README.md`](README.md) in this folder for the full index, and
[`FILING-GUIDE.md`](FILING-GUIDE.md) for where to put a new one.

---

## Using this with ChatGPT or Gemini

This file is plain Markdown with no repository-specific tooling, so it works
anywhere. Two ways to use it:

**Paste or upload it.** Copy this file into the chat, or upload it as a file,
and say what you want help with. It gives the assistant the business model, the
architecture, the launch posture, and the vocabulary in one pass.

**Add the specific documents you need.** This brief is a map, not the territory.
If the question is about provider eligibility, also attach
`config/provider-eligibility-matrix.json`. If it is about deployment, attach
`DEPLOYMENT.md`. If it is about a legal policy, attach the page file itself.

**What not to paste.** Do not paste real secrets, customer or provider personal
data, database exports, or identity documents into any external AI tool. The
placeholder names in `.env.example` are safe to share; the values are not.

Worth saying plainly to whichever assistant you are talking to: this codebase is
deliberately fail-closed and heavily gated because it handles vehicle repair
work, money movement between strangers, and Maryland regulatory duties. Advice
that suggests removing a guard, loosening a default-deny rule, or enabling live
payments to make something work should be treated as wrong until a human with
the legal and compliance context signs off.
