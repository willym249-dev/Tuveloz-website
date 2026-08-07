# Where things stand — snapshot, August 2026

Tuveloz is one person, pre-revenue, one county. This file exists so the state
of play does not have to be re-derived every session, and so thresholds that
do not matter yet are recorded with the size at which they start to.

Update it when something moves. Delete lines that stop being true.

---

## The bottleneck

Every service is `disabled_pending_*` and the catalog status is
`draft_pending_mandatory_compliance_insurance_tax`. No customer request, quote,
or payment can happen until that changes, and it changes only when the required
launch gates receive sign-offs that **cannot be self-issued**:

- CPA or tax adviser
- payment processor
- an official legal or licensing source, per service
- a security or screening reviewer, per the gate

**Insurance is tracked, not blocking** (owner decision, August 2026). No
Maryland statute requires platform coverage, so
`platform_and_service_insurance_bound` is `required: false` and does not gate
the stage. The exposure it covers — a customer naming both the provider and
Tuveloz over work done at their location — does not go away with the flag.
Set `required: true` in `lib/launch-readiness.ts` to make it blocking again.

Those are appointments and phone calls, not commits. Nothing else in this file
produces revenue until they are done.

**Towing is off the catalog** (owner decision, August 2026, "for now"). The
`towing_or_storage` service was removed from
`config/provider-eligibility-matrix.json`, from `SERVICE_CODES` in
`lib/provider-policy.ts`, from the provider signup options, and from the
homepage feedback list. A guard test in
`tests/provider-multi-tier-services.test.mjs` keeps it out.

Its supporting definitions were left dormant on purpose, so restoring it is a
small change rather than a rebuild: the `ocp_towing_registration`,
`tow_vehicle_registration`, and `towing_custody_coverage` evidence types in the
matrix, their entries in `lib/evidence-acceptance-guide.ts` and
`lib/provider-legal-identity.ts`, and the
`approved_towing_and_storage_workflow_only` location rule with its
`towing_or_storage_site` and `towing_storage_workflow_confirmed` facts in
`lib/job-scope-facts.ts`. To bring towing back, re-add the service entry, the
service code, the signup label, and delete the guard test.

Two towing mentions stay because they are still true: the Terms say Tuveloz is
not a towing-dispatch service, and the Montgomery County registration URL is
named "Motor Vehicle Repair/Maintenance/Towing" — that is the general repair
registration, not a towing-specific one.

The runtime check lives at `active_policy_catalog` in
`lib/runtime-launch-readiness.ts` — it requires the status string to equal
`"active"` **and** at least one service to be `enabled` and `customer_visible`.

---

## Built, not deployed

Branch `claude/legal-actions-similar-businesses-pu6z5f`: 17 commits, 58 files,
349 tests passing, lint and build clean. Not merged.

Five migrations have never been applied to any database:

| Migration | Adds |
|---|---|
| `0054` | `customer_vehicles`, `fleet_inquiries` |
| `0055` | `referral_codes`, `referral_signups` |
| `0056` | fleet contact phone + SMS consent columns |
| `0057` | `phone_contact_consents` |
| `0058` | `customer_requests.contact_phone` |

Local: `npm run db:migrate:local`. Remote is a separate deliberate step.

What the branch contains: server-rendered provider pages with structured data,
a dynamic sitemap, service and town landing pages, `/fleet` with inquiry
capture, saved vehicles, two-sided referral attribution, and phone contact
consent across every entry point.

---

## Outstanding

**Small code, real value**

- Nothing sends texts. `phone_contact_consents` is the permission layer only.
  Sending needs a provider (Twilio or similar) plus STOP-keyword handling
  wired to `revokeMarketingSmsConsent`.
- No provider availability calendar — the prerequisite for instant matching
  rather than request-for-quote. Keep it provider-set; Tuveloz requiring
  hours is the classification drift to avoid.

**Not code, higher leverage**

- **Google Business Profile — submitted, awaiting decision.** Video
  verification recorded and sent (Aug 2026). Nothing to do but wait. Not yet
  publicly indexed, which is expected before approval.

  When the acceptance email arrives: uncomment the Google entry in
  `app/components/social-links.tsx` (lines 12–13) and drop in the share link.
  It then appears in the footer and in every follow prompt at once. Also
  update `brand/outreach/audience-growth-playbook.md`, which still lists this
  as the missing top lever.

  If it is rejected: service-area businesses with no storefront draw extra
  scrutiny, and a re-record usually needs one continuous unedited take showing
  an office or admin area, signage, and business documents. Rejection is
  common and appealable, not final.
- One attorney pass on the provider agreement and Terms of Use before money
  moves, mainly to add an arbitration clause with a class-action waiver.
  `app/provider-agreement/page.tsx` says in its own text that it is an
  operational document, not a final contract.

---

## Thresholds that do not matter yet

Recorded so they are not worried about early or missed late. See
`docs/LEGAL_LANDSCAPE.md` for mechanics and sources.

| Rule | Bites at | Currently |
|---|---|---|
| MODPA privacy obligations | 35,000 Maryland consumers in a calendar year | far below |
| 1099-K filing | $20,000 **and** 200 transactions per payee | no payments live |
| CAN-SPAM | any commercial email | already applies — physical address is enforced in `lib/launch-update-delivery.ts` |
| TCPA | any marketing text | applies from the first message; nothing sends yet |

Worker classification has no threshold. It applies to the first provider.

---

## Re-check

- **FLSA final rule.** DOL's NPRM (RIN 1235-AA46) closed comments 28 Apr 2026;
  no final rule was found as of Aug 2026. That is an absence of evidence, not
  a confirmed negative — check
  <https://www.dol.gov/agencies/whd/flsa/misclassification/2026rulemaking>.
- Anything in `docs/LEGAL_LANDSCAPE.md` older than its "last verified" date,
  before relying on a figure.
