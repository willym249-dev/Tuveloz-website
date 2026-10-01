# Payment wording and acceptance review

- **Status:** policies published in PR #272, checkout in PR #273, request/selection consent in PR #274; launch review remains
- **Owner:** hello@tuveloz.com
- **Last reviewed:** 2026-10-01
- **Applies to:** proposed labor-only quote checkout, Montgomery County launch

This is the specific remaining policy work after PR #256, reviewed against
release `299fd4c`, with completed processor/release evidence updated September 28.
It preserves the existing service-provider relationship, 5%
Customer Service Fee and closed marketplace. The policy release is recorded below. No existing acceptance record, charge
or launch decision was changed.

## September 30 bilingual checkout publication — PR #273

PR #273 implements the complete Spanish authorization below and
the matching English merchant sentence. It reuses PR #272's published policies;
no legal page, policy release, provider acceptance, or launch switch is edited.
New consent uses `checkout:6|lang:en` or `checkout:6|lang:es`, with the existing
policy bundle prefix. Language-specific immutable keys preserve historical
records. The customer presentation records each released document's language,
title and URL, and the Spanish release identifier, effective date, English hash
and translation hash. Missing, stale or future translations fail closed.

The checkbox and downloaded authorization contain the exact server text. The
download also includes the full evidence string and hash used by the immutable
database record. Reading linked policies opens a separate tab to preserve the
quote. Language changes and failed, stale or incomplete responses clear consent;
they cannot reuse an earlier checkout redirect. Provider-supplied names and
warranties remain literal in both languages.

The owner continued the prepared publication after the specific approval request.
All required PR checks and all three production jobs passed. The exact release
`152639cdd7c12e2bb218be6a4c95d0b300b370d4` passed 23 independent HTTP checks at
`2026-10-01T02:35:45.175Z`; 903 regressions and 48 isolated mobile browser
scenarios cover the implementation. This advances the exact authorization
version and makes reviewed Spanish authorization available only behind all
existing closed launch/payment gates.
It does not establish a real provider, a live transaction, receipt-language
propagation, settlement, or any outstanding legal/coverage/tax approval.
Earlier references below to an unfinished implementation describe the published
PR #271/#272 baseline, not work to repeat after this release.

### October 1 request/privacy/provider-selection release - PR #274

`lib/customer-job-consent.ts` now supplies
exact English/Spanish request, privacy and provider-selection evidence with
new language-specific versions. The routes and browser forms bind those records,
downloads and translated policy links. Legacy `customer-job-scope.ts` evidence
helpers remain unchanged and are still validated by the scope reader. Blank
confirmed-credential labels now mean only that none is shown, never that no
license/insurance requirement exists. Request receipt and selection downloads
are private to the request; full evidence includes its bound identifiers.

Build/914 tests, TypeScript, lint (one existing warning), and 26 mobile browser
cases passed. The route tests use migrated SQLite and synthetic eligibility,
not actual service approval or live transactions. Owner-approved PR #274 is
published as `2c455a599207e5f906b668857443ac091ae3299d`; required PR checks and
all three production jobs passed. Thirty-three independent live HTTP checks at
`2026-10-01T04:18:49.396Z` confirmed the exact healthy release, bilingual pages,
protected request/quote routes and closed bookings/payments. This implementation
is complete; do not repeat it or rewrite historical evidence. The old English
schema-1 helpers remain intentionally unchanged for legacy records.

Separate decline/restore/review recovery is subsequently published and
independently verified in PR #275 as `86ae047`: 917 tests/build, 76 focused
mobile scenarios, required PR/production checks and 37 live HTTP checks passed.
It preserves uncertain drafts, checks saved status before retry and prevents
rapid duplicate writes. No legal content or acceptance version changed. Whole
private-workspace translation, receipt-language propagation and final legal
review remain separate. Customer job actions stay closed behind the existing
launch controls.

## September 30 approved policy publication

The review branch now contains the concrete updates to Terms sections 3 and 7,
Customer Agreement section 7, and Payment Policy introduction and sections 3–6
and 8, together with matching complete Spanish pages. The customer translation
has all eleven sections; it is integrated into the existing page renderer,
language switch, navigation and search metadata.

The owner approved these exact effects, published in PR #272 as `e6fceca7`:

- Identify the customer payment as made to TUVELOZ LLC through Stripe, while the
  selected independent provider performs the vehicle service.
- Distinguish payment at checkout from the later provider transfer after
  completion and required payment checks. Keep the fee at 5% of the provider
  subtotal, added to the customer total rather than deducted from the quote.
- State the already-approved full refund of labor plus the 5% fee for provider
  cancellation/no-show or customer cancellation before authorized work starts.
  Tuveloz covers the original processing fee Stripe retains.
- Keep the other existing baseline cancellation protections and mandatory
  customer rights. Do not invent final tax treatment, transfer deadlines,
  reserve levels, partial-refund outcomes or an automatic provider recovery right.

Three English versions and their paired Spanish releases advance to September
30. The manifest effective timestamp is the candidate preparation time,
`2026-10-01T00:09:49.679Z` (September 30 in Maryland). The owner subsequently approved publication; the actual deployment and independent
verification occurred on October 1 UTC (September 30 in Maryland). Preparation,
approval and publication are separate events recorded in `docs/LOG.md`.
The four unaffected provider releases remain identical. Because Terms and
Payments are shared, prior provider acceptances cannot stand in for acceptance
of the new text. Preserve all old immutable records; request fresh acceptance
through the existing application/eligibility controls. Historical fixture files
are retained and tested against the new candidate.

This page translation is not the full customer consent integration. The new
customer Spanish manifest entry does not claim provider acceptance, and PR
#271 still refuses Spanish checkout authorization until the complete reviewed
customer evidence is implemented. No runtime payment flow, refund action,
launch review record, database record, or production lock is changed here.

Validation: production build, 896 regression tests and TypeScript pass. Six
Chromium/WebKit scenarios cover 320px, 390px and desktop policy rendering,
complete translated text, links, both switch directions and saved language,
with no page errors or horizontal overflow. Lint has only the existing
language-navigation warning. Both required PR workflows and all three production jobs passed. Independent
verification at `2026-10-01T01:06:17.728Z` passed 23 HTTP checks and 12 live
Chromium/WebKit checks on the exact merged release, including all Spanish policy
links and both language-switch directions. Requests/payments remain closed.

Stripe's current [merchant documentation](https://docs.stripe.com/connect/merchant-of-record)
and [refund documentation](https://docs.stripe.com/refunds) were checked on
September 30. They support the payment-recipient distinction and retained
processing costs; they do not replace tax, insurance or legal review.

## Evidence and findings

Stripe's September 27 and September 28 written responses and the
[processor record](../records/stripe-connect-platform-approval.md) establish
the payment role for the described configuration. The follow-up was answered
September 28 at 2:49 p.m.; preserve its holding guidance separately from the
linked public reserve ceiling, without inventing a normal payout delay. The
owner-approved seller-compliance acknowledgment is accepted and PR #259's
provider alert/update-button repair is published as `b20d524`. Actual
Stripe-originated delivery and provider inbox receipt remain separate evidence.
The September 30 business-Gmail search for messages after September 27 from
`foundershield.com` or `montgomerycountymd.gov` returned no matching messages.
This is a scoped result, not proof about every possible sender or delivery.
Do not repeat the inquiries, acknowledgment or completed releases.

September 29 accuracy repair, published and verified in PR #268: the checkout checkbox's
existing labor-only sentence was outside the server-generated `presentedText`,
so the download and hashed immutable evidence omitted that sentence. The
repair moves the unchanged sentence into the shared text, moves reference links
outside the checkbox label, and uses `checkout:4` for new consent records.
It does not rewrite historical records or change a policy release, active
policy page, fee, refund decision or launch lock. Current English evidence is
explicitly identified and kept literal; provider-entered data is not translated.
The mobile checkbox/download equality checks and both warranty branches pass.
Full reviewed English/Spanish customer policy adoption remains below; do not
describe this narrow repair as completion of that separate work.

September 30 language-boundary repair, published in PR #271 as `61a2e4a`: readiness GET
now requests an explicit language, the browser rejects missing/mismatched
presentation languages, and POST rejects an absent/invalid language or an
unavailable Spanish authorization before database writes or Stripe access.
New English evidence records `language: "en"` and uses the separate immutable
version `checkout:5|lang:en`. Existing records are untouched. Spanish readiness
shows a Spanish explanation and retains existing payment status; it does not
substitute English consent. Full reviewed Spanish customer consent remains
unfinished. All 894 tests/build, TypeScript and 36 mobile Chromium/WebKit cases
passed; lint has only the existing language-navigation warning. Active policy
sources, manifests, provider acceptance and all launch locks are unchanged.
Both required PR workflows and all three production jobs passed. Seventeen
independent live checks at `2026-09-30T05:06:35.643Z` confirmed the exact release,
healthy schema, bilingual account pages, private controls and closed checkout.
Do not repeat this completed repair or treat it as translation adoption.

| Surface | Verified current behavior | Work still needed |
| --- | --- | --- |
| Quote total, hosted Checkout message, payment-result page | PR #256 supplies TUVELOZ LLC payment identification and bilingual result messages. September 27 standalone Stripe test checkouts and actual receipts verify merchant, totals, successful status and a Spanish decline/retry. | Hosted presentation rehearsal complete within its isolated scope. Spanish line-item repair is published through PR #258/release 03f92dd and independently verified September 28; Stripe receipt headings still use English. Production integration, receipt-language propagation and customer consent remain separate. |
| Payment Policy introduction and sections 3, 5, 8 | PR #272 identifies TUVELOZ LLC as payment recipient and states platform refund/dispute responsibility in both languages. | Transfer limits, reserves, legal/tax treatment and provider recovery remain subject to their separate reviews. |
| Terms section 7 | PR #272 distinguishes collection at checkout from the later provider transfer after completion/checks, in both languages. | Preserve this distinction when implementing exact customer consent; no change to the charge strategy. |
| Customer Agreement section 7 | PR #272 includes payment recipient, collection timing and the approved full-refund allocation in English and the complete Spanish page. | Bind these reviewed releases to exact bilingual customer acceptance before enabling Spanish checkout. |
| Provider Agreement section 11 | Full provider quote is preserved, but transfer/recovery wording is broad. | Reconcile the eventual timing and recovery terms with Stripe's answer; do not invent a maximum delay or automatic recovery right. |
| Exact checkout authorization | `lib/customer-checkout-acceptance.ts` saves provider identity, price, scope, policies and warranty text. It does not contain the new payment-merchant sentence. | Include the reviewed merchant/timing wording in the exact displayed and saved authorization; version it and test stale-consent rejection. |
| Spanish policies and evidence | Six existing policies use complete `lib/policy-spanish/` translations rendered by `PolicyPage`, with hashes in `config/policy-spanish-releases.json`. Provider acceptance already records the exact translation and language. PR #272 adds the complete `/es/customer-agreement` page and versions the changed shared policies; exact quote authorization remains English-only. | Preserve historical provider evidence. Complete the customer checkout evidence using the [published Customer Agreement translation](customer-agreement-spanish-draft.md) and reviewed authorization wording before enabling Spanish checkout. |
| Customer release integrity | Published PR #271 uses `checkout:5` with explicit English evidence and rejects missing/mismatched or unavailable languages. Historical `checkout:4` records remain intact. | Adopt complete customer translations and bind their reviewed release metadata before enabling Spanish authorization. Preserve the completed provider implementation. Bilingual result/hosted messages alone do not prove Spanish customer consent. |

The timing finding is an inference from the checkout source plus Stripe's
[manual-capture documentation](https://docs.stripe.com/payments/place-a-hold-on-a-payment-method),
which requires an explicit manual-capture setting for an authorization-only
Checkout Session. This review did not create or inspect a new real payment.

## Proposed clauses for review

The payment-recipient, checkout-timing and full-refund clauses below were
incorporated into PR #272 with complete paired English/Spanish pages. The
onboarding-only notice remains. The separate full checkout authorization below
is still a review candidate and has not been enabled in Spanish.

### Payment recipient — Payment Policy section 3 and Customer Agreement section 7

**English**

> When payments open, your payment through Tuveloz will be to TUVELOZ LLC,
> processed by Stripe. Your selected independent provider business performs the
> vehicle service. For help with a payment or refund, contact hello@tuveloz.com.

**Spanish**

> Cuando se habiliten los pagos, el pago que haga a través de Tuveloz se realizará
> a TUVELOZ LLC y será procesado por Stripe. El negocio proveedor independiente
> que usted elija realizará el servicio de su vehículo. Para obtener ayuda con
> un pago o reembolso, escriba a hello@tuveloz.com.

This identifies the payment recipient consistently with
[Stripe's merchant rules](https://docs.stripe.com/connect/merchant-of-record).
It does not decide tax treatment or disclaim Tuveloz's mandatory duties. Review
related Terms sections 2–3 and liability language together so they cannot be read
as disclaiming Tuveloz's payment responsibilities.

### Price and collection — Terms section 7 and Payment Policy section 4

**English**

> Under the planned payment flow, you will see the provider's labor quote, a
> separate 5% Customer Service Fee and the total before paying. You pay that total
> at checkout. The provider's transfer is a later step, after completion and the
> required payment checks. The Customer Service Fee is added to your total and
> is not deducted from the provider's quote. Any parts are purchased separately
> by you.

**Spanish**

> Según el proceso de pago previsto, verá la cotización de mano de obra del
> proveedor, una Tarifa de Servicio al Cliente del 5% por separado y el total
> antes de pagar. Pagará ese total al finalizar el pago. La transferencia al
> proveedor se realizará después de que termine el trabajo y se completen las
> verificaciones de pago necesarias. La tarifa se suma a su total y no se
> descuenta de la cotización del proveedor. Usted compra las piezas por separado.

On September 30 the owner explicitly selected: "Pay at checkout; provider paid
after completion checks." That business choice is settled; do not ask again.
It matches the current collection/transfer sequence. The complete policies
still need adoption and the required review; this choice does not approve a
payout deadline, reserve rule, tax treatment or live launch.

### Processor responsibilities — Payment Policy sections 5 and 8

**English**

> For this payment flow, Tuveloz is responsible to Stripe for refunds, payment
> disputes and the associated processor costs. A provider transfer does not
> remove those responsibilities. Any adjustment or recovery from a provider
> must follow the accepted provider agreement, Stripe's rules and applicable law.

**Spanish**

> En este proceso de pago, Tuveloz es responsable ante Stripe de los reembolsos,
> las disputas de pago y los costos asociados del procesador. Transferir dinero
> a un proveedor no elimina esas responsabilidades. Cualquier ajuste o
> recuperación de fondos de un proveedor debe respetar el acuerdo aceptado con
> ese proveedor, las reglas de Stripe y la ley aplicable.

Stripe describes platform debits for this charge type in its
[dispute documentation](https://docs.stripe.com/connect/disputes).
These paragraphs do not grant blanket refund eligibility or a new recovery
right. The owner decision below settles the specified full-refund cases;
partial refunds and post-transfer recovery still require review.

### Full refunds — owner decision recorded September 28

The owner explicitly selected **"Full refund including the 5% fee"** for a
provider cancellation, provider no-show, or customer cancellation before work
starts. The question disclosed that Tuveloz would cover original Stripe
processing fees that Stripe does not return. Do not ask for this decision again.
This records the intended business rule; it does not release the policy, approve
the launch gate, create a refund or settle every cancellation scenario.

**English — candidate replacement in Payment Policy sections 6–7**

> If your provider cancels or does not show up, you will receive a full refund
> of the payment you made through Tuveloz, including the 5% Customer Service Fee.
> You will also receive a full refund if you cancel before authorized work
> begins. We will not deduct payment-processing fees from these refunds.

**Spanish — matching candidate**

> Si su proveedor cancela o no se presenta, recibirá un reembolso completo del
> pago que hizo a través de Tuveloz, incluida la Tarifa de Servicio al Cliente
> del 5%. También recibirá un reembolso completo si cancela antes de que comience
> el trabajo autorizado. No descontaremos los cargos por procesamiento de pagos
> de estos reembolsos.

**Amount and responsibility:** for a $100 provider quote plus the $5 Customer
Service Fee, a qualifying full refund is **$105**, not $100. The $5 is Tuveloz's
fee and must not be counted as provider earnings or deducted from the provider
as though the provider received it. Original processor charges retained by
Stripe are a separate Tuveloz cost, never a deduction from this customer refund.
Use actual processor amounts for accounting rather than a guessed fee. Stripe's
[refund documentation](https://docs.stripe.com/refunds), checked September 28,
states that original processing fees are not returned. The operational process
must track a requested, pending, failed or completed refund accurately; an
internal approval is not proof that the customer's money was returned.

Still separate: partial refunds after authorized work starts, customer no-shows,
safety-related stoppages, provider compensation and any lawful recovery of a
previous transfer. Separately purchased parts remain outside Tuveloz's payment.
Do not add a cancellation penalty or promise automatic recovery from a provider
to fill these gaps. Review the existing inability-to-perform clause alongside
the selected rule rather than silently broadening or removing it.

### Refund implementation findings — September 28 source review

**Accounting repair published September 28 in PR #261 (`3b7ae69`):** the test request/cancellation paths
now use the validated saved customer total, record the separate provider/fee
amounts, and require an explicit owner fee allocation for partial test refunds.
Full refunds automatically include the entire saved fee. The new migrated-SQL
route tests pass, including $105 / $100 / $5, scope changes, missing/stale prices,
rounding, amount limits, repeat approvals and access/test isolation. All 840
tests and the production build pass locally; both required PR workflows and all
three production jobs passed. Independent HTTP checks confirmed the exact
healthy release and eleven public/private-route safeguards. See LOG for proof.
This repairs the simulation accounting only. Real Stripe refund initiation,
eligibility rules, cumulative paid/refunded limits and transfer recovery are
still separate work; no effective policy or launch control changed.

The baseline published code at `b916a4e` did **not** implement that full-refund rule.
`app/api/job-operations/route.ts` requires a persisted test job and test provider;
its refund/cancellation decisions explicitly return `stripeRefundCreated: false`.
No `refunds.create` call is present in the application/API refund paths reviewed.
Stripe webhooks can record a refund made through Stripe, which is a different
capability from initiating a refund from the Tuveloz workflow.

Two concrete accounting gaps were reproduced in the baseline test workflow:

- `authorizedJobTotal()` returns the provider subtotal. `request-refund` and
  `decide-cancellation` use that ceiling, so the $105 full-refund example is
  rejected against a $100 quote.
- The decision handlers assign the negative refund amount to
  `providerImpactCents`. Increasing the ceiling alone would incorrectly assign
  Tuveloz's $5 fee to the provider. The customer, provider and platform portions
  must be separate; a provider-impact record is not a transfer reversal.

Do not change `authorizedJobTotal()` globally: invoice and payout checks also
use it and must retain their provider-subtotal meaning. The refund path needs
its own validated price/payment snapshot and explicit allocation. Actual money
movement must use the recorded settled payment and remaining refundable amount,
not an unpaid quote, a newly recalculated fee, a client-supplied total or a
simulation record. Keep the existing launch locks and owner decision boundary.

### September 28 - guarded full-refund execution implementation

The new `/api/stripe/admin/refunds` POST accepts only a saved adjustment ID and
verifies the owner's signed access token and request origin. Its server-side
executor remains closed by the existing real-marketplace release gate and
Stripe key locks. No simulation override or new credentials were added.

The first implementation accepts only a separately approved real cancellation,
before work, for the full settled customer payment on an unreleased quote.
The approval must contain `details.paymentSnapshot` matching the saved payment,
scope, authorization, charge, transfer group and customer/provider/fee amounts.
It rejects simulation approvals, missing evidence, prior refunds, partial or
post-start cases, disputed payments and transfers. Stripe's current intent,
charge, refund list and payment-specific transfer group are checked first.
Provider recovery and automatic partial allocation are not implemented.

One durable `stripe_full_refund` execution row per payment prevents duplicate
submissions, including from different decisions. It references the original
accounting decision without booking its financial impacts a second time.
After any attempted submission, retries only retrieve the original refund;
they never repeat the mutation, even after Stripe's idempotency window. A lost
response, rejection or absent result stays under review. Current Stripe refund
responses distinguish pending/action-needed/failed/canceled from succeeded;
the existing webhook reconciliation remains responsible for payment totals.

**Still required:** policy adoption, refund operation during a future marketplace
pause, operator recovery for unconfirmed/no-send reservations, and an approved
end-to-end Stripe sandbox rehearsal. The owner review implementation below was
published and independently verified in PR #263 as e2112b5. Existing
test approvals remain `approved_test_only` and cannot trigger this executor.
There is no refund button exposed to customers/providers and no live activation.
Local behavioral proof uses migrated SQLite, real owner-token verification and
the actual Stripe SDK with intercepted synthetic responses; it is not a real
Stripe refund. PR #262 published this guarded backend as 907bf5e on September
28: all 852 tests/build, both PR workflows, all three production jobs and
thirteen independent live checks passed. The live refund URL requires Cloudflare
owner sign-in. Execution remains closed; this release adopts no policy and
creates no real refund. See LOG for exact release evidence.

### September 28 - owner review and immutable approval implementation

The owner's Payments screen now has a separate cancellation review with the
customer/provider names, saved payment, reason and provider/Customer Service
Fee/full-total breakdown. Approval saves a decision and cancels the job in one
D1 transaction; it does not contact Stripe. A second explicit confirmation is
required for submission through the guarded executor. The approved payment
snapshot also binds the provider application, connected account and customer.

A changed payment, cancellation, job, provider, started-work record or incident
hold blocks stale approval. Partial or ambiguous cases and simulations cannot
use it. The decision's permanent key prevents repeated/concurrent approvals;
a failed transaction rolls back all related writes. Original processing fees
remain Tuveloz's responsibility. No processor cost is guessed or deducted from
the saved full customer refund.

After an uncertain submission the screen offers status recovery. The owner-only
GET refund endpoint can reconcile an existing reservation but cannot initiate
one. Incident holds are also rechecked before execution. An approved decision,
pending response or missing reply is never presented as money returned.

PR #263 published this implementation as e2112b5 on September 28. All 858
tests/build, required PR checks and production jobs passed. Seventeen independent
HTTP checks confirmed the exact release and access safeguards, and the actual
owner Payments view loaded its empty cancellation queue and refreshed without
Tuveloz page errors. See LOG for the release evidence. No real approval/refund
was created for this check. It does not adopt these policy drafts, change published
hashes or create any live refund. Paused-marketplace access and no-send/uncertain
reservation resolution remain separate. The subsequent isolated Stripe sandbox
rehearsal is verified below.

**Standalone processor verification, September 28:** the owner refunded the
existing synthetic $100 service plus $5 fee through Stripe's Test-mode Dashboard.
The actual refund.updated event reports succeeded for all $105; the test ledger
retains the $3.35 original processor fee. This verifies that specific processor
refund, not Tuveloz's initiation/webhook/accounting integration. The
application-initiated rehearsal was subsequently verified below; do not repeat
the completed Dashboard refund. No real money or active policy changed. Details are in the
Stripe processor record and LOG.

**Application-to-Stripe verification, September 28:** the owner completed a new
clearly labeled sandbox payment and the final refund click through the published
Tuveloz owner component. The isolated actual approval/executor/status routes
sent one full $105 refund; Stripe independently reports succeeded and exactly
one matching refund. Four real signed Stripe events processed through the
actual handler, recording the payment as refunded for 10500 cents. The UI's
status check preserved the result without another refund submission.

This used migrated local SQLite, synthetic records/owner issuer and a local
future-release gate fixture. The actual Stripe SDK serialized requests through
the official CLI's narrowly scoped test OAuth transport; the CLI forwarded the
signed events locally. Production Cloudflare delivery and real-bank settlement
were not exercised. The unmodified launch gate stayed closed. Temporary OAuth
access was revoked and its config removed; the listener/server stopped. See
LOG and the private integration proof. Do not repeat this completed rehearsal
or mistake it for effective policy adoption, consent or launch approval.

Stripe references checked September 28: [refund creation](https://docs.stripe.com/api/refunds/create),
[idempotency and key retention](https://docs.stripe.com/api/idempotent_requests),
and [transfer-group lookup](https://docs.stripe.com/api/transfers/list).

**Recovery repair published September 28 in PR #264 (`bafe9a7`):** a signed owner may read/reconcile an
existing attempt during a marketplace pause; this cannot start a refund and
does not bypass the Stripe live-key lock. A confirmed unsent reservation now
offers explicit owner retry after all original eligibility checks, reusing the
same permanent record/key and conditionally advancing its version. Unknown
submissions still cannot be resent, including after Stripe's idempotency-key
retention window. An empty refund lookup is not proof that it is safe to resend;
the screen supplies the exact Stripe payment reference for separate review.
New refunds while paused remain blocked. All 863 tests/build, required PR and
production checks passed; nineteen independent HTTP checks and the authenticated
live empty queue/Refresh control verified the deployed release. See LOG for
evidence and the distinction between the completed repair and remaining gates.

Before calling the refund workflow complete, verify these outcomes with isolated
records and an approved Stripe test when the transaction path is ready:

**Owner-screen recovery published September 29 in PR #269 (`e2a8466`):** an empty
successful HTTP reply can no longer claim that approval was saved. Confirmation
requires a valid approval identifier and its matching saved decision. Incomplete
list/detail replies retain the prior screen and draft with clear recovery
guidance. All 885 tests/build, both mobile engines, required release checks,
twelve live HTTP checks and the authenticated owner list/Refresh control passed.
No refund rule, policy or launch gate changed; paused initiation and the remaining
policy decisions are still open. Do not repeat this completed repair.

| Case | Required result |
| --- | --- |
| Provider cancels or does not appear; $100 quote + $5 fee was paid | $105 customer refund; $100 provider portion and $5 Customer Service Fee recorded separately |
| Customer cancels before authorized labor begins | Same full-total rule, using the accepted payment snapshot and recorded cancellation/work facts |
| No successful charge | No refund and no claim that money was returned |
| Prior partial refund or repeated request | Never exceed the remaining refundable charge; a retry cannot create a second refund |
| Provider transfer already occurred | Separately review and track any permitted recovery; do not silently charge the provider the Customer Service Fee |
| Stripe returns pending or failed, or the callback is delayed | Preserve the accurate status and payout hold; do not label approval as a completed refund |
| Work has begun or facts are disputed | Route to the applicable reviewed decision process; do not infer a partial-fee rule from this full-refund choice |

### Booking pause and existing full refunds — scoped change accepted September 29

The previous review and execution paths used the `payout` action gate. Therefore,
`CUSTOMER_JOB_POSTING_PAUSED` blocked a new refund as well as a provider transfer,
even when the job was already paid. Existing status-only recovery is separate.
After the narrow recommendation and its preserved safeguards were presented,
the owner instructed "continue." This accepts the described booking-pause
change; it does not reopen the settled refund amount decision or authorize a
real transaction. After the owner answered the specific PR #270 merge/deploy
request, automatic approval review accepted the action. PR #270 (`90d6879`)
is published as `c44c1ff` and independently verified September 30. Do not repeat
the completed approval or release. No existing policy has been adopted.

The narrow change is a separate `refund` action used only by
`stripe-refund-review.ts` and `stripe-full-refund.ts`. It omits the booking
pause check but retains live marketplace mode, fresh database-backed release
approval, the Stripe live-key controls, verified owner access, exact saved
payment/decision checks and separate submission confirmation. All existing
eligibility, incident/dispute/transfer holds and duplicate protections remain.
Unknown submissions still cannot be resent; an explicit confirmed-unsent retry
must pass all fresh checks. Booking, checkout and payout actions remain blocked.

| State | Result covered by isolated checks |
| --- | --- |
| Current onboarding-only release and live-payment locks | No new real refund, booking, checkout or provider payout |
| Future approved live release with booking pause only | Owner may review and confirm an eligible full refund; new transactions and provider payouts remain blocked |
| Marketplace mode closed, readiness missing/expired/revoked, or Stripe live access disabled | Refund initiation remains blocked; this is not an exception to a full shutdown |

The isolated refund route/SQL/Stripe tests now exercise the real action gate
under simulated future-live/paused settings instead of an always-true gate stub.
They cover missing and revoked readiness, repeated approval/pre-submission
checks, unchanged booking and payout denial, current onboarding locks and
existing refund safety cases. The strengthened route tests fail with the old
payout coupling. All 888 tests and production build, TypeScript and both mobile
refund browser engines pass. Both corrected-head PR workflows and all three
production jobs passed. Fourteen live checks confirm the exact healthy release,
protected refund/payout routes and unchanged closed checkout. No real refund
was created to prove the future booking-pause behavior.
The completed real Stripe sandbox rehearsals need not be repeated for this
gate-only change. Refund/cancellation notification prefixes are already
protective in `email-event-policy.ts`; no email-policy expansion is needed.

### Exact authorization — addition to the existing itemized acceptance

**English**

> I authorize the displayed total to be paid to TUVELOZ LLC through Stripe at
> checkout. My selected independent provider performs the vehicle service.

**Spanish**

> Autorizo el pago del total mostrado a TUVELOZ LLC a través de Stripe al
> finalizar el pago. El proveedor independiente que elegí realiza el servicio
> del vehículo.

Keep the exact amount, provider identity, scope, date, warranty choice and
policy references already present. This addition must be generated on the server
and included in the accepted evidence, not only inserted beside a checkbox.

## Decisions still required

| Decision | Evidence or owner needed | Do not substitute |
| --- | --- | --- |
| Operating transfer timing, reserve conditions and category restrictions | Reconcile the received September 28 answer and finalize the insured/licensed service scope | A general Connect approval, the public reserve ceiling used as a normal payout delay, or a guessed deadline |
| Partial refunds, post-start/no-show/unsafe-work cases and provider recovery | The owner approved full refunds including the 5% fee for provider cancellation/no-show and customer cancellation before work starts on September 28. Review the remaining cases and complete the actual refund path described above | Asking the settled full-refund question again, applying it to every scenario, or treating a test approval as returned money |
| Tax collection/reporting and accounting | Required tax review against the existing transaction map | A Stripe merchant label or a zero-tax code restriction |
| Policy adoption and scope | Actual review of these clauses, related liability/service provisions and unresolved decisions | A passing hash test or a fabricated reviewer record |

The separate seller-compliance acknowledgment is complete, confirmed in Stripe
on September 28. It is not a remaining acceptance task or approval of these
draft customer/provider policies.

## Release and verification sequence

1. Resolve the applicable decisions and review complete English/Spanish text.
   Preserve existing accepted records; no retrospective wording replacement.
2. Update only the affected policy versions, effective timestamps and unique
   release IDs after adoption, with the reviewed source hashes. Update all
   affected customer/provider bundles. Do not label this draft active.
3. Bind presented language, exact translated wording and its reviewed version
   into the checkout authorization evidence. Preserve provider-entered names,
   scope and amounts; never translate user data to manufacture consent.
4. Reject checkout if the submitted evidence differs from the latest authorized
   scope, language or policy bundle. Require a fresh explicit acceptance after a
   material change. Keep historical acceptance text intact.
5. Verify bilingual policy links and exact acceptance/download equality; test
   price/provider/scope/policy/language changes, stale submissions and immutable
   history using isolated records. Retain the current launch locks.
6. Run a separately scoped Stripe test-mode hosted checkout/receipt rehearsal,
   using clearly synthetic participants and approved access. Check actual
   displayed merchant, total, language and paid status. Record the boundary:
   test-mode success is not a real customer charge, provider settlement or tax
   approval. No live charge, production provider or launch override is needed.

Step 6's standalone presentation rehearsal completed September 27; see the
[processor record](../records/stripe-connect-platform-approval.md#hosted-test-mode-rehearsal--completed-september-27).
Do not repeat it as an uncompleted task. Actual English/Spanish hosted messages,
itemized amounts, paid receipts and Spanish decline/retry were verified. The
discovered Spanish line-item repair was published and independently verified in
PR #258 on September 28. Stripe's receipt headings remain English, and full
customer consent/production integration are not proved.

Continue with exact customer consent and the remaining documented decisions.
Do not redeploy PR #256, PR #271 or the now-completed PR #272, or resend the
inquiry email. The initial draft did not alter policies; PR #272 subsequently
implemented the owner-approved policy publication described at the top.

## Complete proposed Spanish checkout authorization

This is the full candidate checkbox text, including the existing outer
labor-only statement and the proposed merchant sentence. Bracketed values are
server-generated placeholders, not fabricated customer or provider data.
The two warranty paragraphs are alternatives: show only the applicable one.
Neither this draft nor a preferred language grants authorization to pay.

> Confirmo que este pago incluye únicamente mano de obra para el servicio del
> vehículo. No incluye piezas suministradas por el proveedor, reembolsos por
> piezas, impuestos sobre piezas ni cargos por piezas.
>
> Acepto los Términos de uso, el Acuerdo del cliente y la Política de pagos,
> cancelaciones y reembolsos que se muestran para la cotización [quoteId],
> versión [scopeVersion] del alcance del trabajo.
>
> Nombre legal del proveedor: [providerLegalName]. Códigos de los servicios
> específicos: [serviceCodes]. Fecha y hora programadas: [scheduledFor].
> Identificador de la persona que realizará el trabajo: [performingPersonId].
> Identificador del supervisor: [supervisorPersonId, or "ninguno"].
>
> Desglose del precio: mano de obra [laborAmount]; piezas [partsAmount];
> impuestos [taxAmount]; otros cargos [otherAmount]; importe total del proveedor
> [providerAmount]; Tarifa de Servicio al Cliente [customerFee]; total a pagar
> [customerTotal].
>
> Autorizo el pago del total mostrado a TUVELOZ LLC a través de Stripe al
> finalizar el pago. El negocio proveedor que elegí, [providerLegalName],
> realiza únicamente los servicios del vehículo indicados; TUVELOZ no los realiza.

**If the provider offers a workmanship warranty:**

> Garantía de mano de obra ofrecida por el negocio proveedor:
> [workmanshipWarranty, unchanged]. Esa garantía es entre el negocio proveedor
> y yo. TUVELOZ no la ofrece, respalda ni administra.

**If no workmanship warranty is offered:**

> El negocio proveedor no ofrece garantía de mano de obra para este trabajo.
> Cada proveedor independiente decide si ofrece una; Tuveloz no la exige.
> Confirmé que comprendía esta condición al seleccionar al proveedor.

**Closing text for both cases:**

> El pago no autoriza trabajo adicional ni un aumento de precio. Las
> cancelaciones, los reembolsos, las disputas y los pagos al proveedor se
> gestionan conforme a la Política de pagos, cancelaciones y reembolsos mostrada
> y a la ley aplicable. Revisar los registros de pago o de transferencia no
> significa que TUVELOZ certifique la reparación.
>
> Puedo guardar o descargar este registro exacto de aceptación.

Render the same server-generated text into the checkbox, download and immutable
record. Preserve money in cents in the data; display USD consistently. Preserve
provider names, identifiers, scope codes, appointment values and warranty text
exactly. A translation of the surrounding labels must never translate a
provider's own warranty or service description silently.

## Concrete integration boundaries

| Existing component | Required customer-side change after text adoption |
| --- | --- |
| `config/policy-spanish-releases.json` and `lib/policy-spanish/` | PR #272 completed the customer translation, paired source hashes and new shared Terms/Payments releases. Reuse those exact versions; preserve historical evidence and the four unchanged provider releases. Do not repeat the completed page integration when adding customer-specific acceptance evidence. |
| `lib/customer-policy-acceptance.ts` | Supply the customer purpose's exact reviewed language, document URLs and translation metadata. Reject missing, stale or future-dated translations. Keep old evidence readable and unchanged. |
| `lib/customer-checkout-acceptance.ts` | Published PR #271 explicitly binds English in version 5 and its hash. After adoption, add the full translated authorization and merchant statement with the reviewed release metadata; do not relabel existing records. |
| `QuotePaymentCard` | Existing scope/price/access/language resets and retry controls remain. Published PR #271 sends language on GET as well as POST and rejects missing/mismatched response languages. Keep exact evidence outside DOM dictionary translation. The live payment panel remains closed. |
| `app/api/stripe/checkout/route.ts` | Published PR #271 rejects absent/invalid language and unavailable Spanish consent before writes or Stripe. After translation adoption, recompute its complete presentation and preserve the current exact evidence write/reread and every eligibility, authorization and launch check. |
| `customer_agreement_acceptances` | The unique key includes request, quote, agreement key/version and scope version, but not language/hash. Use a reviewed presentation-specific agreement version, within the existing 300-character input bound, or a reviewed schema design. Do not overwrite an English acceptance to save a Spanish one or allow silent `onConflictDoNothing()` reuse. |

Before a release, exercise both warranty branches, literal provider data,
all itemized amounts, full translated policy links, saved/downloaded text,
language toggles while requests are in flight, tampered/stale submissions,
and two immutable language-specific acceptances for one scope. These are
required future customer-path checks, not results claimed by this draft.

**Correction to the initial review:** existing Spanish legal pages are complete
versioned translations, not merely dictionary substitutions. Their provider
acceptance path already binds language and translation hashes. The initial
review's broader description was incorrect; only the unimplemented customer
path needs this extension. Preserve the existing provider release tests.
