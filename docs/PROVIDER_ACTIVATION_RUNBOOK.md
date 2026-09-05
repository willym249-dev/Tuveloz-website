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

## September 4 configuration audit

The deployed secret-name inventory includes the dedicated Stripe Identity key,
webhook secret, and reusable flow ID; their presence does not prove valid values
or an operational flow. The source still leaves the provider allowlist empty
and Identity live-mode permission false. Neither setting has a deployed secret
override. Cloudmersive's API key and scanner callback secret are absent, and
the scanner provider is `unconfigured`. These gaps must be resolved before the
runtime canaries; existing application submission remains available.

Focused scanner and identity tests passed. The subsequent owner-authorized
Stripe test used real hosted synthetic failure/success and signed callbacks to
an isolated local D1 database. It exposed and repaired the flow-options and DOB
expansion errors described below; the final test approval and applicant return
were verified. This is test-mode vendor proof, not a genuine live canary. No
live identity verification or upload scan was performed. Stripe's Identity
dashboard still requires the owner's own additional identity verification.

PR #187 deployed as `3a7c28c` on September 5, with both deployment jobs and
19 independent live release checks passing. The test-mode proof above does not
change the outstanding live configuration, genuine canary or launch reviews.

## September 5 scanner account and vendor contract check

The owner approved Google sign-in and a free Cloudmersive account. The account
is email-verified and its free API key is stored as an encrypted Worker secret;
no paid plan was purchased. Scanner selection and the required callback secret
remain unconfigured, so storing this key does not enable processing. Two direct
advanced-API checks used harmless synthetic files and the application's exact
header policy: a PNG returned clean and a prohibited text file returned failed.
The clean response contained `FoundViruses: null`, which the previous classifier
incorrectly rejected. Explicit null and an empty array now both mean no viruses;
all advanced threat flags must still be present and false, and a nonempty
verified format is required. Missing or malformed fields remain blocked.
Cloudmersive also documents the null result in its
[official API example](https://www.cloudmersive.com/blog/Testing-Cloudmersive-APIs-with-cURL).

These checks prove the direct vendor contract only. They did not scan provider
documents or create a guarded production D1/R2 canary. The production scanner
is still unconfigured. Before enabling it, resolve the plan mismatch: the
[published free evaluation tier](https://portal.cloudmersive.com/selectplan)
limits files to 3.5 MB and calls to one per second, while Tuveloz accepts 10 MB
uploads. Its public monthly allowance is 600 calls; this account's key dashboard
currently shows 800, so verify the actual allowance rather than promising it.
Do not silently reduce the existing upload limit or purchase a plan. Confirm
capacity for both provider evidence and message-image scans before setting the
secrets below, which enables scheduled processing of queued files.

### Isolated pipeline proof (September 5)

A subsequent local workerd test applied all 66 repository migrations to fresh
D1 and used isolated R2 with the actual upload validation/storage, scheduled
scanner, result recorder, audit and notification modules. A real clean PNG
result was recorded with its exact file hash and consumed pending request. A
prohibited text upload was rejected by validation, then deliberately seeded into
local quarantine to exercise the downstream real-vendor failed-result path.
A mismatched file hash produced a local error without uploading bytes to the
vendor. Replayed results created no additional result/audit/notification rows;
altered result hashes returned 409. Two protective notifications were captured
locally. The provider stayed new/unreviewed, service eligibility stayed blocked,
and every evidence row still required review. No production data or payments
were used. This proves the isolated pipeline, not the public upload authorization
route or the required production runtime canary.

The fixture initially failed because it passed Node FormData directly across
Miniflare's separate Fetch implementation, then because its seeded SQLite
timestamps omitted the zone and local Windows workerd parsed them as EDT.
Both fixture errors were corrected: encode multipart bytes and headers before
dispatch, and seed the explicit UTC ISO timestamps used by the real upload route.
No production source change was needed. Separately, Cloudmersive classified an
eight-byte PNG header as malware-clean with no invalid-file flag. Malware-clean
does not prove that an image is complete, decodable, authentic or acceptable as
business evidence; preserve the separate evidence review. The production
file-size/plan mismatch above remains unresolved.

## Phase 1 — Cloudflare secrets

### Approved live Identity connection (September 5)

The owner explicitly approved connecting the restricted live Identity key to
start document/selfie checks and read recent results for the adult check, then
completed Stripe's required authenticator step. The dedicated key was created
with only **Identity Verification Results: Write** and **Recent Detailed
Verification Results: Read**. The API accepted its authentication and read scope
for a deliberately nonexistent verification ID; no person's record was read or
created. A separate **TUVELOZ Identity Live** webhook is active with the six
events listed below, snapshot payloads and API version `2026-06-24.dahlia`.
Both dedicated credentials were stored as encrypted Worker secrets.

The two runtime activation settings are existing plaintext bindings in
`wrangler.jsonc`. Cloudflare rejects adding secrets with those same names
(`Binding name already in use`). Set them in the reviewed Worker configuration,
as this change does; do not use the previously documented secret-put commands
for those two names. Staging explicitly resets them to empty/false. Customer
job posting, payments, SMS, scanner selection and provider/service activation
retain their separate guards. A genuine provider-bound live result is still
required; account access and credentials do not satisfy that canary.

### Owner account access is separate from the provider canary

The owner subsequently completed the additional Stripe Identity access check.
The dashboard no longer marks it Required and Create verification is enabled.
This supersedes the pending-owner status in the earlier September 4 audit; it
does not constitute a provider-bound live canary. No identity documents or
biometric data were retrieved to establish this status.

The approved restricted key is named `TUVELOZ Website Identity Live`. All
Detailed Verification Results and payment permissions remain None. The
recent-results permission allows the DOB expansion needed for the adult check;
the application does not request document numbers, document images or selfie
images. Specific owner approval followed the automatic review stop recorded in
the log; the account verification alone was not treated as that approval.

The separate live snapshot destination uses
`https://tuveloz.com/api/stripe/webhooks/identity`, the SDK-matching
`2026-06-24.dahlia` version and these six events. The existing test Identity and
two Connect destinations were preserved:

- `identity.verification_session.created`
- `identity.verification_session.processing`
- `identity.verification_session.requires_input`
- `identity.verification_session.verified`
- `identity.verification_session.canceled`
- `identity.verification_session.redacted`

The signing secret and dedicated key are stored. Complete the reviewed
runtime-configuration release and genuine-canary steps below. The dashboard
access check did not establish the new key's live sensitive-results permission
through a real provider result.

Set as encrypted Worker secrets. All are fail-closed: a wrong or missing value
blocks activation but never opens payments.

**Stripe Identity (live):**
```bash
npx wrangler secret put STRIPE_IDENTITY_SECRET_KEY          # dedicated rk_live_ Identity key, NOT the payments key
npx wrangler secret put STRIPE_IDENTITY_WEBHOOK_SECRET      # whsec_ for the Identity webhook destination only
```

Deploy the reviewed `wrangler.jsonc` settings
`STRIPE_IDENTITY_ALLOW_LIVE_MODE: "true"` and
`IDENTITY_VERIFICATION_PROVIDERS: "stripe_identity"` with those secrets present.
To pause new Identity sessions, deploy those settings as `"false"` and `""`;
coordinate any pending Stripe webhook deliveries before pausing the integration.

The application creates `type: document` sessions with explicit live capture,
matching selfie, and driving-license/ID-card/passport options. It verifies those
options on every retrieved session before accepting a result. Reusable
`verification_flow` sessions return `options: null` in Stripe's API and cannot
prove this configuration; the old flow-ID secret is no longer used. Existing
unverifiable flow sessions remain rejected. Review any such pending attempt
through the owner process before retrying; never mark it approved manually or
relax binding checks.

The dedicated restricted key needs Identity session/report access (write for
session creation) and **Access recent sensitive verification results: Read**.
Only a signed verified event retrieves `verified_outputs.dob`; expanding the
parent `verified_outputs` alone omits DOB. Names and DOB are checked in memory
against the immutable application and age-18 rule, never saved as extra fields.
No document number or image expansion is requested. Verify these permissions
with a fresh test result; a credential-shaped string is insufficient.
See [Stripe's sensitive result access guide](https://docs.stripe.com/identity/access-verification-results).

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
