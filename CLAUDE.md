# CLAUDE.md — Theory Golf / Golf Intelligence Platform

## Project Overview

A golf intelligence platform for collegiate golf programs. The platform has three pillars:

1. **Golf Intelligence** — Analytics dashboard: Tiger 5, root cause analysis, strokes gained
2. **PlayerPath** — Performance driver identification and structured practice
3. **Resources** — Customizable yardage cards, aiming aids, on-course tools

**Live sites:**
- `theory.golf` — Marketing site (Next.js, `/web` directory)
- `intelligence.theory.golf` — Dashboard (React + Vite, `/src` directory)

---

## Architecture

Two apps in one repo, deployed separately via Vercel:

| | Marketing Site | Dashboard |
|---|---|---|
| **Directory** | `/web` | `/src` (root) |
| **Framework** | Next.js 14 + App Router | React 18 + Vite |
| **Styling** | Tailwind CSS | Custom CSS |
| **Vercel project** | `golf-intelligence2-0` | separate project |
| **Domain** | `theory.golf` | `intelligence.theory.golf` |

The dashboard migration to Next.js is planned but not yet complete.
Do not migrate the dashboard to Next.js without explicit instruction.

---

## Design System

**The single source of truth for all visual decisions is `theory-golf-design-system-v2.html`.**
This file lives in the repo root. Always read it before making any UI decisions.

### Core principles
- **Tailwind CSS** is the styling approach for the marketing site (`/web`)
- **CSS custom properties** form the token layer — defined in `globals.css`, mapped to Tailwind via `tailwind.config.ts`
- The dashboard (`/src`) uses custom CSS — do not convert it to Tailwind without explicit instruction
- Never hardcode color values — always use design tokens

### Token layer (both apps share these values)
```
Brand accent:     --color-accent / scarlet #E8202A
Fonts:            --font-display (Barlow Condensed), --font-body (Barlow), --font-mono (DM Mono)
Dark surfaces:    --color-bg, --color-surface, --color-card
Light surfaces:   flip via [data-theme="light"]
```

### Game segment colors (dashboard — formally defined in v2)
These must be consistent everywhere a segment appears — cards, charts, legends, reports:
```
--seg-drive:      #E040A0   Driving
--seg-approach:   #D4A800   Approach
--seg-shortgame:  #00B870   Short Game
--seg-putting:    #3D8EF0   Putting
--seg-recovery:   #F07030   Recovery
--seg-penalty:    #8B1219   Penalty
```

### Typography rules
- All numbers, stat values, percentages, data labels → DM Mono (`--font-mono`)
- All section headings, KPI values, nav labels → Barlow Condensed (`--font-display`)
- All body copy, descriptions, callouts → Barlow (`--font-body`)
- SG positive values → `--data-positive` (#00B870 green)
- SG negative values → `--data-negative` (#E8202A scarlet)
- SG caution values → `--data-caution` (#F09020 amber)

---

## Marketing Site — `/web`

### Tech stack
- Next.js 14 with App Router
- TypeScript
- Tailwind CSS
- `next/font` for font loading (Barlow Condensed, Barlow, DM Mono)

### Styling rules
- **All component styling uses Tailwind utility classes in JSX** — no custom CSS classes
- `globals.css` contains only: `@tailwind` directives + CSS custom property token layer
- Tokens are mapped in `tailwind.config.ts` so you can write `bg-accent`, `text-muted`, `font-display`
- Never write a `.custom-class { }` block in globals.css

### File structure
```
web/
  app/
    layout.tsx        # Root layout — next/font, metadata, ThemeProvider
    globals.css       # @tailwind directives + token layer ONLY
    page.tsx          # Homepage
    golf-intelligence/
    player-path/
    resources/
    contact/
  components/
    Navbar.tsx
    Footer.tsx
    ThemeToggle.tsx
  tailwind.config.ts  # Token → Tailwind class mapping
```

### Metadata (required on every page)
Every page must export a `metadata` object with `title` and `description`.
Root layout uses template: `{ default: 'Theory Golf', template: '%s · Theory Golf' }`

### Mobile-first
All components are designed mobile-first. Breakpoints: `sm` 640px, `md` 768px, `lg` 1024px, `xl` 1280px.
The nav collapses to a hamburger drawer on mobile. Test at 375px width.

---

## Dashboard — `/src`

### Tech stack
- React 18 + TypeScript + Vite
- Recharts v2 — **use for ALL charts, no exceptions, never add another charting library**
- PapaParse — **use for all CSV parsing**
- Custom CSS (`src/styles/globals.css`)

### File structure
```
src/
  components/       # All UI components (PascalCase filenames)
  data/             # Data files, CSV loading, benchmarks.ts
  hooks/            # Custom hooks — useGolfData is the main data hook
  styles/           # globals.css — do not add new CSS files
  types/            # golf.ts — primary TypeScript interfaces
  utils/
    calculations.ts           # Core SG calculations — read before modifying
    playerPathCalculations.ts # PlayerPath driver logic — read before modifying
  App.tsx           # Main entry — tab/routing logic
  main.tsx          # React root mount
golf_data.csv       # Primary shot data
new_data.csv        # Additional shot data
plans/              # Feature planning docs — read before building any feature
```

### Data model — key CSV field names (use exactly as written)
```
Starting Lie    — Tee, Fairway, Rough, Sand, Green, Recovery
Ending Lie      — same values
Starting Distance, Ending Distance  — yards
Did not Hit Driver  — yes/no
Putt Result     — short/long
Player, Round ID, Date, Course, Shot, Hole, Score
Weather Difficulty, Course Difficulty, Tournament, Penalty
```

**CRITICAL:** Strokes Gained is calculated internally from benchmark tables.
It is NOT a raw CSV field. Never read SG from CSV. Never add it as a column.

### Benchmark types
`pgaTour` | `eliteCollege` | `competitiveAm` — selected in FilterBar UI.
Never modify `src/data/benchmarks.ts` without explicit instruction.

### PlayerPath driver system
Performance drivers are flagged across five segments with severity levels (moderate/high/severe).
Always read `plans/player-path-tab-plan.md` before modifying any driver logic.

```
Driving:    D1 Tee Penalty Rate, D2 Distance Deficiency, D3 Severe Misses,
            D4 Rough Penalty on Long 2nds, D5 Driver Value Gap
Approach:   A1 GIR by Distance, A2 Proximity in Scoring Zones,
            A3 Lie-Based Gap, A4 Distance Band Black Hole
Putting:    L1-L3 Lag Putting, M1-M2 Makeable Putts (<20ft)
Short Game: S1-S3 Proximity and Failure Rates
```

### Dashboard styling rules
- Use the game segment color tokens for all segment-related UI
- DM Mono for all data values, percentages, SG numbers
- Barlow Condensed for section headings and KPI values
- Do not introduce new CSS files — all styles go in `src/styles/globals.css`
- Do not convert to Tailwind without instruction

---

## Rules That Never Change

### Data integrity
- Never read SG from CSV — always calculate internally
- When adding new data fields, update `src/types/golf.ts` first, then calculations, then UI
- Never modify benchmark tables without explicit instruction
- Always use TypeScript — no plain `.js` files

### Code conventions
- Component files: PascalCase (`PlayerCard.tsx`)
- Types: `src/types/`
- Reusable logic: `src/utils/`
- Stateful logic: `src/hooks/`
- Read the relevant file in `plans/` before building or modifying any feature
- Prefer editing existing files over creating new ones — ask first if a new file is needed
- Keep code well-commented — this project is maintained with AI assistance

### What requires explicit instruction before touching
- `src/utils/calculations.ts` — SG calculation logic
- `src/utils/playerPathCalculations.ts` — PlayerPath driver logic
- `src/data/benchmarks.ts` — benchmark tables
- `src/types/golf.ts` — TypeScript interfaces
- Any Recharts chart configuration
- Auth, database, routing architecture
- Dashboard → Next.js migration
- Folder structure reorganization

---

## Commands

### Marketing site (`/web`)
```bash
npm run dev       # Local dev server
npm run build     # Type-check + production build
npm run lint      # ESLint
```

### Dashboard (`/src` root)
```bash
npm run dev       # Local dev server (Vite)
npm run build     # Production build
npm run lint      # ESLint
npm run preview   # Preview production build
```

---

## Deployment

Both apps deploy via Vercel from the same GitHub repo (`Theory-Golf/GolfIntelligence2.0`).
DNS is managed via Porkbun.

| App | Vercel Root Directory | Domain |
|---|---|---|
| Marketing site | `web` | `theory.golf` |
| Dashboard | `.` (repo root) | `intelligence.theory.golf` |

When Vercel shows "Configuration Settings differ from current Project Settings,"
a new production deployment must be manually triggered by promoting a preview build.
