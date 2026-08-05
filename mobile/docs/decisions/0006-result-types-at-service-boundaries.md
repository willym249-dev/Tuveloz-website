# 0006. Service functions return `Result`, they do not throw

**Status:** Accepted
**Date:** 2026-08-05

## Context

Almost every meaningful action in this app can fail for reasons that are not
bugs: no signal, a wrong password, an expired token, a rejected RLS policy. On
mobile these are routine, not exceptional.

With thrown exceptions, the failure path is invisible in a function's type. It
is easy to forget a `try`/`catch` and ship a screen that shows a spinner
forever, and easy to render a raw Firebase message like
`auth/invalid-credential` to a customer.

## Decision

Anything that touches the network returns an explicit result:

```ts
type Result<T, E = AppError> = { ok: true; value: T } | { ok: false; error: E };
```

Call sites must narrow before reaching the value:

```ts
const result = await signIn(email, password);
if (!result.ok) {
  setFormError(result.error.message); // already user-safe
  return;
}
```

Supporting rules:

- **One error type.** `AppError` carries a stable `AppErrorCode` for branching
  and a message that is already safe to show a user.
- **Translate at the boundary.** `toFirebaseAuthError` and `toSupabaseError`
  map provider codes onto `AppErrorCode`. Nothing above `src/lib` and the
  repositories sees a Firebase or PostgREST error shape.
- **Programmer errors still throw.** An impossible state or a misused hook
  should crash loudly in development, not be handled.

## Consequences

- Failure is visible in every signature, and TypeScript will not let a caller
  skip it.
- Error copy is written once, next to the code that produces it, instead of
  being reinvented per screen.
- Swapping an SDK is a change to one mapping function, not to every call site.
- More verbose than `try`/`catch` — every call gets an `if (!result.ok)`. This
  is the intended trade: the check is the point.
- Two idioms coexist (`Result` for expected failure, `throw` for bugs). The
  line is "could this happen to a user on a bad connection?" — if yes, it is a
  `Result`.
- `attempt()` in `src/lib/result.ts` wraps a throwing SDK call into a `Result`
  with an optional error mapper, so adopting a new SDK is a one-liner.

## Alternatives considered

**Throw everywhere, catch in an error boundary.** Fine for rendering crashes,
useless for form-level feedback — a boundary cannot tell you the password was
wrong.

**A `fp-ts`-style Either with combinators.** More powerful, but adds a
functional vocabulary the whole team would have to learn for little gain in a
UI codebase.

**React Query.** Genuinely attractive and likely to be adopted for caching in
Phase 2, when there are lists worth caching. It complements this decision
rather than replacing it: the query function still needs a defined failure
shape.
