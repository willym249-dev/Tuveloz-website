# Local braces security patch

This is the MIT-licensed `braces@3.0.3` source with the six runtime-file changes
proposed in [upstream PR #72](https://github.com/micromatch/braces/pull/72),
commit `d0d575e55e74a4e0218e5248fafb79efc3e54ebb`. That proposal is **not merged
or released by the maintainer** as of October 3, 2026. This private local copy
is maintained by Tuveloz until a reviewed upstream replacement is available.
It is not an official fixed release; the original version is preserved.

The patch caps brace/parenthesis parsing and recursive AST traversal at 100
levels, including direct AST inputs to compile, expand and stringify. Callers
may lower this limit but cannot raise it. Ordinary patterns retain their
existing API and behavior. Rejected input still raises a documented exception;
applications accepting untrusted patterns must handle that exception.

`patch-provenance.json` records the original npm archive's integrity and
normalized SHA-256 hashes of the original and patched files. Runtime source and
LICENSE came from that archive. Package metadata only adds `private` and a patch
notice, and removes upstream development scripts/dependencies from this local
runtime copy. No dependency was added; fill-range remains unchanged.

The root npm override makes both micromatch consumers use this exact local
copy. **npm audit does not analyze local package source**, so a clean audit
alone does not verify this mitigation. `npm run security:check` first requires
the checked-in file hashes, installed-consumer resolution, lockfile constraints,
and executable deep-input/AST/boundary/normal-pattern tests, then runs the
unchanged high-severity npm audit. There is no advisory ignore list or reduced
audit threshold. Future changes to this patch require source review and new
hashes/tests. Do not remove these checks while the local override exists.

Advisory: [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm).
An upstream fix must replace this override only after review and the complete
application checks. Never point the override at a moving Git branch.
