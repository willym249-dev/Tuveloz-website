# Code ownership and contributors

- **Status:** partial evidence; owner records still required
- **Owner:** hello@tuveloz.com
- **Last reviewed:** 2026-09-27

This card inventories repository authorship, dependency notices, and asset
provenance for the company-authority gate. It does not establish copyright
ownership or satisfy an assignment or license requirement by itself.

## Details

| Field | Value |
| --- | --- |
| **Type** | Contribution inventory and ownership evidence |
| **Source** | Git history plus separately held contribution, assignment, and license records |
| **Snapshot** | `origin/main` at `546e60adeac216c4b99822d6e6af709ab74ea24c`; current GitHub main matched on September 27 |
| **Reviewed on** | 2026-09-27 |
| **Expires** | Refresh when code or contributors change; the launch approval has its own validity date |
| **Private originals** | Owner still needs to identify where relevant records are kept |

## What it covers

`git rev-list --count origin/main` returned 503 commits. The command
`git shortlog -sn origin/main` returned these author labels:

| Author label | Commits in this main-branch snapshot |
| --- | --- |
| `willym249-dev` | 434 |
| `Claude` | 69 |

This replaces the September 5 main-only snapshot of 427 commits. Local
continuation commits after main are excluded. It is not comparable to
the former August 16 count of 961 across all locally available branches.
Author labels can be configured;
they do not independently verify a person's identity, contribution rights, or
the provenance of copied assets and dependencies.

The former wording inferred that no third-party human contribution or IP
assignment could exist because none appeared under another author label. That
inference is withdrawn. Commit metadata alone cannot support it.

The owner confirms the people and organizations that contributed code, assets,
or other material, including work introduced through another person's commits.
Retain applicable agreements, assignments, permissions, and dependency/asset
license records privately. Record a justified "not applicable" only after that
review, not solely from the shortlog.

## September 27 dependency and asset inventory

Private evidence: `outputs/ownership-asset-evidence-20260927.json`, generated
by a read-only local inspection. It contains the lockfile hash, package
versions/license metadata, hashes of available direct-dependency notices,
and 28 tracked asset hashes. No account subscription or cloud archive was read
or changed during this inspection.

All nine installed direct dependency versions match the lockfile. Eight
declare MIT; `drizzle-orm` declares Apache-2.0. Eight packages include a
root-level license file. `jose` lacks a license field in this lockfile but its
installed package and `LICENSE.md` identify MIT; the missing field is not proof
of missing permission. `drizzle-orm` has no root-level license/notice file in
this installation. Its Apache-2.0 text has now been preserved from the
[official 0.45.2 source](https://github.com/drizzle-team/drizzle-orm/blob/273c78071d4841b497f5144734b38294df7ec64b/LICENSE),
pinned to that release commit and checked against the retrieved Git blob.

All nine direct dependency notices are preserved without modification in
[`public/third-party-notices/`](../../public/third-party-notices/), with exact
versions, sources and SHA-256 hashes in `manifest.json`. Eight were copied from
the matching installed packages; Drizzle came from the pinned upstream source.
These static files are confirmed live through owner-approved PR #251, release
`643a143`. September 27 independent checks matched all nine live notice hashes.
Update this collection when a direct dependency changes. This
closes the missing direct-dependency notice collection, not the wider review
of distributed transitive dependencies or ownership.

The lockfile has 741 package entries, excluding the project root. It includes
development tools and optional binaries for other platforms; it is not an
inventory of code actually sent to browsers or deployed to the Worker. The
private inventory identifies LGPL, MPL and CC-BY metadata for targeted notice
review. Those labels are not findings of incompatibility or a need to replace
packages. Actual distributed files, required notices and any modifications
still need reconciliation before this card can support final sign-off.

| Asset group | Verified repository evidence | Remaining provenance record |
| --- | --- | --- |
| Website badge, icons and link preview | `scripts/generate-brand-assets.mjs` uses `brand/tuveloz-icon.svg` and `brand/social-media-kit/Tuveloz Logo.png`; the public assets and both masters are hashed in the private inventory. This pass did not regenerate or replace them. | Owner's source/creation record or applicable rights for the masters. Consistent appearance is not ownership evidence. |
| Current homepage and fonts | Homepage source uses the shared brand mark, with no stock photo/video references found in that file. Current layout/CSS use system fonts. | September 27 owner-approved PR #251 removed eleven unused cached fonts and two generated stylesheets; Git history preserves them. The old build copied all eleven fonts despite no page import. The updated build contains none and its regression check passes. `.vinext` is now ignored. Release 643a143 is confirmed live; the formerly served font returns 404. |
| Older Ad 01 media | The August handoff records an expired music publication window and removal of two renders plus `music.mp3`. All three remain absent locally. | The R2 checksum manifest still lists the old renders; an archive entry is not permission to publish. Do not restore these for publication. Other surviving generated visuals need their own source/rights records before reuse. |
| Older ad plans | September 27 notices distinguish historical proposals from current publication or purchase authorization. | Recheck claims, permissions and any applicable participant releases before a new campaign. The owner's preference is simple, professional creative without fake-looking AI pictures. |

The ad notes contain historical subscription prices, credits and expiry dates;
they are not a current billing audit. No renewal, upgrade, paid generation,
advertising spend, media publication, or live website change is authorized by
this record.

Local cleanup evidence: `outputs/unused-font-cache-before-20260927.log`
reproduces the unwanted build files; `outputs/font-cleanup-tests-20260927.log`
records the successful build and all 793 tests after removal. TypeScript
passes; lint has zero errors and one unchanged `site-language.tsx` warning.
Pages, styling, dependency versions, policy releases and launch locks were
not changed.

## September 27 build-output notice review

A separate local production build of merged source `643a143` used a temporary,
read-only bundler observer. The observer recorded 172 JavaScript chunks across
the browser, SSR and RSC outputs and 36 installed package/version locations.
Every observed installed version matches the lockfile. This is more specific
than the 741-entry lockfile inventory, which also includes development-only and
other-platform packages. It is local build evidence, not proof that every
byte matches the production deployment.

Preserved 39 license/copyright files for those 36 package installations in the
private `outputs/distributed-notices-20260927/` collection. Copies were checked
byte-for-byte against their recorded sources and hashed. The follow-up below
prepares their repository packaging; only the nine direct-dependency notices
are currently confirmed deployed.

The installed `@vitejs/plugin-rsc` package omits its own license file. Its
upstream MIT notice was preserved from the official `plugin-rsc@0.5.26` tag,
resolved to commit `65d378fc4d9bd8d383dc7598817261b3bdcb0861`; the Git blob hash
and saved bytes match. The MIT, Apache-2.0, BSD-3-Clause and 0BSD declarations
in the observed package set do not by themselves establish complete coverage.

The review also found a bundled component that is not a separate installed
package: `@hiogawa/utils@1.7.0`, identified by a source-region marker inside
the plugin's emitted helper module. Its exact npm archive passed the registry's
SHA-512 integrity value. It declares MIT, but neither that six-file archive
nor the official release commit
`71f588d9ed860b2104ae4ce4f97dcf0af5d6249c` contains a license file. The release
history identifies that commit as version 1.7.0. No generic copyright text was
invented or substituted. Obtain a supported notice source or reviewer guidance
before claiming the wider notice collection is complete. The owner-approved
upstream inquiry was posted as recorded below; its later response is recorded
under "Maintainer notice supplied".

September 27 follow-up: the current upstream main tree
`08c2ee8e07e9b9a5fdde871a57c0df67b5750219` also has no license/notice file,
and the scoped issue search found no existing license question. A short public
question requesting the official MIT text, copyright attribution and its
applicability to 1.7.0 is prepared in the private output
`hiogawa-license-inquiry-20260927.md`. After the owner was shown the exact public
question and instructed us to continue, it was posted through the existing
repository-owner GitHub account on September 27 at 21:52:09 UTC:
[hi-ogawa/js-utils issue #276](https://github.com/hi-ogawa/js-utils/issues/276).
A fresh issue read verified the title, complete body, author and Open status;
zero comments were present at that check. Do not repost it. This requests an
authoritative notice and version applicability; it does not infer license terms
or a copyright owner, authorize payment, or establish clearance.

Private evidence: `outputs/distributed-packages-20260927.json`,
`outputs/distributed-packages-build-20260927.log`, and the preserved collection's
`manifest.json`. No package was installed or upgraded, no application code or
configuration was changed, and no launch gate was approved. Owner contribution
records, brand-master provenance and final distribution review remain open.

### Notice packaging prepared and published September 27

[`bundled-manifest.json`](../../public/third-party-notices/bundled-manifest.json)
now describes the 36 observed package installations and all 39 notice references.
Eight references reuse the existing direct-dependency files. The other 31
unmodified files, totaling 40,076 bytes, are prepared under
`public/third-party-notices/bundled/`. The original direct manifest and all nine
direct notices are unchanged. The README distinguishes the two inventories and
the bundled manifest explicitly retains the unresolved embedded-helper notice.
No generic license text or attribution was substituted.

Before copying, each installed name/version was checked against the lockfile
and the preserved package observation; every source notice's size and SHA-256
matched. Local notices also matched the installed originals. The two previously
verified upstream-only notices retain their exact release-commit URLs and
preserved hashes. The lockfile is unchanged from the source inventory.

A fresh production build at runtime-equivalent local commit `e2ff632` observed
the same 36 package installations across 172 chunks. Every notice referenced by
the bundled manifest, both manifests and the README reached `dist/client` with
exact bytes. This confirms packaging in the local build, not a deployment or
complete license clearance. The public manifest preserves the original dated
build observation; private evidence records this fresh comparison.

`.gitattributes` preserves the additional notice files' original bytes and
whitespace. Private preparation/build/verification evidence:
`outputs/bundled-notices-preparation-20260927.json`,
`outputs/bundled-notices-build-20260927.log`,
`outputs/distributed-packages-current-20260927.json` and
`outputs/bundled-notices-validation-20260927.json`.
No application flow, dependency version, policy or launch control changed.
All 809 existing tests subsequently passed, and the TypeScript/Worker check
passed. Lint had zero errors and the one unchanged language-navigation warning.
The first restricted test attempt hit Windows directory permissions; rerunning
the same suite with the required access passed without source changes. This is
local release preparation; the completed remote publication is recorded below.
The upstream inquiry is posted as recorded above. Do not repeat the collection
or ask again for permission to send that completed message.

### Publication verified September 27

PR #255 merged tested head 1821c39 as b5c67a9. Both PR workflows and all three production jobs in 36355757574 passed. Independent live verification at 22:52:46 UTC confirmed the exact release, ready application/database/schema, both notice manifests and README, and every byte/hash of all 40 unique notice files (31 added plus nine original). The bundled inventory covers 36 installations and 39 references. Signed-out provider access remains 401/no-store/error-only. Accounts/applications are open; customer requests/payments remain closed.

See private pr255-live-release-20260927.json and
pr255-production-result-20260927.json. Packaging and publication are complete;
issue #276 was still awaiting an answer at that verification. Its later response
is recorded below; final distribution/ownership review remains separate. Do not
repeat the completed collection or PR #255 publication.

### Maintainer notice supplied — September 27

The owner supplied the response and asked us to finish the check. The upstream
[issue #276](https://github.com/hi-ogawa/js-utils/issues/276) is now Closed.
The repository owner says the license was added through
[PR #277](https://github.com/hi-ogawa/js-utils/pull/277), which explicitly closes
our question about the official notice for version 1.7.0. The PR says the packages
already declare MIT and adds the missing repository license text. It merged at
2026-09-28 03:35:11 UTC (September 27 Maryland time).

Current installed `@vitejs/plugin-rsc@0.5.26` and its lockfile entry still match.
Its `dist/dist-rz-Bnebz.js` still identifies the embedded `@hiogawa/utils@1.7.0`
source region. The maintainer also mentions removal in a later plugin version;
that does not remove the helper from our installed version. No upgrade is needed
to preserve the newly supplied notice, and no dependency was changed.

Copied the exact 1,070-byte MIT text from official commit
`978a54938a661c389d7fe80b457eef2c2441ff08`, with its attribution to
Hiroshi Ogawa, into `public/third-party-notices/bundled/hiogawa-utils-1.7.0-LICENSE.txt`.
Git blob `fb2084d564e77db7b6247cf52ed5a0f4d71eef37` and SHA-256
`bbea4cfaf9ae6f3dcfd3ca5eb4a1e4d3c33c4219da7524df8c485cc60e7e4521`
match the upstream bytes. The bundled manifest records the pinned source,
maintainer response and resolution basis in `resolvedEmbeddedComponents`; the
previous unresolved list is empty. The original archive still had no notice;
we do not rewrite that historical fact or claim a retroactively changed archive.

This resolves the specific missing-notice inquiry based on the maintainer's
direct response and explicitly linked fix. The supplemental notice and README
are prepared for publication with the approved Spanish checkout-label fix.
The existing 40 notice files and original direct manifest are preserved. Overall
ownership, brand provenance, private contributor evidence and launch review
remain separate; no legal gate was marked approved and no reply was sent.

## What depends on it

- `entity_authority_domain_and_code` — the code-ownership and
  contractor-assignment parts
- Any new contributor, imported material, or unresolved provenance question

## Reminder

Refresh the scoped inventory before answering the entity gate and identify the
relevant private record references. Do not place signed private agreements,
personal identifiers, or credentials in the public repository.
