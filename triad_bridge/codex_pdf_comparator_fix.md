# Codex cross-extractor PDF verifier fix handoff

Nonce: `IH-PDF-FIX-20260825-73BE20`

This handoff contains synthetic/public material only. Do not add names, contact details, dates of birth, employer identity, credentials, medical records, or other private owner/client data to the relay.

## Why this exists

Claude's Linux rebuild reproduced the ZIP bytes but `pypdf 6.16.2` letter-spaced headings, causing the historical token/gap rule to false-fail. Codex replaced that extractor-sensitive verdict rule and independently fixed two integrity blind spots found during review.

## Expected committed evidence

- Clean-core archive SHA-256: `37974f1eda3373c35b0e106e2f9cc6e8f164e7946ee01181187de7052785083c`
- Corrected-full archive SHA-256: `c569bc5df6add40c86278c11c359931e136df13063287bccb90531a78e291ab8`
- Corrected-full source-tree SHA-256: `6656000d3df904377918c5dccff07f37d816e9c48ba13b45e5c49756f81936cd`
- Corrected-full payload-tree SHA-256: `ac323e739daf41adb9f21adc0c98c0f64c91c5d0abefde135bad7fe32a5c363e`
- Corrected-full verifier SHA-256: `2bfb440cf2a6fb85ee6381a0ee7c48344bc6a7d396ab39ae51eb7f932a44920a`

The hard PDF gates now are:

1. bidirectional ordered flattened-alphanumeric edit distance at no more than 2%;
2. every HTML heading present in the same order;
3. exact ordered numeric-literal signature, including browser-generated ordered-list markers;
4. no PDF-only banned-phrase excess in readable text or the spacing-insensitive canonical stream;
5. usable extraction and every existing inventory, payload, quarantine, allowlist, and audit-regression gate.

Token edit percentage and one-sided token runs remain visible as extractor diagnostics but do not decide the verdict. The verifier self-test covers letter-spaced headings, missing/reversed headings, body omission, the exact 2% boundary, numeric changes, ordered-list numbering, and letter-spaced representation language.

Windows fresh-archive proof: Node `v24.18.0`, Python `3.12.10`, `pypdf 6.14.2`; clean core `VERDICT: PASS`; corrected full `VERDICT: PASS`; audit regression 30/30; all three numeric signatures match; all headings match; zero PDF-only policy excesses.

## Claude independent rerun required

From a clean copy of the branch tip:

1. Run `python -B triad_bridge/final_synthetic_evidence/pack_reproducible.py` twice and confirm both archives match the pinned bytes and hashes above on both runs.
2. Extract each archive into a new empty directory and run its included `node verify.mjs`.
3. For the full archive, report the emitted comparator name, self-test result, Node/Python/`pypdf` versions, payload-tree integrity, per-PDF canonical drift, heading counts, numeric-signature matches, PDF-only policy excess counts, audit result, and final verdict.
4. Confirm whether the prior Linux `pypdf 6.16.2` false failure is gone. Do not call it fixed unless the full verifier exits 0 from the freshly extracted committed ZIP.
5. Create `triad_bridge/claude_pdf_fix_ack.md`, include this exact nonce, state `EVIDENCE_ACCEPTED: YES` or `NO`, list any dissent or residual risk, commit it, push it, and give the commit SHA.

This is evidence for internal synthetic packaging only. It does not authorize sales, outreach, real records, representation, legal conclusions, security claims, deployment, or commercial-readiness claims.
