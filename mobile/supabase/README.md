# Supabase setup

The app's database. Identity comes from Firebase — see
[ADR 0004](../docs/decisions/0004-firebase-auth-with-supabase-rls.md) — so the
setup below has one step that is easy to miss and breaks everything if skipped.

## 1. Create the project

Create a Supabase project and copy the project URL and the **anon** key from
Project settings → API into `mobile/.env`:

```
EXPO_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon key>
```

The **service-role** key must never be used by the app. It bypasses row-level
security entirely.

## 2. Register Firebase as a third-party auth provider

**Do not skip this.** Without it, `auth.jwt()` is empty inside Postgres, every
policy denies every request, and the app shows "You do not have access to that"
for everything.

In the Supabase dashboard: **Authentication → Sign In / Providers →
Third-Party Auth → Add provider → Firebase**, and supply the Firebase project
ID from `EXPO_PUBLIC_FIREBASE_PROJECT_ID`.

Supabase then verifies incoming Firebase ID tokens against Google's public keys
and populates `auth.jwt()`, whose `sub` claim is the Firebase UID.

## 3. Apply the migrations

Run the files in [`migrations/`](migrations) in numerical order. Either paste
them into the SQL editor, or use the Supabase CLI:

```bash
supabase link --project-ref <ref>
supabase db push
```

| Migration           | What it does                                                           |
| ------------------- | ---------------------------------------------------------------------- |
| `0001_profiles.sql` | `user_role` enum, `profiles` table, `updated_at` trigger, RLS policies |

Migrations are **append-only**. To change something, add a new numbered file.

## 4. Check it works

With the app running and a user signed in, the role selection screen should
write a `profiles` row. If it fails with a permission error, work through this
list in order:

1. Is the Firebase third-party provider registered (step 2)?
2. Does the Firebase project ID in Supabase match the one in `.env`?
3. Is the user actually signed in? A missing token means the request arrives as
   `anon`, and no policy grants `anon` anything.
4. Does the row's `id` equal the Firebase UID? The insert policy requires
   `id = auth.jwt() ->> 'sub'`.

Useful check in the SQL editor, run as an authenticated request:

```sql
select auth.jwt() ->> 'sub' as firebase_uid;
```

## Conventions for new tables

Every migration that creates a table must, in the same file:

1. `alter table … enable row level security;`
2. Add the policies that make it usable.

A table with RLS enabled and no policies is unusable. A table without RLS is
readable by anyone holding the anon key — which is everyone with the app
installed. Neither is acceptable; both are easy to do by accident, which is why
they belong in one file.

Policies grant to `authenticated`, never to `anon`.
