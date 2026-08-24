/**
 * Regression tests for the PlayerPath driver calculations.
 *
 * These cover the two defects fixed alongside them:
 *   1. green distances were converted yards→feet a second time, inflating
 *      every proximity and short-game reading threefold;
 *   2. a `sampleSize >= 10` gate suppressed drivers entirely on short review
 *      windows such as a three-round tournament.
 */

import { describe, it, expect } from 'vitest';
import { calculatePerformanceDriversV2 } from '../playerPathCalculations';
import { shot } from './fixtures';

describe('green distances are treated as feet, not yards', () => {
  it('counts a 12ft approach result as inside the 20ft target', () => {
    // 12 shots in the 100-150y band, every one finishing 12 FEET from the pin.
    // That is comfortably inside the band's 20ft target, so proximity rate is
    // 100% and A2 must not fire. Under the old `* 3` it read as 36ft — outside
    // the target — giving a 0% rate and a false Critical driver.
    const shots = Array.from({ length: 12 }, (_, i) =>
      shot({
        roundId: `round-${(i % 3) + 1}`,
        holeNumber: i + 1,
        shotType: 'Approach',
        startingDistance: 120,
        endingLie: 'Green',
        endingDistance: 12,
        calculatedStrokesGained: -0.2,
      }),
    );

    const result = calculatePerformanceDriversV2(shots);
    const a2 = result.drivers.filter(d => d.driverId === 'A2');
    expect(a2).toHaveLength(0);
  });

  it('does not count a 6ft short-game result as a >15ft failure', () => {
    // 12 short game shots, each finishing 6 FEET from the pin. Failure rate
    // should be 0%. The old `* 3` read them as 18ft — every one a "failure" —
    // producing a 100% failure rate and a spurious S3 driver.
    const shots = Array.from({ length: 12 }, (_, i) =>
      shot({
        roundId: `round-${(i % 3) + 1}`,
        holeNumber: i + 1,
        shotType: 'Short Game',
        startingLie: 'Fairway',
        startingDistance: 20,
        endingLie: 'Green',
        endingDistance: 6,
        calculatedStrokesGained: 0.1,
      }),
    );

    const result = calculatePerformanceDriversV2(shots);
    const s3 = result.drivers.filter(d => d.driverId === 'S3');
    expect(s3).toHaveLength(0);
  });

  it('still flags genuinely long short-game results', () => {
    // Same shape, but finishing 25ft away — a real failure at any conversion.
    const shots = Array.from({ length: 12 }, (_, i) =>
      shot({
        roundId: `round-${(i % 3) + 1}`,
        holeNumber: i + 1,
        shotType: 'Short Game',
        startingLie: 'Fairway',
        startingDistance: 20,
        endingLie: 'Green',
        endingDistance: 25,
        calculatedStrokesGained: -0.4,
      }),
    );

    const result = calculatePerformanceDriversV2(shots);
    expect(result.drivers.some(d => d.driverId === 'S3')).toBe(true);
  });
});

describe('sample size never suppresses a driver', () => {
  it('surfaces a tee-shot penalty driver from a three-round window', () => {
    // Four tee shots across three rounds, one with a penalty. Well under the
    // old gate of 10, but a 25% penalty rate is exactly what a coach reviewing
    // a tournament needs to see.
    const shots = [
      shot({ roundId: 'round-1', holeNumber: 1, shotType: 'Drive', startingLie: 'Tee', startingDistance: 420, endingLie: 'Fairway', endingDistance: 150, calculatedStrokesGained: 0.1 }),
      shot({ roundId: 'round-1', holeNumber: 2, shotType: 'Drive', startingLie: 'Tee', startingDistance: 410, endingLie: 'Rough', endingDistance: 160, hasPenalty: true, calculatedStrokesGained: -1.3 }),
      shot({ roundId: 'round-2', holeNumber: 3, shotType: 'Drive', startingLie: 'Tee', startingDistance: 400, endingLie: 'Fairway', endingDistance: 140, calculatedStrokesGained: 0.2 }),
      shot({ roundId: 'round-3', holeNumber: 4, shotType: 'Drive', startingLie: 'Tee', startingDistance: 430, endingLie: 'Fairway', endingDistance: 155, calculatedStrokesGained: 0.0 }),
    ];

    const result = calculatePerformanceDriversV2(shots);
    const d1 = result.drivers.find(d => d.driverId === 'D1');

    expect(d1).toBeDefined();
    expect(result.totalRounds).toBe(3);
  });

  it('reports the sample size so the reader can judge confidence', () => {
    const shots = [
      shot({ roundId: 'round-1', holeNumber: 1, shotType: 'Drive', startingLie: 'Tee', startingDistance: 420, endingLie: 'Fairway', endingDistance: 150 }),
      shot({ roundId: 'round-1', holeNumber: 2, shotType: 'Drive', startingLie: 'Tee', startingDistance: 410, endingLie: 'Rough', endingDistance: 160, hasPenalty: true, calculatedStrokesGained: -1.3 }),
      shot({ roundId: 'round-2', holeNumber: 3, shotType: 'Drive', startingLie: 'Tee', startingDistance: 400, endingLie: 'Fairway', endingDistance: 140 }),
    ];

    const result = calculatePerformanceDriversV2(shots);
    const d1 = result.drivers.find(d => d.driverId === 'D1');

    expect(d1?.sampleSize).toBe(3);
  });
});

describe('empty input', () => {
  it('returns no drivers rather than throwing', () => {
    const result = calculatePerformanceDriversV2([]);
    expect(result.drivers).toEqual([]);
    expect(result.totalRounds).toBe(0);
  });
});
