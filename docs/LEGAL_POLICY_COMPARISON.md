# How Tuveloz's Legal Docs Compare to Similar Companies

_Internal owner notes, written August 6, 2026. This is a business comparison, not legal advice._

Peers compared: Thumbtack, Angi (incl. HomeAdvisor), TaskRabbit, YourMechanic / Wrench,
RepairPal, and Openbay — all US two-sided service marketplaces; the last four are
auto-repair specific.

---

## Bottom line

For a pre-launch, single-county marketplace, Tuveloz's legal set is unusually deep:
eight versioned policy documents plus supporting pages, where most companies this size
launch with two. In several areas (privacy transparency, policy version control,
Maryland repair-law compliance) Tuveloz is ahead of the billion-dollar peers. The two
open decisions that actually matter before launch are **arbitration** and **warranty**
(both detailed below). The rest is small gaps and housekeeping.

---

## Where Tuveloz is ahead of the peers

- **Policy version control.** Policies are gated by a release manifest
  (`config/policy-releases.json`) with SHA-256 hashes of the page source, unique
  release IDs, and CI verification. Customer and provider clickwrap records store
  exactly which document versions were accepted, and draft acknowledgments can never
  be mistaken for released ones. No peer publishes anything like this.
- **Privacy specificity.** The Privacy Policy names every subprocessor (Stripe,
  Cloudflare, Cloudmersive, Resend) with its function, discloses the Stripe Identity
  biometric flow in detail (verified name/DOB processed in memory only), offers a
  non-biometric verification alternative, commits to no data sales and no behavioral
  ads, and is backed by a working Privacy Center (export, correction, opt-out,
  appeal). Peer policies are far vaguer. The "reasonably necessary and proportionate"
  data-minimization language already matches Maryland's MODPA standard (enforced
  since April 2026), the strictest state privacy law in the country.
- **Maryland repair-law compliance built into the product.** Peers put "comply with
  local law" in a clause; Tuveloz implemented the Maryland Automotive Repair
  Facilities Act (Md. Commercial Law §§ 14-1001–1007) as software: written estimates
  on every job, the 10%-over-estimate consent rule, replaced-parts return options,
  the Customer's Rights notice rendered before signature, E-SIGN consent, and
  hash-stamped immutable invoices.
- **Honest verification language.** Evidence-checked status is defined as limited to
  the specific person, service, document, and validity period. Angi settled
  regulatory claims in 2025 for overstating how vetted its pros were; Tuveloz's
  wording already avoids that trap.

## Where Tuveloz diverges from the industry standard

1. **No arbitration clause or class-action waiver — by explicit choice** (Terms §13).
   Thumbtack, Angi, TaskRabbit, and Wrench all require binding individual
   arbitration (typically FAA/AAA rules, small-claims and IP carve-outs; Thumbtack
   offers a 30-day opt-out). Tuveloz's draft openly says it hasn't adopted
   arbitration, governing-law, or forum-selection clauses yet. Friendlier to
   customers, but the single biggest structural difference from every peer.
2. **No guarantee/warranty program.** Every major peer has one — see the warranty
   section below.
3. **No named privacy statutes.** Rights are described generically. The 2026 norm is
   a consolidated "US State Privacy Rights" section (CCPA/CPRA, Virginia, Colorado,
   MODPA), a "Your Privacy Choices / Do Not Sell" page, and honoring Global Privacy
   Control signals. Because Tuveloz sells no data and runs no ad cookies, much of
   that may not apply yet, but naming MODPA would cost little for a Maryland company.

## Gaps peers cover that Tuveloz doesn't

- **DMCA / copyright policy with a designated agent** — users upload photos and
  reviews; every peer has one. Cheapest win on this list.
- **SMS / TCPA terms** — Tuveloz sends login texts; Angi publishes mobile-alert
  terms separately.
- **Background-check statement** — peers either run checks or explicitly disclaim
  them; Tuveloz says nothing either way about criminal/driving history (identity and
  credential checks are covered).
- **Breach-notification commitment and concrete retention periods** in the Privacy
  Policy; an accessibility statement (though no peer verifiably publishes one either).

## Housekeeping

- Displayed "Last updated" dates disagree with code version constants and manifest
  `effectiveAt` dates (e.g. Privacy page shows Aug 1, 2026; `PRIVACY_VERSION` is
  2026-07-28; manifest effective is 2026-08-04). Same pattern on the Customer
  Agreement and Payments pages.
- `/safety`, `/service-standards`, `/repair-records`, `/job-evidence`,
  `/job-authorizations`, and `/job-operations` sit outside the hashed release
  manifest with no version entry.

---

## The warranty question (the decision to make)

> **DECIDED (August 6, 2026): Option B, made optional.** Providers may choose to
> offer the Tuveloz standard labor warranty (12 months / 12,000 miles on labor,
> honored by re-performing the covered labor at no additional labor charge), a
> different written warranty, or none — but the choice must be disclosed to the
> customer before quote acceptance and on the final invoice, and a stated warranty
> must be honored (enforceable under the Marketplace Conduct Policy). Tuveloz backs
> nothing itself. Implemented in Provider Agreement §8 and Customer Agreement §6,
> released as provider-agreement-2026-08-06 / customer-agreement-2026-08-06.

**The question in one sentence:** when a repair goes bad two weeks later, who is on
the hook to make it right — Tuveloz, the provider, or nobody?

Right now Tuveloz's documents say any warranty is the provider's and providers are
free to offer **none** (the invoice flow even has a "no provider express warranty
offered" option). That is the weakest posture in the industry for customer trust:
a customer whose repair fails may have no written recourse at all, and they will
blame the platform anyway.

### The three models

**Option A — Platform backs the warranty (YourMechanic / Wrench model).**
The platform itself warrants every repair: 12 months / 12,000 miles parts and labor
(90 days / 3,000 miles for oil changes); remedy is free re-repair or refund.
Maximum customer trust, maximum cost and risk. The platform pays when a provider's
work fails. Not realistic for a one-owner launch with a liability cap equal to the
platform fee.

**Option B — Providers must warrant their own work (RepairPal model). ← Recommended.**
The platform requires every provider, as a condition of being on the marketplace, to
give the customer a written warranty on their labor — industry floor is
**12 months / 12,000 miles** — disclosed on the invoice. The platform itself
guarantees nothing and says so. RepairPal requires exactly this of its certified
shops while disclaiming the warranty itself. This is the standard middle path:
near-zero cost or risk to Tuveloz (the obligation sits on the provider), and every
customer still leaves with a written warranty.

Why it fits Tuveloz specifically:
- The plumbing already exists: the final-invoice flow already captures warranty
  provider, terms, and limitations. The only change is policy — flip "warranty
  optional, may be none" to "minimum 12-month/12,000-mile labor warranty required."
- Tuveloz quotes are labor-only, so the warranty is naturally a labor warranty —
  no parts-warranty complexity.
- It preserves the existing legal posture (Terms §6: any warranty is the
  provider's, not Tuveloz's) — nothing about Tuveloz's own liability changes.

Concrete edits if Option B is adopted:
1. Provider Agreement: add a clause requiring a minimum 12-month/12,000-mile written
   warranty on labor for every completed job, honored at no charge to the customer.
2. Customer Agreement / Safety page: state that every Tuveloz job comes with the
   provider's minimum 12/12 labor warranty (a marketing plus, not just fine print).
3. Repair-records invoice flow: remove or restrict the "no provider express warranty
   offered" option for marketplace jobs so it can't undercut the requirement.
4. Marketplace Conduct / enforcement: refusing to honor a warranty claim becomes a
   conduct violation (payout review, suspension), which gives the requirement teeth.

**Option C — Status quo (warranty optional).**
Keep warranties fully up to each provider, including none. Cheapest today, weakest
trust story, and the outlier position among auto-repair marketplaces.

### Peer reference points

| Peer | What they promise |
|---|---|
| YourMechanic / Wrench | Backs repairs itself: 12 mo / 12,000 mi (90 days / 3,000 mi oil changes) |
| RepairPal | Certified shops must offer min 12 mo / 12,000 mi; RepairPal disclaims it |
| Thumbtack | Thumbtack Guarantee: $1,000 money-back, $100,000 property damage (capped, conditioned) |
| Angi | Happiness Guarantee: up to purchase price, booked-and-paid-through-Angi only |
| TaskRabbit | Happiness Pledge: up to $10,000, at TaskRabbit's sole discretion |

Note: the Thumbtack/Angi/TaskRabbit programs are *platform guarantees* (Option A
lite) — always capped, heavily conditioned, and separate documents incorporated into
the TOS. In the auto-repair vertical specifically, the 12-month/12,000-mile
provider warranty (Option B) is the recognizable standard customers expect.

### One caution

Option B is the low-risk choice precisely because Tuveloz promises nothing itself —
the obligation lands on providers. What still deserves outside review at some point
is any wording where **Tuveloz** starts guaranteeing outcomes (Option A or a capped
guarantee program), and the related open item in Terms §13 (arbitration /
governing law). Adopting Option B doesn't require reopening either.

---

## Sources (peer research)

- Thumbtack: thumbtack.com/terms, /privacy, /guarantee; help.thumbtack.com guarantee terms
- Angi: legal.angi.com; angi.com/happiness-guarantee.htm; angi.com/do-not-sell
- TaskRabbit: support.taskrabbit.com — Global TOS, Privacy, Happiness Pledge, AUP, Fees/Cancellation
- YourMechanic / Wrench: yourmechanic.com/terms-and-condition, /warranty; wrench.com/terms
- RepairPal: repairpal.com/terms_of_service, /certified, /faq-repairprice-guarantee
- Openbay: app.openbay.com/terms-of-service, /privacy-policy
- Stripe Connect: stripe.com/legal/connect-account
- Maryland: Md. Commercial Law §§ 14-1001–14-1007; MODPA analyses (OneTrust, Osano, Koley Jessen, Baker Donelson)

_Research caveat: peer clause details were verified from search excerpts of the live
policy pages; not every peer document was read end-to-end._
