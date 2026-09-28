# Stripe Connect platform approval

- **Status:** active — initial approval and written processor reply verified; launch-scope reconciliation pending
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
an onboarding/seller-compliance acknowledgment button. Stripe's September 27
written reply confirms that an authorized representative needs to complete it.
The same button remains visible in Platform setup. It was not clicked or
accepted; its exact terms and consequences still need review. This is separate
from the negative-balance acknowledgment already dated July 29.

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
2. Preserve the September 27 substantive response below. Prepare a same-thread
   follow-up only for unanswered transfer-delay and service-category questions,
   account-specific conditions, and the exact onboarding acknowledgment text.
   The owner-approved follow-up was sent September 27 at 8:05 p.m. Maryland time;
   do not repeat either inquiry. The remaining answers are pending.
3. Match the initial enabled service list to the insurer/legal decisions before
   representing specialist services as supported. The full catalog is not the
   launch commitment.
4. Use the confirmed platform merchant-of-record role to finish the checkout,
   receipt and policy disclosure review below. The current public business name
   and statement descriptor already show TUVELOZ LLC; do not replace them.
   The CPA gate remains separate; processor setup is not a tax opinion.
5. Review the outstanding onboarding acknowledgment with the authorized owner
   before acceptance. Do not infer permission to accept it from support's email,
   or turn completion into permission to open bookings or payments.

`stripe_connect_business_model` requires an evidence reference and valid-through
date in Tuveloz's launch controls. This email states no expiration; obtaining a
supported review interval is still necessary rather than fabricating an expiry.
No admin gate, service activation, provider approval or payment lock was changed.

## Support inquiry — sent September 27; written reply received

Destination: Stripe Support through the authenticated TUVELOZ LLC account.
No attachments, government/bank identifiers, API keys or provider records.
The owner explicitly authorized this message. It was submitted through Stripe's
authenticated support flow, selecting **Platform account** and **Send us an
email**. Stripe displayed **Email received**, captured at 20:21 UTC. Its
displayed 24-hour estimate is not a promised reply deadline. No case number or
human response was shown; do not mistake the initial AI answer for approval.

A subsequent business-inbox check found Stripe's **We've received your message**
acknowledgment from `support@stripe.com`, displayed September 27 at 4:20 p.m.
Gmail identifies the sender as Verified Sender. The body confirms receipt and
says a response will follow; it contains no substantive review decision. Its
private message reference and screenshot are retained outside the repository.

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

## Written response received September 27

Business Gmail shows **Re: Your recent question for Stripe about Connect** from
`support@stripe.com`, September 27 at **5:24 p.m. Maryland time**. The message is
signed by Smriti. Expanded sender details show `stripe.com` signing, a Salesforce
mailing domain and TLS. This is the substantive response, separate from the
4:20 p.m. acknowledgment. The original remains in the business inbox; private
message references and observations stay outside this repository.

| Question | Stripe's written answer | What remains |
| --- | --- | --- |
| Merchant of record | TUVELOZ LLC is the payment merchant for Express accounts with separate charges/transfers and no `on_behalf_of`. | Make checkout, payment confirmation and policies explicit before launch; this does not make Tuveloz the repair business or settle tax law. |
| Customer identity/disclosure | Receipts/statements must identify TUVELOZ LLC or a registered DBA; explain that payment is with Tuveloz while the provider performs labor. | Current dashboard public name and descriptor were independently read as TUVELOZ LLC. A real or authorized test receipt remains separate evidence. |
| Fees, refunds and disputes | Platform bears the stated Stripe fees/loss exposure; disputes can debit the platform even after a provider transfer. | Final refund/recovery controls, financial reserves and tax/accounting review. This is not a promise that recovery from a provider succeeds. |
| Existing approval | The reply confirms the described general Connect arrangement. | No specific service-category determination or maximum transfer-delay answer was supplied. |
| Onboarding acknowledgment | An authorized representative must complete it; it is one-time with no recurring renewal date, subject to later configuration changes. | Review exact terms and obtain the applicable acceptance authorization. No acknowledgment was accepted during this inspection. |
| Other payment branch | A later destination-charge launch needs its own assessment. | Both current branches omit `on_behalf_of`; support's conditional discussion of destination charges with that parameter is not evidence that the code uses it. |

The response calls the quote flow "live" in one sentence, but both our original
inquiry and current release evidence say payments/bookings remain closed. The
follow-up corrects that description. Do not treat it as a launch authorization.
The email does not set an expiry for the overall Connect approval; its statement
about no recurring renewal applies specifically to the onboarding acknowledgment.

Official documentation rechecked September 27 supports the payment-model facts:
[merchant of record](https://docs.stripe.com/connect/merchant-of-record),
[statement descriptor usage](https://docs.stripe.com/connect/statement-descriptors#statement-descriptor-usage),
and [disputes](https://docs.stripe.com/connect/disputes#destination-and-separate-charges-and-transfers).
Support's linked reserves page was not readable through the public fetch tool;
its specific reserve discussion is retained as correspondence, not independent
confirmation of an amount, deadline or account restriction.

### Disclosure review — interface repair published; policy and receipt review pending

The original source review used `b5c67a9`; the table below is reconciled to
published release `299fd4c`. Keep the current account settings, policy releases,
fee, provider quote and launch controls intact while the remaining review is
unresolved. A processor statement is not a substitute for the separate tax,
consumer-policy and service-scope decisions. The specific candidate English and
Spanish clauses, collection-timing discrepancy and acceptance-language gaps are
in the [payment policy reconciliation](../legal/payment-policy-reconciliation.md).

| Surface | Current evidence | Required review action |
| --- | --- | --- |
| Stripe public name/card statement | Both display TUVELOZ LLC in signed-in Business details. | Complete for the observed fields; do not change or repeat setup. Actual receipt rendering is not yet proved. |
| `app/components/quote-payment-card.tsx` | PR #256 places the bilingual payment-merchant disclosure beside the total. | Complete for this interface; preserve it. The broader quote authorization remains English-only. |
| `app/api/stripe/checkout/route.ts` | PR #256 supplies merchant `custom_text`, locale and language-preserving return URLs. Neither branch sets `on_behalf_of`. | Preserve the completed implementation; verify actual hosted rendering in the separate test-mode rehearsal. |
| `app/success/page.tsx` | PR #256 identifies TUVELOZ LLC on an authenticated payment record and distinguishes payment states in both languages. | Complete for the published interface; preserve it. This is not an actual Stripe receipt. |
| `app/payments/page.tsx`, `app/terms/page.tsx`, `app/customer-agreement/page.tsx` and `app/provider-agreement/page.tsx` | Current text leaves some payment-role decisions pending; Terms section 7 can imply collection only after completion. Terms, Payment Policy and Provider Agreement have complete, separately hashed Spanish translations; Customer Agreement does not have a Spanish-ready route. | Review the exact clauses and timing together. A complete customer translation draft is now prepared; adopt its final paired wording before release through the existing translation/policy version process. |
| Accepted customer evidence | Released English documents and exact scope are recorded. The customer authorization omits the merchant sentence, language and Spanish release metadata. The provider path already binds all three relevant translation hashes and language. | Extend the customer path using the existing provider approach, preserving prior records. Verify saved/downloaded text and stale-consent rejection. Do not duplicate the provider system, fabricate review or reuse stale hashes. |

Proposed short pre-payment wording for review:

> Your payment is to TUVELOZ LLC. [Provider business] will perform the vehicle
> service. Your total includes the provider's labor quote and a separate 5%
> Customer Service Fee. For payment or refund questions, contact hello@tuveloz.com.

Spanish draft:

> El pago se realiza a TUVELOZ LLC. [Nombre del negocio proveedor] realizará el
> servicio de su vehículo. El total incluye la mano de obra cotizada por el
> proveedor y una tarifa de servicio al cliente del 5%, indicada por separado.
> Para preguntas sobre el pago o un reembolso, escriba a hello@tuveloz.com.

Historical draft verified-payment label: **Payment collected by TUVELOZ LLC. Vehicle
service provided by [Provider business].** Spanish: **Pago recibido por TUVELOZ
LLC. Servicio del vehículo prestado por [nombre del negocio proveedor].**
This label was superseded for the interface by PR #256's neutral payment-record
label, which also works for pending, failed and refunded records. The paragraphs
above remain review drafts, not published policies, a new receipt, a promise of
refund eligibility, or proof of legal/tax approval. Use the linked reconciliation
for the next policy review rather than replaying this earlier interface proposal.

PR #256 adds concise payment-merchant wording to the quote total,
hosted Checkout submit text, and authenticated payment record, with English and
Spanish text. The hosted session and return links preserve the selected language.
The payment-result page now translates in place, distinguishes unavailable records
from closed checkout, and uses readable status labels without calling pending,
failed, refunded or disputed payments paid. It creates no public Spanish payment
record alias. Amounts, payment type, provider settlement and launch locks are
unchanged. The owner-approved head 04cb36b was merged as 299fd4c; production run
36363910803 and independent live release/browser checks passed September 27
Maryland time. The interface repair is published. It is not a real Stripe receipt
test, a policy release, or completion of the policy/acceptance evidence review.
Do not repeat its publication approval or deployment.

### Narrow follow-up — sent September 27

The owner approved the exact prepared reply, then instructed us to continue.
Business Gmail confirmed **Message sent** at **8:05 p.m. Maryland time**.
Expanded sent-message details independently show `hello@tuveloz.com` to
`support@stripe.com`, the existing subject, and the exact approved body.
The reply and screenshot are retained privately as
`outputs/stripe-support-followup-20260927.md` and
`outputs/stripe-followup-sent-20260927.png`. It asks for the unanswered timing
and service-category conditions and the acknowledgment text, corrects the
"live" description, and authorizes no setting change, acceptance or paid service.
The clarification request is complete; the answers remain pending. Do not resend
or ask for this send approval again. Keep the September 30 review checkpoint.

## Saved business description — corrected and verified

After the automated support reply mentioned a different fee, a targeted read of
the actual Business details product-description field confirmed that its last
sentence still said Tuveloz charges customers a **10% platform service fee**.
That was stale account copy, not the website's current price. The application
constant remains 500 basis points and providers keep their full quoted amount.
After the owner was shown the exact replacement and instructed us to continue,
only the product-description field was replaced and saved. Reopening the saved
record returned the full replacement below, confirming persistence. The editor
was then dismissed without additional edits. Legal, address and tax fields were
not edited. This processor-facing correction does not change the site's fee,
accept Stripe terms, or establish approval of the proposed launch scope.

Saved replacement:

> Tuveloz is an online marketplace connecting customers in Montgomery County,
> Maryland, with independent vehicle-service businesses. Providers set
> labor-only quotes and perform the work; customers buy parts separately.
> Customer accounts and provider applications are open. Customer bookings and
> payments are not yet available. The planned payment flow collects the provider
> quote plus a 5% Customer Service Fee from the customer; the provider receives
> the full quoted amount after job completion and owner release checks. Initial
> services remain subject to licensing and insurance review.

## History

- **2026-09-27:** Published the owner-approved interface repair as PR #256 after
  all required checks passed. Exact release and live bilingual result-page links,
  closed/missing/canceled states, private API rejection and closed launch controls
  verified. Hosted receipt proof, policy/evidence review and remaining Stripe
  answers are still separate. No terms accepted or payment setting changed.
- **2026-09-27:** Sent the exact owner-approved follow-up in the existing thread
  and verified its recipient, timestamp and body. No acknowledgment accepted or
  setting changed. Prepared the local bilingual payment-disclosure/result-page
  repair; publication, policy review and actual hosted-receipt proof are separate.
- **2026-09-27:** Read the substantive 5:24 p.m. reply, checked its sender details,
  and reconciled it with official Stripe documentation and current source. Public
  name/statement descriptor already match. Outstanding onboarding acknowledgment
  independently observed without acceptance. Prepared bilingual disclosure and
  narrow follow-up drafts; no account, application code, policy, payment, send or
  launch decision changed. The scoped inbox search found no broker/county reply;
  upstream software issue #276 remains Open with zero comments.
- **2026-09-27:** Saved the owner-reviewed business description and reopened the
  record to verify every word. Correction complete; do not repeat the request or
  update. The subsequent scoped business-inbox search found Stripe's receipt
  acknowledgment only; no substantive Stripe, county or broker reply appeared
  in the inspected sender/date scope. Original inquiry remains pending.
- **2026-09-27:** Owner-approved inquiry reached Stripe's email support queue;
  confirmation captured. Requested human review and distinguished the verified
  July 29 approval from the AI's conflicting date/fee statements. Directly
  confirmed the stale product-description fee and prepared the correction.
  No support answer, account update, term acceptance or launch approval claimed.
- **2026-09-27:** Read the approval email and sender details in the business inbox;
  compared signed-in historical/current Connect selections to source. Recorded
  initial approval as complete and prepared only the remaining clarification.
  No support inquiry, new acknowledgment, purchase or transaction occurred.
