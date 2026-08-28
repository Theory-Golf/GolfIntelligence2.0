/**
 * Birdie opportunity / conversion rules.
 *
 * Opportunity = green in regulation (green reached in par - 2 strokes or fewer)
 * AND the first putt starts within 20 FEET. Conversion = that putt was holed.
 */

import { describe, it, expect } from 'vitest';
import { calculateBirdieOpportunities } from '../calculations';
import { shot } from './fixtures';
import type { ProcessedShot } from '../types';

/**
 * Build one par-4 hole: drive, approach onto the green, then `putts` putts
 * starting from `firstPuttFeet`. Score is 2 + putts.
 */
function par4Hole(holeNumber: number, firstPuttFeet: number, putts: number): ProcessedShot[] {
  const shots = [
    shot({ holeNumber, holePar: 4, shotNumber: 1, startingLie: 'Tee', shotType: 'Drive' }),
    shot({ holeNumber, holePar: 4, shotNumber: 2, startingLie: 'Fairway', shotType: 'Approach', endingLie: 'Green' }),
  ];
  for (let i = 0; i < putts; i++) {
    shots.push(shot({
      holeNumber,
      holePar: 4,
      shotNumber: 3 + i,
      startingLie: 'Green',
      startingDistance: i === 0 ? firstPuttFeet : 2,
      shotType: 'Putt',
    }));
  }
  return shots;
}

describe('calculateBirdieOpportunities', () => {
  it('counts a holed 8 ft putt from GIR as an opportunity and a conversion', () => {
    const result = calculateBirdieOpportunities(par4Hole(1, 8, 1), []);
    expect(result).toMatchObject({ opportunities: 1, conversions: 1, conversionPct: 100 });
  });

  it('counts a 2-putt par from GIR inside 20 ft as an opportunity but not a conversion', () => {
    const result = calculateBirdieOpportunities(par4Hole(1, 15, 2), []);
    expect(result).toMatchObject({ opportunities: 1, conversions: 0, conversionPct: 0 });
  });

  it('excludes a made birdie putt from outside 20 ft', () => {
    // A birdie, but never a "birdie opportunity" under the 20 ft rule.
    const result = calculateBirdieOpportunities(par4Hole(1, 22, 1), []);
    expect(result).toMatchObject({ opportunities: 0, conversions: 0 });
  });

  it('treats 20 ft as inside the window', () => {
    expect(calculateBirdieOpportunities(par4Hole(1, 20, 1), []).opportunities).toBe(1);
  });

  it('excludes a green reached in par - 1 strokes (not a GIR)', () => {
    // Par 4 reached in 3: chip on, then a 5 ft putt. Not green in regulation.
    const shots = [
      shot({ holeNumber: 1, holePar: 4, shotNumber: 1, startingLie: 'Tee', shotType: 'Drive' }),
      shot({ holeNumber: 1, holePar: 4, shotNumber: 2, startingLie: 'Rough', shotType: 'Approach' }),
      shot({ holeNumber: 1, holePar: 4, shotNumber: 3, startingLie: 'Rough', shotType: 'Short Game', endingLie: 'Green' }),
      shot({ holeNumber: 1, holePar: 4, shotNumber: 4, startingLie: 'Green', startingDistance: 5, shotType: 'Putt' }),
    ];
    expect(calculateBirdieOpportunities(shots, []).opportunities).toBe(0);
  });

  it('resolves the first putt by shot number, not array order', () => {
    // Same holed-birdie hole, shots supplied shuffled. The 2 ft tap-in must not
    // be mistaken for the first putt.
    const shots = par4Hole(1, 8, 2);
    const shuffled = [shots[3], shots[0], shots[2], shots[1]];
    const result = calculateBirdieOpportunities(shuffled, []);
    expect(result).toMatchObject({ opportunities: 1, conversions: 0 });
  });

  it('credits a holed putt for eagle as a conversion', () => {
    // Par 5 reached in 2 (better than GIR), first putt holed for eagle.
    const shots = [
      shot({ holeNumber: 1, holePar: 5, shotNumber: 1, startingLie: 'Tee', shotType: 'Drive' }),
      shot({ holeNumber: 1, holePar: 5, shotNumber: 2, startingLie: 'Fairway', shotType: 'Approach', endingLie: 'Green' }),
      shot({ holeNumber: 1, holePar: 5, shotNumber: 3, startingLie: 'Green', startingDistance: 12, shotType: 'Putt' }),
    ];
    expect(calculateBirdieOpportunities(shots, [])).toMatchObject({ opportunities: 1, conversions: 1 });
  });

  it('ignores a hole that never reached the green', () => {
    const shots = [
      shot({ holeNumber: 1, holePar: 4, shotNumber: 1, startingLie: 'Tee', shotType: 'Drive' }),
      shot({ holeNumber: 1, holePar: 4, shotNumber: 2, startingLie: 'Fairway', shotType: 'Approach' }),
    ];
    expect(calculateBirdieOpportunities(shots, [])).toMatchObject({ opportunities: 0, conversionPct: 0 });
  });

  it('separates holes that share a hole number across rounds', () => {
    const r1 = par4Hole(1, 8, 1).map(s => ({ ...s, roundId: 'round-1' }));
    const r2 = par4Hole(1, 8, 2).map(s => ({ ...s, roundId: 'round-2' }));
    const result = calculateBirdieOpportunities([...r1, ...r2], []);
    expect(result).toMatchObject({ opportunities: 2, conversions: 1, conversionPct: 50 });
  });
});
