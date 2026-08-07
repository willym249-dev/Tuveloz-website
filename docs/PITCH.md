# The Tuveloz pitch

The canonical statement of what Tuveloz is, who it is for, and what we may and
may not claim. **Add to this file rather than restating the pitch somewhere new.**

Nothing here is invented. Every fact is drawn from material already in the repo:
`brand/social-media-kit/profile-copy.md`, `brand/outreach/provider-outreach-kit.md`,
`docs/COMPETITIVE_LANDSCAPE.md`, `lib/customer-fee.ts`, and the live copy in
`app/page.tsx`. Where those disagree, this file wins and the others get updated.

**Status: pre-launch.** Provider onboarding is open. Customer requests are not
live. Every claim below has to survive that fact.

---

## 1. The one-liner

> Local marketplace for vehicle services — customers post a job, local
> independent providers send quotes, the customer chooses.

**Tagline: Customer choice. Provider freedom.**

Where: Montgomery County, Maryland (more areas by request).
Site: https://tuveloz.com · Providers: https://tuveloz.com/join · hello@tuveloz.com

## 2. Shared facts — do not improvise beyond these

The same list governs social bios, outreach DMs, ads, and in-product copy.

- **Free for providers to join.** No listing fee, no subscription, no provider
  fees.
- **Providers keep 100% of what they quote.** Customers pay a 5% service fee on
  top (`CUSTOMER_SERVICE_FEE_RATE_BPS = 500`). **Never phrase this as "providers
  keep 95%"** — it is not a cut of their price.
- **Providers set their own prices.** The platform never sets or caps a quote.
- **No exclusivity.** Providers keep working every other platform and every
  direct customer they already have.
- **Bilingual English/Spanish** throughout the product, not as a toggle.
- **Launch services only:** battery and jump start, wiper blades and bulbs,
  fluid top-off, detailing, basic diagnostics. No towing, tires, or A/C yet.
- **Pre-launch:** applying gets a provider reviewed now; real customer jobs open
  only after launch review.

## 3. How we talk about it

The positioning pattern, borrowed from the marketplaces that do this well:
**lead with the customer's outcome, not the company** (Thumbtack, TaskRabbit);
**name the enemy** — phone tag, guesswork pricing, waiting rooms (Turo's "skip
the rental counter"); **sell providers ownership, not gig work** (Uber's driver
messaging in reverse). Outcome first, place second, CTA last.

### To a customer

You have a car problem and no idea what it should cost. Today that means calling
around, taking whatever number you're given, and losing a day to a waiting room.

Post the job once. Local independent providers send you real itemized quotes.
You compare and choose — price, distance, what their past work looks like. They
come to you. Nothing gets added to the job without your approval, and there is a
photo record of the whole thing.

### To a provider

You already do the work. What you don't have is a steady way to be found, and
you lose hours to quoting, chasing, invoicing, and getting paid.

Join free. You set your prices and keep 100% of what you quote. You pick the
jobs you want — no exclusivity, no schedule, no minimum acceptance rate. We
carry the intake, the written authorization, the invoice, and the payment.

Live headline variants under test (§6): *"Your wrench. Your rules."* /
*"Do great work. Get paid."* / *"Your customers. Your prices. Your call."*

### To someone asking why this is different

Full detail in `docs/COMPETITIVE_LANDSCAPE.md`. The short form:

- **The provider sets the price.** Wrench and YourMechanic quote the customer and
  pay the mechanic a flat rate per job. Ours is a real quote from a real
  independent business.
- **Competence is verified per service, not per provider.** One business can hold
  standard work and specialty work at once and be gated separately on each.
  Nobody else in the category models it this finely.
- **Every provider holds their own county registration.** Montgomery County
  Chapter 31A requires a mobile mechanic to carry a Certificate of Registration
  while working. We verify it before any service goes live, along with their own
  general liability and business auto coverage. No national platform does
  county-level compliance for one county.
- **Bilingual as product.** There is no bilingual mobile-mechanic marketplace in
  the US, and the only bilingual competitor in the DMV is a single-owner shop.
- **A photo record and customer-approved change orders**, matching what the
  county requires of a written repair authorization and itemized invoice.

## 4. What we do not claim

Discipline, not modesty. Breaking these costs more than any single signup.

- **Never imply customers can book today**, or that jobs are waiting.
- **Never promise income, job volume, or lead counts.**
- **Never promise founding-provider perks not published on the site.**
- **Never say "providers keep 95%."**
- **No warranty claim.** We do not currently offer a platform-backed workmanship
  guarantee. The rest of the category publishes 12 months / 12,000 miles. Until
  we have one, we do not imply one.
- **No reviews yet**, so never reference ratings or "top-rated providers."
- **No instant or upfront estimate** — pricing is quote-only at launch.
- **No real scheduling** — no time-slot booking exists yet.
- One follow-up maximum in outreach. No follow-up after a "no."

## 5. Where the pitch is actually rendered

Change the pitch here, then update these. This list is why the pitch drifted in
the first place.

| Surface | File |
| --- | --- |
| Homepage hero, service list, provider section | `app/page.tsx` |
| Provider application | `app/components/provider-signup-form.tsx` |
| Founding provider program page | `app/founding-providers/` |
| Social and Google profile bios | `brand/social-media-kit/profile-copy.md` |
| Provider outreach DMs, EN/ES | `brand/outreach/provider-outreach-kit.md` |
| MoCo targeting worklist | `brand/outreach/moco-outreach-worklist.md` |
| Founding cohort terms | `brand/outreach/founding-provider-program.md` |
| Reel scripts and captions | `brand/outreach/reel-provider-recruitment-v3.md` |
| Ad scripts | `brand/ads/*.md` |

## 6. Live copy tests

Three first-party A/B tests run from day one (`lib/experiments.ts`), read on the
owner funnel at `/admin/analytics-funnel`. **When one wins, fold the winner into
§3 above and retire the test** — otherwise the real pitch lives in an experiment
config instead of in this document.

| Test | A (control) | B |
| --- | --- | --- |
| `provider_hero` | "Your wrench. Your rules." | "Do great work. Get paid." |
| `provider_pitch` | "You've got the skills…" | "Your customers. Your prices. Your call." |
| `founding_cta` | "Join free" | "Claim my spot" |

## 7. Open questions

Carried forward so they are not re-litigated from scratch each time.

1. **Warranty.** A platform-backed 12mo/12k guarantee funded from held payment is
   the biggest single gap against the category, and it would give the 5% fee
   something visible to buy. Not built, not promised.
2. **The fee's long-term shape.** Openbay, RepairPal, Thumbtack and CarAdvise
   charge customers nothing; every durable player monetizes the supply side or an
   enterprise partner. 5% of a $500 job is $25. The founding cohort's
   membership-fee waiver already implies a future provider-side line — that line
   needs designing.
3. **Cold-start on the compare screen.** It launches with price, distance and
   photos but no ratings. Openbay found >70% of customers did not pick the
   cheapest quote — but only because the screen carried other signal.
4. **What replaces "founding provider"** as a recruiting hook once the first 10
   spotlight slots and 20 cohort seats are filled.
