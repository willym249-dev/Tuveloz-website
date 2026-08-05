# Decision log

The index of this project's architecture decision records. Each ADR lives in
[`decisions/`](decisions/) and records one decision that would be expensive to
reverse: the context at the time, what was chosen, and what that costs.

Read these before reworking an approach. If a decision turns out to be wrong,
write a new ADR that supersedes the old one and mark the old one superseded —
do not edit history or silently reverse it.

| #                                                            | Decision                                                       | Status   |
| ------------------------------------------------------------ | -------------------------------------------------------------- | -------- |
| [0001](decisions/0001-project-location.md)                   | The app lives in `mobile/` but shares no code with the website | Accepted |
| [0002](decisions/0002-expo-and-expo-router.md)               | Expo with Expo Router for the app framework                    | Accepted |
| [0003](decisions/0003-nativewind-for-styling.md)             | NativeWind over design tokens for styling                      | Accepted |
| [0004](decisions/0004-firebase-auth-with-supabase-rls.md)    | Firebase for identity, Supabase RLS for authorisation          | Accepted |
| [0005](decisions/0005-feature-first-source-layout.md)        | Feature-first layout with a one-way dependency rule            | Accepted |
| [0006](decisions/0006-result-types-at-service-boundaries.md) | Service functions return `Result`, they do not throw           | Accepted |
| [0007](decisions/0007-role-in-profiles-table.md)             | Role lives in a `profiles` row, not a Firebase custom claim    | Accepted |

## Format

```markdown
# NNNN. Title

**Status:** Proposed | Accepted | Superseded by NNNN
**Date:** YYYY-MM-DD

## Context

What was true when this was decided.

## Decision

What was chosen.

## Consequences

What this costs and what it makes easy.

## Alternatives considered

What else was on the table, and why it lost.
```
