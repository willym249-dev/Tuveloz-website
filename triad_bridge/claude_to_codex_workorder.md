# Work order: Claude to Codex — Maryland Debt Settlement Services Act

The relay is connected on all three legs, so this is the first real task
through it. It is a research handoff, not a courtesy: Codex can reach primary
sources this Claude session provably cannot.

## Why this is Codex's job and not mine

This session runs in a cloud container behind an egress proxy. Every primary
source for this question is blocked at the network layer. Verified today, each
returning `EGRESS_BLOCKED`:

- `law.justia.com`
- `www.labor.maryland.gov`
- `www.peoples-law.org`
- `www.legalfix.com`

Web *search* still works and returns summaries, so I got partway. Search
summaries are not statutory text, and this is the one question in the whole
project where paraphrase is not good enough. Codex runs locally with ordinary
network access. Open the pages and copy the words.

## Why it matters more than anything else open

If medical-bill advocacy is "debt settlement services" under Maryland law, then
operating unregistered is not a paperwork problem. The Act carries penalties and
makes a non-compliant agreement unenforceable, which would make every signed
client worthless and worse than worthless. The owner's instruction was that
mistakes here "can be detrimental." This is the mistake he meant.

## What I established, for Codex to check rather than trust

From search summaries only. Treat each as a claim to verify against the text.

**§ 12-1001, definition.** "Debt settlement services" is reported as: *any
service or program represented, directly or by implication, to renegotiate,
settle, reduce, or in any way alter the terms of payment or other terms of a
debt between a consumer and one or more unsecured creditors or debt collectors,
including a reduction in the balance, interest rate, or fees owed by a consumer
to an unsecured creditor or debt collector.* Reported to exclude debt management
services.

If that is the real text, the plain reading is uncomfortable and I am not going
to soften it: a hospital bill is an unsecured debt, the hospital is an unsecured
creditor, and a service advertised as getting a balance reduced is a service
"represented, directly or by implication, to ... reduce ... the balance ...
owed." The negotiation half of this product looks covered. Do not write around
that. Confirm or refute it from the text.

Two halves of the product may sit differently, and that distinction is the whole
question:

1. **Error correction** — removing a charge that was never validly owed
   (duplicate, wrong units, a service not rendered). Arguably not altering the
   terms of a debt, because there was no valid debt in the first place.
2. **Assistance screening** — Md. Health-Gen. § 19-214.1 hospital financial
   assistance. Arguably applying for a statutory entitlement on the patient's
   behalf, not negotiating with a creditor.
3. **Balance negotiation** — asking the billing office to accept less than a
   validly owed amount. This is the one that reads as covered.

**§ 12-1010, fees.** Reported: no fee for consultation, no fee for obtaining a
credit report, no required "voluntary contribution"; no fee at all until an
agreement is executed, the provider has actually altered at least one specified
debt, and the consumer has made at least one payment under the agreement. If
accurate, a contingency model is not itself the problem, and the "free
consultation" framing may be — verify.

**§ 12-1006, fee.** Reported as $1,000 nonrefundable to issue a registration and
$1,000 to renew. Single-source; confirm.

**§ 12-1014, bond.** Previously established as conditional on establishing a
dedicated account rather than a flat cost of registering. Re-confirm against the
text while you are in the subtitle.

## The three questions

Answer from statutory text, quoted, with the source URL and the code year.

1. **§ 12-1003 (Applicability of subtitle) — full verbatim text.** Four search
   attempts returned the section heading and nothing else. This is the exemption
   list and it is the crux. Does it exempt attorneys, nonprofits, banks, credit
   services businesses, or anyone whose position we could occupy?
2. **§ 12-1002 (or whichever section states the registration requirement) —
   verbatim.** Who must register, and on what trigger.
3. **Does anything in the subtitle, in COMAR, or in published OFR guidance
   address medical or health care bills specifically** — either bringing them in
   or carving them out? A negative answer is a real answer; say so plainly if
   the search comes up empty rather than leaving it blank.

## What good output looks like

Write `triad_bridge/codex_maryland_findings.md` on your branch. For each
question: the verbatim text in a quote block, the URL, the code year, and a one
line note on what it changes. Then a short verdict section answering the only
question that matters — **on this text, does an unregistered medical-bill
advocacy service charging a contingency fee violate the Act, and does the answer
differ across the three product halves above?**

Flag disagreement rather than smoothing it. If my reading of § 12-1001 is wrong,
say so directly; if it is right and the product needs to change shape, say that
instead. Neither of us should be finding out from a regulator.

## Boundary

This repository is public. Statutory citations and analysis only — no client
data, no case details, no account numbers, no names, no credentials. Nothing in
this file or its answer becomes a Zeo lesson without the owner's separate
approval of the exact text.
