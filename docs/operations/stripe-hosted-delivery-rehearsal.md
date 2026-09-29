# Isolated Stripe hosted-delivery rehearsal

- **Status:** complete; hosted sandbox delivery verified and temporary access removed
- **Owner:** hello@tuveloz.com
- **Last reviewed:** 2026-09-29
- **Applies to:** one bounded sandbox transport check before the customer pilot

This check fills the hosted-delivery gap without repeating the completed full
$105 sandbox refund rehearsals. It does not enable customer bookings, live
payments or settlement, and it cannot approve the launch gates.

## Current evidence

The owner approved and completed this isolated test on September 29. Stripe
delivered the same unpaid sandbox expiration event at 22:21:03 and 22:21:25 UTC.
Both responses were **HTTP 200**; the second included `duplicate: true`. The
new D1 database contained exactly one processed test-mode receipt with
`attempt_count=1` and an unchanged processing timestamp. Missing/forged
signatures returned 400 and created no receipt. The initial two deliveries
while the receiver was deliberately disabled returned 404, as expected.

The receiver was then disabled (confirmed 404), its temporary key revoked,
and its Stripe destination, Cloudflare Worker and receipt-only D1 deleted.
The inline price is inactive. Stripe's automatically created ad-hoc product
cannot be archived (`ad_hoc_product_immutable`); it and the unpaid expired
session/event remain as sandbox audit history, with no customer or payment.
The original production, staging and recovery resources were preserved. No
payment, paid upgrade or production/private-staging change occurred.

The live **Tuveloz payment status** destination is Active with the correct
fourteen subscriptions and installed signing secret. A fresh September 29
Dashboard inspection still reports **No event deliveries found**. Do not recreate
that destination or reinstall its secret. Stripe's sandbox history separately
shows the completed refund and its successful local-listener delivery.

The private staging Worker requires a signed owner Access token on every path.
Stripe cannot authenticate as that owner. Do not remove the gate, copy an owner
cookie into a relay, or swap production credentials to manufacture a pass.

## Retained implementation

`rehearsal-worker/payment-delivery.ts` is a standalone Worker. Neither the public
site's entry point nor its deployment workflow imports it. Its example
configuration disables both workers.dev exposure and the rehearsal itself.

When specifically authorized and configured, it accepts only:

- HTTPS POST requests on `/api/stripe/webhooks/payments`, JSON, at most 32 KiB;
- a valid Stripe signature from its separate sandbox destination;
- one exact event ID and `cs_test_` session ID;
- `checkout.session.expired`, with both event/session `livemode=false`, an
  expired unpaid session, and no connected-account `account` field; an optional
  API `context` must match the explicitly configured platform account;
- empty metadata and no customer, invoice, subscription or PaymentIntent;
- a fixed time window of no more than one hour, enabled explicitly;
- a restricted test API key (`rk_test_`), never a standard or live key.

It then calls the **unchanged actual payment webhook route**. With no Tuveloz
payment metadata, expiration processing makes no payment lookup or update.
The route still verifies the original signature and stores its normal durable
receipt. Repeating the same event must acknowledge the existing receipt without
incrementing its processing attempt. Only the receipt table exists in the new
database; no application data, provider tables or uploads are copied.

Local tests use the real route and receipt SQL with synthetic signed events in
SQLite. Six tests pass, including wrong/stale signatures, other event IDs,
live modes, payment/customer fields, request limits, duplicate handling and
expired/invalid configuration. No outbound request occurred. TypeScript,
targeted lint and Wrangler's dry run also passed. The official Wrangler bundle
also passed in the local Cloudflare runtime with D1: valid/duplicate 200,
forged 400, expired window 404, one unchanged receipt and no outbound calls.
These local checks complement the actual hosted Stripe delivery above.

## Authorization and execution

The owner explicitly approved the temporary public receiver, its
separate empty D1 database, sandbox destination/signing secret, restricted
read-only sandbox API key stored only in that Worker, two deliveries of one
unpaid expiration event, and removal of only those new resources afterward.
The key had Events Read only, with no Connect or write permissions. Credentials
were transferred without printing them and the local transfer files removed.
No paid upgrade was included. The test is complete: do not repeat it unless a
new relevant change or failure calls its evidence into question.

For a separately authorized future rerun:

1. Check for an existing eligible **unpaid** sandbox expiration event before
   creating one. Never repeat a paid/refunded rehearsal. If a new session is
   needed, create it only in sandbox with no customer or Tuveloz metadata and
   expire it without visiting Checkout or paying. Verify the full event meets
   the restrictions above before choosing its exact IDs. Keep vendor object
   IDs and credentials out of this public document.
2. Check Cloudflare's current resource quota before creating anything. Use the
   temporary names `tuveloz-payment-delivery-rehearsal` and
   `tuveloz-payment-delivery-rehearsal-db`. Stop on any paid-plan requirement.
   Never bind the production, staging or recovery database. Create only the
   receipt table and its three indexes, extracted from
   `drizzle/0045_chilly_maginty.sql`; do not migrate/copy all application data.
3. Prepare the ignored `rehearsal-worker/wrangler.generated.jsonc` from the
   example. Use only the new database ID. It has no domain routes, R2, Assets,
   mail, cron, service or owner-token bindings. Deploy initially disabled,
   enable workers.dev only for the specifically approved temporary callback,
   and confirm the hosted runtime returns the disabled response.
4. Create a sandbox-only destination subscribing only to
   `checkout.session.expired`. Keep the existing live destinations intact.
   Set its new signing secret and a separately restricted read-only test key
   using official Wrangler secret input. The key must have no write scopes;
   the selected event path needs no Stripe API call. Do not print key values.
5. Configure the exact event/session IDs and platform account context, fixed start/end timestamps at most
   one hour apart, and `REHEARSAL_ENABLED=true`. Verify forged/unsigned events
   are refused without a receipt. Resend the selected event through Stripe.
   [Stripe documents manual resend and delivery status](https://docs.stripe.com/webhooks#view-event-deliveries).
6. Require both a Stripe **Delivered / HTTP 200** record and the matching D1
   receipt with `livemode=0`, correct type/object, status `processed`, and
   `attempt_count=1`. Resend it once and require another successful delivery
   plus the unchanged single receipt. Save only redacted evidence locally.
   No dashboard zero-error percentage, CLI-generated signature or health
   response can replace this vendor delivery evidence.

## Cleanup and reporting

This run's cleanup was verified in the vendor dashboards: the new Worker and
D1 are absent, all three original Tuveloz databases remain, the temporary
restricted key is absent, and only the original Identity sandbox destination
remains. Wrangler deleted the Worker but subsequently reported a missing KV
scope during optional cleanup; its nonzero exit was not treated as success.
The Cloudflare application list independently confirmed removal. No broader
credential scope was requested. Both Cloudflare usage panels still showed
zero billable usage at the time of inspection.

Local proof: `stripe-hosted-delivery-result-20260929.json`,
`stripe-hosted-duplicate-delivery-20260929.png`,
`stripe-hosted-single-receipt-20260929.png`, and
`stripe-hosted-worker-cleanup-20260929.png` in the task output directory.

For future cleanup, disable the receiver and Stripe test destination first. Confirm the callback
refuses requests even with the correct test event. Revoke the temporary
restricted key, remove temporary local credentials/signing material, and delete
only the newly created Worker and receipt-only D1 database after saving the
redacted test result. Remove the temporary destination if covered by the
specific cleanup approval. Preserve earlier refund records and all original
live/staging/backup resources. Record cleanup with the actual resource names
and returned statuses; timeout alone is not credential revocation.

A pass proves **Stripe sandbox delivery to Cloudflare, verification by the
actual handler, durable receipt storage and duplicate acknowledgment**. It
does not prove delivery to the production hostname with production secrets,
live checkout/refunds, provider payout, settlement, insurance, genuine provider
Identity or launch readiness. Those distinctions must remain in the handoff.
