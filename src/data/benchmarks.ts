/**
 * Golf Intelligence — Benchmark Data
 *
 * Strokes Gained benchmark lookup tables loaded from real CSV data.
 * Formula: SG = Benchmark Expected from Start - (1 + Benchmark Expected from End)
 *
 * Three benchmarks:
 * - pgaTour: PGA Tour averages
 * - eliteCollege: Elite College (+3 handicap)
 * - competitiveAm: Competitive Amateur (Scratch)
 */

import pgaTourCsv       from './PGA Tour Benchmark.csv?raw';
import eliteCollegeCsv  from './Elite College (+3) Benchmark.csv?raw';
import competitiveAmCsv from './Competative AM (Scratch) Benchmark.csv?raw';

// Location types matching the data
export type BenchmarkLocation = 'Tee' | 'Fairway' | 'Rough' | 'Sand' | 'Green' | 'Recovery';

// Benchmark type
export type BenchmarkType = 'pgaTour' | 'eliteCollege' | 'competitiveAm';

// Typed lookup arrays indexed by integer distance
type BenchmarkLookup = {
  tee: number[];
  fairway: number[];
  rough: number[];
  sand: number[];
  recovery: number[];
  putt: number[];
};

function parseBenchmarkCsv(csv: string): BenchmarkLookup {
  const lookup: BenchmarkLookup = { tee: [], fairway: [], rough: [], sand: [], recovery: [], putt: [] };
  const lines = csv.split('\n');
  const headerIdx = lines.findIndex(l => l.startsWith('Distance'));
  if (headerIdx === -1) return lookup;
  for (const line of lines.slice(headerIdx + 1)) {
    const parts = line.split(',');
    if (parts.length < 6) continue;
    const [dist, tee, fairway, rough, sand, recovery, putt] = parts.map(Number);
    if (isNaN(dist)) continue;
    lookup.tee[dist]      = tee;
    lookup.fairway[dist]  = fairway;
    lookup.rough[dist]    = rough;
    lookup.sand[dist]     = sand;
    lookup.recovery[dist] = recovery;
    lookup.putt[dist]     = isNaN(putt) ? 0 : putt;
  }
  return lookup;
}

const pgaTourLookup       = parseBenchmarkCsv(pgaTourCsv);
const eliteCollegeLookup  = parseBenchmarkCsv(eliteCollegeCsv);
const competitiveAmLookup = parseBenchmarkCsv(competitiveAmCsv);
const MAX_DIST = 650;

function lookupBenchmark(lookup: BenchmarkLookup, distance: number, location: string): number {
  if (distance <= 0) return 0; // ball in hole — 0 strokes needed
  const d = Math.max(1, Math.min(MAX_DIST, Math.round(distance)));
  switch (location) {
    case 'Tee':      return lookup.tee[d]      ?? 0;
    case 'Fairway':  return lookup.fairway[d]  ?? 0;
    case 'Rough':    return lookup.rough[d]    ?? 0;
    case 'Sand':     return lookup.sand[d]     ?? 0;
    case 'Recovery': return lookup.recovery[d] ?? 0;
    case 'Green':
    case 'Putt':     return lookup.putt[d]     ?? 0;
    default:         return lookup.fairway[d]  ?? 0;
  }
}

/**
 * Look up expected strokes from a benchmark table
 */
export function lookupExpectedStrokes(
  benchmark: BenchmarkType,
  distance: number,
  location: string
): number {
  switch (benchmark) {
    case 'pgaTour':       return lookupBenchmark(pgaTourLookup,       distance, location);
    case 'eliteCollege':  return lookupBenchmark(eliteCollegeLookup,  distance, location);
    case 'competitiveAm': return lookupBenchmark(competitiveAmLookup, distance, location);
    default:              return lookupBenchmark(pgaTourLookup,       distance, location);
  }
}

/**
 * Calculate Strokes Gained for a single shot
 * SG = Expected from Start - (1 + Expected from End)
 * For penalty shots: SG = Expected from Start - (2 + Expected from End)
 * The extra "-1" accounts for the penalty stroke
 */
export function calculateStrokesGained(
  benchmark: BenchmarkType,
  startDistance: number,
  startLocation: string,
  endDistance: number,
  endLocation: string,
  isPenalty: boolean = false
): number {
  const expectedStart = lookupExpectedStrokes(benchmark, startDistance, startLocation);
  const expectedEnd = lookupExpectedStrokes(benchmark, endDistance, endLocation);

  // For penalty shots, subtract an extra stroke (penalty stroke)
  const penaltyAdjustment = isPenalty ? 1 : 0;

  // SG = Expected from start position - (1 + expected from end position + penalty adjustment)
  return expectedStart - (1 + expectedEnd + penaltyAdjustment);
}

/**
 * Benchmark display names
 */
export const BENCHMARK_LABELS: Record<BenchmarkType, string> = {
  pgaTour: 'PGA Tour',
  eliteCollege: 'Elite College (+3)',
  competitiveAm: 'Competitive Am (Scratch)',
};

/**
 * Get all benchmark options for dropdown
 */
export function getBenchmarkOptions(): { value: BenchmarkType; label: string }[] {
  return [
    { value: 'pgaTour', label: BENCHMARK_LABELS.pgaTour },
    { value: 'eliteCollege', label: BENCHMARK_LABELS.eliteCollege },
    { value: 'competitiveAm', label: BENCHMARK_LABELS.competitiveAm },
  ];
}
