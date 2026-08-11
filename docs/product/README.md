# Product and technical documents

Feature specifications, interface contracts, and records of design decisions —
particularly the ones where the reasoning is not obvious from reading the code.

Nothing filed here yet.
[`../EVIDENCE_SCANNER_CALLBACK.md`](../EVIDENCE_SCANNER_CALLBACK.md), the
malware-scanner callback contract, stayed at the top of `docs/` so existing
links keep working. New specifications go in this folder.

A decision record is worth writing whenever a choice was hard, contested, or
constrained by something external. Say what was decided, what else was
considered, and what forced the answer. When a later decision overturns it, mark
the old one `Status: superseded` and link forward rather than deleting it.

Some behavior that looks like it should be documented is instead enforced in
configuration, and that configuration is the source of truth:
`config/provider-eligibility-matrix.json` for service permissions,
`lib/launch-readiness.ts` for the go-live gates, and `lib/launch-status.ts` for
whether the marketplace is open at all.

See [`../FILING-GUIDE.md`](../FILING-GUIDE.md) for naming and the header block
every document needs, and add a row to [`../README.md`](../README.md) when you
file something.
