# Provider insurance review matrix

- **Status:** draft — configuration inventory; insurer decisions pending
- **Owner:** hello@tuveloz.com
- **Last reviewed:** 2026-09-27
- **Applies to:** proposed Montgomery County services; no service activation

This records the insurance evidence selected by the application's actual
requirement resolver. It gives the owner and insurance reviewer specific
questions to settle before services open. It is not an insurance determination,
a statement that coverage exists, or a request to buy coverage.

## What the application currently selects

The September 27 inventory executed `getEvidenceRequirementsInJurisdiction()`
from `lib/provider-policy.ts` for `US-MD-MontgomeryCounty`, then applied the
unchanged `insuranceRequirement()` classifier from
`lib/insurance-confirmation.ts`. This includes pathway relationship evidence,
not just the raw service arrays. The jurisdiction passed the resolver's local
review check. That check does not approve insurance or open the marketplace.

Across 25 catalog entries, the resolver returned 47 allowed service/pathway
combinations. There are 23 independent-provider combinations: two select named
insurance evidence and 21 do not. All 24 employee/trainee combinations select
workers' compensation evidence. All 25 services remain disabled in the catalog.

**An empty insurance list means no evidence key recognized by this classifier
was selected. It does not mean insurance is unnecessary or an applicant is
insured.** Other evidence, scope, location, authenticity, provider eligibility,
service activation and launch controls remain separate. Package evidence and
its attachments must also be reviewed; this inventory does not inspect an
applicant's documents or determine what a policy covers.

In the table, **None selected** has that limited technical meaning.
**Not offered** means no independent pathway is configured. Employee and trainee
pathways listed here are proposed catalog paths; a separate engine block still
prevents work without the unimplemented provider-of-record assignment flow.

| Service | Independent-provider insurance evidence | Other configured pathway | Configured location boundary |
| --- | --- | --- | --- |
| General auto repair | Not offered | None; prohibited broad category | No permitted scope |
| Photo documentation only | None selected | Trainee: workers' compensation | Approved private property |
| Provisional visual observation report | None selected | Trainee: workers' compensation | Approved private property |
| Provisional OBD-II read-only service | None selected | Trainee: workers' compensation | Approved private property |
| Provisional wiper-blade replacement | None selected | Trainee: workers' compensation | Approved private property |
| Provisional engine or cabin air-filter replacement | None selected | Trainee: workers' compensation | Approved private property |
| Provisional conventional-bulb replacement | None selected | Trainee: workers' compensation | Approved private property |
| Provisional limited fluid top-off | None selected | Trainee: workers' compensation | Approved private property |
| Provisional 12-volt jump start | None selected | Trainee: workers' compensation | Approved private property or passed emergency roadside check |
| Provisional 12-volt battery replacement | None selected | Trainee: workers' compensation | Approved private property or passed emergency roadside check |
| Provisional temporary-spare installation | None selected | Trainee: workers' compensation | Approved private property or passed emergency roadside check |
| Provisional basic detailing | None selected | Trainee: workers' compensation | Approved private property with approved wash-water controls |
| Sponsored oil and filter service | Not offered | Trainee: workers' compensation | Approved fixed private property |
| Battery replacement | None selected | Business employee: workers' compensation | Approved private property or passed emergency roadside check |
| Tire repair or installation | None selected | Business employee: workers' compensation | Approved fixed or private property with tire controls |
| Basic vehicle diagnostics | None selected | Business employee: workers' compensation | Approved private property |
| Mobile car wash | None selected | Business employee: workers' compensation | Approved private property with approved wash-water controls |
| Motor-vehicle air-conditioning service | None selected | Business employee: workers' compensation | Approved location for motor-vehicle A/C work |
| Body and paint refinishing | None selected | Business employee: workers' compensation | Approved permitted fixed facility |
| Window-tint installation | None selected | Business employee: workers' compensation | Approved private or fixed location |
| Towing or storage | Business auto and towing/custody coverage | Business employee: same coverage plus workers' compensation | Approved towing/storage workflow |
| Vehicle lockout | General liability certificate | Business employee: same coverage plus workers' compensation | Approved lockout identity/location workflow |
| Official vehicle inspection | None selected | Business employee: workers' compensation | Licensed fixed inspection station |
| Emergency fuel delivery | None selected | Business employee: workers' compensation | Approved fuel route and stop-work workflow |
| EV high-voltage service | None selected | Business employee: workers' compensation | Approved EV facility; allowed scope is currently empty |

The location descriptions are abbreviated from `location_rule`; they are not
permission to work there. Exact service codes, allowed/prohibited scope,
requirements, pathway and location identifiers are preserved in the private
inventory. High-voltage, fuel, inspection and other specialist entries must not
be presented as launch services just because they exist in configuration.

The classifier recognizes `general_liability_coi`, `business_auto_coverage`,
`broker_coverage_determination`, `workers_comp_coverage` and
`towing_custody_coverage`. No resolved combination selects
`broker_coverage_determination`. Merely defining an evidence type does not make
it a requirement.

## Decisions needed from the insurance reviewer

These questions supplement the existing [launch review packet](launch-gate-briefing.md).
They are prepared for review and have not been sent as a new inquiry.

1. Which exact service codes and working locations can be considered for the
   initial launch? Confirm both allowed work and excluded work. Leave the other
   services closed instead of treating the entire catalog as the application.
2. For each proposed service/pathway, which provider insurance evidence,
   insured business/personnel, limits, effective dates and endorsements must
   Tuveloz verify? Specifically resolve the 21 independent combinations with
   no named insurance evidence, including conventional battery replacement.
   A blanket statement that all providers supply liability/auto insurance does
   not match this configuration.
3. Are the named towing and lockout requirements complete for the exact work,
   vehicle use, custody and location? Are the employee/trainee requirements
   complete for the provider business and people performing the work?
4. What coverage does Tuveloz itself need for the agreed marketplace model,
   separately from provider policies? Record exclusions affecting independent
   providers, mobile/roadside work and the exact proposed services. Provider
   coverage must not be used as evidence of Tuveloz's own coverage.
5. Who can confirm each policy through independently sourced insurer/broker
   contact details, and what should happen after cancellation, replacement,
   expiry or a claim? Identify claims contacts and notification deadlines.
6. Before any application, appointment or purchase, confirm whether the initial
   review is free and disclose premiums and broker fees. No paid work is
   authorized by this document.

## Turning answers into checked requirements

Record the source and exact scope of each written answer privately. An insurance
review does not replace official licensing/legal review. The malware scanner
does not authenticate a policy; the business registry does not confirm coverage.
The existing insurance confirmation form records an actual external review,
including independently sourced contact details and confirmation of insured,
policy, dates, limits, services and locations. It is not an insurer integration.

Once supported decisions exist, update only the affected service/pathway
requirements and any reviewed policy wording. Check that signup asks for each
required document once, omits documents for services the applicant did not
choose, and blocks work when applicable evidence is missing or out of date.
Reconcile the provider checklist with the exact written decision before recording
the corresponding launch gate. A platform service activation record alone does
not prove an individual provider is covered.

No requirement, approval, policy text, payment switch or provider record changed
during this inventory. The existing Founder Shield inquiry is already sent;
its September 30 response checkpoint remains in `OPEN-ITEMS.md`. Do not resend
it or treat this prepared matrix as a reply from an insurer.

## Reproduction record

Source: local documentation commit `a87f938f0d960bde45206ffa88bb405330e750bc`,
whose runtime source matches released PR #254 (`a1f9ace`). Generated at
2026-09-27T18:01:21.252Z using the unchanged policy and insurance modules.
Private local helper: `work/inventory-provider-insurance-20260927.mjs`.
Private result: `outputs/provider-insurance-inventory-20260927.json`, containing
all 47 combinations and SHA-256 hashes of the three source inputs. No account
access, outbound request, provider data or application write was used.
