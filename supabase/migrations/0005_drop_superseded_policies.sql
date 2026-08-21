-- 0005_drop_superseded_policies.sql
-- Align a fresh build with production.
--
-- 0002_rls_data_tables.sql creates a set of "_own" policies on courses,
-- rounds, holes, and shots. Production no longer has any of them: they were
-- superseded by the coach-aware granular policies (courses_insert,
-- rounds_delete, holes_update, shots_update, ...) captured in 0000_baseline,
-- and dropped from the live project without a migration to record it.
--
-- 0002 was never updated to match, so applying the tracked chain to a clean
-- database produced EIGHT policies production does not have. Because Postgres
-- ORs policies together, that made a rebuilt environment strictly more
-- permissive than production — the worst direction for a difference to run in,
-- and invisible until someone tested authorization against a local rebuild.
--
-- Dropping them is a no-op against production (they are already gone) and
-- makes a clean build match. 0002 is left as-is: it is the real history of
-- what was applied at the time, and rewriting it would misrepresent that.

drop policy if exists "courses_insert_own" on public.courses;
drop policy if exists "courses_update_own" on public.courses;
drop policy if exists "courses_delete_own" on public.courses;

drop policy if exists "rounds_insert_own" on public.rounds;
drop policy if exists "rounds_update_own" on public.rounds;
drop policy if exists "rounds_delete_own" on public.rounds;

drop policy if exists "holes_write_own" on public.holes;

drop policy if exists "shots_write_own" on public.shots;
