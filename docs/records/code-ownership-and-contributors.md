# Code ownership and contributors

- **Status:** partial evidence; owner records still required
- **Owner:** hello@tuveloz.com
- **Last reviewed:** 2026-09-05

This card inventories repository authorship metadata for the company-authority
gate. It does not establish copyright ownership or satisfy an assignment or
license requirement by itself.

## Details

| Field | Value |
| --- | --- |
| **Type** | Contribution inventory and ownership evidence |
| **Source** | Git history plus separately held contribution, assignment, and license records |
| **Snapshot** | `origin/main` at `e09a82ca4898f1c81efbb78120b012e5bda8c489` |
| **Reviewed on** | 2026-09-05 |
| **Expires** | Refresh when code or contributors change; the launch approval has its own validity date |
| **Private originals** | Owner still needs to identify where relevant records are kept |

## What it covers

`git rev-list --count origin/main` returned 427 commits. The command
`git shortlog -sn origin/main` returned these author labels:

| Author label | Commits in this main-branch snapshot |
| --- | --- |
| `willym249-dev` | 358 |
| `Claude` | 69 |

This scope is main only. It is not comparable to the former August 16 count of
961 across all locally available branches. Author labels can be configured;
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

## What depends on it

- `entity_authority_domain_and_code` — the code-ownership and
  contractor-assignment parts
- Any new contributor, imported material, or unresolved provenance question

## Reminder

Refresh the scoped inventory before answering the entity gate and identify the
relevant private record references. Do not place signed private agreements,
personal identifiers, or credentials in the public repository.
