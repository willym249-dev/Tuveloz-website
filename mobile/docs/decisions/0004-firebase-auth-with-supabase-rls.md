# 0004. Firebase for identity, Supabase RLS for authorisation

**Status:** Accepted
**Date:** 2026-08-05

## Context

The stack specifies Firebase Authentication _and_ Supabase as the database.
Both products ship their own auth system, so using both raises an immediate
question: if Firebase issues the identity, how does Postgres know who is
asking?

Getting this wrong is the most consequential kind of bug this app can have.
Customers upload photos of their vehicles and share their locations; providers
share business details and earnings. A leak between accounts is not a cosmetic
failure.

## Decision

**Firebase answers "who are you". Supabase answers "what may you see", and it
answers in the database.**

Supabase is configured with Firebase as a **third-party auth provider**. The
Supabase client is created with an `accessToken` hook that returns the current
Firebase ID token:

```ts
export const supabase = createClient<Database>(url, anonKey, {
  accessToken: async () => await getIdToken(),
});
```

Every request then carries a verified Firebase JWT. Row-level security policies
authorise against its subject claim:

```sql
create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = auth.jwt() ->> 'sub');
```

The Firebase UID is used directly as the primary key of `profiles`, so a policy
needs no extra lookup to authorise.

**Every table gets RLS enabled and its policies in the same migration that
creates it.** Tables default to deny.

## Consequences

- Authorisation is enforced by Postgres, not by app code. A bug in a screen
  cannot leak another account's data, because the query returns nothing.
- `supabase.auth.*` is unavailable — supabase-js disables its own auth
  namespace when a custom `accessToken` is supplied and throws if it is
  touched. All identity operations go through `src/lib/firebase/auth.ts`. This
  is a good constraint: there is exactly one way to sign in.
- Token freshness is Firebase's problem. It caches the ID token and refreshes
  it near expiry, so calling `getIdToken()` per request is cheap.
- **Setup dependency:** Supabase must have the Firebase project registered as a
  third-party provider, or `auth.jwt()` is empty and every policy denies
  everything. This is the most likely cause of a blanket
  `data/permission-denied`. Steps in `supabase/README.md`.
- Two services to configure, monitor and pay for. Accepted: Firebase Auth is
  mature and free at this scale, and Supabase's Postgres is a better fit for
  marketplace data (relations, constraints, transactional integrity) than
  Firestore.
- The service-role key must never appear in the app. Anything needing it
  belongs to a server — relevant from Phase 4 onward, when Stripe arrives.

## Alternatives considered

**Supabase Auth alone.** Simplest — one service, RLS out of the box. Rejected
because Firebase Auth was specified, and it brings a stronger identity feature
set (managed email flows, phone auth, App Check) if it is needed later.

**Firebase alone, with Firestore.** One service, but gives up SQL. A
marketplace is relational — requests, quotes, jobs, messages, payouts — and
Firestore makes those joins and invariants painful.

**Sync Firebase users into Supabase Auth via a webhook.** Keeps native Supabase
sessions but adds a stateful sync that can drift, plus a server to run it. The
third-party auth integration achieves the same thing with no moving parts.
