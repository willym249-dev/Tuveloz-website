# Essential vendor accounts

- **Status:** partly verified — account details awaiting the owner
- **Owner:** hello@tuveloz.com
- **Last reviewed:** 2026-09-27

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
| Stripe | Provider Identity checks now; payments after a separate release | Dedicated live Identity key and signed webhook configured. [July 29 initial Connect approval](stripe-connect-platform-approval.md) and matching current fee/loss/Express selections verified September 27. A genuine provider Identity result and narrower payment-flow/service-scope reconciliation remain; do not repeat the initial Connect application. |
| Owner-operated ClamAV | Malware and file-safety scanning before uploaded evidence can leave quarantine | Selected in production. Manual and automatic synthetic-file results from September 6 were confirmed in live records September 26 and accepted by current application proof validation. Refresh before the October 6 age limit. |
| Cloudmersive | Optional fallback malware scanner | September 26 signed-in account review confirms Free Tier. The subscription-management link redirects to an upgrade offer, without showing an active paid subscription or charge history. The earlier account and secrets are retained; no paid upgrade is required for the selected owner-operated scanner. |

The deployed scanner selection is `EVIDENCE_SCAN_PROVIDER = "clamav"`. On
September 26 the owner task's latest run and signature refresh succeeded.
The earlier empty queue did not invalidate the completed September 6 file tests;
their records, receipts, and audit binding were reconciled September 26.
Stripe Identity is configured with
`IDENTITY_VERIFICATION_PROVIDERS = "stripe_identity"`; the provider-bound live
canary has not passed. See
[`../operations/evidence-scanner-activation.md`](../operations/evidence-scanner-activation.md).

Google Workspace mail loads, and activation and payment receipts are present in
the business inbox. The September 26 Google Admin password check was subsequently
completed. The subscription list and detail page show **Google Workspace Business
Plus, Active, Flexible Plan, one assigned license**. The displayed rate is
**$19.80 USD per user/month from August 5 through November 5, 2026**, then
**$26.40 per user/month after November 5**. The estimated monthly bill is $19.80;
the next billing date is **October 1, 2026**. An estimate is not a final invoice
or proof of a future successful charge. No plan, payment method, or subscription
was changed. Review whether the Plus features are needed before the discount
ends; check storage and retention effects before any proposed downgrade.
The dated follow-up is in [`../OPEN-ITEMS.md`](../OPEN-ITEMS.md).

### September 26 cost check

Resend's signed-in Billing tab lists Transactional (3,000 emails) and Marketing
(1,000 contacts), each at **$0/month**, with no payment method and no invoices.
Usage shows the free transactional limits of 3,000 monthly and 100 daily emails;
paid overage controls are disabled. No upgrade, card, add-on, or sending action
was initiated. These are current account observations, not a guarantee that
future volume fits the free plan or evidence of new delivery.

Cloudmersive's existing business login completed its emailed security check and
shows **Free Tier**. Its subscription link redirected to `/upgrade`; an upgrade
offer is not an existing subscription or a bill. This confirms the current plan,
not every historical bank transaction. The earlier failed Basic payment remains
historical evidence, not an instruction to retry it. No charge was retried,
document uploaded, API called, key read, plan selected, or scanner changed.

Evidence: `outputs/vendor-cost-review-20260926.json`, retained outside the public
repository, updated with the later Google Admin observations. The account-access
and current-price checks are complete; do not repeat them as a substitute for
reviewing whether the paid plan's features are needed.

## What depends on it

- `entity_authority_domain_and_code` — the essential-vendor-contracts part
- `stripe_connect_business_model` — Stripe's approval of the actual marketplace
  model is its own artefact and belongs in its own card
- `evidence_file_security_and_scanner` — operational file proof is verified;
  keep it current and complete the separate capacity and security review

## Reminder

Track billing continuity for paid services using the actual plan and renewal
evidence. Resend currently has no payment method on its free plans; do not add a
card or invent an expiry reminder. Revisit its sending limits when real volume
requires it. Keep Workspace, domain renewal, and Cloudflare billing checks
separate; an available mailbox does not establish the status of every vendor.
