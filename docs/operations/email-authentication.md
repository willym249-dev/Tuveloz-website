# Email authentication — SPF, DKIM, and DMARC

- **Status:** active
- **Owner:** hello@tuveloz.com
- **Last reviewed:** 2026-08-10

What authenticates Tuveloz email, how the sending domain is configured today,
and the deliberate sequence for tightening DMARC. Every account on the platform
depends on this: sign-in codes, account creation, and password resets are all
email, and SMS is switched off.

## Why this matters more than it looks

There is no way into Tuveloz that does not require an email arriving within ten
minutes. `PHONE_SMS_LIVE_MODE_ENABLED` is `false`, so phone sign-in is not a
fallback. A delivery failure is not a degraded experience — it locks out every
customer and every provider at the same time, with no workaround.

## Current configuration

The sending identity is `alerts@updates.tuveloz.com` (`wrangler.jsonc`), sent
through Resend, which delivers via Amazon SES.

Verified 2026-08-10 by direct DNS query:

| Record | Value | State |
| --- | --- | --- |
| `resend._domainkey.updates.tuveloz.com` | RSA public key, 1024-bit | Present |
| `send.updates.tuveloz.com` TXT | `v=spf1 include:amazonses.com ~all` | Present |
| `send.updates.tuveloz.com` MX | `10 feedback-smtp.us-east-1.amazonses.com` | Present |
| `updates.tuveloz.com` TXT | — | No SPF record |
| `_dmarc.updates.tuveloz.com` | — | NXDOMAIN |
| `_dmarc.tuveloz.com` | `v=DMARC1; p=none; rua=mailto:dmarc@tuveloz.com;` | Present |
| `tuveloz.com` TXT | `v=spf1 include:_spf.porkbun.com ~all` | Registrar forwarding |

## How alignment resolves

**DKIM aligns.** The selector lives under `updates.tuveloz.com`, so the signing
domain matches the From domain exactly — relaxed and strict both pass.

**SPF aligns under relaxed, not strict.** SPF authenticates the envelope
sender, not the From header. Resend's bounce domain is
`send.updates.tuveloz.com`, whose organizational domain (`tuveloz.com`) matches
that of the From domain. DMARC defaults to relaxed alignment, so this passes.
The absence of an SPF record on `updates.tuveloz.com` itself is expected and not
a defect — nothing sends with that as the envelope domain.

**DMARC resolves by fallback.** There is no record at
`_dmarc.updates.tuveloz.com`, so receivers fall back to the organizational
domain record at `_dmarc.tuveloz.com`. That record carries no `sp=` tag, so
subdomains inherit `p=`, which is `none`.

**Effective policy for the sending domain is therefore `p=none`** — monitoring
only. Nothing is quarantined or rejected on failure, and nothing protects the
domain from being spoofed. This meets the Gmail and Yahoo bulk-sender floor, but
it is the floor.

### What this analysis does not prove

All of the above is inferred from DNS. The signing domain is inferred from where
the selector record sits, and the envelope sender from the bounce configuration.
Only an actual received message settles it: the `Authentication-Results` header
of a real sign-in code is the evidence, and it has not been captured yet. Treat
this page as well-founded until that header is on file.

## The tightening sequence, and why it is a sequence

Moving to `p=quarantine` before anyone reads the aggregate reports would be
guessing. The `rua` address exists to reveal legitimate senders nobody
remembered — a registrar forwarder, a helpdesk, a marketing tool — and
enforcement before that inventory is complete silently sends real mail to spam.

1. Put a person on `dmarc@tuveloz.com` and confirm the mailbox actually receives.
   An unread `rua` address makes the record decorative.
2. Stay at `p=none` for a full reporting month. Read the reports.
3. Only then move to `p=quarantine`, deliberately, once every legitimate sender
   is known to align.
4. Rotate DKIM to a 2048-bit key. The current key is Resend's 1024-bit default —
   acceptable, but below current practice.

Deadlines for each step are tracked in [`../OPEN-ITEMS.md`](../OPEN-ITEMS.md);
the automated weekly check reads that table, not this page.

## Staging deliberately cannot send

`scripts/generate-staging-wrangler.mjs` sets `RESEND_FROM_EMAIL` to an empty
string, and `RESEND_API_KEY` is a per-Worker secret that the staging Worker does
not hold. The send path fails closed when either is missing, so staging returns
a 503 rather than delivering. This is by design and documented in
[`../STAGING.md`](../STAGING.md).

The consequence is that no end-to-end email test is possible on staging as
configured. Enabling one means changing the generator and giving the staging
Worker its own Resend key — a **separate** key, never production's. `STAGING.md`
forbids copying production credentials into staging, and a distinct staging
sender address also keeps staging traffic separable in the `rua` reports.
