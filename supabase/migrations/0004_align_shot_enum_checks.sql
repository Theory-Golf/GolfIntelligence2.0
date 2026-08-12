-- 0004_align_shot_enum_checks.sql
-- The shots table's CHECK constraints for club_category, miss_direction, and
-- putt_long_short used lowercase/snake_case tokens ('driver', 'left', 'long')
-- that never matched the values the application writes ('Driver', 'Left',
-- 'Long'). Every shot the app tried to save with one of these fields set was
-- rejected by the database and (before the fail-closed submit fix) silently
-- discarded — losing lag putts and club-flagged tee shots.
--
-- The app, the dashboard calculations, and seed.sql all use the Capitalized
-- domain (matching the already-correct starting_lie/ending_lie/round_type
-- constraints). Realign these three constraints to that domain.

-- Normalize any pre-existing lowercase values first so the stricter
-- constraints validate cleanly against existing rows.
update public.shots set club_category  = 'Driver'     where club_category  = 'driver';
update public.shots set club_category  = 'Non-driver' where club_category  = 'non_driver';
update public.shots set miss_direction = 'Left'       where miss_direction = 'left';
update public.shots set miss_direction = 'Right'      where miss_direction = 'right';
update public.shots set putt_long_short = 'Long'      where putt_long_short = 'long';
update public.shots set putt_long_short = 'Short'     where putt_long_short = 'short';

alter table public.shots drop constraint if exists shots_club_category_check;
alter table public.shots add constraint shots_club_category_check
  check (club_category is null or club_category in ('Driver', 'Non-driver'));

alter table public.shots drop constraint if exists shots_miss_direction_check;
alter table public.shots add constraint shots_miss_direction_check
  check (miss_direction is null or miss_direction in ('Left', 'Right'));

alter table public.shots drop constraint if exists shots_putt_long_short_check;
alter table public.shots add constraint shots_putt_long_short_check
  check (putt_long_short is null or putt_long_short in ('Long', 'Short'));
