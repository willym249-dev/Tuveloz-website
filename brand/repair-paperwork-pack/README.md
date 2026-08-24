# Maryland repair paperwork pack

- **Status:** active
- **Owner:** hello@tuveloz.com
- **Last reviewed:** 2026-08-24

The two documents a Maryland repair business owes its customer, as print-ready
forms. Built for people who are **not** on Tuveloz yet: a solo mobile mechanic
can print these tonight and be on better paper than most of the shops he
competes with, without applying to anything.

It exists for two reasons at once. It is useful on its own, and it is the
opener that makes provider outreach land — see
[`../../docs/business/revenue-before-launch.md`](../../docs/business/revenue-before-launch.md)
for why the free thing comes first.

## What is in it

| File | What it is |
| --- | --- |
| `estimate-authorization.html` | Written estimate and repair authorization: line items, the amount authorized, the returned-parts election, the customer's signature, and a log for approvals given later by phone |
| `invoice.html` | Itemized invoice: labor and parts separated, part number and condition on every part, mechanic on every labor line, the necessity statement and the test-drive certification |

Each prints on **both sides of one sheet** — the working form on the front, the
`Customer's Rights` notice and the acknowledgements on the back. That is
deliberate: the rights notice has to be on the document the customer is handed,
and cramming it onto one side made the form unusable.

## Printing it

Open the file in a browser and print to PDF or to paper. Letter size, margins
already set, no styling to adjust. Duplex on the long edge.

## Making a copy with someone's business on it

```bash
npm run pack:repair-docs -- --out ../packs/ace-mobile \
  --business "Ace Mobile Auto LLC" --registration "R-123456" \
  --phone "(240) 555-0142" --address "123 Example Rd" \
  --city "Silver Spring, MD 20901"
```

`--out` is relative to this folder. Anything omitted stays a blank line on the
form, so a business without a registration number yet still gets a usable pack.
The output directory is not committed; generate, send, delete.

## Where the words come from

Every statutory sentence — the `Customer's Rights` notice, the manufacturer
special-policy notice, the repair-facility responsibility notice, the necessity
statement, the test-drive certification — is imported from
[`../../lib/maryland-repair-records.ts`](../../lib/maryland-repair-records.ts),
which implements Md. Code, Com. Law § 14-1001. Nothing on the form is retyped.

`tests/repair-paperwork-pack.test.mjs` regenerates the pack and fails the build
if the committed files drift from that source, so a shop's printed form and the
marketplace's stored records cannot end up saying different things.

Regenerate after any change to the statute implementation:

```bash
npm run pack:repair-docs
```

## What this pack must never claim

It is a blank form, not a credential. Handing someone a pack says nothing about
whether they are insured, registered, or approved for anything — approval on
Tuveloz means evidence passed review, and a downloadable form is not evidence.
The test asserts the wording never says otherwise.

Do not describe it as legal advice, and do not answer "is my paperwork legal
now?" with anything other than *this is the form, confirm it with your own
adviser*. The disclaimer is on both documents for the same reason.
