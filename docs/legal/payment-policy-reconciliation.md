# Payment wording and acceptance review

- **Status:** draft; not an effective policy or launch approval
- **Owner:** hello@tuveloz.com
- **Last reviewed:** 2026-09-28
- **Applies to:** proposed labor-only quote checkout, Montgomery County launch

This is the specific remaining policy work after PR #256, reviewed against
release `299fd4c`. It preserves the existing service-provider relationship, 5%
Customer Service Fee and closed marketplace. Nothing below changes an account,
accepted agreement, charge, policy release or launch decision.

## Evidence and findings

Stripe's September 27 written response and the
[processor record](../records/stripe-connect-platform-approval.md) establish
the payment role for the described configuration. Its follow-up answers remain
pending. The September 27 evening business-inbox check found the existing reply
and acknowledgment only in the scoped Stripe/broker/county search; no new answer
appeared. Do not resend those inquiries.

| Surface | Verified current behavior | Work still needed |
| --- | --- | --- |
| Quote total, hosted Checkout message, payment-result page | PR #256 supplies TUVELOZ LLC payment identification and bilingual result messages. September 27 standalone Stripe test checkouts and actual receipts verify merchant, totals, successful status and a Spanish decline/retry. | Hosted presentation rehearsal complete within its isolated scope. Spanish line-item repair is published through PR #258/release 03f92dd and independently verified September 28; Stripe receipt headings still use English. Production integration, receipt-language propagation and customer consent remain separate. |
| Payment Policy introduction and sections 3, 5, 8 | Still treats the processor's merchant role and some refund/dispute responsibilities as undecided. | Reflect the confirmed configuration while leaving unresolved transfer limits, reserves and legal/tax treatment expressly unresolved. |
| Terms section 7 | Says the planned fee is charged on completed jobs. The quote checkout uses payment mode without manual capture; completion checks govern the later provider transfer. | Make customer collection and provider transfer distinct. Do not imply that collection waits for job completion or silently change the charge strategy. |
| Customer Agreement section 7 | Describes the proposed fee but omits explicit payment-merchant identification. | Add the reviewed payment wording and an accurate checkout-timing explanation. |
| Provider Agreement section 11 | Full provider quote is preserved, but transfer/recovery wording is broad. | Reconcile the eventual timing and recovery terms with Stripe's answer; do not invent a maximum delay or automatic recovery right. |
| Exact checkout authorization | `lib/customer-checkout-acceptance.ts` saves provider identity, price, scope, policies and warranty text. It does not contain the new payment-merchant sentence. | Include the reviewed merchant/timing wording in the exact displayed and saved authorization; version it and test stale-consent rejection. |
| Spanish policies and evidence | Six existing policies use complete `lib/policy-spanish/` translations rendered by `PolicyPage`, with hashes in `config/policy-spanish-releases.json`. Provider acceptance already records the exact translation and language. `/customer-agreement` and the quote route remain English-only. | Preserve the existing provider system. Review the [complete Customer Agreement translation](customer-agreement-spanish-draft.md) and the customer checkout text below before enabling their language paths. |
| Customer release integrity | `lib/customer-policy-acceptance.ts` uses the English policy manifest. The checkout authorization has no language field and does not include the existing Spanish release metadata. | Extend the customer evidence path using the existing translation-release approach. Do not duplicate or replace the completed provider implementation. Bilingual result/hosted messages alone do not prove Spanish customer consent. |

The timing finding is an inference from the checkout source plus Stripe's
[manual-capture documentation](https://docs.stripe.com/payments/place-a-hold-on-a-payment-method),
which requires an explicit manual-capture setting for an authorization-only
Checkout Session. This review did not create or inspect a new real payment.

## Proposed clauses for review

These are exact candidate paragraphs, not approved replacements. Keep the
current onboarding-only notice. Incorporate the agreed paragraphs in the
relevant sections rather than adding repeated disclaimers throughout each page.
Do not publish the partial Spanish paragraphs as a complete translated agreement.

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

The reviewer must confirm this timing as the intended product behavior. If a
different timing is chosen, it needs a separately reviewed implementation; text
alone cannot turn the existing flow into delayed customer capture.

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
right. Final cancellation and Customer Service Fee refund rules remain separate.

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
| Transfer limit, reserve conditions and category restrictions | Stripe's answer to the already-sent follow-up | A general Connect approval or a guessed payout deadline |
| Separate onboarding acknowledgment | Exact terms and authorized-owner action-time approval | The support email or previous deployment approval |
| Cancellation and full/partial Customer Service Fee refunds | Documented owner policy consistent with applicable law and processor rules | A UI status or an assumed refund promise |
| Tax collection/reporting and accounting | Required tax review against the existing transaction map | A Stripe merchant label or a zero-tax code restriction |
| Policy adoption and scope | Actual review of these clauses, related liability/service provisions and unresolved decisions | A passing hash test or a fabricated reviewer record |

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
discovered Spanish line-item repair remains local. Stripe's receipt headings
remain English, and full customer consent/production integration are not proved.

This review is ready for continuation. It does not require another deployment
of PR #256 or another inquiry email. No application or active policy file was
edited while preparing it.

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
| `config/policy-spanish-releases.json` and `lib/policy-spanish/` | Reuse complete static translations and English/Spanish source hashes. Register the new customer translation against its actual English revision. Existing provider release metadata and acceptance hashes remain valid; customer additions must not imply provider re-acceptance. |
| `lib/customer-policy-acceptance.ts` | Supply the customer purpose's exact reviewed language, document URLs and translation metadata. Reject missing, stale or future-dated translations. Keep old evidence readable and unchanged. |
| `lib/customer-checkout-acceptance.ts` | Generate the entire checkbox text, including labor-only and merchant statements, for one explicit presentation language. Hash that text together with the selected reviewed releases and the exact scope. |
| `QuotePaymentCard` | Scope/price/access/language reset, matching-response checks, canceled late responses and retry controls were published in PR #257/release 59c7815 and verified September 27. The payment panel remains closed and the readiness GET is still English-only. Future translated acceptance must send the reviewed language on GET as well as POST and keep dynamic evidence outside DOM dictionary translation. |
| `app/api/stripe/checkout/route.ts` | Recompute the same current presentation server-side, reject a mismatched hash/language, then write and reread exact evidence before contacting Stripe. Preserve all existing eligibility, authorization and launch checks. |
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
