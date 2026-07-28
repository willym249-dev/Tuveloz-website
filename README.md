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
- Passwordless customer and verified-provider sign-in with separate workspaces
- Provider application, jobs, quotes, profiles, work gallery, and QR tools
- Itemized 10% customer service fee stored with each provider quote
- Owner dashboard and provider verification controls
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
- A Resend account for passwordless sign-in and provider email alerts

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
- Review the legal policies, provider requirements, and payment design before
  accepting live jobs or payments.
