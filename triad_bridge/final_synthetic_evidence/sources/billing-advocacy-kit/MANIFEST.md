# Kit manifest and acceptance evidence

> ## INTERNAL SYNTHETIC TESTING ONLY
>
> **No real records, no real clients, no sales.** The counsel/OFR, secure-intake, employer, and Maryland-rule gates are all **open**. This is a tabletop exercise, not a service.

## Status, stated plainly

This kit is **not ready for a real person's documents** and does not claim to be. Four gates are open and none is closable from inside this environment:

| Gate | State |
| --- | --- |
| Maryland classification and the UPL boundary | **Open.** The question to OFR is drafted and **not sent**. An informal reply would be useful and is **not a binding safe harbour** |
| Maryland operational rules | **Open.** Selected official statutes and agency pages were retrieved for issue spotting on 2026-08-24, but counsel has not approved the exact service and several rule-specific applicability questions remain unresolved |
| Secure intake and privacy | **Open.** PIPA/MODPA analysis, vendor contracts, data map, sanitisation, backups, incident response, deletion, and recipient verification are **not implemented** |
| Employer clearance | **Open.** The written outside-employment review has not happened |

## Acceptance gate

`node verify.mjs` — exit 0 authorises **internal synthetic packing only**, and nothing else does. It does not authorize publication, commercial use, real records, or a claim of legal, security, production, or market readiness.

Rebuilt after the previous version false-passed three ways: it scanned only `.md/.html/.mjs`, so a forbidden PDF could reappear unnoticed; it treated any line containing a stray "not" or "never" as reviewed, which is pattern-matching rather than review; and phrase sampling over PDFs was reported as text equivalence.

It now:

- requires the **exact reviewed file inventory** and a pinned SHA-256 tree digest over every payload file, and fails on any addition, removal, rename, case variant, or byte change;
- enumerates every entry type and fails on a quarantined form in any filename case;
- requires an **exact occurrence allowlist** naming relative path, pattern family, normalized-line SHA-256, expected count, and a reviewed rationale for every permitted hit — a new sentence in an already allowlisted file does not inherit permission;
- uses a Windows-safe module root and tries `python3`, `python`, then `py` with forced UTF-8 before failing closed if no `pypdf` extractor is usable;
- compares each rendered PDF body and HTML body with a **bidirectional, order-sensitive flattened-alphanumeric edit distance** that hard-fails above 2%; requires every HTML heading in order, exact ordered numeric and financial signatures (including signs, currency/amount placeholders and percentages), and exact spacing-insensitive context around every policy anchor; scans both readable and spacing-insensitive extracted PDF text for any banned phrase not present in the vetted source; reports extractor-sensitive token drift and one-sided token runs as warnings; and fails outright if extraction is impossible;
- runs `node --test audit.test.mjs` as a mandatory sub-gate, so a missed planted defect or a guarded false positive blocks acceptance;
- covers 13 pattern families including stale-form references, deadline overclaims, collection promises, privacy overclaims, HEAU causal claims, insecure intake, asserted findings, and generic ambulance handling.

The manifest does not preserve a hand-written "latest run" count. Every invocation computes the current counts and prints one machine-readable `EVIDENCE_JSON` line containing the Node, Python and `pypdf` versions, selected extractor command, exact-inventory state, pinned payload-tree digest, entry and scan counts, per-PDF canonical, heading, numeric, financial, token-diagnostic and policy-context evidence, allowlist results, quarantine results, and audit-regression verdict. The verifier also runs boundary, omission, heading-order, numeric-change, dropped-sign, reversed-policy and letter-spacing self-tests. Preserve that command output and the final archive SHA-256 with any packed candidate; only the same run's final `VERDICT: PASS` is internal packaging evidence.

## What this pass changed

Verifier rebuilt; `INTERNAL SYNTHETIC TESTING ONLY` banners on README, site, and pilot terms; every reference to the three quarantined forms made coherent (README rows, intake steps, first-call workflow, pilot-terms kicker, letter attachments); deadline language moved to notice/receipt with a human verification step and no "cannot be repaired"; collection-stay promises removed and replaced with questions; categorical "not a debt settlement service" deleted from all three client-facing surfaces; privacy overclaims removed from build-vs-buy, intake, de-identification, handoff and case-tracker, with not-implemented gates listed; `brand.mjs` now HTML-escapes CLI values (it did not, which was an injection defect); intake changed to "do not send records"; findings reworded to possible discrepancies throughout; HEAU causal claims deleted and PAF added as an eligibility-limited free substitute; economics residuals removed and tracker cost fields added; employer wall widened to the whole system, affiliates, coworkers, shared vendors and work-derived leads, with the HR acquisition channel removed.

## What this pass did NOT do

**No legal clearance was written in.** A later Codex pass retrieved selected official Maryland statutes and agency pages and preserved them in a separate counsel packet. That issue spotting corrected specific source-access and fee-history claims, but it did not decide classification, applicability, licensing, or the still-open assistance, HSCRC, facility-fee, privacy, employment, and operating questions. The historical `claims-register.md` records what Claude could and could not retrieve at the time; it is not the current legal source of truth.

Where a rule could not be verified, the response was to **fail closed and mark the screen not ready**, not to guess. Removing a claim cannot make this less safe; adding an unchecked one can.

## Not done, as instructed

No publish, no OFR send, no branding run, no client, no charge, no real data, no contact with anyone. Both previously published pages remain private and unshared, and neither was updated in this pass.
