# Security and data incident plan

- **Status:** draft — needs owner sign-off and security-reviewer review
- **Owner:** hello@tuveloz.com
- **Last reviewed:** 2026-08-11
- **Applies to:** the `security_and_data_incident_plan` launch gate

What to do when Tuveloz data is exposed, an account is taken over, or a vendor
reports a breach. Written to be followed under pressure by whoever is available,
not read for the first time during an incident.

**This is a draft.** Three things in it are marked **[OWNER]** because only the
owner can supply them, and the gate cannot be answered until they are filled in
and a security or privacy reviewer has reviewed the result. The gate also names
its official source: Md. Code, Com. Law § 14-3504, recorded in
`lib/launch-readiness.ts`. **Whether and how that statute applies to a given
incident is a legal question, not an operational one** — this plan tells you to
get that answer, not what it is.

## Who is responsible

**[OWNER] Incident lead:** the person who decides, and the only one who declares
an incident over. Today that is the owner by default, because there is nobody
else. Name a second person before launch — a plan with a single point of failure
fails when that point is asleep or unreachable.

**[OWNER] Escalation contacts**, with a real phone number each, not only email:

| Role | Who | Reachable at |
| --- | --- | --- |
| Incident lead | | |
| Deputy | | |
| Legal | | |
| Insurance / cyber cover | | |

Email alone is not an escalation path. If the incident is *in* the mail system —
Resend is the delivery vendor — email is exactly what you cannot rely on.

## What Tuveloz actually holds

Knowing this before an incident is most of the response.

| Store | Contains |
| --- | --- |
| D1 `tuveloz-db` | accounts and password credentials, customer requests and addresses, provider applications, identity-verification sessions, evidence submission records, privacy requests, audit and lifecycle events |
| R2 `tuveloz-uploads` | provider evidence files and job images — private bucket, never public |
| R2 `tuveloz-brand-video` | brand and ad assets. No personal data |

The most sensitive tables are `accountCredentials`,
`providerIdentityVerificationSessions`, `providerEvidenceSubmissions`, and
`customerRequests` — identity documents, credentials, and home addresses.

**Vendors that hold or process Tuveloz data:** Cloudflare (hosting, D1, R2),
Stripe (payments and identity verification), Resend (email delivery), and — once
configured — Cloudmersive (evidence scanning). Any of them can be the source of
an incident, and each has its own notification obligation to you.

## First hour

Do these in order. Speed matters less than not destroying the evidence.

**1. Write down the time and what you saw.** Start a plain file with a timestamp.
Every later step appends to it. This becomes the record of what was known when,
which is the thing you will be asked for and the thing nobody remembers.

**2. Preserve before you fix.** The instinct is to delete the bad thing. Do not.

- Do not delete D1 rows, R2 objects, or log lines until the lead says so.
- Do not rotate a secret before capturing which one leaked and where it appeared.
- Cloudflare Workers logs are not retained indefinitely — capture the relevant
  window to a file early.
- The audit tables (`providerAuditEvents`, `jobLifecycleEvents`,
  `jobAuthorizationEvents`, `stripeWebhookEvents`) are evidence. Never prune them
  during an incident.

R2 deletion in particular is unverifiable in the moment: `wrangler r2 object
delete` reports "Delete complete" whether or not it worked, and a `get` can serve
cached bytes for a key fetched earlier in the same session. Do not use either to
prove something is gone.

**3. Contain, narrowly.** Prefer the smallest action that stops the bleeding.

- A single compromised account: set `lockedUntil` on its `accountCredentials`
  row. Locking is reversible; deleting is not.
- A leaked secret: rotate it with `wrangler secret put` **after** recording where
  it was exposed. Rotation destroys the evidence of which value leaked.
- A vendor compromise: assume every credential shared with that vendor is
  exposed, not only the one named in their notice.
- Marketplace-wide exposure: the locks in `lib/launch-status.ts`,
  `lib/stripe.ts`, and `lib/phone-auth.ts` are already closed. That is why an
  incident today is smaller than it would be after launch — there are no live
  payments and no real customer jobs to unwind.

**4. Decide whether it is an incident at all.** A failed login is not an
incident. Unauthorised access to personal data, exposure of identity documents or
credentials, or a vendor breach notice is. If unsure, treat it as one and
downgrade later; the reverse is not available.

## Legal notice

**[OWNER] This is where the plan stops and counsel starts.** Maryland's breach
notification statute is the official source recorded against this gate
(Md. Code, Com. Law § 14-3504). Whether a given incident triggers it, what the
deadline is, who must be told, and in what form are legal determinations.

What operations must do is make that determination possible:

- Establish **what data, whose data, and how many people** — from the tables
  listed above, not from memory.
- Establish **when it started and when it stopped**, from the audit tables.
- Get the question to legal **the same day**, with those two answers attached.

Do not send a notification, a public statement, or a customer email describing an
incident before that determination. An early, wrong notice is its own harm.

## Vendor notification

Each vendor has a security contact and its own reporting route. Notify the
affected vendor when the incident touches their system, and record the ticket
reference in the incident file.

**[OWNER]** Confirm before launch whether any vendor contract imposes a
notification deadline on Tuveloz — several standard terms do — and record it
here. A contractual deadline can be shorter than a statutory one.

## After it is over

The incident is over when the lead says so, not when it goes quiet.

1. **Write what happened** in [`../LOG.md`](../LOG.md) — what happened, what was
   known when, what was decided, and what was wrong about the first assessment.
   The last one is the useful part.
2. **Fix the cause, not the symptom.** If a guard should have caught it, add the
   guard and verify it fails without the fix. A test that cannot fail proves
   nothing.
3. **Update this plan** with what did not work. A plan that survives an incident
   unchanged was probably not followed.
4. **Reset the gate's validity date** if the incident changed anything material —
   the launch gate carries an expiry, and an incident is exactly the event that
   should shorten it.

## What this plan does not cover

- **Vehicle incidents, injury, and stop-work** — that is a separate required
  gate, `vehicle_incident_claims_and_stop_work`, and a separate plan that does
  not exist yet.
- **Whether Tuveloz carries cyber cover.** **[OWNER]** — the insurance gate
  (`platform_and_service_insurance_bound`) is unanswered, so assume there is no
  cyber policy to call until that changes.
