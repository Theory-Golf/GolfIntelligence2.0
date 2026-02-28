# Shot Data Table Update Plan

## Column Mapping Summary

| Old Column | New Column | Action |
|-----------|-----------|--------|
| Starting Location | Starting Lie | Rename |
| Ending Location | Ending Lie | Rename |
| Benchmark | — | Remove (calculated internally) |
| Starting SG | — | Remove (calculated internally) |
| Ending SG | — | Remove (calculated internally) |
| Strokes Gained | — | Remove (calculated internally) |
| — | Did not Hit Driver | Add (yes/no) |
| — | Putt Result | Add (short/long) |

All other columns remain unchanged: Player, Round ID, Date, Course, Weather Difficulty, Course Difficulty, Tournament, Shot, Hole, Score, Starting Distance, Ending Distance, Penalty.

## New Field Types

- **Starting Lie**: Same values as old "Starting Location" (Tee, Fairway, Rough, Sand, Green, Recovery)
- **Ending Lie**: Same values as old "Ending Location"
- **Did not Hit Driver**: Yes/No field
- **Putt Result**: short/long

## Implementation Tasks

### 1. Update `src/types/golf.ts`

- [ ] Rename `Starting Location` → `Starting Lie` in RawShot interface
- [ ] Rename `Ending Location` → `Ending Lie` in RawShot interface
- [ ] Remove `Benchmark`, `Starting SG`, `Ending SG`, `Strokes Gained` fields from RawShot
- [ ] Add `Did not Hit Driver: string` to RawShot
- [ ] Add `Putt Result: string` to RawShot
- [ ] Update ProcessedShot interface if needed (it inherits from RawShot)

### 2. Update `src/utils/calculations.ts`

- [ ] Update `classifyShotType()` function to use `Starting Lie` instead of `Starting Location`
- [ ] Update all references to `Ending Location` → `Ending Lie` in:
  - `processShots()` function
  - `calculateTiger5Metrics()` function (fairway and GIR tracking)
  - `getRoundSummaries()` function

### 3. Update `src/hooks/useGolfData.ts`

- [ ] Update numeric field list in data cleaning to include new fields and remove old ones
- [ ] Current list includes: Shot, Hole, Score, Starting Distance, Ending Distance, Starting SG, Ending SG, Strokes Gained
- [ ] New list should be: Shot, Hole, Score, Starting Distance, Ending Distance
- [ ] May need to add `Did not Hit Driver` as a filterable field if needed

### 4. No Changes Needed

- `src/data/benchmarks.ts` - The benchmark calculation functions use internal location mapping that doesn't depend on CSV column names. The benchmark type selection (pgaTour, eliteCollege, competitiveAm) remains in the FilterBar UI.

## Architecture Note

The dashboard already calculates Strokes Gained internally using the benchmark tables. This change simply removes the pre-calculated SG values from the raw data and adds two new fields (Did not Hit Driver, Putt Result) that can be used for additional analytics.
