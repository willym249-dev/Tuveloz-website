# Provider classification: the structure we copy and the parts we change

Owner-internal design doc. It records which parts of the mobile-repair
marketplace structure to keep, which specific product features lost the cases,
and which won them. **This is engineering guardrail, not legal advice, and
nobody here is a lawyer.** Counsel signs off before live jobs; §7 is the list to
bring them.

Sourcing: case outcomes below came from search summaries rather than reading the
opinions directly (outbound fetching is blocked in the build environment).
Holdings should be confirmed against the reporters before anyone relies on them.

---

## 1. The structure we copy

Wrench and YourMechanic settled the shape of this business and it is the right
shape: a customer posts a vehicle-service need, an independent provider does the
work at the customer's location, the platform carries intake, records, payment
and dispute handling, and the provider is a 1099 independent business rather
than a W-2 employee.

Keep that. The managed-fleet alternative is not a safer choice, it is a worse
business — AutoNation wrote off **$65.3M of goodwill** on its Mobile Service unit
in Q2 2025 with a dealer group's balance sheet behind it. The structure is not
what got anyone sued.

## 2. What actually got them sued

Not the arbitration clause, and not the 1099 label. The *facts of control*:

- **Setting the price.** Wrench quotes the customer a price and pays the
  technician a flat rate per job. The technician never sets their own price.
- **Assigning the job.** The platform decides who goes, not the provider.
- **Controlling the workflow** — the sequence, the method, the reporting.
- **Not reimbursing expenses.** The 2017 class action against YourMechanic
  alleged mechanics were denied reimbursement for gas, phone, and tools. Expense
  shifting is what converts a classification argument into a damages number.

*Provost v. YourMechanic* (55 Cal.App.5th 982 (2020)) is widely cited as the
YourMechanic case, but read it accurately: **it is an arbitration ruling, not a
classification ruling, and YourMechanic lost it.** The court affirmed denial of
their motion to compel arbitration, holding a PAGA representative action is
indivisible and belongs to the state, so employment status could not be carved
off and arbitrated first. There is no classification win in it to copy. The
lesson is upstream: they were fighting over *how* the classification question
would be decided because the underlying control facts were bad.

PAGA is also a California statute with no Maryland equivalent, so the procedural
fight in *Provost* does not reach us at all. What reaches us is the control facts
that produced it.

## 3. The case that should actually scare us, and why Maryland answers it

**Lawson v. Grubhub.** Grubhub *won* at trial in 2018 under California's
*Borello* right-to-control test — the court found Grubhub did not control the
manner and means of the deliveries. Then *Dynamex* landed, the Ninth Circuit
vacated in 2021, and on remand the driver was held to be an **employee** under
the ABC test.

Read that sequence carefully, because it is the whole point:

> Grubhub had good control facts. Good control facts won the common-law test and
> then lost the ABC test anyway — because ABC's middle prong is not about
> control at all. It asks whether the work is outside the hiring entity's usual
> course of business, and delivery obviously is not outside Grubhub's.

**Under California's rule, a mobile repair marketplace cannot win that prong.
Repairing cars is our usual course of business. There is no set of product
choices that fixes it.**

Maryland is where this changes. **Md. Code, Lab. & Empl. § 8-205**, the
unemployment-insurance ABC test, states the third prong disjunctively — the work
must be:

> (i) outside of the usual course of business of the person for whom the work is
> performed; **or** (ii) performed outside of any place of business of the person
> for whom the work is performed.

That "or" is the entire difference between Maryland and California, and a mobile
marketplace satisfies clause (ii) on physical facts: every job is performed at
the customer's location or approved private property, and Tuveloz operates no
place of business where vehicle work happens. Grubhub had no second clause to
reach for. We do.

Note also that the **Maryland Workplace Fraud Act does not apply to us** — it
reaches the construction and landscaping industries only.

## 4. What won: the facts to build toward

*Saleem v. Corporate Transportation Group*, 854 F.3d 131 (2d Cir. 2017) is the
cleanest platform win, and its facts read like a product spec:

| Fact that won *Saleem* | Our status |
| --- | --- |
| Drivers chose whether to work for competitors | **Have** — no exclusivity anywhere in the Provider Agreement |
| Drivers chose when, where, and how often to work | **Have** — providers answer the requests they want, set their own service area |
| Drivers invested in their own businesses | **Have, and documented** — own county registration, own GL policy, own business auto, own tools |
| Drivers negotiated their own economics | **Have** — providers write their own itemized quote and set their own price |
| Drivers could terminate at will; the company could not, absent breach | **Check this** — see §7 |

The mirror image is *Alexander v. FedEx* (9th Cir. 2014), lost on control of
appearance, vehicle specification, and schedule.

## 5. Where our compliance stack becomes a classification asset

Prong (2) of § 8-205 asks whether the individual is *customarily engaged in an
independent business or occupation of the same nature as the work*. We already
require, before any service goes eligible, that the provider hold **their own**
Montgomery County Chapter 31A Certificate of Registration, **their own** general
liability certificate, and **their own** business auto coverage.

A person holding their own county motor-vehicle-repair registration is, almost
by definition, customarily engaged in an independent repair business. We built
that stack for consumer safety; it happens to be close to ideal documentary
evidence on prong (2). No competitor in this category collects it.

## 6. The never-build list

Each of these would trade a prong we currently win for a feature we do not need.
Anyone proposing one should be pointed at this file.

1. **Never set or cap the price a provider quotes.** Price-setting is the single
   heaviest control fact, and it is exactly what Wrench does. Price *guidance*
   computed from that provider's own completed jobs is fine; a platform price is
   not.
2. **Never assign a job.** `lib/automatic-job-routing.ts` must remain
   *notification of eligible providers*. The moment it dispatches — picks a
   provider, or penalizes declining — prong (1) is in play.
3. **Never require exclusivity**, or penalize providers for working through
   competitors or their own direct customers. This is the fact that most clearly
   won *Saleem*.
4. **Never mandate schedules or minimum acceptance rates.** Availability windows
   for customer clarity are fine; required hours are not.
5. **Never mandate uniforms, branded vehicles, or vehicle specifications.**
   Optional branding a provider may buy is fine. This is what lost *Alexander*.
6. **Never shift tool, phone, or fuel costs onto providers through required
   purchases from us.** Providers buying their own tools is entrepreneurial
   investment and helps us; *us* requiring a purchase converts it into an
   unreimbursed business expense, which is what the YourMechanic class action
   was built on.
7. **Never let the platform supply or price parts.** The Parts Checklist's
   refusal to price, source, or sell parts is correct on classification grounds
   as well as on working-capital grounds.
8. **Never control repair method.** Safety requirements, scope limits, and
   evidence requirements are quality gates tied to a specific service; telling a
   provider *how* to perform a repair is control.

Keeping this list is cheap. Every item on it is a feature we would otherwise be
tempted to build for convenience, and each one is worth less than the prong it
would cost.

## 7. What to bring counsel

Narrow questions, because prongs (2) and (3) are strong:

1. Does the Provider Agreement's termination clause satisfy the *Saleem* posture
   — provider terminates at will, platform only for defined breach? This is the
   one row in §4 we have not verified.
2. Does anything in the agreement or product read as control over *manner and
   means* under § 8-205 prong (1)?
3. Maryland uses different tests in different forums — ABC for unemployment
   insurance, right-to-control for workers' compensation, and separate standards
   for wage-and-hour and the IRS. Do the same facts carry in all four?
4. Maryland has no marketplace-contractor safe-harbor statute of the kind about
   a dozen states passed, so we win on facts rather than by statute. Is that
   assessment right, and has anything changed?
5. Confirm the § 8-205 prong (3) disjunctive reading against the current code
   text, since this whole design rests on it.

## 8. Related change: requirements follow the jurisdiction, not the platform

Shipped alongside this doc. Compliance requirements are now resolved from the
place the work happens rather than applied uniformly:

- Every evidence type carries an `imposed_by` jurisdiction, or none at all if
  Tuveloz imposes it everywhere as a safety baseline (insurance, competency,
  supervision, rosters).
- Jurisdictions form a containment chain — `US-MD-MontgomeryCounty` → `US-MD` →
  `US` — and a provider is asked for the documents of each government that
  actually reaches them, plus the platform baseline.
- A provider working outside Montgomery County is never asked for a Montgomery
  County certificate, and never loses the baseline.
- It fails closed both ways. A jurisdiction must be registered *and* have
  `local_requirements_reviewed: true` through its whole chain before any service
  opens there, so expanding the map can never silently drop local law instead of
  replacing it. `tests/jurisdiction-scoped-requirements.test.mjs` pins the
  Montgomery County effective requirement set as unchanged.

This is a fairness change first — we should not make a provider in another
county clear another county's paperwork. It is also the mechanism that makes
expansion a reviewed decision rather than a config edit.
