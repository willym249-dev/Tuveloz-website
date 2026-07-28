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
```

`AUTH_CODE_SECRET` protects stored one-time codes and session tokens. Rotating
it signs every customer and provider out. Do not add either secret value to
`wrangler.jsonc`.

## 5. Protect owner access

Use a dedicated admin hostname, such as `admin.your-domain.example`, that routes
to the same Worker. Protect that whole hostname with Cloudflare Access and allow
only the owner email configured in `OWNER_EMAIL`.

The public hostname remains available to customers and providers. The protected
admin hostname supplies the verified email header used by the owner dashboard.
Open `/admin` on the protected hostname after signing in through Cloudflare
Access.

## 6. Apply the database migrations

Apply all included migrations to the production D1 database:

```bash
npm run db:migrate:remote
```

Run this again after adding a new migration.

Migration `0020_kind_rick_jones.sql` adds passwordless login/session storage,
email lookup indexes, and the 10% customer-fee snapshot stored with each quote.

## 7. Test and deploy

```bash
npm test
npm run deploy
```

The first command builds the production Worker and checks the key Tuveloz
features. The second deploys the verified source through Cloudflare.

The current quote flow calculates, stores, and discloses the customer fee. A
payment processor must still be connected and tested before Tuveloz can
automatically collect that fee.

## 8. Connect the custom domains

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
