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
These static files are prepared for the next approved website release, not
confirmed live. Update this collection when a direct dependency changes. This
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
| Current homepage and fonts | Homepage source uses the shared brand mark, with no stock photo/video references found in that file. Current layout/CSS use system fonts. | September 27 cleanup removes eleven unused cached fonts and two generated stylesheets from the current checkout; Git history preserves them. The old build copied all eleven fonts despite no page import. The updated build contains none, and its regression check passes. `.vinext` is now ignored. This cleanup is tested locally and awaits publication. |
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

## What depends on it

- `entity_authority_domain_and_code` — the code-ownership and
  contractor-assignment parts
- Any new contributor, imported material, or unresolved provenance question

## Reminder

Refresh the scoped inventory before answering the entity gate and identify the
relevant private record references. Do not place signed private agreements,
personal identifiers, or credentials in the public repository.
