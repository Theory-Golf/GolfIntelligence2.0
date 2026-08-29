import { describe, expect, it } from 'vitest';
import { expectedMakeRate, type BenchmarkSelection, type BenchmarkTier, type Gender } from '../benchmarks';

const TOUR: BenchmarkSelection = { gender: 'male', tier: 'pgaTour' };

// Published PGA Tour make rates by distance. The derived curve is only useful if
// it lands on these; they are the reason the coloring can be trusted.
const PUBLISHED_TOUR_MAKE_PCT: Array<[number, number]> = [
  [3, 96],
  [4, 88],
  [5, 77],
  [6, 66],
  [7, 58],
  [8, 50],
  [10, 40],
  [12, 33],
  [15, 23],
  [20, 15],
  [25, 11],
  [30, 7],
  [40, 4],
  [50, 3],
];

const GENDERS: Gender[] = ['male', 'female'];
const TIERS: BenchmarkTier[] = ['pgaTour', 'eliteCollege', 'competitiveAm'];

describe('expectedMakeRate', () => {
  it.each(PUBLISHED_TOUR_MAKE_PCT)(
    'is within 2 points of the published Tour make rate at %i ft (%i%%)',
    (distance, published) => {
      expect(Math.abs(expectedMakeRate(TOUR, distance) - published)).toBeLessThanOrEqual(2);
    }
  );

  it('returns 100% for a ball already in the hole', () => {
    expect(expectedMakeRate(TOUR, 0)).toBe(100);
  });

  it('never falls outside 0-100% for any tier at any distance', () => {
    for (const gender of GENDERS) {
      for (const tier of TIERS) {
        for (let d = 1; d <= 90; d++) {
          const rate = expectedMakeRate({ gender, tier }, d);
          expect(rate).toBeGreaterThanOrEqual(0);
          expect(rate).toBeLessThanOrEqual(100);
        }
      }
    }
  });

  it('decreases monotonically with distance from 1 to 60 ft for every tier', () => {
    for (const gender of GENDERS) {
      for (const tier of TIERS) {
        let previous = expectedMakeRate({ gender, tier }, 1);
        for (let d = 2; d <= 60; d++) {
          const rate = expectedMakeRate({ gender, tier }, d);
          expect(rate).toBeLessThanOrEqual(previous + 1e-9);
          previous = rate;
        }
      }
    }
  });

  it('ranks tiers by ability at a mid-range distance', () => {
    const tour = expectedMakeRate({ gender: 'male', tier: 'pgaTour' }, 8);
    const elite = expectedMakeRate({ gender: 'male', tier: 'eliteCollege' }, 8);
    const scratch = expectedMakeRate({ gender: 'male', tier: 'competitiveAm' }, 8);
    expect(tour).toBeGreaterThanOrEqual(elite);
    expect(elite).toBeGreaterThan(scratch);
  });
});
