# Provider signup: choose services, see the checklist, then apply

- **Status:** implemented
- **Owner:** hello@tuveloz.com
- **Last reviewed:** 2026-09-05
- **Applies to:** English and Spanish provider signup

Applicants should understand what they are applying for and what happens next.
The September 5 revision starts with service choices, then shows the documents
and questions for those services, and finally collects business details and
required acknowledgments. Applicants can apply before their documents are
ready. Customer bookings and service activation still require approval.

## What changed

The first step explains the current application area and that bookings are not
open yet. Internal application-tier labels are no longer shown. County
registration guidance is available inside a collapsed detail in the checklist,
only when the existing requirement engine calls for that registration.

The checklist shows every required document once and identifies exactly which
selected services need it. Previously, only identical document sets were grouped:
battery replacement and A/C work repeated their shared county registration and
owner-operator attestation. Those services now produce four checklist items
instead of six, retaining the battery-handling plan and A/C certificate as
service-specific requirements.
This is a display change; it does not automatically reuse uploads or change
the evidence needed for each service review.

Unverified requirements use neutral bullets. Self-reported answers no longer
produce a claim that legal requirements are confirmed. Applicants who select
"Not yet" or "Not sure" are told they can continue and what still needs review.
The confirmation clearly separates receipt of an application, email verification,
and approval to provide services.

Background review flags no longer display an empty legal-question section for
photo-only work. The section and acknowledgment appear when there is an actual
applicable question. On phones, changing steps now moves focus and scrolls to
the next step below the fixed navigation, instead of leaving applicants below
the form when the next step is shorter.

## Current competitor reference points

Reviewed on September 5, 2026:

- [Taskrabbit's Tasker signup instructions](https://support.taskrabbit.com/hc/en-us/articles/46260467885979-How-Do-I-Become-a-Tasker)
  describe staged setup with skills and location, account details, and later
  identity verification. Tuveloz follows a clear sequence while keeping its
  own service-specific review rules.
- [Wrench's technician app listing, published by Wrench Inc.](https://play.google.com/store/apps/details?hl=en&id=com.wrench.techapp3)
  distinguishes signup, profile completion, and activation, and emphasizes
  provider control over schedules and service areas. Tuveloz likewise makes
  the application-to-approval distinction explicit.

These are usability reference points, not evidence of improved conversion or
proof that Tuveloz outperforms either business. No competitor's fees, earnings,
approval timelines, or legal requirements were copied into Tuveloz.

## Boundaries and verification

- Requirement selection and approval remain in the existing policy engine and
  server-side launch gates. The checklist does not make an eligibility decision.
- Required legal acknowledgments, W-9 information, recorded English acceptance
  text, and translation barriers remain unchanged. Platform safety/experience
  checks are identified alongside applicable paperwork rather than represented
  as laws that apply to everyone.
- Executable tests verify the exact document/service associations, all pairs of
  independently selectable services, changing selections, photo-only work,
  empty selections, and preservation of policy metadata.
- Release verification includes the full suite, typechecking, lint, actual
  English/Spanish form checks, and the existing isolated signup CI fixtures.

## Earlier proposal

PR #108 was closed unmerged on August 11 after its form implementation became
stale. It proposed an eligibility preview before business details. The current
revision was built against the current form instead of transplanting that diff.
It preserves the useful principle of explaining the next steps early while
waiting for service choices before showing requirements that depend on them.
