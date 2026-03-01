# Driving Tab Implementation Plan

## Overview
Implement OB (Out of Bounds) detection and Driving Tab with hero cards showing:
1. **Penalty Rate** (OB counts as 2 strokes)
2. **Driving Distance** (75th percentile of actual drives)
3. **Total Strokes Gained – Driving**
4. **Fairway Hit Percentage**

## OB Detection Logic

A tee shot is OB when:
- **Ending Lie** = Starting Lie AND
- **Ending Distance** = Starting Distance AND
- **Penalty** = "Yes"

```typescript
function isOutOfBounds(shot: ProcessedShot): boolean {
  if (shot.Penalty !== 'Yes') return false;
  return shot['Starting Lie'] === shot['Ending Lie'] && 
         shot['Starting Distance'] === shot['Ending Distance'];
}
```

## Penalty Rate Calculation

- **OB Penalties**: Count as 2 strokes
- **Other Penalties**: Count as 1 stroke
- **Penalty Rate**: (Total Penalty Strokes) / (Total Drives)

```typescript
// Example:
// 3 OB penalties = 6 strokes
// 2 other penalties = 2 strokes
// Total = 8 penalty strokes / 50 drives = 16% penalty rate
```

## Implementation Steps

### 1. Add OB Detection Function
File: `src/utils/calculations.ts`

Add `isOutOfBounds()` function to detect OB shots.

### 2. Add DrivingMetrics Type
File: `src/types/golf.ts`

```typescript
export interface DrivingMetrics {
  totalDrives: number;
  fairwaysHit: number;
  fairwayPct: number;
  drivingSG: number;
  avgDrivingSG: number;
  drivingDistance75th: number;  // 75th percentile
  totalPenalties: number;
  obPenalties: number;
  otherPenalties: number;
  penaltyRate: number;  // OB counts as 2
}
```

### 3. Add calculateDrivingMetrics Function
File: `src/utils/calculations.ts`

```typescript
export function calculateDrivingMetrics(shots: ProcessedShot[]): DrivingMetrics {
  // Filter to only drives (shotType === 'Drive')
  // Calculate all metrics
}
```

### 4. Update useGolfData Hook
File: `src/hooks/useGolfData.ts`

Add `drivingMetrics` to the return value.

### 5. Create DrivingView Component
File: `src/App.tsx`

Create hero cards for the four metrics.

### 6. Add Driving Tab Routing
File: `src/App.tsx`

Update the activeTab === 'driving' case to show DrivingView.
