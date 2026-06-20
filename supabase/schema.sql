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

-- ── Campaigns ───────────────────────────────────────────────────────────────
-- A DM's campaign with a free-text "setting bible" (lore) that grounds
-- AI-generated homebrew. One row per campaign, owned by the creating user.
create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  lore text not null default '',
  -- Structured setting bible: { overview, factions[], locations[], npcs[], hooks[] }.
  -- Built by the AI world builder and/or edited by hand. `lore` remains free-text notes.
  world jsonb not null default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
-- Safe to re-run on an existing table that predates the `world` column.
alter table public.campaigns add column if not exists world jsonb not null default '{}';

alter table public.campaigns enable row level security;

drop policy if exists "Users can read their own campaigns" on public.campaigns;
drop policy if exists "Users can create their own campaigns" on public.campaigns;
drop policy if exists "Users can update their own campaigns" on public.campaigns;
drop policy if exists "Users can delete their own campaigns" on public.campaigns;

create policy "Users can read their own campaigns"
  on public.campaigns for select to authenticated using (auth.uid() = user_id);
create policy "Users can create their own campaigns"
  on public.campaigns for insert to authenticated with check (auth.uid() = user_id);
create policy "Users can update their own campaigns"
  on public.campaigns for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can delete their own campaigns"
  on public.campaigns for delete to authenticated using (auth.uid() = user_id);

-- Link characters to a campaign (a character belongs to at most one). Defined
-- here (not in the characters block above) because it references campaigns.
-- ON DELETE SET NULL: deleting a campaign unlinks its party, never deletes them.
alter table public.characters add column if not exists campaign_id uuid references public.campaigns(id) on delete set null;

-- ── Homebrew items ──────────────────────────────────────────────────────────
-- AI-generated (or hand-saved) homebrew belonging to a campaign. The full item
-- payload lives in `data` (jsonb); name/kind are mirrored for cheap listing.
create table if not exists public.homebrew_items (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  kind text,
  data jsonb not null default '{}',
  created_at timestamptz default now()
);

alter table public.homebrew_items enable row level security;

drop policy if exists "Users can read their own homebrew" on public.homebrew_items;
drop policy if exists "Users can create their own homebrew" on public.homebrew_items;
drop policy if exists "Users can update their own homebrew" on public.homebrew_items;
drop policy if exists "Users can delete their own homebrew" on public.homebrew_items;

create policy "Users can read their own homebrew"
  on public.homebrew_items for select to authenticated using (auth.uid() = user_id);
create policy "Users can create their own homebrew"
  on public.homebrew_items for insert to authenticated with check (auth.uid() = user_id);
create policy "Users can update their own homebrew"
  on public.homebrew_items for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can delete their own homebrew"
  on public.homebrew_items for delete to authenticated using (auth.uid() = user_id);

-- ── Game sessions ───────────────────────────────────────────────────────────
-- A planned (or played) game session for a campaign. `plan` holds the AI/DM
-- session plan (recap, beats, encounters, NPCs, threads); `notes` is freeform.
create table if not exists public.game_sessions (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Untitled session',
  session_date date,
  plan jsonb not null default '{}',
  notes text not null default '',
  status text not null default 'planned', -- planned | played
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.game_sessions enable row level security;

drop policy if exists "Users can read their own sessions" on public.game_sessions;
drop policy if exists "Users can create their own sessions" on public.game_sessions;
drop policy if exists "Users can update their own sessions" on public.game_sessions;
drop policy if exists "Users can delete their own sessions" on public.game_sessions;

create policy "Users can read their own sessions"
  on public.game_sessions for select to authenticated using (auth.uid() = user_id);
create policy "Users can create their own sessions"
  on public.game_sessions for insert to authenticated with check (auth.uid() = user_id);
create policy "Users can update their own sessions"
  on public.game_sessions for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can delete their own sessions"
  on public.game_sessions for delete to authenticated using (auth.uid() = user_id);

-- ── Encounters ──────────────────────────────────────────────────────────────
-- A saved encounter (combat / social / exploration) for a campaign. Full
-- payload in `data` (jsonb); name/kind mirrored for listing.
create table if not exists public.encounters (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  kind text,
  data jsonb not null default '{}',
  created_at timestamptz default now()
);

alter table public.encounters enable row level security;

drop policy if exists "Users can read their own encounters" on public.encounters;
drop policy if exists "Users can create their own encounters" on public.encounters;
drop policy if exists "Users can update their own encounters" on public.encounters;
drop policy if exists "Users can delete their own encounters" on public.encounters;

create policy "Users can read their own encounters"
  on public.encounters for select to authenticated using (auth.uid() = user_id);
create policy "Users can create their own encounters"
  on public.encounters for insert to authenticated with check (auth.uid() = user_id);
create policy "Users can update their own encounters"
  on public.encounters for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can delete their own encounters"
  on public.encounters for delete to authenticated using (auth.uid() = user_id);

-- ── NPCs ────────────────────────────────────────────────────────────────────
-- A saved NPC for a campaign. Full payload in `data` (jsonb); name/role mirrored.
create table if not exists public.npcs (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  role text,
  data jsonb not null default '{}',
  created_at timestamptz default now()
);

alter table public.npcs enable row level security;

drop policy if exists "Users can read their own npcs" on public.npcs;
drop policy if exists "Users can create their own npcs" on public.npcs;
drop policy if exists "Users can update their own npcs" on public.npcs;
drop policy if exists "Users can delete their own npcs" on public.npcs;

create policy "Users can read their own npcs"
  on public.npcs for select to authenticated using (auth.uid() = user_id);
create policy "Users can create their own npcs"
  on public.npcs for insert to authenticated with check (auth.uid() = user_id);
create policy "Users can update their own npcs"
  on public.npcs for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can delete their own npcs"
  on public.npcs for delete to authenticated using (auth.uid() = user_id);

-- Refresh PostgREST's schema cache so the API sees changes immediately.
notify pgrst, 'reload schema';
