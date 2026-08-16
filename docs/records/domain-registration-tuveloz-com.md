# Domain registration — tuveloz.com

- **Status:** active
- **Owner:** hello@tuveloz.com
- **Last reviewed:** 2026-08-16

The domain the whole business answers on: the website, every sign-in email, and
the sending identity behind account creation and password resets.

## Details

| Field | Value |
| --- | --- |
| **Type** | Registration |
| **Issued by** | Porkbun (registrar). DNS is delegated to Cloudflare |
| **Issued on** | — |
| **Expires** | — **fill this in; it is the field this card exists for** |
| **Identifier** | Not applicable — a domain name is not a sensitive identifier, but the registrar account login is. Do not record credentials here |
| **Where the original is kept** | The Porkbun account. Renewal notices go to the account's contact address |

Verified 2026-08-16 by direct DNS query, so the parts below are evidence rather
than recollection:

| Fact | Value |
| --- | --- |
| Nameservers | `ainsley.ns.cloudflare.com`, `kolton.ns.cloudflare.com` |
| Registrar | Porkbun, named in the root SPF record (`include:_spf.porkbun.com`) |
| Mail receiving | Google Workspace (`smtp.google.com`) |
| Transactional sending | Resend, DKIM published under `updates.tuveloz.com` |

## What it covers

Control of the name itself, and by extension the ability to publish DNS. Losing
the registration does not degrade the service — it ends it, along with every
sign-in email, since `PHONE_SMS_LIVE_MODE_ENABLED` is false and there is no
non-email way into an account.

## What depends on it

- `entity_authority_domain_and_code` — the domain-control part of that gate is
  evidenced by the table above; see
  [`../business/launch-gate-briefing.md`](../business/launch-gate-briefing.md)
- Every launch gate that assumes the site and its mail exist
- The DMARC work in [`../operations/email-authentication.md`](../operations/email-authentication.md)

## Reminder

**No renewal reminder is on file.** A lapsed registration is the single
cheapest way to lose the business, so set one well before the expiry date and
note it here. Auto-renew is not a substitute — it fails silently when a card
expires.
