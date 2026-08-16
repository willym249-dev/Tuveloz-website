# Document register

- **Status:** active
- **Owner:** hello@tuveloz.com
- **Last reviewed:** 2026-08-06

This folder tracks the real-world documents the business depends on — insurance
certificates, formation paperwork, licenses, registrations, vendor approvals,
signed agreements — **without storing the documents themselves**.

## Why the originals are not here

This repository is public source code. It is cloned onto build machines, read by
AI assistants, and browsable by anyone with access. Documents containing
personal or financial identifiers do not belong in it, ever. That includes
government ID scans, Social Security and EIN images, bank and routing numbers,
signed tax returns, and anything showing a customer's or provider's personal
details.

So the originals stay in your private storage, and what lives here is a **record
card**: a short Markdown file saying the document exists, who issued it, when it
expires, and where to find it. That gives you a searchable register you can hand
to an accountant, a lawyer, or an AI assistant, with none of the exposure.

## Filing a record card

Copy [`TEMPLATE.md`](TEMPLATE.md), fill it in, and name it after the document:

```
docs/records/general-liability-insurance.md
docs/records/llc-formation-maryland.md
docs/records/stripe-connect-platform-approval.md
```

Then add a row to the register table below.

## What belongs in the register

Anything with an issuer, an expiration, or a legal consequence if lost:

- Business formation and registration — LLC articles, operating agreement,
  Maryland SDAT registration, trade name filings
- Tax registrations — EIN assignment, Maryland state tax accounts
- Insurance — general liability, garage keepers, cyber, any policy the launch
  gates require
- Licenses and permits required to operate in Montgomery County
- Vendor and platform approvals — Stripe Connect business-model approval,
  Cloudflare account ownership, domain registration
- Professional engagements — accountant, attorney, insurance broker
- Signed agreements with providers, vendors, or partners

Several of these map directly to the 18 launch gates in
`lib/launch-readiness.ts`, which require an evidence reference, an issuer, and a
review date for each recorded decision. A record card is the natural place to
keep that reference.

## Register

Five cards opened 2026-08-16 against the `entity_authority_domain_and_code`
launch gate. Two are evidenced from this repository and public DNS; three are
blanks holding the shape of a document only the owner can supply. A blank card
is still useful — it names what is missing and what is waiting on it.

| Document | Type | Issuer | Expires | Card |
| --- | --- | --- | --- | --- |
| Domain registration — tuveloz.com | Registration | Porkbun | **unrecorded** | [card](domain-registration-tuveloz-com.md) |
| Code ownership and contributors | Ownership | — | Does not expire | [card](code-ownership-and-contributors.md) |
| Essential vendor accounts | Vendor | Several | Payment methods do | [card](essential-vendor-accounts.md) |
| LLC formation — Maryland | Formation | Maryland SDAT | Annual report does | [card](llc-formation-maryland.md) |
| EIN assignment | Tax registration | IRS | Does not expire | [card](ein-assignment.md) |

Still unfiled and named in [`../OPEN-ITEMS.md`](../OPEN-ITEMS.md): general
liability insurance, the operating agreement, any Montgomery County licence, and
Stripe's approval of the marketplace model. Each blocks a gate of its own.

## Keeping it current

Anything with an expiration needs a review before it lapses — an expired
insurance certificate or license can block provider activation, since expired
approvals fail the launch gate checks. Set a calendar reminder when you file the
card, and note the reminder in the card itself so the next person knows one
exists.
