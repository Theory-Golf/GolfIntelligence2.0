-- 0000_baseline.sql
-- Baseline of the live schema, captured from production.
--
-- WHY THIS EXISTS
-- Most of this database was created by hand in the Supabase dashboard and
-- never checked in. Before this file, supabase/migrations/ described 4 of 18
-- objects, so a clean checkout could not rebuild the database and `db diff`
-- was meaningless. This is the catch-up snapshot.
--
-- Everything here is idempotent (`if not exists` / `or replace` /
-- drop-then-create for policies and triggers), so applying it to the live
-- project is a no-op. It runs first by filename; 0001-0008 then apply the
-- history that WAS tracked, and are also idempotent.
--
-- SNAPSHOT DATE: this captures production as of 2026-08-12. It has not been
-- recaptured since, so it is deliberately NOT the current shape of the
-- database -- the migrations that follow carry it the rest of the way. Most
-- visibly, drill_sessions.client_id is uuid here and 0006 widens it to text.
-- Treat this file as the historical floor, not as a description of today.
--
-- Regenerate by re-reading pg_catalog: pg_get_constraintdef, pg_indexes,
-- pg_get_functiondef, pg_get_triggerdef, pg_policy, pg_get_viewdef.
--
-- ── Two things worth knowing before you edit any policy here ──────────
--
-- 1. TWO GENERATIONS OF POLICY OVERLAP. courses, holes, rounds, and shots
--    each carry granular per-command policies AND an older catch-all
--    "users manage own X" FOR ALL policy. Postgres ORs policies together,
--    so the older one silently widens the newer ones. Likewise teams has
--    both `teams_select using (true)` and `teams_select_member`, where the
--    first makes the second irrelevant. Left exactly as production has it —
--    consolidating is a real change and needs its own review.
--
-- 2. `coaches`, `schools`, and `teams` are readable by every authenticated
--    user (`using (true)`). That is probably deliberate for reference data,
--    but it is worth a conscious confirmation rather than inheritance.
--
-- ── Coach/player modelling ────────────────────────────────────────────
-- There are two overlapping models: `team_members` + `profiles.role`, used by
-- can_access_player() and therefore by drill_sessions and profiles; and
-- `coaches` + `coach_players` + `coach_teams`, used by the rounds/shots/holes
-- and players policies. New work should consolidate, not add a third.

-- ============================================================
-- Tables
-- ============================================================

create table if not exists public.coach_players (
  coach_id uuid not null,
  player_id uuid not null,
  role text default 'instructor'::text not null,
  granted_at timestamp with time zone default now() not null,
  revoked_at timestamp with time zone
);

create table if not exists public.coach_teams (
  coach_id uuid not null,
  team_id uuid not null,
  role text default 'head'::text not null,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.coaches (
  id uuid not null,
  display_name text not null,
  email text not null,
  is_active boolean default true not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table if not exists public.courses (
  id uuid default gen_random_uuid() not null,
  school_id uuid,
  player_id uuid,
  name text not null,
  par_hole_1 smallint default 4 not null,
  par_hole_2 smallint default 4 not null,
  par_hole_3 smallint default 4 not null,
  par_hole_4 smallint default 4 not null,
  par_hole_5 smallint default 4 not null,
  par_hole_6 smallint default 4 not null,
  par_hole_7 smallint default 4 not null,
  par_hole_8 smallint default 4 not null,
  par_hole_9 smallint default 4 not null,
  par_hole_10 smallint default 4 not null,
  par_hole_11 smallint default 4 not null,
  par_hole_12 smallint default 4 not null,
  par_hole_13 smallint default 4 not null,
  par_hole_14 smallint default 4 not null,
  par_hole_15 smallint default 4 not null,
  par_hole_16 smallint default 4 not null,
  par_hole_17 smallint default 4 not null,
  par_hole_18 smallint default 4 not null,
  created_at timestamp with time zone default now() not null,
  created_by uuid,
  updated_at timestamp with time zone default now() not null
);

create table if not exists public.drill_sessions (
  id uuid default gen_random_uuid() not null,
  player_id uuid not null,
  drill_type text not null,
  payload jsonb not null,
  client_id uuid not null,
  played_at timestamp with time zone not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table if not exists public.ethos_papers (
  id uuid default gen_random_uuid() not null,
  slug text not null,
  title text not null,
  summary text not null,
  body_markdown text not null,
  pdf_path text,
  display_order integer default 0 not null,
  published_at timestamp with time zone,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table if not exists public.hole_edits (
  id uuid default gen_random_uuid() not null,
  hole_id uuid not null,
  edited_by uuid not null,
  edited_by_type text not null,
  edited_at timestamp with time zone default now() not null,
  field_name text not null,
  old_value text,
  new_value text,
  reason text
);

create table if not exists public.holes (
  id uuid not null,
  round_id uuid not null,
  hole_number smallint not null,
  par smallint not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table if not exists public.players (
  id uuid not null,
  team_id uuid,
  display_name text not null,
  graduation_year smallint,
  is_active boolean default true not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table if not exists public.profiles (
  id uuid not null,
  display_name text not null,
  role text default 'player'::text not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table if not exists public.round_edits (
  id uuid default gen_random_uuid() not null,
  round_id uuid not null,
  edited_by uuid not null,
  edited_by_type text not null,
  edited_at timestamp with time zone default now() not null,
  field_name text not null,
  old_value text,
  new_value text,
  reason text
);

create table if not exists public.rounds (
  id uuid not null,
  player_id uuid not null,
  current_team_id uuid,
  team_id_at_round uuid,
  course_id uuid not null,
  played_on date not null,
  location_city text,
  location_state text,
  weather_temp_f smallint,
  weather_wind_mph smallint,
  weather_wind_dir text,
  weather_precip_type text,
  round_type text not null,
  round_number smallint,
  course_difficulty text,
  notes text,
  is_complete boolean default false not null,
  created_at timestamp with time zone default now() not null,
  synced_at timestamp with time zone,
  updated_at timestamp with time zone default now() not null,
  weather_precip numeric
);

create table if not exists public.schools (
  id uuid default gen_random_uuid() not null,
  name text not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table if not exists public.shot_edits (
  id uuid default gen_random_uuid() not null,
  shot_id uuid not null,
  edited_by uuid not null,
  edited_by_type text not null,
  edited_at timestamp with time zone default now() not null,
  field_name text not null,
  old_value text,
  new_value text,
  reason text
);

create table if not exists public.shots (
  id uuid not null,
  hole_id uuid not null,
  shot_number smallint not null,
  starting_lie text not null,
  starting_distance smallint not null,
  ending_lie text not null,
  ending_distance smallint not null,
  has_penalty boolean default false not null,
  club_category text,
  miss_direction text,
  putt_long_short text,
  created_at timestamp with time zone default now() not null,
  synced_at timestamp with time zone,
  updated_at timestamp with time zone default now() not null
);

create table if not exists public.team_members (
  team_id uuid not null,
  player_id uuid not null,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.teams (
  id uuid default gen_random_uuid() not null,
  school_id uuid,
  name text not null,
  gender text default 'M'::text not null,
  created_at timestamp with time zone default now() not null,
  created_by uuid,
  updated_at timestamp with time zone default now() not null
);

-- ============================================================
-- Constraints
--
-- ALTER TABLE ... ADD CONSTRAINT has no IF NOT EXISTS, so each is applied
-- only when absent. Keeps the file re-runnable against the live project.
-- ============================================================

do $do$
declare r record;
begin
  for r in select * from (values
    ('coach_players', 'coach_players_pkey', 'PRIMARY KEY (coach_id, player_id)'),
    ('coach_teams', 'coach_teams_pkey', 'PRIMARY KEY (coach_id, team_id)'),
    ('coaches', 'coaches_pkey', 'PRIMARY KEY (id)'),
    ('courses', 'courses_pkey', 'PRIMARY KEY (id)'),
    ('drill_sessions', 'drill_sessions_pkey', 'PRIMARY KEY (id)'),
    ('ethos_papers', 'ethos_papers_pkey', 'PRIMARY KEY (id)'),
    ('hole_edits', 'hole_edits_pkey', 'PRIMARY KEY (id)'),
    ('holes', 'holes_pkey', 'PRIMARY KEY (id)'),
    ('players', 'players_pkey', 'PRIMARY KEY (id)'),
    ('profiles', 'profiles_pkey', 'PRIMARY KEY (id)'),
    ('round_edits', 'round_edits_pkey', 'PRIMARY KEY (id)'),
    ('rounds', 'rounds_pkey', 'PRIMARY KEY (id)'),
    ('schools', 'schools_pkey', 'PRIMARY KEY (id)'),
    ('shot_edits', 'shot_edits_pkey', 'PRIMARY KEY (id)'),
    ('shots', 'shots_pkey', 'PRIMARY KEY (id)'),
    ('team_members', 'team_members_pkey', 'PRIMARY KEY (team_id, player_id)'),
    ('teams', 'teams_pkey', 'PRIMARY KEY (id)'),
    ('drill_sessions', 'drill_sessions_player_id_drill_type_client_id_key', 'UNIQUE (player_id, drill_type, client_id)'),
    ('ethos_papers', 'ethos_papers_slug_key', 'UNIQUE (slug)'),
    ('holes', 'holes_round_id_hole_number_key', 'UNIQUE (round_id, hole_number)'),
    ('shots', 'shots_hole_id_shot_number_key', 'UNIQUE (hole_id, shot_number)'),
    ('coach_players', 'coach_players_role_check', 'CHECK ((role = ''instructor''::text))'),
    ('coach_teams', 'coach_teams_role_check', 'CHECK ((role = ANY (ARRAY[''head''::text, ''assistant''::text])))'),
    ('courses', 'courses_owner_xor', 'CHECK (((school_id IS NULL) <> (player_id IS NULL)))'),
    ('courses', 'courses_par_hole_10_check', 'CHECK ((par_hole_10 = ANY (ARRAY[3, 4, 5])))'),
    ('courses', 'courses_par_hole_11_check', 'CHECK ((par_hole_11 = ANY (ARRAY[3, 4, 5])))'),
    ('courses', 'courses_par_hole_12_check', 'CHECK ((par_hole_12 = ANY (ARRAY[3, 4, 5])))'),
    ('courses', 'courses_par_hole_13_check', 'CHECK ((par_hole_13 = ANY (ARRAY[3, 4, 5])))'),
    ('courses', 'courses_par_hole_14_check', 'CHECK ((par_hole_14 = ANY (ARRAY[3, 4, 5])))'),
    ('courses', 'courses_par_hole_15_check', 'CHECK ((par_hole_15 = ANY (ARRAY[3, 4, 5])))'),
    ('courses', 'courses_par_hole_16_check', 'CHECK ((par_hole_16 = ANY (ARRAY[3, 4, 5])))'),
    ('courses', 'courses_par_hole_17_check', 'CHECK ((par_hole_17 = ANY (ARRAY[3, 4, 5])))'),
    ('courses', 'courses_par_hole_18_check', 'CHECK ((par_hole_18 = ANY (ARRAY[3, 4, 5])))'),
    ('courses', 'courses_par_hole_1_check', 'CHECK ((par_hole_1 = ANY (ARRAY[3, 4, 5])))'),
    ('courses', 'courses_par_hole_2_check', 'CHECK ((par_hole_2 = ANY (ARRAY[3, 4, 5])))'),
    ('courses', 'courses_par_hole_3_check', 'CHECK ((par_hole_3 = ANY (ARRAY[3, 4, 5])))'),
    ('courses', 'courses_par_hole_4_check', 'CHECK ((par_hole_4 = ANY (ARRAY[3, 4, 5])))'),
    ('courses', 'courses_par_hole_5_check', 'CHECK ((par_hole_5 = ANY (ARRAY[3, 4, 5])))'),
    ('courses', 'courses_par_hole_6_check', 'CHECK ((par_hole_6 = ANY (ARRAY[3, 4, 5])))'),
    ('courses', 'courses_par_hole_7_check', 'CHECK ((par_hole_7 = ANY (ARRAY[3, 4, 5])))'),
    ('courses', 'courses_par_hole_8_check', 'CHECK ((par_hole_8 = ANY (ARRAY[3, 4, 5])))'),
    ('courses', 'courses_par_hole_9_check', 'CHECK ((par_hole_9 = ANY (ARRAY[3, 4, 5])))'),
    ('hole_edits', 'hole_edits_edited_by_type_check', 'CHECK ((edited_by_type = ANY (ARRAY[''player''::text, ''coach''::text])))'),
    ('holes', 'holes_hole_number_check', 'CHECK (((hole_number >= 1) AND (hole_number <= 18)))'),
    ('holes', 'holes_par_check', 'CHECK ((par = ANY (ARRAY[3, 4, 5])))'),
    ('players', 'players_graduation_year_check', 'CHECK (((graduation_year IS NULL) OR ((graduation_year >= 1900) AND (graduation_year <= 2200))))'),
    ('profiles', 'profiles_role_check', 'CHECK ((role = ANY (ARRAY[''player''::text, ''coach''::text])))'),
    ('round_edits', 'round_edits_edited_by_type_check', 'CHECK ((edited_by_type = ANY (ARRAY[''player''::text, ''coach''::text])))'),
    ('rounds', 'rounds_round_number_check', 'CHECK (((round_number IS NULL) OR ((round_number >= 1) AND (round_number <= 4))))'),
    ('rounds', 'rounds_round_number_matches_type', 'CHECK ((((round_type = ''Practice''::text) AND (round_number IS NULL)) OR ((round_type = ANY (ARRAY[''Qualifying''::text, ''Tournament''::text])) AND (round_number IS NOT NULL))))'),
    ('rounds', 'rounds_round_type_check', 'CHECK ((round_type = ANY (ARRAY[''Practice''::text, ''Qualifying''::text, ''Tournament''::text])))'),
    ('rounds', 'rounds_weather_wind_mph_check', 'CHECK (((weather_wind_mph IS NULL) OR (weather_wind_mph >= 0)))'),
    ('shot_edits', 'shot_edits_edited_by_type_check', 'CHECK ((edited_by_type = ANY (ARRAY[''player''::text, ''coach''::text])))'),
    ('shots', 'shots_club_category_check', 'CHECK (((club_category IS NULL) OR (club_category = ANY (ARRAY[''Driver''::text, ''Non-driver''::text]))))'),
    ('shots', 'shots_ending_distance_check', 'CHECK ((ending_distance >= 0))'),
    ('shots', 'shots_ending_lie_check', 'CHECK ((ending_lie = ANY (ARRAY[''Tee''::text, ''Fairway''::text, ''Rough''::text, ''Sand''::text, ''Recovery''::text, ''Green''::text])))'),
    ('shots', 'shots_holed_out_lie', 'CHECK (((ending_distance > 0) OR (ending_lie = ''Green''::text)))'),
    ('shots', 'shots_miss_direction_check', 'CHECK (((miss_direction IS NULL) OR (miss_direction = ANY (ARRAY[''Left''::text, ''Right''::text]))))'),
    ('shots', 'shots_putt_long_short_check', 'CHECK (((putt_long_short IS NULL) OR (putt_long_short = ANY (ARRAY[''Long''::text, ''Short''::text]))))'),
    ('shots', 'shots_shot_number_check', 'CHECK ((shot_number >= 1))'),
    ('shots', 'shots_starting_distance_check', 'CHECK ((starting_distance >= 0))'),
    ('shots', 'shots_starting_lie_check', 'CHECK ((starting_lie = ANY (ARRAY[''Tee''::text, ''Fairway''::text, ''Rough''::text, ''Sand''::text, ''Recovery''::text, ''Green''::text])))'),
    ('teams', 'teams_gender_check', 'CHECK ((gender = ANY (ARRAY[''M''::text, ''W''::text, ''Coed''::text])))'),
    ('coach_players', 'coach_players_coach_id_fkey', 'FOREIGN KEY (coach_id) REFERENCES coaches(id) ON DELETE CASCADE'),
    ('coach_players', 'coach_players_player_id_fkey', 'FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE'),
    ('coach_teams', 'coach_teams_coach_id_fkey', 'FOREIGN KEY (coach_id) REFERENCES coaches(id) ON DELETE CASCADE'),
    ('coach_teams', 'coach_teams_team_id_fkey', 'FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE'),
    ('courses', 'courses_created_by_fkey', 'FOREIGN KEY (created_by) REFERENCES players(id) ON DELETE SET NULL'),
    ('courses', 'courses_player_id_fkey', 'FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE RESTRICT'),
    ('courses', 'courses_school_id_fkey', 'FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE RESTRICT'),
    ('drill_sessions', 'drill_sessions_player_id_fkey', 'FOREIGN KEY (player_id) REFERENCES auth.users(id) ON DELETE CASCADE'),
    ('hole_edits', 'hole_edits_hole_id_fkey', 'FOREIGN KEY (hole_id) REFERENCES holes(id) ON DELETE CASCADE'),
    ('holes', 'holes_round_id_fkey', 'FOREIGN KEY (round_id) REFERENCES rounds(id) ON DELETE CASCADE'),
    ('players', 'players_team_id_fkey', 'FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL'),
    ('profiles', 'profiles_id_fkey', 'FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE'),
    ('round_edits', 'round_edits_round_id_fkey', 'FOREIGN KEY (round_id) REFERENCES rounds(id) ON DELETE CASCADE'),
    ('rounds', 'rounds_course_id_fkey', 'FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE RESTRICT'),
    ('rounds', 'rounds_current_team_id_fkey', 'FOREIGN KEY (current_team_id) REFERENCES teams(id) ON DELETE SET NULL'),
    ('rounds', 'rounds_player_id_fkey', 'FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE RESTRICT'),
    ('rounds', 'rounds_team_id_at_round_fkey', 'FOREIGN KEY (team_id_at_round) REFERENCES teams(id) ON DELETE SET NULL'),
    ('shot_edits', 'shot_edits_shot_id_fkey', 'FOREIGN KEY (shot_id) REFERENCES shots(id) ON DELETE CASCADE'),
    ('shots', 'shots_hole_id_fkey', 'FOREIGN KEY (hole_id) REFERENCES holes(id) ON DELETE CASCADE'),
    ('team_members', 'team_members_player_id_fkey', 'FOREIGN KEY (player_id) REFERENCES profiles(id) ON DELETE CASCADE'),
    ('team_members', 'team_members_team_id_fkey', 'FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE'),
    ('teams', 'teams_created_by_fkey', 'FOREIGN KEY (created_by) REFERENCES coaches(id) ON DELETE SET NULL'),
    ('teams', 'teams_school_id_fkey', 'FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE RESTRICT')
  ) as t(tbl, con, def) loop
    if not exists (
      select 1 from pg_constraint
      where conname = r.con and conrelid = ('public.' || r.tbl)::regclass
    ) then
      execute format('alter table public.%I add constraint %I %s', r.tbl, r.con, r.def);
    end if;
  end loop;
end $do$;

-- ============================================================
-- Functions
--
-- These come after the tables on purpose: can_access_player,
-- get_my_coach_team_ids and is_team_member are LANGUAGE sql, whose bodies
-- Postgres parses and resolves at CREATE time. Declared before the tables
-- they read, they fail with "relation ... does not exist" on a clean build.
-- ============================================================

CREATE OR REPLACE FUNCTION public.can_access_player(target uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.get_my_coach_team_ids()
 RETURNS SETOF uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT team_id FROM coach_teams WHERE coach_id = auth.uid();
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.players (id, display_name, is_active)
  VALUES (
    NEW.id,
    -- Use the part of the email before @ as initial display name.
    -- The player can edit this in their profile.
    COALESCE(
      NEW.raw_user_meta_data->>'display_name',
      split_part(NEW.email, '@', 1)
    ),
    true
  );
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.is_team_member(target_team uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from team_members
    where team_id = target_team
      and player_id = (select auth.uid())
  );
$function$;

CREATE OR REPLACE FUNCTION public.set_drill_sessions_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.shots_no_play_after_holed()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  prior_holed boolean;
BEGIN
  -- Is there a prior shot on this hole that was a hole-out?
  SELECT EXISTS (
    SELECT 1 FROM shots
    WHERE hole_id = NEW.hole_id
      AND shot_number < NEW.shot_number
      AND ending_distance = 0
      AND ending_lie = 'Green'
  ) INTO prior_holed;

  IF prior_holed THEN
    RAISE EXCEPTION
      'Cannot add shot % to hole %: a previous shot was a hole-out (ending_distance = 0, ending_lie = Green).',
      NEW.shot_number, NEW.hole_id;
  END IF;

  RETURN NEW;
END;
$function$;

-- ============================================================
-- Indexes
-- ============================================================

create index if not exists coach_players_coach_active_idx ON public.coach_players USING btree (coach_id) WHERE (revoked_at IS NULL);
create index if not exists coach_players_player_idx ON public.coach_players USING btree (player_id) WHERE (revoked_at IS NULL);
create index if not exists coach_teams_team_idx ON public.coach_teams USING btree (team_id);
create index if not exists coaches_email_idx ON public.coaches USING btree (lower(email));
create index if not exists courses_player_idx ON public.courses USING btree (player_id) WHERE (player_id IS NOT NULL);
create index if not exists courses_school_idx ON public.courses USING btree (school_id) WHERE (school_id IS NOT NULL);
create index if not exists drill_sessions_payload_gin_idx ON public.drill_sessions USING gin (payload);
create index if not exists drill_sessions_player_drill_idx ON public.drill_sessions USING btree (player_id, drill_type, played_at DESC);
create index if not exists ethos_papers_published_idx ON public.ethos_papers USING btree (published_at DESC) WHERE (published_at IS NOT NULL);
create index if not exists hole_edits_actor_idx ON public.hole_edits USING btree (edited_by, edited_at DESC);
create index if not exists hole_edits_hole_idx ON public.hole_edits USING btree (hole_id, edited_at DESC);
create index if not exists holes_round_idx ON public.holes USING btree (round_id);
create index if not exists players_team_active_idx ON public.players USING btree (team_id, is_active);
create index if not exists players_team_id_idx ON public.players USING btree (team_id);
create index if not exists round_edits_actor_idx ON public.round_edits USING btree (edited_by, edited_at DESC);
create index if not exists round_edits_round_idx ON public.round_edits USING btree (round_id, edited_at DESC);
create index if not exists rounds_course_idx ON public.rounds USING btree (course_id);
create index if not exists rounds_player_played_idx ON public.rounds USING btree (player_id, played_on DESC);
create index if not exists rounds_synced_idx ON public.rounds USING btree (synced_at) WHERE (synced_at IS NULL);
create index if not exists rounds_team_played_idx ON public.rounds USING btree (current_team_id, played_on DESC) WHERE (current_team_id IS NOT NULL);
create index if not exists shot_edits_actor_idx ON public.shot_edits USING btree (edited_by, edited_at DESC);
create index if not exists shot_edits_shot_idx ON public.shot_edits USING btree (shot_id, edited_at DESC);
create index if not exists shots_hole_idx ON public.shots USING btree (hole_id);
create index if not exists shots_synced_idx ON public.shots USING btree (synced_at) WHERE (synced_at IS NULL);
create index if not exists team_members_player_id_idx ON public.team_members USING btree (player_id);

-- ============================================================
-- Triggers
-- ============================================================

drop trigger if exists coaches_set_updated_at on public.coaches;
CREATE TRIGGER coaches_set_updated_at BEFORE UPDATE ON public.coaches FOR EACH ROW EXECUTE FUNCTION set_updated_at();
drop trigger if exists courses_set_updated_at on public.courses;
CREATE TRIGGER courses_set_updated_at BEFORE UPDATE ON public.courses FOR EACH ROW EXECUTE FUNCTION set_updated_at();
drop trigger if exists drill_sessions_set_updated_at on public.drill_sessions;
CREATE TRIGGER drill_sessions_set_updated_at BEFORE UPDATE ON public.drill_sessions FOR EACH ROW EXECUTE FUNCTION set_drill_sessions_updated_at();
drop trigger if exists holes_set_updated_at on public.holes;
CREATE TRIGGER holes_set_updated_at BEFORE UPDATE ON public.holes FOR EACH ROW EXECUTE FUNCTION set_updated_at();
drop trigger if exists players_set_updated_at on public.players;
CREATE TRIGGER players_set_updated_at BEFORE UPDATE ON public.players FOR EACH ROW EXECUTE FUNCTION set_updated_at();
drop trigger if exists rounds_set_updated_at on public.rounds;
CREATE TRIGGER rounds_set_updated_at BEFORE UPDATE ON public.rounds FOR EACH ROW EXECUTE FUNCTION set_updated_at();
drop trigger if exists schools_set_updated_at on public.schools;
CREATE TRIGGER schools_set_updated_at BEFORE UPDATE ON public.schools FOR EACH ROW EXECUTE FUNCTION set_updated_at();
drop trigger if exists shots_no_play_after_holed_trigger on public.shots;
CREATE TRIGGER shots_no_play_after_holed_trigger BEFORE INSERT OR UPDATE ON public.shots FOR EACH ROW EXECUTE FUNCTION shots_no_play_after_holed();
drop trigger if exists shots_set_updated_at on public.shots;
CREATE TRIGGER shots_set_updated_at BEFORE UPDATE ON public.shots FOR EACH ROW EXECUTE FUNCTION set_updated_at();
drop trigger if exists teams_set_updated_at on public.teams;
CREATE TRIGGER teams_set_updated_at BEFORE UPDATE ON public.teams FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- NOTE: handle_new_user() and handle_new_auth_user() are triggered from
-- auth.users, which lives outside the public schema and is not captured here.
-- 0001_profiles_teams.sql creates the profiles trigger; the players one
-- (handle_new_auth_user) is live but has no tracked migration.

-- ============================================================
-- Row-level security
-- ============================================================

alter table public.coach_players enable row level security;
alter table public.coach_teams enable row level security;
alter table public.coaches enable row level security;
alter table public.courses enable row level security;
alter table public.drill_sessions enable row level security;
alter table public.ethos_papers enable row level security;
alter table public.hole_edits enable row level security;
alter table public.holes enable row level security;
alter table public.players enable row level security;
alter table public.profiles enable row level security;
alter table public.round_edits enable row level security;
alter table public.rounds enable row level security;
alter table public.schools enable row level security;
alter table public.shot_edits enable row level security;
alter table public.shots enable row level security;
alter table public.team_members enable row level security;
alter table public.teams enable row level security;

-- ============================================================
-- Policies
--
-- Reproduced exactly as production has them, including the overlaps noted
-- at the top of this file. Do not tidy them here — that is a behaviour
-- change and belongs in its own migration with its own review.
-- ============================================================

drop policy if exists "coach_players_insert" on public.coach_players;
create policy "coach_players_insert" on public.coach_players for insert with check ((player_id = auth.uid()));
drop policy if exists "coach_players_select" on public.coach_players;
create policy "coach_players_select" on public.coach_players for select using (((coach_id = auth.uid()) OR (player_id = auth.uid())));
drop policy if exists "coach_players_update" on public.coach_players;
create policy "coach_players_update" on public.coach_players for update using (((coach_id = auth.uid()) OR (player_id = auth.uid())));

drop policy if exists "coach_teams_select" on public.coach_teams;
create policy "coach_teams_select" on public.coach_teams for select using (((coach_id = auth.uid()) OR (team_id IN ( SELECT get_my_coach_team_ids() AS get_my_coach_team_ids))));

drop policy if exists "coaches_select" on public.coaches;
create policy "coaches_select" on public.coaches for select using (true);
drop policy if exists "coaches_update_self" on public.coaches;
create policy "coaches_update_self" on public.coaches for update using ((id = auth.uid())) with check ((id = auth.uid()));

drop policy if exists "courses_insert" on public.courses;
create policy "courses_insert" on public.courses for insert with check ((((player_id = auth.uid()) AND (school_id IS NULL)) OR ((school_id IS NOT NULL) AND (player_id IS NULL) AND ((EXISTS ( SELECT 1
   FROM (players p
     JOIN teams t ON ((t.id = p.team_id)))
  WHERE ((p.id = auth.uid()) AND (t.school_id = courses.school_id)))) OR (EXISTS ( SELECT 1
   FROM (coach_teams ct
     JOIN teams t ON ((t.id = ct.team_id)))
  WHERE ((ct.coach_id = auth.uid()) AND (t.school_id = courses.school_id))))))));
drop policy if exists "courses_select" on public.courses;
create policy "courses_select" on public.courses for select using (((player_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM (players p
     JOIN teams t ON ((t.id = p.team_id)))
  WHERE ((p.id = auth.uid()) AND (t.school_id = courses.school_id)))) OR (EXISTS ( SELECT 1
   FROM (coach_teams ct
     JOIN teams t ON ((t.id = ct.team_id)))
  WHERE ((ct.coach_id = auth.uid()) AND (t.school_id = courses.school_id))))));
drop policy if exists "courses_update" on public.courses;
create policy "courses_update" on public.courses for update using (((player_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM (players p
     JOIN teams t ON ((t.id = p.team_id)))
  WHERE ((p.id = auth.uid()) AND (t.school_id = courses.school_id)))) OR (EXISTS ( SELECT 1
   FROM (coach_teams ct
     JOIN teams t ON ((t.id = ct.team_id)))
  WHERE ((ct.coach_id = auth.uid()) AND (t.school_id = courses.school_id))))));
drop policy if exists "users manage own courses" on public.courses;
create policy "users manage own courses" on public.courses for all using ((player_id = auth.uid())) with check ((player_id = auth.uid()));

drop policy if exists "drill_sessions_delete_own" on public.drill_sessions;
create policy "drill_sessions_delete_own" on public.drill_sessions for delete using ((player_id = ( SELECT auth.uid() AS uid)));
drop policy if exists "drill_sessions_insert_own" on public.drill_sessions;
create policy "drill_sessions_insert_own" on public.drill_sessions for insert with check ((player_id = ( SELECT auth.uid() AS uid)));
drop policy if exists "drill_sessions_select" on public.drill_sessions;
create policy "drill_sessions_select" on public.drill_sessions for select using (can_access_player(player_id));
drop policy if exists "drill_sessions_update_own" on public.drill_sessions;
create policy "drill_sessions_update_own" on public.drill_sessions for update using ((player_id = ( SELECT auth.uid() AS uid)));

drop policy if exists "ethos_papers_select_published" on public.ethos_papers;
create policy "ethos_papers_select_published" on public.ethos_papers for select using (((published_at IS NOT NULL) AND (published_at <= now())));

drop policy if exists "hole_edits_insert" on public.hole_edits;
create policy "hole_edits_insert" on public.hole_edits for insert with check ((edited_by = auth.uid()));
drop policy if exists "hole_edits_select" on public.hole_edits;
create policy "hole_edits_select" on public.hole_edits for select using ((EXISTS ( SELECT 1
   FROM holes h
  WHERE (h.id = hole_edits.hole_id))));

drop policy if exists "holes_insert" on public.holes;
create policy "holes_insert" on public.holes for insert with check ((EXISTS ( SELECT 1
   FROM rounds r
  WHERE ((r.id = holes.round_id) AND (r.player_id = auth.uid())))));
drop policy if exists "holes_select" on public.holes;
create policy "holes_select" on public.holes for select using ((EXISTS ( SELECT 1
   FROM rounds r
  WHERE (r.id = holes.round_id))));
drop policy if exists "holes_update" on public.holes;
create policy "holes_update" on public.holes for update using ((EXISTS ( SELECT 1
   FROM rounds r
  WHERE ((r.id = holes.round_id) AND ((r.player_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM coach_teams ct
          WHERE ((ct.coach_id = auth.uid()) AND (ct.team_id = r.current_team_id)))) OR (EXISTS ( SELECT 1
           FROM coach_players cp
          WHERE ((cp.coach_id = auth.uid()) AND (cp.player_id = r.player_id) AND (cp.revoked_at IS NULL)))))))));
drop policy if exists "users manage own holes" on public.holes;
create policy "users manage own holes" on public.holes for all using ((EXISTS ( SELECT 1
   FROM rounds
  WHERE ((rounds.id = holes.round_id) AND (rounds.player_id = auth.uid()))))) with check ((EXISTS ( SELECT 1
   FROM rounds
  WHERE ((rounds.id = holes.round_id) AND (rounds.player_id = auth.uid())))));

drop policy if exists "players_select" on public.players;
create policy "players_select" on public.players for select using (((id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM coach_teams ct
  WHERE ((ct.coach_id = auth.uid()) AND (ct.team_id = players.team_id)))) OR (EXISTS ( SELECT 1
   FROM coach_players cp
  WHERE ((cp.coach_id = auth.uid()) AND (cp.player_id = players.id) AND (cp.revoked_at IS NULL))))));
drop policy if exists "players_update_self" on public.players;
create policy "players_update_self" on public.players for update using ((id = auth.uid())) with check ((id = auth.uid()));

drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles for select using (can_access_player(id));
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles for update using ((id = ( SELECT auth.uid() AS uid)));

drop policy if exists "round_edits_insert" on public.round_edits;
create policy "round_edits_insert" on public.round_edits for insert with check ((edited_by = auth.uid()));
drop policy if exists "round_edits_select" on public.round_edits;
create policy "round_edits_select" on public.round_edits for select using ((EXISTS ( SELECT 1
   FROM rounds r
  WHERE (r.id = round_edits.round_id))));

drop policy if exists "rounds_delete" on public.rounds;
create policy "rounds_delete" on public.rounds for delete using ((player_id = auth.uid()));
drop policy if exists "rounds_insert" on public.rounds;
create policy "rounds_insert" on public.rounds for insert with check ((player_id = auth.uid()));
drop policy if exists "rounds_select" on public.rounds;
create policy "rounds_select" on public.rounds for select using (((player_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM coach_teams ct
  WHERE ((ct.coach_id = auth.uid()) AND (ct.team_id = rounds.current_team_id)))) OR (EXISTS ( SELECT 1
   FROM coach_players cp
  WHERE ((cp.coach_id = auth.uid()) AND (cp.player_id = rounds.player_id) AND (cp.revoked_at IS NULL))))));
drop policy if exists "rounds_update" on public.rounds;
create policy "rounds_update" on public.rounds for update using (((player_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM coach_teams ct
  WHERE ((ct.coach_id = auth.uid()) AND (ct.team_id = rounds.current_team_id)))) OR (EXISTS ( SELECT 1
   FROM coach_players cp
  WHERE ((cp.coach_id = auth.uid()) AND (cp.player_id = rounds.player_id) AND (cp.revoked_at IS NULL))))));
drop policy if exists "users manage own rounds" on public.rounds;
create policy "users manage own rounds" on public.rounds for all using ((player_id = auth.uid())) with check ((player_id = auth.uid()));

drop policy if exists "schools_select" on public.schools;
create policy "schools_select" on public.schools for select using (true);

drop policy if exists "shot_edits_insert" on public.shot_edits;
create policy "shot_edits_insert" on public.shot_edits for insert with check ((edited_by = auth.uid()));
drop policy if exists "shot_edits_select" on public.shot_edits;
create policy "shot_edits_select" on public.shot_edits for select using ((EXISTS ( SELECT 1
   FROM shots s
  WHERE (s.id = shot_edits.shot_id))));

drop policy if exists "shots_insert" on public.shots;
create policy "shots_insert" on public.shots for insert with check ((EXISTS ( SELECT 1
   FROM (holes h
     JOIN rounds r ON ((r.id = h.round_id)))
  WHERE ((h.id = shots.hole_id) AND (r.player_id = auth.uid())))));
drop policy if exists "shots_select" on public.shots;
create policy "shots_select" on public.shots for select using ((EXISTS ( SELECT 1
   FROM holes h
  WHERE (h.id = shots.hole_id))));
drop policy if exists "shots_update" on public.shots;
create policy "shots_update" on public.shots for update using ((EXISTS ( SELECT 1
   FROM (holes h
     JOIN rounds r ON ((r.id = h.round_id)))
  WHERE ((h.id = shots.hole_id) AND ((r.player_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM coach_teams ct
          WHERE ((ct.coach_id = auth.uid()) AND (ct.team_id = r.current_team_id)))) OR (EXISTS ( SELECT 1
           FROM coach_players cp
          WHERE ((cp.coach_id = auth.uid()) AND (cp.player_id = r.player_id) AND (cp.revoked_at IS NULL)))))))));
drop policy if exists "users manage own shots" on public.shots;
create policy "users manage own shots" on public.shots for all using ((EXISTS ( SELECT 1
   FROM (holes
     JOIN rounds ON ((rounds.id = holes.round_id)))
  WHERE ((holes.id = shots.hole_id) AND (rounds.player_id = auth.uid()))))) with check ((EXISTS ( SELECT 1
   FROM (holes
     JOIN rounds ON ((rounds.id = holes.round_id)))
  WHERE ((holes.id = shots.hole_id) AND (rounds.player_id = auth.uid())))));

drop policy if exists "team_members_select_member" on public.team_members;
create policy "team_members_select_member" on public.team_members for select using (is_team_member(team_id));

drop policy if exists "teams_select" on public.teams;
create policy "teams_select" on public.teams for select using (true);
drop policy if exists "teams_select_member" on public.teams;
create policy "teams_select_member" on public.teams for select using (is_team_member(id));

-- ============================================================
-- Views
-- ============================================================

create or replace view public.dashboard_shots as
 SELECT s.id AS shot_id,
    r.player_id,
    COALESCE(p.display_name, 'Unknown'::text) AS player_name,
    r.id AS round_id,
    r.played_on,
    r.round_type,
    r.round_number,
    r.course_id,
    COALESCE(c.name, 'Unknown course'::text) AS course_name,
    h.id AS hole_id,
    h.hole_number,
    h.par AS hole_par,
    s.shot_number,
    s.starting_lie,
    s.starting_distance,
    s.ending_lie,
    s.ending_distance,
    s.has_penalty,
    s.club_category,
    s.miss_direction,
    s.putt_long_short
   FROM shots s
     JOIN holes h ON h.id = s.hole_id
     JOIN rounds r ON r.id = h.round_id
     LEFT JOIN courses c ON c.id = r.course_id
     LEFT JOIN profiles p ON p.id = r.player_id;
