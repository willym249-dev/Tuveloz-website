# Vehicle incident, claims, and stop-work plan

- **Status:** draft — needs owner sign-off, insurer review, and an official-source check
- **Owner:** hello@tuveloz.com
- **Last reviewed:** 2026-08-11
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
authorization chain. Reference it in `evidenceReferences`. Do not delete a
message, image, or job record after an incident — the same rule as the security
plan, for the same reason.

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

Then write it up in [`../LOG.md`](../LOG.md): what happened, what was known
when, what was decided, and what the first assessment got wrong.

## Testing it, which the gate actually requires

The gate says the plan must be **tested**, not merely written. Testing it means
running a rehearsal against the real records with a test job — open an incident,
confirm the payment hold appears without anyone setting it, attach evidence,
record a stop time, then resolve and release. Test records are isolated from real
providers, customers, alerts, payments, and public profiles, so this is safe to
do now.

**[OWNER]** Whether the insurer wants to see the rehearsal record. Several
carriers do, and it is easier to produce during the rehearsal than to reconstruct.

## What this plan does not cover

- **Data exposure, account takeover, and vendor breach** — that is
  [`security-and-data-incident-plan.md`](security-and-data-incident-plan.md).
- **Whether Tuveloz carries the cover to tender to at all** — the insurance gate,
  still unanswered.
- **Fault, liability, and settlement.** Those are determinations. This plan
  preserves the facts that let someone else make them.
