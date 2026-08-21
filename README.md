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
