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

**The repo describes 4 of ~17 production tables.** `supabase/migrations/` covers `profiles`,
`teams`, `team_members`, and `drill_sessions`. Missing: `players`, `coaches`, `coach_players`,
`schools`, `ethos_papers`, `courses`, `holes`, `rounds`, `shots`, and three `*_edits` audit
tables — all created outside the repo. A clean checkout cannot rebuild the database. Baselining
the live schema is outstanding work.

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
