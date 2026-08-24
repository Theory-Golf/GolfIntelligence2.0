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
  it('places D1 in each contiguous band', () => {
    // D1: elite <=3%, severe >10%, flag everything between.
    expect(find(teeShots(100, 3), 'D1')?.tier).toBe('elite');
    // 4% used to fall in an unlabelled gap; it is now flagged.
    expect(find(teeShots(100, 4), 'D1')?.tier).toBe('flag');
    expect(find(teeShots(100, 10), 'D1')?.tier).toBe('flag');
    expect(find(teeShots(100, 11), 'D1')?.tier).toBe('severe');
  });

  it('treats the elite bound as elite and the severe bound as not yet severe', () => {
    expect(find(teeShots(100, 3), 'D1')?.tier).toBe('elite');
    expect(find(teeShots(1000, 31), 'D1')?.tier).toBe('flag');
    expect(find(teeShots(100, 10), 'D1')?.tier).toBe('flag');
  });

  it('leaves no value unbanded', () => {
    // Every whole-percent penalty rate lands in exactly one of three bands.
    for (let penalties = 0; penalties <= 100; penalties += 1) {
      const tier = find(teeShots(100, penalties), 'D1')?.tier;
      expect(['elite', 'flag', 'severe']).toContain(tier);
    }
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
    // 45% used to fall in the gap between flag and elite; now flagged.
    expect(find(approaches(45), 'A1')?.tier).toBe('flag');
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

});

describe('contiguous bands the papers already published', () => {
  /**
   * SG2 and SG3 publish contiguous bands. Encoding a tier as three numbers
   * described four bands, so a mid-band value fell through every branch and
   * came back as the invented in-between tier instead of Flag.
   */
  it('rates SG3 at 60% as Flag, not something in between', () => {
    // SG3: elite >=75%, flag 50-74%, severe <50%.
    const shots = Array.from({ length: 100 }, (_, i) =>
      shot({
        roundId: `round-${(i % 5) + 1}`,
        holeNumber: (i % 18) + 1,
        shotNumber: 3,
        shotType: 'Short Game',
        startingLie: 'Fairway',
        startingDistance: 18,
        endingLie: 'Green',
        endingDistance: i < 60 ? 4 : 12,
        calculatedStrokesGained: i < 60 ? 0.1 : -0.3,
      }),
    );

    const sg3 = find(shots, 'SG3');
    expect(sg3?.metricValue).toBeCloseTo(60, 5);
    expect(sg3?.tier).toBe('flag');
  });

  it('rates SG2 at 80% conversion as Flag', () => {
    // SG2: elite >=90%, flag 70-89%, severe <70%.
    // Each hole plays drive, approach, then two short game shots, so the second
    // short game shot is shot 4. Strokes remaining after it is the hole score
    // minus 4: one putt to come converts, two does not.
    const hole = (h: number, converts: boolean) => {
      const roundId = `round-${(h % 5) + 1}`;
      const base = { roundId, holeNumber: h + 1 };
      return [
        shot({ ...base, shotNumber: 1, shotType: 'Drive', startingLie: 'Tee', startingDistance: 400, endingLie: 'Rough', endingDistance: 160 }),
        shot({ ...base, shotNumber: 2, shotType: 'Approach', startingLie: 'Rough', startingDistance: 160, endingLie: 'Rough', endingDistance: 22 }),
        shot({ ...base, shotNumber: 3, shotType: 'Short Game', startingLie: 'Rough', startingDistance: 22, endingLie: 'Rough', endingDistance: 8, calculatedStrokesGained: -0.4 }),
        shot({ ...base, shotNumber: 4, shotType: 'Short Game', startingLie: 'Rough', startingDistance: 8, endingLie: 'Green', endingDistance: converts ? 3 : 24, calculatedStrokesGained: converts ? 0.1 : -0.5 }),
        ...(converts
          ? [shot({ ...base, shotNumber: 5, shotType: 'Putt', startingLie: 'Green', startingDistance: 3, endingLie: 'Green', endingDistance: 0 })]
          : [
              shot({ ...base, shotNumber: 5, shotType: 'Putt', startingLie: 'Green', startingDistance: 24, endingLie: 'Green', endingDistance: 3, calculatedStrokesGained: -0.2 }),
              shot({ ...base, shotNumber: 6, shotType: 'Putt', startingLie: 'Green', startingDistance: 3, endingLie: 'Green', endingDistance: 0 }),
            ]),
      ];
    };

    const shots = Array.from({ length: 20 }, (_, h) => hole(h, h < 16)).flat();

    const sg2 = find(shots, 'SG2');
    expect(sg2?.metricValue).toBeCloseTo(80, 5);
    expect(sg2?.tier).toBe('flag');
  });

  it('treats SG1 at exactly 7 per round as severe', () => {
    // SG1's severe level is published as ">= 7", unlike every other driver's
    // strict ">". 21 shots over 3 rounds lands exactly on it.
    const shots = Array.from({ length: 21 }, (_, i) =>
      shot({
        roundId: `round-${(i % 3) + 1}`,
        holeNumber: (i % 18) + 1,
        shotNumber: 3,
        shotType: 'Short Game',
        startingLie: 'Rough',
        startingDistance: 20,
        endingLie: 'Green',
        endingDistance: 9,
        calculatedStrokesGained: -0.2,
      }),
    );

    const sg1 = find(shots, 'SG1');
    expect(sg1?.metricValue).toBeCloseTo(7, 5);
    expect(sg1?.tier).toBe('severe');
  });
});

describe('P3 speed window', () => {
  /** `short` of `total` lag misses finished short of the hole. */
  const lagMisses = (short: number, total: number) =>
    Array.from({ length: total }, (_, i) =>
      shot({
        roundId: `round-${(i % 4) + 1}`,
        holeNumber: (i % 18) + 1,
        shotNumber: 2,
        shotType: 'Putt',
        startingLie: 'Green',
        startingDistance: 25,
        endingLie: 'Green',
        endingDistance: 3,
        puttLongShort: i < short ? 'Short' : 'Long',
        calculatedStrokesGained: -0.1,
      }),
    );

  it('rates a balanced split elite', () => {
    // 55/45 is 5 points off balance — at the elite bound.
    const p3 = find(lagMisses(55, 100), 'P3');
    expect(p3?.metricValue).toBeCloseTo(5, 5);
    expect(p3?.tier).toBe('elite');
  });

  it('flags a moderate bias', () => {
    const p3 = find(lagMisses(62, 100), 'P3');
    expect(p3?.metricValue).toBeCloseTo(12, 5);
    expect(p3?.tier).toBe('flag');
  });

  it('calls a heavy bias severe', () => {
    const p3 = find(lagMisses(72, 100), 'P3');
    expect(p3?.metricValue).toBeCloseTo(22, 5);
    expect(p3?.tier).toBe('severe');
  });

  it('rates a long bias the same as an equal short bias, but names the direction', () => {
    const shortBias = find(lagMisses(70, 100), 'P3');
    const longBias = find(lagMisses(30, 100), 'P3');

    expect(shortBias?.metricValue).toBeCloseTo(20, 5);
    expect(longBias?.metricValue).toBeCloseTo(20, 5);
    expect(shortBias?.tier).toBe(longBias?.tier);

    expect(shortBias?.detail?.bias).toBe('short');
    expect(longBias?.detail?.bias).toBe('long');
  });

  it('is rated rather than provisional', () => {
    expect(SPECS_BY_CODE.P3.tiers).toEqual({ elite: 5, severe: 20 });
    expect(find(lagMisses(55, 100), 'P3')?.provisional).toBe(false);
  });
});
