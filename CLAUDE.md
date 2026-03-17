# CLAUDE.md — Theory Golf / Golf Intelligence Platform

## Project Overview
A golf intelligence platform for college golfers. The dashboard includes Tiger 5 analysis,
Tiger 5 root cause analysis, strokes gained with custom benchmarks, and score performance
drivers. Players use the Player Path for skill development practice and assessments. Also
includes tools like custom yardage cards and an approach aim optimizer.

Live site: https://golf-intelligence2-0.vercel.app

## Tech Stack
- **Framework:** React 18 + TypeScript + Vite (hosted on Vercel)
- **Charts:** Recharts v2 — use this for ALL data visualizations, no exceptions
- **CSV parsing:** PapaParse — already installed, use for all data file reading
- **Database:** TBD — do not assume or implement any database structure without instruction
- **Auth:** TBD — do not implement or modify authentication without instruction
- **Language:** TypeScript throughout — no plain `.js` files in `src/`

## Planned Architecture Changes
- This project will eventually migrate to Next.js to support a combined marketing site +
  authenticated dashboard in one repo (theory.golf)
- Do not make architectural decisions that would complicate a Next.js migration
- Avoid Vite-specific patterns if a React-standard alternative exists
- Auth will be implemented as part of the Next.js migration — do not build custom auth now

## Repository Structure
```
src/
  components/   # All UI components
  data/         # Data files and CSV loading logic (includes benchmarks.ts)
  hooks/        # Custom React hooks (useGolfData is the main data hook)
  styles/       # CSS/style files — do not modify design tokens or CSS variables
  types/        # TypeScript interfaces (golf.ts is the primary type file)
  utils/        # Calculations and helpers (calculations.ts, playerPathCalculations.ts)
  App.tsx       # Main app entry — tab/routing logic lives here
  main.tsx      # React root mount

plans/          # Feature planning docs — read the relevant plan before building a feature
golf_data.csv   # Primary shot data file
new_data.csv    # Additional shot data
```

## Data Model
The app processes raw shot data from CSV. Key field names (use exactly as written):

**RawShot fields:**
- `Starting Lie` — shot origin (Tee, Fairway, Rough, Sand, Green, Recovery)
- `Ending Lie` — shot destination (same values)
- `Starting Distance`, `Ending Distance` — in yards
- `Did not Hit Driver` — yes/no
- `Putt Result` — short/long
- `Player`, `Round ID`, `Date`, `Course`, `Shot`, `Hole`, `Score`
- `Weather Difficulty`, `Course Difficulty`, `Tournament`, `Penalty`

**Important:** Strokes Gained is calculated internally from benchmark tables — it is NOT
a raw CSV field. Do not add SG as a column or read it from the CSV.

**Benchmark types:** pgaTour, eliteCollege, competitiveAm (selected in FilterBar UI)

## Key Files to Know
- `src/types/golf.ts` — all TypeScript interfaces, edit here first when adding new data fields
- `src/utils/calculations.ts` — core SG calculations, shot classification, round summaries
- `src/utils/playerPathCalculations.ts` — Player Path driver logic (D1-D5, A1-A4, L1-L3, M1-M2, S1-S3)
- `src/hooks/useGolfData.ts` — main data hook, returns processed data to all components
- `src/data/benchmarks.ts` — benchmark tables, do not modify without instruction

## Player Path Driver System
The Player Path flags Performance Drivers across four segments:
- **Driving:** D1 (Tee Penalty Rate), D2 (Distance Deficiency), D3 (Severe Misses),
  D4 (Rough Penalty on Long 2nds), D5 (Driver Value Gap)
- **Approach:** A1 (GIR by Distance), A2 (Proximity in Scoring Zones),
  A3 (Lie-Based Gap), A4 (Distance Band Black Hole)
- **Putting:** L1-L3 (Lag Putting), M1-M2 (Makeable Putts <20ft)
- **Short Game:** S1-S3 (Proximity and Failure Rates)

Each driver has severity levels (moderate/high/severe). Always reference
`plans/player-path-tab-plan.md` for thresholds before modifying this system.

## Design
- A design file exists in this repo — always reference it before making any UI decisions
- **Never change design tokens, color variables, or CSS custom properties — ever**
- Athletic, modern aesthetic targeting college-aged golfers
- Follow existing component patterns before introducing new ones

## File & Code Conventions
- Component files use PascalCase (e.g. `PlayerCard.tsx`)
- Types go in `src/types/`, reusable logic in `src/utils/`, stateful logic in `src/hooks/`
- Read the relevant file in `plans/` before building or modifying any feature
- Do not reorganize the folder structure without asking
- Prefer editing existing files over creating new ones — ask first if a new file is needed
- Keep code readable and well-commented — this project is maintained with AI assistance

## Commands
```bash
npm run dev       # Start local dev server
npm run build     # Type-check + production build
npm run lint      # Run ESLint
npm run preview   # Preview production build locally
```

## Rules
- Always use Recharts for charts — never introduce another charting library
- Never change design tokens or color variables
- Never read SG from CSV — always calculate it internally
- When adding new data fields, update `src/types/golf.ts` first, then calculations, then UI
- Use TypeScript types — avoid `any`
- Check `plans/` before starting any feature work
