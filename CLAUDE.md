# Tuveloz — orientation for a new session

Read this before proposing changes. It records decisions that are expensive to
rediscover and dangerous to reverse by accident.

## What this is

A two-sided marketplace for mobile vehicle service in **Montgomery County,
Maryland**. Customers post a service request; independent providers write their
own itemized quotes; the customer compares and picks. Private job workspace with
photo evidence, customer-approved change orders, Stripe Connect payouts,
bilingual English/Spanish throughout.

**Pre-launch.** Job posting is paused, payments are code-locked, provider
applications are open. Three independent locks, all fail-closed:

| Lock | File | State |
| --- | --- | --- |
| `CUSTOMER_JOB_POSTING_PAUSED` | `lib/launch-status.ts` | paused |
| `STRIPE_LIVE_MODE_ENABLED` | `lib/stripe.ts` | false |
| `PHONE_SMS_LIVE_MODE_ENABLED` | `lib/phone-auth.ts` | false |

Do not flip any of these to ship a feature. `MARKETPLACE_MODE` is
`onboarding_only`, and for a real action `marketplaceActionAllowed()` requires
all three of: not paused, mode `live`, and a fresh DB-backed launch-readiness
approval passed in by the server-side caller. `testOnly: true` short-circuits
the whole check — test records are isolated from real providers, customers,
alerts, payments, and public profiles, so never reach for that flag to make a
real path work.

## Key documents

**`docs/INDEX.md` is the map — every written asset, what it settles, and where
to add to it. Check it before starting a new document; add to the file that
already owns a subject rather than restating it somewhere new.**

| Doc | What it settles |
| --- | --- |
| `docs/INDEX.md` | The index of everything below, plus the brand and outreach material. Start here. |
| `docs/PITCH.md` | The canonical pitch: the shared facts nobody may improvise beyond, and what we must never claim (no warranty, no reviews, not live for customers). |
| `docs/PROVIDER_CLASSIFICATION_DESIGN.md` | Why providers are independent contractors and which features would break that. **Read before touching pricing, routing, or the Provider Agreement.** |
| `docs/COMPETITIVE_LANDSCAPE.md` | Where we stand against Wrench, YourMechanic, AutoNation Mobile Service, Openbay, ClickMechanic. Table stakes we are missing. |
| `docs/PROVIDER_ACTIVATION_RUNBOOK.md` | How a provider actually goes active. Several gates need an outside party and cannot be satisfied in software. |
| `docs/INTEGRATED_REVIEW_CHECKLIST.md` | Review process. |
| `config/provider-eligibility-matrix.json` | The compliance rules engine's data. `default_policy: deny`. |

## Constraints that must not be violated

### Provider classification — the never-build list

Providers are independent contractors. That holds because of specific product
facts, not because of a label. Maryland's ABC test (Md. Code, Lab. & Empl.
§ 8-205) has a **disjunctive** third prong — work outside the usual course of
business **or** performed outside any place of business — and we satisfy the
second clause because all work happens at the customer's location. California
has no such clause, which is why Grubhub won on right-to-control and then lost
under the ABC test on remand.

Never add any of these. Each trades a prong we win for a feature we do not need:

1. **Never set or cap the price a provider quotes.** Guidance from that
   provider's own completed jobs is fine; a platform-set price is not.
2. **Never assign a job.** `lib/automatic-job-routing.ts` is *notification of
   eligible providers*. It must never dispatch, pick a provider, or penalize
   declining.
3. **Never require exclusivity** or penalize providers for competing work.
4. **Never mandate schedules or minimum acceptance rates.**
5. **Never mandate uniforms, branded vehicles, or vehicle specifications.**
6. **Never require providers to buy tools, phones, or fuel from us.**
7. **Never let the platform supply, source, or price parts.** The Parts Checklist
   deliberately has no store links and no prices. Keep it that way.
8. **Never control repair method.** Scope limits and safety gates are fine;
   telling a provider how to perform a repair is control.

### Compliance requirements follow the jurisdiction

Requirements resolve from the place the work happens, not uniformly:

- Each evidence type in `config/provider-eligibility-matrix.json` carries an
  `imposed_by` jurisdiction, or none if Tuveloz imposes it everywhere as a safety
  baseline (insurance, competency, supervision, rosters).
- Jurisdictions form a containment chain: `US-MD-MontgomeryCounty` → `US-MD` →
  `US`. A provider is asked for the documents of each government that reaches
  them, plus the baseline. Never for another county's paperwork.
- **Fails closed both ways.** A jurisdiction must be registered *and* carry
  `local_requirements_reviewed: true` through its whole chain before a service
  opens there. Opening a new place is a reviewed decision, never a config edit —
  otherwise expansion silently drops local law instead of replacing it.
- `tests/jurisdiction-scoped-requirements.test.mjs` pins the Montgomery County
  effective requirement set. If it fails, something got relaxed where we launch.

### Legal and evidence machinery

- `lib/maryland-repair-records.ts` implements Md. Comm. Law § 14-1001: Customer's
  Rights text, the 10%-over-estimate consent rule, return of replaced parts,
  itemized typed lines with part condition, labor minutes, mechanic identifier,
  NHTSA notice, electronic-signature consent, test-drive certification. Every job
  gets a written estimate, which is stricter than the statutory threshold.
- Every provider must hold their **own** county Chapter 31A Certificate of
  Registration, GL certificate, and business auto coverage. This is consumer
  safety first, and it doubles as evidence for § 8-205 prong (2).
- `config/policy-releases.json` pins a SHA-256 of each legal page's rendered
  body. **Editing a legal page requires rotating its hash** or eligibility breaks.
- The owner evidence pre-screen (`lib/evidence-review-assistant.ts`) can never
  auto-accept. Its only automatic action is a reversible, bilingual correction
  request for a provably expired document. Keep it that way.

## Working here

- `npm test` runs the production build plus the full feature suite (337 tests as
  of Aug 2026). Run it before pushing — the tests assert product and policy
  behavior, not just types.
- `npx tsc --noEmit` reports pre-existing errors unrelated to most changes
  (`cloudflare:workers` module, some implicit anys). Compare against `main`
  before assuming you caused one.
- Never commit `.env`, `.dev.vars`, tokens, or database exports.
- Money: **5% customer service fee** (`CUSTOMER_SERVICE_FEE_RATE_BPS = 500` in
  `lib/customer-fee.ts`), charged on top of the provider's quote. Providers keep
  100% of what they quote. Storefront uses destination charges; quote jobs use
  separate transfers released on completion evidence.

## Known gaps

Real and deliberate, not oversights. See `docs/COMPETITIVE_LANDSCAPE.md`:
no platform-backed warranty, no reviews at launch, no real scheduling, no
upfront/instant estimate, no fleet offering. The category treats the first three
as table stakes.

## A note on sourcing

`docs/COMPETITIVE_LANDSCAPE.md` and `docs/PROVIDER_CLASSIFICATION_DESIGN.md` were
researched in an environment where outbound fetching was blocked, so competitor
facts and case holdings came from search summaries rather than primary pages.
Both files say so. Re-confirm any number or holding against the source before
relying on it commercially, and route legal questions to counsel.
