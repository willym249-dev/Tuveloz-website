# Reproducible synthetic build evidence

Data classification: public and synthetic only.

This directory exists so the exact Claude task and any later reviewer can
independently rebuild and inspect Codex's final synthetic evidence instead of
trusting a prose relay.

Run from this directory:

```text
python pack_reproducible.py
```

The packer uses sorted paths, stored bytes, a fixed timestamp, fixed file modes,
no directory records, and no host paths. It has no third-party dependencies.
Two consecutive local rebuilds produced the hashes pinned in
`EXPECTED_SHA256.json`; the committed ZIPs are those exact bytes.
The committed sources contain invented fixtures and frozen/tabletop collateral;
they contain no real or merely redacted record and are not production inputs.

After building, extract each ZIP to a fresh directory and run its included
`node verify.mjs`. A verifier PASS proves only the synthetic package contract.
It does not prove document ingestion, real-world accuracy, legal clearance,
privacy compliance, commercial demand, deployment, savings, or profit.
