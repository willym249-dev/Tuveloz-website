# Morning Ads — provider recruitment, data-led

Phase: pre-launch (provider onboarding open, customer requests **not** live).
Goal: provider applications at https://tuveloz.com/join
Audience: MoCo solo mobile mechanics, detailers, roadside/jump-start operators.
Companion to [provider-recruitment-ad-01.md](provider-recruitment-ad-01.md) (the
15s recruitment reel) and `../outreach/audience-growth-playbook.md` §3 Lever 4.

**Narrative source of truth: `brand/SALES_PITCH.md` §5, §7, and §14.** Every
claim below is drawn from it. Its §14 claim guardrails bind this document and
win any disagreement. ⚠ That file currently lives only on the unmerged branch
`claude/sales-pitch-document-test-k2cm9k` with **no PR open** — until it lands,
the link above dangles.

**What's different about these.** Ad 01 sells a feeling — *be your own boss*.
Every operator in MoCo has been sold that feeling by four platforms already, and
it slides off. These units lead with **one verified number** instead, in the
morning slot, before the first job of the day. A number that describes the
provider's own economics is the only thing that reliably stops a scroll from
someone who has heard the pitch before.

Credits used: 0. Every unit below is text-on-brand or reuses existing
`ad-01-assets/` frames — deliberately, see §6 on the music license.

---

## 1. The research base

Everything a unit is allowed to claim comes from this table. Pulled 2026-08-07.
Nothing goes into copy that isn't in here with a source next to it.

| # | Finding | Figure | Source (date) |
|---|---|---|---|
| R1 | US shop labor rate, independent-shop benchmark | ~$140/hr; US average $132/hr, range $85–$197 by state | Tekmetric / AutoLeap state surveys, 2026 |
| R2 | Vehicle maintenance & repair CPI, year over year | **+4.9%** Jan 2025 → Jan 2026; **+43.6%** since Jan 2019 | BLS via Repairer Driven News, 2026-02-17 |
| R3 | Technician pipeline vs. demand | Schools fill **42%** of annual demand across sectors; **automotive supply covers 59%** of demand | TechForce *Supply, Demand & Opportunity*, May 2026 |
| R4 | Average age of US vehicles in operation | **12.8 years** (record); passenger cars 14.5 | S&P Global Mobility, 2025-05-21 |
| R5 | Mobile / on-demand vehicle repair growth | ~**8–9% CAGR** through 2030–2034 (multiple houses, 7.8–9.8%) | Mordor Intelligence, Research & Markets, 2026 |
| R6 | Pay-per-lead cost on incumbent marketplaces | Angi **$15–$85+/lead** plus ~$300/yr; Thumbtack **$20–$60** typical; leads shared with **3–8** pros | Angi/Thumbtack cost surveys + BBB/Reddit reports, 2026 |
| R7 | Independent work is now a choice, not a stopgap | **76%** of independent workers call it a permanent career choice; 72.9M US independent workers | MBO Partners / Quicken survey, 2025–26 |
| R8 | MoCo market size | ~1.07M people, ~389,000 households, **21.7% Hispanic** | Census QuickFacts / ACS 2024, via USAFacts & Montgomery Planning |

**Gap, flagged not fudged:** the Maryland MVA county-level vehicle registration
count (dataset `db8v-9ewn` on opendata.maryland.gov) is the one local number
that would beat all of the above, and the session's network proxy blocks that
host. **No unit below claims a MoCo vehicle count.** Pull it manually, drop it
in R8, and unit M2 gets materially stronger.

---

## 2. What the numbers actually argue

Three lines of argument fall out, in descending order of expected punch.

**A. The lead-fee argument is the strongest one we have (R6 vs. our model).**
This is the only place where a verified outside number and our own pricing sit
in direct opposition. A pro paying $15–$85 for a lead that went to seven other
pros is paying *before* he knows there's a job. Tuveloz charges providers
nothing, ever, at any stage — the 5% is customer-side. That contrast is
concrete, checkable, and about his wallet this morning. **Lead with it.**

**B. The market is moving toward him, not away (R2 + R4 + R5).** Cars are older
than they have ever been, repair prices are still climbing faster than general
inflation, and mobile service specifically is growing ~8–9% a year. The solo
operator's read on his own trade — *there's more work than there used to be* —
is correct, and we can show it. This is the "you're not crazy" unit.

**C. Scarcity is his leverage (R3 + R7).** The pipeline fills 42% of demand.
He is the scarce thing, and 76% of independent workers have already decided
this is a career, not a gap year. That reframes signing up: not *please pick
me*, but *set your terms*.

What we deliberately do **not** argue: anything about earnings. R1's $140/hr is
a shop rate, not his, and quoting it near a signup CTA reads as an income
implication. It appears in §5 as a *customer-education* card only, never in a
provider unit. Same for R5's market size — a growing market is not a promise of
jobs, and the outreach kit's honesty rules bind here exactly as they bind DMs.

---

## 3. Why morning, honestly

The general social-timing research says the opposite of what this doc's title
implies, and that's worth stating plainly rather than burying:

- Sprout Social (≈2B engagements, 307k profiles, 2026) puts Facebook's steady
  band at **Tue–Thu 8am–3pm** and Instagram's at **Mon–Fri 9am–4pm**, and calls
  **before 8am the weakest window** on most days.
- TikTok is the exception and the disagreement. Multi-million-post studies
  identify a **6–9am "morning acceleration window"**, with Thursday 6–9am among
  the strongest single slots — while Sprout's own cut favors Tue–Thu 2–6pm.
  Consensus across studies: on TikTok, timing matters less than first-hour
  engagement velocity.

So the honest position is: **general-audience data does not endorse a 6am post.
This audience is not the general audience.** A one-person mobile operator is
not on a laptop at 11am on a Wednesday — he is under a hood, or driving. The
two moments his phone is in his hand and his own business is on his mind are
**before the first job** and **after the last one**. That's a claim about this
trade, not a finding from Sprout, and it must be labeled as the hypothesis it
is and then tested.

**Therefore:**

| Channel | Treatment | Reasoning |
|---|---|---|
| **Paid (Meta/TikTok, MoCo radius-fenced)** | Run the morning schedule: **6:15–8:00am** and a smaller **6:00–8:30pm** arm | Ad scheduling is where a daypart hypothesis is cheap to test — $5–10/day per §Lever 4 |
| **TikTok organic** | Post 6:30–7:30am, Tue–Thu | The only platform whose own data supports the morning window |
| **Instagram / Facebook organic** | Post **9–11am**, not 6am | Follow the published data; there's no reason to fight it for free reach |

Run the paid morning arm against a midday control for two weeks (§7). If cost
per `/join` click in the morning arm doesn't beat midday, the hypothesis is
wrong — kill the morning slot and say so in this file rather than defending it.

---

## 4. The format: "Morning Number"

One recurring unit, one number per drop, same frame every time. Repetition of
frame is what turns individual posts into something recognized at 6:40am; the
number is what makes each one worth stopping for.

**Card spec (9:16, 1080×1920; also export 1:1 1080×1080):**

- Top third: the number alone, oversized, brand color on brand background.
- Middle: one line of plain-language context, ≤10 words.
- Lower third: the Tuveloz counter-fact, one line.
- Footer: `tuveloz.com/join` · Tuveloz lockup
  (`brand/tuveloz-lockup-horizontal.svg`) · small source line in 3–4% grey.
- **The source line is not optional.** A stat card without a visible source is
  the exact thing this audience distrusts, and printing it is what separates
  this from the ads they scroll past.
- Bilingual: every unit ships EN and ES as separate creatives, not one bilingual
  card. ES is a 21.7%-of-county audience (R8) that nearly nobody is buying ads
  against — per the playbook, the most underpriced channel available.

---

## 5. The units

### M1 — "$85 a lead" (argument A) · **run first**

> **$15–$85**
> What other platforms charge a pro for **one lead** —
> shared with up to 7 other pros.
> **Tuveloz charges providers nothing. Not per lead. Not per month.**
> tuveloz.com/join
> *Source: 2026 Angi / Thumbtack contractor cost surveys*

ES:
> **$15–$85**
> Lo que otras plataformas le cobran por **un solo contacto** —
> compartido con hasta 7 profesionales más.
> **Tuveloz no le cobra nada al proveedor. Ni por contacto, ni al mes.**
> tuveloz.com/join

Caption add-on (both): *You set your price and keep 100% of what you quote —
the customer pays the site's small service fee, not you. Customer requests open
after launch review, so applying now means you're ready on day one.*

> **Why the caption says "small service fee" and not "5%."** The 5% is
> **proposed**, pending tax-adviser, payment-processor, and insurance sign-off —
> every legal page says so. Ad copy is exactly where a proposed number gets read
> as a committed price. State the rate only where "proposed" fits alongside it.

### M2 — "12.8 years" (argument B)

> **12.8 years**
> The average car on the road is older than it has ever been.
> **They all need somebody. Montgomery County is signing up providers now.**
> tuveloz.com/join
> *Source: S&P Global Mobility, 2025*

ES: **12.8 años** — El carro promedio en la calle nunca había sido tan viejo. /
**Todos necesitan a alguien. El Condado de Montgomery está inscribiendo
proveedores ahora.**

*(If the MVA county registration number gets pulled, lead this card with it
instead — a MoCo figure beats a national one every time.)*

### M3 — "42%" (argument C)

> **42%**
> The share of the country's demand for techs that training programs
> actually fill.
> **You're not competing for a spot. You're the scarce part.**
> Set your own prices on Tuveloz — free to join.
> tuveloz.com/join
> *Source: TechForce Foundation Supply & Demand Report, 2026*

ES: **42%** — La parte de la demanda nacional de técnicos que los programas de
formación alcanzan a cubrir. / **Usted no está compitiendo por un lugar. Usted
es lo escaso.**

### M4 — "+4.9%" (argument B, price-transparency pillar)

> **+4.9%**
> Car repair prices, this year alone. **+43.6% since 2019.**
> Customers are shopping harder than ever — Tuveloz is where they compare
> quotes and pick a provider themselves.
> Join free before launch: tuveloz.com/join
> *Source: BLS Consumer Price Index, motor vehicle maintenance & repair*

ES: **+4.9%** — El precio de la reparación automotriz, solo este año.
**+43.6% desde 2019.**

### M5 — "76%" (argument C, build-in-public pillar)

> **76%**
> of independent workers now call it a career, not a stopgap.
> **Then it should come with terms you set.** Your prices. Your schedule.
> No exclusivity — keep every other platform you're on.
> tuveloz.com/join
> *Source: Quicken / MBO Partners independent-workforce data, 2025–26*

ES: **76%** — de los trabajadores independientes ya lo consideran una carrera,
no algo temporal. / **Entonces debería tener condiciones que usted ponga.**

### M7 — "$0" — chargebacks and processing (argument A, second wave)

From `SALES_PITCH.md` §7: Tuveloz is set as both `fees_collector` and
`losses_collector` on Connect, so **the platform absorbs Stripe fees and
chargeback losses instead of clawing them back from providers.** No incumbent
lead-gen platform can say this, and no operator expects it — which is exactly
what makes it stop a scroll on the second exposure, after M1 has established
the fee contrast.

> **$0**
> What a chargeback costs you on Tuveloz.
> **The platform absorbs processing fees and chargeback losses. Not deducted
> from your payout.**
> tuveloz.com/join

ES: **$0** — Lo que le cuesta un contracargo en Tuveloz. / **La plataforma
absorbe las comisiones de procesamiento y las pérdidas por contracargos. No se
descuentan de su pago.**

### M8 — "Labor only" (argument A, differentiator)

> **You never front the parts.**
> Quotes on Tuveloz are labor-only — the customer buys the part.
> **No parts markup, no inventory, no eating a wrong-part trip.**
> tuveloz.com/join

Enforced server-side (`LABOR_ONLY_QUOTE_REQUIRED`), so this is a product fact,
not a positioning line. Do **not** extend it into "Tuveloz sources the part" —
§14 forbids any claim that Tuveloz sells, sources, verifies, or handles payment
for parts.

ES: **Usted nunca adelanta las piezas.** — Las cotizaciones en Tuveloz son solo
de mano de obra; el cliente compra la pieza.

### M6 — "$140/hr" — **customer-facing only, do not run in the provider set**

> **~$140/hr** is the going independent-shop labor rate in 2026.
> Know what you're being quoted before you say yes.

Price-transparency pillar for the customer audience per the playbook §4. It is
listed here so nobody moves R1 into a provider unit later: next to a `/join`
CTA it reads as an earnings claim, which the honesty rules forbid.

---

## 6. Claim safety — read before editing any copy

`SALES_PITCH.md` §14 is the full binding list and overrides anything here. The
ones that bite hardest in ad copy specifically:

- Never imply customers can book or pay today. Every provider unit carries the
  pre-launch line in the caption if not on the card.
- **Never state the provider share as anything but 100%.** Providers keep 100%
  of their quoted price; the 5% Customer Service Fee is customer-side and is
  added on top, never deducted.
- Never promise income, job volume, or a number of jobs. No unit here states or
  implies earnings — check any new one against this before it ships.
- Never promise founding-provider perks beyond what `/founding-providers`
  publishes. Linking that page is fine and encouraged; inventing a perk is not.
- **Never say founding providers get "first pick of jobs"** or any routing or
  ranking advantage. They deliberately get none — it's barred in
  `lib/founding-cohort.ts`. See the live site contradiction flagged in §8.
- Never state the 5% as final. It is **proposed** (§14). Prefer "small service
  fee" in creative.
- Never say "escrow," "trust account," or "deposit" for held funds.
- Never imply Tuveloz sells, sources, verifies, or handles payment for parts.
- **Publicity consent is never implied.** The Provider Agreement has no likeness
  clause — a provider's name, business name, or photo needs explicit written
  permission, asked every time. This governs every spotlight creative.
- Launch services only: battery/jump start, wipers & bulbs, fluid top-off,
  detailing, basic diagnostics. No towing, tires, or A/C.
- Every stat on a card keeps its visible source line and stays inside its cited
  range. Don't round $15–$85 up to "$100." Don't restate 12.8 years as "13."
- Label AI-generated creative wherever the platform asks.

**Music licensing — why these are static cards.** Per
[HANDOFF.md](HANDOFF.md), the Epidemic Sound track behind Ad 01 sits under a
**canceled subscription whose window closes Aug 9, 2026** — two days out. Every
unit in this doc is silent text-on-brand or reuses already-licensed
`ad-01-assets/` frames, so the morning campaign can launch regardless of how the
music question resolves. Don't add a stock track to these without checking that
file first.

---

## 7. Two-week run plan

Budget per playbook Lever 4: **$5–10/day**, radius-fenced to Montgomery County,
optimizing for link clicks to `/join` — not follows, not video views.

**Fence it to the served area, not to "Maryland."** The product enforces
**45 ZIP codes and 36 municipalities** under jurisdiction
`US-MD-MontgomeryCounty` (`lib/service-matching.ts`). Anchor the ad geo on
Silver Spring, Rockville, Gaithersburg, Germantown, Wheaton, Bethesda, Takoma
Park, Montgomery Village, Aspen Hill, Olney, Kensington, Damascus. A click from
a provider outside the fence costs the same and can never convert — he'd apply
and be turned away, which is worse than never reaching him.

Pre-flight: the §2 profile floor in `audience-growth-playbook.md` must be met
first. Traffic hitting a three-post grid is money spent twice.

| Week | Arm | Creative | Slot |
|---|---|---|---|
| 1 | Morning (test) | M1 EN + M1 ES | 6:15–8:00am |
| 1 | Midday (control) | M1 EN + M1 ES | 11:00am–1:00pm |
| 2 | Morning, winner-of-week-1 slot | M2, M3 rotated in | as above |
| 2 | Evening (second test) | M1 | 6:00–8:30pm |

Organic alongside: M1–M5 as TikTok posts 6:30–7:30am Tue–Thu; the same cards
to IG/FB at 9–11am. One card serves all four platforms.

**What to read, in order:**

1. **Cost per `/join` link click, morning vs. midday.** The only number that
   decides whether the morning slot survives. Everything else is context.
2. **Provider applications by source** — `/admin/analytics-funnel` already
   carries the funnel. This is the number that decides whether *the campaign*
   survives.
3. **ES vs. EN cost per click.** If ES wins on cost, shift the split; the
   hypothesis in §4 says it should, and that's worth knowing early.
4. **Which argument wins** — A (lead fees), B (market), or C (scarcity). Feed
   the winner back into the DM templates in `provider-outreach-kit.md`; the ad
   test is the cheapest way to find the sentence that works in a DM.
5. **Audience locality.** If MoCo isn't the top cluster, the fencing is wrong
   and nothing else in the report means anything.

**Kill conditions, decided now so they aren't argued later:** if after two weeks
the morning arm doesn't beat midday on cost per click, drop the morning slot and
amend §3. If applications from paid stay at zero across both arms, the answer
isn't more creative — it's that the budget belongs in 1:1 outreach and Google
Business Profile, exactly as the playbook §6 says.

---

## 8. Blocking issue — fix before spending

**The homepage founding banner contradicts the founding program and the code.**
It reads *"The first mechanics into Montgomery County get first pick of jobs…"*
Founding rank is barred from influencing routing or ranking
(`lib/founding-cohort.ts`), and `founding-provider-program.md` refuses that perk
in writing as the one that would turn "customer choice" into paid placement.

This is the only claim on the site that cannot be delivered, and driving paid
traffic to it means paying to send providers to a promise we will have to walk
back — to the exact 20 people the marketplace depends on, who talk to each
other. Reword the banner to the perks that are real (permanent membership-fee
exemption, spotlight, tenure badge, first access to new categories, direct line
to the owner) **before** the first dollar of spend.

Surfaced in `SALES_PITCH.md` §14; not fixed by this campaign.

---

## 9. To do

- [ ] Pull MoCo vehicle registrations from Maryland Open Data (`db8v-9ewn`) —
      blocked by the network proxy in-session, needs a manual pull. Then
      rewrite M2 around the local figure.
- [x] **Rendered.** `build-morning-cards.py` writes all 28 creatives (M1–M5,
      M7, M8 × EN/ES × 9:16 and 1:1) into `morning-cards/`. Zero credits, no
      stock footage, no music — nothing here depends on the Epidemic licence.
      Copy lives in §5 of this file; change it there first, then in the script.
- [ ] M6 is customer-facing and deliberately not rendered with the provider
      set — build it only when the customer audience is being posted to.
- [ ] Re-verify every figure in §1 before any drop after **2026-11-07**. Stat
      cards age badly, and a stale number in front of this audience costs more
      credibility than it buys attention.
