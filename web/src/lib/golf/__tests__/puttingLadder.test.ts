import { describe, expect, it } from 'vitest';
import {
  buildPuttLog,
  deriveLadderState,
  flattenLadder,
  summarizeByDistance,
  summarizeByGroup,
  totalPutts,
  type LadderGroup,
} from '../puttingLadder';

const INSIDE_TEN: LadderGroup[] = [
  { group: 1, putts: [3, 4, 5] },
  { group: 2, putts: [4, 5, 6] },
  { group: 3, putts: [5, 6, 7] },
  { group: 4, putts: [6, 7, 8] },
  { group: 5, putts: [7, 8, 9] },
  { group: 6, putts: [8, 9, 10] },
];

const INSIDE_TWENTY: LadderGroup[] = [
  { group: 1, putts: [5, 7, 9] },
  { group: 2, putts: [7, 9, 11] },
  { group: 3, putts: [9, 11, 13] },
  { group: 4, putts: [11, 13, 15] },
  { group: 5, putts: [13, 15, 17] },
  { group: 6, putts: [15, 17, 19] },
];

/** A results array of the given length, with `makes` leading makes. */
function results(length: number, makes = 0): boolean[] {
  return Array.from({ length }, (_, i) => i < makes);
}

describe('ladder shape', () => {
  it('is 18 putts for both drills', () => {
    expect(totalPutts(INSIDE_TEN)).toBe(18);
    expect(totalPutts(INSIDE_TWENTY)).toBe(18);
  });

  it('flattens into playing order with group and putt positions', () => {
    const flat = flattenLadder(INSIDE_TEN);
    expect(flat).toHaveLength(18);
    expect(flat[0]).toEqual({ group: 1, putt: 1, distanceFt: 3 });
    expect(flat[3]).toEqual({ group: 2, putt: 1, distanceFt: 4 });
    expect(flat[17]).toEqual({ group: 6, putt: 3, distanceFt: 10 });
  });
});

describe('deriveLadderState', () => {
  it('starts on the first putt of the first group', () => {
    const state = deriveLadderState(INSIDE_TEN, []);
    expect(state.attempted).toBe(0);
    expect(state.makes).toBe(0);
    expect(state.complete).toBe(false);
    expect(state.currentGroupIndex).toBe(0);
    expect(state.currentPuttInGroup).toBe(0);
    expect(state.currentDistanceFt).toBe(3);
    expect(state.atGroupBoundary).toBe(false);
  });

  it('advances within a group', () => {
    const state = deriveLadderState(INSIDE_TEN, [true, false]);
    expect(state.attempted).toBe(2);
    expect(state.makes).toBe(1);
    expect(state.currentGroupIndex).toBe(0);
    expect(state.currentPuttInGroup).toBe(2);
    expect(state.currentDistanceFt).toBe(5);
    expect(state.atGroupBoundary).toBe(false);
  });

  it('flags the group boundary and rolls over to the next group', () => {
    const state = deriveLadderState(INSIDE_TEN, [true, false, true]);
    expect(state.atGroupBoundary).toBe(true);
    expect(state.currentGroupIndex).toBe(1);
    expect(state.currentPuttInGroup).toBe(0);
    expect(state.currentDistanceFt).toBe(4);
    expect(state.groups[0]).toMatchObject({ group: 1, made: 2, attempted: 3, complete: true });
    expect(state.groups[1]).toMatchObject({ group: 2, made: 0, attempted: 0, complete: false });
  });

  it('completes once every putt is logged', () => {
    const state = deriveLadderState(INSIDE_TEN, results(18, 11));
    expect(state.complete).toBe(true);
    expect(state.makes).toBe(11);
    expect(state.currentDistanceFt).toBeNull();
    expect(state.currentGroupIndex).toBe(INSIDE_TEN.length);
    expect(state.groups.every((g) => g.complete)).toBe(true);
  });

  it('is a pure function of the results, so undo just drops the last entry', () => {
    const played = [true, false, true, false];
    expect(deriveLadderState(INSIDE_TEN, played.slice(0, -1)))
      .toEqual(deriveLadderState(INSIDE_TEN, [true, false, true]));
  });

  it('ignores results past the end of the ladder', () => {
    const state = deriveLadderState(INSIDE_TEN, results(20, 20));
    expect(state.attempted).toBe(18);
    expect(state.makes).toBe(18);
  });
});

describe('buildPuttLog', () => {
  it('pairs each result with the distance it was hit from', () => {
    const log = buildPuttLog(INSIDE_TEN, [true, false, true]);
    expect(log).toEqual([
      { group: 1, putt: 1, distanceFt: 3, made: true },
      { group: 1, putt: 2, distanceFt: 4, made: false },
      { group: 1, putt: 3, distanceFt: 5, made: true },
    ]);
  });
});

describe('summarizeByDistance', () => {
  it('rolls a full Inside Ten ladder up by distance, ascending', () => {
    const stats = summarizeByDistance(buildPuttLog(INSIDE_TEN, results(18, 18)));
    expect(stats.map((s) => s.distanceFt)).toEqual([3, 4, 5, 6, 7, 8, 9, 10]);
    // The ladder samples the middle of the band three times as often as the ends.
    expect(stats.map((s) => s.attempted)).toEqual([1, 2, 3, 3, 3, 3, 2, 1]);
    expect(stats.every((s) => s.makeRate === 1)).toBe(true);
  });

  it('rolls a full Inside Twenty ladder up by distance', () => {
    const stats = summarizeByDistance(buildPuttLog(INSIDE_TWENTY, results(18)));
    expect(stats.map((s) => s.distanceFt)).toEqual([5, 7, 9, 11, 13, 15, 17, 19]);
    expect(stats.map((s) => s.attempted)).toEqual([1, 2, 3, 3, 3, 3, 2, 1]);
    expect(stats.every((s) => s.made === 0 && s.makeRate === 0)).toBe(true);
  });

  it('aggregates putts from more than one session', () => {
    const a = buildPuttLog(INSIDE_TEN, results(18, 18));
    const b = buildPuttLog(INSIDE_TEN, results(18));
    const stats = summarizeByDistance([...a, ...b]);
    const fiveFt = stats.find((s) => s.distanceFt === 5)!;
    expect(fiveFt).toMatchObject({ attempted: 6, made: 3, makeRate: 0.5 });
  });

  it('returns nothing for an empty log', () => {
    expect(summarizeByDistance([])).toEqual([]);
  });
});

describe('summarizeByGroup', () => {
  it('reconstructs the per-group results from a stored log', () => {
    const groups = summarizeByGroup(buildPuttLog(INSIDE_TEN, results(18, 4)));
    expect(groups).toHaveLength(6);
    expect(groups[0]).toMatchObject({
      group: 1,
      distances: [3, 4, 5],
      results: [true, true, true],
      made: 3,
      attempted: 3,
    });
    expect(groups[1]).toMatchObject({ group: 2, made: 1, attempted: 3 });
    expect(groups[5]).toMatchObject({ group: 6, made: 0, attempted: 3 });
  });
});
