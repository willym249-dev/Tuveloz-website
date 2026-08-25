# Bill audit checklist

> **These produce candidate questions, not conclusions.** A bill on its own cannot establish that a service was upcoded, that codes were wrongly unbundled, that a service was never rendered, or that care was medically unnecessary. Those determinations need the chart, payer policy, licensed coding materials, and in most cases a qualified coder. What this checklist produces is a list of things worth asking the hospital to check — and everything that leaves in a packet is phrased that way.

What gets run against every itemized bill. This is the part you hand to me or to GPT — the documents go in, this list gets worked line by line, and what comes back is a dispute letter with specific line numbers and specific codes on it.

**Do not run this on a summary statement.** A summary has nothing to audit. Get the itemization first (Call 1) or there is no case.

## What you need in hand

- Itemized statement with revenue codes, CPT/HCPCS codes, units, and dates of service
- The EOB for the same claim
- Admission and discharge dates and times
- The client's own account of what actually happened
- The facility's published standard charge file, where available

## The error list

**Duplicates**
- Same code, same date, billed twice
- The same service appearing under both a revenue code and a separate line item
- A procedure billed on both the facility bill and the physician bill when only one is proper

**Possible unbundling** *(coder gate — NCCI edits and payer policy required to conclude)*
- Component codes billed separately when a single comprehensive code covers them
- Routine supplies billed as line items when they belong to the room rate — gloves, gowns, standard kits, basic monitoring
- Lab panels split into individual tests

**Level and coding questions** *(coder gate — never asserted from a bill alone)*
- Evaluation and management level higher than the documented encounter supports
- Emergency department level inconsistent with what was actually done
- Room level billed above the level of care actually received — ICU rate for a step-down stay

**Quantity and unit errors**
- Units exceeding what could have been administered in the time span
- Medication quantities that don't match the route or the dose
- Time-based codes billed for more minutes than the encounter lasted

**Dates and items to verify against the record** *(the patient's own account is usually the only evidence)*
- Room charge on the discharge day
- Charges dated before admission or after discharge
- Equipment or supplies the client says were never used
- A procedure that was ordered and then cancelled

**Insurance-side errors**
- Charges billed to the patient that the EOB shows as plan responsibility
- Balance billing beyond the allowed amount on an in-network claim
- Charges applied to deductible after the deductible was already met
- The claim never submitted to insurance at all, or submitted with the wrong plan
- Denial for a coding or eligibility reason that reprocessing fixes without an appeal

**Out-of-network and surprise billing**
- Out-of-network provider at an in-network facility
- No advance notice or consent before out-of-network billing
- Emergency care billed at out-of-network rates
- Ambulance charges — **ground or air?** They follow different rules and different regulators. Do not treat them as one category

**Price**
- Charged amount against the facility's own published standard charges for that code
- Cash or self-pay rate lower than what this patient was billed
- Prompt-pay or self-pay discounts that exist and were never offered

**Maryland facility fees** *(notice rules carry scope limits and exceptions — ask for the record, never assert non-compliance)*
- A separate outpatient facility fee appearing on the bill
- Whether the Facility Fee Right-to-Know disclosure was given **at the time of scheduling**, orally and in writing
- Ask the facility to produce its notice and acknowledgment record. **A document missing from the patient's own papers proves nothing** — they may simply not have kept it. If it stays unresolved, that is a matter for HSCRC or HEAU, not a conclusion to state

**Good faith estimate — uninsured and self-pay only**
- Whether a GFE was issued at all
- Whether billed charges exceed it by more than **$400** (confirm the current threshold — the figure was set for calendar year 2022 and later indexing is unconfirmed)
- Whether the bill arrived within the last **120 days**, which is the window for patient-provider dispute resolution
- Note: initiating that dispute carries an administrative fee. **Do not promise a consumer that collections stop** — confirm what protection actually applies, from the primary source, before saying anything about it

**Maryland debt protections**
- Medical debt reported to a credit bureau by the provider, its agent, or a collector — prohibited since 1 Oct 2025
- **Interest charged to a patient who qualifies for free or reduced-cost care** — prohibited
- If the account sits with a collection agency: whether that provider–agency contract carries the required credit-reporting prohibition. Without it the contract is **void and unenforceable**

**Assistance never applied**
- Financial assistance policy not applied when the client qualifies — in Maryland, free care at or below **200% FPL** is statutory, and reduced-cost care below **500% FPL** with hardship
- Income re-tested for a change in circumstances within **240 days** of the first bill, which Maryland allows and which is easy to overlook
- Approval granted by the facility but not carried across to physician and ancillary bills
- Sliding scale or hardship discount available and never mentioned

## What comes out

One **candidate-question packet** per billing entity, written for the consumer to sign and send, containing only:

- The specific line number and code being disputed
- What the possible discrepancy is, in one sentence, phrased as a question
- What is being asked — a check against the record, a coding review, a reprocessing
- What is being asked for — a check, a coding review, a reprocessing
- The source for the point, so the reader can verify it rather than trust it

No adjectives, no accusation, no argument about American healthcare. Every item is phrased as a **question about a possible discrepancy**, never as an assertion that a charge is wrong. A billing office actions a specific question and ignores a complaint.

## Evidence discipline on every output

Nothing leaves as an assertion. Each item carries:

- **Its source** — which document, which page, which line
- **Its confidence** — clean text, or OCR that could be misread
- **Its matching state** — whether the bill line was matched to an EOB line, or not matched at all
- **Its grade** — arithmetic and dates (checkable from the documents) versus coding and clinical questions (**not** checkable, and gated on a qualified coder and the record)

**An outbound assertion gate:** nothing goes into a consumer's packet phrased as "this is wrong." Only "please check whether." A statement that a charge *is* incorrect requires source records, payer policy, and qualified review — none of which a bill provides.

**Two-person review** on every dollar figure, every date, every deadline, and every coding question before it leaves.

**Build and test only on synthetic fixtures.** Never use a real patient's documents to develop, demonstrate, or debug this process.

## Order of operations

1. Diary any appeal deadline before reading anything else
2. Financial assistance screen
3. Itemization obtained
4. Line-by-line against this list
5. EOB reconciliation
6. **HSCRC review first** — Maryland hospital rates are set by the commission, so the primary frame is the approved rate for that hospital, rate year, revenue centre, and unit. Separate facility charges from physician, ambulance, lab, dental, and pharmacy bills **before** applying any of it, because those follow different rules
7. Published price file as a **secondary exact-match screen only** — a posted machine-readable rate is evidence for an inquiry, not the patient's legal price
7. Dispute letter per entity
8. Consumer reviews the candidate questions and decides which to raise
9. Consumer signs and submits the packet in their own name
10. Repeat for every separate biller on the visit

## Honest limits

An audit finds what the documents show. It cannot prove a service wasn't rendered when the record says it was — that requires the client's own account, and their memory is often the only evidence. Say so in the report rather than overstating a finding. A dispute letter with one weak claim in it gets the strong claims dismissed alongside it.

---

**Before stating anything here as fact, read [`claims-register.md`](claims-register.md).** It marks every claim in this kit as verified, secondary, or not verified, and lists the six open questions going to the lawyer.
