# Medical bill auditing on contingency — assessment

- **Status:** active
- **Owner:** hello@tuveloz.com
- **Last reviewed:** 2026-08-24
- **Applies to:** new-venture evaluation; not a Tuveloz product change

Records the check of a proposed second business — auditing individuals' hospital
bills for coding errors and taking 25–40% of the savings — and why it is
recommended against **in Maryland specifically**, on facts that are not obvious
and that were not part of the original case.

## The verdict first

The business is real. Companies do it, they charge roughly what was proposed,
and errors on hospital bills are genuinely common. The idea is not a fantasy.

But three of the four premises it rests on are wrong, and the fourth — the
contingency structure — is the part that breaks first in practice. Most
importantly: **Maryland is close to the worst state in the country to run this
business**, for a reason that has nothing to do with competition and everything
to do with a state law that has been in place since 1971. The two largest
sources of savings in medical bill advocacy are both structurally unavailable
at Montgomery County hospitals.

The version of this idea that works is a different business, in a different
place, with a different fee structure. That version is sketched at the end.

## Checking the four premises

### 1. "60–80% of hospital bills contain errors"

This number is real in the sense that it is widely published. It is not real in
the sense of being measured by a disinterested party.

| Source | Error rate | Who they are |
| --- | --- | --- |
| American Medical Association (2013) | ~7.1% of paid claims | Physician trade group |
| NerdWallet (2014) | 49% of Medicare claims | Consumer finance publisher |
| Medical Billing Advocates of America | 75–80% | **Sells bill-auditing services** |
| CoPatient | ~80% | **Sells bill-auditing services** |

The spread is 7% to 80% — an eleven-fold disagreement — and it sorts almost
perfectly by whether the source earns money when the number is high. The 80%
figure traces to Medical Billing Advocates of America, whose founder describes
finding errors on three of four bills her own company reviews. That is a
statement about the bills people bring to an advocate, not about hospital bills
in general. Patients with an obviously wrong bill seek help; patients with a
correct bill do not.

None of this makes the number false. It makes it unverified, sourced from
interested parties, and unsafe to build unit economics on. The gap between "80%
of bills have an error" and "80% of bills have a *recoverable* error worth more
than the cost of pursuing it" is where the business either lives or dies, and
no source addresses it.

*This repository has a standing lesson about exactly this shape — see the
2026-08-17 entry in `LOG.md`, where a claim from a search result was written up
as settled fact by a session that could not reach a single host to check it.*

### 2. "Almost nobody serves individuals"

This is the premise that is simply incorrect. As of 2026 the individual market
has established paid players, free nonprofit competitors, and — the real tell —
a layer of affiliate comparison sites that only exists where there is commission
money to be earned:

- **Goodbill** — 20% of savings, capped at $1,000. Also screens for §501(r)
  charity care.
- **Resolve Medical Bills** — 10–25% tiered, no cap, **plus a $249–$499 upfront
  deposit**. Handles negotiation, appeals, financial assistance, and bills
  already in collections.
- **CoPatient**, **ClaimMedic** — same model, 20–30%.
- **Dollar For** — nonprofit, **free**, specialises in charity care screening.
- **Patient Advocate Foundation** — nonprofit, free.
- **mediloop, CareRoute, BillKarma, ClaimsMaximizer** — comparison and review
  sites ranking the above.

Two things follow. First, the category is not empty; it is competed, including
by well-funded operators and by free nonprofits, which are the hardest possible
competitor for a paid service aimed at people without money.

Second, and more useful: **Resolve charges an upfront deposit.** The most
established operator in the space, with the most experience of how these
engagements actually end, does not run pure contingency. That is not a pricing
preference. It is what the next section is about.

### 3. "Contingency kills all sales friction because there's no risk to the customer"

Contingency removes friction from the *sale*. It relocates the risk to
*collection*, where it is much worse, and it concentrates that risk in exactly
the customers the pitch is built around.

The $14,000 desperate person is desperate because they do not have $14,000.
Audit the bill, find $9,000 of errors, win the dispute, invoice your 30% —
$2,700 — and you are now an unsecured creditor of a person whose defining
financial characteristic is that they do not pay unsecured medical creditors.
You have no lien, no collateral, and no leverage, because the debt you were
hired to fight is gone and the relief has already been delivered. You cannot
repossess a corrected bill.

Worse, the incentive runs backwards at the top of the range. The larger the
saving, the more compelling the case study — and the poorer the client, the
larger the saving tends to be, because the biggest reductions come from charity
care and hardship discounts awarded on the basis of *not being able to pay*. The
best marketing outcome and the worst collection outcome are the same case.

This is the actual reason corporations sell to employers rather than
individuals. It is not that nobody thought of individuals. It is that the
employer pays reliably and the patient does not.

### 4. "A week of studying CPT and HCPCS codes gets you functional"

Two problems.

**Competence.** A week gets you able to read a bill. It does not get you able to
win an argument with a hospital revenue-cycle department that does this
full-time, has counsel, and has heard every objection. The credentials that
carry weight in that conversation — CPC (AAPC) or CCS (AHIMA) — take months of
study, and their function is precisely that the person on the other end takes
your finding seriously instead of sending a form letter.

**Licensing.** CPT is copyrighted by the American Medical Association. Any
entity that uses, references, or displays CPT content requires a licence from
the AMA or an authorised distributor, with royalty rates set annually (the 2026
distribution schedule took effect 1 January 2026). A business whose deliverable
is a written analysis citing CPT codes is squarely inside that requirement. This
is a real cost and a real compliance step, not a formality — and it is invisible
from the outside, which is why it is worth naming here.

## The Maryland problem

This is the finding that decides it, and it was not in the original case.

### Maryland hospitals cannot discount their charges

Maryland has operated an **all-payer hospital rate-setting system since 1971**,
administered by the Health Services Cost Review Commission. It is the only
arrangement of its kind in the United States. Under it, every payer — Medicare,
Medicaid, commercial insurers, self-insured employers, and uninsured
individuals — **pays the same rate for the same service at a given hospital**.
The HSCRC sets rates for 47 acute general, 3 specialty, and 3 private
psychiatric hospitals, covering over $16 billion in regulated revenue.

Hospitals may not charge one payer more than another, which means they may not
discount for one payer either.

Understand what this removes. In the other 49 states, the core move in medical
bill advocacy is attacking the chargemaster: an uninsured patient is billed a
list price that bears no relationship to what any insurer pays, and the advocate
negotiates it down toward something defensible. That gap — list price versus
real price — is where most of the headline savings in this industry come from.

**In Maryland that gap does not exist.** A $14,000 bill from a Montgomery County
hospital is $14,000 of state-regulated rates, not $14,000 of chargemaster
fiction. There is no inflated list price to negotiate away, because the
inflation the model depends on was regulated out of existence fifty-five years
ago. The single largest lever in this business is unavailable at every hospital
within driving distance of the intended customer.

### Maryland already mandates the second-largest lever

The other major source of advocate savings is enrolling patients in charity care
they did not know existed. Maryland has largely closed that gap by statute:

- The **Medical Debt Protection Act of 2021** (HB 565) requires acute and
  chronic care hospitals to provide free medically necessary care to patients
  under 200% of the federal poverty level, and to **determine eligibility at the
  time of service** rather than waiting to be asked.
- Hospitals may not charge interest or fees to a patient eligible for free or
  reduced-cost care, and may not sue to collect until 180 days after the initial
  bill.
- Companion legislation (HB 694) requires hospitals to **identify and refund**
  patients who qualified for free care but were charged and pursued anyway — an
  estimated **$200 million** returned to low-income Marylanders for 2017–2021
  alone.

So in Maryland the hospital is already legally obliged to screen the patient, to
refund them if it got it wrong, and to hold off collections meanwhile. An
advocate charging 30% to secure a benefit the hospital is required to determine
unprompted is selling a thin service, and competing against Dollar For, which
does charity care screening nationally for free.

### What is actually left

Genuine coding errors: duplicates, upcoding, unbundling, wrong modifiers,
services never rendered. These are real, they occur in Maryland like everywhere
else, and rate-setting does not protect against being billed for a procedure
that did not happen.

But this is the smallest of the three levers, the most technically demanding,
and the one furthest from "a week of study." The idea's home market strips out
the two easy sources of value and leaves only the hard one.

**The uncomfortable summary: this business is strongest in states where Tuveloz
has no presence, and weakest in the county where it operates.**

## What it would cost to start legally in Maryland

The fee model triggers financial regulation. Maryland's **Debt Settlement
Services Act** (Md. Code, Fin. Inst. § 12-1001 et seq.) covers any service that
negotiates, settles, reduces, or otherwise alters the terms of a debt between a
consumer and an unsecured creditor or debt collector. **An unpaid hospital bill
is an unsecured consumer debt**, and negotiating it down for a fee reads
squarely within that definition.

Confirmed requirements:

| Item | Requirement |
| --- | --- |
| Registration | Required to provide debt settlement services to any Maryland consumer |
| Registration fee | $1,000, non-refundable |
| Surety bond | $50,000 (costs roughly $750–$2,500/year in premium) |
| Fee timing | No fee until an agreement is executed **and** at least one specified debt has actually been settled or reduced |
| Prohibited fees | No charge for consultation, and none for obtaining a credit report |
| Fee basis | A percentage of the amount by which the principal debt exceeds what was paid to settle it, and the same percentage must apply to every debt |

Add the AMA CPT licence, professional liability insurance, a HIPAA-compliant
system for holding medical records released under patient authorisation, and
state data-breach obligations that attach the moment you hold other people's
medical records.

**Two questions are open and must be answered before a single client is taken:**

1. **Is there a statutory cap on the percentage?** § 12-1010 sets out how the
   fee is calculated but the maximum percentage could not be confirmed — see
   *Sources and what could not be checked* below. If a cap exists below 25%, the
   proposed 25–40% range is illegal in Maryland as written, and the business
   plan changes before it starts.
2. **Do any exemptions apply** (attorneys, nonprofits, or others), and does the
   Act's definition in fact reach medical debt?

Operating unregistered is the real risk here — not a fine at the end, but a
business whose contracts may be unenforceable and whose fees may be
recoverable by the consumer.

## The version that could work

Constructively, the failure modes above are addressable, but each one changes
the business:

**Audit-only, flat fee.** The regulatory exposure comes from *negotiating*, not
from *auditing*. A written analysis identifying errors, delivered to the patient
who then disputes the bill themselves, may fall outside a definition built
around negotiating and settling. That also solves collection — a flat fee is
charged up front for a deliverable, not chased afterwards out of someone's
savings. It converts the business from debt settlement into professional review.
**Whether it actually escapes the Act is a question for counsel, not for this
document**, but it is the most promising single change.

**Sell to employers, not patients.** This is what the corporates do, and now the
reason is clear: the payer is solvent and pays on invoice. It is a slower,
harder sale with no contingency romance, and it is the version with a working
collection model.

**Operate where the chargemaster gap exists.** Every state except Maryland. If
the intent is to serve individuals on contingency, the home-field disadvantage
here is severe and permanent.

**Take the credential first.** CPC or CCS, then decide. It is months, not a
week, and it is the thing that makes a hospital billing office answer the letter.

## Recommendation

**Do not start this as described.** Not because the business does not exist, but
because the case for it rests on a statistic sold by its beneficiaries, a market
described as empty that is not, a fee structure the leading operator has already
retreated from, and a location that removes two of its three sources of value.

There is also a focus argument, and it should be stated plainly rather than
implied. Tuveloz has applications open to real providers right now. Per
`OPEN-ITEMS.md`, all **18 launch gates are unanswered** and production holds
**zero recorded decisions**, with that item due 2026-08-25 — tomorrow. Starting
a second business that requires state financial registration, a $50,000 bond,
an AMA licence, and custody of strangers' medical records, while the first one
has open applications and no recorded launch decisions, is the largest risk in
this document. That is the owner's call to make, not this document's, but it
should be made with the position stated accurately.

**What would change this assessment:** a cap-free reading of § 12-1010 from
counsel, plus a decision to run audit-only and flat-fee, plus a target market
outside Maryland. That is a coherent business. It is not the one proposed, and
it should not be started by accident.

## Sources and what could not be checked

Verified by search on 2026-08-24. **Four primary legal sources were unreachable
from this environment** — `law.justia.com`, `mgaleg.maryland.gov`,
`www.labor.maryland.gov`, and `www.peoples-law.org` are all blocked by the
network egress proxy. The statutory details above therefore come from secondary
summaries, not from reading the statute. That is precisely the condition under
which this repository has previously recorded a wrong answer, so:

**Nothing in the Maryland Debt Settlement Services Act section should be relied
on for a go/no-go decision without reading § 12-1001 and § 12-1010 directly, or
asking the Office of Financial Regulation.** The HSCRC rate-setting facts and
the HB 565 provisions are better attested and came from multiple independent
sources including the Commission's own material.

- Health Services Cost Review Commission — all-payer rate setting, hospital
  counts, regulated revenue: <https://hscrc.maryland.gov/pages/about-us.aspx>
- Commonwealth Fund, Maryland all-payer approach:
  <https://www.commonwealthfund.org/publications/newsletter-article/maryland-all-payer-approach-nonpayment>
- Medical Debt Protection Act of 2021 (HB 565):
  <https://legiscan.com/MD/bill/HB565/2021> and
  <https://www.publicjustice.org/en/news/the-medical-debt-protection-act-passes/>
- AMA CPT licensing and 2026 royalty rates:
  <https://compliance.ama-assn.org/hc/en-us/articles/15166274293399-Notice-Standard-CPT-Distribution-Pricing-Schedule-2026>
- Error-rate figures and their attribution:
  <https://www.healthline.com/health-news/80-percent-hospital-bills-have-errors-are-you-being-overcharged>
- Competitor fee structures: <https://www.goodbill.com/patients>,
  <https://www.resolvemedicalbills.com/>
- Free nonprofit alternative: <https://dollarfor.org/how-to-negotiate-your-medical-bills/>
- No Surprises Act consumer protections:
  <https://www.consumerfinance.gov/ask-cfpb/what-is-a-surprise-medical-bill-and-what-should-i-know-about-the-no-surprises-act-en-2123/>
