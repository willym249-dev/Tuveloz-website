# Itemized Health synthetic core v1

This is the clean, synthetic-only core extracted from the larger tabletop kit after review by the exact Claude task, Codex, local Zeo, and an independent regression reviewer.

## What is real now

- A dependency-free Node.js engine accepts a strict versioned JSON case shape.
- Invalid or unsafe numeric/date/reference inputs fail closed with no partial findings.
- EOB reconciliation requires distinct synthetic document references and equal explicit match keys before any cross-document finding can run.
- Raw CLI input, strings, lines, and EOB-entry counts are bounded before untrusted adapters exist.
- Findings have stable IDs, grades, line references, structured evidence, and deterministic ordering.
- The implemented document-level checks cover arithmetic, statement totals, service dates outside the encounter, room quantities against stay nights, exact duplicate lines, billed patient amount above EOB responsibility, and EOB not-covered entries.
- Exactly six invented fixtures define the current contract: clean and near-miss controls, multiple-finding cases, and two invalid-input cases.
- The regression suite checks exact outputs, zero extras, repeatability, non-mutation, safe wording, CLI/API equivalence, and fail-closed behavior.

## Run it

Requires Node.js 20 or newer and no package installation.

```text
node --test audit.test.mjs
node verify.mjs
node audit.mjs --json fixtures/01_all_rules.json
```

Only `node verify.mjs` exiting 0 is this package's acceptance signal. It verifies the payload hashes, exact file set, six-fixture boundary, absence of common identity fields/patterns in fixture JSON, and the complete regression suite.

## What this is not

This is not a production bill-audit service. It does not ingest a hospital PDF, EOB PDF, image, OCR output, X12/EDI feed, FHIR resource, or hospital price file. It does not perform coding, unbundling, upcoding, medical-necessity, coverage, legal, consumer-protection, or savings analysis. It has not been validated on real or redacted records.

Passing tests proves this synthetic software contract only. It does not prove clinical correctness, regulatory clearance, privacy compliance, demand, profitability, deployment, or a live business.

## Current commercial decision

The first candidate paid offer is a fixed **$1,000 synthetic-only evidence-workflow sprint** for an established advocacy or benefits-navigation firm. The buyer would receive a workflow map, the six-fixture test set, a configured document-level rules profile, a synthetic findings sample, and a handoff. No real or redacted patient record, production integration, patient contact, representation, negotiation, submission, appeal, savings promise, or regulated judgment is included.

That offer is a tested product hypothesis, not a live offer. Publication, outreach, contracting, payment, and delivery remain blocked until written Maryland scope review and the owner's private employer-conflict review are complete.

See `TRIAD_DECISION.md` for consensus, dissent, and the evidence boundary.
