# Vehicle incident, claims, and stop-work plan

- **Status:** draft — needs owner sign-off, insurer review, and an official-source check
- **Owner:** hello@tuveloz.com
- **Last reviewed:** 2026-09-26 (partial technical rehearsal and record custody; approval remains pending)
- **Applies to:** the `vehicle_incident_claims_and_stop_work` launch gate

What to do when someone is hurt, a vehicle or property is damaged, or work must
stop mid-job. Covers emergency handling, stopping work, preserving evidence,
holding payment, tendering to an insurer, what to say to both sides, and what
gets recorded.

**This is a draft.** Items marked **[OWNER]** need a real answer before the gate
can be closed, and the gate needs an insurance carrier and an official legal or
licensing source in addition to the owner. Its recorded official source is
Md. Code, Com. Law § 14-1008 (repair authorization), in `lib/launch-readiness.ts`.

**Nothing here applies to a live job today.** Customer job posting is paused and
`MARKETPLACE_MODE` is `onboarding_only`, so there are no real jobs to have an
incident on. This exists so the plan is written and tested *before* the first
one, which is the only time writing it is cheap.

## The line this plan must not cross

Providers are independent contractors, and that classification rests on specific
product facts rather than a label. `lib/service-safety-policy.ts` states the
boundary directly:

> Providers decide the lawful method, tools, staffing, and sequence used to
> perform the work.
>
> Tuveloz may enforce marketplace safety, credential, documentation, privacy,
> and customer-authorization rules **without directing the repair method**.

So: **stopping work is a safety and authorization action, not a technical
instruction.** Tuveloz may say "stop, this is outside the authorized scope" or
"stop, someone is hurt." Tuveloz may not say how to make the vehicle safe, how to
perform the repair, or what tools to use. If a response step starts to read like
supervising a mechanic, it is the wrong step — see the never-build list in
[`../../CLAUDE.md`](../../CLAUDE.md).

The same line applies to the words used. "We require you to…" about method is
control. "This job is stopped and payment is held pending review" is marketplace
administration.

## Life safety comes first, and it is not Tuveloz's call

If anyone is injured, or there is fire, fuel, smoke, or a live electrical
hazard: **call 911 first.** Nobody waits for Tuveloz, and nobody needs
permission. The platform's AI assistant already escalates
brakes/smoke/fire/fuel-smell/overheating/loss-of-steering to "stop, get clear,
call 911" rather than advising, and a person should do the same.

Record it afterwards. Do not delay an emergency call to open a record.

## What the system already does

An incident is a real record, not a note: the `job_incidents` table in
`db/schema.ts` carries reporter, type, severity, when and where it happened,
whether injury, property damage, or emergency services were involved,
`workStoppedAt`, `insurerNotifiedAt`, evidence references, assignment,
resolution, and status.

**`holdPayments` defaults to `"yes"`.** Opening an incident holds payment by
default rather than requiring someone to remember to. Releasing the hold is a
deliberate act, which is the correct direction for a default to fail.

Completion and payout are already gated on a valid provider-arrival snapshot
bound to the current assignment and accepted scope — an incomplete or disputed
job cannot quietly reach payout.

## First response

**1. Life safety, then stop the work.** Record `workStoppedAt` on the incident.
Work stops for: injury, property damage beyond the vehicle, an emergency
service being called, or work that has gone outside the authorized scope.

**2. Open the incident record before anything else administrative.** Severity,
what happened, when, where, and who reported it. Written by whoever has the
facts, not reconstructed later by whoever is available.

**3. Preserve evidence.** The job workspace already holds before/after condition
evidence, messages, the appointment record, arrival tracking, and the
authorization chain. The intended incident link is `evidenceReferences`, but
the September 26 code review confirmed that incident creation still writes an
empty list and the console has no linking control. This remains implementation
work; do not describe the private job-photo workspace as a completed incident
attachment flow. Do not delete a message, image, or job record after an incident
— the same rule as the security plan, for the same reason.

**4. Payment stays held.** It holds itself. Do not release it to settle a
complaint quickly; releasing payment before the facts are known is a decision
about liability made by accident.

**5. Do not assign fault.** Not to the provider, not to the customer, not in
writing. Tuveloz is not a party to the service agreement — the work is a direct
agreement between the customer and the provider they chose. Recording what
happened is not the same as deciding who is responsible, and the second one is
not Tuveloz's to make.

## Insurer tender

**[OWNER]** This is the part that cannot be drafted from the code, and the gate
needs the carrier anyway:

| Question | Answer |
| --- | --- |
| Who is the carrier and broker, with a claims number reachable out of hours? | |
| What is the notification deadline in the policy? | |
| Which incidents must be tendered, and which are below the threshold? | |
| Does the provider's own coverage tender first, and how is that established? | |

Every provider carries their own general liability, and business auto where the
service requires it. **That is provider-side coverage and it does not answer what
Tuveloz's own policy does** — the `platform_and_service_insurance_bound` gate is
still unanswered, so today the honest assumption is that there is no platform
policy to tender to. Record `insurerNotifiedAt` when a tender is actually made.

## What each side is told

**Both sides, promptly and factually:** that an incident is recorded, that work
is stopped, that payment is held, and what happens next. Nothing about fault,
nothing predicting an outcome, nothing that reads as an admission or a denial.

**The customer** also needs to know their address and contact details are not
shared beyond the provider they already chose.

**The provider** needs to know the hold is procedural rather than a finding
against them, and that declining further work carries no penalty — no acceptance
rate exists, and creating pressure here would undercut the classification the
platform depends on.

**[OWNER]** Whether a template is reviewed by counsel before first use. An
incident message is the one that gets read back later.

## Resolution and records

Close the incident with a `resolution` and `resolvedAt`. A resolution says what
was agreed and by whom — not who was at fault, unless an insurer or a court has
determined it.

Release the payment hold as a separate, deliberate step with a recorded reason.
If a claim is open, the hold stays.

Keep the incident chronology, evidence, personal details, and insurer or legal
correspondence in a protected record outside this repository. Put only a
sanitized reference and any general operational lesson in
[`../LOG.md`](../LOG.md). Do not copy customer/provider details, private location
information, medical information, or claims documents into a public source log.

## Testing it, which the gate actually requires

The gate says the plan must be **tested**, not merely written. Testing it means
running a rehearsal against the real records with a test job — open an incident,
confirm the payment hold appears without anyone setting it, attach evidence,
record a stop time, then resolve and release. Test records are isolated from real
providers, customers, alerts, payments, and public profiles, so this is safe to
do now.

### September 26 technical rehearsal

`npm run test:e2e:incident` passed against application commit `312b63b` in a
separate local checkout and disposable D1 database. Only synthetic accounts and
a test-flagged assignment were created, with email sent to a local catcher.
The helper's migration timeout was raised from 30 to 180 seconds after a healthy
Windows setup run exceeded the old limit. No production data or payment changed.

Verified through the real route and stored D1 records:

- A serious damage report created an open incident and set `hold_payments=yes`,
  even when the caller requested no hold and immediate release.
- Severity recorded a stop time; explicit provider stop-work also recorded an
  incident and held payment.
- Both customer and provider were denied incident resolution and hold release.
  The incident stayed open, its resolution stayed empty, and the hold survived.

This original end-to-end test does not perform an owner-authenticated release,
attach a real evidence file, contact an insurer, send real incident notifications,
or attempt a Stripe payout. Its payout-helper check is a source assertion, not a
payment transaction. The separate owner simulation below adds technical coverage
without turning these local results into a completed claims-plan review.

### September 26 private job-photo storage check

The separate `job-evidence-storage` test runs actual multipart upload/read
routes, account authentication, and migrated SQL with synthetic in-memory
Cloudflare bindings. It verified byte-for-byte photo retrieval, denied unrelated
and unauthenticated readers, rejected malformed/oversized files, preserved the
real-job launch gate, and cleaned up files after failed database inserts. It
reproduced and fixed a defect that deleted a committed photo when a later list
refresh failed. A saved record now survives that failure and returns a success
receipt with a refresh instruction.

A lost database acknowledgement is checked against the saved record before
file cleanup. If that read is also unavailable, the private file remains and
the response reports an unconfirmed save instead of claiming success or
deleting potentially committed evidence.

`test:e2e:job-evidence` verifies the real page in Chromium and WebKit against a
synthetic loopback API: uploaded bytes arrive, rejected submissions retain their
draft, and refreshing after a saved upload never resubmits it. Neither test uses
hosted R2 or attaches the photo to `job_incidents`. The additional incident-link
test below covers that separate route; a hosted participant upload remains
unverified. Owner and insurer review remain required independently of these tests.

### Linking saved evidence to an incident

The isolated job console now offers **Link a saved photo or note** on open,
under-review, and insurer-review incidents. It lists only saved records from
the same job and current customer/provider assignment. A participant can first
save a photo or note in the existing private job-evidence workspace. The owner
can link an existing record but cannot impersonate a participant upload.

Links are appended without replacing earlier references. The link and verified
actor audit are saved in one D1 transaction; changed assignments, incident
status, existing references, or test isolation reject a stale request. Duplicate
links are idempotent. Closed incidents and malformed legacy references require
support review. Linking does not change the payment hold, resolution, work-stop
record, or insurer notice, and never creates a transfer. Photos use authenticated,
job-scoped URLs and private, no-store responses. Storage keys are not exposed.

`tests/incident-evidence.test.mjs` executes actual account/owner authentication,
multipart upload, incident creation, link, and image-read routes with migrated
SQLite and in-memory R2. It covers wrong-job/party records, unauthorized access,
atomic rollback, concurrent changes, lost acknowledgements, and unchanged holds.
The actual console passes owner/customer/provider selection, rejected-attempt
retention, retry, and photo-opening checks in Chromium and WebKit. These are
synthetic technical tests. The hosted owner link/read check is recorded below;
a hosted participant upload and real insurer workflow remain separate.

### Owner decisions and later hold release

`tests/incident-owner-review.test.mjs` runs the real owner-token verification,
incident route, SQL, and audit logic using an isolated migrated SQLite database.
Its RSA keys exist only in memory; the public-key response and Cloudflare
bindings are synthetic fixtures, and every external fetch is intercepted. It
rejects forged headers, invalid signatures, expired tokens, wrong owners,
issuers/audiences, conflicting email headers, and cross-origin requests.

Valid signed-header and cookie simulations cover resolution with a retained hold,
explicit release at resolution, and reserve release. Decisions are tied to the
correct job and record the email from the verified token. Repeated resolutions
are rejected. Injury/property-damage resolution requires the owner's recorded
insurer-notice confirmation; this does not contact an insurer or verify delivery.

A resolved incident with a retained hold now has a separate **Release incident
hold** owner control. It requires a release reason, explicit confirmation, and
any required insurer-notice record. It preserves the original resolution, clears
only that incident's hold, records the verified owner and reason, and rejects
open incidents, other-job records, and repeat releases. Other incidents and
reserves remain held. No transfer is created and all payout checks still apply.
This route remains restricted to persisted test jobs/providers.

`test:e2e:incident-owner` exercises the actual owner console in Chromium and
WebKit: confirmation is required, a rejected attempt retains the draft, success
removes the completed control, and customers cannot see it. This internal test
console currently remains English-only; public bilingual routes are unchanged.

### Deployed owner access check

On September 26, the existing business-browser Cloudflare sign-in opened the
live owner dashboard. Its integrated review at 14:06 UTC reported successful
signed-token verification, available review tables, and the existing passing
scanner proof. The compliance workspace loaded. A read-only job-console lookup
of a nonexistent synthetic request reached the missing-assignment response,
confirming authenticated access to that route. No production test assignment
was available; no incident was created or modified. This closes only the live
owner sign-in/access check. PR #236's release and exact public health commit
were separately verified; see the September 26 log entry.

### Hosted staging owner rehearsal

The existing private staging environment was refreshed September 26 by workflow
`36247963177` to main commit `3eb287197f5d854d3dc1ab1c7036a0aa5c85fc65`.
It uses its own D1 and upload storage; production and recovery data were untouched.
The staged fixture was validated against the current migrations in local SQLite
first. A read-only staging preflight confirmed no conflicting IDs or existing
job/provider/incident rows before the five inserts ran in one transaction.

Fixture: `rehearsal-owner-job-20260926`, a test-only provider left **new / not
reviewed** with alerts off, a synthetic one-dollar quote, and incidents
`rehearsal-a-20260926` and `rehearsal-b-20260926`. No identity approval,
insurance proof, actual service, or real person is represented. The incident
reports and initial stop time were **seeded fixtures**, not created through a
customer-report form in this hosted check.

Verified using the real owner session and deployed controls:

- At 14:22:03 UTC, the owner resolved incident A with release unchecked. Its
  hold remained active and the separate release control appeared.
- Submitting the release form without its required confirmation was blocked.
- At 14:22:53 UTC, explicit confirmation released only A's hold. A's original
  resolution and resolution timestamp were preserved; B stayed open and held.
- Staging D1 contained exactly the two expected lifecycle events, both tied to
  the verified owner. The release event recorded `transferCreated=false`.
- Staging payment, notification, email-outbox, and Identity-session counts
  remained zero. No provider was approved and no insurer notice was asserted.
- An unauthenticated request still redirected to Cloudflare Access. Production
  health at 14:26:26 UTC remained on `3eb2871`, with application/database/schema
  ready and customer requests/payments closed.

This closes the deployed **owner resolution and hold-release** technical check.
Do not rerun it by recreating the fixtures. Still outstanding: owner review of
the complete process, a hosted participant upload, notification delivery,
insurer/source review, and any separately authorized Stripe test. The earlier
local rehearsal covers incident creation and customer/provider denial. Neither
result establishes a complete claims exercise or approves a launch gate.

### Hosted staging evidence link/read rehearsal

Workflow `36252778621` successfully deployed branch commit
`262bfae1d55fcd0bd2a6b10d6d2656a562c00442` to the existing private staging
environment. One 600-by-260 PNG labeled **SYNTHETIC TEST IMAGE / No vehicle or
personal information** was uploaded to the existing private staging R2 bucket.
One clearly labeled fixture row, `rehearsal-photo-20260926`, was inserted only
for the existing persisted test assignment. No previous record was overwritten.
This direct fixture setup was not a hosted participant upload.

Through the actual owner form, linked that record to `rehearsal-b-20260926` at
15:45:31 UTC and opened its private image in a new tab. Independent D1 reads
confirmed the original reference remained, B stayed open and held, A's earlier
resolution/timestamp/hold stayed unchanged, and exactly one verified-owner
`incident_evidence_linked` event was appended with `transferCreated=false`.
Payment, notification, outbox, and Identity-session counts stayed zero. The
test provider remains new/not reviewed. An unauthenticated image request
redirected to Cloudflare Access instead of returning the file. R2 public access
remains disabled. The successful staging workflow identifies the deployed head;
direct navigation to staging health was blocked by the browser.

Local proof: `incident-evidence-staging-20260926.json` and the two screenshots
named in that artifact. Preserve the existing test fixtures for later review.
This proves deployed owner linking and private R2 retrieval only; it does not
approve any insurance, participant evidence, live job, or launch gate.

The screenshot exposed a SQLite UTC/local-time display error. Both evidence
screens now normalize stored SQLite timestamps before localization; browser
regressions use SQLite-shaped values under America/New_York. Staging run
`36253800061` passed at `f5e1556`, and a read-only page reload confirmed the
correct 11:44:54 AM display with the existing link and hold preserved. Final
screenshot: `incident-evidence-staging-final-20260926.png`.

**[OWNER]** Whether the insurer wants to see the rehearsal record. Several
carriers do, and it is easier to produce during the rehearsal than to reconstruct.

## What this plan does not cover

- **Data exposure, account takeover, and vendor breach** — that is
  [`security-and-data-incident-plan.md`](security-and-data-incident-plan.md).
- **Whether Tuveloz carries the cover to tender to at all** — the insurance gate,
  still unanswered.
- **Fault, liability, and settlement.** Those are determinations. This plan
  preserves the facts that let someone else make them.
