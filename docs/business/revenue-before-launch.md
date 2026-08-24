# Revenue before launch — what can be sold while the marketplace is shut

- **Status:** active
- **Owner:** hello@tuveloz.com
- **Last reviewed:** 2026-08-24

What Tuveloz can charge money for **today**, given that every transactional
path is deliberately closed and should stay closed. Written as a decision, not
a menu: one recommendation, a ranked set behind it, and an explicit list of the
ideas that look like money and are not.

---

## The situation, without softening it

**Nothing on tuveloz.com can be bought.** Not one thing. Every customer path —
request, discovery, quote, booking, appointment, checkout, job start, scope
change, completion, payout — returns 503 by design, and the public provider
directory returns 503 with it. That is correct and it is not the problem to
solve. The problem is that a company with no purchasable object has no revenue
regardless of how much traffic it gets.

**The launch cannot fund itself.** `npm run readiness` reports zero recorded
decisions against the 18 gates in `lib/launch-readiness.ts`. Seventeen of the
eighteen name an outside authority — insurance carrier, CPA, payment processor,
legal or licensing source, security reviewer — and those people charge money.
Two of them (`evidence_file_security_and_scanner`,
`provider_identity_and_business_verification`) cannot be answered honestly at
all yet, because the scanner and identity providers are unconfigured. So the
sequence is: money, then sign-offs, then launch, then marketplace revenue. Not
the other way round.

**The one revenue lever already designed is the wrong one to pull first.**
`lib/customer-fee.ts` names a future *provider membership fee*,
`lib/founding-cohort.ts` permanently exempts the first twenty providers from it,
and `docs/COMPETITIVE_LANDSCAPE.md` concludes that supply-side monetization is
the real plan because 5% of a $500 job is $25 and will not fund a support
organization. All true. But a membership fee charged for access to a
marketplace with no customers is a fee for nothing.

So the question is narrower than "how do we make money": **what can Tuveloz
sell that is worth paying for even though the marketplace is closed?**

---

## The test an idea has to pass

Four rules. An idea that fails any of them is not a fast route to revenue, it
is a slow route to unwinding something.

1. **It does not require a lock to move.** `CUSTOMER_JOB_POSTING_PAUSED`,
   `STRIPE_LIVE_MODE_ENABLED`, `PHONE_SMS_LIVE_MODE_ENABLED` stay where they
   are. An idea whose first step is "flip a switch to test it" is dead here.
2. **It does not move money between strangers.** No Connect, no payouts, no
   escrow, no merchant-of-record question. Tuveloz sells its own thing to its
   own customer, or it does not sell.
3. **It survives the never-build list.** Nothing that sets a provider's price,
   assigns work, requires exclusivity, mandates a schedule, or makes buying
   from the platform a condition of anything
   (`docs/PROVIDER_CLASSIFICATION_DESIGN.md`).
4. **It is worth money to the buyer with the marketplace still shut.** This is
   the rule that kills most of the obvious ideas, and it is the important one.

---

## The kill list — ideas that look like money

Written down so they stop being re-proposed every few sessions.

| Idea | Why not |
| --- | --- |
| **Paid provider listings or featured placement** | There are no customers to be seen by, and discovery is gated at the API. Selling visibility that does not exist is not a business model, it is a refund waiting to happen. |
| **Selling customer leads to providers** | That *is* the marketplace, with the guards off. `request` and `discovery` are the exact actions the pause covers, and routing leads edges into assigning work. |
| **Fleet contracts where Tuveloz takes the job and subcontracts mechanics** | The fastest-looking money on this page, and the most expensive. It makes Tuveloz the party controlling the work, which trades away the classification the entire product is built to protect. |
| **Flipping a lock "just to test one real charge"** | A test charge is a real charge. The seventeen gates exist because outside parties have to sign, and none of them have. |
| **Display ads or affiliate links on site content** | Requires traffic that does not exist. Revisit when there is some. |
| **Charging for the founding provider spotlight** | It is a published free perk for the first ten. Monetising a promise costs more in trust than it returns in cash. |
| **"Post more on social"** | Not revenue. It is a demand-building input, and it belongs in the growth playbook, which already has it. |

---

## What survives, ranked

### 1. Sell the paperwork, not the marketplace — **recommended**

**The insight.** `lib/maryland-repair-records.ts` is a working implementation of
Md. Code, Com. Law § 14-1001 — the Customer's Rights notice, the consent rule
for exceeding an estimate by more than 10%, the return of replaced parts,
itemized lines carrying part condition and labor, the test-drive
certification. It was built as marketplace plumbing. It is also, on its own, the
thing most solo operators in this county are getting wrong today, and it is
worth something to them **whether or not Tuveloz ever opens**.

`docs/COMPETITIVE_LANDSCAPE.md` already spotted half of this — "most solo
operators are out of compliance and don't know it" — and filed it as a
marketing message for after launch. It is better than that. It is the only
sellable object the company currently owns.

**The ladder.**

| Step | What it is | Price | Who does it |
| --- | --- | --- | --- |
| Free | The blank pack — estimate/authorisation plus itemized invoice, print-ready | $0 | Built. `brand/repair-paperwork-pack/` |
| Now | The same pack with their business stamped on it, sent as a PDF | $49 | One command, ~10 minutes of owner time |
| ~60 days | A web tool that fills and stores them, with document-expiry reminders | ~$29/mo | Build, reusing `app/repair-records` |
| At launch | That subscription **is** the provider membership fee, founding 20 already exempt | — | Already architected |

**Why it passes the fourth rule.** A mobile mechanic needs a compliant estimate
for the job he is doing this Saturday, from a customer we did not send him. The
value does not depend on our launch date. Nothing else on this page can say
that.

**Honest size.** Twenty personalized packs is about $980, once. Twenty
subscribers at $29 is $580 a month. That does not save a company. What it does
is prove that a stranger will pay Tuveloz for something, and every buyer is a
provider lead who has just shown us their registration number and insurance
status — which is exactly the evidence
`config/provider-eligibility-matrix.json` is going to ask for anyway.

**The second-order effect is bigger than the revenue.** Provider outreach
currently opens with "apply to a marketplace that has no customers yet."
`brand/outreach/moco-outreach-worklist.md` plans five DMs a day against that
pitch. The same five DMs opening with "here is the Maryland paperwork you are
supposed to be giving customers, free, no signup" is a different conversation,
and the application becomes the second thing said instead of the first.

### 2. Insurance referral — through the broker the launch already needs

Every provider must hold general liability and business auto coverage, most
solo operators do not, and gate `platform_and_service_insurance_bound` requires
a conversation with a broker regardless. One meeting can do both: place
Tuveloz's own coverage, and ask whether they pay a referral fee for commercial
auto and GL placed with independent mechanics.

It aligns properly — the provider needs the coverage to be approved at all, so
the referral removes their blocker rather than extracting from them.

**Constraints that are not negotiable if this happens.** Optional, disclosed in
writing, never a condition of approval, and never the only broker named. A
platform that earns a commission on the insurance it requires has a conflict,
and the only way to hold that honestly is to say so on the page.

**Verify before committing:** Maryland rules on compensating unlicensed
referrals — a flat fee not contingent on the policy being bound is usually the
safe structure, but that is a question for the broker's compliance desk and
possibly counsel, not for a session.

**Owner action, not a code change.**

### 3. The consumer side — "did your shop follow the law?"

A flat-fee written review of a repair order: what § 14-1001 entitled the
customer to, whether the shop did it, and what to say next. Same knowledge,
opposite side of the market. It builds a customer list that currently contains
exactly one owner test signup.

Ranked third because it does not scale past the owner's hours, and because it
has a real trap: any published "fair price" number becomes platform price
signaling the moment the marketplace opens, which the never-build list forbids.
Keep it strictly about paperwork and rights. Never about price.

### 4. Not revenue, but the cheapest demand asset available

The Google Business Profile is still not live
(`brand/outreach/audience-growth-playbook.md` marks it the highest-intent
channel). It earns nothing directly and it is an hour of work. Everything on
this page gets easier with it and harder without it.

### Benched deliberately

Licensing the launch-gate and eligibility machinery to other marketplaces, and
running the Spanish content as an advertising property. Both are real. Neither
is reachable from here, and naming them is enough.

---

## The sequence

**This week.** Send the free pack with the next five outreach DMs. Stand up a
Stripe Payment Link for the $49 personalized pack — a first-party product sale,
no Connect, no marketplace object, nothing this repository gates. Put the
Google Business Profile live.

**30 days.** If the free pack converts to conversations at all, price the
subscription and build the web tool behind it. If it does not convert, the
answer is that this county's operators do not feel this pain, and that is worth
knowing for $0 rather than after a build.

**60 days.** Broker meeting: coverage for the gate, referral question in the
same hour.

**90 days.** Whatever revenue exists goes at the outside sign-offs, cheapest
first, in the order `docs/business/launch-gate-briefing.md` sets out.

---

## What is already built

`brand/repair-paperwork-pack/` — both forms, generated from the statute
implementation so they cannot drift from it, with
`tests/repair-paperwork-pack.test.mjs` failing the build if they do.
`npm run pack:repair-docs` regenerates them; the same command with `--business`
stamps a personalized pack, which is the entire fulfillment cost of the $49
product.

## What needs a person

- Decide the price. $49 is a starting number, not a researched one.
- Create the Stripe Payment Link. Owner's account, owner's decision.
- Confirm Maryland's sales-tax treatment of a digital product and, later, of a
  software subscription — a CPA question, and one that overlaps the
  `cpa_tax_mor_and_transaction_map` gate, so it is worth asking once and
  recording the answer.
- The broker conversation.
- A reviewed Spanish translation of the pack. The statutory notices stay in
  English; a Spanish courtesy sheet alongside them would double the reachable
  audience in this county, and this repository does not ship unreviewed
  Spanish.
