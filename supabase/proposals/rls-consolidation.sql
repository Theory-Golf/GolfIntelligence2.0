-- rls-consolidation.sql — PROPOSAL, NOT A MIGRATION. NOT APPLIED.
--
-- This file deliberately lives outside supabase/migrations/ so that
-- `supabase db push` cannot sweep it up. Do not move it back until the
-- decision below has been made and the change has been reviewed on its own.
--
-- ── WHY IT WAS MOVED ──────────────────────────────────────────────────
--
-- This started life as 0008_drop_superseded_policies.sql, and its header
-- asserted that production no longer had any of the eight "_own" policies
-- below -- that they had been dropped by hand, that 0002 was simply never
-- updated to match, and that therefore applying this file was a no-op
-- against production.
--
-- That was wrong. Checked against the live project on 2026-08-22, all eight
-- are present:
--
--   select policyname from pg_policies
--   where schemaname = 'public'
--     and policyname in ('courses_insert_own','courses_update_own',
--       'courses_delete_own','rounds_insert_own','rounds_update_own',
--       'rounds_delete_own','holes_write_own','shots_write_own');
--   -- 8 rows
--
-- So running this is a real authorization change, not the harmless
-- reconciliation the old header described. A file that says "safe to run"
-- while sitting in the folder a push command executes is worse than no file,
-- which is why it now lives here instead.
--
-- ── WHAT IS ACTUALLY TRUE ─────────────────────────────────────────────
--
-- courses, rounds, holes and shots each carry two or three overlapping
-- permissive policies: the granular coach-aware set from 0000_baseline, the
-- "_own" set from 0002_rls_data_tables, and an older catch-all
-- "users manage own X" FOR ALL. Postgres ORs permissive policies together,
-- so the loosest always wins. Today all three layers happen to grant the same
-- thing to a player acting on their own rows, so behaviour is correct -- but
-- the rules are far harder to reason about than they should be, and the
-- overlap is what produces the 85 multiple_permissive_policies warnings in
-- Supabase's performance advisor.
--
-- ── READ BEFORE RUNNING ANY OF THIS ───────────────────────────────────
--
-- 1. holes and shots have NO explicit DELETE policy. Deleting a shot works
--    only through the FOR ALL catch-alls ("users manage own holes/shots" and
--    holes_write_own / shots_write_own). deleteShot is on the live round-entry
--    path (web/src/lib/golf/roundSession.tsx). Dropping shots_write_own alone
--    is survivable because "users manage own shots" still covers DELETE --
--    but any consolidation that removes BOTH generations must add explicit
--    holes_delete and shots_delete FIRST, or round editing breaks silently.
--
-- 2. There are two coach models, and they disagree about who a coach is:
--
--      can_access_player()  -> team_members + profiles.role = 'coach'
--                              (used by every _select policy)
--      granular policies    -> coach_teams / coach_players
--                              (used by the _update / _insert policies)
--
--    Both are empty (0 rows) and no application code reads either. Picking one
--    is a product decision and must come before consolidation, otherwise this
--    file just deletes half of an arrangement nobody has chosen yet.
--
-- 3. There is no populated team data to test against, so a consolidation
--    cannot currently be verified for the coach case at all -- only for the
--    player-acting-on-own-rows case. Seed a team first.
--
-- ── THE PROPOSED CHANGE ───────────────────────────────────────────────
--
-- Dropping the "_own" generation, leaving the granular coach-aware set plus
-- the legacy catch-alls. This is the smallest useful step and preserves owner
-- CRUD via the catch-alls. It is NOT the end state -- the catch-alls should go
-- too, once (1) and (2) above are resolved.

drop policy if exists "courses_insert_own" on public.courses;
drop policy if exists "courses_update_own" on public.courses;
drop policy if exists "courses_delete_own" on public.courses;

drop policy if exists "rounds_insert_own" on public.rounds;
drop policy if exists "rounds_update_own" on public.rounds;
drop policy if exists "rounds_delete_own" on public.rounds;

drop policy if exists "holes_write_own" on public.holes;

drop policy if exists "shots_write_own" on public.shots;
