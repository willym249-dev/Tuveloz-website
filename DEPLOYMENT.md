# GitHub and Cloudflare deployment

## 1. Create the GitHub repository

Create an empty private repository in GitHub, then run these commands from this
folder:

```bash
git init
git add .
git commit -m "Import Tuveloz source"
git branch -M main
git remote add origin https://github.com/YOUR-ACCOUNT/YOUR-REPOSITORY.git
git push -u origin main
```

Review the staged files before the first commit:

```bash
git status
git diff --cached
```

## 2. Authenticate with Cloudflare

For local deployment:

```bash
npx wrangler login
```

For automated deployment, set `CLOUDFLARE_ACCOUNT_ID` and
`CLOUDFLARE_API_TOKEN` as encrypted repository secrets. Never place their real
values in source files.

## 3. Create the Cloudflare resources

Create the D1 database:

```bash
npx wrangler d1 create tuveloz-db
```

Copy the returned database ID into the `database_id` field in
`wrangler.jsonc`.

Create the R2 bucket:

```bash
npx wrangler r2 bucket create tuveloz-uploads
```

The binding names must remain:

| Resource | Binding |
| --- | --- |
| D1 database | `DB` |
| R2 bucket | `BUCKET` |
| Static assets | `ASSETS` |
| Cloudflare Images | `IMAGES` |

## 4. Configure runtime values

Update the non-secret placeholders under `vars` in `wrangler.jsonc`:

- `SITE_URL`: the public Tuveloz URL
- `OWNER_EMAIL`: the email allowed to use the owner dashboard
- `AUTH_EMAIL_HEADER`: keep
  `cf-access-authenticated-user-email` when using Cloudflare Access
- `RESEND_FROM_EMAIL`: the verified sender used for sign-in codes and provider
  alerts

Save a random authentication secret of at least 32 characters and the Resend
key as Cloudflare secrets:

```bash
npx wrangler secret put AUTH_CODE_SECRET
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put STRIPE_SECRET_KEY
npx wrangler secret put STRIPE_PAYMENT_WEBHOOK_SECRET
npx wrangler secret put STRIPE_CONNECTED_ACCOUNT_WEBHOOK_SECRET
npx wrangler secret put STRIPE_CONNECT_WEBHOOK_SECRET
```

`AUTH_CODE_SECRET` protects stored one-time codes and session tokens. Rotating
it signs every customer and provider out. The Stripe values must be sandbox
`sk_test_...` and `whsec_...` values during testing. Do not add any real secret
value to `wrangler.jsonc`.

Leave `STRIPE_ALLOW_LIVE_MODE` set to `"false"` in `wrangler.jsonc` until the
legal business owner has completed the live-account, compliance, refund,
dispute, and provider-payout review.

Customer and provider legal pages are released only through
`config/policy-releases.json`. Draft entries must stay blank. Before changing
an entry to `active`, approve the exact page, increment its policy version,
record a unique release ID and effective time, and enter the SHA-256 of the
page source after normalizing CRLF line endings to LF. The production test suite
recomputes every active hash and blocks deployment if the page changed.

## 5. Configure Stripe webhooks

Create three Stripe event destinations. Do not reuse signing secrets or mix
standard snapshot events with V2 thin events:

1. A standard snapshot webhook at
   `https://YOUR-DOMAIN/api/stripe/webhooks/payments` for:
   - `checkout.session.completed`
   - `checkout.session.async_payment_succeeded`
   - `checkout.session.async_payment_failed`
   - `checkout.session.expired`
   - `charge.refunded`
   - `charge.refund.updated`
   - `refund.created`
   - `refund.failed`
   - `refund.updated`
   - `charge.dispute.created`
   - `charge.dispute.updated`
   - `charge.dispute.closed`
   - `charge.dispute.funds_reinstated`
   - `charge.dispute.funds_withdrawn`
2. A **Connected accounts**, standard **Snapshot** destination at
   `https://YOUR-DOMAIN/api/stripe/webhooks/connected-accounts` for:
   - `account.external_account.created`
   - `account.external_account.updated`
   - `account.external_account.deleted`
   - `payout.created`
   - `payout.updated`
   - `payout.paid`
   - `payout.failed`
   - `payout.canceled`
   - `payout.reconciliation_completed`
3. A connected-account destination at
   `https://YOUR-DOMAIN/api/stripe/webhooks/connect`. Select **Connected
   accounts**, **Thin** payload style, and:
   - `v2.core.account[requirements].updated`
   - `v2.core.account[configuration.recipient].capability_status_updated`

Each destination has its own `whsec_...` signing secret. Store the payment
destination secret in `STRIPE_PAYMENT_WEBHOOK_SECRET`, the connected-account
snapshot secret in `STRIPE_CONNECTED_ACCOUNT_WEBHOOK_SECRET`, and the V2 thin
destination secret in `STRIPE_CONNECT_WEBHOOK_SECRET`.

The payment and connected-account endpoints keep durable event receipts. A
failed processing attempt is retried; an already-completed event is safely
acknowledged without applying it again. Failed/canceled refunds, payout
failures, deleted or unusable external accounts, missing snapshots, and stale
payment-mode snapshots all fail closed before checkout or provider release.

For local testing, run separate Stripe CLI listeners:

```bash
stripe listen \
  --events 'checkout.session.completed,checkout.session.async_payment_succeeded,checkout.session.async_payment_failed,checkout.session.expired,charge.refunded,charge.refund.updated,refund.created,refund.failed,refund.updated,charge.dispute.created,charge.dispute.updated,charge.dispute.closed,charge.dispute.funds_reinstated,charge.dispute.funds_withdrawn' \
  --forward-to http://localhost:3000/api/stripe/webhooks/payments

stripe listen \
  --events 'account.external_account.created,account.external_account.updated,account.external_account.deleted,payout.created,payout.updated,payout.paid,payout.failed,payout.canceled,payout.reconciliation_completed' \
  --forward-connect-to http://localhost:3000/api/stripe/webhooks/connected-accounts

stripe listen \
  --thin-events 'v2.core.account[requirements].updated,v2.core.account[configuration.recipient].capability_status_updated' \
  --forward-thin-to http://localhost:3000/api/stripe/webhooks/connect
```

Use the signing secret printed by each listener only in the matching local
environment variable.

## 6. Protect owner access

Use a dedicated admin hostname, such as `admin.your-domain.example`, that routes
to the same Worker. Protect that whole hostname with Cloudflare Access and allow
only the owner email configured in `OWNER_EMAIL`.

The public hostname remains available to customers and providers. The protected
admin hostname supplies the verified email header used by the owner dashboard.
Open `/admin` on the protected hostname after signing in through Cloudflare
Access.

## 7. Apply the database migrations

Apply all included migrations to the production D1 database:

```bash
npm run db:migrate:remote
```

Run this again after adding a new migration.

Migration `0020_kind_rick_jones.sql` adds passwordless login/session storage,
email lookup indexes, and the 10% customer-fee snapshot stored with each quote.
Migration `0021_romantic_pepper_potts.sql` adds provider-to-Stripe account
mappings and immutable payment records used for Checkout, webhook
reconciliation, and idempotent transfers.
Migration `0045_chilly_maginty.sql` adds durable Stripe webhook receipts,
asynchronous refund/dispute reconciliation fields, and connected-account
payout/external-account snapshots. Do not configure any of the three webhook
destinations until this migration has been applied; the endpoints intentionally
return an error instead of acknowledging an event they cannot durably record.

## 8. Test and deploy

```bash
npm test
npm run deploy
```

The first command builds the production Worker and checks the key Tuveloz
features. The second deploys the verified source through Cloudflare.

Before deployment, complete the full sandbox path: provider onboarding, product
creation, storefront Checkout, accepted-quote Checkout, signed webhook delivery,
job completion, and owner-confirmed transfer release.

## 9. Connect the custom domains

In Cloudflare, attach the public domain to the deployed Worker. Attach the
protected admin hostname to the same Worker, then confirm its Access policy is
active before opening the owner dashboard.

## Optional GitHub Actions deployment

Create `.github/workflows/deploy.yml` only after adding these encrypted GitHub
repository secrets:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`
- `RESEND_API_KEY` if the workflow manages that secret

Keep production database exports and uploaded customer/provider images outside
GitHub.
