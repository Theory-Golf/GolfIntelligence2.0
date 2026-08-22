-- 0009_profiles_gender.sql
-- Adds a gender field to player profiles, used to default which strokes
-- gained benchmark tables (male or female) a player's dashboard applies.
-- Nullable: existing players default to no gender set, and the dashboard
-- falls back to the male benchmark until the viewer picks one manually.

alter table public.profiles
  add column if not exists gender text check (gender in ('male', 'female'));
