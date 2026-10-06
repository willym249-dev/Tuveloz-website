# EIN assignment

- **Status:** public reference only — private company records are maintained separately
- **Owner:** hello@tuveloz.com
- **Last reviewed:** 2026-10-05 (tax-workflow wording review)

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

The EIN identifies the business for applicable federal tax filings and related
records. Separate review must determine the marketplace's information-reporting
obligations, responsible filer, applicable forms and required collection process
before paid launch. Possessing an EIN does not resolve those questions or prove
that tax-information collection and filing are configured.

## What depends on it

- `entity_authority_domain_and_code` — the business-records part
- `cpa_tax_mor_and_transaction_map` — the CPA cannot approve who reports what
  without the entity's tax identity settled
- Provider onboarding explains that required tax and payout setup comes before
  receiving payments. The initial application does not collect a W-9. This
  explanation is not evidence of configured collection, certification or filing.

## Tax setup before paid launch

The Provider Agreement and signup explanation must describe the same timing in
English and Spanish. Neither should imply that an initial application already
collects tax forms or that filing happens automatically.

`lib/stripe-provider.ts` creates an Accounts v2 recipient account with an Express
dashboard and requests the `stripe_transfers` capability. That payment setup
alone does not establish a tax-reporting process. Stripe's
[setup guide](https://docs.stripe.com/connect/get-started-tax-reporting) describes
separate decisions about form type, calculation, filer, payer details and
delivery; its [Accounts v2 guide](https://docs.stripe.com/connect/accounts-v2)
also distinguishes configurations from capabilities and documents compatibility
with v1 endpoints for features not directly supported by v2.

Before paid launch, the tax review must establish the responsible filer and
applicable forms, secure collection and certification method, reporting totals,
electronic-delivery consent or paper delivery, filing and corrections, and any
costs. The [IRS third-party-filer FAQ](https://www.irs.gov/newsroom/form-1099-k-faqs-third-party-filers-of-form-1099-k)
explains that reporting depends on the payment arrangement. These references
are not a determination of Tuveloz's filing obligations, and passing sandbox
payments does not close the tax-review gate. Do not collect tax identifiers
through chat or the provider-document upload, or enable a paid service without
the owner's approval.

## Reminder

Nothing expires, so no reminder is needed. What does need care is the opposite
problem: this number tends to get pasted into places it should not be. If you
ever find it in this repository, that is an incident, not a tidy-up.
