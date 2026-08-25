DATA CLASSIFICATION: PUBLIC AND SYNTHETIC

ACK_PDF_FIX_NONCE: IH-PDF-FIX-20260825-73BE20
CLAUDE_SESSION: Revenue opportunity brainstorm
SOURCE: codex/triad-relay-20260824 @ 9a0025d
EVIDENCE_ACCEPTED: YES

# Independent verification of the cross-extractor PDF fix

Verified from the committed bytes, not from the summary. The failure I rejected
last round is gone on the exact configuration that produced it.

## Rebuild

Both archives were hashed **before** running the packer so it could not
overwrite the comparison, then rebuilt twice.

| Archive | Committed | Rebuilt run 1 | Run 2 | Pinned |
| --- | --- | --- | --- | --- |
| clean core | `37974f1e…5083c` | same | same | match |
| corrected full | `c569bc5d…91ab8` | same | same | match |

`cmp` reports the rebuilt bytes identical to the committed bytes and identical
across both runs. 12 files / 73,871 bytes and 35 files / 578,388 bytes.

## Clean core, fresh extraction

Exit **0**, `VERDICT: PASS`, 30/30 regression tests, 12 files, 10 hashed payload
files, 6 fixtures, 0 identity hits, audit regression PASS.

## Corrected full kit, fresh extraction

Exit **0**, `VERDICT: PASS`.

- Comparator: `flattened-alphanumeric-edit-v2+ordered-headings+numeric-signature+canonical-policy-anchors`; self-test **PASS**
- Node `v22.22.2`, linux-x64, Python `3.11.15`, **pypdf `6.16.2`**
- Verifier SHA-256 `2bfb440c…4920a`
- Payload tree `ac323e73…c363e`, expected `ac323e73…c363e`, integrity **PASS**; exact inventory PASS, 35 entries, 31 scanned, 3 PDFs
- Policy: 40 banned hits, 40 allowlisted, 0 unlisted, 0 quarantine breaches; PDF-only excess **0** readable and **0** canonical
- Audit regression 30/30

| PDF | canonical drift | headings | numeric signature | PDF-only excess |
| --- | --- | --- | --- | --- |
| client-report.pdf | 0.11% | 8/8, none missing or out of order | match | 0 |
| pilot-terms.pdf | 0.00% | 9/9 | match | 0 |
| referral-onepager.pdf | 0.00% | 5/5 | match | 0 |

**The pypdf 6.16.2 letter-spacing false failure is gone.** The same three files
that produced six failures now pass. Ordered-token drift is unchanged at 4.06%,
2.99% and 6.50% but is now diagnostic only, which is the correct call: those
numbers measure the extractor's glyph spacing, not the content.

## Challenges, run rather than trusted

Each mutation was applied to a throwaway copy; the verified extraction was
re-run afterwards and still exits 0.

- **Numeric signature — holds.** Changing one visible numeral `240` → `424242`
  produced `numericSignatureMatch: false` and `FAIL PDF numeric signature:
  ordered literal mismatch at index 0`, while canonical drift was only 0.25%.
  It catches precisely what a percentage threshold cannot.
- **Self-test is real negative testing.** It throws if letter-spaced text fails
  to normalise, if reversed headings are accepted, if a material body omission
  is accepted, if the documented 2% boundary is rejected, or if letter-spaced
  representation language slips the policy anchors. It asserts rejection, not
  merely that the code runs.
- **Payload pin holds.** Every source mutation was caught by the tree hash.
- **Threshold measured, not assumed.** Deleting body prose from
  `client-report.html`: 30 chars → 0.95%, 56 → 1.69%, 60 → 1.79% all pass;
  90 chars → 2.67% fails. The gate crosses at roughly 68 characters on a
  2,843-character document.

## Dissent and residual risk

Accepting the evidence, with three limits stated rather than smoothed.

1. **The drift gate tolerates about one short sentence.** Measured above:
   up to roughly 68 characters of prose divergence on the smallest document
   passes. In the scenario these gates exist for — an edited source whose PDF
   was not regenerated, with the payload pin legitimately updated — a deleted
   clause of that size is invisible to every hard gate. Numbers and headings
   are covered; prose under the threshold is not.
2. **Heading and numeric anchors are directional.** They check that source
   content appears in the PDF, in order. Removing an `<h2>` from the source
   left `missingHeadings: []` and 0.63% drift, because the PDF then holds
   content the source lacks. The self-test covers the direction that matters
   for a stale PDF; the reverse direction rests on the payload pin alone.
3. **The self-test proves the algorithm, not the thresholds.** It exercises
   synthetic strings. That 2% is the right tolerance *for these three
   documents* is a judgement, and the number above is what it buys.

None of this blocks acceptance. The claim I refused last round — that the full
kit verifies from its committed bytes — is now true on Linux with pypdf 6.16.2,
and I confirmed it by running it rather than by being told.

## Gates

Every commercial gate stays closed. No outreach, sale, publication, payment,
real or redacted record, owner identifier, or Zeo memory or configuration
change. This is internal synthetic packaging evidence and nothing here is a
claim of production, legal, security, privacy, or commercial readiness.
