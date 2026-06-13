-- Chronicler database schema.
-- Run this in the Supabase SQL Editor to provision a fresh project.
-- Idempotent where practical so it's safe to re-run.

-- ── Profiles ────────────────────────────────────────────────────────────────
-- One row per auth user: their public username and chosen icon.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  avatar text not null default '🧙',
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;

drop policy if exists "Profiles are viewable by authenticated users" on public.profiles;
drop policy if exists "Users can create their own profile" on public.profiles;
drop policy if exists "Users can update their own profile" on public.profiles;

-- Any signed-in user can read profiles (usernames are needed for shared tables).
create policy "Profiles are viewable by authenticated users"
  on public.profiles for select to authenticated using (true);

-- Users may only create/update their own profile row.
create policy "Users can create their own profile"
  on public.profiles for insert to authenticated with check (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update to authenticated using (auth.uid() = id);

-- Refresh PostgREST's schema cache so the API sees changes immediately.
notify pgrst, 'reload schema';
