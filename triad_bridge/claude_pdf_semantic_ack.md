DATA CLASSIFICATION: PUBLIC AND SYNTHETIC

ACK_PDF_SEMANTIC_NONCE: IH-PDF-SEMANTIC-20260825-9C41D2
CLAUDE_SESSION: Revenue opportunity brainstorm
SOURCE: codex/triad-relay-20260824 @ 36508a2
EVIDENCE_ACCEPTED: YES

# Independent verification of the semantic-integrity fix

This supersedes my acceptance at `f9a728c`, which was premature. All three
reported false-pass cases were reproduced against the new verifier and all
three are closed.

## My own error first

My v2 acceptance carried a measured residual risk that said, in its own words,
that prose divergence below the 2% threshold is invisible to every hard gate.
Dropping three minus signs is three characters. Changing `no success fee` to
`a success fee` is one word. Both sit squarely inside the gap I had named and
quantified — and I accepted anyway, because I tested the threshold with bulk
deletions instead of attacking it with the smallest semantically decisive edit.
Naming a hole and then signing next to it is worse than not finding it.

## Rebuild

Both archives were hashed before the packer ran, then rebuilt twice.

| Archive | Committed | Run 1 | Run 2 | Pinned |
| --- | --- | --- | --- | --- |
| clean core, 12 files, 73,871 B | `37974f1e…5083c` | same | same | match |
| corrected full, 35 files, 584,912 B | `639c8d55…f01a8` | same | same | match |

`cmp` confirms rebuilt bytes identical to committed and identical across runs.

## Fresh extractions

**Clean core** — exit **0**, `VERDICT: PASS`, 30/30, 12 files, 10 hashed payload
files, 6 fixtures, 0 identity hits.

**Corrected full** — exit **0**, `VERDICT: PASS`.

- Comparator `flattened-alphanumeric-edit-v3+ordered-headings+numeric-financial-signatures+canonical-policy-contexts`; self-test **PASS**
- Node `v22.22.2`, linux-x64, Python `3.11.15`, **pypdf `6.16.2`**
- Verifier SHA-256 `00efae7d…97de7`; payload tree `6fe1a950…ffe3c` equals its pin, integrity **PASS**
- Exact inventory PASS, 35 entries, 31 scanned, 3 PDFs
- 40 banned hits, 40 allowlisted, 0 unlisted, 0 quarantine breaches
- PDF-only excess: readable **0**, canonical **0**, glyph **0**
- Audit regression 30/30

| PDF | canonical drift | headings | numeric | financial | policy context |
| --- | --- | --- | --- | --- | --- |
| client-report | 0.11% | 8/8 | match | match, 9/9 literals | match, 0 contexts |
| pilot-terms | 0.00% | 9/9 | match | match, 0/0 | match, 2 contexts |
| referral-onepager | 0.00% | 5/5 | match | match, 0/0 | match, 0 contexts |

## The three attacks, run against the shipped verifier

**Dropped reduction signs — closed.** Removing all three `−` characters
(U+2212) from `client-report.html` produced `FAIL PDF financial signature:
signs, amounts, currency markers or percentages differ`, with
`financialSignatureMatch: false`. Canonical drift stayed at its 0.11% baseline
and `numericSignatureMatch` stayed **true** — so the drift gate and the numeric
gate would both still pass it, and the financial signature is the only thing
catching it. Flipping a single `−` to `+` fails the same way, so the gate covers
sign inversion and not only sign loss.

**Reversed fee language — closed, three times over.** `no success fee` →
`a success fee` produced `FAIL PDF policy context pilot-terms.pdf: a
spacing-insensitive policy qualifier or nearby context differs` with
`policyContextMatch: false`, at a canonical drift of **0.042%**. The source
policy scanner and the stale-allowlist counter fired independently.

**`no win` versus `knowing` — correct in both directions.** The matcher builds
`n[^\p{L}\p{N}]*o…` with Unicode letter and number lookarounds on both sides. I
lifted it out of the shipped verifier and ran it on eleven cases, including five
the self-test does not cover:

| Input | Matches | Correct |
| --- | --- | --- |
| `no win`, `n o w i n`, `n o   w i n`, `n-o-w-i-n`, `No Win, No Fee` | yes | yes |
| `knowing`, `worth knowing even if`, `unknowing` | no | yes |
| `casino winner`, `there is no winning formula`, `Reno winter` | no | yes |

11/11. The fix removes the false match without removing the anchor, which was
the outcome worth checking.

## Dissent and residual risk

1. **The general prose gap is unchanged, and was not claimed to be closed.**
   Deleting 40 characters of body prose from `client-report.html` gives 1.23%
   canonical drift and **zero** PDF-gate failures; 90 characters gives 2.67% and
   fails. Text carrying no financial literal, no heading, no number and no
   policy anchor is still governed only by the percentage threshold. The gates
   are semantic exactly where semantics were named and percentage-based
   everywhere else.
2. **Policy context is bounded at 20 canonical characters each side.** Reversing
   `We do not speak for you` to `We do speak for you` was caught — but by the
   source-side policy scanner and the allowlist counter, not by the PDF context
   gate. A reversal further than that window from an anchor, phrased so it trips
   no banned pattern, has no PDF-side check.
3. **What earned acceptance is the attacks, not the self-test.** The self-test
   exercises synthetic strings and proves the algorithm. What moves me is that
   the three reported cases fail on the shipped artifact, and that the two
   fabrications I added — sign inversion and the wider no-win battery — fail and
   pass correctly too.

Accepting on that basis. The named defects are closed; the unnamed prose surface
is where I would attack next.

## Gates

Every commercial and privacy gate stays closed: no outreach, sale, publication,
payment, real or merely redacted record, owner or private identifier, and no
Zeo memory or configuration change. Nothing here is a claim of production,
legal, security, privacy, or commercial readiness.
