-- 0003_dashboard_shots_view.sql
-- Flat, denormalized view powering the analytics dashboard: one row per
-- shot with hole, round, course, and player context joined in.
--
-- security_invoker makes the view run with the querying user's RLS, so
-- a player sees only their own shots and a coach sees their whole team
-- without any role branching in app code.

create or replace view public.dashboard_shots
with (security_invoker = true) as
select
  s.id                                   as shot_id,
  r.player_id                            as player_id,
  coalesce(p.display_name, 'Unknown')    as player_name,
  r.id                                   as round_id,
  r.played_on                            as played_on,
  r.round_type                           as round_type,
  r.round_number                         as round_number,
  r.course_id                            as course_id,
  coalesce(c.name, 'Unknown course')     as course_name,
  h.id                                   as hole_id,
  h.hole_number                          as hole_number,
  h.par                                  as hole_par,
  s.shot_number                          as shot_number,
  s.starting_lie                         as starting_lie,
  s.starting_distance                    as starting_distance,
  s.ending_lie                           as ending_lie,
  s.ending_distance                      as ending_distance,
  s.has_penalty                          as has_penalty,
  s.club_category                        as club_category,
  s.miss_direction                       as miss_direction,
  s.putt_long_short                      as putt_long_short
from public.shots s
join public.holes h on h.id = s.hole_id
join public.rounds r on r.id = h.round_id
left join public.courses c on c.id = r.course_id
left join public.profiles p on p.id = r.player_id;

grant select on public.dashboard_shots to authenticated;
