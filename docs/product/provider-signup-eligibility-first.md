# Provider signup: show eligibility before asking for choices

- **Status:** draft
- **Owner:** hello@tuveloz.com
- **Last reviewed:** 2026-08-11
- **Applies to:** provider signup form, provider landing page

Records the reasoning from pull request #108, which was closed unmerged on
2026-08-11 because its code had gone stale. The problem it identified is real
and unfixed; this document keeps the thinking so it can be rebuilt against the
current form rather than rediscovered.

## The problem

The provider flow asks an applicant to choose services before telling them
whether they qualify or what will be reviewed. Someone who does not know
whether they are eligible is being asked to commit to specifics first, and the
application itself sits behind repeated promotional content on the landing
page. The order is backwards: the question a prospective provider arrives with
is "can I do this at all", and the flow answers it last.

## What was proposed

1. **Reframe the provider call to action as a requirements check** rather than
   an invitation to apply. The applicant's first question is eligibility, so
   the entry point should answer that.
2. **A short three-step eligibility path before business details**, so the
   applicant learns where they stand before filling in anything specific.
3. **A registration or credential-review cue next to each selected service**,
   so the consequence of a selection is visible at the moment it is made
   rather than discovered at the upload step.
4. **Say plainly that an applicant may apply before their documents are
   complete**, while job access stays disabled until approval.
5. **Remove nonessential marketing sections that sit ahead of the application**
   on the provider landing page.

## What has since landed

Point 4 shipped on 2026-08-10 by a different route. The form now shows the
count of distinct documents a selection requires, with the line "You don't need
them right now. The next step shows you exactly which ones." Anyone reviving
this work should treat point 4 as done and check the others against the current
form before assuming they are still missing.

## Why the original pull request was not rebased

#108 branched at `724fa7a` and edited 67 lines of
`app/components/provider-signup-form.tsx`. Seven commits touched that file
afterwards — the document-count preview, the signup lineage reconciliation, the
legal-only requirements and W-9 step, and the clickwrap translation barrier in
#123. The file it was written against no longer exists in that shape, and two
separate stale branches that day produced diffs that appeared to delete live
features purely because they were behind. Rebuilding against the current form
is cheaper and safer than transplanting the diff.

## Constraints on any rebuild

- An eligibility preview must not become an eligibility *decision*. Approval
  stays server-side in `config/provider-eligibility-matrix.json` and the
  launch-readiness gates; a friendlier front end must not imply a provider is
  cleared for a service they have not been approved for.
- The legal acknowledgments are clickwrap evidence. They sit inside
  `data-manual-language` and a local `data-no-interface-translation` barrier
  (#123) because the backend records the exact English text presented. Do not
  move, reorder, or translate them while restructuring the steps around them.
- Requirements shown must stay legally-required-only, including every IRS
  obligation. Do not let a "simpler" eligibility screen quietly drop the W-9
  step or add requirements that no law imposes.
