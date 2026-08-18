-- 0005_drill_sessions.sql
-- Generic Supabase-backed history store for all PlayerPath practice drills
-- (Inside Ten, Inside Twenty, Winners Circle, Lag Putt Test, Line Test,
-- Driver Standard, Wedge Standard, Approach Standard, Round Simulation,
-- and the Practice Planner). One row per completed drill session; the
-- drill-specific result shape is opaque JSON so new drills never require
-- a schema migration -- they just add a new drill_type value.

create table if not exists public.drill_sessions (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references auth.users (id) on delete cascade,
  drill_type text not null,
  payload jsonb not null,
  -- Client-generated id from the drill's local session object. Lets
  -- upsert-by-client-id survive offline-queue retries and the local-history
  -- migration without duplicating rows.
  client_id uuid not null,
  played_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (player_id, drill_type, client_id)
);

create index if not exists drill_sessions_player_drill_idx
  on public.drill_sessions (player_id, drill_type, played_at desc);

create index if not exists drill_sessions_payload_gin_idx
  on public.drill_sessions using gin (payload);

create or replace function public.set_drill_sessions_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists drill_sessions_set_updated_at on public.drill_sessions;
create trigger drill_sessions_set_updated_at
  before update on public.drill_sessions
  for each row execute function public.set_drill_sessions_updated_at();

-- ============================================================
-- RLS -- same shape as 0002_rls_data_tables.sql: owner read/write,
-- coach read via can_access_player() (defined in 0001_profiles_teams.sql).
-- No coach-write policy, matching rounds/shots.
-- ============================================================
alter table public.drill_sessions enable row level security;

drop policy if exists "drill_sessions_select" on public.drill_sessions;
create policy "drill_sessions_select" on public.drill_sessions
  for select using (public.can_access_player(player_id));

drop policy if exists "drill_sessions_insert_own" on public.drill_sessions;
create policy "drill_sessions_insert_own" on public.drill_sessions
  for insert with check (player_id = (select auth.uid()));

drop policy if exists "drill_sessions_update_own" on public.drill_sessions;
create policy "drill_sessions_update_own" on public.drill_sessions
  for update using (player_id = (select auth.uid()));

drop policy if exists "drill_sessions_delete_own" on public.drill_sessions;
create policy "drill_sessions_delete_own" on public.drill_sessions
  for delete using (player_id = (select auth.uid()));
