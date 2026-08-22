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

## Verifying practice sync

Practice results are written to `drill_sessions` and keyed to the signed-in
player, so a player's history follows them to any device. The security and
idempotency guarantees behind that are enforced by row-level security and a
unique constraint on `(player_id, drill_type, client_id)`, and are verified
directly in SQL.

What SQL cannot show is the client round trip. Run that from a machine that
can reach the Supabase project — sandboxed CI and agent environments generally
cannot, which is why this is a script rather than a test in the suite:

```bash
cd web
TG_TEST_EMAIL=you@example.com TG_TEST_PASSWORD=... npm run verify:practice-sync
```

It signs in, writes a result, then reads it back through a **second,
independent client signed in as the same player** — the cross-device proof —
and replays the identical write to confirm an offline-queue flush updates the
row rather than duplicating it. Add `TG_OTHER_EMAIL` / `TG_OTHER_PASSWORD` to
also confirm a different player cannot see the row. It only ever writes rows of
`drill_type = '_verify'` and deletes them on the way out, including after a
failure, so real history is never touched.

**Its `client_id` is deliberately not a UUID.** Six drills key sessions off
`Date.now()`, and this script previously generated a UUID here — which is why it
passed for the entire period those six could not save at all. If you change that
line, keep the shape the real drills produce.

**One thing it deliberately doesn't cover:** the browser's own offline
behaviour, since `navigator.onLine` and the localStorage queue only exist in a
page. To check that by hand: open a drill, switch DevTools to Offline, finish
the drill, confirm the result still renders, then go back online and reload —
the row should appear exactly once in `drill_sessions`.

## Schema notes

Read these before touching `supabase/migrations/` or building coach/team features.

**The migrations rebuild the database.** `supabase/migrations/` was catching up to a
schema largely created by hand in the dashboard; `0000_baseline.sql` is the snapshot
that closed that gap. `0000` through `0010` are applied and recorded, and the recorded
version of each matches its filename prefix. Every file is idempotent, so re-running
against the live project is a no-op.

Two conventions worth keeping:

- **One version per file.** `0005_drill_sessions.sql` and a former
  `0005_ethos_papers.sql` both claimed `0005`. The CLI keys on the version prefix, so
  only one of them could ever be recorded — the ethos table ended up applied by hand
  and untracked. It is now `0006_ethos_papers.sql`.
- **Unapplied SQL does not live in `migrations/`.** Anything proposed but not yet
  run belongs in `supabase/proposals/`, where `db push` cannot pick it up. That
  directory is currently empty -- the RLS consolidation that lived there shipped as
  `0010`.

To verify after a schema change, rebuild locally and diff the catalogs against production:

```bash
createdb tg && psql -d tg -c "create schema auth" \
  -c "create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb)" \
  -c "create function auth.uid() returns uuid language sql stable as \$\$ select null::uuid \$\$"
for f in supabase/migrations/*.sql; do psql -d tg -v ON_ERROR_STOP=1 -f "$f"; done
```

### Two failures worth not repeating

Both were live in production for months without surfacing an error, and both are
the same underlying mistake: a schema assumption the code had already committed to.

**A shared trigger name silently removed player creation.** `rounds.player_id` and
`courses.player_id` are foreign keys to `players(id)`, and nothing in the app inserts
into `players` — that row has always come from a trigger on `auth.users`. Two
functions were written for it, `handle_new_auth_user()` (players, untracked) and
`handle_new_user()` (profiles, from `0001`), and both were attached under the name
`on_auth_user_created`. When `0001` ran its `drop trigger if exists` and recreated the
trigger, it removed the players insert. Every signup between 2026-08-11 and
`0007_seed_player_on_signup.sql` produced a profiles row and no players row, so the
first course or round insert failed on the foreign key. `0007` folds both inserts into
one function; **do not add a second trigger on `auth.users`.**

**A column type rejected six drills' history.** `drill_sessions.client_id` was declared
`uuid`, but only four drills generate UUID session ids — the other six key off
`Date.now()`. Every write from those six raised `22P02`, was caught by
`persistOrQueue`, retried five times, then dead-lettered and dropped with nothing shown
to the player. Production held sessions for exactly three drill types until
`0008_drill_sessions_client_id_text.sql` widened the column to `text`.

`scripts/verify-practice-sync.mjs` passed throughout, because it generated its own
UUID `client_id` instead of the shape the drills actually produce. It now uses a
`Date.now()`-based id. **A sync test that invents its own key tests nothing.**

### Known mismatch, not yet resolved

`rounds.course_id` is `NOT NULL` in the database, but the round-entry flow and
`roundSession.tsx` both handle a null course. In practice the flow always creates or
matches a course before submit, so they have never disagreed at runtime. Whether a
course-less round should be allowed is a product decision — resolve it by changing one
side deliberately, not by quietly tightening the type.

### Types

The row types in `web/src/lib/{golf,ethos}/db/types.ts` are hand-written. They drifted
once already: `RoundRow` was missing seven columns and `CourseRow` three, and because
the `*Insert` types are derived from the `*Row` types with `Omit`, those columns could
not be written at all. Regenerate with Supabase's `generate_typescript_types` and diff
before assuming they still match. Columns with a database default or filled in by the
server are optional on the `*Insert` types, so adding one to a `*Row` type does not
force every call site to pass it.

### Lints

`set_updated_at`, `set_drill_sessions_updated_at` and `shots_no_play_after_holed` have
a mutable `search_path`; several `SECURITY DEFINER` functions are executable by `anon`
via RPC; leaked-password protection is off in Auth settings. All pre-existing — see
`get_advisors` for the current list.
### Coach access: one model, one rule

`0010_coach_model_consolidation.sql` collapsed two competing coach-player models
into one. Before it, the database answered "which coach sees which player" twice:
`team_members` + `profiles.role` governed every SELECT, while
`coaches`/`coach_teams`/`coach_players` governed every UPDATE. Nothing connected
them, so a coach registered in one could read but not edit, or edit but not read.
Both were empty, so nothing broke -- coach access had simply never worked
end to end, and had never been tested.

**The rule now lives in one function.** `can_access_player(target)` returns true if:

1. `target` is you, or
2. you are an admin (`profiles.role = 'admin'`), or
3. you coach the team the player is on (`coach_teams` -> `players.team_id`), or
4. you hold a direct, unrevoked assignment (`coach_players`, `revoked_at is null`).

`can_edit_player(target)` currently delegates to it -- a coach may correct their
player's round. It exists as a seam: to make some coaches view-only, change that
one function and every write policy follows.

**Coach authority comes from the assignment tables, not from `profiles.role`.**
Being listed in `coach_teams` / `coach_players` is what grants access. `role` is a
UI hint plus the admin flag. This is deliberate -- see the privileges note below.

Assignments are made by an admin (dashboard or service role). There is no in-app
management UI, so `coach_teams` / `coach_players` are select-only under RLS.

| Want to&hellip; | Do this |
|---|---|
| Make someone a coach | `update profiles set role='coach' where id=…` then insert into `coach_teams` |
| Give a coach a whole team | insert into `coach_teams (coach_id, team_id)` |
| Give a coach one player | insert into `coach_players (coach_id, player_id)` |
| End a direct assignment | set `coach_players.revoked_at` -- do not delete the row |
| Make someone an admin | `update profiles set role='admin' where id=…` |

### Roles are assigned, never self-selected

`authenticated` no longer holds blanket UPDATE on `profiles` and `players`. Before
`0010`, it did -- and because the update policies allow writing your own row, **any
player could set `profiles.role = 'coach'` and `players.team_id` to any team**, then
read every teammate's rounds, shots and practice data. It was inert only because
`can_access_player()` read the empty `team_members` table; a real roster would have
made it live.

RLS cannot express "this row but not that column", so this is enforced with
column-level privileges:

```sql
grant update (display_name, gender)            on public.profiles to authenticated;
grant update (display_name, graduation_year)   on public.players  to authenticated;
```

`role`, `team_id` and `is_active` are settable only by an admin through the
dashboard or service role. **Sign a person up as a normal player, then set their
role.** If you add a column that must not be self-assigned, it is excluded by
default -- but if you add one a user *should* edit, you must grant it explicitly or
the app will get a permission error.

### A player's data follows the player

Rounds, shots, courses and practice sessions hang off the player, never off a team
or a coach, and the foreign keys enforce it rather than leaving it to convention:

- `rounds.player_id` and `courses.player_id` are **RESTRICT** -- a player with data
  cannot be deleted.
- `players.team_id` is **SET NULL** -- deleting a team never deletes players.

So moving a player between teams, or revoking a coach assignment, changes who can
*see* the data and nothing else.

Two consequences worth deciding on before onboarding a real program:

- **A former coach loses visibility of history.** Move a player from team A to
  team B and coach A immediately sees nothing -- including rounds played while the
  player was on their team. `rounds.team_id_at_round` exists for exactly this and
  is never written by the app. Populate it if a coach should keep the season a
  player played for them.
- **Deleting a login still destroys practice history.** `drill_sessions.player_id`
  cascades from `auth.users`, while rounds are protected by RESTRICT. The two
  should probably match.

**Coach access to practice data is intentional.** `drill_sessions` reads use the
same `can_access_player()` rule as `rounds`/`shots`, so assigning a coach gives
them their players' practice results as well as their rounds. This is the
accountability model PlayerPath is built on -- see the comment in
`0005_drill_sessions.sql` before changing it. Practice *writes* stay owner-only: a
result is recorded by the player who played the drill, never on their behalf.

**Player identity.** `drill_sessions.player_id` references `auth.users`, while
`rounds.player_id` references `players`. Every `players.id` is its auth user's id,
so the same UUID identifies a player on both sides -- use `auth.uid()` when writing
either. `profiles` and `players` are both created by the `handle_new_user` trigger
on signup; `profiles` carries identity and role, `players` carries player
attributes.
