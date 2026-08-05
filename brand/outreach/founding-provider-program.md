# Founding Provider Program

Scarcity is real leverage pre-launch. The founding providers are taking a bet
on something with no customers, no reviews, and no track record — that's worth
paying for. This defines what they get.

**Two tiers, one number.** A provider's founding rank is assigned once, at
first verification, and never recomputed:

| Rank | Gets |
|---|---|
| 1–20 | Never charged a provider membership fee, permanently |
| 1–10 | Also invited to a spotlight post |

Status: **live.** Published at `/founding-providers`, which is what makes it
sayable in outreach. Implementation is `lib/founding-cohort.ts`, with rank
assigned in `app/api/admin/provider-compliance/route.ts` at the moment a
provider first verifies.

---

## The one rule that makes this safe

`provider-outreach-kit.md` says: *never promise "founding provider" perks that
aren't published on the site.* That rule is correct and it stays. This document
doesn't override it — it's the path to satisfying it.

**Publish it, then promise it. Never the reverse.**

A perk promised in a DM and not delivered is the fastest way to lose the exact
10 people the marketplace depends on, and they talk to each other — the DMV
mobile-mechanic world is small. Until the perk list below is live on a public
page, outreach says nothing about founding perks. Once it's live, say it in
every message.

## Who counts

Membership is decided by a rule, not by memory, because it will be contested
later by applicant 21. All of this is enforced in code, not by hand:

- Ordered by **acceptance**, not application. Someone who applied first but
  cleared review third is third.
- Written to `provider_applications.founding_rank` at the moment of first
  verification, not reconstructed after the fact.
- Re-verification never renumbers an existing member.
- Test providers never receive a rank.
- A founding provider who later leaves or is removed does not free a slot. 20
  is a cohort, not a queue with vacancies.

---

## Perks worth giving

All of these cost time and nothing else, and none of them distort what a
customer sees.

0. **No provider membership fee, ever — ranks 1–20.** Decided by the owner.
   Tuveloz charges providers nothing today, so this is a commitment about a
   future membership fee: if one is introduced, these 20 are never charged it.
   Scoped deliberately to the provider membership fee — it does not touch the
   customer service fee, and the public page says so explicitly.

   Be clear-eyed about what this costs. It is permanent, and in year five it
   means 20 free accounts sitting alongside paying ones, at whatever the
   membership price turns out to be. That is the deal being offered for
   signing up when there was nothing to sign up to, and it is worth it if
   those 20 are the ones who make the marketplace exist. It is not
   retractable, so it should never be extended past 20 casually.

1. **The spotlight post — ranks 1–10.** Capped at 10 — that cap is what makes
   it worth having. See `provider-spotlight-kit.md`.
2. **"Founding provider" badge** on their public provider page. Wording matters:
   it must read as *tenure*, not quality — "Founding provider · joined before
   launch," never anything a customer could read as Tuveloz vouching for their
   work. (The phrase already appears as a workspace label in
   `app/provider-jobs/page.tsx`.)
3. **A public founding providers page** listing all 10 with links to their
   profiles. Costs nothing, gives them a real backlink, and doubles as proof to
   applicant 11 that people are actually signing up.
4. **First access to new services and features** as categories open past the
   launch five. They asked for towing/tires/A/C before anyone else did; let
   them in first when it exists.
5. **A direct line and a real say.** Their questions get answered by the owner,
   and they're asked before pricing or policy changes ship. This is the perk
   founding cohorts actually remember, and it's free.

## Perks to refuse — and why

Say no to these now, in writing, so they don't get promised in a DM later.

**Search ranking or job-routing preference.** This is the one that looks
tempting and would do real damage. The tagline is *Customer choice.* If
founding providers get surfaced first or get first crack at jobs, the customer
is no longer choosing from a neutral list — they're seeing a paid-position
result dressed as a recommendation, which you'd then have to disclose. It also
puts you in the position of steering work by seniority rather than fit, on a
marketplace whose entire pitch to customers is that they decide. Don't.

**Extending the fee waiver past 20.** The waiver itself is decided and is perk
0 above. What must not happen is quietly widening it — every additional
permanent free account is taken from the only provider-side revenue lever the
business has, and "first 20" stops meaning anything the moment it becomes
first 40. `FOUNDING_COHORT_SIZE` in `lib/founding-cohort.ts` is the single
place that number lives; changing it is a business decision, not a config
tweak.

**Guaranteed jobs, volume, or income.** Can't be delivered, already banned by
your own honesty rules, and the first cohort is precisely who'd notice.

**Exclusive category or territory locks.** "You're our only detailer in
Rockville" starves supply in exactly the categories you most need to fill, and
makes the marketplace worse for customers. It also becomes impossible to
unwind once a customer complains about that provider.

---

## Status

Done:

1. Perk list decided (owner).
2. Published at `/founding-providers` — perks, the acceptance rule, and an
   explicit statement of what founding status does *not* mean. In the sitemap.
3. Cohort membership recorded on the provider record, assigned automatically.
4. Badge on the public provider page, worded as tenure.

Still to do:

5. Add the program to `provider-outreach-kit.md` messages and the spotlight
   ask, now that a published page backs it. Link `/founding-providers`
   directly — the page does the convincing.
6. Decide whether the badge should also appear anywhere in the provider's own
   workspace, so they can see the standing they were promised.

## After the 20

A paid membership is planned for later; providers outside the cohort will be
able to take it. The first 20 never are. Applicant 21 gets a straight answer —
the cohort is closed, the membership is what's available — rather than a vague
one, which is the whole reason for publishing the rule instead of holding it
in DMs.
