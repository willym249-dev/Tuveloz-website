# Provider service requirements — source review and open questions

- **Status:** draft — source comparison complete; agency scope answers and launch review pending
- **Owner:** hello@tuveloz.com
- **Last reviewed:** 2026-10-05
- **Applies to:** Montgomery County provider signup; matrix schema 0.11

Distinguishes the documents currently requested by Tuveloz from what the
retrieved official sources establish. This is a review aid, not an agency
determination, legal opinion, provider approval, or authorization to open jobs.

## October 5 policy reconciliation

Terms section 4 and Provider Agreement section 9 previously said Tuveloz
requests only legally required documents. That did not match the existing
eligibility matrix and `lib/provider-policy.ts`: identity, insurance,
competency, personnel, tax and payment evidence can also be platform or
processor requirements. The October 5 proposed releases explain those
different sources in English and Spanish and keep requirements tied to the
selected services, work location and owner/employee role. No document,
eligibility threshold, service activation or payment rule is added or removed.

Both changed documents have new versions and paired English/Spanish hashes.
Earlier provider acceptance fixtures and customer consent records are kept
intact; they do not count as acceptance of the new Terms. Publication requires
approval of these exact revised pages. A published policy version would not
constitute legal review or permission to activate a service.

The remaining legal review still includes county/municipal service scope,
insurance coverage, classification, tax-reporting responsibility and timing,
and the refund/recovery terms. In particular, Provider Agreement section 12
currently says a W-9 is supplied at signup and Tuveloz issues applicable
1099s. Confirm that statement against the actual onboarding and reporting
arrangement before launch; this wording reconciliation does not resolve it.
Do not infer an agency answer, insurance coverage or launch approval from
these copy changes, or resend the existing inquiries below.

## Evidence and scope

Executed the existing service-matching, compliance, policy, and signup-document
modules against all 25 catalog entries at application commit `546e60a` (local
documentation head `8632e49`). No request, account, database, or external service
was modified. The private output is
`outputs/provider-requirements-snapshot-20260927.json`. All 25 services remain
disabled or prohibited. The seven existing document-presentation checks passed,
including every independently selectable service pair, shared-document
deduplication, and removal of paperwork when its service is removed.

| Source | What was checked September 27 |
| --- | --- |
| [County OCP registration guidance](https://www.montgomerycountymd.gov/office-consumer-protection/business-education-registration-unit-bear/motor-vehicle-repair-maintenance-towing) | Registration covers repair, maintenance and towing; mobile businesses are included. Repair applicants provide sample customer documents. ASE evidence is listed for an optional fee discount, not as a universal mechanic credential. The page lists an insurance certificate for towing registration; Tuveloz's wider insurance baseline is a separate platform requirement. |
| [Current online County Code 31A-1](https://codelibrary.amlegal.com/codes/montgomerycounty/latest/montgomeryco_md/0-0-0-138763) | The 2026 S-91 version broadly includes component work, examination, diagnosis, and fluid replacement. Towing has a separate definition. This text does not expressly decide every narrowly described Tuveloz service. |
| [Maryland Commercial Law 14-1001](https://mgaleg.maryland.gov/mgawebsite/Laws/StatuteText?article=gcl&section=14-1001) | The state automotive-repair definition concerns paid diagnosis or correction of malfunctions. It is not identical to the county definition. |
| [County DEP wash-water guidance](https://www.montgomerycountymd.gov/department-environmental-protection/contact-us/help-stop-water-pollution) | Commercial washing, including portable detailing, must contain wastewater or use an appropriate sanitary-sewer disposal route. The residential lawn-washing advice on the same page is not permission for commercial discharge. |
| [County Code Appendix F](https://codelibrary.amlegal.com/codes/montgomerycounty/latest/montgomeryco_md/0-0-0-156700) | Chapter 31A applicability varies by municipality. The chart itself calls for confirmation with the municipality. A county name or postal ZIP is not a verified municipal-boundary decision. |

## All catalog entries accounted for

`R` means the current code asks for county repair registration and the broad
definition supports retaining that question pending final scope review. It is
an inference, not individual OCP approval of each task. `T` is separate towing
registration. `U` needs a specific agency scope answer; lack of a county
document in the current matrix does not prove an exemption. `X` cannot be
selected as an enabled service. This table addresses county registration only;
other service documents and platform requirements remain in the matrix.

| Catalog code | Current county document | Review |
| --- | --- | --- |
| `general_auto_repair` | No eligible pathway | X — prohibited broad category |
| `photo_documentation_only` | None | U — only customer-requested photos and customer-provided facts; written OCP answer already required |
| `provisional_visual_observation_report` | None | U — distinguish factual observation from the statutory examination/diagnosis language |
| `provisional_obd_read_only` | Repair registration | R — clarify the raw-code-only limit |
| `provisional_wiper_blade_replacement` | Repair registration | R |
| `provisional_engine_or_cabin_air_filter` | Repair registration | R |
| `provisional_conventional_bulb_replacement` | Repair registration | R |
| `provisional_fluid_topoff_limited` | Repair registration | R |
| `provisional_12v_jump_start` | Repair registration | R — clarify jump-start-only work |
| `provisional_12v_battery_replacement` | Repair registration | R |
| `provisional_temporary_spare_install` | Repair registration | R |
| `provisional_basic_detailing` | None | U — exact cleaning scope and wastewater method matter |
| `sponsored_oil_filter_service` | Sponsoring provider's repair registration | R — sponsored employee pathway only |
| `battery_replacement` | Repair registration | R |
| `tire_repair_or_installation` | Repair registration | R |
| `basic_vehicle_diagnostics` | Repair registration | R |
| `mobile_car_wash` | None | U — environmental controls do not establish registration exemption |
| `motor_vehicle_ac_service` | Repair registration | R |
| `body_paint_refinishing` | Repair registration | R |
| `window_tint_installation` | Repair registration | R |
| `towing_or_storage` | Towing registration | T — clarify storage-only scope separately |
| `vehicle_lockout` | None; separate state locksmith documents | U — state credentials do not prove county exemption |
| `official_vehicle_inspection` | None; separate station/mechanic documents | U — confirm county registration alongside state inspection authority |
| `fuel_delivery` | None; separate fuel/fire/hazard evidence | U — confirm scope; the existing order-taking-office review also remains open |
| `ev_high_voltage_service` | Repair registration | R — no approved work scope; remains disabled |

The actual helper raises the repair-registration question for 17 codes,
including the prohibited broad category; the matrix has 16 eligible-pathway
repair-registration entries. It raises wash-water questions for the two washing/
detailing codes. Towing documents come from the separate matrix entry; absence
of the repair question is not absence of towing paperwork.

## Decisions that still need evidence

1. Obtain OCP's written scope answers before treating any `U` row as exempt.
   In particular, the existing photo-only policy note is a provisional position,
   not a received county determination. Do not activate the lane on that text.
2. Confirm municipality and exact service location before relying on the single
   county jurisdiction. The current reviewed-jurisdiction booleans do not
   resolve the variations shown in Appendix F. Do not remove an applicant's
   document based only on a postal town name or ZIP.
3. Review state paperwork duties separately. `marylandCustomerPaperwork`
   currently shares the county repair-category predicate; matching code does
   not establish that the two legal definitions are interchangeable. Retain
   customer protections while their exact legal basis is reviewed.
4. Keep legal credentials distinct from Tuveloz's insurance, competency, and
   identity standards. Do not tell every applicant that ASE certification or
   every platform insurance requirement is a county licensing rule.
5. Reconcile the written answers with the matrix, bilingual questions, and
   document checklist before an implementation change. Record the source,
   exact scope, date, reviewer, and any municipal limit. An agency scope answer
   does not verify an individual certificate or insurance policy.

No application copy, eligibility rule, policy hash, jurisdiction approval,
provider status, or launch control changed during this review.

## OCP inquiry — sent September 27, 2026

Recipient verified in the County's
[Business Education and Registration Unit page](https://www.montgomerycountymd.gov/office-consumer-protection/business-education-registration-unit-bear).
The owner approved the exact message recorded privately below. Sent once from the business Gmail
account at 7:20 a.m. Maryland time on September 27. A fresh pre-send search
found no message to the recipient. Gmail then confirmed "Message sent"; the
refreshed Sent search contained one matching message, and its full body,
sender, recipient and date were verified. Do not resend this inquiry.

Private screenshot: `outputs/county-inquiry-sent-20260927.png`. This confirms
sending, not receipt, a reply, or an agency determination. No fee, filing,
appointment, private document disclosure or paid work was authorized. Review
for a response on October 2; that is an internal checkpoint, not a promised
agency response date.

**From:** hello@tuveloz.com

**To:** OCP.Licensing@montgomerycountymd.gov

**Subject:** Tuveloz — registration questions before opening vehicle-service bookings

The exact sent body is retained privately in
`outputs/county-inquiry-sent-20260927.txt`; use that record or Gmail Sent when
checking what the agency received. The message asks about the marketplace,
narrow repair/maintenance work, non-repair services, specialty credentials,
and municipal applicability. It explains that bookings/payments are closed
and the planned 5% Customer Service Fee is added to the provider quote.
This paragraph is a summary using the current fee name, not a verbatim quote.
