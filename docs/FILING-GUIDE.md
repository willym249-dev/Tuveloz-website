# Filing guide — where each document goes

This is the rule for putting a new document somewhere it can be found again.
Read this before adding a file to `docs/`.

## The one rule that matters most

**This repository is public source code. Never commit a document that contains
personal or financial identifiers.**

That means no government ID scans, no Social Security or EIN images, no bank
account or routing numbers, no signed tax returns, no customer or provider
personal data exports, no API keys, and no photographs of documents that show
any of the above.

Those originals live outside this repository. What lives here is a **record
card** that says the document exists, who issued it, when it expires, and where
to find it. See [`records/README.md`](records/README.md).

If you are unsure whether something is safe to commit, it is not. File a record
card instead.

## Where things go

| Folder | What belongs there | Examples |
| --- | --- | --- |
| `docs/business/` | Plans, market research, pricing decisions, partner and provider programs, growth strategy | Founding provider program terms, pricing rationale, market notes |
| `docs/legal/` | Policy source text, agreement drafts, compliance analysis, regulatory research | Terms review notes, Maryland repair-law research, insurance requirement analysis |
| `docs/operations/` | Runbooks, procedures, deployment and environment guides, incident write-ups | Provider activation runbook, staging setup, on-call procedures |
| `docs/product/` | Feature specifications, design decisions, technical interface contracts | Evidence scanner callback contract, flow specs, decision records |
| `docs/records/` | Record cards for real-world documents held elsewhere | Insurance certificate card, LLC formation card, Stripe approval card |
| `brand/` | Logos, ad and reel source files, outreach kits, social media assets | Already organized; see `brand/social-media-kit/README.md` |

Root-level `README.md` and `DEPLOYMENT.md` stay where they are — they are the
entry points people expect to find at the top of a repository.

## Naming files

Use lowercase words separated by hyphens, ending in `.md`:

```
docs/business/founding-provider-pricing.md
docs/legal/maryland-repair-duty-research.md
docs/operations/incident-2026-03-stripe-webhook-outage.md
```

When a document is tied to a date or an event, put the date in the name in
`YYYY-MM` or `YYYY-MM-DD` form so the folder sorts chronologically. Do not use
spaces, capitals, or version suffixes like `-final-v2-real-final`. Git already
tracks versions; the filename should describe the thing, not its revision.

The four existing files in `docs/` use SCREAMING_CASE from an earlier
convention. They are staying as they are so that links and tests keep working.
New files use lowercase-hyphens.

## The header every document needs

Start every document with a title and a short block that tells a reader — human
or AI — what they are looking at and whether it is still true:

```markdown
# Founding provider pricing

- **Status:** active
- **Owner:** hello@tuveloz.com
- **Last reviewed:** 2026-08-06
- **Applies to:** provider onboarding, Montgomery County launch

One or two sentences saying what decision this document records and who needs it.
```

Use `Status: active`, `draft`, or `superseded`. When a document is superseded,
say so in the header and link to what replaced it rather than deleting it —
the history of a decision is often the useful part.

## After you add a document

Add a line for it in [`README.md`](README.md), the documentation index. A
document nobody can find from the index does not really exist. The index is
short on purpose: one line per document saying what question it answers.
