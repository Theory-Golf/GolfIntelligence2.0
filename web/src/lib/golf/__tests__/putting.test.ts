import { describe, expect, it } from 'vitest';
import { shot } from './fixtures';
import {
  calculatePuttingByDistance,
  calculatePuttingMetrics,
  classifyLagOutcome,
} from '../calculations';
import { expectedMakeRate, type BenchmarkSelection } from '../benchmarks';
import type { ProcessedShot } from '../types';

const TOUR: BenchmarkSelection = { gender: 'male', tier: 'pgaTour' };

/** A putt from `startFt` finishing `endFt` from the hole. Distances are feet. */
function putt(startFt: number, endFt: number, overrides: Partial<ProcessedShot> = {}): ProcessedShot {
  return shot({
    shotType: 'Putt',
    startingLie: 'Green',
    startingDistance: startFt,
    endingLie: 'Green',
    endingDistance: endFt,  // 0 = holed
    puttLongShort: endFt === 0 ? null : 'Short',
    ...overrides,
  });
}

const bucket = (shots: ProcessedShot[], label: string) =>
  calculatePuttingByDistance(shots, TOUR).find(b => b.label === label)!;

describe('speed ratio', () => {
  it('counts only classified misses, so made putts cannot suppress it', () => {
    // Nine makes and two misses from 5-8 ft: one long, one short.
    const shots = [
      ...Array.from({ length: 9 }, () => putt(6, 0)),
      putt(6, 2, { puttLongShort: 'Long' }),
      putt(6, 2, { puttLongShort: 'Short' }),
    ];
    const b = bucket(shots, '5-8');
    expect(b.totalPutts).toBe(11);
    expect(b.longPutts).toBe(1);
    expect(b.shortPutts).toBe(1);
    // 1 of 2 classified misses, not 1 of 11 putts.
    expect(b.speedRatio).toBe(50);
  });

  it('reports null rather than 0% when no miss was classified', () => {
    const b = bucket([putt(3, 0), putt(3, 0)], '0-4');
    expect(b.totalPutts).toBe(2);
    expect(b.speedRatio).toBeNull();
  });

  it('applies the same denominator to the Speed Rating card', () => {
    const shots = [
      putt(30, 2, { puttLongShort: 'Long', roundId: 'r1', holeNumber: 1 }),
      putt(30, 2, { puttLongShort: 'Long', roundId: 'r1', holeNumber: 2 }),
      putt(30, 2, { puttLongShort: 'Short', roundId: 'r1', holeNumber: 3 }),
      putt(30, 0, { roundId: 'r1', holeNumber: 4 }),
    ];
    const metrics = calculatePuttingMetrics(shots, TOUR);
    expect(metrics.totalLongPutts).toBe(4);      // all first putts >= 20 ft
    expect(metrics.classifiedLongShort).toBe(3); // the made putt is excluded
    expect(metrics.speedRating).toBeCloseTo((2 / 3) * 100, 5);
  });

  it('leaves speedRating null when nothing was classified', () => {
    const metrics = calculatePuttingMetrics([putt(30, 0)], TOUR);
    expect(metrics.speedRating).toBeNull();
  });
});

describe('benchmark make %', () => {
  it('averages the benchmark over the distances actually faced, not the bucket midpoint', () => {
    // Both putts sit at the short end of the 20-40 ft bucket.
    const shots = [putt(22, 3), putt(24, 3)];
    const b = bucket(shots, '20-40');
    const expectedAvg = (expectedMakeRate(TOUR, 22) + expectedMakeRate(TOUR, 24)) / 2;
    expect(b.benchmarkMakePct).toBeCloseTo(expectedAvg, 5);
    // Well above what the bucket's midpoint (30 ft) would imply.
    expect(b.benchmarkMakePct).toBeGreaterThan(expectedMakeRate(TOUR, 30));
  });

  it('tracks the selected benchmark', () => {
    const shots = [putt(6, 0), putt(7, 2)];
    const tour = calculatePuttingByDistance(shots, TOUR).find(b => b.label === '5-8')!;
    const scratch = calculatePuttingByDistance(shots, { gender: 'female', tier: 'competitiveAm' })
      .find(b => b.label === '5-8')!;
    expect(tour.benchmarkMakePct).toBeGreaterThan(scratch.benchmarkMakePct);
  });

  it('reports the 0-4 ft benchmark alongside the card value', () => {
    const metrics = calculatePuttingMetrics([putt(3, 0), putt(3, 1)], TOUR);
    expect(metrics.makePct0to4Ft).toBe(50);
    expect(metrics.benchmarkMakePct0to4Ft).toBeCloseTo(expectedMakeRate(TOUR, 3), 5);
  });
});

describe('classifyLagOutcome', () => {
  it('leaves putts inside the lag range unrated', () => {
    expect(classifyLagOutcome(putt(12, 1))).toBeNull();
    expect(classifyLagOutcome(shot({ shotType: 'Approach' }))).toBeNull();
  });

  it('rates a made lag putt as good', () => {
    expect(classifyLagOutcome(putt(40, 0))).toBe('good');
  });

  it('splits good, fair and poor at the same cutoffs as the table rows', () => {
    expect(classifyLagOutcome(putt(13, 3))).toBe('good');
    expect(classifyLagOutcome(putt(13, 4))).toBe('fair');
    expect(classifyLagOutcome(putt(13, 5))).toBe('poor');
  });

  it('agrees with the Good Lag % / Poor Lag % the table reports', () => {
    const shots = [putt(30, 0), putt(30, 3), putt(30, 4), putt(30, 9)];
    const b = bucket(shots, '20-40');
    expect(b.goodLagPct).toBe(50); // the make and the 3 ft leave
    expect(b.poorLagPct).toBe(25); // the 9 ft leave; the 4 ft leave is neither
  });
});
