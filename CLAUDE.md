# Tuveloz — working notes for Claude

## No guessing. Ever.

This project runs on verified facts. This rule outranks everything else in
this file and applies to all of it — law, code, test results, library
behavior, what a file contains, what a command did.

- **Verify before asserting.** Read the file, run the command, search the
  source. Do not answer from recall when the answer can be checked.
- **If it cannot be verified, say so.** "I don't know," "unverified," or "I
  need to check" are correct answers. Filling the gap with something plausible
  is not. A confident wrong answer is worse than no answer, because it gets
  acted on.
- **Mark uncertainty where the claim is, not in a footnote.** If one figure in
  a paragraph is unconfirmed, say so next to that figure.
- **Do not launder secondhand results.** Output from a subagent, a search
  result, or a tool is a claim, not a confirmation. Say where it came from, or
  verify it independently before stating it as fact.
- **Do not report work as done without running it.** Tests pass because
  `npm test` was run and its output read, not because the change looked right.
- **Record what gets verified**, with the date, so it does not have to be
  re-derived. `docs/LEGAL_LANDSCAPE.md` is where legal facts go.

The one thing this rule cannot promise is infallibility — a verified source
can still be wrong or stale. What it does require is that nothing is ever
presented as certain when it was not actually checked.

## Legal and regulatory questions

The owner understands the difference between legal information and legal
advice, and does not need it restated. Do not preface answers with "I can't
give legal advice," and do not append disclaimers to routine answers.

### Where Tuveloz operates — verified from the code, August 2026

| Fact | Value | Source in repo |
|---|---|---|
| Jurisdiction code | `US-MD-MontgomeryCounty` | `config/provider-eligibility-matrix.json` → `POLICY_JURISDICTION` in `lib/provider-policy.ts` |
| Launch area label | `Montgomery County, Maryland` | `CURRENT_LAUNCH_AREA` in `lib/service-matching.ts` |
| Municipalities served | 36 named places | `lib/service-matching.ts` |
| ZIP codes | 45 | `MONTGOMERY_COUNTY_MD_ZIP_CODES` in `lib/service-matching.ts` |
| Expansion interest accepted for | Maryland, Washington DC | `app/api/expansion-interest/route.ts` |
| Policy matrix status | `draft_pending_mandatory_compliance_insurance_tax` | `config/provider-eligibility-matrix.json` |

Every enabled service in the matrix carries exactly one jurisdiction:
`US-MD-MontgomeryCounty`. There is no second jurisdiction in the system.

**Maryland governs. Quote Maryland's own text.**

Never state another state's version of a rule as though it were Maryland's —
the wording differs in ways that change what has to be proven. Md. Labor &
Employment § 8-205(a)(3) is disjunctive ("either … or"); California Labor Code
§ 2775 and the Massachusetts equivalent are not. National summaries routinely
import the California phrasing.

Pull the Maryland statute and quote it. Another state's rule may be cited only
as explicit contrast, labeled as that state's, never as the governing text.
The same applies to Montgomery County ordinances versus other counties'.

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
