# Tuveloz — Master Sales Pitch

**Customer choice. Provider freedom.**

One document, every audience. This is the canonical narrative for Tuveloz:
what it is, who it's for, why it wins, what's actually built, and what we are
and aren't allowed to claim while saying it.

Everything here is drawn from the product itself — the code, the config, the
policy releases, the outreach kits. Where a claim depends on a fact that can
change, the source of truth is cited so this document can be re-verified
instead of trusted.

**Status as of this writing (August 2026): pre-launch.** Provider applications
are open in Montgomery County, Maryland. Customer job posting and payments are
deliberately locked off in code. Section 9 explains why that is a strength in
the pitch, not a weakness to hide — and §14 is the hard list of things we do
not say.

---

## Contents

1. [The one-liner](#1-the-one-liner)
2. [The problem](#2-the-problem)
3. [The product](#3-the-product)
4. [Value proposition — customers](#4-value-proposition--customers)
5. [Value proposition — providers](#5-value-proposition--providers)
6. [Why Tuveloz is different](#6-why-tuveloz-is-different)
7. [Business model](#7-business-model)
8. [Market](#8-market)
9. [Where we are today](#9-where-we-are-today)
10. [What is actually built](#10-what-is-actually-built)
11. [Path to launch](#11-path-to-launch)
12. [Ready-to-use pitches](#12-ready-to-use-pitches)
13. [Objection handling](#13-objection-handling)
14. [Claim guardrails](#14-claim-guardrails--what-we-do-not-say)
15. [Proof appendix](#15-proof-appendix)

---

## 1. The one-liner

> **Tuveloz is a local marketplace for vehicle services. Customers post the job,
> independent providers send real quotes, and the customer chooses.**

Site headline: **"Any car issue. Multiple quotes. You choose."**

Tagline: **Customer choice. Provider freedom.**

Elevator version (30 seconds, §12 has more):

> Getting your car fixed still means phone tag and guessed-at prices. Tuveloz
> flips it: you describe what your vehicle needs once, local independent
> providers send you real quotes, and you pick on your schedule and your
> budget. Providers join free, set their own prices, and keep 100% of what they
> quote. We're onboarding providers in Montgomery County, Maryland now, ahead
> of customer launch.

---

## 2. The problem

Name the enemy. It's not "the auto repair industry" — it's four specific
frictions that everyone has personally experienced.

**For the customer:**

- **Phone tag.** Getting three prices means three calls, three explanations of
  the same symptom, three "bring it in and we'll take a look."
- **Guesswork pricing.** No price until the car is on a lift and the leverage
  has shifted. Nobody comparison-shops a repair the way they'd comparison-shop
  anything else they buy.
- **Waiting rooms and drop-offs.** The job is often small — a battery, wipers,
  a bulb, a fluid top-off — and the logistics cost more than the work.
- **No way to describe the problem well.** "It makes a noise" is a bad brief.
  Customers under-describe, providers over-quote to cover the unknown.

**For the independent provider:**

- **They are invisible.** A one-person mobile operation lives or dies on
  Facebook Marketplace posts, Craigslist, and word of mouth. There's no durable
  place to be found.
- **Platforms take a cut of their labor** and increasingly tell them what to
  charge and which jobs to take.
- **Paperwork is a real tax.** Estimates, authorizations, invoices, warranty
  disclosures, records retention — every hour spent there is unbilled.
- **Existing "gig" models sell them shifts, not a business.**

The honest framing: this is a **coordination** problem on both sides. Neither
side lacks willingness. They lack a neutral place to meet with prices visible.

---

## 3. The product

A mobile-first, bilingual (English/Spanish) two-sided marketplace.

**The customer path**

1. Describe the vehicle and what it needs — guided, plain-language service
   picker, address, photos, schedule.
2. Local eligible providers see the request and send real quotes.
3. The customer compares quotes side by side in a private request workspace
   and accepts one. *Only the chosen provider ever receives the address.*
4. A private job workspace opens: messaging, appointment, arrival tracking,
   before/after condition evidence, change orders that require explicit
   customer approval, and a Maryland-format estimate → authorization → final
   invoice record.
5. Payment runs through Stripe. Reviews are tied to a real completed job — one
   review per request, enforced at the database level.

**The provider path**

1. Apply free. A short guided application: which services you offer, your
   business details, email verification.
2. Documents are requested **only** where a specific service legally requires
   them. If nothing is required, that step is skipped entirely.
3. Identity verification (government ID + live selfie match), evidence upload
   with malware scanning, and per-service eligibility review.
4. Once verified, matching jobs route automatically. Quote what you want,
   decline what you don't. No exclusivity.
5. Your own public business page with a slug, work gallery, QR short link,
   job-linked reviews, and Stripe Connect payouts.

**The AI assistant** (live now, `/ai`) helps a customer turn "it makes a noise"
into a clear description a provider can actually read and quote. It is
deliberately constrained: it will not diagnose a failed part as a conclusion,
will not quote or range a price, will not recommend a specific provider, and
escalates brakes/smoke/fire/fuel-smell/overheating/loss-of-steering to "stop,
get clear, call 911."

---

## 4. Value proposition — customers

Headline: **"Your car. Your call."**

| What they get | Why it matters |
|---|---|
| **Multiple real quotes from one request** | One description, not three phone calls |
| **You choose — always** | Neutral list. No paid placement, no ranking preference sold to anyone (§6) |
| **Price transparency before commitment** | The service fee is itemized on every quote, not discovered at checkout |
| **No fee to post, no fee to compare, no obligation to accept** | The only charge is on a job you actually accept |
| **Matched, not spammed** | A request goes only to providers approved for that exact service |
| **Price guidance from real completed jobs** | Shown only after ≥3 real, non-test, completed single-service jobs. Labeled "Not a promised quote." Never an estimate we invented |
| **Providers come to you** | Mobile-first service model; no drop-off, no waiting room |
| **Documented work** | Before/after condition evidence, written authorization, change orders you approve, a real invoice |
| **Reviews you can trust** | Tied to an actual completed Tuveloz job record. One per request |
| **Your address stays private** | Released only to the provider you select |
| **Bilingual to the fine print** | Quote, authorization, and invoice read in English and Spanish — so both sides agree to the same words, not a rough translation |

**The trust framing, stated plainly on the site** — *"We show what's documented.
Nothing more."*

- **Marketplace, not mechanic.** Tuveloz connects you with providers; the work
  itself is a direct agreement between the customer and the provider they chose.
- **Independent providers.** Not Tuveloz employees. They set their own price,
  schedule, and methods.
- **Law-based verification.** When a service legally requires a license or
  registration, it must be documented and confirmed before that provider can
  offer it — *nothing added just in case.*

Other supporting copy in use: *"Vehicle help, without the runaround."* ·
*"Post it once. Compare real quotes. No pressure."* · *"A clearer way to
describe what your vehicle needs."*

**The vision, in the founder's words:** *"We want to change how the mechanic
industry works: give customers clearer choices and help independent providers
grow."*

---

## 5. Value proposition — providers

This is the side we are actively selling **today**. Lead with ownership, never
with gig work.

**The four reasons, as the site states them:**

1. **You're the boss.** "Tuveloz doesn't employ, train, or assign you. Set your
   own price, schedule, and how you do the work — every job, every time."
2. **Keep what you earn.** "Keep 100% of your quoted price. No subscription, no
   lead fees, no commission carved out of your labor."
3. **No exclusivity, no cage.** "Keep your own customers and work other
   platforms too. Tuveloz is one more way to fill your day — not a lock-in."
4. **Grow on real work.** "Reviews are tied to completed jobs, not gameable star
   clicks. Your track record is yours to build and keep."

| What they get | The line we use |
|---|---|
| **Free to join** | No listing fee, no subscription, no provider fees |
| **Keep 100% of your quoted price** | The customer pays the site's small fee, not you |
| **Set your own prices** | "Your business. Your price. Your schedule." |
| **Choose your own jobs** | Quote what you want, skip what you don't |
| **No exclusivity** | Work other platforms too — keep doing everything you do now |
| **Minimal paperwork friction** | "You fix the vehicle. We knock out the paperwork." |
| **Documents only when legally required** | Requested only where your exact services require them — otherwise skipped |
| **A real public presence** | Business page, work gallery, QR code, job-linked reviews |
| **Direct payouts** | Stripe Connect, paid to your own account |

**Never describe the provider share as 95%.** Providers keep 100% of what they
quote. The customer pays a separate 5% Customer Service Fee to the site. This
distinction is a standing rule in the outreach kit and it matters — it's the
whole pitch.

**What the platform takes off their plate** — *"You fix the vehicle. We knock
out the paperwork."*

| | |
|---|---|
| **Customers come to you** | No website to build, no ads to run. Matching requests reach the providers approved for that exact service |
| **Scheduling in one place** | Confirm appointments; every job's date, time, and details together instead of chasing texts |
| **Quotes in minutes** | Reusable quote wording and your own set prices — no phone tag |
| **Photo-backed job records** | Vehicle condition, progress, parts, and completion evidence from any phone |
| **Invoices and payment handled** | Accepted quotes become written authorizations, invoices, and receipts |
| **Your numbers, private** | Your completed jobs and performance in a workspace only you can see |

**The 15-second version, from the recruitment ad:** *"Tired of working somebody
else's route? → Set your own prices. → Pick your own jobs. → Keep 100% of your
price. Join free."*

### The Founding Provider Program

Scarcity is the honest lever pre-launch: the first providers are betting on a
marketplace with no customers, no reviews, and no track record. Two tiers, one
number — founding rank, assigned once at first verification and never
recomputed. Ranked by **acceptance**, not application.

| Rank | Gets |
|---|---|
| **1–20** | Never charged a provider membership fee, permanently |
| **1–10** | Also invited to a spotlight post |

Plus: a "Founding provider · joined before launch" badge (worded as *tenure*,
never as a quality endorsement), a listing on the public `/founding-providers`
page, first access to new service categories as they open, and a direct line to
the owner with a real say before pricing or policy changes ship.

**What the program deliberately refuses**, and why it's worth saying out loud
in a pitch: no search-ranking preference, no job-routing priority, no territory
locks, no guaranteed volume or income. Ranking preference would quietly turn
"customer choice" into paid placement dressed as a recommendation. The cohort
is enforced in code (`lib/founding-cohort.ts`) and is explicitly barred from
influencing what a customer sees or the order providers appear in.

The cap is real: 20 is a cohort, not a queue with vacancies. A founding provider
who leaves does not free a slot. Applicant 21 gets a straight answer.

---

## 6. Why Tuveloz is different

Four defensible claims. Each is enforced in the product, not just asserted in
marketing.

**1. The customer decides, and nothing is sold that changes that.**
No paid placement. No promoted providers. No routing preference — not even to
the founding cohort that the business most depends on. That refusal is written
into the code and into the founding program document as a permanent "no." Most
marketplaces eventually monetize position; declining to is the differentiator,
and it's only credible because we wrote down that we won't.

**2. Approval is per exact service, never per person.**
There is no broad "general mechanic" approval — `general_auto_repair` is
literally categorized as a *prohibited broad category*. A provider is eligible
for a specific service code in a specific jurisdiction, or they are not. Default
policy is **deny**. That's what makes a badge mean something.

**3. Provable governance, not claimed trust.**
- Seven legal documents (Terms, Customer Agreement, Provider Agreement,
  Privacy, Payment Policy, Marketplace Conduct, Provisional Provider Policy) are
  **hash-pinned**; CI recomputes every hash and blocks deploy if a policy page
  changed without a release.
- Job lifecycle events are **hash-chained** — a tamper-evident audit log.
- Identity verification stores references, status, and consent dates. It never
  stores the ID number, date of birth, document image, or selfie.
- Every uploaded license or insurance document is quarantined until an
  authenticated external malware scanner returns a matching clean result.
- Incidents default to **holding payment**. No job-completion event
  automatically releases money.
- Payments, identity, and job posting are independently **fail-closed**: a
  missing or wrong value blocks activation and never opens payments.

**4. Built as a marketplace, so it can do what shop software can't.**
*"Most tools are built for one front desk. Tuveloz is built around independent
providers and their customers, which lets us design for trust, language, and
mobile work from the ground up."* Side-by-side quotes, cross-provider price
guidance from real completed jobs, a neutral list, and reviews bound to job
records — none of these exist inside a single shop's booking tool.

The four the site leads with:

- **Bilingual to the fine print.** The quote, authorization, and invoice are
  built to read in English and Spanish — so both parties agree to the same
  words, not a rough translation.
- **Paid through the platform.** At launch, accepted jobs are paid through
  Tuveloz and released on completion evidence. No chasing checks.
- **Labor-only, done right.** The customer brings the part; Tuveloz is designed
  to line up the exact part before the appointment so a wrong part doesn't waste
  the provider's trip.
- **Made for mobile, not just the front desk.** Appointments, records, and photo
  evidence work from any phone at the customer's location.

**Bilingual is a distribution advantage, not a checkbox.** A large share of
Montgomery County's independent auto trade is Spanish-speaking, the signup form
is already bilingual, and almost nobody is marketing to them in Spanish. Our own
growth playbook calls this *"likely the most underpriced channel available."*

---

## 7. Business model

**Today**

| Side | Charge |
|---|---|
| Provider | **$0.** No listing fee, no subscription, no lead fee, no commission |
| Customer | **5% service fee**, added on top of the provider's quote and itemized before acceptance |

The fee is **additive, not deducted.** A $100 quote means the provider is owed
$100 and the customer pays $105. That is why "keep 100% of what you quote" is
literally true and why describing the provider share as 95% is banned.

One constant, one place: `CUSTOMER_SERVICE_FEE_RATE_BPS = 500` in
`lib/customer-fee.ts`, with the name in `CUSTOMER_SERVICE_FEE_NAME`. It is
snapshotted onto each quote, so the number the customer agreed to is the number
that flows through display, checkout, and payout review. Customers see the line
as "Customer Service Fee (5%)" next to "Provider labor" and "Total."

> **The 5% is proposed, not final.** Every legal page says so: it "still needs
> final sign-off from a tax adviser, the payment processor, and Tuveloz's
> insurance broker before it's final." Say "proposed" in any context where the
> number could be read as a committed price.

**Zero revenue from parts — by design.** Quotes are **labor-only**, enforced
server-side. *"Tuveloz does not sell, source, list, verify, or process payment
for vehicle parts."* The customer buys parts separately; the invoice line
"Parts charged through Tuveloz" is hardcoded to $0.00. This removes an entire
category of inventory risk, markup disputes, and warranty exposure.

**Payment rails: Stripe, with two deliberately different settlement paths.**

| Path | Used for | Behavior |
|---|---|---|
| **Destination charge** | Storefront products | Stripe transfers the provider's amount immediately; the fee stays with the platform |
| **Separate transfer** | Quote-based jobs | The provider's amount **stays on the platform** until completion *and* an owner-reviewed release |

Connect V2 accounts are created as recipient/Express, with Tuveloz set as both
`fees_collector` and `losses_collector` — meaning **the platform absorbs Stripe
fees and chargeback losses rather than clawing them back from providers.**
That's a real cost and a real part of the provider pitch. Providers submit a W-9
at signup and receive a 1099 for applicable annual earnings.

Release is gated, not automatic. *"A completion status never makes money
releasable by itself."* The payout check blocks on open incidents, unresolved
claims, unresolved cancellations, unauthorized change orders, pending or
approved refunds, open disputes, active reserves, invoice/authorization
mismatch, a running provider timer, or a payment not bound to the current
authorized scope snapshot.

**We do not call it escrow.** Site policy is explicit: Tuveloz will not describe
the process as a bank deposit, trust, or escrow arrangement unless that
description is accurate under applicable law *and* the processor approves it.

**Planned second revenue line:** a paid provider membership, after launch —
described in the founding program as *"the only provider-side revenue lever the
business has."* Founding ranks 1–20 are permanently exempt; everyone else can
take it. The exemption is scoped strictly to the provider membership fee and
never touches the customer service fee.

**Why this split is the right one.** The provider is the scarce side of a
cold-start marketplace and the one with the thinnest margins. Charging them
nothing removes every reason not to try it, and "keep 100% of what you quote" is
a sentence that survives being repeated by one provider to another — which is
how this market actually communicates.

**Cost base is deliberately near-zero:** Cloudflare Workers, D1, and R2 —
serverless with no idle spend. Pre-launch operating cost is essentially
domain + Stripe + email.

**Open decisions**, worth naming honestly in an investor conversation rather
than being caught on: whether 5% is the final number, how taxes and processing
costs are allocated, cancellation and no-show amounts, the refund waterfall,
chargeback allocation, reserves, and payout timing. The proposed refund rule is
a full refund if the provider cancels, no-shows, or can't perform; full refund
if the customer cancels before authorized labor begins; and after labor begins,
a refund that may exclude the documented value of work already completed.

---

## 8. Market

**Launch market: Montgomery County, Maryland** — roughly one million people,
jurisdiction code `US-MD-MontgomeryCounty` throughout the codebase, enforced
server-side against **45 ZIP codes and 36 municipalities**. Anchor towns:
Silver Spring, Rockville, Gaithersburg, Germantown, Bethesda, Wheaton, Takoma
Park, Montgomery Village, Aspen Hill, Olney, Kensington, Damascus. Providers set
a travel radius of 5, 10, 15, 25, or 50 miles.

**The provider pool is the constraint, and that's the point.** Independent
mobile mechanics, detailers, and jump-start/roadside operators in the county
plausibly number in the hundreds, not thousands. A national following of 10,000
would be worth less than 200 people who live between Silver Spring and
Germantown. Every growth decision is optimized for local density over reach.

**Beachhead logic.** One county, a narrow first service set, and a supply-side
cold start solved before demand is switched on. Density in one county beats
thin coverage across a metro — a customer needs three real quotes in their ZIP,
not a provider forty minutes away.

**The ideal first provider is the one-person operator.** From our own targeting
notes: *"A guy who does mobile oil changes out of his truck on weekends is a
better target than an established shop — he has nothing to lose (free, keep
100%, no exclusivity) and no overhead to protect."* They already advertise on
Facebook Marketplace, Craigslist, Nextdoor, and county community groups, which
is exactly where we reach them.

**Expansion is demand-driven, not guessed.** The site captures area requests
from both customers and providers outside the county (`expansionInterests`), so
the second market is chosen from recorded demand on both sides. Maryland and
Washington, DC are the offered expansion regions. An area request is explicitly
labeled as interest, not a launch-date promise.

**The number that decides launch viability:** 20–40 provider applications from
social in the current 8-week window. Supporting planning targets (not
forecasts): 200–400 local followers across Instagram, TikTok, and Facebook,
9+ posts live per platform, a verified Google Business Profile, and a paid test
of $5–10/day radius-fenced to the county.

**Service catalog:** 25 exact service codes defined, all currently default-deny.
Eleven are staged for the first launch (the owner-operator "Open tier"):

> jump start · 12V battery replacement · wiper blades · conventional bulbs ·
> engine/cabin air filter · limited fluid top-off · temporary spare install ·
> OBD read-only · visual observation report · photo documentation · basic
> detailing

Customers never see those code names. They see five plain-language cards:

> **Battery & jump start** — "Back on the road when your battery quits."
> **Wipers & bulbs** — "New wiper blades and burnt-out bulbs, swapped fast."
> **Top off fluids** — "A quick top-up to keep your car running right."
> **Car cleaning** — "An outside wash, inside cleaning, or both."
> **Find out what's wrong** — "A local provider checks your car on-site to see
> what's going on."

The remainder — towing, tires, A/C, lockout, tint, body/paint, fuel delivery,
EV high-voltage, official inspection — stay off until each one's mandatory
requirements, insurance, and legal category mapping are documented. Each carries
its own named evidence requirement: a lockout provider needs an active Maryland
locksmith business license; A/C needs an EPA Section 609 certificate; towing
needs registration plus business auto and custody coverage. **Not offering them
yet is the credibility, not a gap.**

---

## 9. Where we are today

Say this plainly. It is the most common question and the honest answer is
better than the evasive one.

**Open right now:** provider applications and onboarding, customer *account*
creation, launch-update subscriptions, area-expansion requests, and the AI
assistant.

**Not open:** customer job requests, quotes, bookings, checkout, and payouts.

**Why it's locked.** `MARKETPLACE_MODE = "onboarding_only"` and
`CUSTOMER_JOB_POSTING_PAUSED = true` block all ten transaction-capable actions
at the server, not per page. Live Stripe charges and provider transfers are
disabled in code *and* configuration. Turning any of it on requires three
independent conditions — the code pause lifted, the mode set to live, **and** a
fresh database-backed launch-readiness approval.

**The public line:**

> "Tuveloz is not accepting customer service requests or payments yet. We are
> onboarding and reviewing local provider businesses first so customers will
> have meaningful choices when the marketplace opens."

**How to pitch this as strength.** Every two-sided marketplace faces the
cold-start problem and most solve it by launching demand into an empty supply
pool and burning the first hundred customers. Tuveloz is solving supply first,
on purpose, with the demand side held shut in code so it *cannot* leak. The
first customer who posts a job will see real quotes from verified providers.
That is a deliberate sequencing decision, and the enforcement is architectural.

The same conservatism runs through the compliance posture: every service is
default-deny until that exact service has current mandatory-compliance,
government/agency, insurance, and provider evidence. Several launch gates
require an **outside** authority — an insurer, a CPA, the payment processor, a
security reviewer — and the system rejects an owner self-attestation on those
gates by design. Nothing here can be checked off by software or an owner
checkbox.

---

## 10. What is actually built

The most under-sold fact about Tuveloz: **the platform is finished and running.
What's missing is external approvals, not engineering.**

**Scale of the build**
- 58 database tables covering the full marketplace, compliance, job-lifecycle,
  payment, auth, privacy, and growth surface
- 63 automated test suites, run against a real production build in CI
- 7 legal documents authored, released, and hash-pinned
- Live on Cloudflare Workers at tuveloz.com, deployed through GitHub Actions
  with post-deploy verification that the exact commit is serving

**Stack:** Next.js 16 / React 19 on Cloudflare Workers · Cloudflare D1
(SQLite) with Drizzle migrations · Cloudflare R2 + Images for uploads · Stripe
(Connect V2, Checkout, Identity) · Resend for email with a database-backed retry
outbox · WebAuthn passkeys, password, email-code, and SMS sign-in · first-party
analytics and A/B experiments with no third-party tracker · cron every 15
minutes for reminders and compliance.

**Customer features:** guided request form with vehicle selector and address
autocomplete, private request workspace with side-by-side quote comparison,
saved providers, in-job messaging, appointments, arrival tracking, job
authorizations and change orders, condition and completion evidence, checkout
with saved payment methods, job-linked reviews, Maryland repair records,
notifications center, privacy center with data export.

**Provider features:** guided application and onboarding, job board with active
/quoted/completed views and value and hours analytics, reusable quote templates,
parts checklist builder, service catalog and pricing, service-area
configuration, public business page with gallery and QR short link, Stripe
Connect payouts panel, invoicing with labor/parts/tax line items, job operations
console, compliance appeals.

**Owner/admin** (behind Cloudflare Access): operations dashboard, launch
readiness console that states in plain language exactly why customer jobs and
payments are blocked, per-exact-service provider compliance and activation with
an emergency service hold, compliance operations queue, privacy request review,
analytics funnel with per-variant conversion, payments admin, and a Test Lab
with an isolated synthetic customer and provider for running the full workflow
without touching real data.

**Brand and campaign assets, ready to run:** logo system and social kit sized
for every platform, ready-to-paste bios for Instagram, TikTok, X, Facebook and
Google Business, a print-ready provider flyer, bilingual provider outreach
templates, two produced video ads with storyboards, provider-recruitment reel
kits, a founding-provider program page, a spotlight kit, and an 8-week audience
growth playbook with a targeted Montgomery County outreach worklist.

---

## 11. Path to launch

Two sequential stages, both tracked in the owner's launch-readiness dashboard.
Each gate needs an evidence reference, a named reviewer or issuing authority, an
approval date, and where relevant a valid-through date so expiration re-blocks
readiness.

**Stage 1 — Provider onboarding (in progress).** Entity authority, provider
legal requirements, the evidence and insurance matrix, identity and business
verification, privacy retention and data rights, evidence file security, and an
incident plan.

**Stage 2 — Transaction pilot.** Customer workflow and terms, Maryland repair
duty allocation, platform and service insurance bound, Stripe's approval of the
Connect business model, CPA sign-off on the fee/tax/transaction map, checkout
fee and receipt copy, cancellation and refund policy, incident and claims
handling, expiration reminder delivery, and the screening position.

**Then, per service:** enable it in the catalog (a reviewed deploy — eleven
Open-tier codes are staged and intentionally unmerged), and write an activation
record with legal review, insurer approval, and an official government source.
Once a service is enabled and activated, a qualifying provider auto-verifies to
active with no further owner action.

**The bottleneck is honest and worth stating in any pitch:** the remaining work
is bounded and mostly external — an insurance broker binds coverage, Stripe
approves the marketplace model, a CPA approves the tax and transaction map, a
security reviewer signs the evidence pipeline. It is not more building.

---

## 12. Ready-to-use pitches

### 30-second — anyone

> Tuveloz is a local marketplace for vehicle services. Instead of calling three
> shops and getting three "bring it in," you describe what your car needs once
> and local independent providers send you real quotes. You compare and choose
> — your schedule, your price. Providers join free, set their own prices, and
> keep 100% of what they quote. We're in Montgomery County, Maryland, signing up
> providers ahead of customer launch.

### 2-minute — investor or partner

> Vehicle service is one of the last big local categories where you still can't
> comparison-shop. Getting three prices means three phone calls and three
> in-person looks, and the small jobs — battery, wipers, bulbs, fluids — cost
> more in logistics than in labor. On the other side, the independent mobile
> operator has no durable place to be found and gets squeezed on rate by every
> platform that will list them.
>
> Tuveloz is the neutral marketplace in the middle. The customer posts once,
> verified local providers send real quotes, the customer chooses. Providers pay
> nothing and keep 100% of what they quote; customers pay a 5% service fee
> that's itemized on every quote before they commit.
>
> The platform is built and running — 58 tables, 63 test suites, full Stripe
> Connect payments, identity verification, evidence scanning, a hash-chained
> job audit trail, and seven hash-pinned legal documents enforced by CI. What's
> left before customer launch isn't engineering; it's external sign-off from an
> insurer, Stripe, and a CPA.
>
> We're solving the cold-start problem supply-first, and the demand side is
> locked shut in code so it can't leak early — the first customer to post a job
> will see real quotes from verified providers. Launch market is Montgomery
> County, Maryland: a million people, a provider pool in the hundreds, and
> expansion driven by recorded demand rather than a guess.
>
> The near-term revenue is the customer service fee. The second line is a paid
> provider membership after launch, with the first twenty founding providers
> permanently exempt — the price of getting supply to bet on us first.

### Provider DM — first contact

> Hey [name] — saw your [detailing / jump-start / mobile mechanic] post in
> [group/area]. I'm with Tuveloz, a new vehicle-services marketplace for
> Montgomery County. We're signing up independent providers before launch: free
> to join, you set your prices and keep 100% of what you quote (customers pay
> the site's small fee, not you), and there's no exclusivity — keep doing
> everything you're doing now.
>
> Straight up: customer requests aren't live yet. Applying now means your review
> is done and you're ready on day one. Takes a few minutes: tuveloz.com/join
>
> Happy to answer anything — or if it's not for you, no worries at all.

**Spanish version and the single permitted follow-up are in
`brand/outreach/provider-outreach-kit.md`.** Personalize the first line every
time, cap it at 5–8 messages a day from one account, one follow-up maximum, and
none after a "no."

### Partner / insurer / processor

> Tuveloz is a Montgomery County vehicle-services marketplace, pre-launch by
> design. We approve providers per exact service code rather than as general
> mechanics, default to deny, and hold every service closed until its mandatory
> requirements, insurance, and legal mapping are documented. Payments and
> customer job posting are fail-closed in code and cannot be opened by an owner
> checkbox. We're seeking [coverage / model approval / tax review] as a named
> gate in our launch-readiness record — the approval is recorded with your
> organization, an evidence reference, and a valid-through date that re-blocks
> readiness on expiration.

---

## 13. Objection handling

**"There are no customers yet — why would a provider join?"**
Because joining is free, takes minutes, carries no exclusivity, and their review
is done before day one. And be direct: the first twenty are the founding cohort,
permanently exempt from any future membership fee. That's the deal for signing
up when there was nothing to sign up to. Never dress it up as jobs waiting.

**"How is this different from Thumbtack / Yelp / an app?"**
Three ways. The list is neutral — we don't sell position, to anyone, ever.
Approval is per exact service, not a general badge. And reviews are bound to
completed job records rather than open submission.

**"5% — why would a customer pay that?"**
They see it itemized on every quote before they commit, and it buys real quotes
to compare, a verified provider, documented work, and a written authorization
trail. Compare it to what the guesswork spread costs on a single repair.

**"You're just going to raise the take rate later."**
The provider side is the one under pressure in every marketplace, and the answer
here is a published membership with a published exemption rather than a
commission that creeps. The customer fee lives in one constant, and the founding
exemption lives in one number in code that can't be changed quietly.

**"Only eleven services at launch?"**
Yes — deliberately. Every other category is off until its legal requirements,
insurance, and category mapping are documented. A marketplace that will sell you
a service it can't stand behind is the one to worry about.

**"Isn't the compliance posture over-engineered for a pre-launch product?"**
It's the moat. Anyone can build a quote board. The barrier in vehicle service
is jurisdiction-specific legal duty, insurance, and evidence handling — and that
work is already done and enforced in code.

**"What happens if a job goes wrong?"**
Incidents record injury, property damage, emergency services, stop-work, and
insurer notification, and default to holding payment. No completion event
automatically releases money. There's a change-order flow that requires the
customer's explicit approval, a documented cancellation and no-show record with
a computed refund split, and an appeals path for providers.

**"If providers pay nothing, how does this make money?"**
The customer service fee on accepted jobs is the live mechanism, and a paid
provider membership is the planned second line after launch. Charging the supply
side nothing during a cold start is a deliberate acquisition cost, not an
oversight — and the founding exemption is capped at 20 precisely so it doesn't
quietly eat the only provider-side lever the business has.

**"Why one county?"**
Density. A customer needs three real quotes in their own ZIP, not one provider
forty minutes out. The second market gets chosen from recorded demand on both
sides, not a guess.

---

## 14. Claim guardrails — what we do not say

These are binding. They come from the outreach kit's honesty rules and the
integrated review checklist, and violating one is the fastest way to lose the
exact people the marketplace depends on.

**Never say:**

- That customers can book or pay today, or that jobs are waiting for a provider.
- Any promise of income, job volume, or earnings.
- Any wording that puts the provider share at 95%. They keep **100%** of what
  they quote; the customer pays the 5% fee on top.
- That the 5% is final. It is *proposed*, pending tax-adviser, payment-processor,
  and insurance sign-off.
- **"Escrow," "trust account," or "deposit"** for held funds, unless that
  description is accurate in law and the processor has approved it.
- That Tuveloz sells, sources, verifies, or handles payment for parts. It does
  not. Quotes are labor-only.
- Any founding-provider perk that is not already published on the site. Publish
  it, then promise it — never the reverse.
- **That founding providers get "first pick of jobs"** or any routing or ranking
  advantage. They do not, by deliberate design (see §6 and the note below).
- That an attorney approved the site, or that the company has zero liability.
- That a service is available before it is individually enabled and activated.
  Don't list towing, tires, or A/C — they aren't in the launch set.
- Anything that reads as Tuveloz vouching for a provider's quality. The founding
  badge states tenure — "joined before launch" — and nothing more. In a
  spotlight, "been doing this 12 years" is their claim in their voice and is
  fine; "licensed and insured" is a factual assertion Tuveloz would be making,
  and needs that specific credential verified in their record.

**Always say, when pre-launch status comes up:** customer requests are not live
yet; applying now means the review is done before day one.

**Outreach discipline:** personalize the first line every time, 5–8 messages a
day maximum from one account, one follow-up ever, none after a "no," and track
every send so nobody is contacted twice. Business posts come from the business
account — no astroturfing. Label AI-generated creative on every platform that
asks for it.

**Publicity consent is not implied.** The Provider Agreement contains no
publicity or likeness clause. A provider's name, business name, photo, or
likeness may only be used in marketing with explicit written permission, asked
for every time.

### Two live contradictions to fix

Flagged during the research for this document. Both are copy problems, not
product problems, and both are worth resolving before this pitch is used widely.

1. **The homepage founding banner promises job-routing preference.** It reads
   *"The first mechanics into Montgomery County get first pick of jobs…"*, which
   directly contradicts the founding program's explicit, written refusal of
   routing and ranking preference — and contradicts the code, which bars founding
   rank from influencing what a customer sees. This is the one claim on the site
   that could not be delivered. **Recommend rewording to the perks that are real:
   permanent membership-fee exemption, the spotlight, the badge, first access to
   new service categories, and a direct line to the owner.**
2. **The outreach kit is a revision behind the site.** It still says not to
   mention founding perks, but `/founding-providers` is now published — which was
   the whole precondition for saying it. The kit's own rule ("publish it, then
   promise it") is now satisfied, so the DM and spotlight templates should be
   updated to link the page.

A third, non-copy item worth a developer's attention: the database default for
`customer_fee_rate_bps` is **1000 (10%)** while the code constant is **500 (5%)**.
Live writes always pass 500, so it's latent rather than active — but a row
inserted without an explicit value would carry a rate of 1000 bps instead.

---

## 15. Proof appendix

### Brand quick reference

| | |
|---|---|
| **Tagline** | Customer choice. Provider freedom. |
| **Site title** | Tuveloz \| Customer Choice. Provider Freedom. |
| **Orange** | `#FF6A00` (dark `#E95700`) |
| **Navy** (badge interior) | `#07182D` |
| **Black** (page canvas) | `#050505` |
| **Mark** | Chunky funnel + detached drop, orange on navy, rounded square with orange keyline |
| **Masters** | `brand/tuveloz-icon.svg` (vector) · `brand/social-media-kit/tuveloz-profile-master-1024.png` (raster) |
| **Rule** | Every icon and social image is generated from the masters — never hand-drawn or re-picked |
| **Accounts** | instagram.com/tuveloz · tiktok.com/@tuveloz · x.com/TuvelozApp · Facebook page |
| **Voice** | Second person, short sentences, plain-spoken, blue-collar-respectful. "Straight up: customer requests aren't live yet." |

### Verifiable claims

Where each number lives, so anything here can be re-checked rather than trusted.

| Claim | Source |
|---|---|
| 5% customer service fee, additive on top of the quote | `lib/customer-fee.ts` — `CUSTOMER_SERVICE_FEE_RATE_BPS = 500`; `customerTotalCents = quote + fee` |
| The 5% is proposed, pending CPA/processor/insurer | `app/terms/page.tsx`, `app/customer-agreement/page.tsx`, `app/payments/page.tsx` |
| Quotes are labor-only; no parts revenue | `lib/service-matching.ts` — `PARTS_COMMUNICATION_NOTICE`; `app/api/jobs/route.ts` — `LABOR_ONLY_QUOTE_REQUIRED` |
| Two settlement paths; quote jobs held until owner release | `app/api/stripe/checkout/route.ts`; `db/schema.ts` — `settlement_strategy` |
| Platform is fees and losses collector | `lib/stripe-provider.ts` — `v2.core.accounts.create` defaults |
| Payout gated on incidents, refunds, disputes, reserves | `app/api/stripe/admin/payments/route.ts` — `assessPayoutReadiness` |
| Escrow deliberately not claimed | `app/payments/page.tsx` |
| W-9 at signup, 1099 for applicable earnings | `app/provider-agreement/page.tsx` |
| 45 Montgomery County ZIPs, 36 municipalities, one market | `lib/service-matching.ts`; `lib/service-area-settings.ts` |
| Founding cohort: 20 fee-exempt, 10 spotlight | `lib/founding-cohort.ts` |
| Founding status cannot affect ranking or routing | `lib/founding-cohort.ts` module contract; `brand/outreach/founding-provider-program.md` |
| Customer job posting and payments locked | `lib/launch-status.ts`, `wrangler.jsonc` (`STRIPE_ALLOW_LIVE_MODE: "false"`) |
| Ten transaction actions blocked server-side | `lib/launch-status.ts`, `lib/runtime-marketplace-action.ts` |
| Launch requires a database-backed approval | `lib/runtime-launch-readiness.ts` |
| Per-exact-service approval; broad repair prohibited | `config/provider-eligibility-matrix.json` — `general_auto_repair: prohibited_broad_category` |
| 25 service codes; 11 staged for launch | `config/provider-eligibility-matrix.json`; `docs/PROVIDER_ACTIVATION_RUNBOOK.md` |
| Jurisdiction `US-MD-MontgomeryCounty` | `config/provider-eligibility-matrix.json` |
| 7 legal documents active and hash-pinned | `config/policy-releases.json` |
| Hash-chained job lifecycle audit log | `db/schema.ts` — `jobLifecycleEvents.previousEventHash` → `eventHash` |
| Identity verification stores no ID number, DOB, image, or selfie | `lib/stripe-identity-verification.ts`, `DEPLOYMENT.md` |
| Evidence quarantined until an external scanner returns clean | `lib/cloudmersive-evidence-scanner.ts`, `db/schema.ts` — `evidenceFileScans` |
| Incidents default to holding payment | `db/schema.ts` — `jobIncidents.holdPayments` |
| Price guidance needs ≥3 real completed jobs | `app/api/price-guidance/route.ts` |
| One review per request, enforced | `app/api/reviews/route.ts` + unique index |
| AI assistant guardrails and 911 escalation | `app/api/ai/route.ts` |
| 58 tables · 63 test suites | `db/schema.ts`, `tests/` |
| Outside authorities required; self-attestation rejected | `docs/PROVIDER_ACTIVATION_RUNBOOK.md`, `docs/INTEGRATED_REVIEW_CHECKLIST.md` |
| Bilingual EN/ES | `app/components/site-language.tsx` |

**Related documents**

- `brand/outreach/provider-outreach-kit.md` — bilingual DM and group-post templates, honesty rules
- `brand/outreach/founding-provider-program.md` — program rules and the perks deliberately refused
- `brand/outreach/moco-outreach-worklist.md` — who to contact, in what order, without getting flagged
- `brand/outreach/audience-growth-playbook.md` — 8-week pre-launch growth plan and targets
- `brand/social-media-kit/profile-copy.md` — ready-to-paste bios per platform
- `brand/ads/` — produced video ads and storyboards
- `docs/PROVIDER_ACTIVATION_RUNBOOK.md` — the operational path to activating providers
- `docs/INTEGRATED_REVIEW_CHECKLIST.md` — what is and isn't cleared for launch

---

**Contact:** hello@tuveloz.com · [tuveloz.com](https://tuveloz.com) · Providers
apply at [tuveloz.com/join](https://tuveloz.com/join)

*This is a sales and positioning document. It is not legal advice, proof of
legal compliance, or approval to launch the marketplace.*
