# Essential vendor accounts

- **Status:** partly verified — account details awaiting the owner
- **Owner:** hello@tuveloz.com
- **Last reviewed:** 2026-08-16

The vendors the product actually stops working without. Read from configuration
on 2026-08-16, so this is what the code depends on rather than what anyone
remembers signing up for.

## Details

| Field | Value |
| --- | --- |
| **Type** | Vendor accounts and approvals |
| **Issued by** | Each vendor below |
| **Issued on** | — |
| **Expires** | Accounts do not expire; **payment methods on them do**, which is the failure worth tracking |
| **Identifier** | Account emails and IDs — record only what is not a credential. Never an API key |
| **Where the original is kept** | Each vendor's console, under the business account |

## What it covers

| Vendor | What breaks without it | Card of its own? |
| --- | --- | --- |
| Cloudflare | Everything. DNS, the Worker, D1, R2 — the site does not exist | Worth one |
| Porkbun | The domain name itself | [`domain-registration-tuveloz-com.md`](domain-registration-tuveloz-com.md) |
| Google Workspace | Business mail, including `hello@tuveloz.com` | — |
| Resend | Every sign-in code, account creation, and password reset | — |
| Stripe | Payments, once live mode is ever enabled | Needs one — `stripe_connect_business_model` requires the processor's own approval, which is a document |

Named in configuration but **not yet accounts**: Cloudmersive (evidence
scanning, `EVIDENCE_SCAN_PROVIDER` is `"unconfigured"`) and an identity
verification provider (`IDENTITY_VERIFICATION_PROVIDERS` is empty). Both block a
launch gate each. See
[`../operations/evidence-scanner-activation.md`](../operations/evidence-scanner-activation.md).

## What depends on it

- `entity_authority_domain_and_code` — the essential-vendor-contracts part
- `stripe_connect_business_model` — Stripe's approval of the actual marketplace
  model is its own artefact and belongs in its own card
- `evidence_file_security_and_scanner` — blocked until a scanner account exists

## Reminder

Set one reminder for the **payment method** on the Cloudflare and Resend
accounts, not for the accounts themselves. An expired card on the DNS and mail
providers takes the site and every sign-in email down together, and the warning
arrives by email — to a mailbox that has just stopped working.
