# Counsel Review Packet: Tuveloz Dispute-Resolution and Liability Terms

**Prepared:** August 6, 2026
**Purpose:** A self-contained packet for a flat-fee / limited-scope attorney
review of two sections of the Tuveloz Terms of Use. Everything the reviewer
needs is in this one document, so the engagement can be scoped to a single
document review rather than a from-scratch drafting project.

---

## 1. What Tuveloz is (30-second context for the reviewer)

Tuveloz is a pre-launch, Maryland-based two-sided marketplace connecting
vehicle owners with independent vehicle-service provider businesses. Tuveloz
is not the service provider: an accepted quote forms a direct
customer–provider contract, Tuveloz charges a 5% customer-side platform fee
on completed jobs, quotes are labor-only (customers buy parts themselves),
and payments run through Stripe Connect. No service is live yet; no real
customer job or live payment has occurred.

**Assent mechanics (relevant to enforceability):** account signup, job
requests, provider applications, and checkout each require an affirmative
checkbox and record a timestamped, versioned acceptance
(`terms:2026-08-06|…` bundle strings). A release manifest binds each policy
version to a SHA-256 hash of the exact published page source, so Tuveloz can
prove byte-for-byte which terms text any given user accepted, and when.

## 2. The two sections under review

The live drafts are in the repository at `app/terms/page.tsx` (rendered at
`/terms`). Summarized:

### Terms §12 — Liability cap

- Total liability capped at the **greater of $100 or platform fees Tuveloz
  collected from the user in the 12 months** before the event the claim is
  about.
- Express exclusion of indirect, incidental, and consequential damages
  (lost profits, loss of use).
- Carve-outs: does not apply to Tuveloz's own fraud or willful misconduct;
  does not limit any right, duty, or remedy the law does not permit
  limiting.

### Terms §13 — Dispute resolution and arbitration

- **Mandatory pre-dispute informal resolution:** 60-day notice-and-conference
  window, both directions, with limitations periods tolled during the
  window.
- **Small-claims carve-out:** either party may proceed in small claims court
  for individual claims.
- **Binding individual arbitration** for everything else: single arbitrator,
  AAA Consumer Arbitration Rules, FAA governs. Consumer chooses in-county,
  video, or (under $10,000) documents-only hearing. Courts, not the
  arbitrator, decide enforceability of the section.
- **Consumer fee protection:** consumer filing fee capped at equivalent
  court filing cost; Tuveloz pays remaining AAA/arbitrator fees; each side
  bears its own attorneys' fees unless law or AAA rules provide otherwise.
- **Class-action and jury waiver**, with a blow-up clause: if a court holds
  the class waiver unenforceable as to a claim, that claim proceeds in
  court and the remainder stays in arbitration.
- **Mass-arbitration batching:** 25+ coordinated demands resolved in staged
  batches of up to 50 under AAA mass-arbitration procedures, per-batch
  fees, optional global mediation after the first batch, tolling for
  queued demands.
- **30-day opt-out** by email from the account address, without loss of
  platform access.
- **Preserved rights:** government-agency reporting (FTC, Maryland AG),
  non-waivable rights and remedies; prospective application only (binds
  only acceptances of the version containing the section); survival clause.
- **Governing law / forum:** Maryland law; Maryland state and federal courts
  for non-arbitrable matters.

## 3. Specific questions for counsel (the review checklist)

1. **Maryland unconscionability:** Do §12 and §13 survive Maryland's
   procedural/substantive unconscionability analysis for consumer
   contracts? Any Maryland-specific case law on marketplace platform terms
   we should adjust for?
2. **Cap level:** Is "greater of $100 or 12 months of platform fees"
   defensible given the platform fee is 5% of labor only (so 12-month fees
   for a one-job customer may be small)? Should the floor be higher?
3. **Personal injury:** Vehicle work can produce personal-injury claims.
   Does §12 need an express personal-injury carve-out under Maryland law
   (beyond the general "rights the law doesn't let us limit" language)?
4. **Assent flow:** Is the checkbox + versioned-acceptance flow described in
   §1 sufficient for clickwrap enforceability, including for the
   arbitration section specifically? Any change needed to checkbox label
   text (it currently references the Terms by link)?
5. **Opt-out mechanics:** Is the 30-day email opt-out administrable as
   written? Should Tuveloz be required to acknowledge opt-outs in writing?
6. **Tolling promise:** §13 promises limitations tolling during the 60-day
   window and batching queue — confirm this is enforceable as a contractual
   tolling agreement in Maryland.
7. **Mass-arbitration batching:** Does the batching provision align with the
   AAA's current Mass Arbitration Supplementary Rules, and does the
   blow-up/severability language interact correctly with it?
8. **Provider-side application:** Providers are businesses, not consumers —
   should provider disputes run under AAA Commercial rather than Consumer
   rules, and does that need a split in §13?
9. **Prospective-only application:** Any users who accepted the pre-§13
   terms need re-acceptance before their disputes are covered. Confirm the
   planned re-acceptance-at-next-transaction approach is sufficient.
10. **Interaction with Stripe/payment-network rules:** Anything in §13 that
    conflicts with chargeback rights or Stripe's connected-account
    agreements that must be carved out?

## 4. Operational prerequisites (independent of legal review)

- **AAA Consumer Clause Registry:** the AAA will not administer consumer
  arbitrations unless the business's clause is submitted to and registered
  in the AAA Consumer Clause Registry (initial review fee, annual renewal).
  This must be done before the clause is relied on, or the small print
  points to a forum that won't take the case — a common way platforms lose
  the benefit of an otherwise valid clause.
- **Re-acceptance gate:** ensure the product forces re-acceptance of the
  2026-08-06 terms for any account created before that date, before their
  next transaction.
- **Opt-out log:** keep a simple, durable record (mailbox label or table)
  of arbitration opt-outs keyed to account email and date.

## 5. Low-cost routes to a Maryland review

- **Maryland State Bar Association Lawyer Referral Service** — referral to a
  local attorney, typically with a reduced-fee initial consultation.
- **Limited-scope ("unbundled") representation** — Maryland permits
  limited-scope engagements; ask specifically for a flat-fee single-document
  review of this packet.
- **Law school small-business clinics** — University of Maryland Carey Law
  and University of Baltimore Law both operate transactional/small-business
  clinics that take Maryland small businesses at little or no cost.
- **Maryland Volunteer Lawyers Service (MVLS)** — income-qualified
  small-business owners may be eligible for free counsel.

A reviewer working from this packet should be able to complete the pass in
about an hour. The output Tuveloz needs is: (a) confirm/adjust the ten items
in §3, and (b) a yes/no on relying on §12–§13 once the AAA registry filing
is done.
