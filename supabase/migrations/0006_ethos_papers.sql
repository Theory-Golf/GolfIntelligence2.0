-- 0006_ethos_papers.sql
-- Public research-paper library ("Ethos"). Papers are inserted directly via
-- the Supabase dashboard / service role -- no in-app authoring UI exists yet.
-- PDFs (and any inline figures referenced from body_markdown) live in the
-- public "ethos-papers" storage bucket.

create table if not exists public.ethos_papers (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  summary text not null,
  body_markdown text not null,
  pdf_path text,
  display_order integer not null default 0,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ethos_papers_published_idx
  on public.ethos_papers (published_at desc)
  where published_at is not null;

alter table public.ethos_papers enable row level security;

drop policy if exists "ethos_papers_select_published" on public.ethos_papers;
create policy "ethos_papers_select_published" on public.ethos_papers
  for select
  using (published_at is not null and published_at <= now());

-- Papers are managed via the Supabase dashboard / service role for now (no
-- authoring UI), so no insert/update/delete policies are defined here --
-- mirrors the teams/team_members approach in 0001_profiles_teams.sql.

-- ============================================================
-- Storage: public bucket for paper PDFs and inline figures
-- ============================================================
insert into storage.buckets (id, name, public)
values ('ethos-papers', 'ethos-papers', true)
on conflict (id) do nothing;

drop policy if exists "ethos_papers_storage_public_read" on storage.objects;
create policy "ethos_papers_storage_public_read" on storage.objects
  for select
  using (bucket_id = 'ethos-papers');

-- No insert/update/delete policy on storage.objects for this bucket --
-- uploads happen via the dashboard / service role.
