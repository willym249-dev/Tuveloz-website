# Architecture

How the Tuveloz app is put together, and the rules that keep it that way as it
grows.

## The shape of the system

```
┌──────────────────────────────────────────────┐
│  src/app/          Routes (Expo Router)      │  What the user sees
├──────────────────────────────────────────────┤
│  src/features/     Feature logic + repos     │  What the app does
├──────────────────────────────────────────────┤
│  src/components/ui Design system             │  How it looks
│  src/providers/    React context             │
├──────────────────────────────────────────────┤
│  src/lib/          env, errors, Firebase,    │  How it talks to the world
│                    Supabase, logging         │
└──────────────────────────────────────────────┘
          │                        │
   Firebase Auth            Supabase (Postgres)
   (who you are)            (everything else)
```

**Dependencies point downward only.** A route may import a feature, a UI
component or a lib module. A lib module must never import a route or a feature.
This is what keeps the bottom of the stack testable and replaceable.

## Layer by layer

### `src/app` — routes

File-based routing via Expo Router. The file tree _is_ the URL structure, so
the navigation model is readable without opening a single file:

```
src/app/
├── _layout.tsx              Providers, splash handling, root Stack
├── index.tsx                The routing gate — decides where a session belongs
├── +not-found.tsx
├── (auth)/                  Signed-out stack.       /welcome, /sign-in, …
├── (onboarding)/            Signed in, no role yet. /role
├── customer/                Customer tabs.          /customer, /customer/requests, …
└── provider/                Provider tabs.          /provider, /provider/jobs, …
```

Parenthesised directories are _route groups_: they organise files without
appearing in the URL. `customer/` and `provider/` are real path segments
instead, so the two areas can both have an `account` screen without colliding,
and deep links read unambiguously.

Screens hold view state (form values, which tab is open) and nothing else.
Anything that outlives the screen belongs in a provider or a repository.

### `src/features` — feature logic

Each feature owns its own folder: repositories, validation, hooks and any
components that only make sense inside it.

```
src/features/
├── auth/       validation.ts
└── profile/    profile-repository.ts, components/account-screen.tsx
```

A feature may depend on `lib` and on the design system. Features should not
import each other; when two need the same thing, that thing moves down into
`lib` or `components/ui`.

### `src/components/ui` — the design system

Every primitive the app is built from. Always import through the barrel:

```ts
import { Button, Card, Screen, Text } from '@/components/ui';
```

See [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md).

### `src/lib` — infrastructure

| Module      | Responsibility                                      |
| ----------- | --------------------------------------------------- |
| `env.ts`    | Validates configuration at startup and fails loudly |
| `errors.ts` | `AppError` — one error type with user-safe messages |
| `result.ts` | `Result<T>` for anything that touches the network   |
| `logger.ts` | The seam a crash reporter will plug into            |
| `cn.ts`     | Class name merging                                  |
| `firebase/` | App init, auth API, error translation               |
| `supabase/` | The typed client                                    |

## Authentication and authorisation

Two services, one identity.

```
  Sign in ──▶ Firebase Auth ──▶ ID token (JWT, sub = Firebase UID)
                                     │
                                     ▼
                        supabase.accessToken() hands the
                        token to every Supabase request
                                     │
                                     ▼
                        Postgres RLS: id = auth.jwt() ->> 'sub'
```

Firebase answers _who are you_. Supabase answers _what may you see_, enforced
in the database by row-level security rather than in app code. A bug in a
screen cannot leak another account's data, because the query never returns it.

Consequence: `supabase.auth.*` is unavailable — supabase-js disables its own
auth namespace when a custom `accessToken` is supplied. All identity operations
go through `src/lib/firebase/auth.ts`.

Setup details in [`../supabase/README.md`](../supabase/README.md); rationale in
[ADR 0004](decisions/0004-firebase-auth-with-supabase-rls.md).

## Session and routing

`SessionProvider` (`src/providers/session-provider.tsx`) subscribes to Firebase
auth state, loads the matching profile row, and reduces both into one value:

```ts
type Session =
  | { status: 'loading' }
  | { status: 'signedOut' }
  | { status: 'needsRole'; … }   // signed in, no profile row yet
  | { status: 'ready'; profile }  // signed in, role known
  | { status: 'error'; message }
```

`src/app/index.tsx` is the only place that turns a session into a destination.
Every route group also guards itself, but a guard only ever redirects back to
`/` — it never decides where to send someone. One rule, one location.

This is also why `needsRole` exists as a first-class state: an account that
quits the app between creating a Firebase user and picking a role resumes
exactly where it left off, because the state is derived from data rather than
from navigation history.

## Error handling

Service functions return `Result<T>` instead of throwing:

```ts
const result = await signIn(email, password);
if (!result.ok) {
  setFormError(result.error.message); // already user-safe
  return;
}
```

SDK-specific errors are translated at the boundary — `toFirebaseAuthError` and
`toSupabaseError` map provider codes onto the app's own `AppErrorCode` union.
Nothing above `src/lib` and the repositories ever sees a Firebase or PostgREST
error shape. Programmer errors (impossible states, bad arguments) still throw.

## Data access

All database access goes through a repository in the owning feature — never
`supabase.from(...)` in a screen. Repositories also convert `snake_case` rows
into `camelCase` domain objects, so a column rename touches one file.

The schema lives in `supabase/migrations` as numbered, append-only SQL. Types
in `src/types/database.ts` mirror it by hand today and can be swapped for
generated types once the schema settles.

## Configuration

`EXPO_PUBLIC_*` variables are compiled into the shipped bundle and are readable
by anyone who installs the app. Only publishable identifiers belong there —
Firebase web config, the Supabase anon key. Real secrets (service-role key,
Stripe secret key) belong to a server and must never enter this codebase.

`src/lib/env.ts` validates the whole set at import time with Zod, so a missing
value is a clear startup error naming the key, not a confusing failure later.

## Build variants

`app.config.ts` reads `APP_VARIANT` (`development` | `preview` | `production`)
and varies the app name and bundle identifier, so all three can be installed
side by side on one device.
