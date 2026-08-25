# Message to GPT — paste this whole file

From Claude, working on the same project. This is a status handover plus two specific requests. Read `handoff-brief.md` and `claims-register.md` alongside it; this assumes both.

---

## Where things stand

The kit is built and internally consistent. Do not rebuild these — extend or critique them instead:

- **One** pilot engagement document: `pilot-terms.html` — free, no representation, carrying the record-handling commitments.
- The former records authorization, appeal-representative designation, and contingency-fee agreement are **QUARANTINED outside the kit.** They must not be used, signed, branded, or re-added. `brand.mjs` no longer lists them.
- Phone playbook: five calls in order, Maryland-specific — **written in the consumer's own voice**, since the consumer makes their own calls.
- Public-facing site.
- Bill audit checklist (candidate questions only, with evidence grading and an outbound assertion gate), six letter templates **written for the consumer to sign and send**, intake and security procedure, build-vs-buy decision, client acquisition plan.
- Claims register marking every factual claim verified / secondary / not verified.
- Registration-scope email to the Maryland Office of Financial Regulation, drafted and waiting on the owner's signature block.

## Three constraints to design inside

**1. The Debt Settlement Services Act shapes scope.** Maryland Fin. Inst. § 12-1001 defines debt settlement services as any service "**represented, directly or by implication,** to renegotiate, settle, reduce, or **in any way alter the terms** of payment or other terms of a debt... **including a reduction in the balance**."

The trigger attaches to what is *represented*, so **marketing copy is part of the legal test**. Nothing you write may say we reduce, cut, lower, or settle bills. The wording throughout is *establish what the patient actually owes*. Balance negotiation is out of scope entirely.

**2. De-identify before any model sees a bill.** Strip name, DOB, address, MRN, account number, member ID. The audit runs on codes, quantities, dates of service, charges, and EOB figures — it does not need identity. OpenAI does not sign a BAA for Free, Plus, Pro, or ChatGPT Business. De-identifying **reduces** that risk; it does not remove it, and it does not make the vendor question moot. Do not send raw or hand-redacted records to a consumer account.

**3. Never state an unverified claim as fact.** The register exists because the first pass of this work promoted a second-hand report into a fact and had to be corrected. If you check something and confirm or contradict it, update the register rather than only mentioning it.

## The economics, so the blueprint is sized right


**The service is now a free pilot.** No fee, no percentage, no cap, no success trigger, and no representation — the consumer signs and sends their own packet. Nothing you write may offer or imply a fee.

---

## Request 1 — the thing only you can do

**I am behind an egress proxy that blocks every legal host.** Justia, mgaleg.maryland.gov, LegalFix, peoples-law.org, labor.maryland.gov, the Wayback Machine, Casetext, and FindLaw are all unreachable from my environment. You are not behind it.

Please retrieve and quote **verbatim**:

1. **Md. Code, Fin. Inst. § 12-1003** — "Applicability of subtitle." Every person or entity the subtitle does not apply to. § 12-1004 confirms exemptions exist ("unless the person is registered... or is exempt from registration under this subtitle") but I could not enumerate them.
2. **Md. Code, Fin. Inst. § 12-1010** — the fee section in full. I established the fee basis (a percentage of the amount by which the principal exceeds what was paid to settle) and the timing conditions, but **found no numeric cap**. Confirm whether one exists. A "15%" figure circulates that traces to a *proposed* bill — do not repeat it unless you find it in enacted text.
3. **Md. Code, Health-Gen. § 19-214.1** — confirm the 200% and 500% FPL thresholds and the 240-day re-testing window as currently enacted.

Quote the text rather than summarising it. Summaries are what caused the errors this register exists to catch — the full § 12-1001 definition contained two decisive clauses that every summary of it dropped.

## Request 2 — adversarial review, not agreement

Take `bill-audit-checklist.md` and attack it. Specifically:

- What error category is missing that a working medical billing advocate would check?
- What in it would a hospital billing office dismiss as wrong or naive, and why?
- Where does it overstate what an audit can actually prove from documents alone?

Disagreement is the point of running two models. A confirmation is worth nothing here; a category we missed is worth real money per case.

## What I would rather you did not do

Do not draft new client-facing copy without checking it against constraint 1, and do not produce a national or generic version of any of this. Maryland's differences — statutory free care, HSCRC rate setting, the Facility Fee Right-to-Know Act, HEAU, and the October 2025 debt laws — are the product, not the local colour.

---

# WORK ORDER — read this part first

The kit is at a hard stop that no amount of writing clears. Four gates are open and **all of them need the open internet or a person**, which is exactly what this environment does not have. That is why the work is being handed over rather than continued here.

## The rule that makes this delegation safe

**`verify.mjs` ships inside the kit. Run it before returning anything.**

```
node verify.mjs
```

Exit 0 or the work is not done. It checks 13 pattern families across every file and every PDF, and it requires an **exact allowlist entry naming file, pattern and reason** for any permitted hit — there is no way to slip a claim past it with a stray "not". If your change trips it, either fix the change or add an allowlist entry with a real reason. **Do not widen a pattern to make it pass.**

This exists because three separate audits caught claims that had been written confidently and never checked. Assume the same of your own output.

## GPT — task 1, and only you can do it

Every legal host is blocked from Claude's environment: mgaleg, Justia, LegalFix, peoples-law, labor.maryland.gov, Wayback, Casetext, FindLaw. All were attempted repeatedly. You are not behind that proxy.

**Fetch and quote VERBATIM.** Do not summarise — the § 12-1001 definition contained two decisive clauses that every summary of it dropped, and that single fact caused two rounds of rework.

| Need | Source |
| --- | --- |
| Applicability and exemptions | Fin. Inst. **§ 12-1003**, **§ 12-1004** |
| Registration and renewal fees | Fin. Inst. **§ 12-1006** |
| Fee rules, and any numeric cap | Fin. Inst. **§ 12-1010** |
| Bond, and whether it is conditional on holding funds | Fin. Inst. **§ 12-1014** |
| Assistance bands, eligibility, decision window, refunds | Health-Gen. **§ 19-214.1**, **§ 19-214.2** |
| Facility fee scope, exclusions, exceptions, remedy | Health-Gen. **§ 19-349.2**, COMAR **10.37.13.05–.06** |
| Records access route and timeline | Health-Gen. **§ 4-309** |
| Current rate order and effective date | HSCRC rate orders |

For each: the verbatim text, the section number, the date you retrieved it, and the URL. Then update `claims-register.md` — move each row from UNVERIFIED to verified **with the quote attached**, or contradict it. A row you cannot retrieve stays UNVERIFIED. Say so plainly rather than inferring.

**The one that matters most:** the assistance bands. If the banded scale is real, the current screen under-serves people between 200% and 300% of the poverty level — too far above the free-care line to qualify, nowhere near able to pay. That is the single highest-value unknown in this project.

## GPT — task 2

Attack `bill-audit-checklist.md`. What category is missing that a working billing advocate would check? What would a hospital billing office dismiss as naive? Where does it still overstate what documents alone can prove? A confirmation is worth nothing; a missed category is worth real money per case.

## Zeo — deliberately almost nothing, for now

The deadline watch is **suspended**. `case-tracker.md` used to say opaque case IDs made a home machine acceptable; that was wrong and has been removed. A case ID is a crosswalk to a real person, and running it needs an architecture and retention review covering the crosswalk, runtime, logs, and backups. None of that has happened.

Until it does: **Zeo's durable memory gets Maryland-only, non-private operating principles.** No case IDs, no dates, no facility names, no bill content. Nothing that maps to a person.

## What nobody may do without the owner

Send the OFR email. Publish or share any page. Accept a client. Charge anyone. Process a real person's records. Run branding. Contact a hospital, plan, or collector.

## Do not delegate these back to Claude's environment

Anything needing the open internet — it is blocked and retrying wastes everyone's time. Send the retrieved text instead and it gets integrated in one pass.
