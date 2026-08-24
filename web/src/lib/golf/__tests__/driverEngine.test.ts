/**
 * Tests for the PlayerPath driver engine.
 *
 * These cover the rules that make the output trustworthy: thresholds sit where
 * the papers put them, distances are read in the right units, small samples are
 * labelled rather than dropped, and impact reflects the failing shots only.
 */

import { describe, it, expect } from 'vitest';
import {
  runDriverEngine,
  MATERIALITY_SG_PER_ROUND,
  MAX_PRIMARY,
  MAX_MONITORING,
} from '../driverEngine';
import { SPECS_BY_CODE, endFeet } from '../driverSpecs';
import type { BenchmarkSelection } from '../benchmarks';
import { shot } from './fixtures';

const BENCHMARK: BenchmarkSelection = { gender: 'male', tier: 'eliteCollege' };

const run = (shots: Parameters<typeof runDriverEngine>[0]) => runDriverEngine(shots, BENCHMARK);
const find = (shots: Parameters<typeof runDriverEngine>[0], code: string) =>
  run(shots).all.find(d => d.code === code);

/** `n` tee shots across 3 rounds, `penalties` of which took a penalty stroke. */
function teeShots(n: number, penalties: number) {
  return Array.from({ length: n }, (_, i) =>
    shot({
      roundId: `round-${(i % 3) + 1}`,
      holeNumber: (i % 18) + 1,
      shotNumber: 1,
      shotType: 'Drive',
      startingLie: 'Tee',
      startingDistance: 420,
      endingLie: 'Fairway',
      endingDistance: 150,
      hasPenalty: i < penalties,
      calculatedStrokesGained: i < penalties ? -1.2 : 0.1,
    }),
  );
}

describe('threshold boundaries', () => {
  it('places D1 in each published band', () => {
    // D1: elite <=3%, flag >5%, severe >10%.
    expect(find(teeShots(100, 3), 'D1')?.tier).toBe('elite');
    // 4% sits in the gap the paper leaves between elite and flag.
    expect(find(teeShots(100, 4), 'D1')?.tier).toBe('solid');
    expect(find(teeShots(100, 6), 'D1')?.tier).toBe('flag');
    expect(find(teeShots(100, 11), 'D1')?.tier).toBe('severe');
  });

  it('is inclusive at the elite bound and exclusive at the flag bound', () => {
    // Exactly 3% is elite; exactly 5% is not yet flagged.
    expect(find(teeShots(100, 3), 'D1')?.tier).toBe('elite');
    expect(find(teeShots(100, 5), 'D1')?.tier).toBe('solid');
  });

  it('reverses the comparison for higher-is-better drivers', () => {
    // A1: elite >=55% GIR, flag <40%, severe <25%.
    const approaches = (girCount: number) =>
      Array.from({ length: 100 }, (_, i) =>
        shot({
          roundId: `round-${(i % 3) + 1}`,
          holeNumber: (i % 18) + 1,
          shotType: 'Approach',
          startingLie: 'Fairway',
          startingDistance: 170,
          endingLie: i < girCount ? 'Green' : 'Rough',
          endingDistance: i < girCount ? 25 : 12,
          calculatedStrokesGained: i < girCount ? 0.1 : -0.4,
        }),
      );

    expect(find(approaches(60), 'A1')?.tier).toBe('elite');
    expect(find(approaches(45), 'A1')?.tier).toBe('solid');
    expect(find(approaches(30), 'A1')?.tier).toBe('flag');
    expect(find(approaches(20), 'A1')?.tier).toBe('severe');
  });
});

describe('units', () => {
  it('reads a green end distance as feet and an off-green one as yards', () => {
    expect(endFeet(shot({ endingLie: 'Green', endingDistance: 6 }))).toBe(6);
    expect(endFeet(shot({ endingLie: 'Rough', endingDistance: 6 }))).toBe(18);
  });

  it('counts a 12ft approach as in scoring position, not 36ft out', () => {
    // A2 wants <=20ft on the green. Twelve feet qualifies; the old triple
    // conversion made it 36ft and failed every one of these shots.
    const shots = Array.from({ length: 40 }, (_, i) =>
      shot({
        roundId: `round-${(i % 3) + 1}`,
        holeNumber: (i % 18) + 1,
        shotType: 'Approach',
        startingLie: 'Fairway',
        startingDistance: 120,
        endingLie: 'Green',
        endingDistance: 12,
        calculatedStrokesGained: 0.1,
      }),
    );

    const a2 = find(shots, 'A2');
    expect(a2?.metricValue).toBe(100);
    expect(a2?.tier).toBe('elite');
  });

  it('applies the 20% rule as feet against yards', () => {
    // From 100y the threshold is 20ft. A shot finishing 18ft away passes.
    const pass = Array.from({ length: 30 }, (_, i) =>
      shot({
        roundId: `round-${(i % 3) + 1}`,
        holeNumber: (i % 18) + 1,
        shotType: 'Approach',
        startingLie: 'Fairway',
        startingDistance: 100,
        endingLie: 'Green',
        endingDistance: 18,
      }),
    );
    expect(find(pass, 'A3')?.metricValue).toBe(100);
  });
});

describe('sample size is labelled, never a filter', () => {
  it('surfaces a driver from a three-round window', () => {
    const shots = teeShots(4, 1);
    const d1 = find(shots, 'D1');

    expect(d1).toBeDefined();
    expect(d1?.metricValue).toBe(25);
    expect(d1?.rounds).toBe(3);
  });

  it('marks a thin population low sample without dropping it', () => {
    const d1 = find(teeShots(4, 1), 'D1');
    expect(d1?.lowSample).toBe(true);
    expect(d1?.sampleSize).toBe(4);
  });

  it('does not mark an ample population low sample', () => {
    expect(find(teeShots(60, 4), 'D1')?.lowSample).toBe(false);
  });

  it('counts occurrences for event drivers and denominator for rate drivers', () => {
    // D1 is event-based: 200 tee shots with a single penalty is still one
    // occurrence, and one penalty is not a pattern.
    const oneEvent = find(teeShots(200, 1), 'D1');
    expect(oneEvent?.sampleSize).toBe(200);
    expect(oneEvent?.eventCount).toBe(1);
    expect(oneEvent?.lowSample).toBe(true);

    // A1 is rate-based: what matters is whether the rate is stable, so a thin
    // denominator is the low-sample signal regardless of how many missed.
    const fewApproaches = Array.from({ length: 6 }, (_, i) =>
      shot({
        roundId: `round-${(i % 3) + 1}`,
        holeNumber: i + 1,
        shotType: 'Approach',
        startingLie: 'Fairway',
        startingDistance: 170,
        endingLie: 'Rough',
        endingDistance: 15,
        calculatedStrokesGained: -0.4,
      }),
    );
    expect(find(fewApproaches, 'A1')?.lowSample).toBe(true);
  });
});

describe('impact', () => {
  it('sums only the failing shots, not the whole population', () => {
    // 20 tee shots across 4 rounds; 2 penalties at -1.2 SG each. Impact is
    // -2.4/4 = -0.6, not the population total of (-2.4 + 18*0.1)/4.
    const shots = Array.from({ length: 20 }, (_, i) =>
      shot({
        roundId: `round-${(i % 4) + 1}`,
        holeNumber: (i % 18) + 1,
        shotType: 'Drive',
        startingLie: 'Tee',
        startingDistance: 420,
        endingLie: 'Fairway',
        endingDistance: 150,
        hasPenalty: i < 2,
        calculatedStrokesGained: i < 2 ? -1.2 : 0.1,
      }),
    );

    expect(find(shots, 'D1')?.impactSG).toBeCloseTo(-0.6, 5);
  });

  it('expresses impact per round', () => {
    const twoRounds = Array.from({ length: 10 }, (_, i) =>
      shot({
        roundId: `round-${(i % 2) + 1}`,
        holeNumber: (i % 18) + 1,
        shotType: 'Drive',
        startingLie: 'Tee',
        startingDistance: 420,
        endingLie: 'Fairway',
        endingDistance: 150,
        hasPenalty: i < 2,
        calculatedStrokesGained: i < 2 ? -1.0 : 0,
      }),
    );

    expect(find(twoRounds, 'D1')?.impactSG).toBeCloseTo(-1.0, 5);
  });
});

describe('materiality gate', () => {
  const withImpact = (sgPerShot: number) =>
    Array.from({ length: 10 }, (_, i) =>
      shot({
        roundId: `round-${(i % 10) + 1}`,
        holeNumber: i + 1,
        shotType: 'Drive',
        startingLie: 'Tee',
        startingDistance: 420,
        endingLie: 'Fairway',
        endingDistance: 150,
        hasPenalty: true,
        calculatedStrokesGained: sgPerShot,
      }),
    );

  it('excludes a driver costing less than the threshold', () => {
    // 10 shots over 10 rounds at -0.29 each => -0.29 SG/round.
    const result = run(withImpact(-0.29));
    expect(result.primary.some(d => d.code === 'D1')).toBe(false);
    // Still computed and available for the segment view.
    expect(result.all.some(d => d.code === 'D1')).toBe(true);
  });

  it('includes a driver costing more than the threshold', () => {
    const result = run(withImpact(-0.31));
    expect(result.primary.some(d => d.code === 'D1')).toBe(true);
  });

  it('uses the documented threshold', () => {
    expect(MATERIALITY_SG_PER_ROUND).toBe(0.3);
  });
});

describe('causal chain', () => {
  it('ranks putting below a flagged approach pillar and says why', () => {
    // Putting costs more in raw strokes, but approach is flagged upstream, so
    // approach must lead and the putting card must explain its demotion.
    const approachMisses = Array.from({ length: 40 }, (_, i) =>
      shot({
        roundId: `round-${(i % 4) + 1}`,
        holeNumber: (i % 18) + 1,
        shotType: 'Approach',
        startingLie: 'Fairway',
        startingDistance: 170,
        endingLie: i < 30 ? 'Rough' : 'Green',
        endingDistance: i < 30 ? 15 : 25,
        calculatedStrokesGained: i < 30 ? -0.3 : 0.1,
      }),
    );

    const threePutts = Array.from({ length: 12 }, (_, i) =>
      shot({
        roundId: `round-${(i % 4) + 1}`,
        holeNumber: 1,
        shotNumber: 2 + (i % 3),
        shotType: 'Putt',
        startingLie: 'Green',
        startingDistance: 45,
        endingLie: 'Green',
        endingDistance: i % 3 === 2 ? 0 : 6,
        calculatedStrokesGained: -0.9,
      }),
    );

    const result = run([...approachMisses, ...threePutts]);
    const codes = result.primary.map(d => d.pillar);

    if (codes.includes('Putting') && codes.includes('Approach')) {
      expect(codes.indexOf('Approach')).toBeLessThan(codes.indexOf('Putting'));
      const putting = result.primary.find(d => d.pillar === 'Putting');
      expect(putting?.reorderNote).toContain('upstream');
    }
    expect(result.pillarState.Approach).toBe('severe');
  });
});

describe('output shape', () => {
  it('never returns more than three primary and two monitoring drivers', () => {
    const shots = [
      ...teeShots(60, 20),
      ...Array.from({ length: 40 }, (_, i) =>
        shot({
          roundId: `round-${(i % 3) + 1}`,
          holeNumber: (i % 18) + 1,
          shotType: 'Approach',
          startingLie: 'Fairway',
          startingDistance: 170,
          endingLie: 'Rough',
          endingDistance: 20,
          calculatedStrokesGained: -0.5,
        }),
      ),
    ];

    const result = run(shots);
    expect(result.primary.length).toBeLessThanOrEqual(MAX_PRIMARY);
    expect(result.monitoring.length).toBeLessThanOrEqual(MAX_MONITORING);
  });

  it('keeps SG1 out of the ranking but present for the segment view', () => {
    const shortGame = Array.from({ length: 30 }, (_, i) =>
      shot({
        roundId: `round-${(i % 3) + 1}`,
        holeNumber: (i % 18) + 1,
        shotNumber: 3,
        shotType: 'Short Game',
        startingLie: 'Rough',
        startingDistance: 20,
        endingLie: 'Green',
        endingDistance: 9,
        calculatedStrokesGained: -0.5,
      }),
    );

    const result = run(shortGame);
    expect(result.all.some(d => d.code === 'SG1')).toBe(true);
    expect(result.primary.some(d => d.code === 'SG1')).toBe(false);
    expect(result.monitoring.some(d => d.code === 'SG1')).toBe(false);
  });

  it('returns an empty result for no shots rather than throwing', () => {
    const result = run([]);
    expect(result.all).toEqual([]);
    expect(result.primary).toEqual([]);
    expect(result.totalRounds).toBe(0);
  });
});

describe('putting thresholds derive from the selected benchmark', () => {
  const shortPutts = (madeCount: number) =>
    Array.from({ length: 40 }, (_, i) =>
      shot({
        roundId: `round-${(i % 4) + 1}`,
        holeNumber: (i % 18) + 1,
        shotNumber: 2,
        shotType: 'Putt',
        startingLie: 'Green',
        startingDistance: 7,
        endingLie: 'Green',
        endingDistance: i < madeCount ? 0 : 2,
        calculatedStrokesGained: i < madeCount ? 0.2 : -0.4,
      }),
    );

  it('moves P1 bounds when the tier changes', () => {
    const shots = shortPutts(20);
    const tour = runDriverEngine(shots, { gender: 'male', tier: 'pgaTour' });
    const am = runDriverEngine(shots, { gender: 'male', tier: 'competitiveAm' });

    const tourBounds = tour.all.find(d => d.code === 'P1')?.tierBounds;
    const amBounds = am.all.find(d => d.code === 'P1')?.tierBounds;

    expect(tourBounds).toBeDefined();
    expect(amBounds).toBeDefined();
    // A tougher benchmark expects more putts holed, so its elite bar is higher.
    expect(tourBounds!.elite).toBeGreaterThan(amBounds!.elite);
  });

  it('marks putting drivers provisional', () => {
    expect(find(shortPutts(20), 'P1')?.provisional).toBe(true);
  });

  it('leaves P3 unrated rather than inventing a threshold', () => {
    expect(SPECS_BY_CODE.P3.tiers).toBe('unrated');
  });
});
