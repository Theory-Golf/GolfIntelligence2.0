-- seed.sql — LOCAL DEVELOPMENT ONLY (supabase start / supabase db reset)
-- Do not run against production: it inserts auth.users rows directly.
--
-- Seeds: two players + one coach on one team, a course with real pars,
-- and two rounds with hand-constructed, known outcomes for verifying
-- dashboard metrics:
--
--   Player One, "Seed Valley GC", 18 holes, total 76 (par 72):
--     - Hole 2  (par 3): 3-putt bogey            -> Tiger 5 "3 Putts" = 1
--     - Hole 3  (par 4): penalty drive, bogey    -> 1 penalty drive
--     - Hole 4  (par 4): double bogey, including a short-game shot that
--                        missed the green        -> "Double Bogey" = 1,
--                                                   "Missed Green" = 1
--     - All other holes: par
--   Player Two, "Practice Track", 9 holes, all par 4s, total 36.

-- ============================================================
-- Auth users (fixed UUIDs; password is "password123" for all)
-- ============================================================
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111',
   'authenticated', 'authenticated', 'player1@example.com',
   crypt('password123', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"display_name":"Player One"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '22222222-2222-2222-2222-222222222222',
   'authenticated', 'authenticated', 'player2@example.com',
   crypt('password123', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"display_name":"Player Two"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '33333333-3333-3333-3333-333333333333',
   'authenticated', 'authenticated', 'coach@example.com',
   crypt('password123', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"display_name":"Coach"}', now(), now())
on conflict (id) do nothing;

-- The on_auth_user_created trigger creates profiles; mark the coach.
update public.profiles set role = 'coach' where id = '33333333-3333-3333-3333-333333333333';

-- ============================================================
-- Team
-- ============================================================
insert into public.teams (id, name)
values ('44444444-4444-4444-4444-444444444444', 'Seed University Golf')
on conflict (id) do nothing;

insert into public.team_members (team_id, player_id)
values
  ('44444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111'),
  ('44444444-4444-4444-4444-444444444444', '22222222-2222-2222-2222-222222222222'),
  ('44444444-4444-4444-4444-444444444444', '33333333-3333-3333-3333-333333333333')
on conflict do nothing;

-- ============================================================
-- Courses
-- ============================================================
insert into public.courses (
  id, player_id, name,
  par_hole_1, par_hole_2, par_hole_3, par_hole_4, par_hole_5, par_hole_6,
  par_hole_7, par_hole_8, par_hole_9, par_hole_10, par_hole_11, par_hole_12,
  par_hole_13, par_hole_14, par_hole_15, par_hole_16, par_hole_17, par_hole_18
)
values
  ('55555555-5555-5555-5555-555555555555', '11111111-1111-1111-1111-111111111111', 'Seed Valley GC',
   4,3,4,4,5,3,4,4,5,4,3,4,5,4,4,3,4,5),
  ('66666666-6666-6666-6666-666666666666', '22222222-2222-2222-2222-222222222222', 'Practice Track',
   4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4)
on conflict (id) do nothing;

-- ============================================================
-- Round 1 — Player One, Seed Valley GC, Tournament
-- ============================================================
insert into public.rounds (id, player_id, course_id, played_on, round_type, round_number)
values ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
        '55555555-5555-5555-5555-555555555555', '2026-05-01', 'Tournament', 1)
on conflict (id) do nothing;

insert into public.holes (id, round_id, hole_number, par)
values
  ('a1000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 1, 4),
  ('a1000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 2, 3),
  ('a1000000-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001', 3, 4),
  ('a1000000-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000001', 4, 4),
  ('a1000000-0000-0000-0000-000000000005', 'aaaaaaaa-0000-0000-0000-000000000001', 5, 5),
  ('a1000000-0000-0000-0000-000000000006', 'aaaaaaaa-0000-0000-0000-000000000001', 6, 3),
  ('a1000000-0000-0000-0000-000000000007', 'aaaaaaaa-0000-0000-0000-000000000001', 7, 4),
  ('a1000000-0000-0000-0000-000000000008', 'aaaaaaaa-0000-0000-0000-000000000001', 8, 4),
  ('a1000000-0000-0000-0000-000000000009', 'aaaaaaaa-0000-0000-0000-000000000001', 9, 5),
  ('a1000000-0000-0000-0000-000000000010', 'aaaaaaaa-0000-0000-0000-000000000001', 10, 4),
  ('a1000000-0000-0000-0000-000000000011', 'aaaaaaaa-0000-0000-0000-000000000001', 11, 3),
  ('a1000000-0000-0000-0000-000000000012', 'aaaaaaaa-0000-0000-0000-000000000001', 12, 4),
  ('a1000000-0000-0000-0000-000000000013', 'aaaaaaaa-0000-0000-0000-000000000001', 13, 5),
  ('a1000000-0000-0000-0000-000000000014', 'aaaaaaaa-0000-0000-0000-000000000001', 14, 4),
  ('a1000000-0000-0000-0000-000000000015', 'aaaaaaaa-0000-0000-0000-000000000001', 15, 4),
  ('a1000000-0000-0000-0000-000000000016', 'aaaaaaaa-0000-0000-0000-000000000001', 16, 3),
  ('a1000000-0000-0000-0000-000000000017', 'aaaaaaaa-0000-0000-0000-000000000001', 17, 4),
  ('a1000000-0000-0000-0000-000000000018', 'aaaaaaaa-0000-0000-0000-000000000001', 18, 5)
on conflict (id) do nothing;

-- Distances are yards, except FEET when the lie is Green.
insert into public.shots (
  id, hole_id, shot_number, starting_lie, starting_distance,
  ending_lie, ending_distance, has_penalty, club_category, miss_direction, putt_long_short
)
values
  -- Hole 1 (par 4): par
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000001', 1, 'Tee', 380, 'Fairway', 150, false, 'Driver', null, null),
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000001', 2, 'Fairway', 150, 'Green', 20, false, null, null, null),
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000001', 3, 'Green', 20, 'Green', 2, false, null, null, null),
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000001', 4, 'Green', 2, 'Green', 0, false, null, null, null),
  -- Hole 2 (par 3): THREE-PUTT bogey (first putt raced 30ft -> 8ft, Long)
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000002', 1, 'Tee', 175, 'Green', 30, false, null, null, null),
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000002', 2, 'Green', 30, 'Green', 8, false, null, null, 'Long'),
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000002', 3, 'Green', 8, 'Green', 2, false, null, null, null),
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000002', 4, 'Green', 2, 'Green', 0, false, null, null, null),
  -- Hole 3 (par 4): PENALTY DRIVE, bogey (4 shots + 1 penalty stroke = 5)
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000003', 1, 'Tee', 400, 'Rough', 150, true, 'Driver', 'Left', null),
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000003', 2, 'Rough', 150, 'Green', 30, false, null, null, null),
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000003', 3, 'Green', 30, 'Green', 4, false, null, null, 'Short'),
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000003', 4, 'Green', 4, 'Green', 0, false, null, null, null),
  -- Hole 4 (par 4): DOUBLE BOGEY incl. short-game shot missing the green
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000004', 1, 'Tee', 390, 'Rough', 170, false, 'Driver', 'Right', null),
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000004', 2, 'Rough', 170, 'Sand', 20, false, null, null, null),
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000004', 3, 'Sand', 20, 'Rough', 15, false, null, null, null),
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000004', 4, 'Rough', 15, 'Green', 9, false, null, null, null),
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000004', 5, 'Green', 9, 'Green', 2, false, null, null, null),
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000004', 6, 'Green', 2, 'Green', 0, false, null, null, null),
  -- Hole 5 (par 5): par
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000005', 1, 'Tee', 520, 'Fairway', 250, false, 'Driver', null, null),
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000005', 2, 'Fairway', 250, 'Fairway', 80, false, null, null, null),
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000005', 3, 'Fairway', 80, 'Green', 15, false, null, null, null),
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000005', 4, 'Green', 15, 'Green', 1, false, null, null, null),
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000005', 5, 'Green', 1, 'Green', 0, false, null, null, null),
  -- Hole 6 (par 3): par
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000006', 1, 'Tee', 160, 'Green', 25, false, null, null, null),
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000006', 2, 'Green', 25, 'Green', 2, false, null, null, null),
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000006', 3, 'Green', 2, 'Green', 0, false, null, null, null),
  -- Hole 7 (par 4): par
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000007', 1, 'Tee', 380, 'Fairway', 150, false, 'Driver', null, null),
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000007', 2, 'Fairway', 150, 'Green', 18, false, null, null, null),
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000007', 3, 'Green', 18, 'Green', 2, false, null, null, null),
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000007', 4, 'Green', 2, 'Green', 0, false, null, null, null),
  -- Hole 8 (par 4): par
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000008', 1, 'Tee', 385, 'Fairway', 145, false, 'Driver', null, null),
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000008', 2, 'Fairway', 145, 'Green', 22, false, null, null, null),
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000008', 3, 'Green', 22, 'Green', 3, false, null, null, null),
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000008', 4, 'Green', 3, 'Green', 0, false, null, null, null),
  -- Hole 9 (par 5): par
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000009', 1, 'Tee', 540, 'Fairway', 260, false, 'Driver', null, null),
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000009', 2, 'Fairway', 260, 'Fairway', 90, false, null, null, null),
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000009', 3, 'Fairway', 90, 'Green', 12, false, null, null, null),
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000009', 4, 'Green', 12, 'Green', 1, false, null, null, null),
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000009', 5, 'Green', 1, 'Green', 0, false, null, null, null),
  -- Hole 10 (par 4): par
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000010', 1, 'Tee', 370, 'Fairway', 140, false, 'Driver', null, null),
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000010', 2, 'Fairway', 140, 'Green', 19, false, null, null, null),
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000010', 3, 'Green', 19, 'Green', 2, false, null, null, null),
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000010', 4, 'Green', 2, 'Green', 0, false, null, null, null),
  -- Hole 11 (par 3): par
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000011', 1, 'Tee', 185, 'Green', 28, false, null, null, null),
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000011', 2, 'Green', 28, 'Green', 3, false, null, null, null),
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000011', 3, 'Green', 3, 'Green', 0, false, null, null, null),
  -- Hole 12 (par 4): par
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000012', 1, 'Tee', 395, 'Fairway', 155, false, 'Driver', null, null),
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000012', 2, 'Fairway', 155, 'Green', 24, false, null, null, null),
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000012', 3, 'Green', 24, 'Green', 2, false, null, null, null),
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000012', 4, 'Green', 2, 'Green', 0, false, null, null, null),
  -- Hole 13 (par 5): par
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000013', 1, 'Tee', 510, 'Fairway', 240, false, 'Driver', null, null),
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000013', 2, 'Fairway', 240, 'Fairway', 75, false, null, null, null),
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000013', 3, 'Fairway', 75, 'Green', 14, false, null, null, null),
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000013', 4, 'Green', 14, 'Green', 1, false, null, null, null),
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000013', 5, 'Green', 1, 'Green', 0, false, null, null, null),
  -- Hole 14 (par 4): par
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000014', 1, 'Tee', 375, 'Fairway', 148, false, 'Driver', null, null),
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000014', 2, 'Fairway', 148, 'Green', 21, false, null, null, null),
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000014', 3, 'Green', 21, 'Green', 2, false, null, null, null),
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000014', 4, 'Green', 2, 'Green', 0, false, null, null, null),
  -- Hole 15 (par 4): par
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000015', 1, 'Tee', 405, 'Fairway', 160, false, 'Driver', null, null),
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000015', 2, 'Fairway', 160, 'Green', 26, false, null, null, null),
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000015', 3, 'Green', 26, 'Green', 3, false, null, null, null),
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000015', 4, 'Green', 3, 'Green', 0, false, null, null, null),
  -- Hole 16 (par 3): par
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000016', 1, 'Tee', 150, 'Green', 22, false, null, null, null),
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000016', 2, 'Green', 22, 'Green', 2, false, null, null, null),
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000016', 3, 'Green', 2, 'Green', 0, false, null, null, null),
  -- Hole 17 (par 4): par
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000017', 1, 'Tee', 388, 'Fairway', 152, false, 'Driver', null, null),
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000017', 2, 'Fairway', 152, 'Green', 17, false, null, null, null),
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000017', 3, 'Green', 17, 'Green', 2, false, null, null, null),
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000017', 4, 'Green', 2, 'Green', 0, false, null, null, null),
  -- Hole 18 (par 5): par
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000018', 1, 'Tee', 530, 'Fairway', 255, false, 'Driver', null, null),
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000018', 2, 'Fairway', 255, 'Fairway', 85, false, null, null, null),
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000018', 3, 'Fairway', 85, 'Green', 16, false, null, null, null),
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000018', 4, 'Green', 16, 'Green', 1, false, null, null, null),
  (gen_random_uuid(), 'a1000000-0000-0000-0000-000000000018', 5, 'Green', 1, 'Green', 0, false, null, null, null);

-- ============================================================
-- Round 2 — Player Two, Practice Track, 9 holes, all pars (36)
-- ============================================================
insert into public.rounds (id, player_id, course_id, played_on, round_type, round_number)
values ('bbbbbbbb-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222',
        '66666666-6666-6666-6666-666666666666', '2026-05-02', 'Practice', null)
on conflict (id) do nothing;

insert into public.holes (id, round_id, hole_number, par)
select
  ('b1000000-0000-0000-0000-0000000000' || lpad(n::text, 2, '0'))::uuid,
  'bbbbbbbb-0000-0000-0000-000000000001',
  n,
  4
from generate_series(1, 9) as n
on conflict (id) do nothing;

-- Every hole: drive to fairway, approach to 20 ft, two putts (par).
do $$
declare
  n int;
begin
  for n in 1..9 loop
    insert into public.shots (
      id, hole_id, shot_number, starting_lie, starting_distance,
      ending_lie, ending_distance, has_penalty, club_category, miss_direction, putt_long_short
    )
    values
      (gen_random_uuid(), ('b1000000-0000-0000-0000-0000000000' || lpad(n::text, 2, '0'))::uuid,
       1, 'Tee', 380, 'Fairway', 150, false, 'Driver', null, null),
      (gen_random_uuid(), ('b1000000-0000-0000-0000-0000000000' || lpad(n::text, 2, '0'))::uuid,
       2, 'Fairway', 150, 'Green', 20, false, null, null, null),
      (gen_random_uuid(), ('b1000000-0000-0000-0000-0000000000' || lpad(n::text, 2, '0'))::uuid,
       3, 'Green', 20, 'Green', 2, false, null, null, null),
      (gen_random_uuid(), ('b1000000-0000-0000-0000-0000000000' || lpad(n::text, 2, '0'))::uuid,
       4, 'Green', 2, 'Green', 0, false, null, null, null);
  end loop;
end $$;
