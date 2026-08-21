# Golf Intelligence — Theory Golf Platform

A golf intelligence platform for collegiate golf programs with three pillars:

- **Golf Intelligence** — Analytics dashboard: Tiger 5, root cause analysis, strokes gained
- **PlayerPath** — Performance driver identification and structured practice
- **Resources** — Customizable yardage cards, aiming aids, on-course tools

**Live site:** [theory.golf](https://theory.golf)

---

## Development

The site lives in `/web` (Next.js 15, hosted on Vercel).

```bash
cd web
npm install
cp .env.example .env.local   # fill in your values
npm run dev                   # http://localhost:3000
```

## Environment Variables

See `web/.env.example` for required variables:

| Variable | Purpose |
|----------|---------|
| `FORMSPREE_URL` | Contact form endpoint (server-side) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (RLS-gated, browser-safe) |

## Routes

| Route | Description |
|-------|-------------|
| `/` | Marketing home |
| `/golf-intelligence` | Analytics dashboard |
| `/player-path` | PlayerPath — overview, The Plan, practice by segment |
| `/player-path/driver-standard` | Driver Standard (driving) |
| `/player-path/approach-standard` | Approach Standard (approach) |
| `/player-path/line-test` | Line Test (approach) |
| `/player-path/wedge-standard` | Wedge Standard (wedge) |
| `/player-path/round-simulation` | Round Simulation (putting) |
| `/player-path/lag-putt-test` | Lag Putt Test (putting) |
| `/player-path/putting/inside-ten` | Inside Ten (+ `/history`) |
| `/player-path/putting/inside-twenty` | Inside Twenty (+ `/history`) |
| `/player-path/putting/winners-circle` | Winners Circle (+ `/history`) |
| `/resources` | Tools index |
| `/resources/weather-yardage-card` | Weather-adjusted yardage card |
| `/resources/standard-yardage-card` | Standard yardage card |
| `/resources/approach-aim-optimizer` | Approach aim optimizer |
| `/contact` | Contact form |

## Schema notes

Read these before touching `supabase/migrations/` or building coach/team features.

**The migrations rebuild the database.** `supabase/migrations/` was catching up
to a schema that had largely been created by hand in the dashboard; `0000_baseline.sql`
is the snapshot that closed that gap. Applying `0000` through `0005` to an empty database
reproduces production exactly — 17 tables, 173 columns, 86 constraints, 25 indexes,
8 functions, 10 triggers, 42 policies, 1 view. Every file is idempotent, so re-running
against the live project is a no-op.

To verify after a schema change, rebuild locally and diff the catalogs against production:

```bash
createdb tg && psql -d tg -c "create schema auth" \
  -c "create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb)" \
  -c "create function auth.uid() returns uuid language sql stable as \$\$ select null::uuid \$\$"
for f in supabase/migrations/*.sql; do psql -d tg -v ON_ERROR_STOP=1 -f "$f"; done
```

Regenerate TypeScript types for the schema with Supabase's `generate_typescript_types`.
The hand-written row types in `web/src/lib/{golf,playerpath}/db/types.ts` were last
checked against generated output and matched.

**Two known lints, both pre-existing.** `set_updated_at`, `set_drill_sessions_updated_at`,
and `shots_no_play_after_holed` have a mutable `search_path`; several `SECURITY DEFINER`
functions are executable by `anon` via RPC. Neither was introduced by recent work — see
`get_advisors` for the current list.

**There are two coach–player models, and only one is wired up.**

| Model | Used by | Rows |
|-------|---------|------|
| `team_members` + `profiles.role = 'coach'` | `can_access_player()`, and therefore every RLS policy | 0 |
| `coaches` + `coach_players` | nothing | 0 |

No application code reads `profiles`, `team_members`, `coaches`, `coach_players`, or `.role` —
the coach/team layer exists only in the database today. Coach and team roles are planned for the
Golf Intelligence dashboard; that work should build on the first model, since row-level security
already commits to it. Consolidate rather than adding to the second.

**Coach access to practice data is intentional.** `drill_sessions` reads use the same
`can_access_player()` rule as `rounds`/`shots`, so populating `team_members` gives coaches
visibility of their players' practice results as well as their rounds. This is the accountability
model PlayerPath is built on — see the comment in `0004_drill_sessions.sql` before changing it.

**Player identity.** `drill_sessions.player_id` references `auth.users`, while
`rounds.player_id` references `players`. Every `players.id` is its auth user's id, so the same
UUID identifies a player on both sides — use `auth.uid()` when writing either.
