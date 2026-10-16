# Local braces security patch

This is the MIT-licensed `braces@3.0.3` source with the five runtime-file changes
proposed in [upstream PR #72](https://github.com/micromatch/braces/pull/72),
commit `28d440b5dd449dbf1fe6f3506cf94ecca4d02660`. That proposal is **closed,
not merged or released by the maintainer** as of October 16, 2026. This private local copy
is maintained by Tuveloz until a reviewed upstream replacement is available.
It is not an official fixed release. The private fork is explicitly named
`@tuveloz/braces@3.0.3-tuveloz.2`, while the root alias keeps the existing
`require('braces')` API. Upstream 3.0.3 remains recorded in the provenance.

The patch caps brace/parenthesis parsing and recursive AST traversal at 100
levels, including direct AST inputs to compile, expand and stringify. Callers
may lower this limit but cannot raise it. Ordinary patterns retain their
existing API and behavior. Rejected input still raises a documented exception;
applications accepting untrusted patterns must handle that exception.

The October 16 review adopts the three runtime security/compatibility changes
between the initially reviewed `d0d575e55e74a4e0218e5248fafb79efc3e54ebb` and
the pinned commit above. Fractional limits reject the next whole nesting level;
stringify preserves the released behavior with `escapeInvalid`; expansion rejects
cyclic AST parent chains instead of looping forever. All three regressions were
reproduced against the prior local copy before applying the corrections. Tests
bound cyclic-input execution time so a regression cannot hang the test runner.

Only those reviewed security changes are applied to the original 3.0.3 source.
The upstream development branch also contains unrelated parser quote handling
and invalid-state changes; those are not adopted. Therefore the entire parse.js
file is not byte-identical to the proposal's development branch. The added and
removed lines of all three adopted runtime diffs match the pinned upstream delta;
the provenance hashes describe the exact local files.

`patch-provenance.json` records the original npm archive's integrity and
normalized SHA-256 hashes of the original and patched files. Runtime source and
LICENSE came from that archive. Package metadata identifies the private fork
and its repository, adds a patch notice, and removes upstream development
scripts/dependencies from this local runtime copy. Original authors and license
are retained. No runtime dependency was added; fill-range remains unchanged.

The root npm override makes both micromatch consumers use this exact local
copy. **npm audit does not analyze patched source**, so a clean audit alone
does not verify this mitigation. npm 10 continued flagging the initially
unchanged upstream name/version, whereas npm 12 omitted that local package.
The explicit fork identity describes the modified source; neither scanner
result establishes its safety. `npm run security:check` first requires
the checked-in file hashes, installed-consumer resolution, lockfile constraints,
and executable deep-input/AST/boundary/normal-pattern tests, then runs the
unchanged high-severity npm audit. There is no advisory ignore list or reduced
audit threshold. Future changes to this patch require source review and new
hashes/tests. Do not remove these checks while the local override exists.

Advisory: [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm).
An upstream fix must replace this override only after review and the complete
application checks. Never point the override at a moving Git branch.
