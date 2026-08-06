# What Got Comparable Marketplaces Sued, and Where Tuveloz Stands

**Date:** August 6, 2026
**Scope:** Independent-provider marketplaces — the same legal model Tuveloz
operates. Each entry is a real enforcement action or class action, the conduct
that caused it, the rule it implies, and whether Tuveloz currently satisfies
that rule. Not legal advice.

---

## 1. Provost v. YourMechanic (Cal. App. 2020) — the closest comparable

**Conduct.** Mechanics classified as independent contractors alleged
YourMechanic "exercised substantial control over the work performed and the
manner and means" of performing it, and failed to reimburse business expenses
(fuel, phone, tools). A 2017 class action raised the same theory. Notably, the
trial court **denied YourMechanic's motion to compel arbitration** in the
representative action, and the Court of Appeal addressed that denial — an
arbitration clause did not dispose of the case.

**Rule.** Control over *how* the work is done is the whole ballgame, and an
arbitration clause is not a substitute for getting classification right.

**Tuveloz status: satisfied, and it must stay that way.** Providers set their
own prices, schedule, tools, and methods; there is no exclusivity, no
obligation to accept a job, and no Tuveloz training or supervision. Treat these
as product constraints, not policy prose. Reject by default any future feature
that introduces platform-set or "suggested" pricing, acceptance-rate scoring,
cancellation penalties, mandated response times, or scripts/uniforms.

## 2. Handy — $6M California misclassification settlement (2023)

**Conduct.** Platform set prices and controlled terms while classifying workers
as contractors. Settlement included restitution to 25,000+ workers, civil
penalties, and a permanent injunction.

**Rule.** Setting the price is the single most damaging control factor.

**Tuveloz status: satisfied.** Providers set their own quotes. The 5% fee is
added on top and charged to the customer; Tuveloz never sets or suggests the
labor price.

## 3. HomeAdvisor — $7.2M FTC settlement

**Conduct.** Sold leads to contractors while misrepresenting lead quality and
conversion likelihood.

**Rule.** Don't sell access to demand you've characterized inaccurately.

**Tuveloz status: satisfied by design.** There are no lead fees at all — the
fee is charged only on a completed job. This removes the entire fact pattern.

## 4. Care.com — $8.5M FTC settlement (2024), $1M (2020)

**Conduct.** Four separate problems, all relevant to a two-sided marketplace:
inflated the number of available jobs shown to workers; made **baseless
earnings claims** to recruit workers; overstated the rigor of background
checks to families; and used a cancellation flow where the button that looked
like "cancel" preserved the membership.

**Rule.** Recruitment claims to the supply side are advertising and are held to
the same substantiation standard as consumer advertising. Job counts, earnings,
and screening rigor must each be provable.

**Tuveloz status: satisfied, and unusually disciplined.** The provider
recruitment materials in `brand/outreach/` and `brand/ads/` explicitly prohibit
promising income, job volume, or unpublished perks, and repeat that rule in
five separate files. Keep that rule as material passes through any future
marketing help. There is no paid membership, so no cancellation flow to make
deceptive — if a provider subscription is ever added, the cancellation path
must be as easy as the signup path.

## 5. Uber — $25M district attorney settlement (safety claims)

**Conduct.** Marketed background checks as "the gold standard" and the service
as "the safest ride on the road" while the checks missed serious convictions.
Prosecutors said the case "led to an overhaul of Uber's safety advertising."

**Rule.** Never describe verification in superlatives, and never let a trust
badge imply more screening than was actually performed.

**Tuveloz status: satisfied.** The Terms commit to confirming only the specific
license, registration, or insurance the law requires for the exact service, and
the FAQ affirmatively warns users not to assume an umbrella license or "fully
verified" status. This is stronger than the peer norm. If background checks are
ever added, describe them factually ("county criminal record check on [date]
via [vendor]") and never compress them into a "Tuveloz Verified" badge.

## 6. Uber — $28.5M "Safe Ride Fee" class settlement

**Conduct.** Charged a separately labeled fee whose name implied a safety
benefit the company did not deliver in proportion.

**Rule.** A fee's name is a representation. A fee labeled for trust, safety, or
support creates an obligation to deliver that thing.

**Tuveloz status: satisfied, with a caution.** The 5% is described neutrally as
a platform/service fee. If a trust-and-safety guarantee program is added later
and funded by a renamed fee, the program's actual coverage must match the name
— this is the specific trap to avoid when building the guarantee.

## 7. TaskRabbit — 2018 breach, 3.75M users

**Conduct.** Attackers obtained names, usernames, passwords, dates of birth,
**Social Security numbers, and bank account numbers** for workers. Remediation
included reducing the amount of data retained.

**Rule.** Data you never collect cannot be breached. Retention is a security
control, not a paperwork question.

**Tuveloz status: satisfied by design.** The schema states explicitly that
Tuveloz stores only attestation timestamps and **never SSNs or document
numbers**, and that provider evidence is insurance evidence only. Tax identity
collection happens through Stripe rather than in Tuveloz's own database. This
is the correct architecture and should not be relaxed for convenience.

---

## Where Tuveloz actually stands

Of the seven proven failure modes above, Tuveloz currently avoids all seven —
several by deliberate design rather than luck. The remaining exposure is not in
the policies; it is in items that require a filing or a purchase:

| Item | Why it matters | Cost |
|---|---|---|
| Register a DMCA agent with the U.S. Copyright Office | Without registration there is no §512 safe harbor, so Tuveloz is directly liable for user-uploaded material | ~$6 |
| Platform insurance (commercial general liability + tech E&O/cyber) | A liability cap and arbitration clause do not pay a claim; insurance does. Also the precondition for any guarantee program | quote-dependent |
| AAA Consumer Clause Registry filing | The AAA will not administer consumer arbitrations for an unregistered clause | filing fee + renewal |
| A2P 10DLC registration | Carriers filter unregistered application-to-person SMS; affects deliverability as much as compliance | small |
| Trademark registration for the Tuveloz name | Terms §15 asserts brand rights that a registration makes enforceable | filing fee |

## One business finding, not a legal one

The 5% customer-side fee is thinner than it looks once payment processing is
netted out. On a $400 job the customer pays $420, the provider receives $400,
and the platform's $20 is reduced by Stripe's processing charge on the full
$420 — leaving roughly $7–8, an effective take of under 2%. On a $60 job the
platform nets under a dollar, and a single refund or chargeback puts that job
underwater.

This is not a compliance problem, but it is the reason peers monetize on more
than one axis. The safest additions, in peer-tested order of least resentment:
optional promoted placement, optional provider tools (the QR, gallery, and
analytics features already built), and instant-payout convenience fees. All are
opt-in and none gates access to work, so none recreates the HomeAdvisor or
Handy fact patterns.

## Sources

- Provost v. YourMechanic, Inc., 55 Cal.App.5th 982 (2020): https://caselaw.findlaw.com/court/ca-court-of-appeal/1909135.html
- YourMechanic misclassification class action (2017): https://www.prweb.com/releases/2017/07/prweb14508869.htm
- Handy $6M settlement: https://missionlocal.org/2023/05/handy-house-cleaning-app-to-pay-6-million-settlement-over-worker-misclassification/
- HomeAdvisor FTC settlement: https://topclassactions.com/lawsuit-settlements/closed-settlements/homeadvisor-false-advertising-ftc-refunds/
- Care.com FTC settlement and refunds: https://www.ftc.gov/news-events/news/press-releases/2025/06/ftc-sends-more-81-million-consumers-harmed-carecoms-deceptive-claims-about-earnings-job-listings
- Uber $25M DA settlement over safety claims: https://www.kqed.org/news/10923008/uber-settles-lawsuit-with-s-f-and-l-a-district-attorneys
- Uber $28.5M Safe Ride Fee settlement: https://techcrunch.com/2016/02/11/uber-proposes-28-5-million-settlement-over-safe-ride-fee-class-action-lawsuits
- TaskRabbit breach scope: https://www.hannonlaw.com/blog/taskrabbit-data-breach-compromises-tasker-client-user-information/
