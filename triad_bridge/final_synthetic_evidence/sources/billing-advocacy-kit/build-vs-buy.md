# Build or buy — the actual rule for handling client documents

You asked the right question. Here is the rule, and it means you can build most of this.

---

## The rule in one line

**A BAA binds a third party who handles the data for you. Hardware you own has no third party to bind — but that is the *only* thing it settles.**

A BAA is a *contract*, not a security control. It encrypts nothing. Removing the outside company removes the need for that particular contract — and nothing else.

**Every other obligation survives.** Whether HIPAA reaches you at all is a question for healthcare privacy counsel, not for this document. Maryland's confidentiality of medical records rules, the personal information and online data protection statutes, the FTC Health Breach Notification Rule, breach notification duties, key management, backup integrity, sanitisation, and endpoint security all apply regardless of who owns the disk. **Owning the hardware is not a compliance position.**

## What that means in practice

| Where the data sits | BAA needed? | Why |
| --- | --- | --- |
| Encrypted drive on a machine you own, no cloud sync | **No vendor to sign one with** | Settles the vendor-contract question only. One control, not a compliance position — every other duty stands |
| Your own server in your own home | **No vendor to sign one with** | Same, and it adds uptime, patching, and backup duties you now own |
| Rented cloud — Cloudflare, AWS, Google, Dropbox | **Yes** | They process your clients' records for you |
| A form or e-sign vendor | **Yes** | It passes through their systems |
| A model that only ever sees de-identified working data | **Reduced, not eliminated** | Lower risk, not zero. Use minimum necessary data, and prefer a vendor with retention and deletion terms you have actually read |

**Your existing Cloudflare stack is out for identified records.** Cloudflare signs BAAs **only on Enterprise plans**, and only for specific covered services. Workers, D1, and R2 on a self-serve plan cannot hold identified client documents. That was worth checking before you built on it.

## The layered answer, because "do I even need HIPAA" comes first

1. **Whether HIPAA reaches this work is an open question for counsel, and this document does not answer it.** The Privacy Rule binds providers, plans, clearinghouses, and their business associates, and an advocate hired by a patient is not obviously any of those — but the answer turns on the actual role, the data flows, and who you contract with, all of which can change it. **Do not conclude that no BAA is required.**
2. **That is not a reason to relax.** State breach-notification law reaches you regardless, a client handing over hospital records does not care about the definitional argument, and if you ever contract with a provider rather than a patient you become a business associate overnight.
3. **So the standard is: behave as though it binds you, and say so in writing.** That is already in the client agreement, and it is a selling point rather than a burden.

---

## The architecture that follows

Design so that almost nothing identified ever exists in a system you did not build.

**1. Minimise the identified surface.** The audit needs codes, quantities, dates of service, charges, and EOB figures. It does not need a name. Identified documents need to exist only long enough for you to read them and strip identifiers.

**2. Identified originals live on hardware you control.** Full-disk encrypted, MFA, no cloud sync, encrypted backup kept separately. That removes one vendor from the picture. **It does not make the arrangement adequate** — sanitisation, backup integrity, recipient verification, deletion, and incident response are all still unbuilt, and none of them are solved by owning the disk.

**3. Everything you build handles de-identified working data only.** File number, line items, codes, amounts, dates.

**Do not read that as "so it can run anywhere."** Removing direct identifiers is risk reduction, not anonymisation — exact dates, a named facility, a rare code, and combinations of the three can still point at a person. Stripping fields does not by itself discharge obligations under state confidentiality law, the FTC Health Breach Notification Rule, vendor terms, breach notification, key management, backup, or endpoint security. It lowers the stakes of a mistake; it does not remove the duty of care.

**4. The upload is the one hard part, and it is solvable without buying anything.** A file has to travel from a stranger's phone to your machine.

- **Buy:** a vendor whose terms you have actually read, with a signed agreement, defined retention and deletion, and a named subprocessor list. Price it by quote, not by assumption.
- **Build:** an upload page that encrypts in the browser before the file leaves. This reduces what the host can see. **It does not by itself remove the need for vendor review or a BAA** — the host still processes metadata and traffic, key management becomes your problem, and a lost key is unreadable client records. Do not treat browser encryption as a compliance answer.

The second is more work and the failure modes are yours — a key you lose is client documents you cannot read. If you build it, the key management is the whole problem, not the upload.

**5. What you should not build:** your own e-signature system. Signature validity is a legal question, not a technical one, and a homemade one is the wrong thing to be defending later. Either buy one with a BAA or use paper. Paper avoids one vendor and creates its own obligations — storage, sanitisation, destruction, and chain of custody. It is not free of duty.

---

## Pre-launch gates — none of this opens until all are closed

- [ ] Provider-specific Maryland authorisation and redisclosure rules reviewed by counsel
- [ ] Maryland personal information and online data protection analysis completed
- [ ] Vendor and subprocessor contracts in place, retention and deletion terms read
- [ ] Least-privilege access defined, with a named list of who can open a file
- [ ] Media sanitisation and destruction procedure written and tested
- [ ] Backups configured, restore actually tested, backup deletion covered by the schedule
- [ ] Written incident response procedure, with breach notification obligations identified
- [ ] Deletion schedule implemented and demonstrable
- [ ] Recipient verification — a checked process for confirming who a document is going to
- [ ] Written outside-employment review completed with the current employer

## What an encrypted laptop does not do

It does not, on its own, satisfy HIPAA where HIPAA applies, the FTC Health Breach Notification Rule, Maryland confidentiality and personal-information law, vendor obligations, breach notification duties, key management, backup integrity, or endpoint security. It is one control among several, and the cheapest one. Treat the rest as open work rather than solved.

## What this actually costs

The earlier version of this document said "possibly nothing" and put the figure at $20–50 a month. **That was wrong and it has been withdrawn.** It counted one subscription and ignored the business.

A real pre-launch cost list, none of which is optional:

| | |
| --- | --- |
| Your labour | The dominant cost. Hold time, review time, drafting, follow-up |
| Legal | Maryland counsel on classification, agreements, and privacy — the largest cash item |
| Insurance | Professional liability and cyber. Get quotes before assuming a number |
| Secure intake, storage, and disposal | Vendor terms actually read, retention configured, sanitisation and destruction that works |
| Qualified coder review | Anything touching coding needs someone qualified. Budget it per case |
| Vendor and subprocessor diligence | Contracts, retention terms, subprocessor lists |
| Incident readiness | A written procedure, and reserve against having to use it |
| Phone, postage, recorded delivery | Small, constant, real |
| Acquisition | What it costs to reach one consumer |

**Do not plan on this being nearly free.** If the number has to be tiny for the idea to work, that is information about the idea.


---

**Before stating anything here as fact, read [`claims-register.md`](claims-register.md).** The Cloudflare Enterprise-only BAA limitation is verified; the conclusion that HIPAA does not directly bind a patient-hired advocate is reasoned from the rule's scope, not a determination.
