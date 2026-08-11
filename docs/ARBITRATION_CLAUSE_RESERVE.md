# Reserved arbitration clause (not currently in effect)

Status: **shelved by owner decision (Option B), August 7, 2026.**
The live Terms of Use intentionally do not require arbitration: disputes with
Tuveloz go to the state or federal courts covering Montgomery County, Maryland.
This file preserves the fully drafted arbitration clause so it can be
reactivated when transaction volume makes class-action exposure worth the
AAA registry's annual fee.

## Why it was shelved

- The AAA Consumer Clause Registry charges an annual, non-refundable fee.
- With payments disabled and low early volume, class-action exposure is minimal.
- A clause naming the AAA while unregistered is worse than no clause: the AAA
  can refuse to administer (Consumer Rules R-12), and courts may then treat
  arbitration as waived entirely.

## Reactivation checklist (do ALL of these together)

1. Replace section 13 of `app/terms/page.tsx` with the clause below (adjust
   the section number if the Terms have been renumbered).
2. Bump `TERMS_VERSION` in `lib/policies.ts` so every acceptance bundle
   changes and all users re-accept.
3. Cut a new hash-bound release in `config/policy-releases.json`
   (recompute the sha256 of the normalized page source).
4. Register the clause with the AAA Consumer Clause Registry (adr.org)
   **before** the new Terms take effect — submit the exact live text, pay the
   registry fee, and calendar the annual renewal invoice at hello@tuveloz.com.
5. If the AAA requests wording changes during its Consumer Due Process
   Protocol review, update the site text and this file to match, and cut
   another release.

## The reserved clause

> **13. Resolving disputes with Tuveloz**
>
> Before starting arbitration or any other claim against Tuveloz, email
> hello@tuveloz.com with what happened and what you're asking for, and give us
> 60 days to try to work it out with you informally. That doesn't extend any
> legal filing deadline you have.
>
> If we can't resolve it informally, you and Tuveloz agree to resolve any
> dispute between you and Tuveloz through binding individual arbitration
> instead of a court trial. The arbitration is administered by the American
> Arbitration Association under its Consumer Arbitration Rules, is governed by
> the Federal Arbitration Act, and can award you the same individual relief a
> court could. Either side may instead bring an individual claim in
> small-claims court if it qualifies there.
>
> You and Tuveloz each waive the right to a jury trial and to participate in a
> class, collective, consolidated, or representative action against the other.
> If that class-action waiver turns out to be unenforceable for a particular
> claim, that claim goes to court instead of arbitration. This section covers
> disputes with Tuveloz only — a dispute between a customer and a provider
> belongs to their own service agreement.
>
> You can opt out of this arbitration agreement by emailing hello@tuveloz.com
> within 30 days of first accepting these Terms, with your name, your account
> email, and a statement that you're opting out of arbitration. Opting out
> doesn't change any other part of these Terms. Nothing in this section stops
> either side from asking a court for emergency relief to protect the platform
> or its users, and nothing here waives a right the law says can't be waived —
> including your right to raise a concern with a government agency.
>
> These Terms are governed by Maryland law, excluding its conflict-of-law
> rules, except that the Federal Arbitration Act governs this arbitration
> agreement. Any claim that belongs in court must be brought in the state or
> federal courts covering Montgomery County, Maryland, and both sides consent
> to those courts.

## Design notes (why the clause is shaped this way)

- **30-day opt-out** and **small-claims carve-out**: the two features that most
  reliably defeat unconscionability attacks.
- **AAA Consumer Rules**: the business pays most arbitration costs, which is
  required for consumer-clause enforceability.
- **Class-waiver severability**: if the waiver fails for a claim, that claim
  goes to court rather than dragging the whole clause down.
- **Non-waivable-rights preservation**: keeps courts from striking the section
  and preserves agency complaints (e.g., attorney general, FTC).
- The version accepted by users is hash-recorded per release, so assent can be
  proven for whichever version was in force.
