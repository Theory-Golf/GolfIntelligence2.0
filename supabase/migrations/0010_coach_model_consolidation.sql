-- 0010_coach_model_consolidation.sql
-- Collapses the two competing coach-player models into one, adds an admin
-- role, and closes a privilege-escalation hole.
--
-- ── WHY ───────────────────────────────────────────────────────────────
--
-- The database carried two unrelated answers to "which coach sees which
-- player", and each was wired to half the app:
--
--   Model A  team_members + profiles.role        -> every SELECT policy
--   Model B  coaches + coach_teams/coach_players -> every UPDATE policy
--
-- Nothing connected them, so a coach registered in one could read but not
-- edit, or edit but not read. Both were empty, so nothing broke; it simply
-- meant coach access had never worked end to end and had never been tested.
--
-- Model B is kept because it is the only one that can express assigning a
-- single player to a coach, not just a whole team. can_access_player() -- the
-- function every read already goes through -- is rewritten to read from it,
-- so reads and writes can no longer disagree.
--
-- ── THE RULE, IN ONE PLACE ────────────────────────────────────────────
--
-- You may access a player's data if you ARE that player, or you are an admin,
-- or you coach their team, or you hold a live direct assignment to them.
--
-- Coach authority comes from being listed in coach_teams / coach_players --
-- NOT from profiles.role. role is a UI hint plus the admin flag, nothing more.
-- That matters: see the privilege section at the bottom.
--
-- ── IDENTITY ──────────────────────────────────────────────────────────
--
-- Three tables described the same human: profiles (tied to auth.users),
-- players, and coaches (tied to nothing). coaches is dropped and the link
-- tables point at profiles, so "a coach" is now "someone who signed up and
-- was assigned players". team_members is dropped too -- players.team_id
-- already records the same fact, and a collegiate player is on one team.

-- ============================================================
-- 1. Identity: point the link tables at profiles, retire coaches
-- ============================================================

alter table public.coach_teams   drop constraint if exists coach_teams_coach_id_fkey;
alter table public.coach_players drop constraint if exists coach_players_coach_id_fkey;
alter table public.teams         drop constraint if exists teams_created_by_fkey;

alter table public.coach_teams
  add constraint coach_teams_coach_id_fkey
  foreign key (coach_id) references public.profiles (id) on delete cascade;

alter table public.coach_players
  add constraint coach_players_coach_id_fkey
  foreign key (coach_id) references public.profiles (id) on delete cascade;

alter table public.teams
  add constraint teams_created_by_fkey
  foreign key (created_by) references public.profiles (id) on delete set null;

-- Covering indexes for the lookups can_access_player() now performs on every
-- row-level check, plus two foreign keys the advisor flagged as unindexed.
create index if not exists coach_teams_coach_idx   on public.coach_teams (coach_id);
create index if not exists coach_players_coach_idx on public.coach_players (coach_id) where revoked_at is null;
create index if not exists players_team_idx        on public.players (team_id);
create index if not exists teams_created_by_idx    on public.teams (created_by);

-- ============================================================
-- 2. Roles: add admin
-- ============================================================

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check check (role in ('player', 'coach', 'admin'));

-- SECURITY DEFINER so it can read profiles without tripping profiles' own RLS
-- (which calls back into can_access_player -> is_admin).
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

-- ============================================================
-- 3. The one access rule
-- ============================================================

create or replace function public.can_access_player(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    -- yourself
    target = (select auth.uid())
    -- admin: full visibility, for support and troubleshooting
    or public.is_admin()
    -- you coach the team this player is on
    or exists (
      select 1
      from coach_teams ct
      join players p on p.team_id = ct.team_id
      where ct.coach_id = (select auth.uid())
        and p.id = target
    )
    -- you hold a direct, unrevoked assignment to this player
    or exists (
      select 1
      from coach_players cp
      where cp.coach_id = (select auth.uid())
        and cp.player_id = target
        and cp.revoked_at is null
    );
$$;

-- A deliberate seam. Editing currently follows access exactly: a coach may
-- correct their player's round. If view-only (e.g. assistant) coaches are ever
-- wanted, change THIS function only -- every write policy already calls it.
create or replace function public.can_edit_player(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.can_access_player(target);
$$;

-- ============================================================
-- 4. Replace every policy with one coherent set
--
-- Previously courses/rounds/holes/shots each carried two or three overlapping
-- permissive policies (granular + _own + a legacy FOR ALL catch-all). Postgres
-- ORs permissive policies, so the loosest always won and the effective rule was
-- unreadable. This drops all of them and defines exactly one policy per table
-- per command.
--
-- DELETE is deliberately narrower than the rest: owner or admin only. A coach
-- can correct a player's round but cannot destroy it. Widen later if wanted.
-- ============================================================

-- ── profiles ────────────────────────────────────────────────
drop policy if exists "profiles_select"     on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_select" on public.profiles
  for select using (public.can_access_player(id));
create policy "profiles_update_own" on public.profiles
  for update using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- ── players ─────────────────────────────────────────────────
drop policy if exists "players_select"      on public.players;
drop policy if exists "players_update_self" on public.players;
create policy "players_select" on public.players
  for select using (public.can_access_player(id));
create policy "players_update_self" on public.players
  for update using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- ── teams ───────────────────────────────────────────────────
drop policy if exists "teams_select"        on public.teams;
drop policy if exists "teams_select_member" on public.teams;
create policy "teams_select" on public.teams
  for select using (
    public.is_admin()
    or exists (select 1 from players p where p.id = (select auth.uid()) and p.team_id = teams.id)
    or exists (select 1 from coach_teams ct where ct.coach_id = (select auth.uid()) and ct.team_id = teams.id)
  );

-- ── schools ─────────────────────────────────────────────────
drop policy if exists "schools_select" on public.schools;
create policy "schools_select" on public.schools
  for select using (
    public.is_admin()
    or exists (
      select 1 from teams t
      where t.school_id = schools.id
        and (exists (select 1 from players p where p.id = (select auth.uid()) and p.team_id = t.id)
          or exists (select 1 from coach_teams ct where ct.coach_id = (select auth.uid()) and ct.team_id = t.id))
    )
  );

-- ── coach_teams / coach_players ─────────────────────────────
-- Read-only to the people involved. Assignments are made by an admin through
-- the dashboard or service role; there is no in-app management UI yet, so
-- granting insert/update here would be authority nobody needs.
drop policy if exists "coach_teams_select"   on public.coach_teams;
drop policy if exists "coach_players_select" on public.coach_players;
drop policy if exists "coach_players_insert" on public.coach_players;
drop policy if exists "coach_players_update" on public.coach_players;
create policy "coach_teams_select" on public.coach_teams
  for select using (public.is_admin() or coach_id = (select auth.uid()));
create policy "coach_players_select" on public.coach_players
  for select using (
    public.is_admin() or coach_id = (select auth.uid()) or player_id = (select auth.uid())
  );

-- ── courses ─────────────────────────────────────────────────
drop policy if exists "courses_select"           on public.courses;
drop policy if exists "courses_insert"           on public.courses;
drop policy if exists "courses_update"           on public.courses;
drop policy if exists "courses_insert_own"       on public.courses;
drop policy if exists "courses_update_own"       on public.courses;
drop policy if exists "courses_delete_own"       on public.courses;
drop policy if exists "users manage own courses" on public.courses;
create policy "courses_select" on public.courses
  for select using (
    public.is_admin()
    or (player_id is not null and public.can_access_player(player_id))
    or (school_id is not null and exists (
          select 1 from teams t
          where t.school_id = courses.school_id
            and (exists (select 1 from players p where p.id = (select auth.uid()) and p.team_id = t.id)
              or exists (select 1 from coach_teams ct where ct.coach_id = (select auth.uid()) and ct.team_id = t.id))))
  );
create policy "courses_insert" on public.courses
  for insert with check (player_id is not null and public.can_edit_player(player_id));
create policy "courses_update" on public.courses
  for update using (player_id is not null and public.can_edit_player(player_id));
create policy "courses_delete" on public.courses
  for delete using (public.is_admin() or player_id = (select auth.uid()));

-- ── rounds ──────────────────────────────────────────────────
drop policy if exists "rounds_select"           on public.rounds;
drop policy if exists "rounds_insert"           on public.rounds;
drop policy if exists "rounds_update"           on public.rounds;
drop policy if exists "rounds_delete"           on public.rounds;
drop policy if exists "rounds_insert_own"       on public.rounds;
drop policy if exists "rounds_update_own"       on public.rounds;
drop policy if exists "rounds_delete_own"       on public.rounds;
drop policy if exists "users manage own rounds" on public.rounds;
create policy "rounds_select" on public.rounds
  for select using (public.can_access_player(player_id));
create policy "rounds_insert" on public.rounds
  for insert with check (public.can_edit_player(player_id));
create policy "rounds_update" on public.rounds
  for update using (public.can_edit_player(player_id));
create policy "rounds_delete" on public.rounds
  for delete using (public.is_admin() or player_id = (select auth.uid()));

-- ── holes ───────────────────────────────────────────────────
drop policy if exists "holes_select"           on public.holes;
drop policy if exists "holes_insert"           on public.holes;
drop policy if exists "holes_update"           on public.holes;
drop policy if exists "holes_write_own"        on public.holes;
drop policy if exists "users manage own holes" on public.holes;
create policy "holes_select" on public.holes
  for select using (exists (
    select 1 from rounds r where r.id = holes.round_id and public.can_access_player(r.player_id)));
create policy "holes_insert" on public.holes
  for insert with check (exists (
    select 1 from rounds r where r.id = holes.round_id and public.can_edit_player(r.player_id)));
create policy "holes_update" on public.holes
  for update using (exists (
    select 1 from rounds r where r.id = holes.round_id and public.can_edit_player(r.player_id)));
-- holes and shots previously had NO explicit delete policy; deletes worked only
-- through the FOR ALL catch-alls now being dropped. Round editing deletes shots
-- (roundSession.tsx), so these must exist.
create policy "holes_delete" on public.holes
  for delete using (exists (
    select 1 from rounds r
    where r.id = holes.round_id
      and (public.is_admin() or r.player_id = (select auth.uid()))));

-- ── shots ───────────────────────────────────────────────────
drop policy if exists "shots_select"           on public.shots;
drop policy if exists "shots_insert"           on public.shots;
drop policy if exists "shots_update"           on public.shots;
drop policy if exists "shots_write_own"        on public.shots;
drop policy if exists "users manage own shots" on public.shots;
create policy "shots_select" on public.shots
  for select using (exists (
    select 1 from holes h join rounds r on r.id = h.round_id
    where h.id = shots.hole_id and public.can_access_player(r.player_id)));
create policy "shots_insert" on public.shots
  for insert with check (exists (
    select 1 from holes h join rounds r on r.id = h.round_id
    where h.id = shots.hole_id and public.can_edit_player(r.player_id)));
create policy "shots_update" on public.shots
  for update using (exists (
    select 1 from holes h join rounds r on r.id = h.round_id
    where h.id = shots.hole_id and public.can_edit_player(r.player_id)));
-- Deleting a shot is part of normal round editing for the player who owns it,
-- and for a coach correcting that round -- so this one follows can_edit_player,
-- unlike deleting a whole round.
create policy "shots_delete" on public.shots
  for delete using (exists (
    select 1 from holes h join rounds r on r.id = h.round_id
    where h.id = shots.hole_id and public.can_edit_player(r.player_id)));

-- ── drill_sessions ──────────────────────────────────────────
drop policy if exists "drill_sessions_select"     on public.drill_sessions;
drop policy if exists "drill_sessions_insert_own" on public.drill_sessions;
drop policy if exists "drill_sessions_update_own" on public.drill_sessions;
drop policy if exists "drill_sessions_delete_own" on public.drill_sessions;
create policy "drill_sessions_select" on public.drill_sessions
  for select using (public.can_access_player(player_id));
-- Practice results are written by the player playing the drill, never on their
-- behalf, so these stay owner-only rather than following can_edit_player.
create policy "drill_sessions_insert_own" on public.drill_sessions
  for insert with check (player_id = (select auth.uid()));
create policy "drill_sessions_update_own" on public.drill_sessions
  for update using (player_id = (select auth.uid()));
create policy "drill_sessions_delete_own" on public.drill_sessions
  for delete using (public.is_admin() or player_id = (select auth.uid()));

-- ── edit audit tables ───────────────────────────────────────
-- Unused by the app so far. Their old select policies had no ownership test at
-- all; scope them to the same rule as the row they describe.
drop policy if exists "round_edits_select" on public.round_edits;
drop policy if exists "round_edits_insert" on public.round_edits;
drop policy if exists "hole_edits_select"  on public.hole_edits;
drop policy if exists "hole_edits_insert"  on public.hole_edits;
drop policy if exists "shot_edits_select"  on public.shot_edits;
drop policy if exists "shot_edits_insert"  on public.shot_edits;
create policy "round_edits_select" on public.round_edits
  for select using (exists (
    select 1 from rounds r where r.id = round_edits.round_id and public.can_access_player(r.player_id)));
create policy "round_edits_insert" on public.round_edits
  for insert with check (edited_by = (select auth.uid()));
create policy "hole_edits_select" on public.hole_edits
  for select using (exists (
    select 1 from holes h join rounds r on r.id = h.round_id
    where h.id = hole_edits.hole_id and public.can_access_player(r.player_id)));
create policy "hole_edits_insert" on public.hole_edits
  for insert with check (edited_by = (select auth.uid()));
create policy "shot_edits_select" on public.shot_edits
  for select using (exists (
    select 1 from shots s join holes h on h.id = s.hole_id join rounds r on r.id = h.round_id
    where s.id = shot_edits.shot_id and public.can_access_player(r.player_id)));
create policy "shot_edits_insert" on public.shot_edits
  for insert with check (edited_by = (select auth.uid()));

-- ============================================================
-- 5. Close the self-promotion hole
--
-- profiles_update_own / players_update_self let a user write their OWN row --
-- correct, and needed for the display-name and benchmark-gender settings. But
-- `authenticated` held UPDATE on every column, including profiles.role and
-- players.team_id. A player could therefore set role = 'coach' (or, once this
-- migration lands, 'admin') and set team_id to any team, then read every
-- teammate's rounds, shots and practice data.
--
-- It was inert only because can_access_player() read the empty team_members
-- table. Populating a real roster would have made it live.
--
-- RLS cannot express "this row but not that column", so the fix is column-level
-- privileges: revoke UPDATE wholesale, grant it back only on the fields a user
-- may set about themselves. role, team_id, is_active and the timestamps are now
-- settable only by an admin via the dashboard or service role, which are not
-- bound by these grants.
-- ============================================================

revoke update on public.profiles from authenticated;
grant  update (display_name, gender) on public.profiles to authenticated;

revoke update on public.players from authenticated;
grant  update (display_name, graduation_year) on public.players to authenticated;

-- ============================================================
-- 6. Retire the replaced model
-- ============================================================

drop policy if exists "team_members_select_member" on public.team_members;
drop policy if exists "coaches_select"             on public.coaches;
drop policy if exists "coaches_update_self"        on public.coaches;

drop function if exists public.is_team_member(uuid);
drop function if exists public.get_my_coach_team_ids();

drop table if exists public.team_members;
drop table if exists public.coaches;

-- ============================================================
-- 7. Pin search_path on the remaining trigger functions
-- Pre-existing advisor warnings, unrelated to this change but trivial to clear
-- now that the security surface is being reviewed anyway.
-- ============================================================

alter function public.set_updated_at()                set search_path = public;
alter function public.set_drill_sessions_updated_at() set search_path = public;
alter function public.shots_no_play_after_holed()     set search_path = public;
