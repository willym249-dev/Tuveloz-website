# De-identification procedure

The rule was stated in the intake document. This is the mechanism.

---

## Be honest about what this is

**This is not HIPAA Safe Harbor de-identification, and it should not be described as such.** Safe Harbor requires stripping all dates more specific than the year — which would destroy the audit, because a discharge-day room charge, a quantity impossible in the time elapsed, and a charge dated outside the stay are all findings that depend on exact dates.

What this is: **pseudonymisation and minimisation** — removing direct identifiers and replacing them with a file number. It reduces risk. **It does not make the data unidentifiable**, and it is not a legal status. Exact dates, a named facility, an unusual procedure, and combinations of the three can still point at one person. Whether HIPAA or Maryland law reaches this work at all is an open question for counsel, not something this procedure settles.

Do not let anyone, including GPT or Zeo, describe the output as "de-identified," "anonymised," or "HIPAA de-identified." It is **pseudonymised working data**, and it remains health data.

---

## Strip these, every time

| Remove | Replace with |
| --- | --- |
| Patient name, and any family member's name | `PATIENT` |
| Date of birth | `[DOB REMOVED]` |
| Street address, city, ZIP | `[ADDRESS REMOVED]` |
| Phone, email | `[REMOVED]` |
| Medical record number | `[MRN REMOVED]` |
| Account / guarantor / statement number | your file number |
| Insurance member ID, group number, subscriber ID | `[MEMBER ID REMOVED]` |
| Social security number, driver's licence | `[REMOVED]` — and flag it, it should not be on a bill |
| Physician and staff names | `PROVIDER A`, `PROVIDER B` — keep them distinct from each other |
| Facility name | `FACILITY` for analysis; keep the real name only in your own notes |
| Barcodes, QR codes, portal URLs, claim-lookup links | delete the image entirely |

## Keep these — the audit is worthless without them

Codes (CPT, HCPCS, revenue), quantities and units, **exact dates of service**, admission and discharge dates and times, charge amounts, EOB allowed/paid/patient-responsibility figures, place of service, and the modifier on any line.

---

## How to do it

**Do not build a regex stripper for this.** Automated removal misses identifiers in unexpected fields, mangles OCR output, and fails silently. **A manual pass is also fallible** — people miss things, particularly when tired or working at volume — so it is checked by a second person before anything leaves, and treated as a control that can fail rather than one that cannot. Revisit that only when volume genuinely forces it, and then test it adversarially before trusting it.

**The procedure:**

1. Open the identified original from the encrypted store.
2. Retype or transcribe the line items into a clean working table. **Transcribing beats redacting** — you cannot accidentally carry across a header, a footer, a watermark, or a barcode that you never copied in the first place.
3. Run the checklist above against your working table.
4. **Read it once more, out loud, looking only for names and numbers.** This catches what the checklist misses.
5. Save it as `[file-number]-working.md`. That file is what goes to a model.

**If you are pasting a screenshot instead — do not.** Images carry headers, footers, sidebars, and barcodes you did not intend to send, and you cannot check an image the way you can check text.

---

## What it looks like

**Before**

> Jordan R. Alvarez, DOB 03/14/1978, MRN 8837412, 402 Larkspur Ct, Bowie MD
> Acct 4471-2299 · Member ID XZH449102773
> 04/02/2026 · 0250 · Pharmacy · IV ondansetron 4mg · qty 6 · $312.00
> 04/03/2026 · 0120 · Room & board, semi-private · qty 2 · $4,900.00
> Attending: Dr. Sarah Okafor

**After**

> PATIENT · [DOB REMOVED] · [MRN REMOVED] · [ADDRESS REMOVED]
> File 2026-001 · [MEMBER ID REMOVED]
> 04/02/2026 · 0250 · Pharmacy · IV ondansetron 4mg · qty 6 · $312.00
> 04/03/2026 · 0120 · Room & board, semi-private · qty 2 · $4,900.00
> Attending: PROVIDER A
>
> Context for analysis: admitted 04/02, discharged 04/03 at 10:15.

Every candidate question is still available: the room-and-board quantity against a one-night stay, the unit count, the charge dated the discharge day. **Direct identifiers are gone; identifiability is reduced, not eliminated** — this record still describes one real admission on exact dates.

---

## What each system gets

| | Gets | Never gets |
| --- | --- | --- |
| **Claude / GPT** | The de-identified working file | The identified original, a screenshot of a bill, a name |
| **Zeo** | File number and dates only | Any bill content at all |
| **Encrypted local store** | Everything identified | — |

---

## The residual risk, stated plainly

A rare procedure on a specific date at a named facility can in principle point at one person even with the name removed. That is why the facility name comes out for analysis, and it is why this is called risk reduction rather than anonymisation. At the volume you are working, with the facility stripped, it is a small risk honestly described — which is the most anyone can offer.

---

**Before stating any rule here as fact, read [`claims-register.md`](claims-register.md).**
