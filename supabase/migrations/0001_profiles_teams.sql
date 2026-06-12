-- 0001_profiles_teams.sql
-- Adds player profiles (display names + roles) and team/roster tables so
-- coaches can view every player on their team while players see only
-- their own data.

-- ============================================================
-- profiles: one row per auth user
-- ============================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  role text not null default 'player' check (role in ('player', 'coach')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Auto-create a profile when a user signs up. Display name comes from
-- signup metadata, falling back to the email local-part.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'display_name', ''),
      split_part(new.email, '@', 1)
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill profiles for accounts that existed before this migration.
insert into public.profiles (id, display_name)
select
  u.id,
  coalesce(
    nullif(u.raw_user_meta_data ->> 'display_name', ''),
    split_part(u.email, '@', 1)
  )
from auth.users u
on conflict (id) do nothing;

-- ============================================================
-- teams + team_members
-- ============================================================
create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.team_members (
  team_id uuid not null references public.teams (id) on delete cascade,
  player_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (team_id, player_id)
);

create index if not exists team_members_player_id_idx on public.team_members (player_id);

-- ============================================================
-- Access helpers (security definer so RLS policies on data tables
-- can call them without recursing into team_members policies)
-- ============================================================

-- True when the current user is the target player, or is a coach who
-- shares a team with the target player.
create or replace function public.can_access_player(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select target = (select auth.uid())
  or exists (
    select 1
    from team_members me
    join team_members them on them.team_id = me.team_id
    join profiles coach on coach.id = me.player_id
    where me.player_id = (select auth.uid())
      and them.player_id = target
      and coach.role = 'coach'
  );
$$;

-- True when the current user belongs to the given team.
create or replace function public.is_team_member(target_team uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from team_members
    where team_id = target_team
      and player_id = (select auth.uid())
  );
$$;

-- ============================================================
-- RLS for the new tables
-- ============================================================
alter table public.profiles enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;

drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles
  for select using (public.can_access_player(id));

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (id = (select auth.uid()));

drop policy if exists "teams_select_member" on public.teams;
create policy "teams_select_member" on public.teams
  for select using (public.is_team_member(id));

drop policy if exists "team_members_select_member" on public.team_members;
create policy "team_members_select_member" on public.team_members
  for select using (public.is_team_member(team_id));

-- Team and roster rows are managed via the Supabase dashboard / service
-- role for now (no roster-management UI), so no insert/update/delete
-- policies are defined for authenticated users.
