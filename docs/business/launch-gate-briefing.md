# Launch gate briefing — what each gate asks, who signs, what already exists

- **Status:** active
- **Owner:** hello@tuveloz.com
- **Last reviewed:** 2026-08-11
- **Applies to:** the 18 launch gates in `lib/launch-readiness.ts`

Turns eighteen blank gates into a review packet. For each gate: what it asks,
who is allowed to answer it, and what the code already implements — with file
references, so a reviewer confirms findings instead of interviewing someone from
scratch. `npm run readiness` confirms production currently holds **zero**
recorded decisions.

This document records evidence. It decides nothing. Gates are answered in
`/admin/launch-readiness`, each decision stores who made it and an evidence
reference, and **nothing here is a reason to flip a marketplace lock.**

## Read this first

**Only one gate is answerable by the owner alone.** The other seventeen name an
outside authority — insurance carrier, CPA, payment processor, official legal or
licensing source, security reviewer, or screening reviewer. Gathering evidence
does not remove that requirement; it only means the outside party reviews a
documented position rather than assembling one.

**Two gates cannot be answered honestly yet, whoever signs**, because the thing
they attest to does not exist:

| Gate | Blocker |
| --- | --- |
| `evidence_file_security_and_scanner` | `EVIDENCE_SCAN_PROVIDER` is `"unconfigured"` in `wrangler.jsonc:51`. The gate requires a real external malware scanner. |
| `provider_identity_and_business_verification` | `IDENTITY_VERIFICATION_PROVIDERS` is empty (`wrangler.jsonc:52`). |

Send either to a reviewer now and you are asking them to certify something
unbuilt. Configure first, then review.

**Every gate requires a validity date** (`requiresValidThrough` is true on all
eighteen), so each answer expires. Two launch gates already fail on a legal
review older than one year — see the recurring reviews in
[`../OPEN-ITEMS.md`](../OPEN-ITEMS.md).

## The gates

### Owner alone

**`entity_authority_domain_and_code`** — *business, required*
Confirm LLC records, ownership authority, domain control, code ownership,
contractor assignments, and essential vendor contracts.
*Existing evidence:* none in code — this is a records question, not a software
one. It is the one gate that needs nobody else, and therefore the cheapest to
close.

### Owner plus an official legal or licensing source

**`provider_onboarding_legal_requirements`** — *legal, required*
Map the official requirements applying to the application, agreements,
electronic acceptance, evidence requests, corrections, and appeals.
*Existing:* `config/provider-eligibility-matrix.json` — schema 0.11, 25
services, jurisdiction `US-MD-MontgomeryCounty`. Requirements resolve per
jurisdiction (`lib/provider-policy.ts`), and a jurisdiction must carry
`local_requirements_reviewed: true` through its whole chain before a service
opens there. **Caveat for the reviewer:** the service-code to legal-category map
in `lib/provider-compliance.ts` is best-faith and has not been confirmed against
sources.

**`customer_workflow_and_terms_requirements`** — *legal, required*
*Existing:* seven policy pages under `app/`, each SHA-pinned to an active entry
in `config/policy-releases.json` and verified on every build by
`tests/policy-release-integrity.test.mjs`. Terms and the Payment Policy were
re-released 2026-08-11 (`terms-2026-08-11-r3`, `payment-policy-2026-08-11`).

**`maryland_repair_duty_allocation`** — *legal, required*
*Existing:* `lib/maryland-repair-records.ts` implements Md. Comm. Law
§ 14-1001 — Customer's Rights text, consent before exceeding an estimate,
return of replaced parts, itemised lines with part condition and labour, and
test-drive certification.

### Security or privacy reviewer

**`evidence_file_security_and_scanner`** — *security, required* — **BLOCKED**
Restricted storage, access logs, download controls, backups, deletion, and a
real external scanner; a pending scan must keep evidence quarantined.
*Existing:* quarantine-until-clean is enforced — the compliance route refuses to
open a file unless the latest scan row reports `clean`, and a missing row blocks
too. *Missing:* the scanner itself. `EVIDENCE_SCAN_PROVIDER` is `unconfigured`.

**`privacy_retention_and_data_rights`** — *privacy, required*
*Existing:* `app/privacy-center/` and `app/api/privacy-center/` including an
export route; the Privacy Policy is one of the seven pinned pages.

**`security_and_data_incident_plan`** — *security, required*
Assign the responsible person, escalation contacts, evidence-preservation steps,
account containment, legal notices, and vendor notification.
*Existing:* nothing filed. `docs/operations/` holds email authentication and Zeo
remote access only. **This is a document to write, not code to find.**

**`provider_expiration_reminder_delivery`** — *provider compliance, required*
*Existing:* `lib/provider-compliance-notifications.ts` and
`lib/appointment-reminders.ts`. The owner evidence pre-screen in
`lib/evidence-review-assistant.ts` can never auto-accept; its only automatic
action is a reversible bilingual correction request for a provably expired
document.

### Insurance carrier or broker

**`platform_and_service_insurance_bound`** — *insurance, required*
*Existing:* none in code. Every provider holds their own county registration,
general liability certificate, and business auto coverage where the service
requires it — that is provider-side, and does not answer platform coverage.

**`provider_evidence_and_insurance_matrix`** — *provider compliance, required*
Also needs an official legal source.
*Existing:* the eligibility matrix above. Services without both records stay
disabled, which is enforced rather than promised.

**`vehicle_incident_claims_and_stop_work`** — *safety and claims, required*
Also needs a legal source and the owner.
*Existing:* safety gates and stop-work exist in the service policy layer.
The incident plan itself is unwritten — same gap as
`security_and_data_incident_plan`.

### Payment processor

**`stripe_connect_business_model`** — *payments, required*
The processor must approve the actual marketplace model, not a description of it.
*Existing:* `lib/stripe-provider.ts:46-47` sets `fees_collector: "application"`
and `losses_collector: "application"` — the platform absorbs processing fees and
chargeback losses rather than passing them to providers. Live mode is locked
(`STRIPE_LIVE_MODE_ENABLED = false`).

### CPA or tax adviser

**`cpa_tax_mor_and_transaction_map`** — *tax and accounting, required*
Tax, merchant-of-record, fees, and ledger treatment.
*Existing:* one fee constant, one place — `CUSTOMER_SERVICE_FEE_RATE_BPS = 500`
and `CUSTOMER_SERVICE_FEE_NAME = "Customer Service Fee"` in
`lib/customer-fee.ts`, snapshotted onto each quote. The fee is added on top of
the provider's quote and never deducted from payout; providers keep 100% of what
they quote. **Known discrepancy to raise:** the database default for
`customer_fee_rate_bps` is 1000 while the code constant is 500. Live writes
always pass 500, so it is latent, but a row inserted without an explicit value
would carry the wrong rate.

**`checkout_fee_receipt_copy`** — *payments, required* — also needs a legal source
*Existing:* the fee has one canonical name across every surface, enforced by
`tests/customer-fee-consistency.test.mjs`, which fails the build if a second name
appears anywhere a person can read it.

**`cancellation_refund_no_show_policy`** — *operations, required*
Needs a legal source, a CPA, and the processor.
*Existing:* the Payment, Cancellation and Refund Policy — `app/payments/page.tsx`,
pinned, re-released 2026-08-11.

### Screening or compliance reviewer

**`screening_or_no_screening_position`** — *screening, required*
Also needs an official legal source.
*Existing:* the position is already stated publicly and must be reviewed as
written. Terms section 4: Tuveloz does not run criminal background checks on
providers, their employees, or their trainees, and being listed is not a
character endorsement. The gate is about whether that position and its public
claims are defensible — not about adding screening.

### Optional

**`employee_and_trainee_provider_of_record`** — *future provider pathways, optional*
Needs a legal source, insurance, and a CPA.
*Existing:* referenced in `lib/provider-eligibility-engine.ts` and the admin
compliance route. Optional, and it touches the independent-contractor
classification — read the never-build list in [`../../CLAUDE.md`](../../CLAUDE.md)
before treating it as ordinary product work.

## Suggested order

1. **`entity_authority_domain_and_code`** — nobody else required.
2. **Write the two missing documents** — the security and data incident plan, and
   the vehicle incident, claims and stop-work plan. Both are gates whose evidence
   is a document that does not exist yet, and neither needs an outside party to
   draft.
3. **Configure the scanner and identity providers**, unblocking two gates.
4. **Then engage outside parties**, each with the relevant section above rather
   than a blank questionnaire.

Insurance, the CPA, the payment processor, and an official legal source are named
here because the gates name them, not as a substitute for the work above.
