DATA CLASSIFICATION: PUBLIC AND SYNTHETIC

## ACK_CORE_NONCE

IH-CORE-20260824-C41B7E

## CLAUDE_SESSION

Revenue opportunity brainstorm

## PRIMARY_PATH

**Path 2 — B2B audit workbench and back-office service sold to an already
authorized advocate, attorney, benefits adviser, union fund, or employer
program.** That counterparty owns the regulated judgment, the negotiation, and
all patient contact. We supply the analysis and the drafted paperwork; they put
it on their letterhead and decide what to do with it.

## CONTINGENCY_PATH

**Path 3 — no-PHI hospital price-file normalization and comparison.** Same
buyer, no patient data, no regulated activity, and it is a component of Path 2
rather than a detour from it. If Path 2's sales cycle stalls, this is what can
be sold while the Maryland question and the intake architecture are still open.

## WHY_PRIMARY_WINS

The decisive tradeoff is not speed against safety. It is **which asset the money
is paid for.**

Path 1 reaches a dollar fastest and it is the dollar most likely to be illegal.
On the § 12-1001 text as currently understood, a service represented "directly
or by implication" to reduce a balance owed to an unsecured creditor is debt
settlement, a hospital bill is an unsecured debt, and the penalty is not a fine
but an unenforceable agreement — every signed client worth less than nothing.
Path 3 is the safest and sells the weakest asset: price-file plumbing is
commoditized, several vendors already do it, and it is one input to an audit
rather than the audit.

Path 2 is the only one where **legal exposure falls because of who the customer
is, not because the product was amputated.** The Act, on its face, regulates
providing debt settlement services *for a consumer*. Selling analysis to a
professional who already holds the authority to represent, negotiate, and advise
is a different posture — the regulated act stays with the party licensed to
perform it. That is a reasoned position, not clearance, and it is now the single
most important open legal question (see QUESTIONS_FOR_ZEO_AND_CODEX).

Three further reasons it wins on the merits:

1. **It monetizes the actual asset.** The audit engine is the thing that took
   real work and holds real advantage. Path 4 sells a byproduct; Path 3 sells an
   input; Path 1 sells the engine wrapped in the maximum available liability.
2. **The buyer is findable and small in number.** Independent patient advocates
   and billing-advocacy practices are listed in public directories. A list of
   forty is an afternoon's work, and a person with hospital-side billing
   knowledge is credible to them in a way a software vendor is not.
3. **It is testable without PHI.** An advocate can send a redacted bill, or the
   pilot can run on synthetic cases. Path 1 cannot begin at all until intake
   architecture exists.

The honest cost: a longer sales cycle, and a buyer who may be too small and too
price-sensitive to pay. That is the failure mode below, and the seven-day test
is designed to find it fast rather than to confirm the choice.

## WHAT_TO_DO_WITH_TRAINING_PREVIEW

**Freeze it, keep any committed revenue, harvest the buyer list, and stop
building it.**

State the record honestly first: this session has no evidence a
billing-literacy workshop exists. A search of the current kit for "workshop",
"billing literacy", and "curriculum" returns zero hits across all 30 entries. If
it exists it was built in a session not visible here, so what follows is
conditional on it being real.

If it is real and an organization has already paid: honor it, deliver it, take
the money. It is zero-risk revenue and a credibility reference. But it does not
get another hour of build time, no feature requests are accepted, and it is
never described as the business. The single thing worth extracting is that **any
organization that bought billing literacy is a qualified lead for Path 2** —
they have already paid to solve this problem and discovered that education does
not fix a wrong bill.

Do not choose it. It was correctly flagged: already-built is not a reason.

## FIRST_PAID_OFFER

**Buyer.** An independent patient advocate or small medical-billing advocacy
practice in Maryland, DC, or Northern Virginia — the solo and two-person shops
that bill patients hourly and are capacity-constrained, not capability-
constrained. Secondary: benefits brokers, union benefits funds, employer
benefits programs.

**Deliverable — "second set of eyes."** They send a redacted itemized bill and
EOB; within two business days they get back a findings packet containing: an
itemized discrepancy list with the specific rule or arithmetic each line
violates, full arithmetic verification, service dates checked against the stay,
duplicate detection, line-by-line bill-to-EOB reconciliation, a financial
assistance eligibility screen against Maryland's statutory bands, and a draft
dispute letter with no branding, ready for their letterhead. Every finding is
graded DETERMINISTIC (provable from the documents) or REFERRAL (needs their
judgment). Nothing is asserted that cannot be shown.

**Price hypothesis.** $125 flat per bill, or $500/month for up to eight. Flat
professional fee billed to a business — deliberately not contingency and
deliberately not a consumer fee, which keeps it clear of the consumer fee rules
in § 12-1010. The pitch arithmetic: if it saves an advocate two hours they would
have billed at $100–200, it pays for itself on the first case. Untested; the
seven-day test is what makes it real.

**Explicit exclusions, stated in the offer itself.** We do not contact the
patient, the hospital, or the insurer. We do not negotiate. We do not represent
anyone. We do not give legal, coverage, or benefits advice. We do not file the
appeal. The advocate owns every judgment call and all client contact. No
protected health information is accepted until a BAA and a reviewed intake
exist — until then, redacted or synthetic documents only, and an automated
check refuses input containing identifiers.

## SEVEN_DAY_VALIDATION

Measurable, no PHI, every artifact synthetic. **All outreach is the owner's
action, not an agent's, and none of it starts before written outside-employment
clearance.** The prospect list must exclude the employer's health system, its
affiliates, coworkers, and shared vendors.

- **Days 1–2.** Build a list of 40 named advocates and billing practices in
  MD/DC/VA from public professional directories. Public information only.
- **Days 3–5.** Owner contacts 25 with one paragraph and one attachment: a
  findings packet generated from the synthetic fixture, showing eight real
  defects found in a bill that never existed.
- **Days 6–7.** Count.

**Thresholds set in advance, so the result cannot be reinterpreted afterward:**

| Metric | Pass |
| --- | --- |
| Replies from 25 | ≥ 8 |
| Discovery calls held | ≥ 3 |
| Paid pilot committed at ≥ $75/bill | ≥ 1 |

**Kill trigger.** Fewer than 2 replies from 25 means the buyer is not there, and
no amount of rewriting the email fixes that. Switch to the contingency path and
re-test against the same buyer with a data product instead of a service.

## CORE_MVP_WORKFLOW

1. **Intake.** Advocate uploads a redacted bill and EOB through a single-purpose
   encrypted channel — never email, never the Git relay. Pre-clearance: synthetic
   and redacted only, enforced by a validator that rejects input containing
   identifier patterns.
2. **Normalize.** Parse itemized lines into the structured case schema.
3. **Deterministic checks.** Arithmetic, line duplicates, service dates outside
   the stay, room nights against length of stay, quantity anomalies, billed
   exceeding the EOB allowed amount, non-covered flags. This exists today and
   scores 8 of 8 planted defects on the synthetic fixture with three explicit
   false-positive guards.
4. **Price comparison.** Match chargemaster lines against the hospital's
   published machine-readable price file, version-stamped so a finding can be
   reproduced against the exact file it came from. **Not built.**
5. **Consumer-protection screen.** Maryland hospital financial assistance bands
   (free care to 200% FPL, ≥75% to 250%, ≥60% to 300%, hardship to 500%), plus
   applicability checks for surprise-billing and facility-fee disclosure rules.
   The bands exist today; the applicability checks do not.
6. **Grade.** Every finding marked DETERMINISTIC or REFERRAL. Anything not
   provable from the documents goes to the advocate as a question, never as a
   claim.
7. **Deliver.** Unbranded findings packet plus draft letter, returned inside two
   business days.

## BUILD_NOW

Nothing here needs legal clearance, a client, or any real document.

1. **Price-file ingester** — CMS machine-readable file to a normalized,
   version-stamped table. This is simultaneously the missing step 4 of the
   primary path and the entirety of the contingency path. Highest leverage of
   anything on this list.
2. **Redaction spec and validator** — what an advocate must strip before
   sending, plus a checker that refuses non-compliant input. This is what makes
   a pilot possible before a BAA exists.
3. **Synthetic fixture set** — expand from one case to roughly six, covering
   distinct defect classes. Needed as regression coverage and as the sales
   sample.
4. **Advocate-facing packet template** — the current report speaks to a patient;
   a professional audience needs rule citations and terser language.
5. **INTAKE-ARCH design** — crosswalk, runtime, logs, backups, retention,
   deletion, incident response. Design only; it touches nothing real.

## BLOCKED_UNTIL_CLEARED

- Any real bill or EOB, redacted or not, until INTAKE-ARCH is reviewed and the
  BAA posture is decided.
- Any consumer-facing paid offer, until MD-1003 and MD-1002 resolve.
- Any outreach whatsoever, until written outside-employment clearance.
- Publishing, pricing pages, payment collection, contacting any prospect,
  regulator, hospital, or insurer — owner only, always.
- Zeo durable memory. Untouched. The deadline watch stays suspended; this
  decision does not lift it.

## BIGGEST_FAILURE_MODE

**The buyer set is too small and too poor.** Independent patient advocates are a
fragmented cottage industry of solo practitioners who are price-sensitive and
who already do this work by hand — which makes them simultaneously the most
qualified buyer and the least likely to pay for a tool. If 25 well-targeted
messages produce fewer than two replies, the problem is the market, not the
copy, and no iteration on the offer will fix it. That is why the kill trigger is
written before the test rather than after.

The second failure mode is quieter and worse: **one false positive ends a
customer relationship permanently.** An advocate who takes our findings to a
hospital and is wrong loses credibility they cannot rebuy, and they will never
send a second case. This has already happened once in development — a
date-comparison defect produced six false claims that would have gone into a
first letter. It is why findings are graded rather than asserted, why the false-
positive guards are tested explicitly alongside the detection tests, and why
"we found more" is never the goal.

## EVIDENCE_USED

Public and synthetic only. What each item actually is:

- **Audit engine, measured.** 8 of 8 planted defects detected on
  `synthetic-case-001.json`, with 3 explicit false-positive guards passing. One
  fixture, run today.
- **Kit acceptance gate, measured.** 30 entries scanned, 36 banned-pattern hits,
  all allowlisted, 0 unlisted. Run today.
- **Md. Health-Gen. § 19-214.1 assistance bands**, as implemented: 200% FPL free
  care, 250% at ≥75%, 300% at ≥60%, hardship ceiling 500%.
- **Md. Fin. Inst. § 12-1001 definition** — from a search summary, not primary
  text. Flagged as unverified.
- **§ 12-1010 consumer fee rules** — search summary, unverified.
- **§ 12-1006 registration fee, reported $1,000** — single source, unconfirmed.
- **§ 12-1003, the exemption list — UNKNOWN.** Four searches returned the
  heading only. Every primary source is blocked from this container, verified by
  four `EGRESS_BLOCKED` errors today on justia, labor.maryland.gov,
  peoples-law.org and legalfix.
- **Absence of a workshop product** — grep across all 30 kit entries for
  "workshop", "billing literacy", "curriculum": zero hits.

## FACTS_VS_ASSUMPTIONS

**Facts, checkable now.** The audit engine's scores and the gate results above.
The assistance bands as coded. The egress blocks. The absence of workshop
material in the kit. That the § 12-1003 text is not in this session's possession.

**Assumptions, load-bearing and untested.** That advocates in MD/DC/VA want a
second set of eyes badly enough to pay — untested, and the whole primary path
rests on it. That $125 per bill is near the right number — a hypothesis with
arithmetic behind it and no evidence. That a B2B posture materially reduces
Maryland exposure — reasoning from the statutory phrase "for a consumer," not
clearance, and it could be wrong in a way that matters. That CMS machine-readable
price files are available and usable at the hospitals in scope — widely reported,
not verified from a primary source in this session. That the workshop exists at
all.

**Explicitly not claimed.** Demand, profitability, legal clearance, HIPAA
compliance, or a live service. None of those is established, and nothing in this
document should be quoted as if one were.

## QUESTIONS_FOR_ZEO_AND_CODEX

**Codex — the question that now decides the primary path.** Beyond the § 12-1003
verbatim text already queued: does the Debt Settlement Services Act reach a
vendor that sells analysis and drafted paperwork **to a professional**, or only a
person providing services **for a consumer**? Quote the operative words. If a
covered "debt settlement services provider" is defined by who is served rather
than by the analysis performed, the primary path holds; if the definition reaches
anyone whose work results in a reduced consumer balance, it does not, and the
answer is register first.

**Codex — second.** Do Maryland's insurance-adviser, public-adjuster, or
navigator statutes reach compensated analysis of an EOB or coverage
determination, even when performed for a licensed intermediary rather than a
consumer? This is a separate licensing regime and it has not been examined.

**Codex — third.** Is a patient advocate a HIPAA covered entity or business
associate in the ordinary case? It determines whether a BAA with them is
available, meaningful, or neither, and therefore whether real documents can ever
flow on the primary path.

**Zeo.** Verify Codex's quoted text against the sources independently, per
MD-VERIFY. Flag disagreement rather than smoothing it. **No memory writes** —
nothing in this document or its answers becomes a durable lesson without the
owner's separate approval of the exact text.

**Both.** If either of you thinks Path 3 should be primary and Path 2 the
contingency, say so and say what evidence would settle it. The case for Path 2
rests on an untested demand assumption, and I would rather be argued out of it
now than after the first invoice.
