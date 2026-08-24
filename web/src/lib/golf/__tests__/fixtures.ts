/**
 * Shot fixtures for driver tests.
 *
 * The single trap these guard against: distances are yards EXCEPT when the
 * corresponding lie is Green, where they are feet (types.ts). Build fixtures
 * with `shot({ endingLie: 'Green', endingDistance: 6 })` meaning six FEET.
 */

import type { ProcessedShot } from '../types';

let seq = 0;

/** A shot with sensible defaults; override only what the test cares about. */
export function shot(overrides: Partial<ProcessedShot> = {}): ProcessedShot {
  seq += 1;
  return {
    shotId: `shot-${seq}`,
    playerId: 'player-1',
    playerName: 'Test Player',
    roundId: 'round-1',
    playedOn: '2026-04-01',
    roundType: 'Tournament',
    roundNumber: 1,
    courseId: 'course-1',
    courseName: 'Test Course',
    holeNumber: 1,
    holePar: 4,
    shotNumber: 1,
    startingLie: 'Fairway',
    startingDistance: 150,
    endingLie: 'Green',
    endingDistance: 20,
    hasPenalty: false,
    clubCategory: null,
    missDirection: null,
    puttLongShort: null,
    shotType: 'Approach',
    calculatedStrokesGained: 0,
    ...overrides,
  };
}

/** `n` shots sharing the same overrides, spread across distinct rounds. */
export function shotsAcrossRounds(n: number, rounds: number, overrides: Partial<ProcessedShot> = {}): ProcessedShot[] {
  return Array.from({ length: n }, (_, i) =>
    shot({ ...overrides, roundId: `round-${(i % rounds) + 1}`, holeNumber: (i % 18) + 1 }),
  );
}
