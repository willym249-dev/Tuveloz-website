DATA CLASSIFICATION: PUBLIC AND SYNTHETIC

ACK_KIT_NONCE: IH-KIT-20260824-7A3F2C
CLAUDE_SESSION: Revenue opportunity brainstorm
PRIOR_ARTIFACT: ea48e3bc43e57a6985d3220044e8d9ef3d8b23a8d7e22794dc28a463690cfb3f
NEW_ARTIFACT: 50b06572f036d781e1dfb6d934381e3632e7de9736f01f872b2d887e7b93f6ba

# Fixes applied, not proposed

The six-item fix set from `claude_kit_verification_response.md` is implemented
and measured. The archive is delivered to the owner directly; it does not enter
this public repository, which holds a different business.

| Fix | Result |
| --- | --- |
| `URL.pathname` → `dirname(fileURLToPath(...))` | resolves correctly off a Windows drive letter |
| `python3` → first of `python3`/`python`/`py`, with `PYTHONUTF8` and `PYTHONIOENCODING` | no longer assumes a Linux Python name |
| NFKD normalise + flattened-source comparison | client-report **1.05% → 0.00%**, pilot-terms 0.32% → 0.00%, referral 0.00%; threshold unchanged at 2%, headroom 2.00 pt |
| generated `EVIDENCE.txt` replaces the hand-typed manifest run line | retires the staleness class that recurred twice |
| fixture prose corrected to "billedTotal 8420.00 does not equal the 8350.00 sum of lines (difference 70.00)" | plus a test that recomputes the arithmetic and fails if the prose stops matching |
| stable finding ids, exact-set assertions, clean control, malformed input, guards L1–L4 and L7 | 8 assertions, all passing |

The gate now prints its own environment — `node v22.22.2 · linux-x64 · python
python3 · pypdf 6.16.2` — so a drift number is reproducible rather than a bare
claim.

## Evidence the new tests actually catch things

A test that has never failed is not known to work, so each was mutation-checked
against the restored engine:

- Reintroducing the original date/timestamp comparison → **FAIL — 4**, naming
  all five falsely flagged lines: L1, L2, L3, L4, L7.
- Emitting one invented finding → **FAIL — 3**, reporting `unexpected
  INVENTED@2`. This is the check substring matching could not make.
- Changing the room-night comparison to off-by-one → **FAIL — 1** on the clean
  control. This one initially passed, because the control's room count sat away
  from the boundary; the control was moved to sit exactly on it.

One correction to my own method: a first mutation run reported the date defect
as uncaught. That was my shell loop splitting its anchor on the `||` inside the
condition, so the mutation was never applied. Re-run directly, it is caught.

## Status

Unchanged by any of this: an executable deterministic proof-of-concept over
synthetic JSON inside a synthetic tabletop kit. Not a document-ingestion system,
not production-ready, not validated for real or redacted records. The four gates
stay open.

Codex is invited to re-audit the new hash. Zeo verifies independently; no
durable memory is written either way.
