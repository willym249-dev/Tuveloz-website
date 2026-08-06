# Tuveloz legal register

**What this is.** A standing map of what Tuveloz does, which law or rule reaches
each activity, and what the product does about it. It exists so the answer to
"what applies to us, and where is it handled?" is written down instead of
rediscovered.

**What this is not.** Not legal advice, not proof of compliance, and not a
substitute for counsel. The owner may choose to proceed without counsel; that
choice is recorded in the launch-readiness gate `owner_legal_review_choice` and
does not reduce any duty the law places on Tuveloz.

**How to use it.** Every row marked **verify** has not been confirmed against a
primary source by a qualified person. Confirm before relying on it commercially.
Rows citing a URL take that URL from `lib/launch-readiness.ts`, which the code
already treats as the official source for the matching launch gate.

---

## 1. What the business actually does

Stated plainly, because the legal analysis follows from the facts, not the
labels:

1. Runs a two-sided marketplace matching vehicle-service customers with
   independent provider businesses in Montgomery County, Maryland.
2. Collects structured job requests from customers and routes them only to
   providers verified for that exact service in that jurisdiction.
3. Lets providers set their own price and send quotes. Tuveloz sets no price.
4. Takes customer payment through Stripe, retains a 5% customer service fee,
   and transfers the remainder to the provider's own connected account.
5. Verifies provider licences, registrations, insurance, and competency
   evidence per exact service, and blocks work when evidence lapses.
6. Stores private evidence documents, job records, and repair authorisations.
7. Sends transactional email and SMS (account verification, sign-in codes,
   job status), plus a consent-based launch-update list.
8. Publishes provider-facing and customer-facing policies and collects
   recorded acceptance of them.

**Does not:** perform, supervise, or warrant vehicle work; employ, train, or
assign providers; sell, source, or mark up parts; set provider prices; run
consumer reports today.

---

## 2. Activity → law → control

| Activity | Law / rule | Authority | Control in product | Status |
|---|---|---|---|---|
| Repair authorisation before work | Md. Comm. Law [§14-1008](https://mgaleg.maryland.gov/mgawebsite/Laws/StatuteText?article=gcl&section=14-1008) | Official legal source | Customer authorisation recorded before work; change orders need fresh consent (`unauthorized_change_order`) | gate `maryland_repair_duty_allocation` |
| Repair invoice contents | Md. Comm. Law [§14-1003](https://mgaleg.maryland.gov/mgawebsite/Laws/StatuteText?article=gcl&section=14-1003) | Official legal source + CPA | Provider-named itemised invoice; Tuveloz receipt kept separate | gate `checkout_fee_receipt_copy`; issue #41 |
| Motor vehicle repair / towing registration | Montgomery County OCP [licensing](https://www.montgomerycountymd.gov/OCP/licensing/mvr_tow_main.html) | County | `ocp_vehicle_service_registration` required on 15 services; `ocp_towing_registration` for towing | enforced in eligibility matrix |
| Unfair or deceptive trade practices | Md. Comm. Law [§13-301](https://mgaleg.maryland.gov/mgawebsite/Laws/StatuteText?article=gcl&section=13-301) | Official legal source | Fee shown as its own line before acceptance; no claims beyond documented evidence | gates `customer_workflow_and_terms_requirements`, `cancellation_refund_no_show_policy` |
| Electronic acceptance of agreements | Md. Comm. Law [§21-106](https://mgaleg.maryland.gov/mgawebsite/Laws/StatuteText?article=gcl&section=21-106) | Official legal source | Clickwrap with affirmative checkbox; immutable acceptance records with policy hash | gate `provider_onboarding_legal_requirements` |
| Personal-information security | Md. Comm. Law [§14-3504](https://mgaleg.maryland.gov/mgawebsite/Laws/StatuteText?article=gcl&section=14-3504) | Official legal source + security reviewer | Private evidence storage, malware quarantine, no-store responses, participant-only access | gate `security_and_data_incident_plan` |
| Privacy rights and deletion | Md. OAG [data privacy](https://oag.maryland.gov/resources-info/Pages/data-privacy.aspx) | Official legal source | Privacy Center: export, deletion, communication choices, legal hold | gate `privacy_retention_and_data_rights` |
| Background checks (if adopted) | FCRA — FTC [guidance](https://www.ftc.gov/business-guidance/resources/background-checks-what-employers-need-know) | Official source + screening reviewer | **Not adopted.** Disclosure, authorisation, pre-adverse, dispute, final-action all required first | gate `screening_or_no_screening_position` |
| Business registration / good standing | Md. [SDAT](https://dat.maryland.gov/pages/services.aspx) | State | Provider business records verified during onboarding | gate `provider_identity_and_business_verification` |
| Environmental handling (used oil, wash water, spent batteries, refinishing) | MDE permits / handling plans | State | Per-service evidence: `wash_water_plan`, `spent_battery_handling_plan`, `used_oil_handling_plan`, `mde_vehicle_refinishing_permit` | enforced in eligibility matrix |
| Refrigerant service | EPA Section 609 | Federal | `epa_section_609_certificate` required for `motor_vehicle_ac_service` | enforced in eligibility matrix |
| Worker classification | Md. Lab. & Empl. workplace fraud provisions — **verify** | Legal + insurer + CPA | Independent owner-operator only; employee/trainee pathways blocked (`provider_of_record_assignment_not_implemented`) | gate `employee_and_trainee_provider_of_record` (optional) |

---

## 3. Gaps — reached by law, not yet in the citation map

These are live exposures with no `OFFICIAL_SOURCE` entry and no launch gate.
Each needs a primary-source check.

| Activity | Rule | Why it reaches us | State |
|---|---|---|---|
| SMS sign-in codes | **TCPA**, 47 U.S.C. §227, and carrier A2P 10DLC registration — **verify scope** | We now send texts to consumer mobiles. A2P is carrier policy, not statute, but unregistered traffic is filtered. Transactional OTP is treated more permissively than marketing — that distinction is load-bearing and should be confirmed | **code lock released**; secrets unset; no gate exists |
| Launch-update email | **CAN-SPAM** — **verify** | Commercial email needs a physical postal address and working opt-out. `LAUNCH_UPDATES_POSTAL_ADDRESS` exists and is unset, which suppresses sending | partial control, no gate |
| Customer reviews | **FTC rule on consumer reviews and testimonials** (16 C.F.R. Part 465) — **verify citation** | We publish reviews influencing purchase decisions | strong control (completed-job binding); no gate |
| Warranty statements | **Magnuson-Moss Warranty Act**, 15 U.S.C. §2301 et seq. — **verify** | Only reaches us if Tuveloz ever warrants work. Today warranties route to the provider | Terms route warranty to provider; no gate |
| Holding and forwarding customer funds | **Money transmission** — **verify** | Marketplaces routing payment can implicate state MT licensing. Stripe Connect is normally the answer, but the model must be confirmed with the processor | gate `stripe_connect_business_model` covers processor sign-off, not the MT question itself |

---

## 4. Standing protections

Independent of any single statute, these are the structural facts that make the
legal position defensible. Losing one is a material change:

- **Providers set their own price.** Tuveloz never quotes. Setting price moves
  us toward being the seller of the service.
- **The accepted quote is a direct customer↔provider agreement.** Tuveloz is
  not a party.
- **The provider is named on the invoice**, not Tuveloz.
- **No parts revenue.** The fee is a percentage of labour, so no incentive
  exists around part selection. Enforced by a database trigger.
- **No platform warranty.** Warranties belong to the provider.
- **Verification is per exact service**, and no claim is displayed beyond what
  was documented.
- **Default deny.** Every service and jurisdiction starts closed.

---

## 5. Maintaining this

Add a row when the business starts doing something new — a new service, a new
jurisdiction, a new way of contacting people, a new way money moves. The trigger
is a change in **what we do**, not a change in the law.

When a gap in §3 gets a primary-source answer, move it into §2 with its citation
and the gate that enforces it, and add the source to `OFFICIAL_SOURCE` in
`lib/launch-readiness.ts` so the code and this document stay in step.
