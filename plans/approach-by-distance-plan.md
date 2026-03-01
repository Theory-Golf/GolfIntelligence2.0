# Approach by Distance Section - Implementation Plan

## Overview
Add an "Approach by Distance" section to the Approach tab that shows metrics grouped by distance buckets. The first group will only include approach shots from Tee and Fairway starting lies.

## Distance Buckets
Based on user requirements:
- **51-100 yards**: Distance Wedges
- **101-150 yards**: Short Approach
- **151-200 yards**: Medium Approach
- **201-225 yards**: Long Approach

Note: Shots ≤50 yards are classified as Short Game, not Approach (existing logic).

## Metrics Per Card
Each distance bucket card will display:
1. **# of shots** - Count of approach shots in that bucket
2. **SG** - Total Strokes Gained for shots in that bucket
3. **Green %** - Percentage of shots that ended on the green
4. **Proximity Ft** - Average proximity to hole
   - Shots ON green: Already in feet
   - Shots NOT on green: In yards, need to convert to feet (×3)

## Implementation Steps

### 1. Add New Type (src/types/golf.ts)
```typescript
// Approach distance bucket metrics
export interface ApproachDistanceBucket {
  label: string;
  minDistance: number;
  maxDistance: number;
  totalShots: number;
  strokesGained: number;
  avgStrokesGained: number;
  greenHits: number;
  greenHitPct: number;
  proximity: number;  // Always in feet
  proximityOnGreen: number;
}
```

### 2. Add Calculation Function (src/utils/calculations.ts)
- Filter approach shots to only include those with Starting Lie = "Tee" or "Fairway"
- Group by distance buckets
- Calculate metrics per bucket

### 3. Update useGolfData Hook
- Compute the new Approach by Distance metrics

### 4. Add Component to Approach Tab (src/App.tsx)
- Create ApproachByDistanceSection component
- Display cards in a grid layout
- Each card shows the 4 metrics

## Data Flow
```
RawShot[] → processShots() → ProcessedShot[]
                                    ↓
                    calculateApproachByDistance()
                                    ↓
                          ApproachDistanceBucket[]
                                    ↓
                        ApproachByDistanceSection
```

## UI Layout
```
┌─────────────────────────────────────────────────────┐
│            Approach by Distance                     │
├─────────────────┬─────────────────┬─────────────────┤
│ Distance Wedges │ Short Approach  │ Medium Approach│
│    51-100yds   │   101-150yds    │   151-200yds    │
├─────────────────┼─────────────────┼─────────────────┤
│   # of shots    │    # of shots   │    # of shots   │
│       SG        │        SG       │        SG       │
│    Green %      │     Green %     │     Green %     │
│  Proximity Ft   │  Proximity Ft  │  Proximity Ft   │
└─────────────────┴─────────────────┴─────────────────┘
                  ┌─────────────────┐
                  │  Long Approach  │
                  │   201-225yds    │
                  ├─────────────────┤
                  │    # of shots   │
                  │        SG       │
                  │     Green %     │
                  │  Proximity Ft   │
                  └─────────────────┘
```
