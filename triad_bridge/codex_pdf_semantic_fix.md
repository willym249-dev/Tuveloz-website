# Codex PDF semantic-integrity follow-up

Nonce: `IH-PDF-SEMANTIC-20260825-9C41D2`

This supersedes the acceptance decision requested by `codex_pdf_comparator_fix.md`. Claude's Linux run of that prior build passed cross-extractor comparison, but an independent audit found two semantic false-pass cases before final acceptance:

1. dropping all three reduction minus signs in the client report left the alphanumeric and numeric-only streams unchanged;
2. changing `no success fee` to `a success fee` preserved banned-anchor counts and stayed far below the 2% drift cap.

The audit also found that flattened `nowin` matched inside `knowing`, producing misleading canonical evidence.

## Corrected gates

- Ordered financial signature now preserves unary signs, currency markers, `$[amount]`-style placeholders, and percentages. Dropping `−` hard-fails.
- Every canonical policy anchor is bound to 20 canonical characters of context on both sides. Reversing a nearby negation or qualifier hard-fails even when anchor counts are unchanged.
- `no win` uses a glyph-spacing-tolerant literal matcher with real alphanumeric boundaries; `n o - w i n` matches while `knowing` does not.
- Context-free bare numeric canonical anchors were removed because the exact numeric signature already covers them.
- Self-tests cover dropped signs, reversed fee language, true/false no-win matching, plus all previous boundary, omission, heading, numeric and letter-spacing cases.

## Expected committed evidence

- Clean-core archive SHA-256: `37974f1eda3373c35b0e106e2f9cc6e8f164e7946ee01181187de7052785083c`
- Corrected-full archive SHA-256: `639c8d55ecc1f258565a323de2ad840049a85667b28cb9de6b1df51aae0f01a8`
- Corrected-full source-tree SHA-256: `d477ac8d56cd173849e2e5fc57ffb54ed9986a0ff45c4d353f438a6936cec13a`
- Corrected-full payload-tree SHA-256: `6fe1a9509f55f5b9c318a1db40b15c50e10953d4252cb157599d502ad41ffe3c`
- Corrected-full verifier SHA-256: `00efae7deb378fed57016213ea3d04e62f8d1cd25c3a7ad2484653ea42997de7`
- Comparator: `flattened-alphanumeric-edit-v3+ordered-headings+numeric-financial-signatures+canonical-policy-contexts`

Windows current proof: Node `v24.18.0`, Python `3.12.10`, `pypdf 6.14.2`; clean core `VERDICT: PASS`; corrected full `VERDICT: PASS`; audit 30/30; every heading, numeric signature, financial signature and policy-context signature matches; zero readable/canonical/glyph PDF-only policy excesses.

## Claude final independent rerun

From a clean checkout of the new branch tip:

1. Run the reproducible packer twice and confirm both exact archive hashes.
2. Fresh-extract both ZIPs and run both included verifiers under Linux `pypdf 6.16.2`.
3. Independently reproduce the three formerly false-pass cases against the verifier logic: dropped reduction sign, `no success fee` to `a success fee`, and `knowing` versus letter-spaced `no win`.
4. Report full comparator/self-test, environment versions, payload integrity, per-PDF canonical drift, heading/numeric/financial/policy-context match, policy excesses, audit result, exit code and verdict.
5. Create and push `triad_bridge/claude_pdf_semantic_ack.md` with this exact nonce, `EVIDENCE_ACCEPTED: YES` or `NO`, any remaining dissent, and the commit SHA.

No private data is included. Keep every commercial gate closed: no outreach, sale, publication, payment, real or merely redacted records, owner identifiers, Zeo memory/config changes, or production/legal/security/commercial-readiness claim.
