-- 0011_round_tournament_name.sql
--
-- Tournament identity on a round, plus the name list that keeps that identity
-- consistent across a team.
--
-- The name is a column on `rounds` rather than a lookup table: an event name is
-- free text a player types, and the consistency work happens at entry time, by
-- offering names already in use. What makes "already in use" mean more than
-- "already used by me" is `tournament_name_suggestions()`. It has to be a
-- function: `players_select` is `can_access_player(id)`, which only ever answers
-- coach -> player, so a player cannot read a teammate's rounds through RLS. The
-- function is `security definer` and returns names and counts -- never a round
-- row, a score, or a player id -- which is what makes crossing that boundary
-- safe.
--
-- Deliberately no CHECK tying the column to `round_type`. The UI gates entry to
-- tournament rounds, and `rounds_round_number_matches_type` is already awkward
-- to change: the baseline applies constraints through a loop that only adds the
-- ones that are absent, so amending it means an explicit drop and re-add.

alter table public.rounds
  add column if not exists tournament_name text;

comment on column public.rounds.tournament_name is
  'Event name for a tournament round. Free text, kept consistent at entry time by tournament_name_suggestions().';

create index if not exists rounds_tournament_name_idx
  on public.rounds (tournament_name)
  where tournament_name is not null;

create or replace function public.tournament_name_suggestions()
returns table (name text, uses integer)
language sql
stable
security definer
set search_path = public
as $$
  with circle as (
    -- the caller
    select (select auth.uid()) as player_id
    union
    -- teammates: one team per player, so this is players.team_id
    select p2.id
      from players p1
      join players p2 on p2.team_id = p1.team_id
     where p1.id = (select auth.uid())
       and p1.team_id is not null
    union
    -- players who share one of the caller's instructors
    select cp2.player_id
      from coach_players cp1
      join coach_players cp2 on cp2.coach_id = cp1.coach_id
     where cp1.player_id = (select auth.uid())
       and cp1.revoked_at is null
       and cp2.revoked_at is null
    union
    -- the caller is a coach: every player on a team they coach
    select p.id
      from coach_teams ct
      join players p on p.team_id = ct.team_id
     where ct.coach_id = (select auth.uid())
    union
    -- the caller is a coach: their direct assignments
    select cp.player_id
      from coach_players cp
     where cp.coach_id = (select auth.uid())
       and cp.revoked_at is null
  )
  select btrim(r.tournament_name) as name,
         count(*)::integer as uses
    from rounds r
   where r.tournament_name is not null
     and btrim(r.tournament_name) <> ''
     and r.player_id in (select player_id from circle)
   group by btrim(r.tournament_name)
   order by count(*) desc, btrim(r.tournament_name);
$$;

-- `create function` grants execute to PUBLIC, and this project's default
-- privileges re-grant it to `anon` as well; neither is wanted. `anon` has no
-- auth.uid(), so it would get an empty list rather than anyone's data, but a
-- security definer function has no business being callable unauthenticated.
revoke all on function public.tournament_name_suggestions() from public;
revoke all on function public.tournament_name_suggestions() from anon;
grant execute on function public.tournament_name_suggestions() to authenticated;
