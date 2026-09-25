# Production health monitor

The `Monitor Tuveloz production` GitHub Actions workflow checks `https://tuveloz.com/api/health` once an hour and can also be run manually. It is separate from the Cloudflare Worker and does not use Tuveloz credentials, provider documents, customer information, or paid APIs.

The check fails unless all of these facts are true:

- the application, D1 database, and required schema are ready;
- all required tables and guarded database triggers are present;
- customer accounts and provider applications are open;
- the site remains in onboarding-only mode; and
- customer job requests and customer payments remain closed.

The command retries a read-only request three times to avoid treating a brief network failure as a confirmed outage. A failed run appears in the repository's Actions page with a short failure summary. Repository notification settings should include failed Actions runs for the owner; the monitor deliberately does not create public issues or rely on the Tuveloz email system.

The workflow uses a standard GitHub-hosted runner and no secrets. Standard GitHub-hosted runners are free in public repositories. GitHub may automatically disable scheduled workflows in a public repository after 60 days without repository activity, so include this workflow in the regular operational review and run it manually after re-enabling it.

For a direct check from a trusted machine, run:

```powershell
node scripts/check-production-health.mjs
```

This monitor detects operational failure and unsafe launch-state drift. It does not replace [database and document backup procedures](./backup-and-recovery.md), inspect private records, or prove that a provider document is authentic.
