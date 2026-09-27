# Stripe Connect platform approval

- **Status:** active — initial approval verified; current launch-scope reconciliation pending
- **Owner:** hello@tuveloz.com
- **Last reviewed:** 2026-09-27

This card preserves the existing Connect approval so future work does not repeat
onboarding or treat a completed processor application as missing. It also records
the narrower questions still relevant to Tuveloz's closed marketplace.

## Approval already received

| Field | Verified observation |
| --- | --- |
| Issuer | Stripe; business-inbox sender `accounts@stripe.com` |
| Issued | July 29, 2026, 6:49 p.m. as displayed in the business inbox |
| Subject | Your Connect application is approved |
| Scope stated | TUVELOZ LLC may create live connected accounts and charges |
| Sender details | Gmail displays Verified Sender, mailed-by `bounce.stripe.com`, signed-by `stripe.com`, and TLS |
| Original | Business Gmail account; search the exact subject and sender. Private message/account references are retained outside the repository |
| Expiration | No expiration stated in the inspected email; do not invent one |

The message is stronger evidence than a linked bank account. Initial Connect
approval is complete and must not be requested again merely because it was absent
from the earlier record card. It does not itself identify every proposed service,
maximum transfer delay or later implementation change.

## Current dashboard and code comparison

The signed-in September 27 Platform setup screen matches the following code
settings. This is a comparison, not a new acceptance or account change.

| Item | Stripe's displayed selection | Current source |
| --- | --- | --- |
| Business model | Buyers purchase from the platform | Platform-created Checkout payments; quote jobs use separate transfers |
| Loss liability | Platform responsible; acknowledged July 29, 2026 | `defaults.responsibilities.losses_collector = application` |
| Stripe fees | Platform pays all Stripe fees including payment processing | `defaults.responsibilities.fees_collector = application` |
| Provider dashboard | Express | `dashboard = express` |
| Onboarding | Stripe-hosted or embedded | Hosted Account Links for recipient configuration |

The historical Platform profile also says individual seller payouts and platform
refund/chargeback liability. Both the historical profile and current setup show
an onboarding/seller-compliance acknowledgment button. It was not clicked or
accepted. A displayed button alone does not establish an account restriction;
clarify whether any acknowledgment is outstanding before accepting terms.

Sources: `lib/stripe-provider.ts`, `app/api/stripe/checkout/route.ts`, and
`app/api/stripe/admin/payments/route.ts`, inspected at local documentation commit
`7e259cb` with runtime source unchanged from released `a1f9ace`.

Quote jobs collect the provider amount plus the 5% Customer Service Fee on the
platform. After completion and owner release checks, the transfer uses the
provider's full quoted amount and references the successful source charge.
The code also contains a destination-charge branch for storefront products;
its transfer timing differs and it must not be described as a completion-held
quote payment or silently included in the initial release scope.

Neither branch supplies `on_behalf_of`. Stripe's current
[merchant-of-record documentation](https://docs.stripe.com/connect/merchant-of-record)
identifies the platform as merchant of record for indirect charges without that
parameter. It also says an Accounts v2 connected account needs merchant
configuration to be merchant of record. Tuveloz currently creates recipient
configuration. These facts require reconciliation with the final customer
disclosures and CPA/legal review; do not change account configuration or released
policy wording solely to make a label match. This is not a tax determination.

## Remaining work, with the scope narrowed

1. Preserve the July 29 approval and the matching current selections as existing
   evidence for `stripe_connect_business_model`; do not restart the application.
2. Ask Stripe only whether the current payment flow and intended service category
   fit that approval, what transfer-delay/reserve/refund limits apply, and whether
   the displayed acknowledgment requires action. The owner-approved inquiry
   below was submitted September 27; Stripe confirmed email receipt.
3. Match the initial enabled service list to the insurer/legal decisions before
   representing specialist services as supported. The full catalog is not the
   launch commitment.
4. Reconcile merchant-of-record and receipt/statement wording with the processor,
   then let the CPA/tax adviser settle tax and reporting responsibilities. The
   CPA gate remains separate; processor setup is not a tax opinion.

`stripe_connect_business_model` requires an evidence reference and valid-through
date in Tuveloz's launch controls. This email states no expiration; obtaining a
supported review interval is still necessary rather than fabricating an expiry.
No admin gate, service activation, provider approval or payment lock was changed.

## Support inquiry — sent September 27; reply pending

Destination: Stripe Support through the authenticated TUVELOZ LLC account.
No attachments, government/bank identifiers, API keys or provider records.
The owner explicitly authorized this message. It was submitted through Stripe's
authenticated support flow, selecting **Platform account** and **Send us an
email**. Stripe displayed **Email received**, captured at 20:21 UTC. Its
displayed 24-hour estimate is not a promised reply deadline. No case number or
human response was shown; do not mistake the initial AI answer for approval.

The submitted email includes the complete message below and a routing note
requesting human Connect review, a written reply to the business inbox, and
clarification of a legacy fee description without account changes. Private
submission proof is retained outside the repository. Do not send a duplicate.

**Subject: Tuveloz — confirm existing Connect approval against our payment flow**

Hello Stripe Support,

TUVELOZ LLC received your Connect approval on July 29, 2026. Our current Platform
setup shows buyers purchasing from the platform, platform responsibility for
Stripe fees and negative balances, and Express connected accounts.

Before opening customer bookings, please confirm whether our existing approval
covers this planned use, or identify the specific additional review required:

- Tuveloz connects customers in Montgomery County, Maryland, with independent
  vehicle-service businesses. Providers set their labor-only quotes and perform
  the work; customers buy parts separately.
- Our quote flow uses Stripe-hosted Checkout and separate charges/transfers. The
  customer pays the provider quote plus a 5% Customer Service Fee. After job
  completion and owner release checks, the provider receives the full quote.
  Connected accounts use Accounts v2 recipient configuration and Express; the
  charge does not use `on_behalf_of`.
- Customer bookings and payments remain disabled. The initial service list is
  still subject to licensing and insurance review; we are not seeking blanket
  approval for every vehicle-service category.

Please confirm any category restrictions, limits on delaying transfers, reserves,
refund/dispute responsibilities and required merchant-of-record receipt/statement
disclosures. Our code also contains a destination-charge storefront branch that
is not live; please distinguish any requirements for it from the quote flow.

Platform setup still shows an onboarding-responsibility acknowledgment button.
Does this require action on our account? Please identify any review/renewal date
or conditions attached to your answer. A written reply is sufficient; please do
not change settings, activate payments or enroll us in a paid service.

Thank you,
Tuveloz

## Saved business-description discrepancy

After the automated support reply mentioned a different fee, a targeted read of
the actual Business details product-description field confirmed that its last
sentence still says Tuveloz charges customers a **10% platform service fee**.
That is stale account copy, not the website's current price. The application
constant remains 500 basis points and providers keep their full quoted amount.
The editor was closed without saving; legal, address and tax fields were not
changed. Correcting this processor-facing description is a separate account
update, not a change to the site's fee or an acceptance of Stripe terms.

Prepared replacement for owner review:

> Tuveloz is an online marketplace connecting customers in Montgomery County,
> Maryland, with independent vehicle-service businesses. Providers set
> labor-only quotes and perform the work; customers buy parts separately.
> Customer accounts and provider applications are open. Customer bookings and
> payments are not yet available. The planned payment flow collects the provider
> quote plus a 5% Customer Service Fee from the customer; the provider receives
> the full quoted amount after job completion and owner release checks. Initial
> services remain subject to licensing and insurance review.

## History

- **2026-09-27:** Owner-approved inquiry reached Stripe's email support queue;
  confirmation captured. Requested human review and distinguished the verified
  July 29 approval from the AI's conflicting date/fee statements. Directly
  confirmed the stale product-description fee and prepared the correction.
  No support answer, account update, term acceptance or launch approval claimed.
- **2026-09-27:** Read the approval email and sender details in the business inbox;
  compared signed-in historical/current Connect selections to source. Recorded
  initial approval as complete and prepared only the remaining clarification.
  No support inquiry, new acknowledgment, purchase or transaction occurred.
