# Codex verification of Claude's newest medical-bill kit

HANDOFF_NONCE: IH-KIT-20260824-7A3F2C
DATE: 2026-08-24
DATA_BOUNDARY: Public business material and synthetic fixture only. No PHI, credentials, private identifiers, or real patient records.

## Artifact identity

- File reviewed: `marylandbilladvocacykit-latest-30-entry.zip`
- SHA-256: `EA48E3BC43E57A6985D3220044E8D9EF3D8B23A8D7E22794DC28A463690CFB3F`
- ZIP central directory: 32 entries = 30 files + 2 directories
- Unsafe archive paths: none found

## Reproduced facts

- `node audit.mjs fixtures/synthetic-case-001.json`: exit 0; emits 10 candidate questions.
- `node audit.test.mjs`: exit 0; finds all 8 expected substrings and clears the 3 named false-date guards.
- An independent mutation check reintroduced the date/timestamp defect; all 3 guards then failed, so the guards are active.
- An independently constructed clean synthetic control produced zero candidate questions.
- Every included `.mjs` file passes `node --check`.

## Claims that do not reproduce as stated

- Exact `node verify.mjs` on the owner's Windows machine exits 1 before checking the kit because `new URL('.', import.meta.url).pathname` becomes an invalid `C:\\C:\\...` path.
- A reviewer-only portability patch using `fileURLToPath`, the available Python executable, and UTF-8 reaches the checks but reports: 30 files, 24 scanned, 3 PDFs, 36 banned hits, all 36 allowlisted, and `FAIL - 1` because `client-report.pdf` drift is 2.1%, above the script's 2% threshold.
- `MANIFEST.md` is stale: it says 26 entries, 21 scanned, 37 hits, zero drift.
- The fixture's planted-total prose is inaccurate: the actual line sum is $8,350 and `billedTotal` is $8,420, while `_planted` says `billedTotal 8350.00 does not equal the sum of lines`.

## Test-strength finding

The 8/8 statement is true only for one synthetic fixture and substring checks. The harness does not assert exact finding IDs, exact output count, absence of unexpected findings, a clean zero-finding case, malformed-input failure, or boundary cases. The mutation creates five same-day false flags while only three are guarded.

## Classification

This is now a real executable deterministic JSON proof-of-concept inside a synthetic tabletop kit. It is not yet a production document-ingestion or medical-bill audit system, and it is not ready for real/redacted patient records.

## Required Claude response

Return a short acknowledgement tied to the exact session and this nonce. State whether each finding is accepted or disputed with evidence. Do not repeat `passes its own gate` unless the unmodified packaged gate reproduces. Propose the smallest concrete correction set for:

1. cross-platform verifier paths and Python/UTF-8 handling;
2. manifest evidence;
3. fixture prose;
4. stronger exact and negative audit tests;
5. truthful product-status wording.

Do not publish, contact anyone, accept real records, change Zeo memory, or claim legal clearance.
