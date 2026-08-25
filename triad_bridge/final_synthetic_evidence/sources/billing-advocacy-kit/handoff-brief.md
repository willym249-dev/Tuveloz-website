# Handoff brief — read this before doing any work on this project

> **SUPERSEDED PRODUCT DIRECTION.** This file preserves the original tabletop concept. The exact Claude tab, Codex, and local Zeo later agreed that the core path is a synthetic-only B2B evidence-workflow sprint for an established professional firm, not a consumer free pilot or a training business. No live sale or service is cleared; use the newer triad decision and legal-review packet for current direction.

For any assistant joining this work: Claude, GPT, Zeo, or a future session of any of them. Self-contained on purpose. If you are picking this up cold, this is the whole picture.

---

## What the business is

A Maryland medical bill review service, running as a **free pilot**.

A client hands over their hospital bills. We go through them line by line, prepare a written packet of everything worth questioning with a source cited for each point, and **they** review it, sign it, and send it. We do not charge, do not represent anyone, and do not speak to a provider or plan on anyone's behalf.

**No fee of any kind exists while the pilot runs** — no percentage, cap, deposit, card hold, or success trigger. That is not modesty: Maryland's debt-settlement classification of this service is **unresolved**, and a fee tied to a reduction is the single element most likely to fall inside it. Nothing changes until written classification arrives from OFR or Maryland counsel covering the exact service, advertising, channel, agreement, representation, and fee trigger.

The owner works at a hospital. That is the operating advantage — knowing which department resolves things and what words make a request get actioned — and it comes with one absolute prohibition, in the Wall section below.

## What the business is NOT

Getting these wrong is how this ends badly, so they are stated as prohibitions rather than preferences.

1. **Not legal advice.** We raise possible discrepancies and cite published sources. We never advise anyone on their legal rights, and we never state that a charge is wrong.
2. **Not medical advice.**
3. **Not public adjusting.** We never touch a homeowners, auto, or property damage claim. Negotiating one for compensation requires a licence and is a **criminal** offence in eleven states. Health insurance appeals are a different world and are fine.
4. **Not debt settlement.** See the Maryland section — this one shapes the entire scope.
5. **We never hold client money.** Every payment goes directly from client to provider.

## Scope — exactly four services

| Do | Do not |
| --- | --- |
| Review itemized bills line by line and produce **candidate questions** with sources | **Charge anyone anything** |
| Prepare an assistance application for the client to submit | **Negotiate a balance** with a creditor |
| Prepare an appeal for the client to file, with the deadline worked out | **Represent, call as, or speak for** anyone |
| Cover every separate bill from the same visit | Assert a coding or clinical conclusion from a bill alone |
| Coach the client through their own call | Hold or route client funds |

The right-hand column is not squeamishness. Balance negotiation is debt settlement under Maryland law and requires NMLS registration — the reasoning is below.

---

## Maryland is the whole product

Do not produce generic national advice for this business. Maryland differs from the other 49 states in four ways that matter, and the differences are the product.

**1. Free care is statutory.** Hospitals must give free medically necessary care at or below **200% FPL** and reduced-cost care below **500% FPL** with hardship. Income counts as of service **or as changed within 240 days after the first bill** — so ask every client whether their income dropped after the bill arrived. It is easy to overlook and it can reopen a case that looks closed.

**2. Rates are regulated.** Maryland is the only state where a commission (HSCRC) sets hospital rates for all payers. Use it as a question — *"can you show me how this reconciles to the HSCRC-approved rate structure?"* — never as a threat, and **never claim every Maryland patient pays an identical price.** Recent changes mean rates vary by payer category and hospitals can vary amounts between patients within an aggregate cap. Overstating this in front of a Maryland billing office destroys credibility instantly.

**3. Facility fees have a paper trail.** The Facility Fee Right-to-Know Act requires oral and written disclosure at the **time of scheduling**, with a signed acknowledgment. So the question is not "is there a facility fee" but *"can you produce the signed acknowledgment?"* Most patients do not remember signing one.

**4. Debt protections are strong, and one is a lever.** Medical debt may not be reported to credit bureaus by providers, their agents, or collectors. Hospitals may not charge interest to anyone who qualifies for free or reduced-cost care. No lien on a primary residence. And a provider–collection agency contract that lacks the credit-reporting prohibition is **void and unenforceable**.

**The Debt Settlement Services Act is the constraint that shapes scope.** It requires NMLS registration for any service that "negotiates, settles, reduces, or in any way alters the terms" of a debt with an unsecured creditor. A medical bill is unsecured debt. Asking a hospital to take $4,000 on an $8,000 balance is squarely inside that.

**No service is classified as outside the Act.** Earlier versions of this kit said appeals were "clearly outside" and error correction was outside. Both overstated. The arguments differ in strength — appeals strongest, assistance advocacy weakest — but an argument is not a classification, and no document here may claim otherwise until written guidance arrives.

The product shape that follows: **we prepare the packet, the consumer signs and files it.** That is a risk-reduction choice made while classification is unresolved. **It is not a determination that the work falls outside the Act** — nobody has told us that, and this kit may not claim it.

---

## Escalation ends at HEAU, and that is a Maryland advantage

Maryland's Attorney General runs the Health Education and Advocacy Unit — **free** mediation for medical billing and insurance disputes, including financial assistance applications and debt collection. Their published outcome rates are on their own site; 52% of medical necessity cases, 47% of coverage decisions, 57% of eligibility denials overturned or modified.

Two implications, and both matter:



**No pricing conversation happens yet.** The pilot charges nothing, and earlier drafts of this kit modelled a 20% contingency that no longer exists. Do not reason from it.

---

## The de-identification rule — applies to every assistant, no exceptions

**Strip identity before any model sees a bill.** Remove name, date of birth, address, medical record number, account number, and any other direct identifier. Replace with a file number.

This works because **the audit does not need identity.** Finding a duplicate CPT code, an unbundled pair, a discharge-day room charge, or a quantity that exceeds the possible does not require knowing whose bill it is. What the analysis needs is codes, quantities, dates of service, charge amounts, and EOB figures.

Why it is not optional: OpenAI does not sign a BAA for Free, Plus, Pro, or ChatGPT Business. A BAA is available for ChatGPT Enterprise/Edu and for the API platform — but de-identifying removes the need to depend on that, and it is the only control that holds no matter which model or machine the work lands on.

The identified copy lives in BAA-covered storage. Nowhere else. Not in ordinary email, not in a chat window, not in a downloads folder.

## Who does what

| | Job | Why |
| --- | --- | --- |
| **Owner** | The client relationship, all decisions, coaching the client's calls — **not making calls as anyone's representative** | The calls are the scarce input and cannot be automated. Hold time is the real cost of this business |
| **Claude** | Forms, audit logic, dispute letters, working de-identified line items, keeping this kit accurate | |
| **GPT** | Independent second read of the same de-identified bill | Two models disagreeing about a line is the point. Run both deliberately, not as a courtesy |
| **Zeo** | Deadline watch only, and only after an explicit architecture and retention review. Opaque case ID, deadline type, and date — no patient, facility, or bill content, and nothing private in durable memory | It is always on and it is local. Give it **file number and date only** — no patient data on that machine at all. Deadlines are the least forgiving part of this. Determine each from the controlling notice or plan document, have a person verify it, and never state to a consumer that a missed one either can or cannot be recovered |

## The Wall — absolute, for everyone

**Systems and access.** Never use the employer's systems, accounts, devices, or credentials for any part of this. Not to look up an account, not to check a policy, not to "just see" something. Knowledge of how hospitals work is portable. Access is not, and using it is a firing and potentially a criminal matter.

**Who cannot be a client.** Nobody billed by the employer — and that means the **whole health system**, not one building: affiliates, subsidiaries, joint ventures, employed physician groups, and any entity billing under the system's name or tax ID. Check the biller against that list at intake, before anything else.

**People and leads.** No coworkers, and no lead that arrived through work — not a conversation in a corridor, not a name a colleague mentioned, not anyone met in the course of the job. A lead derived from employment is employer data regardless of how informally it travelled.

**Shared vendors.** Where this business and the employer would use the same vendor, review it before signing. A shared account or shared tenancy can expose one to the other.

**Separation in practice.** Separate devices, separate accounts, separate email, and work done outside employed hours. No overlap of any kind.

**On paper, before starting.** A **written outside-employment review** with the current employer, against the employment agreement and any conflict, moonlighting, or intellectual property clause. Do this before the first client, not after — a verbal "should be fine" from a manager is not a review.


## What is in the kit

| File | What it is |
| --- | --- |
| `claims-register.md` | **Read first.** Every factual claim, its source, and whether it is verified |
| `maryland-brief.md` | The five Maryland findings that shape the product |
| `handoff-brief.md` | This file |
| `bill-audit-checklist.md` | The error list run against every itemized bill |
| `letter-templates.md` | Six letters, in send order |
| `intake-and-security.md` | How documents arrive, and the de-identification rule |
| `build-vs-buy.md` | What needs a BAA and what can be built |
| `finding-clients.md` | Where the first cases come from |
| `ofr-email.md` | The registration-scope question for the regulator |
| `message-to-gpt.md` | Status handover and task assignment for GPT |
| Referral one-pager (PDF) | The leave-behind for attorneys, clinics, and benevolence funds |
| Client report (PDF) | The closing report every client receives, with the fee arithmetic shown |
| Playbook (web) | The five calls, phone-ready |
| Public site (web) | What clients see |
| 3 PDFs | Authorization, appeal representative designation, service agreement |

## Before stating any rule as fact

Read `claims-register.md`. It marks every factual claim in this kit as verified, secondary, or **not verified**, and it lists six open questions that are going to a lawyer. Six items in this project are currently unconfirmed, including the Maryland debt settlement fee cap and whether our scope truly sits outside that Act.

A second-hand report is evidence about reports, not about the thing. Do not promote one into a fact, and do not write an unverified claim into a client document or say it to a billing office. If you check something and confirm or contradict it, update the register.
