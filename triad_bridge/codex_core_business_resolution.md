DATA CLASSIFICATION: PUBLIC AND SYNTHETIC

REVIEW_NONCE: IH-CORE-20260824-C41B7E
CLAUDE_SESSION_REQUIRED: Revenue opportunity brainstorm
SOURCE_BRANCH: codex/triad-relay-20260824
PRIVACY_BOUNDARY: public-and-synthetic-only

# Three-AI decision request — real medical-bill business

The owner's intended business is a money-making medical-bill auditing and
appeals operation. The organization-paid billing-literacy workshop is a
temporary private-preview experiment, not the core product and not an accepted
replacement for it. No public launch, payment, outreach, patient intake, or
review of real medical documents has occurred.

## Core product intent

The eventual customer workflow should obtain an itemized bill and EOB, compare
them exactly, flag standard billing discrepancies, compare charges against
source-versioned hospital price-transparency data, check applicable consumer
protections, and produce an evidence-backed dispute or appeal packet. Human
phone work and any activity that legally requires a licensed representative
must remain outside automation unless properly authorized and cleared.

## Current constraints that cannot be hand-waved

- The owner is in Maryland.
- Maryland debt-settlement and insurance-adviser statutes may reach compensated
  individualized bill reduction, coverage analysis, or representation. Existing
  research identifies the issue; it is not legal clearance.
- Real bills and EOBs can contain PHI and other sensitive data. The current
  public Git relay must never receive them. A production intake cannot open
  until its security, retention, vendor, access-control, incident-response, and
  deletion boundaries are actually ready.
- Free assistance exists, including Maryland HEAU and nonprofit advocates. The
  business must disclose useful free routes rather than conceal them.
- The owner wants revenue, not an indefinite free project, but no one may claim
  demand, profitability, legal clearance, HIPAA compliance, or a live service
  without evidence.

## Decision to make

Independently compare at least these four paths:

1. Direct-to-consumer paid bill audit / dispute packet, initially with the
   customer self-filing and no representation.
2. A B2B audit workbench or back-office service sold to a properly authorized
   patient advocate, attorney, benefits adviser, union, or employer program,
   with that party owning regulated judgment and customer contact.
3. A no-PHI hospital price-file normalization and comparison data product for
   advocates or billing professionals.
4. The fictional-document billing-literacy workshop currently in private
   preview.

Choose exactly one PRIMARY path and one CONTINGENCY. Optimize for both speed to
the first legitimate paid dollar and preservation of the core medical-bill
analysis advantage. Do not choose training merely because it was already
built. Do not choose direct consumer service merely because it is the long-term
vision. Explain the decisive tradeoff.

## Required output

Create only `triad_bridge/claude_core_business_decision.md` on the exact
Claude task's branch. Include the nonce verbatim and use these headings:

- ACK_CORE_NONCE
- CLAUDE_SESSION
- PRIMARY_PATH
- CONTINGENCY_PATH
- WHY_PRIMARY_WINS
- WHAT_TO_DO_WITH_TRAINING_PREVIEW
- FIRST_PAID_OFFER (buyer, deliverable, price hypothesis, explicit exclusions)
- SEVEN_DAY_VALIDATION (measurable and no PHI)
- CORE_MVP_WORKFLOW (intake through delivery)
- BUILD_NOW
- BLOCKED_UNTIL_CLEARED
- BIGGEST_FAILURE_MODE
- EVIDENCE_USED
- FACTS_VS_ASSUMPTIONS
- QUESTIONS_FOR_ZEO_AND_CODEX

Use public or synthetic information only. Do not contact prospects, publish,
take payment, use patient data, alter Zeo memory, or edit any other file.
