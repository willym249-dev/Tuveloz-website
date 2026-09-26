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
the registration can interrupt the website, business mail, and sign-in and
recovery email delivery. Passwords and passkeys are also supported, but they do
not restore access to a website whose domain no longer resolves correctly.

## What depends on it

- `entity_authority_domain_and_code` — the domain-control part of that gate is
  evidenced by the table above; see
  [`../business/launch-gate-briefing.md`](../business/launch-gate-briefing.md)
- Every launch gate that assumes the site and its mail exist
- The DMARC work in [`../operations/email-authentication.md`](../operations/email-authentication.md)

## Reminder

The authoritative [Verisign RDAP record](https://rdap.verisign.com/com/v1/domain/TUVELOZ.COM)
was read September 26. Domain status includes client-transfer and client-delete
locks. A signed-in Porkbun review later that day confirmed the July 22, 2027
expiry, **auto-renew on**, and **Use Privacy Service** selected for tuveloz.com.
The account's Credit card section reports a saved payment method using Link via
Stripe. No card expiry is shown in that summary, and no charge was attempted;
saved billing is not proof that a future renewal payment will succeed.

The domain-specific contact editor was read September 26 without submitting
changes. Required address and email fields are populated. The street, city,
postal code, and email differ from the verified business mailbox/support record;
the optional company and unit fields are empty. A separate owner contact can be
valid: these differences do not establish incorrect registration or public
exposure. The owner still needs to confirm that this contact remains accurate
and reachable, or authorize a specific replacement. Do not copy a support address
into ownership records automatically or apply changes to all domains.

The June 22, 2027 checkpoint in `OPEN-ITEMS.md` remains in place to reconfirm
renewal and the payment method before expiry. No purchase, renewal, contact,
billing, DNS, or privacy-setting change was made. Exact contact values were not
retained in this record.
