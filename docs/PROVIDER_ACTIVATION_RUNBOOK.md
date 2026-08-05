# Provider Activation Runbook (owner)

Internal operations doc. How to take the provider side from "applications open"
to "qualifying providers go active for real." Not public copy.

## What is already true (code-side, shipped)

- Provider applications are open. Signup is simplified (autosave, optional
  phone, minimal solo fields).
- The Stripe **Identity** live-mode code lock is released
  (`STRIPE_IDENTITY_LIVE_MODE_ENABLED = true` in `lib/stripe.ts`). Identity is
  still fail-closed on the missing secrets below.
- The identity readiness gate now passes on **one** vendor-proven path (Stripe
  Identity today) instead of demanding a second non-Stripe vendor.
- Payments stay code-locked (`STRIPE_LIVE_MODE_ENABLED = false`), marketplace
  mode stays `onboarding_only`, and customer job posting stays paused. None of
  the steps below touch those.

## The one-paragraph truth

A provider only auto-verifies to **active** when the rules engine finds at least
one of their services **eligible**. A service is eligible only when it has a
written **activation record**, and the admin endpoint refuses to write that
record until `runtimeProviderActivationPrerequisitesDecision().approved` is
true. That decision is `providerOnboardingApproved && transactionPilotApproved`
with the live-payment checks excluded — so **both** launch stages must be green.
On top of that, the service's `launch_state` must be `enabled` in the config
catalog. So the path is: secrets → light two runtime canaries → record every
required launch gate (both stages) → enable + activate each Open-tier service.
Then activation is automatic per provider.

Nothing here can be faked by software or an owner checkbox — several gates need
an outside party (insurer, CPA, payment processor, security/screening reviewer)
and at least one needs counsel review. That is by design.

---

## Phase 1 — Cloudflare secrets

Set as encrypted Worker secrets. All are fail-closed: a wrong or missing value
blocks activation but never opens payments.

**Stripe Identity (live):**
```bash
npx wrangler secret put STRIPE_IDENTITY_SECRET_KEY          # dedicated rk_live_ Identity key, NOT the payments key
npx wrangler secret put STRIPE_IDENTITY_WEBHOOK_SECRET      # whsec_ for the Identity webhook destination only
npx wrangler secret put STRIPE_IDENTITY_VERIFICATION_FLOW_ID # vf_ for a LIVE flow: gov doc + live capture + matching selfie; DL/ID/passport only; ID-number/email/phone OFF
npx wrangler secret put STRIPE_IDENTITY_ALLOW_LIVE_MODE     # the literal string: true
npx wrangler secret put IDENTITY_VERIFICATION_PROVIDERS     # include stripe_identity
```

**Evidence malware scanner (Cloudmersive):**
```bash
npx wrangler secret put EVIDENCE_SCAN_PROVIDER        # the literal string: cloudmersive
npx wrangler secret put CLOUDMERSIVE_API_KEY          # Cloudmersive advanced virus-scan API key
npx wrangler secret put EVIDENCE_SCAN_WEBHOOK_SECRET  # 32+ characters
```

Redeploy after setting secrets. (`owner_access`, `account_auth`,
`email_delivery`, and `private_evidence_storage` are already configured — the
site runs — but re-confirm them in `/admin/launch-readiness` if the dashboard
flags any.)

## Phase 2 — Light the two runtime canaries

Configuration strings alone never pass these gates. Each needs one real result
recorded through its guarded pipeline.

1. **Identity canary** — after Phase 1 deploys, complete **one real Stripe
   Identity verification yourself** at `/provider-onboarding`. The signed
   webhook writes a current approved live-mode session bound to a guard-stamped
   active personnel record. That single record is the canary.
2. **Scanner canary** — upload **one real evidence file** so Cloudmersive
   returns a terminal result that lands in D1 with its consumed pending request
   and authenticated-scanner audit event.

Both are visible as "passed" on `/admin/launch-readiness` once done.

## Phase 3 — Record every required launch gate

At `/admin/launch-readiness`, record an **approved** decision for each required
gate below. Every approval needs, per listed authority: an evidence reference,
the reviewer/issuing org, an approval date, and (where noted) a valid-through
date so expiration re-blocks readiness. Gates that list an official source
accept **only** the URL shown.

**Provider-onboarding stage:**

| Gate key | Authority | Accepted official source |
|---|---|---|
| `entity_authority_domain_and_code` | TUVELOZ owner | — |
| `provider_onboarding_legal_requirements` | owner + official legal source | mgaleg …gcl §21-106 |
| `provider_evidence_and_insurance_matrix` | official legal source + **insurer** | montgomerycountymd.gov OCP mvr_tow |
| `provider_identity_and_business_verification` | identity provider + official source + **security reviewer** | dat.maryland.gov services |
| `privacy_retention_and_data_rights` | official source + **security reviewer** | oag.maryland.gov data-privacy |
| `evidence_file_security_and_scanner` | **security reviewer** | — |
| `security_and_data_incident_plan` | owner + official source + **security reviewer** | mgaleg …gcl §14-3504 |

**Transaction-pilot stage** (required even for provider activation; only the
live-payment switches are excluded):

| Gate key | Authority | Accepted official source |
|---|---|---|
| `customer_workflow_and_terms_requirements` | owner + official source | mgaleg …gcl §13-301 |
| `maryland_repair_duty_allocation` | owner + official source | mgaleg …gcl §14-1008 |
| `platform_and_service_insurance_bound` | **insurance broker/carrier** | — |
| `stripe_connect_business_model` | **payment processor** | — |
| `cpa_tax_mor_and_transaction_map` | **CPA / tax adviser** | — |
| `checkout_fee_receipt_copy` | official source + **CPA** | mgaleg …gcl §14-1003 |
| `cancellation_refund_no_show_policy` | official source + **CPA** + **processor** | mgaleg …gcl §13-301 |
| `vehicle_incident_claims_and_stop_work` | official source + **insurer** + owner | mgaleg …gcl §14-1008 |
| `provider_expiration_reminder_delivery` | owner + **security reviewer** | — |
| `screening_or_no_screening_position` | official source + **screening reviewer** | ftc.gov background-checks |

`employee_and_trainee_provider_of_record` is **not required** for an
independent-owner-only launch — leave it or mark not-applicable.

Two internal checks must also read green (no manual entry — they follow from
code/config): `active_policy_catalog` (needs ≥1 enabled customer-visible service
— see Phase 4) and every `policy_release_*` (all policy documents published as
active releases).

The **bold** authorities are outside parties. Those approvals cannot be
self-issued; the gate rejects an owner name or self-attestation.

## Phase 4 — Enable and activate each Open-tier service

Right now **zero** services are `enabled` in `config/provider-eligibility-matrix.json`
— all sit in `disabled_pending_*`. For each Open-tier (provisional-independent)
service you want live:

1. **Config flip (reviewed deploy):** a service is only truly enabled when all
   three are true — `launch_state: "enabled"`, `customer_visible: true`, and the
   matrix's own `status: "active"` (the `active_policy_catalog` runtime check
   requires the active status). `launch_state` alone is not enough: the
   eligibility engine and the catalog check both also require `customer_visible`.
   Do this only after the service's mandatory requirements and insurer approval
   are documented. A guard test pins the enabled set — update it in the same
   change. **This is staged** on branch `stage/open-tier-enabled` (the 11
   Open-tier codes flipped + guard test updated); it is intentionally unmerged.
   Merge it (and set `status: "active"`) only when the precondition below holds.
2. **Activation record:** in `/admin/provider-compliance`, run **activate-service**
   for that exact service + `US-MD-MontgomeryCounty`, entering: a legal-review
   valid-through (≤1 year), reviewer, internal reference, requirements summary,
   at least one official `.gov` source, the professional-review choice, and the
   written **insurer** approval (approved-by, reference, valid-through). The
   endpoint re-checks Phase 3 readiness and refuses if anything regressed. It
   also refuses until step 1 is deployed (`launch_state` must already be
   `enabled` and `customer_visible`).

**Precondition for merging the staged branch / running activation:** for each
service, its mandatory legal requirements are documented, written insurer
approval exists, and the legal-category mapping has counsel review. Two codes
carry extra preconditions beyond insurer: `photo_documentation_only` (written
OCP) and `provisional_basic_detailing` (environmental OCP).

Open-tier service codes (owner-operator lane):

- `provisional_12v_jump_start`, `provisional_12v_battery_replacement`
- `provisional_wiper_blade_replacement`, `provisional_conventional_bulb_replacement`, `provisional_engine_or_cabin_air_filter`
- `provisional_fluid_topoff_limited`, `provisional_temporary_spare_install`
- `provisional_obd_read_only`, `provisional_visual_observation_report`, `photo_documentation_only`
- `provisional_basic_detailing`

## Result

Once a service is enabled + activated and the applicant's own evidence clears
(identity verified, required documents accepted and scanned clean, agreements
current), the rules engine auto-verifies that provider to **approved / active**
with no further owner action. Your ongoing involvement drops to reviewing
evidence the system can't auto-accept.

## Invariants that stay true throughout

- Customers still cannot post jobs or be charged (`CUSTOMER_JOB_POSTING_PAUSED`,
  `MARKETPLACE_MODE = onboarding_only`, `STRIPE_LIVE_MODE_ENABLED = false`).
- The legal-category → service map used by activation is best-faith and should
  be confirmed with counsel before customer launch.
