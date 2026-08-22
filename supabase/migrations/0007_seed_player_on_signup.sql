-- 0007_seed_player_on_signup.sql
-- Restores automatic creation of the players row on signup.
--
-- WHAT BROKE
-- rounds.player_id and courses.player_id are foreign keys to players(id), and
-- no application code ever inserts into players -- the row has always come from
-- a trigger on auth.users. Two functions were written for that trigger:
--
--   handle_new_auth_user()  inserts into players   (untracked, added by hand)
--   handle_new_user()       inserts into profiles  (added by 0001)
--
-- Both were attached under the SAME trigger name, on_auth_user_created. So when
-- 0001_profiles_teams.sql ran its `drop trigger if exists on_auth_user_created`
-- and recreated the trigger pointing at handle_new_user(), it silently removed
-- the players insert. handle_new_auth_user() has had no trigger attached since.
--
-- Evidence for the dating: the three players rows created after 2026-05-21 match
-- their auth.users.created_at to the microsecond (the trigger was live), while
-- all four profiles rows share 2026-08-11 12:05:29 (when 0001 was applied and
-- backfilled). Every signup since that date has produced a profiles row and no
-- players row, so the first course or round insert fails on the foreign key.
--
-- THE FIX, AND WHY IT IS SHAPED THIS WAY
-- One trigger, one function, both inserts. Adding a SECOND trigger for players
-- is what created this failure mode in the first place -- two triggers competing
-- for one name, where recreating either one silently drops the other. Keeping a
-- single function makes that class of mistake impossible to repeat.
--
-- Both inserts are `on conflict (id) do nothing`, so this is safe against a
-- partially-seeded account and safe to re-run.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  -- players.display_name and profiles.display_name are both NOT NULL, and
  -- auth.users.email is nullable (phone / OAuth signups), so this needs a
  -- final literal fallback -- not just split_part, which returns null on null.
  resolved_name text := coalesce(
    nullif(new.raw_user_meta_data ->> 'display_name', ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'Player'
  );
begin
  insert into public.profiles (id, display_name)
  values (new.id, resolved_name)
  on conflict (id) do nothing;

  insert into public.players (id, display_name, is_active)
  values (new.id, resolved_name, true)
  on conflict (id) do nothing;

  return new;
end;
$$;

-- Recreated idempotently, same shape as 0001_profiles_teams.sql. This is the
-- only trigger that may carry this name; see the note above before adding another.
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- Backfill: any account that signed up while the players insert
-- was missing. Mirrors the resolved_name logic above.
-- ============================================================
insert into public.players (id, display_name, is_active)
select
  u.id,
  coalesce(
    nullif(u.raw_user_meta_data ->> 'display_name', ''),
    nullif(split_part(coalesce(u.email, ''), '@', 1), ''),
    'Player'
  ),
  true
from auth.users u
where not exists (select 1 from public.players p where p.id = u.id)
on conflict (id) do nothing;

-- Same backfill for profiles, for symmetry -- 0001 backfilled once, but an
-- account created between then and this migration would have one and not the other.
insert into public.profiles (id, display_name)
select
  u.id,
  coalesce(
    nullif(u.raw_user_meta_data ->> 'display_name', ''),
    nullif(split_part(coalesce(u.email, ''), '@', 1), ''),
    'Player'
  )
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id)
on conflict (id) do nothing;

-- ============================================================
-- Retire the orphan. handle_new_auth_user() has had no trigger since 0001 and
-- nothing references it, but it stayed executable by `anon` and `authenticated`
-- over /rest/v1/rpc as a SECURITY DEFINER function -- one of the standing
-- security advisor warnings. Its behaviour now lives in handle_new_user().
-- ============================================================
drop function if exists public.handle_new_auth_user();
