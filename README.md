# Tuveloz

Tuveloz is a mobile-friendly vehicle-service marketplace for customers and
independent providers. Customers can request work, compare quotes, choose a
provider, and manage a private job workspace. Providers can apply, review
matching jobs, submit quotes, manage their business profile, and track private
performance information.

This repository is an independent source-code copy prepared for GitHub and
Cloudflare Workers. It contains no live database, uploaded customer files,
deployment credentials, API keys, or production environment values.

## Included

- Public Tuveloz website and service-request flow
- Customer quote comparison and private request workspace
- Verified customer and provider accounts with password, passkey, and role-separated workspaces
- Provider application, jobs, quotes, profiles, work gallery, and QR tools
- Accepted-quote work authorizations and customer-approved change orders
- Participant-only job condition, progress, parts, and completion evidence records
- Signed-in Privacy Center with data export, communication choices, and verified privacy requests
- Itemized 5% customer service fee stored with each provider quote
- Stripe Connect V2 provider onboarding with live status read directly from Stripe
- Platform products, hosted Checkout, signed webhooks, and a simple storefront
- Destination Charges for storefront products and owner-released transfers for completed quote jobs
- Owner dashboard, customer profile oversight, provider verification, and privacy-request review controls
- Cloudflare D1 schema and migrations
- Cloudflare R2 image storage integration
- Optional Resend email notifications
- Responsive English/Spanish interface
- Automated build-content tests

## Requirements

- Node.js 22.13 or newer
- npm
- A Cloudflare account
- A Cloudflare D1 database
- A Cloudflare R2 bucket
- Cloudflare Images access for image optimization
- A Resend account for account verification and marketplace email alerts
- A Stripe sandbox account and Stripe CLI for local webhook testing

## Local setup

1. Install the locked dependencies:

   ```bash
   npm ci
   ```

2. Copy `.env.example` to a private local environment file and replace every
   placeholder. Do not commit the completed file.

3. Replace the placeholder D1 database ID in `wrangler.jsonc` with the ID
   returned by Cloudflare.

4. Apply the included migrations to the local D1 database:

   ```bash
   npm run db:migrate:local
   ```

5. Start the development server:

   ```bash
   npm run dev
   ```

## Verify the source

Run the production build and the included feature checks:

```bash
npm test
```

## Deploy

See [DEPLOYMENT.md](DEPLOYMENT.md) for the complete GitHub and Cloudflare setup.

## Company notes

`docs/company-notes.md` holds the things that stay true between sessions: how
Tuveloz measures success (awareness → interest → consideration → decision), the
content mistakes it has decided to avoid, and ideas worth trying. Every question
asked through `npm run ai` is grounded in that file in full, so what is written
there shapes later answers instead of being re-explained each time.

Add to it with `npm run note -- "what we learned"`, or
`npm run note -- --section "Ideas worth trying" "the idea"`. Editing the file
by hand works the same way — it is plain markdown and git-tracked, so a note is
reviewed like any other change.

This is separate from `ai-council-log.jsonl`, which records recent council
answers and is only shown a few entries deep. Anything meant to be remembered
permanently belongs in the notes file, not the log.

## Account safety and notifications

- Every saved customer request queues an owner notification with the request ID
  and a protected admin link. Customer details remain inside the owner dashboard.
- Customers and verified providers receive security alerts after account creation,
  password reset, and passkey registration.
- Signed-in sessions expire after 30 minutes of inactivity and have a 12-hour
  absolute limit. Active sessions are refreshed at most once every five minutes.
- Email delivery failures are recorded in the database-backed notification outbox
  and retried without duplicating the customer request.

## Important security notes

- Never commit `.env`, `.dev.vars`, API tokens, or database exports.
- Keep `AUTH_CODE_SECRET` private and use at least 32 random characters.
- Sign-in codes are stored only as keyed hashes, expire after 10 minutes, and
  are limited to five verification attempts.
- Provider account sessions are granted only to approved, verified, non-test
  providers. Customer and provider APIs return role-specific data.
- Keep provider and customer private workspace links private.
- Protect the owner/admin hostname with Cloudflare Access before using the
  dashboard in production.
- Keep `STRIPE_ALLOW_LIVE_MODE=false` while testing. The legal business owner
  must deliberately complete the live-account, compliance, refund, and dispute
  review before enabling real payments.
- Review the legal policies, provider requirements, and payment design before
  accepting live jobs or payments.
