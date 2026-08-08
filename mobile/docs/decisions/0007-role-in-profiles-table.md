# 0007. Role lives in a `profiles` row, not a Firebase custom claim

**Status:** Accepted
**Date:** 2026-08-05

## Context

Every account is either a customer or a provider, and that choice drives
navigation, permissions and the whole shape of the app. It has to be stored
somewhere that both the app and Postgres can read.

Three candidates: a Firebase custom claim baked into the ID token, a row in the
Supabase database, or local device storage.

## Decision

The role is a column on a `profiles` row, keyed by the Firebase UID.

The row is created when the user chooses a role, immediately after sign-up.
Until it exists, the session is in the `needsRole` state and the router sends
the user to the role screen.

**A missing profile row is the definition of "has not chosen yet."** No
separate flag, no onboarding progress counter.

## Consequences

- **Interrupted sign-up resumes correctly.** An account that quits the app
  between creating a Firebase user and choosing a role comes back to the role
  screen, because the state is derived from data rather than from navigation
  history or a local flag.
- **RLS can use it.** A policy on any future table can join to `profiles` and
  check the role — impossible with a claim Postgres cannot see without extra
  configuration.
- **Changing a role does not require a token refresh.** With a custom claim,
  the change only takes effect after the ID token is refreshed, which is
  confusing to debug.
- **Setting a custom claim needs the Firebase Admin SDK**, which needs a
  server. There is no server yet, and this decision avoids needing one.
- **Cost: one extra round trip on launch.** After Firebase reports a user, the
  app fetches the profile before it can route. The splash screen is held until
  both resolve, so the user sees one wait rather than a flash of the wrong
  screen.
- **Cost: offline cold start does not work.** With no cached profile, a user
  who opens the app offline lands on the error state with a retry. Caching the
  profile is a known Phase 2 improvement.

## One account, one role

An account serves one side of the marketplace. Someone who is both a customer
and a provider needs two accounts.

This is a deliberate simplification for launch — it keeps navigation, policies
and notification routing unambiguous while the product is being figured out.
The schema does not prevent revisiting it: `role` could become a set of roles
without changing the storage decision recorded here. Until then the role
selection screen says so plainly, and support handles changes.

## Alternatives considered

**Firebase custom claim.** No extra round trip on launch, and the role travels
inside the token. Rejected: it requires a server to set, needs a token refresh
to change, and Postgres cannot use it in a policy without extra work.

**Local device storage.** Fast and offline-friendly, but it is per-device and
client-controlled — reinstalling the app would lose it, and it cannot be
trusted for authorisation.
