# Triad decision record

**Data class:** public and synthetic only. No patient, employer, account, credential, or other private data was sent to another AI.

## Review proof

- Exact Claude task: `Revenue opportunity brainstorm`.
- Claude core decision commit: `f09c8f29`.
- Claude accepted Zeo/Codex's corrected core decision in commit `f9cfb47` with nonce `IH-ZEO-CORE-20260824-6D2A90`.
- Claude accepted every Codex defect found in its 30-entry kit and withdrew “passes its own gate” in commit `858bfc78`, nonce `IH-KIT-20260824-7A3F2C`.
- Local Zeo review used `qwen3.6:35b-a3b-q4_K_M`, digest `07d35212591fc27746f0a317c975a6d68754fb38e9053d82e25f06057af28522`, on loopback only. No Zeo durable memory or saved configuration was changed.
- Codex and an independent regression reviewer implemented and adversarially checked the resulting synthetic core.

## Consensus

1. The core product is a professional medical-bill evidence workflow, not a training company.
2. The primary path is a synthetic-first B2B workflow sprint for an established advocacy/navigation firm that owns all professional judgment and customer contact.
3. The later contingency is no-PHI hospital price-file normalization for the same professional buyers.
4. The training preview is frozen as optional collateral and receives no core build priority.
5. Six golden synthetic fixtures and a fail-closed deterministic contract come before real-document ingestion.
6. No real or merely redacted medical record enters the system before written legal-role and security/privacy review.
7. No launch, outreach, contract, payment, or delivery occurs before Maryland scope review and the owner's private employer-conflict gate.

## Unresolved dissent

Zeo wants hospital price/rate ingestion earlier because it may create more commercial differentiation. Claude and Codex put the six-fixture contract and false-positive controls first because a wrong finding can destroy a professional buyer's trust. Price/rate ingestion remains the next graded adapter; it is not represented as built.

The B2B demand and $1,000 price are untested. A synthetic sprint may test willingness to buy workflow design without proving demand for later real-case auditing. That distinction must remain visible in any validation result.

## Corrections made after adversarial review

- Replaced substring tests with exact structured-result and CLI contracts.
- Added clean, boundary, multiple-finding, invalid-shape, and invalid-semantics controls.
- Added strict calendar, offset, date-order, reference, cents, array, and safe-number validation.
- Tightened duplicate matching so quantity, unit amount, and normalized description must also match.
- Restricted room-count logic so “operating room” does not masquerade as room-and-board.
- Kept the narrow revenue-code room comparison as a referral question rather than a deterministic defect because v1 has no versioned unit-basis table.
- Removed a date-only discharge-day rule that flooded same-day encounters.
- Removed an unsupported universal medication-quantity-per-hour heuristic.
- Canonicalized findings by line number and EOB reference so source-array order cannot change IDs or output order.
- Required explicit synthetic bill/EOB document provenance and equal match keys before reconciliation; mismatches fail closed.
- Added pre-parse byte, string, line, and EOB-entry limits for untrusted-input safety.
- Kept every result as a candidate document question; the engine does not assert coding or medical conclusions.

## Truth boundary

This artifact is executable synthetic proof, not production, legal clearance, a secure intake, a deployed service, or commercial validation. External professionals—not the three AIs—must close the written Maryland and employer gates.
