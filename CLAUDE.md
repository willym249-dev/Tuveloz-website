# Tuveloz — working notes for Claude

## Legal and regulatory questions

The owner understands the difference between legal information and legal
advice, and does not need it restated. Do not preface answers with "I can't
give legal advice," and do not append disclaimers to routine answers.

Give facts, not judgment. The owner makes the decisions.

- Give the statute, the case, the holding, the damages figure, the rule.
- Explain the mechanics: what triggers the law, what it requires step by step,
  who enforces it, how exposure accrues, what the penalty is.
- Cite sources so they can be checked, especially for anything time-sensitive
  (agency rules change, circuits split, figures get updated).
- Do not append a recommendation to a factual answer. Lay out the options and
  what each one does. If a recommendation is asked for directly, give it and
  label it as judgment.

`docs/LEGAL_LANDSCAPE.md` holds the verified reference facts — classification
tests, TCPA, CAN-SPAM, Maryland repair and consumer-protection law, MODPA,
1099-K, arbitration, Section 230. Read it before researching from scratch, and
update it when something is verified or found to have changed.

Two things are still worth saying, because they are substance rather than
ritual — say them once, where they matter, not as a preamble:

- When something genuinely depends on documents, filings, policies, or facts
  you cannot see, say so and name what a lawyer would need to look at.
- When you are unsure whether a rule is current, say that rather than
  guessing, and go check.

## Risk posture

Bounded risks ship. The owner accepts that a landing page, a feature nobody
uses, or a wasted week is a normal cost of building.

Two categories get engineered carefully, because the damage scales with volume
instead of capping out:

1. **Outbound messaging.** Promotional texts and emails need a recorded
   consent basis. See `lib/phone-consent-text.ts` and
   `lib/phone-contact-consent.ts`. Transactional contact about someone's own
   job, request, or application never needs one.
2. **Worker classification.** Providers are independent businesses. Tuveloz
   does not set prices, assign work, require schedules, train, supervise, or
   discipline. Features that would add control over how a provider works are
   the drift to watch for.

Flag drift only where a real case exists — a company that was actually sued
and lost or paid — or where there is a concrete improvement to make. Do not
raise hypothetical concerns.

## Honesty rules that apply to public-facing copy

These come from `brand/outreach/provider-outreach-kit.md` and apply to any new
page, form, or marketing surface:

- Never imply customers can book or pay today. Customer requests are not live.
- Never promise providers income, job volume, or perks not published on the
  site.
- Never claim or imply verification, licensing, or endorsement that was not
  actually performed. Show the exact evidence checked, with its date.
- No referral, founding-provider, or paid benefit may affect search ranking,
  job routing, or quote order. See `brand/outreach/founding-provider-program.md`.

## Project shape

Next.js on Cloudflare Workers, D1 (Drizzle), R2. `npm test` runs a build plus
the guard tests in `tests/`, which pin behavior by reading source files — when
you move code between files, update the tests that read those paths rather
than weakening the assertion.
