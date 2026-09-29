# Stripe Connect platform approval

- **Status:** active — initial approval, written reply and seller-compliance acknowledgment verified; launch-scope reconciliation pending
- **Owner:** hello@tuveloz.com
- **Last reviewed:** 2026-09-28

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
The September 28 read-only preview exposed its two duties and exact acceptance
sentence, recorded below. After the owner explicitly agreed, the acknowledgment
was accepted and the Dashboard confirmed September 28, 2026. This is separate
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
2. Preserve both substantive responses below. The owner-approved follow-up sent
   September 27 at 8:05 p.m. received an answer September 28 at 2:49 p.m.
   Do not repeat either inquiry. Reconcile the general holding guidance with
   the documented US reserve ceiling; neither is a target provider payout time.
   Category review still depends on the finalized service scope.
3. Match the initial enabled service list to the insurer/legal decisions before
   representing specialist services as supported. The full catalog is not the
   launch commitment.
4. Use the confirmed platform merchant-of-record role to finish the checkout,
   receipt and policy disclosure review below. The current public business name
   and statement descriptor already show TUVELOZ LLC; do not replace them.
   The CPA gate remains separate; processor setup is not a tax opinion.
5. Preserve the completed September 28 owner-authorized acknowledgment below;
   do not request it again. The notification gap found during this review is
   published in PR #259, with actual delivery evidence tracked separately.
   Acceptance is not launch permission or proof of operational notification delivery.

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
| Customer identity/disclosure | Receipts/statements must identify TUVELOZ LLC or a registered DBA; explain that payment is with Tuveloz while the provider performs labor. | Current dashboard public name and descriptor were independently read as TUVELOZ LLC. Authorized standalone test receipts now confirm the merchant name and itemization; real bank-statement and production integration evidence remain separate. |
| Fees, refunds and disputes | Platform bears the stated Stripe fees/loss exposure; disputes can debit the platform even after a provider transfer. | Final refund/recovery controls, financial reserves and tax/accounting review. This is not a promise that recovery from a provider succeeds. |
| Existing approval | The reply confirms the described general Connect arrangement. | No specific service-category determination or maximum transfer-delay answer was supplied. |
| Onboarding acknowledgment | An authorized representative must complete it; it is one-time with no recurring renewal date, subject to later configuration changes. | The September 27 inspection made no acceptance. The owner subsequently approved the exact preview and Stripe recorded acceptance September 28; see below. |
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

## Follow-up response and acknowledgment preview — September 28

The existing business-inbox thread received a reply from `support@stripe.com`
at **2:49 p.m. Maryland time**, signed by Smriti. Expanded sender details show
`stripe.com` signing, Salesforce mailing infrastructure and TLS. The original
and exact private observations are retained outside the repository in
`outputs/stripe-support-reply-20260928.txt` and
`outputs/stripe-seller-compliance-review-20260928.txt`.

| Subject | What the new response establishes | Remaining boundary |
| --- | --- | --- |
| Holding funds | Support states no account-specific hold period and recommends no more than 90 days after service completion; it describes two years as a technical ceiling. | The linked public page instead lists two years for US reserves and 90 days for other countries, without stating the email's 90-days-after-completion rule. Preserve both sources as distinct; do not invent a binding deadline or implement either as the normal payout delay. |
| Service categories | The general Connect approval covers the described structure, not every vehicle-service category. | Cross-check the finalized, insured/licensed launch list against restricted-business rules. The full catalog is not approved by this response. |
| Financial responsibility | The platform retains fees, refund, fraud and chargeback exposure; reserves may apply. | No specific reserve amount, new account restriction or insurance/tax clearance was supplied. |
| Onboarding acknowledgment | Full duties can be reviewed in the Dashboard before acceptance. | Preview reviewed, then explicitly approved by the owner; acceptance saved September 28. |

Public references checked September 28:
[holding funds](https://docs.stripe.com/connect/account-balances#holding-funds),
[risk responsibility](https://docs.stripe.com/connect/risk-management), and
[restricted businesses](https://stripe.com/legal/restricted-businesses).
The holding page supports purpose-based retention until a service is completed
and confirmed; it does not justify arbitrary delays or establish legal advice.

The **Ongoing seller compliance** preview displays these duties:

- **Seller communication:** notify sellers when risk/fraud prevention or
  mitigation affects their account.
- **Seller remediation:** collect additional required information, using
  Stripe-hosted or embedded onboarding if appropriate.

Exact acceptance sentence: "I acknowledge I have reviewed and agree to my
responsibility for ongoing seller compliance."

The initial review left the checkbox unchecked. The owner subsequently explicitly
agreed after the exact duties and acceptance sentence were presented. The approved
checkbox and Acknowledge were submitted September 28. Stripe then replaced the
action with View acknowledgement and displayed: "You acknowledged your
responsibilities on September 28, 2026." Acceptance is complete. It changes no
payment, booking, fee, service, tax or insurance approval.

Private evidence remains outside this repository:
`outputs/stripe-seller-compliance-terms-20260928.png` (preview) and
`outputs/stripe-seller-compliance-accepted-20260928.png` (saved result).

The source review found that V2 requirements/capability events only logged their
current status. PR #259 now queues a protected provider notice and email
intent atomically, with English/Spanish copy, a secure workspace link, event
deduplication, ownership rechecks and test/staging suppression. Storage failures
keep the signed webhook retryable. It also keeps the provider's Stripe update
button visible when requirements exist even while transfers remain active.
No raw requirement details or bank/identity data enter the notice. Existing
payment-client and launch locks remain intact; this is not proof of live webhook
delivery while that client is code-locked, nor proof that an email reached an
inbox. Deployment is verified below; approved live operation remains separate
before marking ongoing seller communication operationally complete.

### Provider account-notification repair — published September 28

The owner explicitly approved publication. PR #259 merged tested head a4c02c6
as b20d524 after all required PR checks passed. Production workflow 36474134777
passed its release checks and deployment. Independent HTTP verification at
2026-09-28T20:04:07.610Z confirmed the exact healthy release and all eight
targeted checks: three private APIs reject anonymous reads, unsigned Connect
webhooks reject before processing, checkout stays closed, and the provider route
shells load. Separate browser checks confirmed provider sign-in navigation and
the supported account lang=es page. All 825 tests/build and the
required bilingual browser/migration checks passed. Synthetic route/panel tests
cover the alert transaction, retries, isolation and update-button visibility.

No real provider email, payment, identity document or settlement was used.
Live thin-event delivery and actual provider inbox receipt remain unproven;
the payment client and all launch/payment/SMS locks are unchanged. This release
and the separate accepted acknowledgment do not approve an operating launch.
Private proof: outputs/pr259-live-release-20260928.json and matching workflow log.

### Disclosure review — interface repair published; policy and receipt-language review pending

The original source review used `b5c67a9`; the table below is reconciled to
published release `299fd4c`. Keep the current account settings, policy releases,
fee, provider quote and launch controls intact while the remaining review is
unresolved. A processor statement is not a substitute for the separate tax,
consumer-policy and service-scope decisions. The specific candidate English and
Spanish clauses, collection-timing discrepancy and acceptance-language gaps are
in the [payment policy reconciliation](../legal/payment-policy-reconciliation.md).

| Surface | Current evidence | Required review action |
| --- | --- | --- |
| Stripe public name/card statement | Both display TUVELOZ LLC in signed-in Business details. September 27 standalone test receipts also identify TUVELOZ LLC and itemize the correct total. | Preserve these verified fields. Actual bank-statement and live receipt presentation remain separate. |
| `app/components/quote-payment-card.tsx` | PR #256 places the bilingual payment-merchant disclosure beside the total. | Complete for this interface; preserve it. The broader quote authorization remains English-only. |
| `app/api/stripe/checkout/route.ts` | PR #256 supplies merchant `custom_text`, locale and language-preserving return URLs. Neither branch sets `on_behalf_of`. September 27 standalone hosted rehearsal verifies both merchant messages; a discovered Spanish line-item gap was verified in a replacement sandbox Session, then published in PR #258/release 03f92dd on September 28. | Label publication is complete. Verify receipt-language propagation; do not repeat the completed hosted checks or call them production-app integration proof. |
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

### Hosted test-mode rehearsal — completed September 27

The previously authorized temporary CLI session had only the existing Tuveloz
test environment. English and Spanish hosted Checkout Sessions each charged
Stripe's documented synthetic card $105 in test mode: $100 for a clearly labeled
test service and $5 Customer Service Fee. Each Session became complete/paid,
with one succeeded charge and no provider transfer. The Spanish Session first
returned card_declined and an unpaid state, then succeeded on retry. No real
customer, provider, card, ID or bank transfer was used.

Actual hosted views identify TUVELOZ LLC and show the expected totals and
merchant message. The first Spanish preview showed English fee/quote labels;
the local repair now supplies Spanish wording and the replacement preview and
receipt confirm it. The original unpaid preview was expired. Stripe receipt
headings remain English; fee translation does not complete receipt localization.
Test receipt styling is not evidence of current live receipt branding. No actual
email receipt or bank-statement delivery was tested.

The production app's closed payment/provider gates were not bypassed. These
Sessions reproduce presentation fields outside the app and cannot establish the
full application/webhook/settlement flow or approve any launch control. The CLI
session was revoked, unauthenticated status rechecked, dedicated config removed,
and three disposable browser tabs closed. Test records remain clearly labeled
in Stripe; private API evidence and screenshots stay outside the repository.
The code repair passed build, all 812 tests, TypeScript and lint with the existing
warning. PR #258 published the repair September 28 as 03f92dd after all required
checks; the exact live release was independently verified. Receipt headings and
production payment integration remain separate. See LOG for the exact result.

Reference: [Stripe test-card documentation](https://docs.stripe.com/testing).

### Receipt-language follow-up — investigated September 28

The actual Spanish test receipt has Spanish line items but English surrounding
headings. The [receipt localization documentation](https://docs.stripe.com/receipts#localization)
points to customer locale data at Checkout creation; its detailed table describes
invoice behavior. Treat applying `preferred_locales` to standard charge receipts
as a hypothesis until a new actual test receipt confirms it. Do not enable paid
one-time invoice creation just to change language.

Current `lib/stripe-customers.ts` creates a Customer with email and metadata,
and returns an existing Customer without setting a language. Checkout supplies
that Customer only when the signed-in customer owns the matching email. The
fallback uses `customer_email`. Preserve this ownership boundary: never attach
a saved Stripe Customer to a guest just because the entered email matches.

The next focused repair must preserve the stable Customer creation parameters
and idempotency key; adding a changing language to that existing create request
can conflict with a retry. If locale updates are used, guard each write with the
current marketplace checks and verify their failure/retry behavior, existing and
new Customers, guest handling, and concurrent language choices. Existing saved
payment methods, policy evidence and payment amounts must stay unchanged.
The [Customer update API](https://docs.stripe.com/api/customers/update) supports
partial updates; send only the intended preference field. No Customer, setting,
invoice, payment or runtime source was changed during this investigation.

### Full sandbox refund — verified September 28

Reused the successful English hosted-checkout rehearsal payment above. Stripe
Test mode displayed the synthetic customer, the $100 service and $5 Customer
Service Fee. The owner performed the final full-refund click at 9:10 p.m. EDT.
The actual refund.updated event at 9:10:23 p.m. reports amount 10500 USD cents,
status succeeded, and the original payment/charge IDs. The payment page shows
Refunded, refunded amount $105, retained processor fee $3.35 and net -$3.35.
All amounts are test ledger entries; no real money moved. Do not generalize
this one processing fee into a price guarantee.

This completes the standalone Stripe Dashboard refund check, including return
of the entire Customer Service Fee. It does not exercise Tuveloz's owner refund
API, prove deployed webhook receipt/accounting, or settle policy adoption.
The application-initiated sandbox integration was verified separately below. No new payment,
credential, live setting or provider transfer was created. Private references
are in task outputs/stripe-dashboard-test-refund-20260928.json. Preserve the
earlier checkout evidence and do not repeat this completed refund.

### Application-initiated sandbox refund — verified September 28

The owner completed a separate synthetic $105 Checkout and the final refund
click in the published Tuveloz owner component running in a private local
fixture. Stripe reports one matching succeeded refund for all 10500 USD cents;
the test charge is fully refunded. The actual webhook handler processed four
signed Stripe events through the CLI listener and recorded the local payment
as refunded. Checking status through the actual UI issued no additional refund.

The actual SDK/routes were used with a strict official-CLI OAuth transport,
migrated isolated SQLite, synthetic owner issuer/records and a local future-
release gate fixture. Production Cloudflare delivery, live settlement, policy
adoption and launch approval were not tested. No production records, flags or
published policy changed. The scoped test login is revoked, its config removed,
and the local server/listener stopped. Private evidence is in task
outputs/stripe-owner-refund-integration-20260928.json. Preserve both completed
refund rehearsals; do not create another charge to repeat them.

### Receipt-language experiment — no payments on the existing test Customer

Prepared a new, isolated Spanish test Checkout for a synthetic Customer whose
preferred locales explicitly contain es. It retains the tested $100 service
plus $5 fee and does not enable invoice creation or a provider transfer. The
final Pay action was blocked by automatic approval review, which requires the
owner to press the button even in test mode. No indirect payment attempt was
made. The last API check at preparation was open/unpaid with no receipt; the localization
hypothesis is still unverified and no application change is justified yet.

The one-hour CLI test session was revoked, unauthenticated status confirmed,
and its temporary configuration removed. After the one-hour expiry at 3:42 p.m.
Maryland time, a browser refresh returned Stripe's combined completed-or-timed-out
page. That message does not distinguish the two states. No completion or receipt
was independently confirmed, and the unusable tab was closed. The private
evidence and exact expiry remain in work/stripe-receipt-language-20260928 and
outputs/stripe-receipt-language-unavailable-20260928.png outside the repository.
The subsequent September 28 signed-in Test-mode Dashboard inspection located
the existing synthetic Customer by its test email and rehearsal metadata. Its
Payments section shows **No payments**, and expanded details confirm
**Spanish (Spain)**. This experiment produced no receipt; the Customer preference
alone does not prove receipt localization. The Customer page does not establish
the exact Checkout Session status enum. No new Session, credential, payment or
invoice was created. Do not prepare a replacement until the owner is ready for
the final Pay step, and do not describe the expired test window as still open.
PR #258 remains published and complete; this experiment does not reopen its
label or notice work. Private current observations are appended to
work/stripe-receipt-language-20260928/summary.json.

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
The clarification request is complete; its September 28 answer is recorded
above. Do not resend or ask for send approval again. Keep the September 30
checkpoint for the remaining owner, service-scope and disclosure decisions.

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
