# Essential vendor accounts

- **Status:** partly verified — account details awaiting the owner
- **Owner:** hello@tuveloz.com
- **Last reviewed:** 2026-09-26

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
| Owner-operated ClamAV | Malware and file-safety scanning before uploaded evidence can leave quarantine | Selected in production. Manual and automatic synthetic-file results from September 6 were confirmed in live records September 26 and accepted by current application proof validation. Refresh before the October 6 age limit. |
| Cloudmersive | Optional fallback malware scanner | The earlier account and secrets are retained. No paid upgrade is required while the owner-operated scanner is reliable. |

The deployed scanner selection is `EVIDENCE_SCAN_PROVIDER = "clamav"`. On
September 26 the owner task's latest run and signature refresh succeeded.
The earlier empty queue did not invalidate the completed September 6 file tests;
their records, receipts, and audit binding were reconciled September 26.
Stripe Identity is configured with
`IDENTITY_VERIFICATION_PROVIDERS = "stripe_identity"`; the provider-bound live
canary has not passed. See
[`../operations/evidence-scanner-activation.md`](../operations/evidence-scanner-activation.md).

Google Workspace mail loads, and activation and payment receipts are present in
the business inbox. Google Admin still requires fresh account verification to
record the exact subscription state. The dated follow-up is in
[`../OPEN-ITEMS.md`](../OPEN-ITEMS.md).

## What depends on it

- `entity_authority_domain_and_code` — the essential-vendor-contracts part
- `stripe_connect_business_model` — Stripe's approval of the actual marketplace
  model is its own artefact and belongs in its own card
- `evidence_file_security_and_scanner` — operational file proof is verified;
  keep it current and complete the separate capacity and security review

## Reminder

Set one reminder for the **payment method** on the Cloudflare and Resend
accounts, not for the accounts themselves. An expired card on the DNS and mail
providers takes the site and every sign-in email down together, and the warning
arrives by email — to a mailbox that has just stopped working.
