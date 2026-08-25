# Intake and document security

## The one rule

**No medical record, bill, EOB, or insurance card ever arrives by ordinary email or text message.** Not once, not "just this file," not because the client sent it that way first. This is the single failure that ends this business, and it is entirely preventable.

When a client emails a bill anyway — and they will — do not reply quoting it. Treat it as an incident, not an inconvenience: record what arrived and when, tell the client it was received insecurely, and follow the sanitisation and deletion steps in your written incident procedure. **Deleting it from your inbox and trash is not remediation** — copies may persist in server-side stores, backups, indexes, and the sender's own sent folder.

## Are you actually bound by HIPAA?

Probably not directly. The Privacy Rule binds health care providers, health plans, clearinghouses, and their business associates. An advocate the *patient* hires is generally none of those — you act for the individual, not for a covered entity.

That does not help you, for three reasons. State privacy and breach-notification laws reach you regardless. If you ever contract with a provider or plan rather than a patient, you become a business associate overnight. And a client handing over hospital records does not care about the definitional argument — they care that you protected it.

So the position to take, and the one written into the pilot terms: **we hold ourselves to it by contract.** That is not a compliance position — whether HIPAA, PIPA, MODPA, or the FTC Health Breach Notification Rule reach this work is an open question for counsel, and a contractual promise does not answer it. Say it out loud in the sales conversation.

## Four controls that are necessary and nowhere near sufficient

Any vendor touching client documents needs all four. Three out of four is a no. **But four out of four does not make the arrangement secure or compliant** — these are table stakes for a vendor, not a definition of secure. The gates below are unbuilt and each is required.

| Control | What it means |
| --- | --- |
| **A signed BAA** | The vendor signs a Business Associate Agreement. No BAA means no compliant use no matter how the product is built. |
| **Encryption** | AES-256 at rest, TLS 1.2 or higher in transit. |
| **Access control with MFA** | Multi-factor on every account that can reach a document. This is becoming mandatory for systems touching electronic PHI, so build it in now rather than retrofitting. |
| **Audit logs** | A record of who opened which file and when. This is what you produce if anyone ever asks. |

## What to actually use

You need three capabilities. One vendor can cover two of them.

1. **A secure upload the client uses** — a form or portal with a HIPAA tier and a BAA. This is where documents enter. Never an email attachment.
2. **Storage** — Google Workspace, Microsoft 365, Box, or ShareFile all sign BAAs on the right plan. Dropbox only on Business Advanced or higher; the standard Business and Plus plans do **not** include a BAA and must not hold client documents.
**Send the pilot terms.** That is the only engagement document — the records authorization, appeal designation, and fee agreement are quarantined and must not be used.

Check the plan tier, not the brand name. The same vendor is compliant on one tier and forbidden on the one below it, and that is exactly the mistake people make.

## The intake sequence

1. **First contact.** Take the story, not the documents. What happened, roughly what they're being asked to pay, how many separate bills they've received, whether anything has gone to collections, and whether a denial letter exists.
2. **Screen for financial assistance before anything else.** Household size and income, roughly. If they are likely to qualify, say so on this call and tell them Dollar For does it free. You will lose some of these. Take the loss — it is the reason the free-competition objection never lands on you.
**Send the pilot terms.** That is the only engagement document — the records authorization, appeal designation, and fee agreement are quarantined and must not be used.
4. **Send the upload link** with an explicit list: itemized bill if they have it, every summary statement, all EOBs, the insurance card front and back, every denial letter, and any collection notice.
5. **Open the file** with a call log started and the appeal deadline diaried if a denial exists. Deadline first, before analysis — determined from the controlling notice or plan document and verified by a person, never assumed from the date on a letter.
6. **Run Call 1** on every account to get the real itemized bills.
7. **Audit** once the itemization arrives.
8. **Consumer reviews, signs, and submits** the candidate-question packet for each biller.
9. **Close out**: the written report to the consumer, and destruction of records on the schedule in the pilot terms. There is no invoice — the pilot charges nothing.

## De-identify before any AI touches a bill

This is the most important control in the workflow, and it is not optional. It **reduces** the risk of sending documents to a model. It does not eliminate it, and it does not settle the vendor question on its own.

**Strip every direct identifier before the documents go to any model** — Claude, GPT, Zeo, any of them. Remove the name, date of birth, address, phone, medical record number, account number, and insurance member ID. Replace them with your internal file number.

It works because **the audit does not need identity.** Finding a duplicate code, an unbundled pair, a discharge-day room charge, or an impossible quantity does not require knowing whose bill it is. What the analysis actually needs is: codes, quantities, dates of service, charge amounts, and the EOB figures.

Why this matters concretely: **OpenAI will not sign a BAA for Free, Plus, Pro, or ChatGPT Business.** A BAA is available for ChatGPT Enterprise or Edu on a sales-managed account, and for the API platform — the API route does not require an enterprise agreement, and a BAA can be requested directly. De-identifying lowers the stakes considerably, but it does not make the vendor question disappear: **do not send raw or hand-redacted patient records to consumer Claude, GPT, or Zeo accounts.** Send the minimum necessary, prefer a vendor whose retention and deletion terms you have actually read, and keep this on the list for healthcare privacy counsel rather than treating it as closed.

Keep the identified copy in the BAA-covered storage and nowhere else. The de-identified working copy is what moves.

**Zeo gets even less.** The deadline watch needs a file number and a date. It does not need a bill, a name, or a diagnosis. Give it nothing else, and no patient data ever lands on that machine.

## Retention and destruction

Keep what you need while the account is live and for a defined window after — 24 months is the proposed default in the agreement. Then destroy it and say so. Holding records forever is pure downside: no revenue, growing breach exposure.

Note the exception before you automate deletion: **do not destroy anything connected to a live dispute, appeal, or complaint.** Suspend the schedule for that file until it closes.

## Not implemented — every one of these is a gate, and all are open

- [ ] Maryland personal information and online data protection analysis (PIPA / MODPA)
- [ ] Provider-specific Maryland authorization and redisclosure rules, reviewed by counsel
- [ ] Vendor and subprocessor contracts, with retention and deletion terms read
- [ ] A written data map — what is held, where, for how long, who can reach it
- [ ] Necessity analysis for sensitive health categories
- [ ] Consumer notice and rights procedure
- [ ] Media sanitisation and destruction, tested
- [ ] Backups configured and restore tested, with backup deletion covered
- [ ] Written incident response procedure
- [ ] Demonstrable deletion on schedule
- [ ] Recipient verification before anything is sent

**No raw or pseudonymised health data goes into a consumer Claude, GPT, or Zeo account** while these are open.

## Devices

Full-disk encryption on every machine that touches a file. MFA on every account. No client documents on a personal phone. Nothing in a downloads folder. A screen lock that actually engages. This is unglamorous and it is the part that fails in practice.

---

**Before stating anything here as fact, read [`claims-register.md`](claims-register.md).** It marks every claim in this kit as verified, secondary, or not verified, and lists the six open questions going to the lawyer.
