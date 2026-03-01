# Plan: SG Per Hole By Shot Type Table

## Overview
Add a new table to the Strokes Gained tab showing strokes gained breakdown per hole by shot type.

## Requirements
- **Columns**: Hole numbers (1-18)
- **Rows**: Shot types (Drive, Approach, Short Game, Putt)
- **Toggle**: Radio button selector to switch between:
  - Total SG (sum of all shots of that type on each hole)
  - Average SG per shot (SG / number of shots)
- **Styling**: Consistent with master theme (dark court theme)

## Implementation Plan

### 1. Add State for Toggle
In the `StrokesGainedView` component, add state to track the display mode:
```tsx
const [sgDisplayMode, setSgDisplayMode] = useState<'total' | 'average'>('total');
```

### 2. Create Data Aggregation Function
Process `filteredShots` to build a data structure:
- Group shots by hole (1-18)
- Within each hole, group by shot type:
  - Driving (Drive)
  - Approach (Approach)
  - Short Game (Short Game)
  - Putting (Putt)
  - Other (Recovery + any other shot types not in the above)
- Calculate total SG and count per hole-type combination

### 3. Create Radio Button Selector
Add a styled radio button group with options:
- "Total SG"
- "Average SG / Shot"

### 4. Create Table Component
Build a table with:
- **Header row**: Hole numbers 1-18
- **Row headers**: Shot type labels (Drive, Approach, Short Game, Putt)
- **Cell values**: SG values (total or average based on toggle)
- **Cell styling**: Use `getStrokeGainedColor()` for text color

### 5. Styling (Master Theme)
- Background: `var(--charcoal)` / `var(--obsidian)`
- Borders: `1px solid var(--pitch)`
- Header text: `var(--ash)` (muted)
- Data text: `var(--chalk)` with SG color coding
- Consistent with existing tables in App.tsx (e.g., RootCauseByFailTypeSection)

### 6. Placement
Add the new table section after the "SG Separators" section in `StrokesGainedView`.

## Data Structure for Table
```typescript
interface HoleShotTypeData {
  hole: number;
  shotType: ShotType;
  totalSG: number;
  shotCount: number;
  avgSG: number;
}

// Derived data structure:
type TableData = Record<ShotType, Record<number, HoleShotTypeData>>;
```

## Visual Mockup

```
┌─────────────────────────────────────────────────────────────────────┐
│  SG by Hole & Shot Type                              [○] Total  [○] Avg │
├──────────┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬───┤
│          │ 1│ 2│ 3│ 4│ 5│ 6│ 7│ 8│ 9│10│11│12│13│14│15│16│17│18│ TOT│
├──────────┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼───┤
│ Driving  │+0.5│-0.2│...                                                  │
│ Approach │+0.3│+0.1│...                                                  │
│ Short Gm │-0.1│+0.2│...                                                  │
│ Putting  │+0.2│-0.1│...                                                  │
└──────────┴──┴──┴──┴──┴──┴──┴──┴──┴──┴──┴──┴──┴──┴──┴──┴──┴──┴──┴───┘
```

## Files to Modify
- `src/App.tsx` - Add the new table component and state to StrokesGainedView
