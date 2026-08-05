# Contributing

Conventions for this codebase. They apply equally to human and AI contributors.

## Workflow

1. Branch from `main`. Never commit to `main` directly.
   ```bash
   git checkout -b feature/customer-service-request
   ```
2. Keep commits small and focused — one reviewable idea each.
3. Run `npm run verify` before every commit. It runs typecheck, lint and the
   format check, which is exactly what a CI job would run.
4. Update [`PROJECT_STATUS.md`](../PROJECT_STATUS.md) when a major feature
   lands.
5. Write an ADR when you make a decision that would be expensive to reverse.

## Before you change something that already works

This project has more than one contributor, including more than one AI. That
makes a few habits load-bearing:

- **Read [`PROJECT_STATUS.md`](../PROJECT_STATUS.md) first.** It says what is
  done and what is deliberately left undone.
- **Check [`decisions/`](decisions/) before reworking an approach.** If a
  decision looks wrong, write a new ADR that supersedes the old one — do not
  silently reverse it.
- **Do not rewrite a completed feature without a stated reason.** Refactoring
  working code costs review time and risks regressions.
- **Do not delete existing work** unless it is genuinely obsolete, and say so
  in the commit message.

## Code conventions

### Structure

- Routes in `src/app` hold view state only. Business logic lives in
  `src/features/<feature>`.
- Dependencies point downward: routes → features → lib. Never the reverse.
- Features do not import each other. Shared code moves down into `lib` or
  `components/ui`.
- All database access goes through a repository. No `supabase.from(...)` in a
  screen.
- Screens never import `firebase/*`. Use `src/lib/firebase/auth.ts`.

### TypeScript

- `strict` is on, along with `noUncheckedIndexedAccess`. Handle the
  `undefined` — do not silence it with `!`.
- Prefer type aliases over interfaces for anything crossing a library boundary.
  Interfaces do not get implicit index signatures, which silently breaks
  supabase-js inference (this actually happened — see the note in
  `src/types/database.ts`).
- Use `import type` for type-only imports. `verbatimModuleSyntax` requires it.

### Naming

- Files: `kebab-case.ts` / `kebab-case.tsx`.
- Components: `PascalCase`. Hooks: `useCamelCase`.
- Database columns: `snake_case`. Domain objects: `camelCase`. Repositories do
  the conversion.

### Styling

Utility classes over `StyleSheet`, tokens over raw values. See
[DESIGN_SYSTEM.md](DESIGN_SYSTEM.md).

### Errors

- Service functions return `Result<T>`, they do not throw.
- Translate SDK errors at the boundary into `AppError`.
- Error messages shown to users must be plain and actionable. No error codes,
  no stack traces, no jargon.

### Logging

Use `logger`, never `console` directly. **Never log personal data** — no
emails, phone numbers, addresses, photos or message contents. Log identifiers
and error codes.

## Security expectations

This app handles vehicle locations, photos of people's property, private
messages and eventually payments. Treat it accordingly.

- Only publishable identifiers go in `EXPO_PUBLIC_*`. Everything in there ships
  inside the binary and is readable by anyone who installs the app.
- Authorisation is enforced by Postgres row-level security, not by app code.
  Every new table gets RLS enabled and a policy in the same migration.
- Never write a policy that grants access to `anon`, and never use the
  service-role key in the app.
- Auth responses must not reveal whether an account exists for an address.

## Adding a database table

1. Write `supabase/migrations/000N_<name>.sql` — create the table, enable RLS,
   and add its policies **in the same file**. A migration that enables RLS
   without policies locks the table; one that creates a table without RLS
   exposes it.
2. Add the row types to `src/types/database.ts` (type aliases, not interfaces).
3. Add a repository under the owning feature.
4. Note the change in `PROJECT_STATUS.md`.

Migrations are append-only. To change something, add a new numbered migration.

## Writing an ADR

Copy the shape of an existing file in [`decisions/`](decisions/): Status,
Context, Decision, Consequences, Alternatives considered. Number it in
sequence. An ADR records _why_, so the next person does not have to re-derive
it — or accidentally undo it.
