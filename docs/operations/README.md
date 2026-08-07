# Operations documents

Runbooks, standing procedures, environment guides, and incident write-ups — the
things you need when something has to be done correctly under pressure.

Nothing filed here yet. The existing operational documents stayed at the top of
`docs/` so that links and tests referencing them keep working:

- [`../PROVIDER_ACTIVATION_RUNBOOK.md`](../PROVIDER_ACTIVATION_RUNBOOK.md) —
  moving providers from applications-open to active
- [`../STAGING.md`](../STAGING.md) — the test lab and the staging Worker
- [`../../DEPLOYMENT.md`](../../DEPLOYMENT.md) — GitHub and Cloudflare setup

New operational documents go in this folder.

When writing an incident report, name it for when it happened and what broke —
`incident-2026-03-stripe-webhook-outage.md` — and cover what was observed, the
actual cause, what was done, and what would catch it earlier next time.

See [`../FILING-GUIDE.md`](../FILING-GUIDE.md) for naming and the header block
every document needs, and add a row to [`../README.md`](../README.md) when you
file something.
