# Competitive landscape (owner-internal)

Where Tuveloz stands against companies running the same play, as of August 2026.
Internal strategy doc, not public copy, and not a commitment to build anything
listed here.

**Sourcing caveat.** The competitor facts below were gathered from search-result
summaries; primary pages (company terms, warranty text, pricing, SEC filings)
could not be fetched directly in the session that produced this. Treat every
external number — warranty terms, commission rates, service areas — as needing
re-confirmation against the company's own page before it is used commercially or
in marketing.

---

## 1. The four business models in this category

Everyone competing with us picks one. The choice determines the failure mode.

| Model | Who | What it buys | What it costs |
| --- | --- | --- | --- |
| Managed W-2 fleet | AutoNation Mobile Service (ex-RepairSmith), Spiffy, Firestone Direct | Quality control, brand trust, real warranty | Fixed labor cost against lumpy demand |
| 1099 marketplace, platform sets price | Wrench, YourMechanic | Coverage — 35,000+ zip codes | Quality variance, misclassification exposure |
| Open bidding marketplace | FixMyCar (UK), Openbay | Low fixed cost, provider self-selection | Price race unless the compare screen carries non-price signal |
| Lead-gen / certification | RepairPal (Yelp), Thumbtack, Angi | Best margins | No accountability for the outcome; small outcomes |

**Tuveloz is model 3 with model 1's compliance depth.** Providers write their own
quotes and set their own prices; we verify them harder than anyone in the
category does. That combination does not currently exist in the US market.

## 2. What the category's post-mortems actually say

- **AutoNation** wrote down **$65.3M of goodwill on its Mobile Service unit in
  Q2 2025**, with the CEO calling mobile service "both a challenge and a
  learning." Seattle and Portland listings show as closed. A $28B dealer group
  with free parts, free technicians, free brand and free capital could not make
  managed mobile repair pencil.
- **Wrench** covers the most ground and carries the most complaints — no-shows,
  arriving without tools, misdiagnosis, and diagnostic fees collected on jobs
  that then don't get done. That is the 1099-marketplace failure mode in its
  natural state.
- ***Provost v. YourMechanic*** (Cal. App. 2020) is the standing warning: a
  platform that sets the price, assigns the job, and controls the workflow
  invites a misclassification claim. **Our provider-sets-their-own-quote design
  is a legal asset, not just a philosophical one.** Maryland's tests differ from
  California's; counsel should review the Provider Agreement against the
  Maryland Workplace Fraud Act before live jobs.
- **ClickMechanic (UK)** — closest international model match — takes **20% of the
  booking**, buried inside the quoted price, and its worst reviews are
  specifically that the platform disclaims responsibility for the mechanic's
  work. Taking a real cut and standing behind nothing is the trap.
- **FixMyCar (UK)**, the largest pure-bid marketplace, concluded that open
  bidding alone under-serves quality and bolted an accredited tier (FixRated) on
  top in Dec 2024.
- **Openbay**, after 15 years of the post-a-job-get-quotes model: ~19 people,
  ~$3.8M revenue. Consumer acquisition for auto-repair marketplaces is brutal.
  But Openbay also produced the most useful number in this whole review:
  **for more than 70% of its transactions, the customer did not pick the lowest
  quote** — when the compare screen showed ratings, distance and amenities next
  to price.
- **GoMechanic** (India) collapsed in fraud after founders inflated revenue 5–6×.
  The structural lesson under the fraud is that the real unit economics were
  weak enough that fabricating them was easier than fixing them.

**Direction of travel 2024–2026: consolidation and retreat to B2B.**
RepairPal→Yelp, Curbside SOS→Honk, Yoshi's consumer fuel arm→EZFill with the
rest going fleet, YourMechanic→Wrench, Caroobi exited, Fixter→Renault. Meanwhile
ServiceUp raised $55M for fleet/insurance and Curbee grew 12× selling mobile
service *software to dealers*. No new venture-funded consumer mobile-mechanic
marketplace launched in the US in 2024–2026. Little competition for the space,
and no cavalry coming.

## 3. Table stakes vs. what we shipped

| Table stake | Universal among | Tuveloz today |
| --- | --- | --- |
| 12mo / 12,000mi parts-and-labor warranty | Wrench, YourMechanic, AutoNation, ClickMechanic, EZ Car Clinic, InstantCarFix | **Missing.** "Warranty" appears only as disclaimer text |
| Upfront fixed price, quoted = charged | Every survivor, same words | **Partial.** Quote-only; price guidance needs ≥3 completed jobs per service |
| Real booking with a real time slot | AutoNation (8am–6pm, 7 days), Wrench | **Missing.** `appointment` is a paused action; no provider calendar or availability windows |
| Payment through the platform | Wrench, AutoNation, ClickMechanic, CarAdvise | **Built** — Stripe Connect, separate-transfer payout released on completion evidence. Code-locked pending launch |
| Photo documentation of findings | Standard in shop DVI software; 15–30% higher ARO reported | **Built, and deeper than the category** — condition, progress, parts, completion, plus customer-approved change orders |
| Ratings/reviews visible before selection | All | **Missing in practice.** Table and API exist; zero reviews can exist pre-launch, no rating-driven ranking, no moderation or response flow |
| Vetting: certification, background, insurance | ClickMechanic sets the bar (5+ yrs, City & Guilds L2, liability + trade insurance) | **Exceeds it** — 33 evidence types, Stripe Identity, malware-scanned uploads, per-service competency gate, fail-closed defaults. But no ASE import and no criminal background check |
| Customer approves work before it starts | CarAdvise, ClickMechanic | **Built** — change orders with customer approval |

### Where we are genuinely ahead

1. **Per-service eligibility, not per-provider.** After the multi-level change, a
   provider's level is a property of each service they hold, so one business can
   carry standard battery work and specialty A/C at the same time and be gated
   independently on each. No competitor models competence this granularly —
   Wrench assigns whoever is nearest.
2. **County compliance is already in the product.** Montgomery County Chapter 31A
   requires any motor-vehicle repair merchant to hold an OCP Certificate of
   Registration, and requires a mobile mechanic to carry it on their person while
   working. `ocp_vehicle_service_registration` is a hard requirement on every
   service in `config/provider-eligibility-matrix.json`, on both pathways. The
   county also prescribes written repair-authorization and itemized-invoice
   formats — which our accepted-quote authorization and change-order flow already
   mirror in structure. **No national competitor will ever build county-specific
   compliance for one county.** This is the most defensible thing we own and it
   is currently invisible to both sides of the market.
3. **Bilingual as product, not a toggle.** Montgomery County is ~20–21% Hispanic.
   There is no bilingual mobile-mechanic marketplace in the US, and the only
   bilingual competitor in the DMV is a single-owner shop (Anywhere Auto Repair).
   The supply side may matter more than the demand side here: bilingual
   onboarding, quoting, change orders and payouts is a provider-acquisition
   weapon before it is a customer one.
4. **Evidence integrity machinery.** The owner pre-screen assistant cannot
   auto-accept — its only automatic action is a reversible, bilingual correction
   request for a provably expired document. Policy pages are SHA-256 pinned.
   Three independent code locks. Nothing in the competitive set is built this way,
   because nothing in the competitive set had to be.

### Where we are behind, ranked by how much it will cost us

1. **No warranty.** This is the single most universal promise in the category and
   we don't make it. A platform-backed 12mo/12k on parts and labor, funded from
   held payment, is also the answer to ClickMechanic's structural failure — they
   take 20% and stand behind nothing. Ours would be 5% and stand behind the work.
2. **No reviews at launch.** Cold-start problem: the compare screen is our whole
   product and it launches with price, distance and photos but no ratings.
   Openbay's 70% finding only holds if the screen carries non-price signal.
   Founding-cohort provider profiles and past-job photos have to carry that
   weight until reviews accumulate.
3. **No real scheduling.** "Confirm appointments" is promised in the provider
   copy on the homepage; there is no calendar, availability window, or time-slot
   picker behind it. AutoNation ships 8am–6pm seven-day slot booking.
4. **No instant/upfront estimate.** Every request is quote-only until a service
   has ≥3 completed jobs. That's honest but it makes the first-visit experience
   slower than every competitor's.
5. **Fee structure runs against the category.** Openbay, RepairPal, Thumbtack and
   CarAdvise charge consumers **nothing**; ClickMechanic hides 20% in the price;
   FixMyCar charges garages a join fee plus a success fee. **Every durable player
   monetizes the supply side or an enterprise partner.** Our 5% is customer-side
   and visible, which is defensible only if it visibly buys escrow, warranty and
   dispute resolution. And the arithmetic is thin: 5% of a $500 job is $25, which
   will not fund a support organization. The founding-cohort membership-fee waiver
   already implies a future supply-side line — that line is the real revenue plan
   and should be designed now, not later.

## 4. Who is actually in Montgomery County right now

Two national 1099 platforms with thin local execution — Wrench (Rockville,
Gaithersburg, Bowie, DC pages; may be SEO landing pages rather than live
coverage) and YourMechanic (Montgomery Village) — plus a set of one-to-five-van
independents: EZ Car Clinic (DC/Rockville/Potomac, 12mo/12k), Anywhere Auto
Repair (explicitly bilingual, the closest positioning competitor), Mobile Pro
Auto Service (ASE Master, MoCo + Frederick), J&J Benz (European specialist),
InstantCarFix. Spiffy has a Dulles VA location but does maintenance and detail,
not repair. AutoNation Mobile Service has no verified DMV presence.

**There is no marketplace layer, no escrow, no shared evidence workflow, and —
apart from one single-owner shop — no bilingual product anywhere in this county.**

## 5. The threat nobody in the local set is watching

Ford, GM, Stellantis and VW are paying their dealers incentives to launch mobile
service, and Curbee and BizzyCar are arming them with the software. Within about
24 months a customer's dealer may offer a mobile option with the factory warranty
behind it. Defensible ground: **out-of-warranty vehicles, older fleets,
multi-brand households, and price-sensitive or Spanish-speaking customers that
dealers underserve.** That is close to exactly who the launch service list —
battery, wipers, bulbs, fluids, cleaning, diagnostics — already targets.

## 6. What follows from this

Ordered by leverage, for later decision. Nothing here is committed.

1. **Design a platform-backed warranty** funded from held payment, and attach the
   5% fee to it explicitly in customer copy. It closes the biggest gap and turns
   our fee from a tax into a purchase.
2. **Build the compare screen so price is one of five signals** — past-job photos,
   response time, warranty terms, verified credentials, distance, ratings — and
   consider not offering a raw price sort by default. Openbay's >70% is the
   evidence this works.
3. **Make the compliance moat visible.** Surface "county-registered, verified"
   on provider profiles, and sell providers on the fact that we generate their
   county-compliant repair authorization and itemized invoice for them. Most
   solo operators are out of compliance and don't know it.
4. **Plan supply-side or partner monetization now.** The 5% will not carry the
   business alone.
5. **Ship real scheduling** before the homepage's "scheduling in one place"
   promise meets a customer.
6. **Never touch parts inventory.** Parts logistics is the recurring killer in
   this category — it makes vans expensive, causes the "arrived without the part"
   no-shows in Wrench's complaint log, and traps working capital. The Parts
   Checklist's deliberate refusal to price, source, or sell parts is the correct
   call and should stay that way.
7. **Density over coverage.** Every failure here died of thin coverage across many
   metros. Spiffy bought density; NuBrakes stalled at nine markets. One county,
   high repeat rate, referral-driven supply.
