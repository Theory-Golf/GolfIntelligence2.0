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
| `NEXT_PUBLIC_FORMSPREE_URL` | Contact form endpoint |
| `NEXT_PUBLIC_GOLF_DATA_URL` | Google Sheets CSV data source |

## Routes

| Route | Description |
|-------|-------------|
| `/` | Marketing home |
| `/golf-intelligence` | Analytics dashboard |
| `/player-path` | Practice & development |
| `/player-path/round-simulation` | Round simulation tool |
| `/player-path/wedge-standard` | Wedge standards |
| `/resources` | Tools index |
| `/resources/weather-yardage-card` | Weather-adjusted yardage card |
| `/resources/standard-yardage-card` | Standard yardage card |
| `/resources/approach-aim-optimizer` | Approach aim optimizer |
| `/contact` | Contact form |
