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

-- ── Characters ──────────────────────────────────────────────────────────────
-- A saved character sheet per row. The full computed sheet lives in `data`
-- (jsonb); name/race/class/level are mirrored as columns for cheap listing.
create table if not exists public.characters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  race text,
  class text,
  level int not null default 1,
  data jsonb not null default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.characters enable row level security;

drop policy if exists "Users can read their own characters" on public.characters;
drop policy if exists "Users can create their own characters" on public.characters;
drop policy if exists "Users can update their own characters" on public.characters;
drop policy if exists "Users can delete their own characters" on public.characters;

create policy "Users can read their own characters"
  on public.characters for select to authenticated using (auth.uid() = user_id);
create policy "Users can create their own characters"
  on public.characters for insert to authenticated with check (auth.uid() = user_id);
create policy "Users can update their own characters"
  on public.characters for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can delete their own characters"
  on public.characters for delete to authenticated using (auth.uid() = user_id);

-- Refresh PostgREST's schema cache so the API sees changes immediately.
notify pgrst, 'reload schema';
