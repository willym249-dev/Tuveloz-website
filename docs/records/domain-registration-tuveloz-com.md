# Domain registration — tuveloz.com

- **Status:** active
- **Owner:** hello@tuveloz.com
- **Last reviewed:** 2026-09-26

The domain the whole business answers on: the website, every sign-in email, and
the sending identity behind account creation and password resets.

## Details

| Field | Value |
| --- | --- |
| **Type** | Registration |
| **Issued by** | Porkbun (registrar). DNS is delegated to Cloudflare |
| **Issued on** | 2026-07-22 at 16:14:19 UTC, verified by registry RDAP |
| **Expires** | 2027-07-22 at 16:14:19 UTC, verified September 26 by registry RDAP |
| **Identifier** | Not applicable — a domain name is not a sensitive identifier, but the registrar account login is. Do not record credentials here |
| **Where the original is kept** | The Porkbun account. Renewal notices go to the account's contact address |

Verified 2026-08-16 by direct DNS query, so the parts below are evidence rather
than recollection:

| Fact | Value |
| --- | --- |
| Nameservers | `ainsley.ns.cloudflare.com`, `kolton.ns.cloudflare.com` |
| Registrar | Porkbun LLC, IANA ID 1861; verified September 26 through the authoritative registry RDAP record |
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

The authoritative [Verisign RDAP record](https://rdap.verisign.com/com/v1/domain/TUVELOZ.COM)
was read September 26. Domain status includes client-transfer and client-delete
locks. Private contact details, auto-renew configuration, and the saved billing
method were not inspected; registry expiry is not proof of a future successful
renewal. The June 22, 2027 checkpoint in `OPEN-ITEMS.md` gives a month's lead
time to confirm renewal and a valid payment method. No purchase or billing
change was made.
