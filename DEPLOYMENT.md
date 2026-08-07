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
- `LAUNCH_UPDATES_POSTAL_ADDRESS`: the full mailing address printed at the foot
  of every pre-launch launch-update email — street or PO box, city, state, ZIP.
  US commercial email must identify the sender by physical address, so this is
  required before the first marketing send. While it is empty the launch-update
  sequence sends nothing at all and logs the reason, rather than mailing
  without it. Prefer a PO box or registered agent address over a home address:
  it is printed in every marketing email and cannot be recalled once sent.

Save a random authentication secret of at least 32 characters and the Resend
key as Cloudflare secrets:

```bash
npx wrangler secret put AUTH_CODE_SECRET
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put STRIPE_SECRET_KEY
npx wrangler secret put STRIPE_PAYMENT_WEBHOOK_SECRET
npx wrangler secret put STRIPE_IDENTITY_SECRET_KEY
npx wrangler secret put STRIPE_IDENTITY_WEBHOOK_SECRET
npx wrangler secret put STRIPE_IDENTITY_VERIFICATION_FLOW_ID
npx wrangler secret put STRIPE_CONNECTED_ACCOUNT_WEBHOOK_SECRET
npx wrangler secret put STRIPE_CONNECT_WEBHOOK_SECRET
```

`AUTH_CODE_SECRET` protects stored one-time codes and session tokens. Rotating
it signs every customer and provider out. The Stripe values must be sandbox
`sk_test_...`, `rk_test_...`, and `whsec_...` values during testing. Do not add any real secret
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

Create four Stripe event destinations. Do not reuse signing secrets or mix
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
2. A standard snapshot webhook at
   `https://YOUR-DOMAIN/api/stripe/webhooks/identity` for:
   - `identity.verification_session.created`
   - `identity.verification_session.processing`
   - `identity.verification_session.requires_input`
   - `identity.verification_session.verified`
   - `identity.verification_session.canceled`
   - `identity.verification_session.redacted`
3. A **Connected accounts**, standard **Snapshot** destination at
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
4. A connected-account destination at
   `https://YOUR-DOMAIN/api/stripe/webhooks/connect`. Select **Connected
   accounts**, **Thin** payload style, and:
   - `v2.core.account[requirements].updated`
   - `v2.core.account[configuration.recipient].capability_status_updated`

Each destination has its own `whsec_...` signing secret. Store the payment
destination secret in `STRIPE_PAYMENT_WEBHOOK_SECRET`, the Identity destination
secret in `STRIPE_IDENTITY_WEBHOOK_SECRET`, the connected-account
snapshot secret in `STRIPE_CONNECTED_ACCOUNT_WEBHOOK_SECRET`, and the V2 thin
destination secret in `STRIPE_CONNECT_WEBHOOK_SECRET`.

The payment and connected-account endpoints keep durable event receipts. A
failed processing attempt is retried; an already-completed event is safely
acknowledged without applying it again. Failed/canceled refunds, payout
failures, deleted or unusable external accounts, missing snapshots, and stale
payment-mode snapshots all fail closed before checkout or provider release.

Stripe Identity is independently fail-closed. Leave
`IDENTITY_VERIFICATION_PROVIDERS` blank until the integrations are approved and
tested. Stripe Identity must use a separate `STRIPE_IDENTITY_SECRET_KEY`; create
the most restricted key possible with only the Identity verification-session
and verification-report access required by this integration. Use `rk_test_...`
for test applicants and `rk_live_...` for real applicants. Do not reuse the
payments `STRIPE_SECRET_KEY`, and do not grant Identity file-download access.
The dedicated `STRIPE_IDENTITY_WEBHOOK_SECRET` must belong only to the standard
snapshot Identity destination above.

Create a reusable Stripe **TEST** Verification Flow and store its `vf_*` ID in
the encrypted Cloudflare secret `STRIPE_IDENTITY_VERIFICATION_FLOW_ID`. The
reviewed flow must require a government document, camera-only live capture, and
a matching selfie; allow only a driver's license, state/national ID card, or
passport; and leave ID-number, email, and phone verification off. Leave the
Dashboard return URL blank because TUVELOZ supplies the signed-in provider's
same-origin return URL per session. The server rechecks the flow ID and all
API-visible options on every retrieved session and fails closed on drift.
Before adding `stripe_identity` to the provider allowlist, run one synthetic
TEST create/retrieve canary with every marketplace and payment gate closed and
confirm Stripe returns the expected option shape. Record only the privacy-safe
shape and IDs; never record a client secret, document, selfie, name, or birth
date.

The code-controlled Identity live switch (`STRIPE_IDENTITY_LIVE_MODE_ENABLED`)
was deliberately released to `true` for the provider-side launch. Real-person
verification therefore still requires `STRIPE_IDENTITY_ALLOW_LIVE_MODE=true`, a
dedicated `rk_live_*` Identity key, a **LIVE** Verification Flow ID, and the
live Identity webhook secret — none of which ship in code. With those unset,
Identity stays fail-closed and a copied `rk_live_*` key alone cannot begin
verification. This is isolated from payments: `STRIPE_LIVE_MODE_ENABLED`
remains `false`, so enabling Identity does not enable jobs, checkout, payments,
transfers, or payouts. See `docs/PROVIDER_ACTIVATION_RUNBOOK.md`.

Before pointing real applicants at the live flow, re-run the option-shape canary
in live configuration (no real applicant) to confirm Stripe returns the expected
option shape.

Set `IDENTITY_VERIFICATION_PROVIDERS` to include `stripe_identity` only during
an authorized test-mode validation after this code and its secrets are deployed,
or during a future separately reviewed live release. With both Identity live
locks false, the current release accepts only `rk_test_*` for records explicitly
marked as test providers. A non-Stripe provider name is
configuration for a future manual/non-biometric adapter; it does not make that
alternative operational. Do not use `tuveloz`, an owner name, or
self-attestation as an external provider. Before a non-Stripe gate can pass,
implement an allowlisted adapter with independently verifiable proof and
document the vendor contract, retention, access controls, reference format,
and review procedure.

Configuration strings do not satisfy either readiness gate. The Stripe gate
requires one authorized, current live-mode owner-operator verification that
completed through the signed webhook and still exactly matches the active
guard-stamped personnel record. The manual-alternative gate is intentionally
blocked until an independently verifiable, allowlisted provider adapter exists;
an owner-entered record and its audit event may support an individual assisted
review but cannot pass operational readiness. Confirm the Stripe canary evidence
ID and timestamp on the owner launch-readiness page and keep provider onboarding
blocked while the manual adapter is absent. A canary never approves a customer
job, provider service, payment, or marketplace launch.

The automated flow is limited to a signed-in independent owner-operator whose
immutable v2 application separately names the performing person. Employee and
trainee paths remain blocked pending a separate person-level invitation and
consent workflow. Legacy applications without that immutable name require an
assisted re-attestation or the approved manual review; a self-entered name is
not accepted as proof. TUVELOZ requests a Stripe-hosted government-ID check,
selfie, and biometric comparison. The webhook uses verified name and date of
birth only in memory to require an exact application-name match and age 18 or
older. The Identity integration persists only Stripe/TUVELOZ references,
status/decision, consent and event dates, certification version, and an account
session digest. It does not persist Stripe's ID number, verified DOB, document
image, or selfie. Stripe retains collected data under its own privacy policy.
Test-mode results cannot verify a real provider. Identity live mode is
independent of the payment live-mode switch and does not enable customer jobs,
checkout, payments, or payouts.

For an access, correction, or deletion request involving Identity, follow the
verified privacy-request procedure and review any legal hold first. Coordinate
Stripe-side redaction through an authorized reviewed operation; do not expose
session digests or internal Stripe references in the ordinary data export.
Retain only the minimal non-PII decision/audit metadata still required by law,
security, fraud prevention, or an active dispute, and record the disposition.

For local testing, run separate Stripe CLI listeners:

```bash
stripe listen \
  --events 'checkout.session.completed,checkout.session.async_payment_succeeded,checkout.session.async_payment_failed,checkout.session.expired,charge.refunded,charge.refund.updated,refund.created,refund.failed,refund.updated,charge.dispute.created,charge.dispute.updated,charge.dispute.closed,charge.dispute.funds_reinstated,charge.dispute.funds_withdrawn' \
  --forward-to http://localhost:3000/api/stripe/webhooks/payments

stripe listen \
  --events 'identity.verification_session.created,identity.verification_session.processing,identity.verification_session.requires_input,identity.verification_session.verified,identity.verification_session.canceled,identity.verification_session.redacted' \
  --forward-to http://localhost:3000/api/stripe/webhooks/identity

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
email lookup indexes, and the 5% customer-fee snapshot stored with each quote.
Migration `0021_romantic_pepper_potts.sql` adds provider-to-Stripe account
mappings and immutable payment records used for Checkout, webhook
reconciliation, and idempotent transfers.
Migration `0045_chilly_maginty.sql` adds durable Stripe webhook receipts,
asynchronous refund/dispute reconciliation fields, and connected-account
payout/external-account snapshots. Do not configure any of the three webhook
destinations until this migration has been applied; the endpoints intentionally
return an error instead of acknowledging an event they cannot durably record.

## 8. Verify and deploy through GitHub

```bash
npm ci
npm run lint
npm test
npm run db:migrate:local
```

Open a pull request into `main` and require the repository verification workflows
to pass. Merge only the reviewed commit. A push to `main` runs the production
workflow, applies remote migrations, deploys the Worker, and verifies that the
exact commit and required schema are live.

Do not use `npm run deploy` for a normal production release. It bypasses the
GitHub commit stamp, exact-release health verification, and deployment status.
Keep direct local deployment for a documented emergency procedure only.

Before deployment, complete the full sandbox path: provider onboarding, product
creation, storefront Checkout, accepted-quote Checkout, signed webhook delivery,
job completion, and owner-confirmed transfer release.

## 9. Connect the custom domains

In Cloudflare, attach the public domain to the deployed Worker. Attach the
protected admin hostname to the same Worker, then confirm its Access policy is
active before opening the owner dashboard.

### ai.tuveloz.com

`wrangler.jsonc` claims `ai.tuveloz.com` as a custom domain on this Worker, and
`worker/index.ts` redirects that host's root to `/ai`. Every other path on the
host is served normally, so links the assistant hands out (`/payments`,
`/faq`) resolve without leaving the host the visitor is on.

**Read this before the first deploy that includes the route.** As of August 6,
2026, `ai.tuveloz.com` resolves through Cloudflare to
`custom-domains.chatgpt.site` — an OpenAI custom-GPT domain, not this Worker.
Deploying with the route above **takes that hostname over**, which is the
intended direction (the in-app assistant at `/ai` replaces the external host),
but it does retire whatever that custom GPT was serving. Confirm nobody still
depends on it first.

To deploy without claiming the hostname, delete the `ai.tuveloz.com` entry from
`routes` in `wrangler.jsonc`. Nothing else depends on it: `/ai` keeps working on
the main domain, and the redirect in `worker/index.ts` simply never fires.

### Checking Spanish coverage

```bash
npm run dev            # in one shell
npm run i18n:check     # in another
```

Walks every page in `SPANISH_READY_PATHS` the way the runtime translator does
and fails if any visible string on a Spanish-ready page has no dictionary entry.
Run it after changing public copy: adding an English sentence to a translated
page is exactly how the site ended up English-only the first time. Either add
the Spanish or drop the page from the ready list — the point is that a page
either offers Spanish completely or does not offer it at all.

Legal pages are deliberately excluded. They stay English and do not show the
language toggle, because a half-translated agreement is worse than an English
one.

### Checking the assistant after a deploy

```bash
npm run ai:check -- https://tuveloz.com
```

Asks the live assistant four questions and fails if a policy answer comes back
without its source link, if an answer about a provisional design (the fee, the
payout, the launch state) reads as settled fact, or if a plain car question
drags policy material in. Exits 0 with a note when the environment has no AI
provider keys, so it is safe to run anywhere.

The server enforces the same hedge rule at request time — a reply that loses it
is replaced with the approved wording before it reaches anyone — so this check
is a canary for prompt drift, not the only thing standing between a customer and
a wrong answer about money.

## Required GitHub Actions deployment

The repository includes `.github/workflows/verify.yml` and
`.github/workflows/deploy-cloudflare.yml`. Add these encrypted GitHub repository
secrets before enabling production deployment:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`
- `RESEND_API_KEY` if the workflow manages that secret

Keep production database exports and uploaded customer/provider images outside
GitHub.
