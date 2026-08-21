# Dashboard mobile pass — progress ledger

Temporary. **Delete in the final commit** — this must not reach `main`.

Plan: responsive + readability pass on `/golf-intelligence`.
Branch: `claude/golf-dashboard-mobile-v8go5e`. Commit prefix: `mobile(N):`.

## Rules
1. Push after every commit. Unpushed work dies with the container.
2. Never leave a sweep half-applied in the working tree — commit per file.
3. Every commit builds: `npm run lint && npm run build` in `web/` first.
4. CSS before TSX, always. A view swapped to `.grid-tiles-5` before that
   class exists renders single-column.

## Steps

- [x] **1** — grid ladder CSS in `dashboard.css` + `overflow-x: clip` on `.app`
- [x] **2** — swap 23 inline grids to ladder classes (8 files, one commit each)
- [ ] **3** — drawer CSS: `@media (max-width: 767px)` block, backdrop, fab, close, desktop guards
- [ ] **4** — `Dashboard.tsx`: `filtersOpen`, close-on-tab-change, scroll lock, trigger
- [ ] **5** — `FilterBar.tsx`: `isOpen`/`onClose`, backdrop, close button, `:56` gate fix
- [ ] **6** — density CSS: `.gi-table-scroll`, mobile padding, header stack, nav snap + fade
- [ ] **7** — wrap 11 unwrapped tables, `min-width` on all 17 (one commit each)
- [ ] **8** — sticky rework: `--gi-navbar-h`/`--gi-nav-h`, `.header` static, z-order, touch targets
- [ ] **9** — `web/src/lib/useMediaQuery.ts`
- [ ] **10** — chart props (one commit per file)
- [ ] **11** — `barSize` → `maxBarSize`
- [ ] **12a** — sticky first column: `CoachingView` + 2 heat maps
- [ ] **12b** — type scale: `.value-*` clamps, `.nav-tab` 12px, tables 13px, ticks 12px
- [ ] **cleanup** — dead CSS, stale comments, duplicated tokens, delete this file

## Deriving progress without this file

Run these first on resume — authoritative, seconds:

| Step | Command | Done when |
|---|---|---|
| 1 | `rg -c "grid-tiles-5" web/src/styles/dashboard.css` | >=1 |
| 2 | `rg -c --no-filename gridTemplateColumns web/src/components/dashboard/ \| paste -sd+ \| bc` | **1** |
| 3 | `rg -c "filter-backdrop" web/src/styles/dashboard.css` | >=1 |
| 4 | `rg -c filtersOpen web/src/components/dashboard/Dashboard.tsx` | >=1 |
| 5 | `rg -F '!isCollapsed \|\| isOpen' web/src/components/dashboard/FilterBar.tsx` | 1 match |
| 6 | `rg -c "gi-table-scroll" web/src/styles/dashboard.css` | >=1 |
| 7 | `rg -c --no-filename "gi-table-scroll" web/src/components/dashboard/ \| paste -sd+ \| bc` | **17** |
| 8 | `rg -c "gi-navbar-h" web/src/styles/dashboard.css` | >=1 |
| 9 | `test -f web/src/lib/useMediaQuery.ts && echo yes` | `yes` |
| 10 | `rg -F -c --no-filename "interval={0}" web/src/components/dashboard/` | **no matches** |
| 11 | `rg -F "barSize=" web/src/components/dashboard/ \| rg -v maxBarSize` | no output |
| 12b | `rg -F "font-size: 72px" web/src/styles/dashboard.css` | no output |

Then `git status` — anything uncommitted belongs to the one step the table
shows as incomplete.
