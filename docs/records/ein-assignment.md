# EIN assignment

- **Status:** blank — awaiting the owner
- **Owner:** hello@tuveloz.com
- **Last reviewed:** 2026-08-16

The federal tax identity the business files, pays, and reports under.

## Details

| Field | Value |
| --- | --- |
| **Type** | Tax registration |
| **Issued by** | Internal Revenue Service |
| **Issued on** | — |
| **Expires** | Does not expire |
| **Identifier** | **Leave blank.** An EIN is a government identifier and this repository is public source code. The register README forbids it and so does `CLAUDE.md` |
| **Where the original is kept** | Describe the location — the CP 575 notice, or wherever it is filed. Do not attach or link it here |

## What it covers

Filing and paying federal tax, and the information reporting the marketplace
will have to do once money moves: 1099 issuance to providers, and the W-9
collection that precedes it. The requirement is not optional and does not scale
with size.

## What depends on it

- `entity_authority_domain_and_code` — the business-records part
- `cpa_tax_mor_and_transaction_map` — the CPA cannot approve who reports what
  without the entity's tax identity settled
- Provider onboarding: W-9 collection is already visible in the signup flow, and
  1099 issuance follows from it

## Reminder

Nothing expires, so no reminder is needed. What does need care is the opposite
problem: this number tends to get pasted into places it should not be. If you
ever find it in this repository, that is an incident, not a tidy-up.
