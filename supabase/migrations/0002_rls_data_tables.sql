-- 0002_rls_data_tables.sql
-- Canonical row-level security for the four data tables.
-- Players read/write their own rows; coaches additionally read rows for
-- every player on their team (via can_access_player from 0001).
--
-- NOTE: the live project may already have policies that were created by
-- hand and never checked in. This file is idempotent (drop-then-create)
-- so it can be applied over them; review `select * from pg_policies`
-- before running in production.

alter table public.courses enable row level security;
alter table public.rounds enable row level security;
alter table public.holes enable row level security;
alter table public.shots enable row level security;

-- ============================================================
-- courses
-- ============================================================
drop policy if exists "courses_select" on public.courses;
create policy "courses_select" on public.courses
  for select using (public.can_access_player(player_id));

drop policy if exists "courses_insert_own" on public.courses;
create policy "courses_insert_own" on public.courses
  for insert with check (player_id = (select auth.uid()));

drop policy if exists "courses_update_own" on public.courses;
create policy "courses_update_own" on public.courses
  for update using (player_id = (select auth.uid()));

drop policy if exists "courses_delete_own" on public.courses;
create policy "courses_delete_own" on public.courses
  for delete using (player_id = (select auth.uid()));

-- ============================================================
-- rounds
-- ============================================================
drop policy if exists "rounds_select" on public.rounds;
create policy "rounds_select" on public.rounds
  for select using (public.can_access_player(player_id));

drop policy if exists "rounds_insert_own" on public.rounds;
create policy "rounds_insert_own" on public.rounds
  for insert with check (player_id = (select auth.uid()));

drop policy if exists "rounds_update_own" on public.rounds;
create policy "rounds_update_own" on public.rounds
  for update using (player_id = (select auth.uid()));

drop policy if exists "rounds_delete_own" on public.rounds;
create policy "rounds_delete_own" on public.rounds
  for delete using (player_id = (select auth.uid()));

-- ============================================================
-- holes (ownership via parent round)
-- ============================================================
drop policy if exists "holes_select" on public.holes;
create policy "holes_select" on public.holes
  for select using (
    exists (
      select 1 from public.rounds r
      where r.id = round_id
        and public.can_access_player(r.player_id)
    )
  );

drop policy if exists "holes_write_own" on public.holes;
create policy "holes_write_own" on public.holes
  for all using (
    exists (
      select 1 from public.rounds r
      where r.id = round_id
        and r.player_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.rounds r
      where r.id = round_id
        and r.player_id = (select auth.uid())
    )
  );

-- ============================================================
-- shots (ownership via hole -> round)
-- ============================================================
drop policy if exists "shots_select" on public.shots;
create policy "shots_select" on public.shots
  for select using (
    exists (
      select 1
      from public.holes h
      join public.rounds r on r.id = h.round_id
      where h.id = hole_id
        and public.can_access_player(r.player_id)
    )
  );

drop policy if exists "shots_write_own" on public.shots;
create policy "shots_write_own" on public.shots
  for all using (
    exists (
      select 1
      from public.holes h
      join public.rounds r on r.id = h.round_id
      where h.id = hole_id
        and r.player_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.holes h
      join public.rounds r on r.id = h.round_id
      where h.id = hole_id
        and r.player_id = (select auth.uid())
    )
  );
