# 0005. Feature-first layout with a one-way dependency rule

**Status:** Accepted
**Date:** 2026-08-05

## Context

The app has four phases of features ahead of it across two distinct user types.
A layout that works at ten files has to still work at four hundred, and the
usual failure mode — `components/`, `hooks/`, `utils/` folders that every part
of the app reaches into — makes it impossible to tell what a change affects.

## Decision

Organise by **feature**, with a strict one-way dependency rule.

```
src/
├── app/            Routes. View state only.
├── features/       Feature-owned logic: repositories, validation, hooks, local components
├── components/ui/  The design system, imported through a barrel
├── providers/      Cross-cutting React context
├── lib/            Infrastructure: env, errors, result, logger, firebase, supabase
├── theme/          Design tokens
├── types/          Shared types, including the database schema
└── constants/      Copy and values reused across screens
```

Rules:

1. **Dependencies point downward only:** routes → features → lib. A lib module
   never imports a feature or a route.
2. **Features do not import each other.** When two need the same thing, it
   moves down into `lib` or `components/ui`.
3. **All database access goes through a repository** in the owning feature.
   No `supabase.from(...)` in a screen.
4. **Screens never import `firebase/*`.** They use `src/lib/firebase/auth.ts`.
5. **Repositories translate between the database and the domain** —
   `snake_case` rows in, `camelCase` objects out.

## Consequences

- The blast radius of a change is visible from the import graph. Touching
  `features/quotes` cannot break `features/vehicles`.
- Deleting a feature is deleting a folder.
- Swapping an infrastructure provider is contained: replacing Supabase means
  rewriting the repositories, not every screen.
- Rule 5 costs a small amount of mapping boilerplate per table, and buys the
  freedom to rename a column without touching a screen.
- Some judgement is needed on where a component belongs. The test: if two
  features would use it, it goes in `components/ui`; if one does, it stays in
  that feature.
- Route files stay thin. A screen with substantial logic in it is a signal that
  the logic belongs in a hook or repository under `features/`.

## Alternatives considered

**Layer-first (`components/`, `hooks/`, `services/` at the top).** Familiar and
fine at small scale, but every folder grows without bound and nothing shows
which parts belong together.

**Strict Clean Architecture with explicit domain/use-case layers.** More
ceremony than a two-sided marketplace CRUD app needs; the repository boundary
already provides the important seam.
