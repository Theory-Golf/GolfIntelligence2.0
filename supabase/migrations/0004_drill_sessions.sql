-- 0004_drill_sessions.sql
-- PlayerPath practice results.
--
-- One generic table for every practice result: each game keeps its own
-- scoring logic and writes its own shape into `payload`. `drill_type` is the
-- activity id from web/src/data/practiceActivities.ts ('inside-ten',
-- 'wedge-standard', …), plus 'practice-session' for a completed plan session.
--
-- `client_id` is generated on the device when the session is created, and
-- (player_id, drill_type, client_id) is unique — so every write can be an
-- upsert. Retrying a queued write, flushing after reconnect, and re-running
-- the one-time localStorage upload are all no-ops instead of duplicate rows.
--
-- NOTE: this table already exists in the live project, created by hand and
-- never checked in. This file reproduces it exactly and is idempotent, so it
-- can be applied over the existing table without changing it.

-- ============================================================
-- updated_at trigger function
-- ============================================================
create or replace function public.set_drill_sessions_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================
-- drill_sessions
-- ============================================================
create table if not exists public.drill_sessions (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references auth.users (id) on delete cascade,
  drill_type text not null,
  payload jsonb not null,
  client_id uuid not null,
  played_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint drill_sessions_player_id_drill_type_client_id_key
    unique (player_id, drill_type, client_id)
);

-- Primary read path: a player's runs of one drill, newest first.
create index if not exists drill_sessions_player_drill_idx
  on public.drill_sessions using btree (player_id, drill_type, played_at desc);

-- Payload is queried ad hoc while game result shapes are still settling.
create index if not exists drill_sessions_payload_gin_idx
  on public.drill_sessions using gin (payload);

drop trigger if exists drill_sessions_set_updated_at on public.drill_sessions;
create trigger drill_sessions_set_updated_at
  before update on public.drill_sessions
  for each row execute function public.set_drill_sessions_updated_at();

-- ============================================================
-- Row-level security
--
-- Writes are self-only. Reads go through can_access_player (0001), so a
-- coach on the same team can see their players' practice results — the same
-- rule the rounds/shots tables use in 0002.
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
