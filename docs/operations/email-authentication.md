# Email authentication — SPF, DKIM, and DMARC

- **Status:** active
- **Owner:** hello@tuveloz.com
- **Last reviewed:** 2026-09-04

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

September 4 recheck: root SPF is still
`v=spf1 include:_spf.porkbun.com ~all`, the default Workspace selector
`google._domainkey.tuveloz.com` returns NXDOMAIN, and DMARC remains `p=none`.
Cloudflare is the authoritative DNS host. A custom Workspace selector has not
been ruled out; inspect Google Admin before creating or replacing a key.

The proposed root TXT update is
`v=spf1 include:_spf.porkbun.com include:_spf.google.com ~all`. It preserves
the current forwarding authorization while adding the existing Workspace
sender. Update the existing SPF record, keeping other TXT records intact.
No DNS change has been applied in this continuation. Google Admin and
Cloudflare currently require owner sign-in.
[Google SPF setup](https://knowledge.workspace.google.com/admin/security/set-up-spf),
[Google DKIM setup](https://knowledge.workspace.google.com/admin/security/set-up-dkim).

The deployed support form's labeled test reached the owner inbox. Gmail shows
mailed-by `send.updates.tuveloz.com`, signed-by `updates.tuveloz.com`, and TLS.
This confirms receipt and those displayed properties for one application
message. It does not establish Workspace reply authentication, universal inbox
placement, or a captured full `Authentication-Results` header.

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

Re-verified 2026-08-16; every row above still reads exactly as recorded, and the
Resend key is still 1024-bit. Two additions from that check:

| Record | Value | State |
| --- | --- | --- |
| `tuveloz.com` MX | `smtp.google.com` | Google Workspace receives mail |
| `google._domainkey.tuveloz.com` | — | NXDOMAIN, no Workspace DKIM |

### The sender the reports are most likely to surface first

The root domain receives at Google Workspace, and `hello@tuveloz.com` is the
address used throughout this repository. Nothing here covers mail **sent** from
that mailbox: the root SPF authorises the registrar's forwarders and not Google,
and no Workspace DKIM selector is published. So any message sent from
`hello@tuveloz.com` through Workspace fails SPF and has no DKIM signature to fall
back on, and therefore fails DMARC alignment.

This costs nothing today — `p=none` observes and never quarantines. It is
precisely what the `rua` address exists to reveal, and it is the first thing to
confirm or rule out in the sender inventory, because moving to `p=quarantine`
with it unresolved sends the owner's own mail to spam.

**Confirmed 2026-08-16: it is sent.** The one fact this repository could not
supply came from the mailbox itself. Its sent folder holds mail from
`hello@tuveloz.com` addressed to recipients outside the domain — ordinary
correspondence, sitting alongside a handful of self-addressed tests, with the
most recent external message on 2026-08-08. The failing sender is therefore
real and in current use, not hypothetical, and the fix is required *before*
enforcement rather than after: a Workspace SPF include and a published Workspace
DKIM selector.

The recipient addresses are personal data and are deliberately not recorded here.
That external recipients exist at all is the entire finding; who they are does
not change it.

### The rua mailbox does receive

Also confirmed 2026-08-16: `dmarc@tuveloz.com` is a live mailbox and aggregate
reports arrive in it. Three are on file, dated 2026-08-08, 2026-08-09, and
2026-08-12, each from `noreply-dmarc-support@google.com` with the subject form
`Report domain: tuveloz.com Submitter: google.com`. The `rua` address is not a
black hole, which settles the second half of step 1 below.

The receipts qualify themselves in two ways. Google is so far the only submitter,
which is unremarkable at this volume but means the inventory reflects one
receiver's view rather than the internet's — a sender that only ever mails
non-Gmail recipients would not appear in it. And most of the reports on file are
still unread, which is the *first* half of step 1, and the half still open. A
mailbox that receives and is never read is decorative in exactly the way this
page warns about.

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
   An unread `rua` address makes the record decorative. **Receipt is confirmed
   (2026-08-16); naming the reader is not.**
2. Stay at `p=none` for a full reporting month. Read the reports.
3. Fix the Workspace sender before enforcement — add a Google SPF include to the
   root record and publish a Workspace DKIM selector. This step was contingent
   until 2026-08-16 and is now known to be required.
4. Only then move to `p=quarantine`, deliberately, once every legitimate sender
   is known to align.
5. Rotate DKIM to a 2048-bit key. The current key is Resend's 1024-bit default —
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
