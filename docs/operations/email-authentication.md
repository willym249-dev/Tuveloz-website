# Email authentication — SPF, DKIM, and DMARC

- **Status:** active
- **Owner:** hello@tuveloz.com
- **Last reviewed:** 2026-09-26

What authenticates Tuveloz email, how the sending domain is configured today,
and the deliberate sequence for tightening DMARC. Every account on the platform
depends on this: sign-in codes, account creation, and password resets are all
email, and SMS is switched off.

## Why this matters more than it looks

Email is required for account verification, emailed sign-in codes, and password
recovery. Existing sessions and supported password/passkey flows are separate;
do not describe every sign-in as an emailed-code flow. SMS remains switched off,
so it is not an email-recovery fallback. Preserve working email settings while
reviewing delivery and spoofing protection.

## September 26 review — eight reports read; sender confirmation pending

Direct public DNS reads through resolver `1.1.1.1` confirmed the following at
23:10–23:14 UTC. RSA key sizes were checked by importing the published public
keys; no private key or account credential was read.

| Surface | Current evidence | Remaining limitation |
| --- | --- | --- |
| Business correspondence | Root SPF includes Google and Porkbun; `google._domainkey.tuveloz.com` is 2048-bit | DNS alone does not establish delivery or inventory every sender |
| Website email | `wrangler.jsonc` configures `Tuveloz <alerts@updates.tuveloz.com>`; the inspected authentication, provider-application, provider-alert, and outbox paths use Resend | Source configuration is not proof of a new send |
| Website sender authentication | `send.updates.tuveloz.com` publishes the Amazon SES SPF include; `resend._domainkey.updates.tuveloz.com` remains 1024-bit | Stronger DKIM remains a provider-coordinated task; do not replace the public key independently of the signing service |
| DMARC | Root policy is `p=none`, reporting to `dmarc@tuveloz.com`; the updates subdomain has no separate DMARC record | Monitoring is not an enforcement policy; no policy change was made |
| Registrar forwarding | Porkbun remains authorized in root SPF | Actual forwarding/sending use has not been inventoried; do not remove the include merely because the website uses Resend |
| Private staging | Generator still supplies an empty sender; staging has no production Resend credential | Outbound email remains intentionally disabled; synthetic local tests do not establish hosted delivery |

The signed-in business Gmail search for `subject:"Report domain: tuveloz.com"`
from August 25 through September 26 returned **eight reports: seven from Google
and one from Microsoft**. After the owner approved continuing the scoped local
review, all eight attachments downloaded through Gmail's normal controls using
the supported browser download API. The blocked Chrome download-manager page was
not used. The seven ZIP files and one GZIP file were parsed locally with DTDs and
external XML resolution disabled and a size limit; no report was uploaded to an
analysis service. Raw files, SHA-256 hashes, report IDs, and row-level results are
retained outside the repository in `outputs/dmarc-reports-20260926.private/`.

At 23:23:45 UTC, parsing found eight unique reporter/report-ID pairs, eleven
record rows, and **15 reported message observations: 3 DMARC passes and 12
failures**. Those are observations in this limited report set, not the site's
overall delivery rate or unique delivered inbox messages. The results use
`policy_evaluated` alignment, not a bare DKIM authentication result.

| Report day (UTC) | Message observations | DMARC pass | DMARC fail | Interpretation |
| --- | ---: | ---: | ---: | --- |
| August 27 | 6 | 0 | 6 | Default Google signature authenticates but does not align; two observations involve another envelope domain, consistent with forwarding or rewriting |
| August 31 | 2 | 0 | 2 | Same historical unaligned Google signature |
| September 4 | 3 | 2 | 1 | Resend website sender and one Tuveloz-signed Google message pass; one old-style Google signature fails alignment |
| September 5 | 1 | 1 | 0 | Tuveloz-signed Google message passes |
| September 22 | 1 | 0 | 1 | Unrecognized source, no DKIM result, SPF softfail |
| September 23 | 1 | 0 | 1 | A different unrecognized source, no DKIM result, SPF softfail |
| September 24 | 1 | 0 | 1 | A third unrecognized source, no DKIM result, SPF softfail |

The nine historical Google-related failures are consistent with the previously
recorded Workspace configuration problem. The mixed September 4 daily report
does not locate an individual message relative to the repair time. The three
passing observations support the repaired Workspace sender and existing website
sender for those samples; they do not prove every subsequent email passes.

The three recent unsigned failures are **possible spoofing, not confirmed
fraud or account compromise**. All reports show DMARC disposition `none`; this
does not establish inbox placement or override the receiver's own filtering.
The reporting periods cover only seven distinct dates. Unreported days are
unknown, not automatic passes. No historical Gmail message was resent.

**Next decision:** confirm whether any other mail app, marketing service, or
forwarder sends with a Tuveloz From address. That owner question is pending.
Do not authorize the unknown source IPs in SPF or classify them as legitimate
merely to remove failures. Keep the existing policy while that inventory and
the next representative post-repair reports are reviewed. A future small
quarantine rollout needs a named reader, checked legitimate senders, a saved
previous DNS value for rollback, and an explicit record of the applied change.
No DNS or sending-service change was made in this review.

The September 4 Workspace delivery test and automatic support message, and the
September 26 manual mailbox round trip, already have receipt evidence. Do not
send them again for this review. A received **support** message's full
SPF/DKIM/DMARC pass was rechecked in the September 26 production follow-up; it
does not establish a sign-in-code header or incident-triggered delivery. See
the [support record](2026-09-04-support-reliability.md) and
[incident runbook](vehicle-incident-claims-and-stop-work-plan.md).

Google's [report documentation](https://knowledge.workspace.google.com/admin/security/about-dmarc-reports)
explains that the XML identifies sending sources and authentication results.
Its [rollout guidance](https://knowledge.workspace.google.com/admin/security/recommended-dmarc-rollout)
calls for reviewing representative mail streams before gradual enforcement.
This project's full-month review checkpoint is an internal target, not a
universal Google requirement. No additional paid reporting service is needed
to read this small set locally. No recurring reader has been assigned: the
owner's incident-response availability does not assign DMARC monitoring.

## Current configuration

September 4 repair verified: root SPF is now
`v=spf1 include:_spf.porkbun.com include:_spf.google.com ~all`, and
`google._domainkey.tuveloz.com` publishes the 2048-bit Workspace public key.
Google Admin reports that DKIM authentication is active. One owner-authorized
message from `hello@tuveloz.com` reached a separate Gmail inbox; its received
Authentication-Results reported SPF, DKIM (`d=tuveloz.com; s=google`), and DMARC
all passing. The recipient address and account-administration details remain
private. This is one controlled delivery, not a guarantee of future placement.

Cloudflare remains the authoritative DNS host. Registrar forwarding and the
Resend subdomain records were preserved. DMARC remains `p=none` pending the
remaining sender confirmation and follow-up reporting below.
[Google SPF setup](https://knowledge.workspace.google.com/admin/security/set-up-spf),
[Google DKIM setup](https://knowledge.workspace.google.com/admin/security/set-up-dkim).

The deployed support form's labeled test reached the owner inbox. Gmail shows
mailed-by `send.updates.tuveloz.com`, signed-by `updates.tuveloz.com`, and TLS.
This confirms receipt for one application message. The September 26 follow-up
also read its original authentication summary and found SPF, DKIM, and DMARC
passing. It does not establish universal inbox placement or a sign-in-code
message's authentication header.

The sending identity is `alerts@updates.tuveloz.com` (`wrangler.jsonc`), sent
through Resend, which delivers via Amazon SES.

Historical baseline, verified 2026-08-10 by direct DNS query (root Workspace
records were repaired September 4 as described above):

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

### Historical Workspace finding (resolved September 4)

The root domain receives at Google Workspace, and `hello@tuveloz.com` is the
address used throughout this repository. Nothing here covers mail **sent** from
that mailbox: the root SPF authorises the registrar's forwarders and not Google,
and no Workspace DKIM selector is published. So any message sent from
`hello@tuveloz.com` through Workspace can fail SPF and lack a Tuveloz-aligned
DKIM signature, so it fails DMARC. The September 26 aggregate review found the
historical Google default signature could pass cryptographic verification while
still failing alignment with Tuveloz; raw DKIM pass alone is not DMARC pass.

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

**The published DMARC policy remains `p=none`: monitoring only.** It does not
ask receivers to quarantine or reject a DMARC failure. Receivers can still
apply their own filtering; this record alone does not prove sender compliance
with all mailbox-provider requirements.

### What this analysis does not prove

DNS establishes the published configuration, not every message's result. The
dated Workspace and support-message receipts above prove those samples only.
A captured real sign-in-code authentication header, a reviewed aggregate sender
inventory, and incident-specific inbox delivery remain separate evidence.

## The tightening sequence, and why it is a sequence

Moving to `p=quarantine` before anyone reads the aggregate reports would be
guessing. The `rua` address exists to reveal legitimate senders nobody
remembered — a registrar forwarder, a helpdesk, a marketing tool — and
enforcement before that inventory is complete silently sends real mail to spam.

1. Put a person on `dmarc@tuveloz.com` and confirm the mailbox actually receives.
   An unread `rua` address makes the record decorative. **Receipt is confirmed
   (2026-08-16); naming the reader is not.**
2. Review the reporting window while at `p=none`. The eight available reports
   in the August 25–September 26 search were read September 26; sparse coverage,
   recent unsigned failures, and owner sender confirmation still limit the
   enforcement decision. Continue reviewing new reports rather than repeating
   this completed eight-file review.
3. Workspace sender repaired September 4: Google SPF and 2048-bit DKIM are
   configured, with one received message passing SPF, DKIM, and DMARC. Continue
   checking aggregate reports before enforcement.
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
