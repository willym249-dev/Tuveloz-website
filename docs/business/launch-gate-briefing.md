# Launch gate briefing — what each gate asks, who signs, what already exists

- **Status:** active
- **Owner:** hello@tuveloz.com
- **Last reviewed:** 2026-09-26
- **Applies to:** the 18 launch gates in `lib/launch-readiness.ts`

Turns eighteen blank gates into a review packet. For each gate: what it asks,
who is allowed to answer it, and what the code already implements — with file
references, so a reviewer confirms findings instead of interviewing someone from
scratch. The authenticated production review page was refreshed on September 5,
2026: all eighteen review controls showed Pending, with no approved gate visible.
There are **seventeen required gates and one optional employee/trainee lane**.
Recheck the live page before recording a decision; the September 5 control
count is a dated snapshot. Start with the current
[`2026-09-25-prelaunch-reconciliation.md`](./2026-09-25-prelaunch-reconciliation.md)
before using the older evidence below.

This document records evidence. It decides nothing. Gates are answered in
`/admin/launch-readiness`, each decision stores who made it and an evidence
reference, and **nothing here is a reason to flip a marketplace lock.**

## Read this first

**Only one gate names the owner as its sole evidence authority.** The others
also name official sources or a specific reviewer, vendor, insurer, or tax
adviser. An official-source requirement is not a requirement to hire counsel;
that remains an owner choice. A source link also cannot substitute for an
actual insurance decision, vendor result, or review of the implemented workflow.

**The scanner's operational proof is verified; a genuine provider Identity
result remains incomplete.** Do not repeat completed setup or file tests:

| Gate | Blocker |
| --- | --- |
| `evidence_file_security_and_scanner` | September 6 manual and automatic synthetic-file results were confirmed in live production records September 26, and the current application accepted their retained receipts and audit binding. The owner task's latest run succeeded. Proof freshness expires October 6; security/capacity review remains separate. File safety does not establish document authenticity. |
| `provider_identity_and_business_verification` | Live Stripe Identity is configured with its dedicated key, signed webhook, and `stripe_identity` provider setting. The live review page still lacks a current approved session bound to a genuine provider's active personnel record. |

Reviewers can examine the implementation and scanner proof now. Final approval
still needs the genuine provider Identity result and each gate's review evidence.
Stripe business-account verification is separate
from a provider applicant's ID and selfie check.

Google Workspace mail loads again, and the business inbox contains activation
and payment receipts. Google Admin still requires a fresh account verification
before its exact subscription details can be recorded as gate evidence. See
the dated item in [`../OPEN-ITEMS.md`](../OPEN-ITEMS.md).

**Every gate requires a validity date** (`requiresValidThrough` is true on all
eighteen), so each answer expires. Two launch gates already fail on a legal
review older than one year — see the recurring reviews in
[`../OPEN-ITEMS.md`](../OPEN-ITEMS.md).

## The gates

### Owner alone

**`entity_authority_domain_and_code`** — *business, required*
Confirm LLC records, ownership authority, domain control, code ownership,
contractor assignments, and essential vendor contracts.
*Existing evidence:* the record cards separate technical observations from the
owner's formation, authority, contract, and contribution records.

| Part | Evidence |
| --- | --- |
| Domain control | The [domain record card](../records/domain-registration-tuveloz-com.md) and [email authentication runbook](../operations/email-authentication.md) hold the evidence. The September 4 Google SPF/DKIM repair supersedes this briefing's old registrar-only SPF observation. |
| Code ownership | The [contribution record](../records/code-ownership-and-contributors.md) identifies the scope and limits of Git metadata. Author labels do not establish ownership, licenses, or absence of outside contributions. |
| Essential vendors | Cloudflare, Porkbun, Google Workspace, Resend, and Stripe payments/Identity are recorded in the [vendor card](../records/essential-vendor-accounts.md). The active scanner is owner-operated ClamAV; Cloudmersive is a retained fallback. Account access, an active subscription, and approval of the business model are separate evidence. |

The [formation record](../records/llc-formation-maryland.md) now records the
September 26 official lookup: TUVELOZ LLC is Active and in Good Standing, formed
July 24, 2026. That completes the public registration check. Private formation
originals, ownership authority, and any contractor assignments remain separate;
keep originals outside the repository and references in the existing record
cards. Ask the owner to confirm contributions and any
required assignments from actual records; do not infer that answer from names
in commit history. A limited business-mail search on September 5 did not locate
formation or insurance documents, which does not establish that they are absent.

The owner can assemble this evidence while the vendor and specialist reviews
are pending.

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

**`provider_identity_and_business_verification`** — *provider compliance, required*
Also needs the identity vendor and an official legal or licensing source.
*Existing:* the dedicated Stripe Identity integration, adult and same-person
checks, guarded webhook recording, and isolated vendor test outcomes. The
[activation runbook](../PROVIDER_ACTIVATION_RUNBOOK.md) records the setup already
completed. *Still needed:* one consenting genuine applicant completes the
Tuveloz provider flow using their own ID and selfie; the signed vendor result
must match the current application/personnel record. Then review business
registration matching, corrections, retention, and public verification claims.
Do not create a fake provider or reuse the owner's Stripe business verification.

**`evidence_file_security_and_scanner`** — *security, required; review pending*
Restricted storage, access logs, download controls, backups, deletion, and a
real external scanner; a pending scan must keep evidence quarantined.
*Existing:* quarantine-until-clean is enforced — the compliance route refuses to
open a file unless the latest scan row reports `clean`, and a missing row blocks
too. Owner-operated ClamAV is selected. Manual and scheduled synthetic-file
scans completed September 6; their production records, receipts, and audit
binding were rechecked September 26 and accepted by the current application.
The September 26 task run and definition refresh also succeeded. Private
backup and isolated recovery checks are complete in the
[backup activation record](../operations/production-backup-activation.md).
*Still needed:* capacity and security review of the actual storage, access,
deletion, scanner, and recovery controls, plus current operational proof when
the decision is recorded. The existing file proof expires October 6; its refresh
checkpoint is October 4. Do not repeat first activation or treat a clean scan as
document-authenticity approval. Follow the
[scanner activation runbook](../operations/evidence-scanner-activation.md).

**`privacy_retention_and_data_rights`** — *privacy, required*
*Existing:* `app/privacy-center/` and `app/api/privacy-center/` including an
export route; the Privacy Policy is one of the seven pinned pages.

**`security_and_data_incident_plan`** — *security, required*
Assign the responsible person, escalation contacts, evidence-preservation steps,
account containment, legal notices, and vendor notification.
*Existing:* [`../operations/security-and-data-incident-plan.md`](../operations/security-and-data-incident-plan.md),
technically corrected September 26. It carries the data inventory, first-hour
sequence, private evidence custody, vendor list, and limits of account-containment
controls. **Owner inputs still needed:** the incident lead and deputy, a private
contact-register reference with checked reachability, and any contractual vendor
notification deadlines. Keep personal contact details outside this repository.
Owner and security-reviewer sign-off remain pending. The gate's official source
(Md. Code, Com. Law § 14-3504) is recorded in `lib/launch-readiness.ts`; whether
it applies to a given incident is a legal determination the plan routes to
counsel rather than answering.

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
*Existing:* [`../operations/vehicle-incident-claims-and-stop-work-plan.md`](../operations/vehicle-incident-claims-and-stop-work-plan.md),
drafted 2026-08-11, plus the `job_incidents` table — which already records the
stop time, injury and damage flags, evidence references, insurer notification,
and holds payment by default (`holdPayments` defaults to `"yes"`). **[OWNER]
items blocking the gate:** the carrier, broker, and out-of-hours claims number;
the policy's notification deadline; which incidents must be tendered; and
whether provider coverage tenders first. **The gate also requires the plan to be
tested, not only written.** The September 26 local rehearsal passed automatic
payment holds, stop-work recording, and rejection of customer/provider release
attempts through the real routes and local D1. A subsequent local simulation
also exercises real signed-token verification and owner resolution/hold release,
using temporary keys and synthetic key transport. Browser tests cover the owner
control. A deployed Access session, evidence attachment, insurer/notification
handling, and final plan review remain separate. The plan records the tested
scope; do not count local simulations as a completed gate or live payout proof.

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
they quote.

**The declared schema default was 1000 while the constant is 500** — fixed
2026-08-11 in `db/schema.ts`, and both are now pinned together by a test that
fails if they drift again. A second test pins the one path that writes a quote
(`app/api/jobs/route.ts`) to setting the rate explicitly, which is why the drift
never mispriced anything: the default was only reachable by code that forgot to
pass a value.

**An August 11 note records the D1 column default as 1000.** That database
default was not rechecked for this September 5 briefing. SQLite cannot
alter a column default in place, so changing it means rebuilding
`provider_quotes` — a table touched by fourteen migrations and carrying the two
real-only authorization triggers from `0041`. Rebuilding to change a fallback
that application code never reaches trades a real risk of dropping a launch
guard against a theoretical one. Worth raising at this gate so the CPA sees the
actual state: the application explicitly writes 500, and the historical default
needs a fresh schema inspection before anyone treats it as current evidence.

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

1. **Keep the verified scanner proof current.** The manual and automatic file
   tests are complete; see the activation record. The October 4 checkpoint
   precedes its October 6 freshness limit. A permitted upload refreshes proof
   only through the actual scanner and retained receipt; it never approves
   provider evidence automatically.
2. **Record business-mail evidence.** Mail currently loads and payment evidence
   exists; use a fresh Google Admin verification only when exact subscription
   detail is needed for a gate. No password belongs in chat or this repository.
3. **Complete a genuine provider Identity check.** The applicant uses
   [provider onboarding](https://tuveloz.com/provider-onboarding) in their own
   account. Their ID/selfie goes directly to Stripe's hosted flow. A successful
   check does not activate any service or payment.
4. **Complete the existing review packet.** The two incident plans already
   exist; fill their owner and insurer contact gaps and retain the rehearsal
   evidence. Collect formation/authority records, insurer decisions, processor
   approval, tax review, and applicable official-source mappings.
5. **Record only supported decisions.** Each authority supplies its own evidence
   reference, review or issue date, and validity date. Keep missing items pending.

## Questions ready for the required reviewers

These are preparation notes, not sent messages or claimed approvals. Supply
private originals through an appropriate private channel; public source code
should contain only record cards and sanitized evidence references.

| Recipient or evidence source | Material to review | Specific result needed |
| --- | --- | --- |
| Owner | Formation and ownership records, domain and vendor cards, contribution record | Confirm who can bind the LLC, where originals are kept, and any contributor assignments or licenses. |
| Official legal/licensing sources | Eligibility matrix, application and acceptance flow, repair records, published policies | Map each exact service and jurisdiction to applicable requirements and implemented duties; identify unresolved interpretations. |
| Insurance broker/carrier | Exact service list, independent mobile-provider model, incident plan | Written platform and provider coverage decisions, exclusions, effective/expiry dates, claims contacts, and notification duties. A provider's certificate alone does not prove platform coverage. |
| Stripe/payment processor | Connect configuration, separate transfers, refund/dispute and payout controls | An account-specific decision covering this marketplace model, supported services, loss responsibility, reserves, and payout controls. Bank linking alone does not supply that decision. |
| CPA/tax adviser | Provider quote, 5% customer fee, ledger, refunds, chargebacks and receipts | Confirm seller/merchant-of-record treatment, collection and reporting responsibilities, and treatment of every amount; list assumptions needing evidence. |
| Security/privacy reviewer and identity vendor | Scanner and Identity canaries, storage/access/deletion controls, privacy and incident plans | Verify the actual results, matching rules, retention/deletion, access boundaries and recovery exercises; state scope and limitations. |
| Screening/compliance reviewer | Existing no-criminal-background-check position and public wording | Confirm the claims match checks actually performed and document applicable source requirements. |

The County's [registration guidance](https://www.montgomerycountymd.gov/OCP/licensing/mvr_tow_main.html)
specifically includes mobile repair businesses. It was retrieved in this review;
use it as a source, then verify each actual provider's registration. Maryland's
[repair invoice statute](https://mgaleg.maryland.gov/mgawebsite/Laws/StatuteText?article=gcl&section=14-1003)
is a separate source for invoice content and retention. Neither source proves
Tuveloz's implementation or a particular provider compliant by itself.

Insurance, the CPA, the payment processor, and an official legal source are named
here because the gates name them, not as a substitute for the work above.
