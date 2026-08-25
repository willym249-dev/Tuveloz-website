# Maryland medical bill advocacy — working kit

> ## INTERNAL SYNTHETIC TESTING ONLY
>
> **No real records, no real clients, no sales.** Nothing here may be used with a real person's documents until the counsel/OFR, secure-intake, employer, and Maryland-rule gates all close. Those gates are open. This kit is a tabletop exercise.


Everything built for this business, and the order to read it in.

- **Owner:** `[OWNER]`
- **Status:** **synthetic proof of concept, pre-classification.** No live pilot, clients, charges, representation, or real-record handling
- **Jurisdiction:** Maryland. The Maryland-specific rules are the product, not local colour

---

## Read these first, in this order

| | |
| --- | --- |
| [`claims-register.md`](claims-register.md) | **Start here.** Every factual claim, its source, and whether it is verified, secondary, or unconfirmed. Nothing in this kit should be stated as fact without checking it here |
| [`maryland-brief.md`](maryland-brief.md) | The five Maryland findings that shape what this business can and cannot be |
| [`handoff-brief.md`](handoff-brief.md) | Self-contained brief for any assistant joining — Claude, GPT, Zeo, or a future session |

## The engine

| | |
| --- | --- |
| `assistance-screen.mjs` | **Quarantined and fail-closed.** The earlier threshold calculator is not an approved eligibility screen; it returns no result pending rule-specific and counsel review |

| | |
| --- | --- |
| `audit.mjs` | Validates the strict v1 JSON schema, bounded input, and explicit synthetic bill/EOB match provenance, then emits stable structured candidate questions for the small set of document-level checks the current engine can support. Invalid or mismatched input fails closed with no partial findings |
| `audit.test.mjs` | Pins exact IDs, ordering, grades, line references, evidence, zero-finding controls, invalid-input behavior, CLI behavior, and repeatability across exactly six fixtures |
| `fixtures/` | Exactly six invented contract cases: four valid cases, including clean and boundary controls, plus two fail-closed invalid cases. No real person or provider |
| `verify.mjs` | Mandatory full-kit gate: runs the audit suite, exact-occurrence policy scan, quarantine scan, and bidirectional ordered PDF/HTML comparison |

```
node audit.mjs --json fixtures/01_all_rules.json
node --test audit.test.mjs
node verify.mjs
```

**Synthetic only.** Do not run this against a real person's records — the privacy, intake, and legal gates are all open.

The engine does **not** ingest a hospital PDF, EOB PDF, image, OCR output, X12/EDI feed, FHIR resource, or hospital price file. It does not perform coding, medical-necessity, coverage, legal, or savings analysis. Current tests establish the synthetic JSON contract and regression behavior only; they do not establish clinical accuracy, production readiness, demand, revenue, or legal clearance.

## Running a case

> **BLOCKED LEGACY CONSUMER COLLATERAL.** The files in this section are preserved from the tabletop concept; they are not an operating workflow and may not be used with a real or redacted record.

| | |
| --- | --- |
| [`first-call.md`](first-call.md) | What you ask on the first call, and the intake questionnaire |
| [`de-identification.md`](de-identification.md) | How a bill is stripped before any model sees it |
| [`bill-audit-checklist.md`](bill-audit-checklist.md) | The error list run against every itemized bill |
| Playbook (owner-only legacy template) | Historical five-call outline; not approved for use |
| [`letter-templates.md`](letter-templates.md) | Six letters, in send order |
| [`case-tracker.md`](case-tracker.md) | File numbering, the clocks, and Zeo's deadline-watch specification |

## Client-facing

> **NO CLIENT-FACING USE IS AUTHORIZED.** These are owner-only historical templates, not active terms, reports, marketing, or a live site.

| | |
| --- | --- |
| `pilot-terms.pdf` | **The pilot engagement document.** Free, no representation, and the record-handling commitments. Signed alongside the authorization |
| `client-report.pdf` | The closing report. No fee arithmetic — the pilot charges nothing |
| `referral-onepager.pdf` | The leave-behind for attorneys, clinics, and benevolence funds |
| Site (owner-only legacy template) | Historical page only; not approved for publication |

## Setting up and finding work

> **BLOCKED LEGACY MATERIAL.** Do not use these files for intake, acquisition, contact, or delivery. The current candidate is the separately reviewed synthetic-only B2B sprint.

| | |
| --- | --- |
| [`intake-and-security.md`](intake-and-security.md) | How documents arrive safely |
| [`build-vs-buy.md`](build-vs-buy.md) | What needs a BAA and what can be built |
| [`finding-clients.md`](finding-clients.md) | Where the first cases come from |
| [`ofr-email.md`](ofr-email.md) | The registration-scope question for the regulator |
| [`message-to-gpt.md`](message-to-gpt.md) | Status handover and task assignment for GPT |
| `brand.mjs` | Stamps business details into the four pilot templates. The quarantined forms are deliberately not listed and cannot be reproduced by it |

---

## Putting your details on everything

> **DO NOT RUN `brand.mjs` OR DISTRIBUTE ITS OUTPUT.** The command below is preserved only to document the historical template mechanism.

The six client-facing documents ship with placeholders. One command fills every placeholder in them:

```
node brand.mjs --business "Itemized Health" --email you@example.com --phone "(240) 555-0142"
```

Output lands in `branded/` — that is what you print, send, and publish. The templates stay as templates, so changing a phone number later is the same one command rather than an edit hunt. Anything you omit leaves a blank line rather than a bracket, and the script warns you about what it left.

## The four rules that shape everything

> The rules below describe the archived consumer-pilot concept, not the selected core product or permission to offer any service.

**1. Scope, and it is a pilot.** Review, prepare, and hand the client a sourced packet **they** sign and send. **No fee of any kind. No representation. Never balance negotiation.** Maryland's classification is unresolved; the question for the regulator is drafted and not yet sent — no document here may claim any service falls outside the Debt Settlement Services Act. **All earlier registration-cost reasoning is withdrawn**: the fee and bond figures used were unverified and the argument built on them is void. See the register.

**2. Language.** Maryland's Act triggers on what is *represented, directly or by implication*. Nothing written anywhere may say we reduce, cut, lower, or settle bills, and nothing may offer or imply a fee. Findings are **candidate questions**, never conclusions: a bill alone cannot establish upcoding, unbundling, a service never rendered, or medical necessity — those need the chart, payer policy, licensed coding materials, and a qualified coder.

**3. Free services already do much of this, and we say so first.** Dollar For (charity care applications), the Maryland Attorney General's Health Education and Advocacy Unit (billing and insurance dispute mediation), and SHIP (Medicare) are **overlapping substitutes, not adjacent services** — for many people they are the whole answer. Name them unprompted, every time, before describing what we add. Never imply that a packet from us is why an HEAU case succeeds; we have no evidence of that and it would be a causal claim we cannot support.

**3b. Assistance first.** Screen for it before anything else, charge nothing on it, and name Dollar For, HEAU, and SHIP unprompted. It is the honest thing to do. It does **not** dispose of the question — for many people a free service is the better answer, and sometimes the whole answer.

**4. The wall.** **The employer wall applies to the whole health system**, not one building: affiliates, subsidiaries, joint ventures, employed physician groups, and anything billing under the system's name or tax ID. It also covers coworkers, any lead that arrived through work, and shared vendors. Separate devices, accounts, and time. **A written outside-employment review must be completed before the first client.**

---

## Open, and what each is waiting on

| | Waiting on |
| --- | --- |
| OFR registration-scope question | Sending, from a separate business address. Draft is written |
| Maryland scope classification | Selected official primary sources have been retrieved for issue spotting; written Maryland counsel review remains open and no exemption is claimed |
| Production adapters and security | PDF/OCR/EOB/price-file ingestion, secure intake, retention, deletion, incident response, vendor review, and access controls are not implemented |
| First real case | Blocked. A real or merely redacted record is not an acceptable synthetic fixture |

**Keep the vehicle business and this one separate** — separate email, separate domain, separate entity. That is cheap now and expensive to unpick later.
