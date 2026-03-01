# Problem Drive Section Implementation Plan

## Overview
Add a new "Problem Drive Section" to the Driving tab that shows:
1. **Penalties Breakdown**: Total penalties, OB penalties, Standard penalties with % and SG
2. **Obstruction Rate Breakdown**: Drives ending in Sand or Recovery with % and SG breakdown

*Note: Radio button filter removed - section will show All Drivers data only*

## Placement
- Within the Driving tab
- After the existing `DrivingAnalysisSection`
- Before the `DrivesTableSection`

## Data Flow
```
App.tsx
  └── DrivingView
        └── ProblemDriveSection (NEW)
              ├── Penalties breakdown table
              └── Obstruction Rate breakdown table
```

## Implementation Steps

### Step 1: Add Types for Problem Drive Metrics
File: `src/types/golf.ts`

Add new type for problem drive breakdown:
```typescript
export interface ProblemDriveMetrics {
  // Total drives
  totalDrives: number;
  
  // Penalties breakdown
  totalPenalties: number;
  obPenalties: number;
  standardPenalties: number;
  penaltyPct: number;
  penaltySG: number;
  obPenaltyPct: number;
  obPenaltySG: number;
  standardPenaltyPct: number;
  standardPenaltySG: number;
  
  // Obstruction breakdown (sand + recovery)
  obstructionCount: number;
  obstructionPct: number;
  obstructionSG: number;
  
  // Sand breakdown
  sandCount: number;
  sandPct: number;
  sandSG: number;
  
  // Recovery breakdown
  recoveryCount: number;
  recoveryPct: number;
  recoverySG: number;
}
```

### Step 2: Add Calculation Function
File: `src/utils/calculations.ts`

Add function to calculate problem drive metrics:
```typescript
export function calculateProblemDriveMetrics(shots: ProcessedShot[]): ProblemDriveMetrics {
  // Get all drives (no filtering)
  const drives = shots.filter(s => s.shotType === 'Drive');
  
  // Calculate penalties breakdown
  // Calculate obstruction breakdown (sand + recovery)
  // Return ProblemDriveMetrics
}
```

### Step 3: Add useMemo in DrivingView
File: `src/App.tsx`

In DrivingView, calculate metrics using useMemo:
```typescript
const problemMetrics = useMemo(() => {
  return calculateProblemDriveMetrics(filteredShots);
}, [filteredShots]);
```

### Step 4: Create ProblemDriveSection Component
File: `src/App.tsx`

Create the section with:
1. Penalties breakdown cards/table
2. Obstruction Rate breakdown cards/table

## UI Design

### Penalties Breakdown (3-column layout)
| Metric | Count | % | SG |
|--------|-------|---|----|
| Total Penalties | X | X% | X.XX |
| OB Penalties | X | X% | X.XX |
| Standard Penalties | X | X% | X.XX |

### Obstruction Rate Breakdown (3-column layout)
| Metric | Count | % | SG |
|--------|-------|---|----|
| Total Obstruction | X | X% | X.XX |
| Sand | X | X% | X.XX |
| Recovery | X | X% | X.XX |

## Notes
- Obstruction = drives ending in Sand OR Recovery
- OB detection: same as existing `isOutOfBounds()` function
- SG for each category = sum of SG for all drives in that category
- % is calculated as: count / totalDrives

## Files to Modify
1. `src/types/golf.ts` - Add ProblemDriveMetrics type
2. `src/utils/calculations.ts` - Add calculateProblemDriveMetrics function
3. `src/App.tsx` - Calculate metrics and create ProblemDriveSection component
