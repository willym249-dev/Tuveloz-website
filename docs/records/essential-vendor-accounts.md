# Essential vendor accounts

- **Status:** partly verified — account details awaiting the owner
- **Owner:** hello@tuveloz.com
- **Last reviewed:** 2026-09-05

The product's vendor dependencies. Configuration and account access are
observations, not proof of subscription continuity or approval of the business
model. Recheck billing and contract records before approving a launch gate.

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
| Stripe | Provider Identity checks now; payments after a separate release | Dedicated live Identity key and signed webhook configured. A genuine provider result and the separate `stripe_connect_business_model` evidence are still required. |
| Cloudmersive | Malware scanning before uploaded evidence can leave quarantine | Account and both encrypted secrets exist. Free Tier still shown on September 5; paid capacity and operational proof remain incomplete. |

Cloudmersive processing remains off (`EVIDENCE_SCAN_PROVIDER` is
`"unconfigured"`). Stripe Identity is configured with
`IDENTITY_VERIFICATION_PROVIDERS = "stripe_identity"`; the provider-bound live
canary has not passed. See
[`../operations/evidence-scanner-activation.md`](../operations/evidence-scanner-activation.md).

Google Workspace still displayed a billing-continuity notice on September 5
with a September 7 deadline. Gmail was accessible, but Google Admin required
another password check. The dated follow-up is in
[`../OPEN-ITEMS.md`](../OPEN-ITEMS.md). Mail authentication passing does not
resolve a billing notice.

## What depends on it

- `entity_authority_domain_and_code` — the essential-vendor-contracts part
- `stripe_connect_business_model` — Stripe's approval of the actual marketplace
  model is its own artefact and belongs in its own card
- `evidence_file_security_and_scanner` — still needs capacity, an actual scan,
  and security review even though the account and credentials exist

## Reminder

Set one reminder for the **payment method** on the Cloudflare and Resend
accounts, not for the accounts themselves. An expired card on the DNS and mail
providers takes the site and every sign-in email down together, and the warning
arrives by email — to a mailbox that has just stopped working.
