-- 0001_profiles.sql
--
-- The account table. One row per Tuveloz user, created the moment they pick a
-- side of the marketplace.
--
-- Identity comes from Firebase Authentication, not Supabase Auth, so `id`
-- holds the Firebase UID and every policy compares it against the `sub` claim
-- of the verified Firebase ID token. Supabase must have Firebase registered as
-- a third-party auth provider for `auth.jwt()` to be populated — see
-- supabase/README.md.

create type public.user_role as enum ('customer', 'provider');

create table public.profiles (
  -- Firebase UID. Deliberately not a generated key: making it the primary key
  -- means row-level security needs no extra lookup to authorise a request.
  id text primary key,
  role public.user_role not null,
  full_name text not null check (length(trim(full_name)) between 2 and 80),
  email text not null,
  phone text,
  avatar_url text,
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'One row per account. `id` is the Firebase UID from the ID token''s sub claim.';

-- Providers are looked up by role when matching requests to a service area.
create index profiles_role_idx on public.profiles (role);

-- Keep `updated_at` honest without trusting the client to send it.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row
  execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Row-level security
--
-- Default deny: with RLS enabled and no matching policy, a request returns
-- nothing. Each policy below opens exactly one operation for exactly the
-- account that owns the row.
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;

create policy profiles_select_own
  on public.profiles
  for select
  to authenticated
  using (id = auth.jwt() ->> 'sub');

create policy profiles_insert_own
  on public.profiles
  for insert
  to authenticated
  with check (id = auth.jwt() ->> 'sub');

create policy profiles_update_own
  on public.profiles
  for update
  to authenticated
  using (id = auth.jwt() ->> 'sub')
  with check (id = auth.jwt() ->> 'sub');

-- No delete policy on purpose. Account deletion is a privacy workflow with
-- retention rules attached, so it runs server-side with the service role
-- rather than being something the app can trigger directly.
