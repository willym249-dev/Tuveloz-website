# Code ownership and contributors

- **Status:** active
- **Owner:** hello@tuveloz.com
- **Last reviewed:** 2026-08-16

Who has written the code this business runs on, and therefore whose copyright it
is. This card exists because a launch gate asks, and because the answer turned
out to be simpler than expected.

## Details

| Field | Value |
| --- | --- |
| **Type** | Ownership record |
| **Issued by** | Not issued — established by the repository's own history |
| **Issued on** | First commit in this repository |
| **Expires** | Does not expire, but goes stale the moment someone new commits |
| **Identifier** | Not applicable |
| **Where the original is kept** | The git history itself, and the GitHub repository |

## What it covers

Measured 2026-08-16 with `git shortlog -sne --all` across 961 commits. Every
author who has ever committed:

| Author | Commits | What they are |
| --- | --- | --- |
| `willym249-dev <willym249@gmail.com>` | 737 | The owner |
| `Claude <noreply@anthropic.com>` | 214 | AI assistant, working at the owner's direction |
| `Claude <hello@tuveloz.com>` | 6 | The same, under the business address |
| `Tuveloz Automation <actions@…>` | 3 | CI |
| `github-actions[bot]` | 1 | CI |

**No third-party human has ever committed to this repository.** That is the part
worth recording: there is no outside author holding copyright in this code, and
therefore no contractor IP assignment to chase, request, or produce. The
contractor-assignments half of the entity gate is answered by absence.

Work produced by an AI assistant at the owner's direction is not a third-party
human contribution, and the two Claude identities above are that. If the
classification of such output ever matters to a reviewer, this card is where the
question surfaces — it is not settled here.

## What depends on it

- `entity_authority_domain_and_code` — the code-ownership and
  contractor-assignment parts
- Any future engagement of an outside developer, which would immediately make
  this card wrong

## Reminder

Re-run `git shortlog -sne --all` before answering the entity gate, and again if
anyone outside the list above is given commit access. The value of this card is
that it is current; a stale one asserts the opposite of what it should.
